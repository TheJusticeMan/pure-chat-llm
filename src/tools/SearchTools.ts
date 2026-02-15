import { defineToolParameters, InferArgs, Tool } from '../tools';
import { ToolOutputBuilder } from './ToolOutputBuilder';
import GlobToRegExp from 'glob-to-regexp';
import { TFolder, TFile } from 'obsidian';
import { BooleanSearchParser, ParsedQuery } from '../utils/BooleanSearchParser';

// --- Glob Files ---
const globFilesParameters = defineToolParameters({
  type: 'object',
  properties: {
    pattern: {
      type: 'string',
      description: "The glob pattern to match (e.g., '**/*.md', 'Attachments/*.png').",
    },
    include_fields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['path', 'name', 'extension', 'size', 'mtime'],
        description: 'Metadata field to include',
      },
      description: 'Specific file metadata fields to return. Default is just the path.',
    },
    limit: {
      type: 'integer',
      description: 'The maximum number of results. Defaults to 100.',
      default: 100,
    },
  },
  required: ['pattern'],
} as const);

type GlobFilesArgs = InferArgs<typeof globFilesParameters>;

export class GlobFilesTool extends Tool<GlobFilesArgs> {
  readonly name = 'glob_vault_files';
  readonly classification = 'Vault';
  readonly description = 'Searches the vault for file paths matching a specific glob pattern.';
  readonly parameters = globFilesParameters;
  isAvailable() {
    return true;
  }
  async execute(args: GlobFilesArgs): Promise<string> {
    const { pattern, include_fields = ['path'], limit = 100 } = args;
    const app = this.chat.plugin.app;
    void this.status(`Searching files: "${pattern}"...`);
    const files = app.vault.getFiles();
    const regex = GlobToRegExp(pattern, { globstar: true });
    const matched = files.filter(f => regex.test(f.path)).slice(0, limit);
    if (matched.length === 0)
      return new ToolOutputBuilder()
        .addHeader(`GLOB RESULTS: "${pattern}"`)
        .addKeyValue('Status', 'No matches')
        .build();

    const builder = new ToolOutputBuilder()
      .addHeader(`GLOB RESULTS: "${pattern}"`)
      .addKeyValue('Found', `${matched.length} match${matched.length === 1 ? '' : 'es'}`);
    if (matched.length === limit) builder.addKeyValue('NOTE', 'Results limited');
    builder.addSeparator();

    // Explicitly cast fields to string array
    const fields = (include_fields || ['path']) as string[];

    if (fields.length > 1 || fields[0] !== 'path') {
      const headers = ['#'];
      if (fields.includes('path')) headers.push('Path');
      if (fields.includes('name')) headers.push('Name');
      if (fields.includes('size')) headers.push('Size');
      const rows = matched.map((f, i) => {
        const row = [`${i + 1}`];
        if (fields.includes('path')) row.push(f.path);
        if (fields.includes('name')) row.push(f.name);
        if (fields.includes('size')) row.push(String(f.stat.size));
        return row;
      });
      builder.addTable(headers, rows);
    } else {
      matched.forEach((f, i) => builder.addKeyValue(`${i + 1}`, f.path));
    }
    return builder.build();
  }
}

// --- List Folders ---
const listFoldersParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The root path to start listing from. Defaults to root (/).',
      default: '/',
    },
    recursive: {
      type: 'boolean',
      description: 'Whether to list recursively. Defaults to false.',
      default: false,
    },
  },
  required: [],
} as const);

type ListFoldersArgs = InferArgs<typeof listFoldersParameters>;

export class ListFoldersTool extends Tool<ListFoldersArgs> {
  readonly name = 'list_vault_folders';
  readonly classification = 'Vault';
  readonly description = 'Lists folders in the vault to understand the directory structure.';
  readonly parameters = listFoldersParameters;
  isAvailable() {
    return true;
  }
  async execute(args: ListFoldersArgs): Promise<string> {
    const { path = '/', recursive = false } = args;
    const app = this.chat.plugin.app;
    const targetPath = String(path);
    const root = app.vault.getAbstractFileByPath(targetPath === '' ? '/' : targetPath);
    if (!root || !(root instanceof TFolder))
      return new ToolOutputBuilder()
        .addError('FolderNotFoundError', `No folder at "${targetPath}"`, [])
        .build();

    void this.status(`Listing folders in "${targetPath}"...`);
    const stats: { path: string; fileCount: number }[] = [];
    const walk = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          let count = 0;
          const countFiles = (f: TFolder) => {
            for (const c of f.children) {
              if (c instanceof TFile) {
                count++;
              } else if (c instanceof TFolder) {
                countFiles(c);
              }
            }
          };
          countFiles(child);
          stats.push({ path: child.path, fileCount: count });
          if (recursive) walk(child);
        }
      }
    };
    walk(root);
    if (stats.length === 0)
      return new ToolOutputBuilder()
        .addHeader(`FOLDERS IN: "${targetPath}"`)
        .addKeyValue('Status', 'No subfolders')
        .build();
    const builder = new ToolOutputBuilder().addHeader(`FOLDERS IN: "${targetPath}"`);
    stats.forEach((s, i) => builder.addKeyValue(`${i + 1}. ${s.path}`, `(${s.fileCount} files)`));
    return builder.build();
  }
}

// --- Search Vault ---
const searchVaultParameters = defineToolParameters({
  type: 'object',
  properties: {
    query: { type: 'string', description: 'The text phrase or boolean expression to search for.' },
    regex: { type: 'boolean', description: 'Treat query as regex. Default: false', default: false },
    limit: { type: 'integer', description: 'Max matches to return. Default: 20', default: 20 },
    context_lines: {
      type: 'integer',
      description: 'Lines of context around match. Default: 1',
      default: 1,
    },
  },
  required: ['query'],
} as const);

type SearchVaultArgs = InferArgs<typeof searchVaultParameters>;

export class SearchVaultTool extends Tool<SearchVaultArgs> {
  readonly name = 'search_vault';
  readonly classification = 'Vault';
  readonly description = 'Performs a content search with boolean logic across all markdown notes.';
  readonly parameters = searchVaultParameters;
  isAvailable() {
    return true;
  }
  async execute(args: SearchVaultArgs): Promise<string> {
    const { query, regex = false, limit = 20, context_lines = 1 } = args;
    const app = this.chat.plugin.app;
    void this.status(`Searching vault for "${query}"...`);
    const files = app.vault.getMarkdownFiles();
    const results: { file: string; line: number; context: string }[] = [];
    let count = 0;

    let parsed: ParsedQuery | null = null;
    let isBool = false;
    if (!regex) {
      isBool = BooleanSearchParser.isBooleanQuery(query);
      if (isBool)
        try {
          parsed = BooleanSearchParser.parse(query);
        } catch {
          isBool = false;
        }
    }

    for (const file of files) {
      if (count >= limit) break;
      try {
        const content = await app.vault.cachedRead(file);
        if (regex && !new RegExp(query, 'i').test(content)) continue;
        if (!regex && isBool && parsed && !BooleanSearchParser.evaluate(parsed, content)) continue;
        if (!regex && !isBool && !content.toLowerCase().includes(query.toLowerCase())) continue;

        const lines = content.split('\n');
        let i = 0;
        while (i < lines.length) {
          let match = false;
          if (regex) match = new RegExp(query, 'i').test(lines[i]);
          else if (isBool && parsed) match = BooleanSearchParser.evaluate(parsed, lines[i]);
          else match = lines[i].toLowerCase().includes(query.toLowerCase());

          if (match) {
            const start = Math.max(0, i - context_lines);
            const end = Math.min(lines.length - 1, i + context_lines);
            const snippet = lines
              .slice(start, end + 1)
              .map((l, idx) => `${start + idx === i ? '>' : ' '} ${l}`)
              .join('\n');
            results.push({ file: file.path, line: i + 1, context: snippet });
            count++;
            if (count >= limit) break;
            i = end + 1; // Move past this context block
          } else {
            i++;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (results.length === 0)
      return new ToolOutputBuilder()
        .addHeader(`SEARCH: "${query}"`)
        .addKeyValue('Status', 'No matches')
        .build();
    const builder = new ToolOutputBuilder()
      .addHeader(`SEARCH: "${query}"`)
      .addKeyValue('Found', `${results.length} matches`);
    results.forEach((r, i) =>
      builder.addSection(`[${i + 1}] ${r.file} (Line ${r.line})`, r.context),
    );
    return builder.build();
  }
}

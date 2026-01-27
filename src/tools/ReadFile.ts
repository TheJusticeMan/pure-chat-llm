import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath } from 'obsidian';
import { ToolOutputBuilder } from './ToolOutputBuilder';

const readFileParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The path of the file to read within the vault.',
    },
    offset: {
      type: 'integer',
      description: 'The 0-based line number to start reading from. Requires limit to be set.',
    },
    limit: {
      type: 'integer',
      description: 'The maximum number of lines to read. Defaults to 2000.',
      default: 2000,
    },
  },
  required: ['path'],
} as const);

export type ReadFileArgs = InferArgs<typeof readFileParameters>;

export class ReadFileTool extends Tool<ReadFileArgs> {
  readonly name = 'read_file';
  readonly classification = 'Vault';
  readonly description =
    'Reads the content of a file in the Obsidian vault. Supports line-based pagination.';
  readonly parameters = readFileParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: ReadFileArgs): Promise<string> {
    const { path, offset, limit = 2000 } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);

    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      const parentDir = normalizedPath.split('/').slice(0, -1).join('/');
      const similarGlob = parentDir ? `${parentDir}/*.md` : '*.md';
      const listFolderPath = parentDir || '/';
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists at path "${normalizedPath}"`, [
          `glob_vault_files("${similarGlob}") - Search similar files`,
          `list_vault_folders("${listFolderPath}") - Explore directory`,
          `create_obsidian_note(path="${normalizedPath}", ...) - Create the file`,
        ])
        .build();
    }

    try {
      void this.status(`Reading file "${normalizedPath}"...`);
      const content = await app.vault.cachedRead(file);
      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;

      let start = 0;
      if (typeof offset === 'number') {
        start = Math.max(0, offset);
      }

      const end = start + limit;
      const slicedLines = lines.slice(start, end);
      const result = slicedLines.join('\n');

      // Build enhanced output with metadata
      const builder = new ToolOutputBuilder();
      builder.addHeader('📄', 'FILE READ SUCCESSFUL');
      builder.addKeyValue('Path', normalizedPath);
      builder.addKeyValue('Size', `${file.stat.size.toLocaleString()} bytes (${totalLines} lines)`);

      // Format last modified date
      const lastModified = new Date(file.stat.mtime);
      builder.addKeyValue(
        'Last Modified',
        lastModified.toISOString().replace('T', ' ').split('.')[0],
      );

      // Add metadata info if available
      const cache = app.metadataCache.getFileCache(file);
      if (cache) {
        builder.addSeparator();
        builder.addKeyValue('📊 METADATA', '');

        const frontmatterProps = cache.frontmatter ? Object.keys(cache.frontmatter).length - 1 : 0; // -1 for 'position' key
        if (frontmatterProps > 0) {
          builder.addKeyValue('- Frontmatter properties', `${frontmatterProps} found`);
        }

        if (cache.headings && cache.headings.length > 0) {
          builder.addKeyValue('- Headings', `${cache.headings.length} sections`);
        }

        if (cache.links && cache.links.length > 0) {
          builder.addKeyValue('- Links', `${cache.links.length} internal links`);
        }

        if (cache.tags && cache.tags.length > 0) {
          builder.addKeyValue('- Tags', `${cache.tags.length} tags`);
        }
      }

      // Add truncation information and suggestions if needed
      if (start > 0 || end < totalLines) {
        builder.addSeparator();
        builder.addKeyValue('⚠️  CONTENT TRUNCATED', '');
        builder.addKeyValue(
          'Showing lines',
          `${start + 1}-${Math.min(end, totalLines)} of ${totalLines} total`,
        );
        builder.addSection('Content', result);

        const suggestions = [];
        if (start > 0) {
          suggestions.push(
            `read_file("${normalizedPath}", offset=${Math.max(0, start - limit)}, limit=${limit}) - Read previous section`,
          );
        }
        if (end < totalLines) {
          suggestions.push(
            `read_file("${normalizedPath}", offset=${end}, limit=${limit}) - Read next section`,
          );
        }
        builder.addSuggestions(...suggestions);
      } else {
        builder.addSeparator();
        builder.addSection('Content', result);
      }

      return builder.build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const parentDir = normalizedPath.split('/').slice(0, -1).join('/');
      const similarGlob = parentDir ? `${parentDir}/*.md` : '*.md';
      const listFolderPath = parentDir || '/';
      return new ToolOutputBuilder()
        .addError('FileReadError', `Failed to read file "${normalizedPath}": ${message}`, [
          `read_file("${normalizedPath}", offset=${offset ?? 0}, limit=${limit}) - Retry reading the file`,
          `glob_vault_files("${similarGlob}") - Search similar files in the same folder`,
          `list_vault_folders("${listFolderPath}") - Inspect the containing directory`,
        ])
        .build();
    }
  }
}

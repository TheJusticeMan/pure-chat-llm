import { defineToolParameters, InferArgs, Tool } from '../tools';
import {
  TFile,
  normalizePath,
  parseLinktext,
  resolveSubpath,
  App,
  Modal,
  Setting,
  Notice,
} from 'obsidian';
import { EditReview } from './EditReview';
import { ToolOutputBuilder } from './ToolOutputBuilder';

// --- Read File ---
const readFileParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: { type: 'string', description: 'The path of the file to read within the vault.' },
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
  isAvailable() {
    return true;
  }
  async execute(args: ReadFileArgs): Promise<string> {
    const { path, offset, limit = 2000 } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);
    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      const parentDir = normalizedPath.split('/').slice(0, -1).join('/');
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists at path "${normalizedPath}"`, [
          `glob_vault_files("${parentDir ? `${parentDir}/*.md` : '*.md'}") - Search similar files`,
          `list_vault_folders("${parentDir || '/'}") - Explore directory`,
          `create_obsidian_note(path="${normalizedPath}", ...) - Create the file`,
        ])
        .build();
    }
    try {
      void this.status(`Reading file "${normalizedPath}"...`);
      const content = await app.vault.cachedRead(file);
      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;
      const start = typeof offset === 'number' ? Math.max(0, offset) : 0;
      const end = start + limit;
      const result = lines.slice(start, end).join('\n');
      const builder = new ToolOutputBuilder().addHeader('FILE READ SUCCESSFUL');
      builder
        .addKeyValue('Path', normalizedPath)
        .addKeyValue('Size', `${file.stat.size.toLocaleString()} bytes (${totalLines} lines)`);
      builder.addKeyValue(
        'Last Modified',
        new Date(file.stat.mtime).toISOString().replace('T', ' ').split('.')[0],
      );
      const cache = app.metadataCache.getFileCache(file);
      if (cache) {
        builder.addSeparator().addKeyValue('METADATA', '');
        const fm = cache.frontmatter ? Object.keys(cache.frontmatter).length - 1 : 0;
        if (fm > 0) builder.addKeyValue('- Frontmatter properties', `${fm} found`);
        if (cache.headings?.length)
          builder.addKeyValue('- Headings', `${cache.headings.length} sections`);
        if (cache.links?.length)
          builder.addKeyValue('- Links', `${cache.links.length} internal links`);
        if (cache.tags?.length) builder.addKeyValue('- Tags', `${cache.tags.length} tags`);
      }
      if (start > 0 || end < totalLines) {
        builder
          .addSeparator()
          .addKeyValue('CONTENT TRUNCATED', '')
          .addKeyValue(
            'Showing lines',
            `${start + 1}-${Math.min(end, totalLines)} of ${totalLines} total`,
          );
        builder.addSection('Content', result);
        const suggestions = [];
        if (start > 0)
          suggestions.push(
            `read_file("${normalizedPath}", offset=${Math.max(0, start - limit)}, limit=${limit}) - Read previous`,
          );
        if (end < totalLines)
          suggestions.push(
            `read_file("${normalizedPath}", offset=${end}, limit=${limit}) - Read next`,
          );
        builder.addSuggestions(...suggestions);
      } else {
        builder.addSeparator().addSection('Content', result);
      }
      return builder.build();
    } catch (e) {
      return new ToolOutputBuilder().addError('FileReadError', String(e), []).build();
    }
  }
}

// --- Create Note ---
const createNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description:
        "The full relative path for the note within the vault, including the filename and .md extension (e.g., 'Projects/AI Agent.md').",
    },
    content: {
      type: 'string',
      description: 'The main body content of the note in Markdown format.',
    },
    properties: {
      type: 'object',
      description:
        'An optional object containing key-value pairs to be inserted as YAML frontmatter (Properties).',
      additionalProperties: {
        type: ['string', 'number', 'boolean', 'array'],
        items: { type: 'string' },
      },
    },
    overwrite: {
      type: 'boolean',
      description: 'If true, will overwrite an existing file at the same path. Defaults to false.',
      default: false,
    },
  },
  required: ['path', 'content'],
} as const);

export type CreateNoteArgs = InferArgs<typeof createNoteParameters>;

export class CreateNoteTool extends Tool<CreateNoteArgs> {
  readonly name = 'create_obsidian_note';
  readonly classification = 'Vault';
  readonly description =
    'Creates a new markdown note in the Obsidian vault with optional frontmatter properties. This triggers a user review before saving.';
  readonly parameters = createNoteParameters;
  isAvailable() {
    return true;
  }
  async execute(args: CreateNoteArgs): Promise<string> {
    void this.status(`Requesting user approval to create/update "${args.path}"...`);
    return await EditReview.prompt(
      this.chat.plugin.app,
      args.path,
      args.content,
      args.properties as Record<string, unknown>,
      args.overwrite ?? false,
      'Create/Update Note via Tool',
    );
  }
}

// --- Delete Note ---
const deleteNoteParameters = defineToolParameters({
  type: 'object',
  properties: { path: { type: 'string', description: 'The path of the note or file to delete.' } },
  required: ['path'],
} as const);

export type DeleteNoteArgs = InferArgs<typeof deleteNoteParameters>;

export class DeleteNoteTool extends Tool<DeleteNoteArgs> {
  readonly name = 'delete_obsidian_note';
  readonly classification = 'Vault';
  readonly description =
    'Deletes a note or file from the vault. This triggers a user confirmation modal.';
  readonly parameters = deleteNoteParameters;
  isAvailable() {
    return true;
  }
  async execute(args: DeleteNoteArgs): Promise<string> {
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(args.path);
    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists at path "${normalizedPath}"`, [])
        .build();
    }
    void this.status(`Requesting confirmation to delete "${normalizedPath}"...`);
    return new Promise(resolve => {
      new DeleteConfirmationModal(app, file, result => resolve(result)).open();
    });
  }
}

class DeleteConfirmationModal extends Modal {
  resolved = false;
  constructor(
    app: App,
    public file: TFile,
    public onResolve: (result: string) => void,
  ) {
    super(app);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Confirm deletion' });
    const details = contentEl.createEl('div', { cls: 'delete-details' });
    details.createEl('p', { text: `File: ${this.file.path}` });
    details.createEl('p', { text: `Size: ${this.formatSize(this.file.stat.size)}` });
    details.createEl('p', {
      text: `Last modified: ${new Date(this.file.stat.mtime).toLocaleString()}`,
    });
    contentEl.createEl('p', {
      text: 'Warning: this action cannot be undone. The file will be moved to trash.',
      cls: 'mod-warning',
    });
    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Delete')
          .setWarning()
          .onClick(async () => {
            try {
              await this.app.fileManager.trashFile(this.file);
              new Notice(`Deleted "${this.file.path}".`);
              this.resolved = true;
              this.onResolve(
                new ToolOutputBuilder()
                  .addHeader('FILE DELETED')
                  .addKeyValue('Deleted file', this.file.path)
                  .addKeyValue('Size', this.formatSize(this.file.stat.size))
                  .addSeparator()
                  .addKeyValue('Status', 'Moved to trash')
                  .build(),
              );
              this.close();
            } catch (e) {
              this.resolved = true;
              this.onResolve(
                new ToolOutputBuilder().addError('DeleteError', String(e), []).build(),
              );
              this.close();
            }
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => {
          this.resolved = true;
          this.onResolve('Deletion cancelled by user.');
          this.close();
        }),
      );
  }
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  onClose() {
    if (!this.resolved) this.onResolve('Deletion review cancelled.');
  }
}

// --- Read Note Section ---
const readNoteSectionParameters = defineToolParameters({
  type: 'object',
  properties: {
    link: {
      type: 'string',
      description:
        'Wiki link to read. Supports formats: [[Filename]], [[Filename#Header]], [[Filename#^block-id]]',
    },
    headings_only: {
      type: 'boolean',
      description:
        'If true, returns only the heading structure (outline) instead of content. Default: false',
      default: false,
    },
    depth: {
      type: 'integer',
      description: 'Maximum heading depth to include when headings_only is true (1-6). Default: 6',
      default: 6,
    },
  },
  required: ['link'],
} as const);

export type ReadNoteSectionArgs = InferArgs<typeof readNoteSectionParameters>;

export class ReadNoteSectionTool extends Tool<ReadNoteSectionArgs> {
  readonly name = 'read_note_section';
  readonly classification = 'Vault';
  readonly description =
    'Reads content from an Obsidian note using wiki link format with support for sections, headers, and block references. Can return outline structure with headings_only mode.';
  readonly parameters = readNoteSectionParameters;
  isAvailable() {
    return true;
  }
  async execute(args: ReadNoteSectionArgs): Promise<string> {
    const { link, headings_only = false, depth = 6 } = args;
    const app = this.chat.plugin.app;
    const { path, subpath } = parseLinktext(link.replace(/^\[\[/, '').replace(/\]\]$/, ''));
    const file = app.metadataCache.getFirstLinkpathDest(path, '');
    if (!file || !(file instanceof TFile)) {
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists for link "${link}"`, [])
        .build();
    }
    void this.status(`Reading note section from "${file.path}"...`);
    try {
      const content = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);
      const builder = new ToolOutputBuilder();
      if (headings_only) {
        builder
          .addHeader('NOTE OUTLINE')
          .addKeyValue('Path', file.path)
          .addKeyValue('Size', `${file.stat.size.toLocaleString()} bytes`);
        if (cache?.headings) {
          const filtered = cache.headings.filter(h => h.level <= Math.max(1, Math.min(6, depth)));
          builder
            .addSeparator()
            .addSection(
              'Heading Structure',
              filtered
                .map(h => `${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.heading}`)
                .join('\n'),
            );
        }
        return builder.build();
      }
      builder.addHeader('NOTE SECTION READ SUCCESSFUL').addKeyValue('Path', file.path);
      let contentToReturn = content;
      if (subpath && cache) {
        const ref = resolveSubpath(cache, subpath);
        if (ref) {
          contentToReturn = content.substring(ref.start.offset, ref.end?.offset).trim();
          builder.addKeyValue('Section', subpath);
        } else
          return new ToolOutputBuilder()
            .addError('SectionNotFoundError', `Section "${subpath}" not found`, [])
            .build();
      }
      builder.addSeparator().addSection('Content', contentToReturn);
      return builder.build();
    } catch (e) {
      return new ToolOutputBuilder().addError('ReadError', String(e), []).build();
    }
  }
}

// --- Write Note Section ---
const writeNoteSectionParameters = defineToolParameters({
  type: 'object',
  properties: {
    link: {
      type: 'string',
      description:
        'Wiki link with header specifying where to write. Format: [[Filename#Header]]. Header is required.',
    },
    content: { type: 'string', description: 'The content to write to the section.' },
    mode: {
      type: 'string',
      description: 'Write mode: "append", "prepend", "replace". Default: append',
      default: 'append',
    },
    create_heading: {
      type: 'boolean',
      description: "If true, creates the heading if it doesn't exist. Default: true",
      default: true,
    },
    heading_level: { type: 'integer', description: 'Heading level (1-6). Default: 2', default: 2 },
  },
  required: ['link', 'content'],
} as const);

export type WriteNoteSectionArgs = InferArgs<typeof writeNoteSectionParameters>;

export class WriteNoteSectionTool extends Tool<WriteNoteSectionArgs> {
  readonly name = 'write_note_section';
  readonly classification = 'Vault';
  readonly description =
    'Writes content to a specific section in an Obsidian note using wiki link format. Requires user review.';
  readonly parameters = writeNoteSectionParameters;
  isAvailable() {
    return true;
  }
  async execute(args: WriteNoteSectionArgs): Promise<string> {
    const { link, content, mode = 'append', create_heading = true, heading_level = 2 } = args;
    const app = this.chat.plugin.app;
    const { path, subpath } = parseLinktext(link.replace(/^\[\[/, '').replace(/\]\]$/, ''));
    if (!subpath)
      return new ToolOutputBuilder()
        .addError('MissingHeadingError', 'Heading required', [])
        .build();
    const file = app.metadataCache.getFirstLinkpathDest(path, '');
    if (!file || !(file instanceof TFile))
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `File not found for ${link}`, [])
        .build();
    try {
      const original = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);
      const ref = cache && resolveSubpath(cache, subpath);
      let modified = original;
      if (ref) {
        const start = ref.start.offset;
        const end = ref.end?.offset ?? original.length;
        const section = original.slice(start, end);
        const lines = section.split('\n');
        const headingLine = lines.find(l => l.match(/^#+\s+/)) || '';
        const existing = lines.slice(1).join('\n').trim();
        const final =
          headingLine +
          '\n\n' +
          (mode === 'append'
            ? existing
              ? existing + '\n\n' + content
              : content
            : mode === 'prepend'
              ? existing
                ? content + '\n\n' + existing
                : content
              : content);
        modified = original.slice(0, start) + final + original.slice(end);
      } else if (create_heading) {
        const marker = '#'.repeat(Math.max(1, Math.min(6, heading_level)));
        modified = original + `\n\n${marker} ${subpath}\n\n${content}`;
      } else
        return new ToolOutputBuilder()
          .addError('HeadingNotFoundError', 'Heading not found', [])
          .build();
      return await EditReview.prompt(
        app,
        file.path,
        modified,
        undefined,
        true,
        `Write to section "${subpath}"`,
      );
    } catch (e) {
      return new ToolOutputBuilder().addError('WriteError', String(e), []).build();
    }
  }
}

// --- Patch Note ---
const patchNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: { type: 'string', description: 'The path of the note to patch.' },
    heading: {
      type: 'string',
      description: 'The heading to insert under. If not found, appends to the end.',
    },
    new_content: { type: 'string', description: 'The content to append to the section.' },
  },
  required: ['path', 'new_content'],
} as const);

export type PatchNoteArgs = InferArgs<typeof patchNoteParameters>;

export class PatchNoteTool extends Tool<PatchNoteArgs> {
  readonly name = 'patch_note';
  readonly classification = 'Vault';
  readonly description =
    'Appends text to a specific section or heading in a note. Triggers user review.';
  readonly parameters = patchNoteParameters;
  isAvailable() {
    return true;
  }
  async execute(args: PatchNoteArgs): Promise<string> {
    const { path, heading, new_content } = args;
    const app = this.chat.plugin.app;
    const file = app.vault.getAbstractFileByPath(normalizePath(path));
    if (!file || !(file instanceof TFile))
      return new ToolOutputBuilder().addError('FileNotFoundError', `File not found`, []).build();
    try {
      const content = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);
      let patched = content;
      const target = cache?.headings?.find(h => h.heading.toLowerCase() === heading?.toLowerCase());
      if (target) {
        const next = cache?.headings?.find(
          h => h.position.start.offset > target.position.start.offset && h.level <= target.level,
        );
        const insertAt = next ? next.position.start.offset : content.length;
        patched =
          content.slice(0, insertAt) +
          (content.slice(0, insertAt).endsWith('\n') ? '' : '\n') +
          new_content +
          (content.slice(insertAt).startsWith('\n') ? '' : '\n') +
          content.slice(insertAt);
      } else {
        patched = content.endsWith('\n') ? content + new_content : content + '\n' + new_content;
      }
      return await EditReview.prompt(
        app,
        file.path,
        patched,
        undefined,
        true,
        heading ? `Append to "${heading}"` : 'Append to end',
      );
    } catch (e) {
      return new ToolOutputBuilder().addError('PatchError', String(e), []).build();
    }
  }
}

// --- Replace In Note ---
const replaceInNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: { type: 'string', description: 'The path of the note to modify.' },
    search: { type: 'string', description: 'The text or regex pattern to search for.' },
    replace: { type: 'string', description: 'The text to replace the match with.' },
    regex: {
      type: 'boolean',
      description: 'Use regular expression. Default: false',
      default: false,
    },
    case_sensitive: {
      type: 'boolean',
      description: 'Case sensitive search. Default: false',
      default: false,
    },
  },
  required: ['path', 'search', 'replace'],
} as const);

export type ReplaceInNoteArgs = InferArgs<typeof replaceInNoteParameters>;

export class ReplaceInNoteTool extends Tool<ReplaceInNoteArgs> {
  readonly name = 'replace_in_note';
  readonly classification = 'Vault';
  readonly description =
    'Replaces text within a note using string or regex matching. Triggers user review.';
  readonly parameters = replaceInNoteParameters;
  isAvailable() {
    return true;
  }
  async execute(args: ReplaceInNoteArgs): Promise<string> {
    const { path, search, replace, regex = false, case_sensitive = false } = args;
    const app = this.chat.plugin.app;
    const file = app.vault.getAbstractFileByPath(normalizePath(path));
    if (!file || !(file instanceof TFile))
      return new ToolOutputBuilder().addError('FileNotFoundError', `File not found`, []).build();
    try {
      const content = await app.vault.cachedRead(file);
      let nextContent: string;
      if (regex) {
        nextContent = content.replace(new RegExp(search, case_sensitive ? 'g' : 'gi'), replace);
      } else if (case_sensitive) {
        nextContent = content.split(search).join(replace);
      } else {
        nextContent = content.replace(
          new RegExp(search.replace(/[.*+?^${}()|[\\]/g, '\\$&'), 'gi'),
          replace,
        );
      }
      if (content === nextContent)
        return new ToolOutputBuilder().addHeader('NO MATCHES FOUND').build();
      return await EditReview.prompt(
        app,
        file.path,
        nextContent,
        undefined,
        true,
        `Replace "${search}" with "${replace}"`,
      );
    } catch (e) {
      return new ToolOutputBuilder().addError('ReplaceError', String(e), []).build();
    }
  }
}

// --- Get Backlinks ---
const backlinksParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: { type: 'string', description: 'The path of the note to find backlinks for.' },
  },
  required: ['path'],
} as const);

export type BacklinksArgs = InferArgs<typeof backlinksParameters>;

export class BacklinksTool extends Tool<BacklinksArgs> {
  readonly name = 'get_backlinks';
  readonly classification = 'Vault';
  readonly description = 'Finds all notes that link to a specific note (backlinks).';
  readonly parameters = backlinksParameters;
  isAvailable() {
    return true;
  }
  async execute(args: BacklinksArgs): Promise<string> {
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(args.path);
    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) return `Error: File not found at "${normalizedPath}"`;

    void this.status(`Finding backlinks for "${normalizedPath}"...`);
    const backlinks: Array<{ path: string; count: number }> = [];
    const resolvedLinks = app.metadataCache.resolvedLinks;
    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (links[normalizedPath]) backlinks.push({ path: sourcePath, count: links[normalizedPath] });
    }
    if (backlinks.length === 0)
      return new ToolOutputBuilder()
        .addHeader(`BACKLINKS FOR: "${normalizedPath}"`)
        .addKeyValue('Status', 'No backlinks found')
        .build();
    backlinks.sort((a, b) => b.count - a.count);
    const builder = new ToolOutputBuilder().addHeader(`BACKLINKS FOR: "${normalizedPath}"`);
    backlinks.forEach((b, i) =>
      builder.addKeyValue(`${i + 1}. ${b.path}`, `(${b.count} link${b.count === 1 ? '' : 's'})`),
    );
    return builder.build();
  }
}

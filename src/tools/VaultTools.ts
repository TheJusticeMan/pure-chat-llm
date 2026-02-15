import { normalizePath, parseLinktext, resolveSubpath, TFile } from 'obsidian';
import { defineToolParameters, InferArgs, Tool } from '../tools';
import { EditReview } from './EditReview';
import { ToolOutputBuilder } from './ToolOutputBuilder';

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

type ReadNoteSectionArgs = InferArgs<typeof readNoteSectionParameters>;

/**
 *
 */
export class ReadNoteSectionTool extends Tool<ReadNoteSectionArgs> {
  readonly name = 'read_note_section';
  readonly classification = 'Vault';
  readonly description =
    'Reads content from an Obsidian note using wiki link format with support for sections, headers, and block references. Can return outline structure with headings_only mode.';
  readonly parameters = readNoteSectionParameters;
  /**
   *
   */
  isAvailable() {
    return true;
  }
  /**
   *
   * @param args
   */
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
        'Wiki link specifying where to write. Format: [[Filename]] or [[Filename#Header]].',
    },
    content: { type: 'string', description: 'The content to write.' },
    mode: {
      type: 'string',
      description:
        'Write mode: "append", "prepend", "replace". Default is "replace" for full files, "append" for sections.',
      enum: ['append', 'prepend', 'replace'],
    },
    properties: {
      type: 'object',
      description: 'YAML frontmatter properties (only applied when creating a new note).',
      additionalProperties: {
        type: ['string', 'number', 'boolean', 'array'],
        items: { type: 'string' },
      },
    },
  },
  required: ['link', 'content'],
} as const);

type WriteNoteSectionArgs = InferArgs<typeof writeNoteSectionParameters>;

/**
 *
 */
export class WriteNoteSectionTool extends Tool<WriteNoteSectionArgs> {
  readonly name = 'write_note_section';
  readonly classification = 'Vault';
  readonly description =
    'Writes content to a note or a specific section using WikiLink syntax. Can create new notes or modify existing ones.';
  readonly parameters = writeNoteSectionParameters;
  /**
   *
   */
  isAvailable() {
    return true;
  }
  /**
   *
   * @param args
   */
  async execute(args: WriteNoteSectionArgs): Promise<string> {
    const { link, content, mode, properties } = args;
    const app = this.chat.plugin.app;
    const { path, subpath } = parseLinktext(link.replace(/^\[\[/, '').replace(/\]\]$/, ''));
    const file = app.metadataCache.getFirstLinkpathDest(path, '');

    // Case 1: Create new note
    if (!file || !(file instanceof TFile)) {
      if (subpath) {
        return new ToolOutputBuilder()
          .addError(
            'FileNotFoundError',
            `Cannot write to section "${subpath}" because file "${path}" does not exist.`,
            [`write_note_section(link="[[${path}]]", content="...", ...) - Create the file first`],
          )
          .build();
      }
      void this.status(`Requesting creation of "${path}"...`);
      return await EditReview.prompt(
        app,
        path.endsWith('.md') ? path : `${path}.md`,
        content,
        properties as Record<string, unknown>,
        false, // overwrite
        'Create New Note',
      );
    }

    // Case 2: Modify existing note
    try {
      const original = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);
      let modified = original;
      const effectiveMode = mode || (subpath ? 'append' : 'replace');

      if (subpath) {
        const ref = cache && resolveSubpath(cache, subpath);
        if (!ref) {
          return new ToolOutputBuilder()
            .addError(
              'SectionNotFoundError',
              `Section "${subpath}" not found in "${file.path}"`,
              [],
            )
            .build();
        }
        const start = ref.start.offset;
        const end = ref.end?.offset ?? original.length;
        const section = original.slice(start, end);
        const lines = section.split('\n');
        const headingLine = lines.find(l => l.match(/^#+\s+/)) || '';
        const existingBody = lines.slice(1).join('\n').trim();

        let newBody = content;
        if (effectiveMode === 'append') {
          newBody = existingBody ? `${existingBody}\n\n${content}` : content;
        } else if (effectiveMode === 'prepend') {
          newBody = existingBody ? `${content}\n\n${existingBody}` : content;
        }

        const finalSection = headingLine + '\n\n' + newBody;
        modified = original.slice(0, start) + finalSection + original.slice(end);
      } else {
        // Whole file modification
        if (effectiveMode === 'replace') {
          modified = content;
        } else if (effectiveMode === 'append') {
          modified = original + (original.endsWith('\n') ? '' : '\n') + content;
        } else if (effectiveMode === 'prepend') {
          // preserve frontmatter if possible, simplistic approach here
          modified = content + '\n' + original;
        }
      }

      return await EditReview.prompt(
        app,
        file.path,
        modified,
        undefined, // properties only on creation for now to keep it simple, or user can edit YAML manually
        true, // overwrite
        `Write to "${link}" (${effectiveMode})`,
      );
    } catch (e) {
      return new ToolOutputBuilder().addError('WriteError', String(e), []).build();
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

type BacklinksArgs = InferArgs<typeof backlinksParameters>;

/**
 *
 */
export class BacklinksTool extends Tool<BacklinksArgs> {
  readonly name = 'get_backlinks';
  readonly classification = 'Vault';
  readonly description = 'Finds all notes that link to a specific note (backlinks).';
  readonly parameters = backlinksParameters;
  /**
   *
   */
  isAvailable() {
    return true;
  }
  /**
   *
   * @param args
   */
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

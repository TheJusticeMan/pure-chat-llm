import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, parseLinktext, resolveSubpath } from 'obsidian';
import { ToolOutputBuilder } from './ToolOutputBuilder';

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
  isAvailable(): boolean {
    return true;
  }

  /**
   *
   * @param args
   */
  async execute(args: ReadNoteSectionArgs): Promise<string> {
    const { link, headings_only = false, depth = 6 } = args;
    const app = this.chat.plugin.app;

    // Validate depth parameter
    const validDepth = Math.max(1, Math.min(6, depth));

    // Remove [[ and ]] if present
    const cleanLink = link.replace(/^\[\[/, '').replace(/\]\]$/, '');

    // Parse the link to extract path and subpath
    const { path, subpath } = parseLinktext(cleanLink);

    // Resolve the file
    const file = app.metadataCache.getFirstLinkpathDest(path, '');
    if (!file || !(file instanceof TFile)) {
      const parentDir = path.split('/').slice(0, -1).join('/');
      const similarGlob = parentDir ? `${parentDir}/*.md` : '*.md';
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists for link "${link}"`, [
          `glob_vault_files("${similarGlob}") - Search similar files`,
          `read_file("${path}") - Try reading by direct path`,
          `create_obsidian_note(path="${path}", ...) - Create the file`,
        ])
        .build();
    }

    const normalizedPath = file.path;
    void this.status(`Reading note section from "${normalizedPath}"...`);

    try {
      const content = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);

      // Build output
      const builder = new ToolOutputBuilder();

      // If headings_only mode, return outline structure
      if (headings_only) {
        builder.addHeader('NOTE OUTLINE');
        builder.addKeyValue('Path', normalizedPath);
        builder.addKeyValue('Size', `${file.stat.size.toLocaleString()} bytes`);

        const lastModified = new Date(file.stat.mtime);
        builder.addKeyValue(
          'Last Modified',
          lastModified.toISOString().replace('T', ' ').split('.')[0],
        );

        // Add metadata summary
        if (cache) {
          builder.addSeparator();
          builder.addKeyValue('METADATA', '');

          const frontmatterProps = cache.frontmatter
            ? Object.keys(cache.frontmatter).length - 1
            : 0;
          if (frontmatterProps > 0) {
            builder.addKeyValue('- Frontmatter properties', `${frontmatterProps} found`);
          }

          if (cache.headings && cache.headings.length > 0) {
            const filteredHeadings = cache.headings.filter(h => h.level <= validDepth);
            builder.addKeyValue('- Total headings', `${cache.headings.length}`);
            builder.addKeyValue(
              '- Headings shown',
              `${filteredHeadings.length} (depth 1-${validDepth})`,
            );
          }

          if (cache.links && cache.links.length > 0) {
            builder.addKeyValue('- Links', `${cache.links.length} internal links`);
          }

          if (cache.tags && cache.tags.length > 0) {
            builder.addKeyValue('- Tags', `${cache.tags.length} tags`);
          }
        }

        // Add heading structure
        if (cache?.headings && cache.headings.length > 0) {
          builder.addSeparator();
          const filteredHeadings = cache.headings.filter(h => h.level <= validDepth);

          if (filteredHeadings.length > 0) {
            const outlineLines: string[] = [];
            filteredHeadings.forEach(h => {
              const indent = '  '.repeat(h.level - 1);
              outlineLines.push(`${indent}${'#'.repeat(h.level)} ${h.heading}`);
            });
            builder.addSection('Heading Structure', outlineLines.join('\n'));

            // Add suggestions for reading sections
            const suggestions = filteredHeadings
              .slice(0, 5)
              .map(
                h =>
                  `read_note_section(link="[[${path}#${h.heading}]]") - Read "${h.heading}" section`,
              );
            builder.addSuggestions(...suggestions);
          } else {
            builder.addSection('Heading Structure', 'No headings within specified depth');
          }
        } else {
          builder.addSeparator();
          builder.addKeyValue('Heading Structure', 'No headings found in this note');
        }

        return builder.build();
      }

      // Regular mode: read content (with optional section/block)
      builder.addHeader('NOTE SECTION READ SUCCESSFUL');
      builder.addKeyValue('Path', normalizedPath);

      let contentToReturn = content;

      // If subpath is specified, extract that section
      if (subpath && cache) {
        const ref = resolveSubpath(cache, subpath);
        if (ref) {
          contentToReturn = content.substring(ref.start.offset, ref.end?.offset).trim();
          builder.addKeyValue('Section', subpath);
        } else {
          return new ToolOutputBuilder()
            .addError(
              'SectionNotFoundError',
              `Section "${subpath}" not found in "${normalizedPath}"`,
              [
                `read_note_section(link="[[${path}]]", headings_only=true) - View available sections`,
                `read_file("${normalizedPath}") - Read entire file`,
              ],
            )
            .build();
        }
      } else {
        builder.addKeyValue('Section', 'Full file');
      }

      const lines = contentToReturn.split(/\r?\n/);
      builder.addKeyValue(
        'Size',
        `${contentToReturn.length.toLocaleString()} characters (${lines.length} lines)`,
      );

      // Add metadata info if reading full file
      if (!subpath && cache) {
        builder.addSeparator();
        builder.addKeyValue('METADATA', '');

        const frontmatterProps = cache.frontmatter ? Object.keys(cache.frontmatter).length - 1 : 0;
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

      builder.addSeparator();
      builder.addSection('Content', contentToReturn);

      // Add suggestions
      const suggestions: string[] = [];
      if (!subpath && cache?.headings && cache.headings.length > 0) {
        suggestions.push(
          `read_note_section(link="[[${path}]]", headings_only=true) - View outline structure`,
        );
        const firstHeading = cache.headings[0];
        suggestions.push(
          `read_note_section(link="[[${path}#${firstHeading.heading}]]") - Read first section`,
        );
      }

      if (suggestions.length > 0) {
        builder.addSuggestions(...suggestions);
      }

      return builder.build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new ToolOutputBuilder()
        .addError('ReadError', `Failed to read note section: ${message}`, [
          `read_file("${normalizedPath}") - Try reading entire file`,
          `read_note_section(link="[[${path}]]", headings_only=true) - View outline`,
        ])
        .build();
    }
  }
}

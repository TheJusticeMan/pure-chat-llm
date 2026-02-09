import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath, parseLinktext, resolveSubpath } from 'obsidian';
import { EditReview } from './EditReview';
import { ToolOutputBuilder } from './ToolOutputBuilder';

const writeNoteSectionParameters = defineToolParameters({
  type: 'object',
  properties: {
    link: {
      type: 'string',
      description:
        'Wiki link with header specifying where to write. Format: [[Filename#Header]]. Header is required.',
    },
    content: {
      type: 'string',
      description: 'The content to write to the section.',
    },
    mode: {
      type: 'string',
      description:
        'Write mode: "append" adds content at end of section, "prepend" adds at start, "replace" replaces entire section. Default: append',
      default: 'append',
    },
    create_heading: {
      type: 'boolean',
      description: "If true, creates the heading if it doesn't exist. Default: true",
      default: true,
    },
    heading_level: {
      type: 'integer',
      description: 'Heading level (1-6) for new headings when create_heading is true. Default: 2',
      default: 2,
    },
  },
  required: ['link', 'content'],
} as const);

export type WriteNoteSectionArgs = InferArgs<typeof writeNoteSectionParameters>;

/**
 *
 */
export class WriteNoteSectionTool extends Tool<WriteNoteSectionArgs> {
  readonly name = 'write_note_section';
  readonly classification = 'Vault';
  readonly description =
    'Writes content to a specific section in an Obsidian note using wiki link format. Supports append, prepend, and replace modes. Requires user review before applying changes.';
  readonly parameters = writeNoteSectionParameters;

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
  async execute(args: WriteNoteSectionArgs): Promise<string> {
    const { link, content, mode = 'append', create_heading = true, heading_level = 2 } = args;
    const app = this.chat.plugin.app;

    // Validate mode
    if (!['append', 'prepend', 'replace'].includes(mode)) {
      return new ToolOutputBuilder()
        .addError(
          'InvalidModeError',
          `Invalid mode "${mode}". Must be "append", "prepend", or "replace"`,
          [
            `write_note_section(link="${link}", content="...", mode="append") - Use append mode`,
            `write_note_section(link="${link}", content="...", mode="prepend") - Use prepend mode`,
            `write_note_section(link="${link}", content="...", mode="replace") - Use replace mode`,
          ],
        )
        .build();
    }

    // Validate heading_level
    const validHeadingLevel = Math.max(1, Math.min(6, heading_level));

    // Remove [[ and ]] if present
    const cleanLink = link.replace(/^\[\[/, '').replace(/\]\]$/, '');

    // Parse the link to extract path and subpath (heading)
    const { path, subpath } = parseLinktext(cleanLink);

    // Validate that subpath (heading) is provided
    if (!subpath) {
      return new ToolOutputBuilder()
        .addError(
          'MissingHeadingError',
          'Wiki link must include a heading (e.g., [[File#Header]]). Heading is required for write operations.',
          [
            `read_note_section(link="[[${path}]]", headings_only=true) - View available headings`,
            `write_note_section(link="[[${path}#NewHeading]]", content="...", create_heading=true) - Create a new heading`,
          ],
        )
        .build();
    }

    // Resolve the file
    const file = app.metadataCache.getFirstLinkpathDest(path, '');
    if (!file || !(file instanceof TFile)) {
      const parentDir = path.split('/').slice(0, -1).join('/');
      const similarGlob = parentDir ? `${parentDir}/*.md` : '*.md';
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists for link "${link}"`, [
          `glob_vault_files("${similarGlob}") - Search similar files`,
          `create_obsidian_note(path="${path}", content="# ${subpath}\n\n${content}") - Create the file with heading`,
        ])
        .build();
    }

    const normalizedPath = file.path;
    void this.status(`Preparing write to "${normalizedPath}" section "${subpath}"...`);

    try {
      const originalContent = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);
      let modifiedContent = originalContent;

      // Check if heading exists
      const ref = cache && resolveSubpath(cache, subpath);

      if (ref) {
        // Heading exists, modify the section
        modifiedContent = this.modifyExistingSection(
          originalContent,
          content,
          ref.start.offset,
          ref.end?.offset,
          mode,
        );
      } else {
        // Heading doesn't exist
        if (!create_heading) {
          return new ToolOutputBuilder()
            .addError(
              'HeadingNotFoundError',
              `Heading "${subpath}" not found in "${normalizedPath}" and create_heading is false`,
              [
                `read_note_section(link="[[${path}]]", headings_only=true) - View available headings`,
                `write_note_section(link="${link}", content="...", create_heading=true) - Enable heading creation`,
              ],
            )
            .build();
        }

        // Create the heading at the end of the file
        const headingMarker = '#'.repeat(validHeadingLevel);
        const newSection = `\n\n${headingMarker} ${subpath}\n\n${content}`;
        modifiedContent = originalContent.endsWith('\n')
          ? originalContent + newSection
          : originalContent + '\n' + newSection;
      }

      // Trigger Review Modal
      const instruction = ref
        ? `${mode.charAt(0).toUpperCase() + mode.slice(1)} to section "${subpath}"`
        : `Create heading "${subpath}" and add content`;

      return await EditReview.prompt(
        app,
        normalizedPath,
        modifiedContent,
        undefined, // properties
        true, // overwrite/modify
        instruction,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new ToolOutputBuilder()
        .addError('WriteError', `Failed to write to note section: ${message}`, [
          `read_note_section(link="[[${path}]]") - Check file content and structure`,
          `read_note_section(link="[[${path}]]", headings_only=true) - View available headings`,
        ])
        .build();
    }
  }

  /**
   * Modifies an existing section based on the write mode
   * @param originalContent - The original file content
   * @param newContent - The new content to add
   * @param startOffset - Start offset of the section
   * @param endOffset - End offset of the section (undefined means end of file)
   * @param mode - Write mode (append, prepend, replace)
   */
  private modifyExistingSection(
    originalContent: string,
    newContent: string,
    startOffset: number,
    endOffset: number | undefined,
    mode: string,
  ): string {
    // Extract the section content
    const sectionStart = startOffset;
    const sectionEnd = endOffset ?? originalContent.length;
    const beforeSection = originalContent.slice(0, sectionStart);
    const afterSection = originalContent.slice(sectionEnd);
    const sectionContent = originalContent.slice(sectionStart, sectionEnd);

    // Find the heading line and content
    const lines = sectionContent.split('\n');
    let headingLine = '';
    let contentStartIndex = 0;

    // Find the heading line (first line starting with #)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^#+\s+/)) {
        headingLine = lines[i];
        contentStartIndex = i + 1;
        break;
      }
    }

    const existingContent = lines.slice(contentStartIndex).join('\n').trim();

    let finalSectionContent = '';

    switch (mode) {
      case 'append':
        // Add content at the end of the section
        if (existingContent) {
          finalSectionContent = headingLine + '\n' + existingContent + '\n\n' + newContent;
        } else {
          finalSectionContent = headingLine + '\n\n' + newContent;
        }
        break;

      case 'prepend':
        // Add content at the start of the section (right after heading)
        if (existingContent) {
          finalSectionContent = headingLine + '\n\n' + newContent + '\n\n' + existingContent;
        } else {
          finalSectionContent = headingLine + '\n\n' + newContent;
        }
        break;

      case 'replace':
        // Replace entire section content (keep heading)
        finalSectionContent = headingLine + '\n\n' + newContent;
        break;
    }

    // Ensure proper spacing
    const prefix = beforeSection.endsWith('\n') ? '' : '\n';
    const suffix = afterSection.startsWith('\n') || !afterSection ? '' : '\n';

    return beforeSection + prefix + finalSectionContent + suffix + afterSection;
  }
}

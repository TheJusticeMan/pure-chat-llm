import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath } from 'obsidian';
import { EditReview } from './EditReview';

const patchNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The path of the note to patch.',
    },
    heading: {
      type: 'string',
      description: "The heading to insert under (e.g., 'To-Do'). If not found, appends to the end of the file.",
    },
    new_content: {
      type: 'string',
      description: 'The content to append to the section.',
    },
  },
  required: ['path', 'new_content'],
} as const);

export type PatchNoteArgs = InferArgs<typeof patchNoteParameters>;

export class PatchNoteTool extends Tool<PatchNoteArgs> {
  readonly name = 'patch_note';
  readonly description = 'Appends text to a specific section or heading in a note. Triggers user review.';
  readonly parameters = patchNoteParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: PatchNoteArgs): Promise<string> {
    const { path, heading, new_content } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);

    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      return `Error: File not found at path "${normalizedPath}"`;
    }

    this.status(`Preparing patch for "${normalizedPath}"...`);

    try {
      const content = await app.vault.cachedRead(file);
      const cache = app.metadataCache.getFileCache(file);
      let patchedContent = content;

      if (heading && cache?.headings) {
        const targetHeading = cache.headings.find(
          h => h.heading.toLowerCase() === heading.toLowerCase()
        );

        if (targetHeading) {
          // Find the end of this section
          // The section ends at the next heading with level <= targetHeading.level
          const nextHeading = cache.headings.find(
            h => h.position.start.offset > targetHeading.position.start.offset && h.level <= targetHeading.level
          );

          const insertAt = nextHeading ? nextHeading.position.start.offset : content.length;
          
          // Ensure there's a newline before the new content if needed
          const prefix = content.slice(0, insertAt).endsWith('\n') ? '' : '\n';
          const suffix = content.slice(insertAt).startsWith('\n') || insertAt === content.length ? '' : '\n';
          
          patchedContent = 
            content.slice(0, insertAt) + 
            prefix + 
            new_content + 
            suffix + 
            content.slice(insertAt);
        } else {
          // Heading not found, append to end
          patchedContent = content.endsWith('\n') ? content + new_content : content + '\n' + new_content;
        }
      } else {
        // No heading specified or no headings in file, append to end
        patchedContent = content.endsWith('\n') ? content + new_content : content + '\n' + new_content;
      }

      // Trigger Review Modal
      return await EditReview.prompt(
        app,
        normalizedPath,
        patchedContent,
        undefined, // properties
        true, // overwrite/modify
        heading ? `Append to section "${heading}"` : 'Append to end of note'
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error patching note: ${message}`;
    }
  }
}

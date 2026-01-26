import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath } from 'obsidian';
import { EditReview } from './EditReview';

const replaceInNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The path of the note to modify.',
    },
    search: {
      type: 'string',
      description: 'The text or regex pattern to search for.',
    },
    replace: {
      type: 'string',
      description: 'The text to replace the match with.',
    },
    regex: {
      type: 'boolean',
      description:
        'Whether to treat the search pattern as a regular expression. Defaults to false.',
      default: false,
    },
    case_sensitive: {
      type: 'boolean',
      description: 'Whether the search should be case sensitive. Defaults to false.',
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

  isAvailable(): boolean {
    return true;
  }

  async execute(args: ReplaceInNoteArgs): Promise<string> {
    const { path, search, replace, regex = false, case_sensitive = false } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);

    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      return `Error: File not found at path "${normalizedPath}"`;
    }

    void this.status(`Preparing replacement for "${normalizedPath}"...`);

    try {
      const content = await app.vault.cachedRead(file);
      let newContent: string;

      if (regex) {
        const flags = case_sensitive ? 'g' : 'gi';
        const re = new RegExp(search, flags);
        newContent = content.replace(re, replace);
      } else {
        if (case_sensitive) {
          newContent = content.split(search).join(replace);
        } else {
          // Case-insensitive string replacement using regex (escaped)
          const escapedSearch = search.replace(/[.*+?^${}()|[\\]/g, '\\$&');
          const re = new RegExp(escapedSearch, 'gi');
          newContent = content.replace(re, replace);
        }
      }

      if (content === newContent) {
        return `No matches found for "${search}" in "${normalizedPath}". No changes made.`;
      }

      // Trigger Review Modal
      return await EditReview.prompt(
        app,
        normalizedPath,
        newContent,
        undefined, // properties
        true, // overwrite/modify
        `Replace "${search}" with "${replace}"`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error replacing text in note: ${message}`;
    }
  }
}

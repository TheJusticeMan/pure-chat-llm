import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath } from 'obsidian';
import { EditReview } from './EditReview';
import { ToolOutputBuilder } from './ToolOutputBuilder';

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
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists at path "${normalizedPath}"`, [
          `read_file("${normalizedPath}") - Verify the correct path`,
          `glob_vault_files("${normalizedPath.split('/').slice(0, -1).join('/')}/*.md") - Find similar files`,
          `search_vault("${search}") - Find which files contain the search text`,
        ])
        .build();
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
        return new ToolOutputBuilder()
          .addHeader('ℹ️', 'NO MATCHES FOUND')
          .addKeyValue('File', normalizedPath)
          .addKeyValue('Search term', `"${search}"`)
          .addKeyValue('Status', 'No changes made')
          .addSeparator()
          .addSuggestions(
            `read_file("${normalizedPath}") - Review the file content`,
            `search_vault("${search}") - Find which files contain this text`,
            'Try different search term or use regex: true for pattern matching',
          )
          .build();
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
      return new ToolOutputBuilder()
        .addError('ReplaceError', message, [
          `read_file("${normalizedPath}") - Check file content`,
          'Verify search pattern syntax (especially for regex mode)',
          'Check if replacement string contains valid characters',
        ])
        .build();
    }
  }
}

import { defineToolParameters, InferArgs, Tool } from '../tools';

const searchVaultParameters = defineToolParameters({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'The text or regex pattern to search for within the vault notes.',
    },
    regex: {
      type: 'boolean',
      description:
        'Treat the query as a regular expression. Defaults to false (simple case-insensitive text search).',
      default: false,
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of matching files to return. Defaults to 50.',
      default: 50,
    },
    context_lines: {
      type: 'integer',
      description: 'Number of lines of context to include around the match. Defaults to 1.',
      default: 1,
    },
  },
  required: ['query'],
} as const);

export type SearchVaultArgs = InferArgs<typeof searchVaultParameters>;

export class SearchVaultTool extends Tool<SearchVaultArgs> {
  readonly name = 'search_vault';
  readonly classification = 'Vault';
  readonly description = 'Performs a content search across all markdown notes in the vault.';
  readonly parameters = searchVaultParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: SearchVaultArgs): Promise<string> {
    const { query, regex = false, limit = 20, context_lines = 1 } = args;
    const app = this.chat.plugin.app;

    this.status(`Searching vault for "${query}"...`);

    const files = app.vault.getMarkdownFiles();
    const results: string[] = [];
    let matchCount = 0;

    for (const file of files) {
      if (matchCount >= limit) break;

      try {
        const content = await app.vault.cachedRead(file);

        // Simple search check first to avoid heavy processing
        if (!regex && !content.toLowerCase().includes(query.toLowerCase())) {
          continue;
        }

        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          let lineMatch = false;
          if (regex) {
            if (new RegExp(query, 'i').test(lines[i])) lineMatch = true;
          } else {
            if (lines[i].toLowerCase().includes(query.toLowerCase())) lineMatch = true;
          }

          if (lineMatch) {
            const startLine = Math.max(0, i - context_lines);
            const endLine = Math.min(lines.length - 1, i + context_lines);
            const contextSnippet = lines
              .slice(startLine, endLine + 1)
              .map((l, idx) => {
                const lineNum = startLine + idx + 1;
                const prefix = startLine + idx === i ? '>' : ' ';
                return `${prefix} ${lineNum}: ${l}`;
              })
              .join('\n');

            results.push(`File: ${file.path}\n${contextSnippet}\n`);
            matchCount++;
            if (matchCount >= limit) break;

            // Jump to end of context to avoid overlapping matches
            i = endLine;
          }
        }
      } catch (e) {
        console.error(`Error reading ${file.path}`, e);
      }
    }

    if (results.length === 0) {
      return `No matches found for "${query}".`;
    }

    return results.join('\n---\n');
  }
}

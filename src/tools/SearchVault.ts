import { defineToolParameters, InferArgs, Tool } from '../tools';
import { ToolOutputBuilder } from './ToolOutputBuilder';
import { BooleanSearchParser, ParsedQuery } from '../utils/BooleanSearchParser';

const searchVaultParameters = defineToolParameters({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'The text phrase or boolean expression to search for (supports AND, OR, NOT, parentheses, and quoted phrases). Example: "life story OR escape AND trauma"',
    },
    regex: {
      type: 'boolean',
      description:
        'Treat query as a regular expression. Defaults to false (boolean or simple case-insensitive text search).',
      default: false,
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of matches/snippets to return (not files). Defaults to 20.',
      default: 20,
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
  readonly description =
    'Performs a content search with boolean logic (AND, OR, NOT, parentheses) across all markdown notes in the vault.';
  readonly parameters = searchVaultParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: SearchVaultArgs): Promise<string> {
    const { query, regex = false, limit = 20, context_lines = 1 } = args;
    const app = this.chat.plugin.app;

    void this.status(`Searching vault for "${query}"...`);

    const files = app.vault.getMarkdownFiles();
    const results: Array<{ file: string; lineNum: number; context: string }> = [];
    let matchCount = 0;
    const searchStartTime = Date.now();

    // Parse boolean query if not using regex
    let parsedQuery: ParsedQuery | null = null;
    let isBoolean = false;

    if (!regex) {
      isBoolean = BooleanSearchParser.isBooleanQuery(query);
      if (isBoolean) {
        try {
          parsedQuery = BooleanSearchParser.parse(query);
        } catch (error) {
          // If parsing fails, fall back to simple search
          console.warn(`Boolean query parsing failed: ${error}`);
          isBoolean = false;
        }
      }
    }

    for (const file of files) {
      if (matchCount >= limit) break;

      try {
        const content = await app.vault.cachedRead(file);
        const contentLower = content.toLowerCase();

        // Boolean or simple search check
        let fileMatches = false;
        if (regex) {
          fileMatches = new RegExp(query, 'i').test(content);
        } else if (isBoolean && parsedQuery) {
          fileMatches = BooleanSearchParser.evaluate(parsedQuery, content);
        } else {
          fileMatches = contentLower.includes(query.toLowerCase());
        }

        if (!fileMatches) {
          continue;
        }

        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          let lineMatch = false;
          if (regex) {
            lineMatch = new RegExp(query, 'i').test(lines[i]);
          } else if (isBoolean && parsedQuery) {
            lineMatch = BooleanSearchParser.evaluate(parsedQuery, lines[i]);
          } else {
            lineMatch = lines[i].toLowerCase().includes(query.toLowerCase());
          }

          if (lineMatch) {
            const startLine = Math.max(0, i - context_lines);
            const endLine = Math.min(lines.length - 1, i + context_lines);
            const contextSnippet = lines
              .slice(startLine, endLine + 1)
              .map((l: string, idx: number) => {
                const prefix = startLine + idx === i ? '>' : ' ';
                return `${prefix} ${l}`;
              })
              .join('\n');

            results.push({
              file: file.path,
              lineNum: i + 1,
              context: contextSnippet,
            });
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

    const searchTime = ((Date.now() - searchStartTime) / 1000).toFixed(2);

    if (results.length === 0) {
      return new ToolOutputBuilder()
        .addHeader(`SEARCH RESULTS: "${query}"`)
        .addKeyValue('Status', 'No matches found')
        .addKeyValue('Files searched', files.length.toString())
        .addKeyValue('Time taken', `${searchTime}s`)
        .addSeparator()
        .addSuggestions(
          'Try a different search term or use regex: true for pattern matching',
          'Use glob_vault_files() to explore file structure',
          'Try boolean operators: "term1 OR term2 AND term3"',
        )
        .build();
    }

    // Build structured output
    const builder = new ToolOutputBuilder();
    builder.addHeader(`SEARCH RESULTS: "${query}"`);
    if (isBoolean) {
      builder.addKeyValue('Query Type', 'Boolean (AND/OR/NOT operators)');
    }
    const uniqueFileSet = new Set(results.map(r => r.file));
    builder.addKeyValue(
      'Found',
      `${results.length} match${results.length === 1 ? '' : 'es'} across ${uniqueFileSet.size} file${uniqueFileSet.size === 1 ? '' : 's'}`,
    );
    builder.addKeyValue('Files searched', files.length.toString());
    builder.addKeyValue('Time taken', `${searchTime}s`);
    builder.addSeparator();

    results.forEach((result, idx) => {
      builder.addSection(`[${idx + 1}] ${result.file} (Line ${result.lineNum})`, result.context);
    });

    builder.addSeparator();

    // Add suggestions based on results
    const uniqueFiles = Array.from(new Set(results.map(r => r.file)));
    const suggestions = [];
    if (uniqueFiles.length > 0) {
      suggestions.push(`read_file("${uniqueFiles[0]}") to see full context`);
    }
    if (uniqueFiles.length > 1) {
      suggestions.push(`get_backlinks("${uniqueFiles[0]}") to find related notes`);
    }
    if (results.length === limit) {
      suggestions.push(`Increase limit parameter to see more results (current: ${limit})`);
    }
    if (isBoolean) {
      suggestions.push('Try advanced queries: "(term1 OR term2) AND term3 NOT term4"');
    }

    if (suggestions.length > 0) {
      builder.addSuggestions(...suggestions);
    }

    return builder.build();
  }
}

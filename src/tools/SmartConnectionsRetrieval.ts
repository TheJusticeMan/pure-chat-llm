import { App, parseLinktext } from 'obsidian';
import { defineToolParameters, InferArgs, Tool } from '../tools';

// Define a flexible interface for the Smart Connections item
interface SmartItem {
  data?: {
    lines?: number[];
  };
}

interface SmartResult {
  key: string;
  score: number;
  item: SmartItem;
}

interface LookupOptions {
  hypotheticals: string[];
  filter?: {
    limit?: number;
    [key: string]: unknown;
  };
}

interface SmartCollection {
  lookup(options: LookupOptions | string): Promise<SmartResult[]> | SmartResult[];
}

interface SmartEnv {
  smart_blocks: SmartCollection;
  smart_sources: SmartCollection;
}

interface SmartConnectionsPlugin {
  env: SmartEnv;
  smart_env?: SmartEnv;
}

interface AppWithPlugins extends App {
  plugins: {
    getPlugin(id: string): SmartConnectionsPlugin | undefined;
  };
}

const smartConnectionsParameters = defineToolParameters({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'The search query or concept to find (e.g., "What are my notes on resilience?").',
    },
    limit: {
      type: 'integer',
      description: 'Number of snippets to return. Defaults to 5. Max 20.',
      default: 5,
    },
    type: {
      type: 'string',
      description:
        'Type of retrieval: "blocks" (granular snippets, best for RAG) or "sources" (whole files). Defaults to "blocks".',
      enum: ['blocks', 'sources'],
      default: 'blocks',
    },
  },
  required: ['query'],
} as const);

export type SmartConnectionsArgs = InferArgs<typeof smartConnectionsParameters>;

/**
 *
 */
export class SmartConnectionsRetrievalTool extends Tool<SmartConnectionsArgs> {
  readonly name = 'smart_connections_rag';
  readonly classification = 'AI';
  readonly description =
    'Performs a semantic search across the vault using the Smart Connections index to find relevant note snippets or files.';
  readonly parameters = smartConnectionsParameters;

  /**
   *
   */
  isAvailable(): boolean {
    const app = this.chat.plugin.app as AppWithPlugins;
    const plugin = app.plugins.getPlugin('smart-connections');
    return !!plugin && (!!plugin.env || !!plugin.smart_env);
  }

  /**
   *
   * @param args
   */
  async execute(args: SmartConnectionsArgs): Promise<string> {
    const { query, limit = 5, type = 'blocks' } = args;
    const app = this.chat.plugin.app as AppWithPlugins;
    const plugin = app.plugins.getPlugin('smart-connections');

    if (!plugin) {
      return 'Error: Smart Connections plugin is not loaded.';
    }

    const env = plugin.env || plugin.smart_env;
    if (!env) {
      return 'Error: Smart Environment is not ready in Smart Connections.';
    }

    const collection = type === 'sources' ? env.smart_sources : env.smart_blocks;

    if (!collection) {
      return `Error: Smart Connections ${type} collection is not available.`;
    }

    void this.status(`Searching Smart Connections (${type}) for "${query}"...`);

    try {
      // Execute lookup with verified API structure
      const rawResults = await collection.lookup({
        hypotheticals: [query],
        filter: { limit: limit },
      });

      const results = Array.isArray(rawResults) ? rawResults : [];

      if (results.length === 0) {
        return `No relevant ${type} found for query: "${query}"`;
      }

      // Format results by traversing the SmartBlock/SmartSource object hierarchy
      const formattedResults = await Promise.all(
        results.map(async (result, index) => {
          const item = result.item;
          let content = '';

          try {
            // Attempt to extract content based on available data
            if (item.data?.lines) {
              const lines = item.data?.lines;

              // Try to get file from item, or resolve from path/key
              const file = app.vault.getFileByPath(parseLinktext(result.key).path);

              if (file && Array.isArray(lines) && lines.length > 0) {
                const fileLines = (await app.vault.cachedRead(file)).split('\n');

                if (lines.length === 2 && lines[1] > lines[0] + 1) {
                  // Likely [start, end]
                  const start = Math.max(0, lines[0] - 1);
                  const end = Math.min(fileLines.length, lines[1]);
                  if (start < end) {
                    content = fileLines.slice(start, end).join('\n');
                  }
                } else {
                  // Likely an array of individual line numbers
                  content = lines.map(lineNum => fileLines[lineNum - 1] || '').join('\n');
                }
              }
            }
          } catch (e) {
            console.warn(`Failed to extract content for ${result.key}:`, e);
          }

          const scorePct = Math.round((result.score || 0) * 100);
          const displayContent = content.trim() || '[Content could not be retrieved]';

          return `[Result ${index + 1}] (Similarity: ${scorePct}%)\nLocation: ${result.key}\nContent:\n${displayContent}\n`;
        }),
      );

      return `Found ${results.length} relevant ${type}:\n\n${formattedResults.join('\n---\n')}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error executing Smart Connections search: ${message}`;
    }
  }
}

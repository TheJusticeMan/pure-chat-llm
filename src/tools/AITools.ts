import { parseLinktext, requestUrl } from 'obsidian';
import { defineToolParameters, InferArgs, Tool } from '../tools';
import imgModels from './ImageGen.json';

// --- Image Generation ---
const imgModelsJson = imgModels as {
  [key: string]: { [key: string]: { landscape: string[]; portrait: string[]; square: string[] } };
};
const defaultModels: Record<string, string> = {
  OpenAI: 'gpt-image-1.5',
  xAI: 'grok-2-image',
  Gemini: 'imagen-3.0-generate-002',
};

const imageGenerationParameters = defineToolParameters({
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'A detailed description of the image to generate.' },
    ratio: {
      type: 'string',
      description: "Aspect ratio: 'landscape', 'portrait', 'square'. Default: 'square'",
      enum: ['square', 'portrait', 'landscape'],
    },
    n: { type: 'integer', description: 'Number of images to generate.' },
  },
  required: ['prompt'],
} as const);

type ImageGenerationArgs = InferArgs<typeof imageGenerationParameters>;

/**
 *
 */
export class ImageGenerationTool extends Tool<ImageGenerationArgs> {
  readonly name = 'generate_image';
  readonly classification = 'AI';
  static _name = 'generate_image';
  readonly description = 'Create high-quality, customized images from detailed Markdown prompts.';
  readonly parameters = imageGenerationParameters;

  /**
   *
   */
  isAvailable() {
    const { name } = this.chat.plugin.settings.endpoints[this.chat.plugin.settings.endpoint];
    return name === 'OpenAI' || name === 'xAI';
  }

  /**
   *
   * @param args
   */
  async execute(args: ImageGenerationArgs): Promise<string> {
    const { prompt, ratio = 'square', n = 1 } = args;
    if (prompt.length > 4000) return 'Error: prompt exceeds 4,000 character limit.';
    void this.status(`Generating ${n} image(s) for prompt: "${prompt}"...`);
    try {
      const safeRatio: 'square' | 'portrait' | 'landscape' = [
        'square',
        'portrait',
        'landscape',
      ].includes(ratio)
        ? (ratio as 'square' | 'portrait' | 'landscape')
        : 'square';
      const results = await this.sendRequest({
        prompt,
        ratio: safeRatio,
        n: n ?? 1,
      });
      const fm = this.chat.plugin.app.fileManager;
      let content = '';
      results.forEach(img => {
        content += `!${fm.generateMarkdownLink(img.file, this.chat.file.path)}\n`;
        if (img.revised_prompt) content += `Revised prompt: ${img.revised_prompt}\n`;
      });
      return content;
    } catch (e) {
      return `Error generating image: ${String(e)}`;
    }
  }

  /**
   *
   * @param root0
   * @param root0.prompt
   * @param root0.ratio
   * @param root0.n
   */
  private async sendRequest({
    prompt,
    ratio = 'square',
    n = 1,
  }: {
    prompt: string;
    ratio?: 'square' | 'portrait' | 'landscape';
    n?: number;
  }) {
    const endpoint = this.chat.endpoint;
    const url = `${endpoint.endpoint}/images/generations`;
    const model = defaultModels[endpoint.name] || Object.keys(imgModelsJson[endpoint.name])[0];
    if (!model) throw new Error(`No image model for ${endpoint.name}`);
    const size = imgModelsJson[endpoint.name]?.[model]?.[ratio]?.[0] || 'auto';
    const body: Record<string, unknown> = { model, prompt, n, size };
    if (endpoint.name === 'xAI' || endpoint.name === 'Gemini') delete body.size;

    const res = await requestUrl({
      url,
      method: 'POST',
      headers: { Authorization: `Bearer ${endpoint.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status !== 200) throw new Error(`Request failed: ${res.status}`);
    const data = res.json as {
      created: number;
      data: { url: string; revised_prompt?: string }[];
    };
    const saved = [];
    for (let i = 0; i < data.data.length; i++) {
      const item = data.data[i];
      const filename = `generated-image-${Date.now()}-${i}.png`;
      const path = await this.chat.plugin.app.fileManager.getAvailablePathForAttachment(
        filename,
        this.chat.file.path,
      );
      const imgResp = await requestUrl(item.url);
      if (!imgResp) throw new Error(`Failed to fetch image: ${item.url}`);
      const file = await this.chat.plugin.app.vault.createBinary(path, imgResp.arrayBuffer);
      saved.push({ normalizedPath: path, revised_prompt: item.revised_prompt, file });
    }
    return saved;
  }
}

// --- Smart Connections ---
interface SmartResult {
  key: string;
  score: number;
  item: { data?: { lines?: number[] } };
}
interface SmartCollection {
  lookup(options: unknown): Promise<SmartResult[]> | SmartResult[];
}
interface SmartPlugin {
  env?: { smart_blocks: SmartCollection; smart_sources: SmartCollection };
  smart_env?: { smart_blocks: SmartCollection; smart_sources: SmartCollection };
}
// Extend Obsidian App interface
declare module 'obsidian' {
  interface App {
    plugins: {
      getPlugin(id: string): unknown;
    };
  }
}

const smartConnParameters = defineToolParameters({
  type: 'object',
  properties: {
    query: { type: 'string', description: 'The search query or concept.' },
    limit: { type: 'integer', description: 'Number of snippets. Default: 5', default: 5 },
    type: {
      type: 'string',
      description: 'Retrieval type: "blocks" or "sources". Default: "blocks"',
      enum: ['blocks', 'sources'],
      default: 'blocks',
    },
  },
  required: ['query'],
} as const);

type SmartConnectionsArgs = InferArgs<typeof smartConnParameters>;

/**
 *
 */
export class SmartConnectionsRetrievalTool extends Tool<SmartConnectionsArgs> {
  readonly name = 'smart_connections_rag';
  readonly classification = 'AI';
  readonly description = 'Performs a semantic search across the vault using Smart Connections.';
  readonly parameters = smartConnParameters;

  /**
   *
   */
  isAvailable() {
    const plugin = this.chat.plugin.app.plugins.getPlugin(
      'smart-connections',
    ) as SmartPlugin | null;
    return !!plugin && (!!plugin.env || !!plugin.smart_env);
  }

  /**
   *
   * @param args
   */
  async execute(args: SmartConnectionsArgs): Promise<string> {
    const { query, limit = 5, type = 'blocks' } = args;
    const plugin = this.chat.plugin.app.plugins.getPlugin(
      'smart-connections',
    ) as SmartPlugin | null;
    if (!plugin) return 'Error: Smart Connections plugin not loaded.';
    const env = plugin.env || plugin.smart_env;
    if (!env) return 'Error: Smart Environment not ready.';
    const collection = type === 'sources' ? env.smart_sources : env.smart_blocks;
    if (!collection) return `Error: ${type} collection not available.`;

    void this.status(`Searching Smart Connections (${type}) for "${query}"...`);
    try {
      const raw = await collection.lookup({ hypotheticals: [query], filter: { limit } });
      const results = Array.isArray(raw) ? raw : [];
      if (results.length === 0) return `No relevant ${type} found for "${query}"`;

      const formatted = await Promise.all(
        results.map(async (r, i) => {
          let content = '';
          try {
            if (r.item.data?.lines) {
              const lines = r.item.data.lines;
              const file = this.chat.plugin.app.vault.getFileByPath(parseLinktext(r.key).path);
              if (file && lines.length > 0) {
                const fileLines = (await this.chat.plugin.app.vault.cachedRead(file)).split('\n');
                if (lines.length === 2 && lines[1] > lines[0] + 1) {
                  const start = Math.max(0, lines[0] - 1);
                  const end = Math.min(fileLines.length, lines[1]);
                  if (start < end) content = fileLines.slice(start, end).join('\n');
                } else {
                  content = lines.map(l => fileLines[l - 1] || '').join('\n');
                }
              }
            }
          } catch (e) {
            console.warn(`Failed to extract content for ${r.key}`, e);
          }
          const score = Math.round((r.score || 0) * 100);
          return `[Result ${i + 1}] (Similarity: ${score}%)\nLocation: ${r.key}\nContent:\n${content.trim() || '[Content could not be retrieved]'}\n`;
        }),
      );
      return `Found ${results.length} relevant ${type}:\n\n${formatted.join('\n---\n')}`;
    } catch (e) {
      return `Error executing Smart Connections search: ${String(e)}`;
    }
  }
}

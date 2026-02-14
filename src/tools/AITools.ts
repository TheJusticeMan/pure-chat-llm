import { defineToolParameters, InferArgs, Tool } from '../tools';
import { requestUrl, App, Modal, Setting, parseLinktext } from 'obsidian';
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

export type ImageGenerationArgs = InferArgs<typeof imageGenerationParameters>;

export class ImageGenerationTool extends Tool<ImageGenerationArgs> {
  readonly name = 'generate_image';
  readonly classification = 'AI';
  static _name = 'generate_image';
  readonly description = 'Create high-quality, customized images from detailed Markdown prompts.';
  readonly parameters = imageGenerationParameters;

  isAvailable() {
    const { name } = this.chat.plugin.settings.endpoints[this.chat.plugin.settings.endpoint];
    return name === 'OpenAI' || name === 'xAI';
  }

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

export type SmartConnectionsArgs = InferArgs<typeof smartConnParameters>;

export class SmartConnectionsRetrievalTool extends Tool<SmartConnectionsArgs> {
  readonly name = 'smart_connections_rag';
  readonly classification = 'AI';
  readonly description = 'Performs a semantic search across the vault using Smart Connections.';
  readonly parameters = smartConnParameters;

  isAvailable() {
    const plugin = this.chat.plugin.app.plugins.getPlugin(
      'smart-connections',
    ) as SmartPlugin | null;
    return !!plugin && (!!plugin.env || !!plugin.smart_env);
  }

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

// --- Suno Music ---
const sunoParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description:
        'Action: "generate_music", "generate_lyrics", "check_status", "extend_music", "separate_vocals", "create_music_video", "get_credits".',
      enum: [
        'generate_music',
        'generate_lyrics',
        'check_status',
        'extend_music',
        'separate_vocals',
        'create_music_video',
        'get_credits',
      ],
    },
    prompt: { type: 'string', description: 'Text prompt.' },
    model: {
      type: 'string',
      description: 'Model: "V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5". Default: "V5"',
      enum: ['V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'],
      default: 'V5',
    },
    customMode: { type: 'boolean', description: 'Enable custom mode.', default: false },
    instrumental: { type: 'boolean', description: 'Instrumental track.', default: false },
    style: { type: 'string', description: 'Musical style/genre.' },
    title: { type: 'string', description: 'Song title.' },
    taskId: { type: 'string', description: 'Task ID.' },
    audioId: { type: 'string', description: 'Audio ID.' },
    continueAt: { type: 'number', description: 'Timestamp to continue at.' },
    author: { type: 'string', description: 'Author name.' },
    domainName: { type: 'string', description: 'Domain/brand name.' },
  },
  required: ['action'],
} as const);

export type SunoArgs = InferArgs<typeof sunoParameters>;

interface SunoResponse {
  code: number;
  msg: string;
  data: {
    credits?: number;
    taskId?: string;
    status?: string;
    response?: {
      data?: Array<{
        title?: string;
        duration?: number;
        audio_url?: string;
        text?: string;
      }>;
    };
    data?: Array<{
      title?: string;
      duration?: number;
      audio_url?: string;
      text?: string;
    }>;
    vocal_removal_info?: {
      instrumental_url: string;
      vocal_url: string;
    };
  };
}

export class SunoTool extends Tool<SunoArgs> {
  readonly name = 'suno_music_gen';
  readonly classification = 'AI';
  readonly description = 'Versatile tool for AI music creation using Suno API.';
  readonly parameters = sunoParameters;

  private get apiKey() {
    return this.chat.plugin.settings.endpoints.find(e => e.name === 'Suno')?.apiKey;
  }
  isAvailable() {
    const k = this.apiKey;
    return !!k && k !== 'EMPTY' && k !== '';
  }

  async execute(args: SunoArgs): Promise<string> {
    if (!this.apiKey) return 'Error: Suno API key not configured.';
    const validation = this.validateArgs(args);
    if (validation) return `Validation Error: ${validation}`;

    const cost = this.calculateCost(args.action);
    const details = JSON.stringify({ ...args, action: undefined }, null, 2);
    const confirmed = await new Promise<boolean>(resolve =>
      new SunoConfirmationModal(this.chat.plugin.app, args.action, cost, details, resolve).open(),
    );
    if (!confirmed) return 'Action cancelled.';

    return await this.sendRequest(args, this.apiKey);
  }

  private validateArgs(args: SunoArgs): string | null {
    const { action, prompt, customMode, style, title, taskId, audioId, continueAt } = args;
    if (action === 'generate_music') {
      if (!prompt) return '"prompt" required';
      if (customMode && (!style || !title)) return '"style" and "title" required in custom mode';
    }
    if (action === 'generate_lyrics' && !prompt) return '"prompt" required';
    if (['check_status', 'separate_vocals', 'create_music_video'].includes(action) && !taskId)
      return '"taskId" required';
    if (['extend_music', 'separate_vocals', 'create_music_video'].includes(action) && !audioId)
      return '"audioId" required';
    if (action === 'extend_music' && (!prompt || typeof continueAt !== 'number'))
      return '"prompt" and "continueAt" required';
    return null;
  }

  private calculateCost(action: string): number {
    if (['generate_music', 'extend_music'].includes(action)) return 12;
    if (action === 'separate_vocals') return 10;
    if (action === 'create_music_video') return 2;
    if (action === 'generate_lyrics') return 0.4;
    return 0;
  }

  private async sendRequest(args: SunoArgs, apiKey: string): Promise<string> {
    const baseUrl = 'https://api.sunoapi.org/api/v1';
    const {
      action,
      prompt,
      model,
      customMode,
      instrumental,
      style,
      title,
      taskId,
      audioId,
      continueAt,
      author,
      domainName,
    } = args;

    try {
      if (action === 'get_credits') {
        const res = await requestUrl({
          url: `${baseUrl}/get-credits`,
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const json = res.json as SunoResponse;
        return json.code === 200 ? `Credits: ${json.data.credits}` : `Error: ${json.msg}`;
      }

      let url = '',
        body: unknown = {};
      if (action === 'create_music_video') {
        url = `${baseUrl}/generate/video`;
        body = { taskId, audioId, author, domainName };
      } else if (action === 'generate_music') {
        url = `${baseUrl}/generate`;
        body = {
          prompt,
          model,
          customMode,
          instrumental,
          style,
          title,
          callBackUrl: 'https://api.example.com/callback',
        };
      } else if (action === 'generate_lyrics') {
        url = `${baseUrl}/lyrics`;
        body = { prompt };
      } else if (action === 'extend_music') {
        url = `${baseUrl}/generate/extend`;
        body = { audioId, prompt, continueAt, model };
      } else if (action === 'separate_vocals') {
        url = `${baseUrl}/vocal-removal/generate`;
        body = { taskId, audioId };
      } else if (action === 'check_status') {
        const res = await requestUrl({
          url: `${baseUrl}/generate/record-info?taskId=${taskId}`,
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const json = res.json as SunoResponse;
        if (json.code !== 200) return `Error: ${json.msg}`;
        const status = json.data.status;
        if (status === 'SUCCESS') {
          const d = json.data.response || json.data;
          if (d.data) {
            return (
              `Task successful!\n` +
              d.data
                .map(
                  t => `Track ${t.title || 'Untitled'} (${t.duration}s) - ${t.audio_url || t.text}`,
                )
                .join('\n')
            );
          }
          if (json.data.vocal_removal_info) {
            return `Vocals separated:\nInst: ${json.data.vocal_removal_info.instrumental_url}\nVoc: ${json.data.vocal_removal_info.vocal_url}`;
          }
          return `Success: ${JSON.stringify(d)}`;
        }
        return `Status: ${status}`;
      }

      if (url) {
        void this.status(`Executing ${action}...`);
        const res = await requestUrl({
          url,
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = res.json as SunoResponse;
        return json.code === 200
          ? `Task started. Task ID: ${json.data.taskId}`
          : `Error: ${json.msg}`;
      }
    } catch (e) {
      return `Error: ${String(e)}`;
    }
    return 'Invalid action';
  }
}

class SunoConfirmationModal extends Modal {
  constructor(
    app: App,
    public action: string,
    public cost: number,
    public details: string,
    public onResolve: (c: boolean) => void,
  ) {
    super(app);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    // eslint-disable-next-line obsidianmd/ui/sentence-case
    this.setTitle('Confirm Suno API action');
    new Setting(contentEl)
      .setHeading()
      .setName(`Action: ${this.action}`)
      .setDesc(`Cost: ${this.cost} credits (~$${(this.cost * 0.005).toFixed(4)})`);
    new Setting(contentEl).setName('Parameters').setDesc(this.details).setHeading();
    new Setting(contentEl)
      .addButton(b =>
        b
          .setButtonText('Confirm')
          .setCta()
          .onClick(() => {
            this.onResolve(true);
            this.close();
          }),
      )
      .addButton(b =>
        b.setButtonText('Cancel').onClick(() => {
          this.onResolve(false);
          this.close();
        }),
      );
  }
  onClose() {
    /* handled by onResolve calls */
  }
}

import { requestUrl, Modal, App, Setting } from 'obsidian';
import { defineToolParameters, InferArgs, Tool } from '../tools';

const sunoParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description:
        'The specific Suno API action to perform. Options:\n' +
        '- "generate_music": Create new music (requires `prompt`).\n' +
        '- "generate_lyrics": Generate song lyrics (requires `prompt`).\n' +
        '- "check_status": Check the result of a task (requires `taskId`).\n' +
        '- "extend_music": Extend an existing track (requires `audioId`, `prompt`, `continueAt`).\n' +
        '- "separate_vocals": Split a track into vocals and instrumental (requires `taskId`, `audioId`).\n' +
        '- "create_music_video": Generate a video for a track (requires `taskId`, `audioId`).\n' +
        '- "get_credits": Check remaining API credits.',
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
    prompt: {
      type: 'string',
      description:
        'The text prompt. Required for "generate_music" (song description), "generate_lyrics" (topic/style), and "extend_music" (extension description).',
    },
    model: {
      type: 'string',
      description:
        'The AI model to use. Defaults to "V5". Options: "V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5".',
      enum: ['V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5'],
      default: 'V5',
    },
    customMode: {
      type: 'boolean',
      description:
        'Enable custom mode for "generate_music". If true, `style` and `title` are required, and `prompt` becomes the lyrics.',
      default: false,
    },
    instrumental: {
      type: 'boolean',
      description:
        'If true, generates an instrumental track (no vocals). Used in "generate_music".',
      default: false,
    },
    style: {
      type: 'string',
      description: 'The musical style/genre. Required if `customMode` is true.',
    },
    title: {
      type: 'string',
      description: 'The title of the song. Required if `customMode` is true.',
    },
    taskId: {
      type: 'string',
      description:
        'The unique ID of a task. Required for "check_status", "separate_vocals", and "create_music_video". returned by generation actions.',
    },
    audioId: {
      type: 'string',
      description:
        'The unique ID of an audio track. Required for "extend_music", "separate_vocals", and "create_music_video". Returned in the "check_status" result.',
    },
    continueAt: {
      type: 'number',
      description:
        'The timestamp (in seconds) where the music extension should start. Required for "extend_music".',
    },
    author: {
      type: 'string',
      description: 'The author name to display. Optional for "create_music_video".',
    },
    domainName: {
      type: 'string',
      description: 'The domain/brand name to display. Optional for "create_music_video".',
    },
  },
  required: ['action'],
} as const);

export type SunoArgs = InferArgs<typeof sunoParameters>;

interface SunoApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

interface SunoTaskResult {
  taskId: string;
}

interface SunoTrack {
  id: string;
  audio_url?: string;
  title?: string;
  duration?: number;
  text?: string;
}

interface SunoStatusData {
  status: string;
  response?: {
    data: SunoTrack[];
  };
  vocal_removal_info?: {
    instrumental_url: string;
    vocal_url: string;
  };
}

interface SunoCreditsData {
  credits: number;
}

/**
 *
 */
export class SunoTool extends Tool<SunoArgs> {
  readonly name = 'suno_music_gen';
  readonly classification = 'AI';
  readonly description =
    'A versatile tool for AI music creation using the Suno API. It can generate songs, lyrics, music videos, and perform audio manipulation like stem separation and track extension. Use this tool to turn text descriptions into complete musical compositions.';
  readonly parameters = sunoParameters;

  /**
   *
   */
  private get apiKey(): string | undefined {
    const sunoEndpoint = this.chat.plugin.settings.endpoints.find(e => e.name === 'Suno');
    return sunoEndpoint?.apiKey;
  }

  /**
   *
   */
  isAvailable(): boolean {
    const key = this.apiKey;
    return !!key && key !== 'EMPTY' && key !== '';
  }

  /**
   *
   * @param args
   */
  async execute(args: SunoArgs): Promise<string> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      return 'Error: Suno API key not configured. Please add an endpoint named "Suno" with your API key in the plugin settings.';
    }

    // 1. Validation before confirmation
    const validationError = this.validateArgs(args);
    if (validationError) return `Validation Error: ${validationError}`;

    // 2. Cost calculation
    const cost = this.calculateCost(args.action);

    // 3. Confirmation modal
    const detailsObj: Record<string, unknown> = { ...args };
    delete detailsObj.action;
    Object.keys(detailsObj).forEach(key => detailsObj[key] === undefined && delete detailsObj[key]);
    const details = JSON.stringify(detailsObj, null, 2);

    const confirmed = await new Promise<boolean>(resolve => {
      new SunoConfirmationModal(this.chat.plugin.app, args.action, cost, details, resolve).open();
    });

    if (!confirmed) {
      return 'Action cancelled by user.';
    }

    // 4. Send request
    return await this.sendRequest(args, apiKey);
  }

  /**
   *
   * @param args
   */
  private validateArgs(args: SunoArgs): string | null {
    const { action, prompt, customMode, style, title, taskId, audioId, continueAt } = args;

    switch (action) {
      case 'generate_music':
        if (!prompt) return '"prompt" is required.';
        if (customMode) {
          if (!style) return '"style" is required in custom mode.';
          if (!title) return '"title" is required in custom mode.';
        }
        break;
      case 'generate_lyrics':
        if (!prompt) return '"prompt" is required.';
        break;
      case 'check_status':
        if (!taskId) return '"taskId" is required.';
        break;
      case 'extend_music':
        if (!audioId) return '"audioId" is required.';
        if (!prompt) return '"prompt" is required.';
        if (typeof continueAt !== 'number') return '"continueAt" is required as a number.';
        break;
      case 'separate_vocals':
      case 'create_music_video':
        if (!audioId) return '"audioId" is required.';
        if (!taskId) return '"taskId" is required.';
        break;
    }
    return null;
  }

  /**
   *
   * @param action
   */
  private calculateCost(action: string): number {
    switch (action) {
      case 'generate_music':
      case 'extend_music':
        return 12;
      case 'separate_vocals':
        return 10;
      case 'create_music_video':
        return 2;
      case 'generate_lyrics':
        return 0.4;
      default:
        return 0;
    }
  }

  /**
   *
   * @param args
   * @param apiKey
   */
  private async sendRequest(args: SunoArgs, apiKey: string): Promise<string> {
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
    const baseUrl = 'https://api.sunoapi.org/api/v1';

    try {
      if (action === 'get_credits') {
        const response = await requestUrl({
          url: `${baseUrl}/get-credits`,
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const result = response.json as SunoApiResponse<SunoCreditsData>;
        if (result.code !== 200) return `Error: ${result.msg}`;
        return `Remaining credits: ${result.data.credits}`;
      }

      if (action === 'create_music_video') {
        void this.status(`Creating music video...`);
        const response = await requestUrl({
          url: `${baseUrl}/generate/video`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            audioId,
            author,
            domainName,
          }),
        });
        const result = response.json as SunoApiResponse<SunoTaskResult>;
        if (result.code !== 200) return `Error: ${result.msg}`;
        return `Music video generation task started. Task ID: ${result.data.taskId}`;
      }

      if (action === 'generate_music') {
        void this.status(`Generating music with Suno...`);
        const response = await requestUrl({
          url: `${baseUrl}/generate`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            model,
            customMode,
            instrumental,
            style,
            title,
            callBackUrl: 'https://api.example.com/callback',
          }),
        });
        const result = response.json as SunoApiResponse<SunoTaskResult>;
        if (result.code !== 200) return `Error: ${result.msg}`;
        return `Music generation task started. Task ID: ${result.data.taskId}\nUse "check_status" with this taskId to see results. Generation usually takes 1-2 minutes.`;
      }

      if (action === 'generate_lyrics') {
        void this.status(`Generating lyrics with Suno...`);
        const response = await requestUrl({
          url: `${baseUrl}/lyrics`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });
        const result = response.json as SunoApiResponse<SunoTaskResult>;
        if (result.code !== 200) return `Error: ${result.msg}`;
        return `Lyrics generation task started. Task ID: ${result.data.taskId}\nUse "check_status" with this taskId to see results.`;
      }

      if (action === 'check_status') {
        void this.status(`Checking status for task ${taskId}...`);
        const response = await requestUrl({
          url: `${baseUrl}/generate/record-info?taskId=${taskId}`,
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const result = response.json as SunoApiResponse<SunoStatusData>;
        if (result.code !== 200) return `Error: ${result.msg}`;

        const status = result.data.status;
        if (status === 'SUCCESS') {
          const respData = result.data.response;
          if (respData && Array.isArray(respData.data)) {
            let output = 'Task successful!\n\n';
            respData.data.forEach((item, i) => {
              if (item.audio_url) {
                output += `Track ${i + 1}:\n`;
                output += `- Title: ${item.title || 'Untitled'}\n`;
                output += `- URL: ${item.audio_url}\n`;
                output += `- Duration: ${item.duration || 0}s\n`;
                output += `- ID: ${item.id}\n\n`;
              } else if (item.text) {
                output += `Lyrics/Text ${i + 1}:\n${item.text}\n\n`;
              }
            });
            return output.trim();
          } else if (result.data.vocal_removal_info) {
            const v = result.data.vocal_removal_info;
            return `Vocal separation successful!\n- Instrumental: ${v.instrumental_url}\n- Vocals: ${v.vocal_url}`;
          }
          return `Task successful. Result: ${JSON.stringify(result.data.response || result.data)}`;
        }
        return `Task status: ${status}. Please check again in a few moments if it's still processing.`;
      }

      if (action === 'extend_music') {
        void this.status(`Extending music...`);
        const response = await requestUrl({
          url: `${baseUrl}/generate/extend`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioId,
            prompt,
            continueAt,
            model,
          }),
        });
        const result = response.json as SunoApiResponse<SunoTaskResult>;
        if (result.code !== 200) return `Error: ${result.msg}`;
        return `Music extension task started. Task ID: ${result.data.taskId}`;
      }

      if (action === 'separate_vocals') {
        void this.status(`Separating vocals...`);
        const response = await requestUrl({
          url: `${baseUrl}/vocal-removal/generate`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            audioId,
          }),
        });
        const result = response.json as SunoApiResponse<SunoTaskResult>;
        if (result.code !== 200) return `Error: ${result.msg}`;
        return `Vocal separation task started. Task ID: ${result.data.taskId}`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error: ${message}`;
    }

    return 'Error: Invalid action or parameters.';
  }
}

/**
 *
 */
class SunoConfirmationModal extends Modal {
  action: string;
  cost: number;
  details: string;
  onResolve: (confirmed: boolean) => void;
  resolved = false;

  /**
   *
   * @param app
   * @param action
   * @param cost
   * @param details
   * @param onResolve
   */
  constructor(
    app: App,
    action: string,
    cost: number,
    details: string,
    onResolve: (confirmed: boolean) => void,
  ) {
    super(app);
    this.action = action;
    this.cost = cost;
    this.details = details;
    this.onResolve = onResolve;
  }

  /**
   *
   */
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // eslint-disable-next-line obsidianmd/ui/sentence-case
    this.setTitle('Confirm Suno API action');
    new Setting(contentEl)
      .setHeading()
      .setName(`The agent is requesting to perform: ${this.action}`)
      .setDesc(
        `Estimated cost: ${this.cost} credits (~$${this.cost > 0 ? (this.cost * 0.005).toFixed(4) : 'free'} USD)`,
      );

    new Setting(contentEl).setName('Parameters').setDesc(this.details).setHeading();

    Object.entries(JSON.parse(this.details) as Record<string, unknown>).forEach(([key, value]) => {
      new Setting(contentEl).setName(key).setDesc(String(value));
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Confirm & run')
          .setCta()
          .onClick(() => {
            this.resolved = true;
            this.onResolve(true);
            this.close();
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => {
          this.resolved = true;
          this.onResolve(false);
          this.close();
        }),
      );
  }

  /**
   *
   */
  onClose() {
    if (!this.resolved) {
      this.onResolve(false);
    }
  }
}

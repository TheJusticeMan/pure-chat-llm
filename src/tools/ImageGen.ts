import { defineToolParameters, InferArgs, Tool } from '../tools';
import { requestUrl, TFile } from 'obsidian';

const imageGenerationParameters = defineToolParameters({
  type: 'object' as const,
  properties: {
    prompt: {
      type: 'string',
      description:
        'A detailed and vivid description of the scene, mood, or concept you wish to visualize. You may include multiple lines to specify elements such as environment, lighting, textures, and emotions, formatted as a Markdown text block. Please ensure your prompt is comprehensive, as it will directly influence the quality and accuracy of the generated image. (Maximum of 4,000 characters)',
    },
    ratio: {
      type: 'string',
      description:
        "Specify the aspect ratio of the image: 'landscape' (wider than tall), 'portrait' (taller than wide), or 'square' (equal dimensions). Defaults to 'square' if omitted.",
      enum: ['square', 'portrait', 'landscape'],
    },
    n: {
      type: 'integer',
      description:
        'Number of images to generate based on the prompt. Useful for exploring different interpretations or selecting the best fit. Be mindful that higher values may consume more resources.',
    },
  },
  required: ['prompt'],
} as const);

export type ImageGenerationArgs = InferArgs<typeof imageGenerationParameters>;

export class ImageGenerationTool extends Tool<ImageGenerationArgs> {
  readonly name = 'generate_image';
  static _name = this.name;
  readonly description =
    'Create high-quality, customized images from detailed Markdown prompts. Supports multiple outputs and aspect ratio customization for precise visual storytelling.';
  readonly parameters = imageGenerationParameters;

  model = 'dall-e-3'; // Default model

  isAvailable(): boolean {
    return (
      this.chat.plugin.settings.endpoints[this.chat.plugin.settings.endpoint]?.name === 'OpenAI'
    );
  }

  async execute(args: ImageGenerationArgs): Promise<string> {
    const { prompt, ratio = 'square', n = 1 } = args;
    this.status(`Generating ${n} image(s) for prompt: "${prompt}"...`);

    try {
      // Cast the inferred types to the specific expected types for the request method if necessary,
      // or ensure the request method handles the broad inferred types.
      // InferArgs for 'ratio' with enum might be string, so we ensure safety.
      const safeRatio = ['square', 'portrait', 'landscape'].includes(ratio) ? ratio : 'square';

      const results = await this.sendImageGenerationRequest({
        prompt,
        ratio: safeRatio as 'square' | 'portrait' | 'landscape',
        n: n ?? 1,
      });

      const fileManager = this.chat.plugin.app.fileManager;
      let messageContent = '';
      results.forEach(image => {
        messageContent += `!${fileManager.generateMarkdownLink(image.file, this.chat.file.path)}\n`;
        if (image.revised_prompt) {
          messageContent += `Revised prompt: ${image.revised_prompt}\n`;
        }
      });
      return messageContent;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error generating image: ${message}`;
    }
  }

  private async sendImageGenerationRequest({
    prompt,
    ratio = 'square',
    n = 1,
  }: {
    prompt: string;
    ratio?: 'square' | 'portrait' | 'landscape';
    n?: number;
  }): Promise<{ normalizedPath: string; revised_prompt?: string; file: TFile }[]> {
    const url = 'https://api.openai.com/v1/images/generations';
    const apiKey = this.chat.endpoint.apiKey;
    const app = this.chat.plugin.app;
    const contextFile = this.chat.file;

    const size =
      ratio === 'landscape' // Landscape images
        ? this.model === 'gpt-image-1'
          ? '1536x1024'
          : this.model === 'dall-e-3'
            ? '1792x1024'
            : '1024x1024'
        : ratio === 'portrait' // Portrait images
          ? this.model === 'gpt-image-1'
            ? '1024x1536'
            : this.model === 'dall-e-3'
              ? '1024x1792'
              : '1024x1024'
          : '1024x1024'; // Square images Default size

    const body = {
      model: this.model,
      prompt,
      n: n || 1,
      size,
    };

    // eslint-disable-next-line no-restricted-globals
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then(async response => {
      if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
      const data = (await response.json()) as {
        created: number;
        data: { url: string; revised_prompt?: string }[];
      };
      // Map each image to an object containing its url and revised_prompt (if available)
      const images = data.data;

      const savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i].url;
        const filename = `generated-image-${Date.now()}-${i}.png`;

        const normalizedPath = await app.fileManager.getAvailablePathForAttachment(
          filename,
          contextFile.path,
        );

        const imgResp = await requestUrl(imageUrl); // Fetch the image from the URL
        // imgResp is the binary response of the image as a string
        if (!imgResp) throw new Error(`Failed to fetch image from URL: ${imageUrl}`);

        // Convert string to ArrayBuffer for createBinary
        const file = await app.vault.createBinary(normalizedPath, imgResp.arrayBuffer);

        savedPaths.push({
          normalizedPath,
          revised_prompt: images[i].revised_prompt,
          file,
        });
      }

      return savedPaths;
    });
  }
}

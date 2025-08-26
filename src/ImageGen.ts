import * as imageGeneration from "./imageGen.json";
import { App, request, requestUrl, TFile } from "obsidian";

export class PureChatLLMImageGen {
  static readonly TOOL_NAME = "image_generation"; // Name of the tool as it will be used in the chat completion request
  static tool = imageGeneration;
  model: string = "dall-e-3"; // Default model, "gpt-image-1" or "dall-e-2" or "dall-e-3"
  constructor(private app: App, private API_KEY: string, private file: TFile) {}
  setModel(model: string): this {
    this.model = model;
    return this;
  }
  sendImageGenerationRequest({
    prompt,
    ratio = "square",
    n = 1,
  }: {
    prompt: string;
    ratio?: "square" | "portrait" | "landscape";
    n?: number;
  }): Promise<{ normalizedPath: string; revised_prompt?: string; file: TFile }[]> {
    const url = "https://api.openai.com/v1/images/generations";

    const size =
      ratio === "landscape" // Landscape images
        ? this.model === "gpt-image-1"
          ? "1536x1024"
          : this.model === "dall-e-3"
          ? "1792x1024"
          : "1024x1024"
        : ratio === "portrait" // Portrait images
        ? this.model === "gpt-image-1"
          ? "1024x1536"
          : this.model === "dall-e-3"
          ? "1024x1792"
          : "1024x1024"
        : "1024x1024"; // Square images Default size

    const body = {
      model: this.model,
      prompt,
      n: n || 1,
      size,
    };
    console.log("Generating image with body:", body);

    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).then(async response => {
      if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
      const data = await response.json();
      // Map each image to an object containing its url and revised_prompt (if available)
      const images: { url: string; revised_prompt?: string }[] = data.data;

      const savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i].url;
        const filename = `generated-image-${Date.now()}-${i}.png`;

        const normalizedPath = await this.app.fileManager.getAvailablePathForAttachment(
          filename,
          this.file.path
        );

        const imgResp = await requestUrl(imageUrl); // Fetch the image from the URL
        // imgResp is the binary response of the image as a string
        if (!imgResp) throw new Error(`Failed to fetch image from URL: ${imageUrl}`);

        // Convert string to ArrayBuffer for createBinary
        const file = await this.app.vault.createBinary(normalizedPath, imgResp.arrayBuffer);
        //await this.app.vault.create(normalizedPath, imgResp);
        savedPaths.push({ normalizedPath, revised_prompt: images[i].revised_prompt, file });
      }

      return savedPaths;
    });
  }

  async getToolCall(message: {
    tool_calls: { function: { name: string; arguments: string }; id: string }[];
  }) {
    const toolCall = message.tool_calls.find(
      call => call.function.name === PureChatLLMImageGen.TOOL_NAME
    );
    if (!toolCall) {
      throw new Error(`No tool call found for ${PureChatLLMImageGen.TOOL_NAME}`);
    }
    const args = JSON.parse(toolCall.function.arguments);
    const result = await this.sendImageGenerationRequest({
      prompt: args.prompt,
      ratio: args.ratio || "square",
      n: args.n || 1,
    });

    let messageContent = "";
    result.forEach(image => {
      messageContent += `![[${image.normalizedPath}]]\n`;
      if (image.revised_prompt) {
        messageContent += `Revised prompt: ${image.revised_prompt}\n`;
      }
    });

    return [message, { role: "tool", tool_call_id: toolCall.id, content: messageContent }];
  }
}

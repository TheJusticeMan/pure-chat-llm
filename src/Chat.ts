import { App, EditorRange, Notice, TFile } from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import { codeContent } from "./CodeHandling";
import PureChatLLM from "./main";
import { EmptyApiKey } from "./s.json";
import { StatSett } from "./settings";
import { toTitleCase } from "./toTitleCase";
import { PureChatLLMAPI } from "./types";
import { PureChatLLMImageGen } from "./ImageGen";

interface ChatMessage {
  role: RoleType;
  content: string;
  cline: EditorRange;
}

type RoleType = "system" | "user" | "assistant" | "developer";

type MessageImg =
  | {
      type: "image_url";
      image_url: { url: string };
    }
  | {
      type: "text";
      text: string;
    };

/**
 * Represents a chat session for the Pure Chat LLM Obsidian plugin.
 *
 * Handles chat message management, markdown serialization/deserialization,
 * OpenAI API communication, and integration with Obsidian files and templates.
 *
 * @remarks
 * - Supports parsing and formatting chat conversations in markdown.
 * - Can resolve Obsidian file links within chat messages.
 * - Provides methods for sending chat requests to the OpenAI API, including streaming support.
 * - Integrates with prompt templates for advanced chat processing and selection-based responses.
 *
 * @example
 * ```typescript
 * const chat = new PureChatLLMChat(pluginInstance);
 * chat.appendMessage({ role: "user", content: "Hello!" });
 * await chat.CompleteChatResponse(activeFile);
 * ```
 *
 * @public
 */
export class PureChatLLMChat {
  options: {
    model: string;
    max_completion_tokens: number;
    stream: boolean;
    tools?: any[];
    [key: string]: any;
  };
  messages: ChatMessage[] = [];
  plugin: PureChatLLM;
  console: BrowserConsole;
  pretext: string = "";
  endpoint: PureChatLLMAPI;
  Parser = StatSett.chatParser[0];
  validChat = true;
  file: TFile;
  imageOutputUrls: { normalizedPath: string; revised_prompt?: string }[] | null = null;

  constructor(plugin: PureChatLLM) {
    this.plugin = plugin;
    this.console = new BrowserConsole(plugin.settings.debug, "PureChatLLMChat");
    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    this.options = {
      model: this.endpoint.defaultmodel,
      max_completion_tokens: 4096,
      stream: true,
    };
    this.Parser = StatSett.chatParser[this.plugin.settings.chatParser];
  }

  /**
   * Generates a Markdown-formatted string representation of the chat options and text.
   *
   * The output includes a JSON representation of the `options` object wrapped in a
   * code block, followed by the chat text.
   *
   * @returns {string} A Markdown-formatted string containing the JSON representation
   * of the chat options and the chat text.
   */
  get Markdown(): string {
    const prechat = PureChatLLMChat.changeCodeBlockMD(
      this.pretext,
      "json",
      JSON.stringify(this.options, null, 2)
    );
    return `${prechat.trim()}\n${this.ChatText}`;
  }

  /**
   * Sets the Markdown content for the chat and processes it into structured messages.
   *
   * @param markdown - The Markdown string to be parsed. It is expected to contain
   *                   sections prefixed with `# role: system|user|assistant|developer`
   *                   to define the roles and their respective content.
   *
   * The method performs the following:
   * - Splits the Markdown into a prechat section and chat sections based on the role markers.
   * - If no role markers are found, initializes the messages with a system prompt and the
   *   entire prechat content as a user message.
   * - Parses each chat section into a message object with a role, content, and editor range.
   * - Extracts JSON options from the prechat section if a JSON code block is present.
   *
   * Notes:
   * - The `cline` property in each message represents the range of lines in the editor
   *   corresponding to the message content.
   * - The `options` property is updated if valid JSON is found in the prechat section.
   */
  set Markdown(markdown: string) {
    let [prechat, ...chat] = markdown.split(this.Parser.SplitMessages);
    let lengthtoHere = prechat.split("\n").length;
    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (chat.length === 0) {
      // if the file has no # role: system|user|assistant|developer
      this.validChat = false;
      this.messages = [];
      this.appendMessage({
        role: "system",
        content: this.plugin.settings.SystemPrompt,
      }).appendMessage({ role: "user", content: prechat });
      return;
    }

    this.messages = chat.map((text) => {
      const [role, ...contentLines] = text.replace(this.Parser.getRole, "$1\n").split(/\n/);
      const cline: EditorRange = {
        from: { line: lengthtoHere, ch: 0 },
        to: { line: lengthtoHere + contentLines.length - 1, ch: 0 },
      };
      lengthtoHere += contentLines.length;
      return {
        role: role.toLowerCase().trim() as RoleType,
        content: contentLines.join("\n").trim(),
        cline,
      };
    });
    this.pretext = prechat;
    const optionsStr = PureChatLLMChat.extractCodeBlockMD(prechat, "json") || "";
    this.options = PureChatLLMChat.tryJSONParse(optionsStr) || this.options;
    this.updateEndpointFromModel();
  }

  updateEndpointFromModel() {
    const { ModelsOnEndpoint, endpoints } = this.plugin.settings;
    const endpointName = Object.keys(ModelsOnEndpoint).find((name) =>
      ModelsOnEndpoint[name].includes(this.options.model)
    );
    if (endpointName) {
      this.endpoint = endpoints.find((e) => e.name === endpointName) ?? this.endpoint;
    }
    return this;
  }

  /**
   * Sets the markdown content for the current instance.
   *
   * @param markdown - The markdown string to set.
   * @returns The current instance to allow method chaining.
   */
  setMarkdown(markdown: string) {
    // make this chainable
    this.Markdown = markdown;
    return this;
  }

  /**
   * Sets the model to be used and updates the options with the provided model.
   *
   * @param modal - The name of the model to set.
   * @returns The current instance of the class for method chaining.
   */
  setModel(modal: string) {
    this.options.model = modal;
    this.updateEndpointFromModel();
    return this;
  }

  /**
   * Extracts the content of a code block from a given markdown string based on the specified programming language.
   *
   * @param markdown - The markdown string containing the code block.
   * @param language - The programming language of the code block to extract.
   * @returns The content of the code block as a string if found, otherwise `null`.
   *
   * @example
   * ```typescript
   * const markdown = `
   * \`\`\`typescript
   * const x = 42;
   * \`\`\`
   * `;
   * const code = extractCodeBlockMD(markdown, "typescript");
   * console.log(code); // Outputs: "const x = 42;"
   * ```
   */
  static extractCodeBlockMD(markdown: string, language: string): string | null {
    const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, "im");
    const match = markdown.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Extracts all code blocks from a given markdown string.
   *
   * This method scans the provided markdown content and identifies all code blocks
   * enclosed within triple backticks (```), optionally capturing the language identifier
   * and the code content. It returns an array of objects, each containing the language
   * and the code snippet.
   *
   * @param markdown - The markdown string to extract code blocks from.
   * @returns An array of objects, where each object contains:
   * - `language`: The programming language of the code block (default is "plaintext").
   * - `code`: The extracted code content, trimmed of leading and trailing whitespace.
   *
   * @example
   * ```typescript
   * const markdown = `
   * Here is some code:
   * \`\`\`javascript
   * console.log("Hello, world!");
   * \`\`\`
   * `;
   * const codeBlocks = extractAllCodeBlocks(markdown);
   * console.log(codeBlocks);
   * // Output: [{ language: "javascript", code: 'console.log("Hello, world!");' }]
   * ```
   */
  static extractAllCodeBlocks(markdown: string): codeContent[] {
    const regex = /^```(\w*)\n([\s\S]*?)\n```/gm;
    const matches: { language: string; code: string }[] = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const [, language, code] = match;
      const lang = ((language || "plaintext").trim() as string) || "plaintext";
      matches.push({
        language: lang,
        code: code.trim(),
      });
    }
    return matches;
  }

  /**
   * Replaces the content of a code block in a markdown string with new text.
   *
   * @param text - The original markdown string containing the code block.
   * @param language - The programming language of the code block to replace.
   * @param newText - The new text to insert into the code block.
   * @returns The modified markdown string with the updated code block content.
   *
   * @example
   * ```typescript
   * const markdown = `
   * \`\`\`javascript
   * console.log("Hello, world!");
   * \`\`\`
   * `;
   * const updatedMarkdown = changeCodeBlockMD(markdown, "javascript", "console.log('New code');");
   * console.log(updatedMarkdown);
   * // Output: "\`\`\`javascript\nconsole.log('New code');\n\`\`\`"
   * ```
   */
  static changeCodeBlockMD(text: string, language: string, newText: string) {
    const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, "im");
    return (
      text.replace(regex, `\`\`\`${language}\n${newText}\n\`\`\``) ||
      `${text}\n\`\`\`${language}\n${newText}\n\`\`\``
    );
  }

  /**
   * Appends a new message to the list of messages.
   *
   * @param message - An object containing the role and content of the message.
   *   - `role`: The role of the message sender (e.g., "user", "assistant").
   *   - `content`: The textual content of the message.
   *
   * The appended message will also include a default `cline` property
   * with `from` and `to` positions initialized to `{ line: 0, ch: 0 }`.
   */
  appendMessage(message: { role: string; content: string }) {
    let extras = "";
    if (this.imageOutputUrls)
      extras =
        this.imageOutputUrls
          .map((img) => `![${img.revised_prompt || "image"}](${img.normalizedPath})`)
          .join("\n") + "\n\n";
    this.imageOutputUrls = null;
    this.messages.push({
      role: message.role as RoleType,
      content: (extras + message.content).trim(),
      cline: {
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 0 },
      },
    });
    return this;
  }

  /**
   * Resolves file links in a given markdown string by replacing them with the content
   * of the referenced files. If a file cannot be resolved, the original link is retained.
   *
   * @param markdown - The markdown string containing file links to resolve.
   * @param activeFile - The currently active file, used as a reference for resolving relative links.
   * @param app - The Obsidian application instance, providing access to the vault and metadata cache.
   * @returns A promise that resolves to the markdown string with file links replaced by their content.
   *
   * @remarks
   * - File links are expected to be in the format `[[filename]]` or `![[filename]]`.
   * - If a file cannot be found, the original link will remain in the output.
   * - This function uses asynchronous operations to read file contents, so it returns a promise.
   */
  static async resolveFiles(markdown: string, activeFile: TFile, app: App): Promise<string> {
    const regex = /^\!?\[\[(.*?)\]\]$/gim;
    //const regex2 = /^.+\!?\[\[([^\]]+)\]\].+$/gim;
    const matches = Array.from(markdown.matchAll(regex));
    //const matches2 = Array.from(markdown.matchAll(regex2));
    const replacements: Promise<string>[] = [];
    //const appendedfiles: Promise<string>[] = [];

    for (const match of matches) {
      const filename = match[1];
      const file = app.metadataCache.getFirstLinkpathDest(filename, activeFile.path);
      if (file instanceof TFile) {
        replacements.push(app.vault.cachedRead(file));
      } else {
        replacements.push(Promise.resolve(match[0]));
      }
    }

    if (replacements.length === 0) return markdown;

    const resolved = await Promise.all(replacements);
    let index = 0;
    const result = markdown.replace(regex, () => resolved[index++] || "");
    return result;
  }

  static getfileForLink(str: string, activeFile: TFile, app: App): TFile | null {
    return app.metadataCache.getFirstLinkpathDest(
      str.trim().replace(/^\!?\[\[|(#.+|\|.+)?\]\]$/g, ""),
      activeFile.path
    );
  }

  static async resolveFilesWithImages(
    markdown: string,
    activeFile: TFile,
    app: App,
    role: string
  ): Promise<MessageImg[] | string> {
    const regex = /(!)?\[\[([^\]]+)\]\]/g;
    const matches = Array.from(markdown.matchAll(regex));

    const resolved: MessageImg[] = await Promise.all(
      matches.map(async (match) => {
        const file = this.getfileForLink(match[0], activeFile, app);
        const isImage = /^(png|jpg|jpeg|gif|webp)$/i.test(file?.extension || "");

        if (!(file instanceof TFile) || (isImage && role !== "user")) {
          // Not found, return as text
          return { type: "text", text: match[0] };
        }
        if (isImage) {
          const mime = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
          }[file.extension.toLowerCase()]!;

          const data = await app.vault.readBinary(file);
          const url = await this.arrayBufferToBase64DataURL(data, mime);
          return { type: "image_url", image_url: { url } };
        } else {
          // Read as text
          const content = await app.vault.cachedRead(file);
          return { type: "text", text: content };
        }
      })
    );

    //get the surrounding text around the matches
    let lastIndex = 0;
    const allParts: MessageImg[] = [];
    for (const match of matches) {
      const start = match.index ?? 0;
      const end = start + match[0].length;

      // Add text before the match
      if (start > lastIndex) {
        allParts.push({
          type: "text",
          text: markdown.slice(lastIndex, start).trim(),
        });
      }

      // Add the resolved match
      allParts.push(resolved.shift()!);

      lastIndex = end;
    }
    // Add any remaining text after the last match
    if (lastIndex < markdown.length) {
      allParts.push({
        type: "text",
        text: markdown.slice(lastIndex).trim(),
      });
    }

    const final = allParts.reduce((acc, item) => {
      if (item.type === "text" && acc.at(-1)?.type === "text") {
        (acc.at(-1) as { type: "text"; text: string }).text += `\n${item.text}`;
      } else {
        acc.push(item);
      }
      return acc;
    }, [] as MessageImg[]);

    if (final.length === 0) {
      return markdown; // If no valid parts, return original markdown
    }
    if (final.length === 1 && final[0].type === "text") {
      return final[0].text; // If only one text part, return it directly
    }

    // Combine consecutive text items into one
    return final;
  }

  // Helper function
  static arrayBufferToBase64DataURL(buffer: ArrayBuffer, mime: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: mime }); // Pass the mime type here
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string); // This is a data URL: data:image/png;base64,xxxx
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Instance method: get chat instructions with resolved files

  /**
   * Asynchronously generates a structured set of instructions for ChatGPT by resolving file references
   * within the provided messages and returning the complete object to be sent to the API.
   *
   * @param activeFile - The currently active file in the application, used for resolving file references.
   * @param app - The application instance, providing access to necessary utilities and context.
   * @returns A promise that resolves to an object containing the resolved messages with their roles and content.
   */
  async getChatGPTinstructions(
    activeFile: TFile,
    app: App
  ): Promise<{ messages: { role: RoleType; content: MessageImg[] | string }[]; tools?: any[] }> {
    this.file = activeFile;
    const resolvedMessages = await Promise.all(
      this.messages.map(async ({ role, content }) => ({
        role: role,
        content: await PureChatLLMChat.resolveFilesWithImages(content, activeFile, app, role),
      }))
    );

    // return the whole object sent to the API
    return {
      ...this.options,
      messages: resolvedMessages,
      tools: [
        ...(this.options.tools ?? []),
        ...(this.plugin.settings.useImageGeneration && this.plugin.settings.endpoint === 0
          ? [PureChatLLMImageGen.tool]
          : []),
      ],
    };
  }

  /**
   * Processes a chat conversation using a specified template prompt.
   *
   * This method constructs a system prompt instructing the chat model to:
   * 1. Extract the chat content enclosed within `<Conversation>` tags.
   * 2. Follow a command or instruction provided after the conversation.
   * 3. Return the processed chat in markdown format, omitting any tags or instructions.
   *
   * The method then sends a chat request to the model with the constructed prompts and user input.
   *
   * @param templatePrompt - The template prompt containing the instruction and template name to guide the chat processing.
   * @returns A Promise resolving to the processed chat response from the model.
   */
  ProcessChatWithTemplate(templatePrompt: string) {
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: "assistant", content: "" });
    }
    const systemprompt = `You are a markdown chat processor.

You will receive:
- A chat conversation enclosed within <Conversation> and </Conversation> tags.
- A command or instruction immediately after the conversation.

Your task:
1. Extract the chat content inside the <Conversation> tags.
2. Follow the command to process, summarize, clarify, or modify the chat.
3. Return only the final processed chat in markdown format, without any tags or instructions.

Use this workflow to accurately handle the chat based on the instruction.`;
    //const systemprompt = `You are a ${templatePrompt.name}.`;
    new Notice("Generating chat response from template...");
    return this.sendChatRequest({
      ...this.options,
      messages: [
        { role: "system", content: systemprompt },
        {
          role: "user",
          content: `<Conversation>\n${this.ChatText}\n\n</Conversation>`,
        },
        { role: "user", content: templatePrompt },
      ],
    }).then((r) => {
      return {
        role: "assistant",
        content: r.content
          .trim()
          .replace(/^<Conversation>|<\/Conversation>$/g, "")
          .trim(),
      };
    });
  }

  /**
   * Processes a selected piece of markdown text using a specified instruction prompt.
   *
   * This method constructs a system prompt to guide a markdown content processor,
   * then sends a chat request to an LLM model with the selected markdown and the
   * provided instruction. The LLM is expected to extract the markdown within
   * <Selection> tags, apply the instruction, and return only the processed markdown.
   *
   * @param templatePrompt - The instruction prompt containing the name and template for processing.
   * @param selectedText - The markdown text selected by the user to be processed.
   * @returns A Promise resolving to the LLM's response containing the processed markdown,
   *          or an empty response if no text is selected.
   */
  SelectionResponse(templatePrompt: string, selectedText: string, fileText?: string) {
    if (!selectedText) return Promise.resolve({ role: "assistant", content: selectedText });
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: "assistant", content: selectedText });
    }
    const systemprompt = `You are a markdown content processor. 

You will receive:
- A selected piece of markdown text inside <Selection> and </Selection> tags.
- A command or instruction immediately after the selection.

Your job:
1. Extract the markdown inside the <Selection> tags.
2. Follow the command to process or expand that markdown.
3. Return only the processed markdown content, without tags or instructions.

Use this workflow to help modify markdown content accurately.`;
    //const systemprompt = `You are a ${templatePrompt.name}.`;
    const messages = [
      ...(fileText
        ? [
            {
              role: "system",
              content: `Here's the whole file that's being edited:\n<Markdown>\n${fileText}\n</Markdown>`,
            },
          ]
        : []),
      { role: "system", content: systemprompt },
      {
        role: "user",
        content: `<Selection>\n${selectedText}\n\n</Selection>`,
      },
      { role: "user", content: templatePrompt },
    ];
    new Notice("Generating response for selection...");
    return this.sendChatRequest({ ...this.options, messages: messages }).then((r) => {
      return {
        role: "assistant",
        content: r.content
          .trim()
          .replace(/^<Selection>|<\/Selection>$/g, "")
          .trim(),
      };
    });
  }

  /**
   * Handles the process of completing a chat response by interacting with ChatGPT.
   *
   * @param file - The file object of type `TFile` that contains the context or data for the chat.
   * @param streamcallback - An optional callback function that processes text fragments as they are streamed.
   *                         The callback should return a boolean indicating whether to continue streaming.
   * @returns A promise that resolves to the current instance (`this`) after processing the chat response.
   *
   * The method performs the following steps:
   * 1. Retrieves chat instructions using `getChatGPTinstructions`.
   * 2. Sends a chat request using `sendChatRequest` with the retrieved options and optional streaming callback.
   * 3. Appends the received content as a message and adds an empty user message for continuity.
   * 4. Handles any errors by logging them to the plugin's console.
   */
  CompleteChatResponse(
    file: TFile,
    streamcallback?: (textFragment: any) => boolean
  ): Promise<this> {
    if (this.endpoint.apiKey === EmptyApiKey) {
      return Promise.resolve(this);
    }
    return this.getChatGPTinstructions(file, this.plugin.app)
      .then((options) => this.sendChatRequest(options, streamcallback))
      .then((content) => {
        this.appendMessage(content).appendMessage({ role: "user", content: "" });
        // Add the model to the endpoint's model list if not already present
        const models = (this.plugin.settings.ModelsOnEndpoint[this.endpoint.name] ??= []);
        if (!models.includes(this.options.model)) {
          models.push(this.options.model);
          this.plugin.saveSettings();
        }
        return this;
      })
      .catch((error) => {
        new Notice("Error in chat completion. Check console for details.");
        this.plugin.console.error(`Error in chat completion:`, error);
        return this;
      });
  }

  /**
   * Handles streaming responses from a fetch Response object.
   * Calls the provided callback with each parsed data fragment.
   * Returns the concatenated content as a string.
   */
  static async handleStreamingResponse(
    response: Response,
    streamcallback: (textFragment: any) => boolean
  ): Promise<{ role: string; content?: string; tool_calls?: any[] }> {
    if (!response.body) {
      throw new Error("Response body is null. Streaming is not supported in this environment.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let buffer = "";
    let fullText = "";
    let fullcalls: any[] = [];

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      let lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("data: ")) {
          const dataStr = trimmedLine.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") {
            done = true;
            break;
          }
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              const continueProcessing = streamcallback(delta);
              if (!continueProcessing) {
                done = true;
                break;
              }
            } else if (delta?.tool_calls) {
              (delta.tool_calls as any[]).forEach((call: any) => {
                const index = call.index;
                if (!fullcalls[index]) fullcalls[index] = call;
                if (call.function.arguments) {
                  if (!fullcalls[index].function.arguments) {
                    fullcalls[index].function.arguments = "";
                  }
                  fullcalls[index].function.arguments += `${call.function.arguments}`;
                }
              });
            }
          } catch (err) {
            // Optionally handle parse errors
          }
        }
      }
    }

    if (fullcalls.length > 0) {
      fullcalls.forEach((call) => {
        delete call.index; // Remove index from tool calls
      });
      console.log("Full tool calls:", fullcalls);
      return { role: "assistant", tool_calls: fullcalls };
    }
    return { role: "assistant", content: fullText };
  }

  ReverseRoles() {
    this.messages = this.messages.map((msg) => {
      if (msg.role === "user") {
        msg.role = "assistant";
      } else if (msg.role === "assistant") {
        msg.role = "user";
      }
      return msg;
    });
    return this;
  }

  /**
   * Sends a chat request to the specified endpoint with the provided options.
   *
   * @param options - The options for the chat request, including any parameters
   * required by the API. If `stream` is enabled, the `streamcallback` must also
   * be provided.
   * @param streamcallback - An optional callback function that processes text
   * fragments when streaming is enabled. The callback should return `true` to
   * continue streaming or `false` to stop.
   * @returns A promise that resolves to the chat response. If streaming is enabled,
   * the response contains the full concatenated text from the stream. Otherwise,
   * it returns the first message choice from the API response.
   * @throws An error if the network request fails or the response is not successful.
   */
  async sendChatRequest(
    options: any,
    streamcallback?: (textFragment: any) => boolean
  ): Promise<any> {
    this.console.log("Sending chat request with options:", options);
    this.plugin.status(`running: ${options.model}`);
    const response = await fetch(this.endpoint.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.endpoint.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...options,
        stream: options.stream && !!streamcallback,
      }),
    });

    if (!response.ok) {
      this.console.error(`Network error: ${response.statusText}`);
      this.plugin.status("");
      throw new Error(`Network error: ${response.statusText}`);
    }

    if (options.stream && !!streamcallback) {
      const fullText = await PureChatLLMChat.handleStreamingResponse(response, streamcallback);
      this.plugin.status("");
      if (fullText.tool_calls) {
        const toolCalls = fullText.tool_calls;
        const imageGenCall = toolCalls.find(
          (call: any) => call.function.name === PureChatLLMImageGen.tool.function.name
        );
        if (imageGenCall) {
          streamcallback({
            role: "tool",
            content: `Generating image:\n${JSON.parse(imageGenCall.function.arguments).prompt}`,
          });
          const l = await this.GenerateImage(imageGenCall, fullText);
          options.messages.push(...l.msgs);
          return this.sendChatRequest(options, streamcallback);
        }
      }
      return fullText;
    } else {
      const data = await response.json();
      if (data.choices[0].message.tool_calls) {
        const toolCalls = data.choices[0].message.tool_calls;
        const imageGenCall = toolCalls.find(
          (call: any) => call.function.name === PureChatLLMImageGen.tool.function.name
        );
        if (imageGenCall) {
          streamcallback?.({
            role: "tool",
            content: `Generating image:\n${JSON.parse(imageGenCall.function.arguments).prompt}`,
          });
          const l = await this.GenerateImage(imageGenCall, data.choices[0].message);
          options.messages.push(...l.msgs);
          return this.sendChatRequest(options, streamcallback);
        }
      }
      this.plugin.status("");
      return data.choices[0].message;
    }
  }

  filterOutUncalledToolCalls([agent, ...Responses]: {
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls: any[];
  }[]): { role: string; content: string; tool_call_id?: string; tool_calls: any[] }[] {
    agent.tool_calls = agent.tool_calls.filter((call) =>
      Responses.some((i) => i.tool_call_id === call.id)
    );
    //if (msg.role === "tool" && msg.tool_call_id) {
    return [agent, ...Responses];
  }

  private async GenerateImage(imageGenCall: any, data: any) {
    const imageGen = new PureChatLLMImageGen(this.plugin.app, this.endpoint.apiKey, this.file);
    const imageOutputUrls = await imageGen.sendImageGenerationRequest(
      JSON.parse(imageGenCall.function.arguments)
    );
    const message = imageOutputUrls
      .map((img) => {
        return [
          `![Generated Image](${img.normalizedPath})`,
          `Revised Image prompt: ${img.revised_prompt}`,
        ];
      })
      .flat()
      .join("\n");
    this.imageOutputUrls = imageOutputUrls;
    return {
      imageOutputUrls,
      msgs: this.filterOutUncalledToolCalls([
        data,
        {
          role: "tool",
          content: message || "",
          tool_call_id: imageGenCall.id,
          cline: {
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 0 },
          },
        },
      ]),
    };
  }

  /**
   * Retrieves a list of all available models from the configured API endpoint.
   * If the model list is already cached, it returns the cached list.
   * Otherwise, it fetches the model list from the API, sorts it alphabetically,
   * and returns the result.
   *
   * @returns {Promise<any[]>} A promise that resolves to an array of model IDs.
   *
   * @remarks
   * - Displays a notice and logs a message when fetching models from the API.
   * - Requires a valid API key to be set in the plugin's settings.
   *
   * @throws {Error} If the API request fails or the response is invalid.
   */
  getAllModels(): Promise<any[]> {
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (this.plugin.modellist.length > 0) {
      return Promise.resolve(this.plugin.modellist);
    }
    this.console.log(`Fetching models from ${endpoint.name} API...`);
    return fetch(endpoint.listmodels, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) =>
        data.data.map(({ id }: any) => id).sort((a: string, b: string) => a.localeCompare(b))
      );
  }

  // Instance method: convert chat back to markdown
  /**
   * Constructs a formatted string representation of all chat messages.
   * Each message is prefixed with its role in title case and followed by its content.
   * Messages are concatenated into a single string, separated by newlines.
   *
   * @returns {string} A formatted string containing all chat messages.
   */
  get ChatText(): string {
    return this.messages
      .map(
        (msg) =>
          `${this.Parser.rolePlacement.replace(
            /{role}/g,
            toTitleCase(msg.role)
          )}\n${msg.content.trim()}`
      )
      .join("\n");
  }

  thencb(cb: (chat: this) => any): this {
    cb(this);
    return this;
  }

  /**
   * Attempts to parse a JSON string and return the resulting object.
   * If the parsing fails due to invalid JSON, it returns `null`.
   *
   * @param str - The JSON string to parse.
   * @returns The parsed object if successful, or `null` if parsing fails.
   */
  static tryJSONParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
}

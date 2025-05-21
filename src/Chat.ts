import { App, EditorRange, Notice, TFile } from "obsidian";
import { codelanguage } from "./codelanguages";
import PureChatLLM from "./main";
import { toSentanceCase } from "./toSentanceCase";
import {
  ChatMessage,
  chatParser,
  EmptyApiKey,
  PureChatLLMAPI,
  PureChatLLMInstructPrompt,
  RoleType,
} from "./types";
import { BrowserConsole } from "./MyBrowserConsole";

export interface codeContent {
  language: string;
  code: string;
}

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
  options;
  messages: ChatMessage[];
  plugin: PureChatLLM;
  console: BrowserConsole;
  pretext: string = "";
  endpoint: PureChatLLMAPI;
  Parser = chatParser[0];
  validChat = true;

  constructor(plugin: PureChatLLM) {
    this.plugin = plugin;
    this.console = new BrowserConsole(plugin.settings.debug, "PureChatLLMChat");
    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    this.options = {
      model: this.endpoint.defaultmodel,
      max_completion_tokens: 4096,
      stream: true,
    };
    this.Parser = chatParser[this.plugin.settings.chatParser];
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
      });
      this.appendMessage({ role: "user", content: prechat });
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
    return this;
  }

  /**
   * Determines whether the provided markdown string represents a chat message.
   *
   * A valid chat message is identified by a header in the format:
   * `# role: (system|user|assistant|developer)` (case-insensitive).
   *
   * @param markdown - The markdown string to evaluate.
   * @returns `true` if the markdown matches the chat message format, otherwise `false`.
   */
  static isChat(markdown: string): boolean {
    return /^# role: (system|user|assistant|developer)/im.test(markdown);
  }

  isChat(): boolean {
    return this.messages[0].content !== this.plugin.settings.SystemPrompt;
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
  static extractCodeBlockMD(markdown: string, language: codelanguage): string | null {
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
    const matches: { language: codelanguage; code: string }[] = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const [, language, code] = match;
      const lang = ((language || "plaintext").trim() as codelanguage) || "plaintext";
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
    this.messages.push({
      role: message.role as RoleType,
      content: message.content,
      cline: {
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 0 },
      },
    });
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
    const matches = Array.from(markdown.matchAll(regex));
    const replacements: Promise<string>[] = [];

    for (const match of matches) {
      const filename = match[1];
      const file = app.metadataCache.getFirstLinkpathDest(filename, activeFile.path);
      if (file instanceof TFile) {
        replacements.push(app.vault.read(file));
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
  ): Promise<{ messages: { role: RoleType; content: string }[] }> {
    const resolvedMessages = await Promise.all(
      this.messages.map(async ({ role, content }) => ({
        role: role,
        content: await PureChatLLMChat.resolveFiles(content, activeFile, app),
      }))
    );

    // return the whole object sent to the API

    return {
      ...this.options,
      messages: resolvedMessages,
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
  ProcessChatWithTemplate(templatePrompt: PureChatLLMInstructPrompt) {
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: "assistant", content: EmptyApiKey });
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
      model: this.endpoint.defaultmodel,
      messages: [
        { role: "system", content: systemprompt },
        {
          role: "user",
          content: `<Conversation>\n${this.ChatText}\n\n</Conversation>`,
        },
        { role: "user", content: templatePrompt.template },
      ],
      max_completion_tokens: 4096,
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
  SelectionResponse(templatePrompt: PureChatLLMInstructPrompt, selectedText: string) {
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({
        role: "assistant",
        content: selectedText,
      });
    }
    //const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
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
    if (selectedText.length > 0) {
      new Notice("Generating response for selection...");
      return this.sendChatRequest({
        model: this.endpoint.defaultmodel,
        messages: [
          { role: "system", content: systemprompt },
          {
            role: "user",
            content: `<Selection>\n${selectedText}\n\n</Selection>`,
          },
          { role: "user", content: templatePrompt.template },
        ],
        max_completion_tokens: 4096,
      });
    }
    return Promise.resolve({ role: "assistant", content: "" });
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
        this.appendMessage(content);
        this.appendMessage({ role: "user", content: "" });
        return this;
      })
      .catch((error) => {
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
  ): Promise<string> {
    if (!response.body) {
      throw new Error("Response body is null. Streaming is not supported in this environment.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let buffer = "";
    let fullText = "";

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
            }
          } catch (err) {
            // Optionally handle parse errors
          }
        }
      }
    }
    return fullText;
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
  async sendChatRequest(options: any, streamcallback?: (textFragment: any) => boolean) {
    this.console.log("Sending chat request with options:", options);
    this.console.log("Using API key:", this.endpoint.apiKey);
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
      throw new Error(`Network error: ${response.statusText}`);
    }

    if (options.stream && !!streamcallback) {
      const fullText = await PureChatLLMChat.handleStreamingResponse(response, streamcallback);
      return { role: "assistant", content: fullText };
    } else {
      const data = await response.json();
      return data.choices[0].message;
    }
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
            toSentanceCase(msg.role)
          )}\n${msg.content.trim()}`
      )
      .join("\n");
  }

  thencb(cb: (chat: PureChatLLMChat) => any): PureChatLLMChat {
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

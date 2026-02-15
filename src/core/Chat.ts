import { App, EditorRange, Notice, parseLinktext, resolveSubpath, TFile } from 'obsidian';
import { Chatsysprompt, EmptyApiKey, Selectionsysprompt } from 'src/assets/constants';
import PureChatLLM from '../main';
import { ToolRegistry } from '../tools';
import { ImageGenerationTool, SmartConnectionsRetrievalTool } from '../tools/AITools';
import { GlobFilesTool, ListFoldersTool, SearchVaultTool } from '../tools/SearchTools';
import { PluginSettingsTool, TemplatesTool } from '../tools/SystemTools';
import { ActiveContextTool, ManageWorkspaceTool, ShowNoticeTool } from '../tools/UITools';
import { BacklinksTool, ReadNoteSectionTool, WriteNoteSectionTool } from '../tools/VaultTools';
import {
  ChatOptions,
  ChatRequestOptions,
  ChatResponse,
  MediaMessage,
  PureChatLLMAPI,
  RoleType,
  StreamDelta,
  ToolCall,
  ToolClassification,
  ToolDefinition,
} from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';
import { ChatMarkdownAdapter } from './ChatMarkdownAdapter';
import { ChatSession } from './ChatSession';
import { LLMService } from './LLMService';
import { WriteHandler } from 'src/utils/write-handler';
import { AskForAPI } from 'src/ui/Modals';

/**
 * Represents a chat session for the Pure Chat LLM Obsidian plugin.
 *
 * This class now acts as a facade over the new domain classes (ChatSession, ChatMarkdownAdapter, ToolRegistry).
 * It maintains backward compatibility while delegating to the new architecture.
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
  // Internal domain objects
  session: ChatSession;
  adapter: ChatMarkdownAdapter;

  // Keep existing public properties for compatibility
  plugin: PureChatLLM;
  console: BrowserConsole;
  endpoint: PureChatLLMAPI;
  parser = '# role: {role}';
  file: TFile;
  toolregistry: ToolRegistry = new ToolRegistry(this);
  llmService: LLMService;

  /**
   *
   * @param plugin
   */
  constructor(plugin: PureChatLLM) {
    this.plugin = plugin;
    this.console = new BrowserConsole(plugin.settings.debug, 'PureChatLLMChat');
    this.llmService = new LLMService(plugin.settings.debug);
    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    this.parser = this.plugin.settings.messageRoleFormatter;

    if (this.plugin.settings.agentMode) this.registerAvailableTools();

    // Initialize new domain objects
    const options: ChatOptions = {
      model: this.endpoint.defaultmodel,
      max_completion_tokens: this.plugin.settings.defaultmaxTokens,
      stream: true,
      tools: this.toolregistry.getNameList(),
      messages: [],
    };

    this.session = new ChatSession(options);
    this.adapter = new ChatMarkdownAdapter(
      this.parser,
      this.plugin.settings.useYAMLFrontMatter,
      this.plugin.settings.agentMode,
    );
  }

  /**
   *
   */
  private registerAvailableTools() {
    this.toolregistry
      .registerTool(ImageGenerationTool)
      .registerTool(GlobFilesTool)
      .registerTool(ReadNoteSectionTool)
      .registerTool(WriteNoteSectionTool)
      .registerTool(SearchVaultTool)
      .registerTool(BacklinksTool)
      .registerTool(ListFoldersTool)
      .registerTool(TemplatesTool)
      .registerTool(SmartConnectionsRetrievalTool)
      .registerTool(ManageWorkspaceTool)
      .registerTool(ActiveContextTool)
      .registerTool(ShowNoticeTool)
      .registerTool(PluginSettingsTool);
    /* .registerTool(SunoTool) */
    if (!this.plugin.settings.useImageGeneration)
      this.toolregistry.disable(ImageGenerationTool._name);
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
  getMarkdown(): string {
    return this.adapter.serialize(this.session);
  }

  /**
   *
   */
  updateEndpointFromModel() {
    const { ModelsOnEndpoint, endpoints } = this.plugin.settings;
    const endpointName = Object.keys(ModelsOnEndpoint).find(name =>
      ModelsOnEndpoint[name].includes(this.session.options.model),
    );
    if (endpointName) {
      this.endpoint = endpoints.find(e => e.name === endpointName) ?? this.endpoint;
    }
    return this;
  }

  /**
   *
   * @param classification
   */
  isEnabled(classification: string): boolean {
    if (!this.session.options.tools) return false;
    if (Array.isArray(this.session.options.tools)) {
      return this.session.options.tools.some(
        (t: string) => this.toolregistry.classificationForTool(t) === classification,
      );
    }
    return this.toolregistry.isClassificationEnabled(classification as ToolClassification);
  }

  /**
   *
   */
  cleanUpChat() {
    this.session.cleanUpChat(this.plugin.settings.SystemPrompt);
    return this;
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
  setMarkdown(markdown: string) {
    // make this chainable
    const defaultOptions: ChatOptions = {
      model: this.endpoint.defaultmodel,
      max_completion_tokens: this.plugin.settings.defaultmaxTokens,
      stream: true,
      tools: this.toolregistry.getNameList(),
      messages: [],
    };

    this.session = this.adapter.parse(markdown, defaultOptions, this.plugin.settings.SystemPrompt);
    if (this.plugin.settings.removeEmptyMessages) this.cleanUpChat();

    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    this.updateEndpointFromModel();
    return this;
  }

  /**
   * Sets the model to be used and updates the options with the provided model.
   *
   * @param modal - The name of the model to set.
   * @returns The current instance of the class for method chaining.
   */
  setModel(modal: string) {
    this.session.options.model = modal;
    this.updateEndpointFromModel();
    return this;
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
   * @param {...any} messages
   */
  appendMessage(...messages: { role: RoleType; content: string; cline?: EditorRange }[]) {
    messages.forEach(message => {
      if (
        this.plugin.settings.autoConcatMessagesFromSameRole &&
        this.session.messages[this.session.messages.length - 1]?.role === message.role
      ) {
        this.session.messages[this.session.messages.length - 1].content += message.content;
      } else {
        this.session.appendMessage({ role: message.role, content: message.content.trim() });
      }
    });
    return this;
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
  async getChatGPTinstructions(activeFile: TFile, app: App): Promise<ChatRequestOptions> {
    this.file = activeFile;

    const messages = await Promise.all(
      this.session.messages.map(async ({ role, content }) => ({
        role: role,
        content: await this.resolveContentRecursive(
          content,
          activeFile,
          app,
          role,
          new Set<string>(),
          0,
        ),
      })),
    );

    // For Gemini endpoint: ensure at least one user message exists
    if (
      messages.length === 1 &&
      messages[0].role === 'system' &&
      this.endpoint.endpoint.includes('generativelanguage.googleapis.com')
    ) {
      messages.push({
        role: 'user',
        content: 'Introduce yourself.',
      });
    }

    const tools: ToolDefinition[] | undefined = this.session.options.tools
      ?.map(t => this.toolregistry.getTool(t)?.getDefinition())
      .filter(t => t !== undefined);

    // return the whole object sent to the API
    return {
      ...this.session.options,
      messages,
      tools,
    };
  }

  /**
   * Converts an ArrayBuffer to a base64 string, processing data in chunks to avoid stack overflow
   *
   * @param data - Binary data as ArrayBuffer
   * @returns Base64-encoded string
   */
  private arrayBufferToBase64(data: ArrayBuffer): string {
    const uint8Array = new Uint8Array(data);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      // TypeScript doesn't recognize Uint8Array as array-like for String.fromCharCode.apply()
      // Cast is safe because Uint8Array elements are valid charCodes (0-255)
      binaryString += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binaryString);
  }

  /**
   * Recursively resolves [[links]], images, and audio in content
   *
   * @param markdown - Content to resolve
   * @param activeFile - Current file context
   * @param app - Obsidian app instance
   * @param role - Message role (user/assistant/system)
   * @param visited - Set of visited file paths (cycle detection)
   * @param depth - Current recursion depth
   * @returns Resolved content as string or MediaMessage array
   */
  private async resolveContentRecursive(
    markdown: string,
    activeFile: TFile,
    app: App,
    role: RoleType,
    visited: Set<string>,
    depth: number,
  ): Promise<MediaMessage[] | string> {
    const maxDepth = this.plugin.settings.maxRecursionDepth || 10;

    if (depth >= maxDepth) return markdown;

    // Match [[link]] patterns - allow whitespace on the line (matches original BlueFileResolver behavior)
    const regex = /^\s*!?\[\[([^\]]+)\]\]\s*$/gim;
    const matches = Array.from(markdown.matchAll(regex));
    if (matches.length === 0) return markdown;

    // Check if there is any text outside of the matches
    const textOutsideMatches = markdown.replace(regex, '').replace(/---/g, '').trim();
    const hasText = textOutsideMatches.length > 0;

    const resolved: MediaMessage[] = await Promise.all(
      matches.map(async ([originalLink, link]) => {
        const { subpath, path } = parseLinktext(link);
        const file = app.metadataCache.getFirstLinkpathDest(path, activeFile.path);

        if (!file) return { type: 'text', text: originalLink };

        // Cycle detection
        if (visited.has(file.path)) {
          return { type: 'text', text: `[Circular reference: ${file.path}]` };
        }

        // Handle subpaths (sections/blocks)
        if (subpath) {
          const cache = app.metadataCache.getFileCache(file);
          const ref = cache && resolveSubpath(cache, subpath);
          if (ref) {
            const text = await app.vault.cachedRead(file);
            const sectionContent = text.substring(ref.start.offset, ref.end?.offset).trim();

            visited.add(file.path);
            const resolved = await this.resolveContentRecursive(
              sectionContent,
              file,
              app,
              role,
              visited,
              depth + 1,
            );
            visited.delete(file.path);

            // If section resolves to media array, fall back to original text
            // (section refs are typically used in text context, not for pure media embedding)
            return { type: 'text', text: typeof resolved === 'string' ? resolved : sectionContent };
          }
          return { type: 'text', text: originalLink };
        }

        const ext = file.extension.toLowerCase();

        // Handle images
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) && role === 'user') {
          const data = await app.vault.readBinary(file);
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
          const base64 = this.arrayBufferToBase64(data);
          return { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } };
        }

        // Handle audio
        if (['mp3', 'wav'].includes(ext) && role === 'user') {
          const data = await app.vault.readBinary(file);
          const base64 = this.arrayBufferToBase64(data);
          return {
            type: 'input_audio',
            input_audio: { data: base64, format: ext as 'wav' | 'mp3' },
          };
        }

        // Handle text files - recurse
        const content = await app.vault.cachedRead(file);
        visited.add(file.path);
        const resolvedContent = await this.resolveContentRecursive(
          content,
          file,
          app,
          role,
          visited,
          depth + 1,
        );
        visited.delete(file.path);

        // If file resolves to media array, treat as empty text in this context
        // (inline file refs are typically used for text content, not pure media)
        return { type: 'text', text: typeof resolvedContent === 'string' ? resolvedContent : '' };
      }),
    );

    // If no surrounding text and we have media, return as array
    if (!hasText && resolved.some(r => r.type !== 'text')) {
      return resolved;
    }

    // Combine into single string
    const parts: string[] = [];
    let lastIndex = 0;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const start = match.index || 0;

      if (start > lastIndex) {
        parts.push(markdown.slice(lastIndex, start));
      }

      const item = resolved[i];
      if (item.type === 'text') {
        parts.push(item.text || '');
      }

      lastIndex = start + match[0].length;
    }

    if (lastIndex < markdown.length) {
      parts.push(markdown.slice(lastIndex));
    }

    return parts.join('');
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
  async processChatWithTemplate(templatePrompt: string) {
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: 'assistant', content: '' });
    }
    // Remove trailing empty message if present
    if (!this.session.messages[this.session.messages.length - 1]?.content.trim()) {
      this.session.messages.pop();
    }
    this.file = this.file || this.plugin.app.workspace.getActiveFile();

    if (this.plugin.settings.resolveFilesForChatAnalysis) {
      this.session.messages = await Promise.all(
        this.session.messages.map(async ({ role, content }) => {
          const resolved = await this.resolveContentRecursive(
            content,
            this.file,
            this.plugin.app,
            role,
            new Set<string>(),
            0,
          );
          // Convert to string if it's a MediaMessage array (flatten to text representation)
          const resolvedContent =
            typeof resolved === 'string'
              ? resolved
              : resolved.map(m => (m.type === 'text' ? m.text : `[${m.type}]`)).join('');
          return { role, content: resolvedContent };
        }),
      );
    }

    new Notice('Generating chat response from template...');
    const messages: { role: RoleType; content: string }[] = [
      { role: 'system', content: Chatsysprompt },
      { role: 'user', content: `<Conversation>\n${this.chatText}\n\n</Conversation>` },
      { role: 'user', content: templatePrompt },
    ];

    const options = { ...this.session.options, messages };
    delete options.tools;
    return this.sendChatRequest(options as ChatRequestOptions).then(r => ({
      role: 'assistant',
      content: (r.content || '').replace(/^<Conversation>|<\/Conversation>$/gi, '').trim(),
    }));
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
   * @param fileText
   * @returns A Promise resolving to the LLM's response containing the processed markdown,
   *          or an empty response if no text is selected.
   */
  selectionResponse(templatePrompt: string, selectedText: string, fileText?: string) {
    if (!selectedText) return Promise.resolve({ role: 'assistant', content: selectedText });
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: 'assistant', content: selectedText });
    }
    this.initSelectionResponse(templatePrompt, selectedText, fileText);

    const options = { ...this.session.options, messages: this.session.messages };
    delete options.tools;

    return this.sendChatRequest(options as ChatRequestOptions).then(r => ({
      role: 'assistant',
      content: (r.content || '').replace(/^<Selection>|<\/Selection>$/gi, '').trim(),
    }));
  }

  initSelectionResponse(templatePrompt: string, selectedText: string, fileText?: string) {
    this.session.messages = [
      {
        role: 'system',
        content: `${Selectionsysprompt}${
          fileText
            ? `\n\n---\n\nHere's the whole file that's being edited:\n<Markdown>\n${fileText}\n</Markdown>`
            : ''
        }`,
      },
      { role: 'user', content: `<Selection>${selectedText}</Selection>` },
      { role: 'user', content: templatePrompt },
    ];

    this.session.options.tools = [];
    return this;
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
  completeChatResponse(
    file: TFile,
    streamcallback?: (textFragment: { content: string }) => Promise<boolean>,
  ): Promise<this> {
    if (this.endpoint.apiKey === EmptyApiKey) {
      return Promise.resolve(this);
    }
    return this.getChatGPTinstructions(file, this.plugin.app)
      .then(options => this.sendChatRequest(options, streamcallback))
      .then(content => {
        this.appendMessage({
          role: content.role,
          content: content.content || '',
        }).appendMessage({
          role: 'user',
          content: '',
        });
        // Add the model to the endpoint's model list if not already present
        const models = (this.plugin.settings.ModelsOnEndpoint[this.endpoint.name] ??= []);
        if (!models.includes(this.session.options.model)) {
          models.push(this.session.options.model);
          void this.plugin.saveSettings();
        }
        return this;
      })
      .catch(error => {
        new Notice('Error in chat completion. Check console for details.');
        this.plugin.console.error(`Error in chat completion:`, error);
        return this;
      });
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
    options: ChatRequestOptions,
    streamcallback?: (textFragment: StreamDelta) => Promise<boolean>,
  ): Promise<ChatResponse> {
    const response = await this.llmService.fetchResponse(
      this.endpoint,
      options,
      status => this.plugin.status(status),
      streamcallback,
    );

    if (response.tool_calls) {
      if (await this.handleToolCalls(response.tool_calls, options, streamcallback, response)) {
        return this.sendChatRequest(options, streamcallback);
      }
    }
    return response;
  }

  /**
   *
   */
  reverseRoles() {
    this.session.reverseRoles();
    return this;
  }

  /**
   *
   * @param toolCalls
   * @param options
   * @param streamcallback
   * @param assistantMessage
   * @param assistantMessage.role
   * @param assistantMessage.content
   * @param assistantMessage.tool_calls
   */
  async handleToolCalls(
    toolCalls: ToolCall[],
    options: ChatRequestOptions,
    streamcallback?: (textFragment: StreamDelta) => Promise<boolean>,
    assistantMessage?: { role: RoleType; content?: string | null; tool_calls?: ToolCall[] },
  ): Promise<boolean> {
    this.toolregistry.setCallBack(streamcallback);
    return this.toolregistry.executeToolCalls(toolCalls, this.session, options, assistantMessage);
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
  getAllModels(): Promise<string[]> {
    const { name: endpointName, endpoint } =
      this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    const cached = this.plugin.settings.ModelsOnEndpoint[endpointName];
    if (cached?.length) return Promise.resolve(cached);
    this.console.log(`Fetching models from ${endpointName} API...`);
    // eslint-disable-next-line no-restricted-globals
    return fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: this.llmService.getHeaders(this.endpoint),
    })
      .then(response => response.json())
      .then(data => {
        return (this.plugin.settings.ModelsOnEndpoint[endpointName] = (
          data as { data: { id: string }[] }
        ).data
          .map(item => item.id)
          .map(id => id.replace(/.+\//g, '') || id));
      })
      .catch(error => {
        this.console.error('Error fetching models:', error);
        return [];
      });
  }

  // Instance method: convert chat back to markdown
  /**
   * Constructs a formatted string representation of all chat messages.
   * Each message is prefixed with its role in title case and followed by its content.
   * Messages are concatenated into a single string, separated by newlines.
   *
   * @returns {string} A formatted string containing all chat messages.
   */
  get chatText(): string {
    return this.session.getChatText(role => this.adapter.parseRole(role));
  }

  /**
   *
   * @param cb
   */
  thencb(cb: (chat: this) => unknown): this {
    cb(this);
    return this;
  }
}

export async function completeChatResponse(plugin: PureChatLLM, writeHandler: WriteHandler) {
  const editorcontent = await writeHandler.getValue();

  const chat = new PureChatLLMChat(plugin).setMarkdown(editorcontent);
  const endpoint = plugin.settings.endpoints[plugin.settings.endpoint];
  if (endpoint.apiKey == EmptyApiKey) {
    new AskForAPI(plugin.app, plugin).open();
    return;
  }

  if (
    chat.session.messages[chat.session.messages.length - 1].content === '' &&
    chat.session.validChat &&
    plugin.settings.AutoReverseRoles
  ) {
    if (chat.session.messages.pop()?.role == 'user') chat.reverseRoles();
  }
  await writeHandler.write(chat.getMarkdown());

  if (!chat.session.validChat) return;

  plugin.isresponding = true;

  await writeHandler.appendContent(`\n${chat.adapter.parseRole('assistant...' as RoleType)}\n`);
  chat
    .completeChatResponse(writeHandler.file, async e => {
      await writeHandler.appendContent(e.content);
      return true;
    })
    .then(async chat => {
      plugin.isresponding = false;
      if (
        plugin.settings.AutogenerateTitle > 0 &&
        chat.session.messages.length >= plugin.settings.AutogenerateTitle &&
        (writeHandler.file?.name.includes('Untitled') || / \d+\.md$/.test(writeHandler.file?.name))
      ) {
        await generateTitle(plugin, writeHandler);
      }
      await writeHandler.write(chat.getMarkdown());
    })
    .catch(error => plugin.console.error(error))
    .finally(() => {
      plugin.isresponding = false;
      return;
    });
  return chat;
}

export async function generateTitle(plugin: PureChatLLM, writeHandler: WriteHandler) {
  const activeFile = writeHandler.file;
  if (activeFile)
    void new PureChatLLMChat(plugin)
      .setMarkdown(await writeHandler.getValue())
      .processChatWithTemplate(plugin.settings.chatTemplates['Conversation titler'])
      .then(title => {
        const sanitizedTitle = `${activeFile.parent?.path}/${title.content
          .replace(/^<think>[\s\S]+?<\/think>/gm, '') // Remove <think> tags for ollama
          .replace(/[^a-zA-Z0-9 !.,+\-_=]/g, '')
          .trim()}.${activeFile.extension}`;
        void plugin.app.fileManager.renameFile(activeFile, sanitizedTitle);
        new Notice(`File renamed to: ${sanitizedTitle}`);
      });
  else new Notice('No active file to rename.');
}

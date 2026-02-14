import { App, EditorRange, Notice, TFile } from 'obsidian';
import { Chatsysprompt, EmptyApiKey, Selectionsysprompt } from 'src/assets/constants';
import PureChatLLM from '../main';
import { ToolRegistry } from '../tools';
import {
  BacklinksTool,
  CreateNoteTool,
  DeleteNoteTool,
  PatchNoteTool,
  ReadFileTool,
  ReadNoteSectionTool,
  ReplaceInNoteTool,
  WriteNoteSectionTool,
} from '../tools/VaultTools';
import { GlobFilesTool, ListFoldersTool, SearchVaultTool } from '../tools/SearchTools';
import { ImageGenerationTool, SmartConnectionsRetrievalTool } from '../tools/AITools';
import { ActiveContextTool, ManageWorkspaceTool, ShowNoticeTool } from '../tools/UITools';
import { PluginSettingsTool, TemplatesTool } from '../tools/SystemTools';
import {
  ChatMessage,
  ChatOptions,
  ChatRequestOptions,
  ChatResponse,
  PureChatLLMAPI,
  RoleType,
  StreamDelta,
  ToolCall,
  ToolClassification,
  ToolDefinition,
} from '../types';
import { CodeContent } from '../ui/CodeHandling';
import { BrowserConsole } from '../utils/BrowserConsole';
import { toTitleCase } from '../utils/toTitleCase';
import { ResolutionContext } from './BlueFileResolver';
import { ChatMarkdownAdapter } from './ChatMarkdownAdapter';
import { ChatSession } from './ChatSession';
import { LLMService } from './LLMService';
import { ToolExecutor } from './ToolExecutor';

/**
 * Represents a chat session for the Pure Chat LLM Obsidian plugin.
 *
 * This class now acts as a facade over the new domain classes (ChatSession, ChatMarkdownAdapter, ToolExecutor).
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
  private session: ChatSession;
  private adapter: ChatMarkdownAdapter;
  private toolExecutor: ToolExecutor;

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
    this.toolExecutor = new ToolExecutor(this.toolregistry);
  }

  // Delegate to session for backward compatibility
  /**
   *
   */
  get options(): ChatOptions {
    return this.session.options;
  }
  /**
   *
   */
  set options(value: ChatOptions) {
    this.session.options = value;
  }

  /**
   *
   */
  get messages(): ChatMessage[] {
    return this.session.messages;
  }
  /**
   *
   */
  set messages(value: ChatMessage[]) {
    this.session.messages = value;
  }

  /**
   *
   */
  get clines(): EditorRange[] {
    return this.session.clines;
  }
  /**
   *
   */
  set clines(value: EditorRange[]) {
    this.session.clines = value;
  }

  /**
   *
   */
  get pretext(): string {
    return this.session.pretext;
  }
  /**
   *
   */
  set pretext(value: string) {
    this.session.pretext = value;
  }

  /**
   *
   */
  get validChat(): boolean {
    return this.session.validChat;
  }
  /**
   *
   */
  set validChat(value: boolean) {
    this.session.validChat = value;
  }

  /**
   *
   */
  private registerAvailableTools() {
    this.toolregistry
      .registerTool(ImageGenerationTool)
      .registerTool(CreateNoteTool)
      .registerTool(GlobFilesTool)
      .registerTool(ReadFileTool)
      .registerTool(ReadNoteSectionTool)
      .registerTool(WriteNoteSectionTool)
      .registerTool(SearchVaultTool)
      .registerTool(PatchNoteTool)
      .registerTool(BacklinksTool)
      .registerTool(ListFoldersTool)
      .registerTool(DeleteNoteTool)
      .registerTool(TemplatesTool)
      .registerTool(ReplaceInNoteTool)
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
  get markdown(): string {
    return this.adapter.serialize(this.session);
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
  set markdown(markdown: string) {
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
  }

  /**
   *
   */
  updateEndpointFromModel() {
    const { ModelsOnEndpoint, endpoints } = this.plugin.settings;
    const endpointName = Object.keys(ModelsOnEndpoint).find(name =>
      ModelsOnEndpoint[name].includes(this.options.model),
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
    if (!this.options.tools) return false;
    if (Array.isArray(this.options.tools)) {
      return this.options.tools.some(
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
   * Sets the markdown content for the current instance.
   *
   * @param markdown - The markdown string to set.
   * @returns The current instance to allow method chaining.
   */
  setMarkdown(markdown: string) {
    // make this chainable
    this.markdown = markdown;
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
   */
  static extractCodeBlockMD(markdown: string, language: string): string | null {
    return ChatMarkdownAdapter.extractCodeBlockMD(markdown, language);
  }

  /**
   * Extracts all code blocks from a given markdown string.
   *
   * @param markdown - The markdown string to extract code blocks from.
   * @returns An array of objects, where each object contains language and code.
   */
  static extractAllCodeBlocks(markdown: string): CodeContent[] {
    return ChatMarkdownAdapter.extractAllCodeBlocks(markdown);
  }

  /**
   * Replaces the content of a code block in a markdown string with new text.
   *
   * @param text - The original markdown string containing the code block.
   * @param language - The programming language of the code block to replace.
   * @param newText - The new text to insert into the code block.
   * @returns The modified markdown string with the updated code block content.
   */
  static changeCodeBlockMD(text: string, language: string, newText: string) {
    return ChatMarkdownAdapter.changeCodeBlockMD(text, language, newText);
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
        this.messages[this.messages.length - 1]?.role === message.role
      ) {
        this.messages[this.messages.length - 1].content += message.content;
      } else {
        this.session.appendMessage({
          role: message.role,
          content: message.content.trim(),
        });
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
   * @param context
   * @returns A promise that resolves to an object containing the resolved messages with their roles and content.
   */
  async getChatGPTinstructions(
    activeFile: TFile,
    app: App,
    context?: ResolutionContext,
  ): Promise<ChatRequestOptions> {
    this.file = activeFile;

    // Use the plugin's shared resolver instance
    const resolver = this.plugin.blueFileResolver;

    // Use provided context or create new one if blue file resolution is enabled
    if (!context && this.plugin.settings.blueFileResolution.enabled) {
      context = resolver.createContext(activeFile);
    }

    const messages = await Promise.all(
      this.messages.map(async ({ role, content }) => ({
        role: role,
        content: await resolver.resolveFilesWithImagesAndAudio(
          content,
          activeFile,
          app,
          role,
          context,
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

    const tools: ToolDefinition[] | undefined = this.options.tools
      ?.map(t => this.toolregistry.getTool(t)?.getDefinition())
      .filter(t => t !== undefined);

    // return the whole object sent to the API
    return {
      ...this.options,
      messages,
      tools,
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
  async processChatWithTemplate(templatePrompt: string) {
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: 'assistant', content: '' });
    }
    // Remove trailing empty message if present
    if (!this.messages[this.messages.length - 1]?.content.trim()) {
      this.messages.pop();
    }
    this.file = this.file || this.plugin.app.workspace.getActiveFile();

    if (this.plugin.settings.resolveFilesForChatAnalysis) {
      const resolver = this.plugin.blueFileResolver;
      this.messages = await Promise.all(
        this.messages.map(async ({ role, content }) => ({
          role,
          content: await resolver.resolveFiles(content, this.file, this.plugin.app),
        })),
      );
    }

    new Notice('Generating chat response from template...');
    const messages: { role: RoleType; content: string }[] = [
      { role: 'system', content: Chatsysprompt },
      { role: 'user', content: `<Conversation>\n${this.chatText}\n\n</Conversation>` },
      { role: 'user', content: templatePrompt },
    ];

    const options = { ...this.options, messages };
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

    const options = { ...this.options, messages: this.messages };
    delete options.tools;

    return this.sendChatRequest(options as ChatRequestOptions).then(r => ({
      role: 'assistant',
      content: (r.content || '').replace(/^<Selection>|<\/Selection>$/gi, '').trim(),
    }));
  }

  initSelectionResponse(templatePrompt: string, selectedText: string, fileText?: string) {
    this.messages = [
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

    this.options.tools = [];
    return this;
  }

  /**
   * Handles the process of completing a chat response by interacting with ChatGPT.
   *
   * @param file - The file object of type `TFile` that contains the context or data for the chat.
   * @param streamcallback - An optional callback function that processes text fragments as they are streamed.
   *                         The callback should return a boolean indicating whether to continue streaming.
   * @param context
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
    context?: ResolutionContext,
  ): Promise<this> {
    if (this.endpoint.apiKey === EmptyApiKey) {
      return Promise.resolve(this);
    }
    return this.getChatGPTinstructions(file, this.plugin.app, context)
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
        if (!models.includes(this.options.model)) {
          models.push(this.options.model);
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
   * @param msgs
   */
  filterOutUncalledToolCalls(
    msgs: {
      role: RoleType;
      content?: string;
      tool_call_id?: string;
      tool_calls?: ToolCall[];
    }[],
  ): {
    role: RoleType;
    content?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
  }[] {
    return this.toolExecutor.filterOutUncalledToolCalls(msgs);
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
    this.toolExecutor.setStreamCallback(streamcallback);
    return this.toolExecutor.executeToolCalls(toolCalls, this.session, options, assistantMessage);
  }

  /**
   * Attempts to parse a JSON string and return the resulting object.
   * If the parsing fails due to invalid JSON, it returns `null`.
   *
   * @param str - The JSON string to parse.
   * @returns The parsed object if successful, or `null` if parsing fails.
   */
  static tryJSONParse(str: string): unknown {
    return ChatMarkdownAdapter.tryJSONParse(str);
  }

  /**
   * Parses a JSON string into ChatOptions.
   *
   * @param str - The JSON string to parse.
   * @returns Partial ChatOptions object or null if parsing fails.
   */
  static parseChatOptions(str: string): Partial<ChatOptions> | null {
    return ChatMarkdownAdapter.parseChatOptions(str);
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
    return this.session.getChatText(role => this.parseRole(role));
  }

  /**
   *
   * @param role
   */
  parseRole(role: RoleType): string {
    return (JSON.parse(`"${this.parser}"`) as string).replace(/{role}/g, toTitleCase(role));
  }

  /**
   *
   */
  get regexForRoles() {
    return this.adapter.regexForRoles;
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

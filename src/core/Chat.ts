import {
  App,
  EditorRange,
  Notice,
  parseLinktext,
  parseYaml,
  resolveSubpath,
  stringifyYaml,
  TFile,
} from 'obsidian';
import PureChatLLM, { StreamNotice } from '../main';
import { ToolRegistry } from '../tools';
import { ActiveContextTool } from '../tools/ActiveContext';
import { BacklinksTool } from '../tools/Backlinks';
import { CreateNoteTool } from '../tools/CreateNote';
import { DeleteNoteTool } from '../tools/DeleteNote';
import { GlobFilesTool } from '../tools/GlobFiles';
import { ImageGenerationTool } from '../tools/ImageGen';
import { ListFoldersTool } from '../tools/ListFolders';
import { ManageWorkspaceTool } from '../tools/ManageWorkspace';
import { PatchNoteTool } from '../tools/PatchNote';
import { PluginSettingsTool } from '../tools/PluginSettings';
import { ReadFileTool } from '../tools/ReadFile';
import { ReplaceInNoteTool } from '../tools/ReplaceInNote';
import { SearchVaultTool } from '../tools/SearchVault';
import { ShowNoticeTool } from '../tools/ShowNotice';
import { SmartConnectionsRetrievalTool } from '../tools/SmartConnectionsRetrieval';
import { SunoTool } from '../tools/Suno';
import { TemplatesTool } from '../tools/Templates';
import {
  ChatMessage,
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
import { CodeContent } from '../ui/CodeHandling';
import { BrowserConsole } from '../utils/BrowserConsole';
import { toTitleCase } from '../utils/toTitleCase';
import { LLMService } from './LLMService';
import { BlueFileResolver } from './BlueFileResolver';
import { alloptions, Chatsysprompt, EmptyApiKey, Selectionsysprompt } from 'src/assets/constants';


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
  options: ChatOptions;
  messages: ChatMessage[] = [];
  clines: EditorRange[] = [];
  plugin: PureChatLLM;
  console: BrowserConsole;
  pretext = '';
  endpoint: PureChatLLMAPI;
  parser = '# role: {role}';
  validChat = true;
  file: TFile;
  toolregistry: ToolRegistry = new ToolRegistry(this);
  llmService: LLMService;

  constructor(plugin: PureChatLLM) {
    this.plugin = plugin;
    this.console = new BrowserConsole(plugin.settings.debug, 'PureChatLLMChat');
    this.llmService = new LLMService(plugin.settings.debug);
    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];

    if (this.plugin.settings.agentMode) this.registerAvailableTools();

    this.options = {
      model: this.endpoint.defaultmodel,
      max_completion_tokens: this.plugin.settings.defaultmaxTokens,
      stream: true,
      tools: this.toolregistry.getNameList(),
      messages: [],
    };
    this.parser = this.plugin.settings.messageRoleFormatter;
  }

  private registerAvailableTools() {
    this.toolregistry
      .registerTool(ImageGenerationTool)
      .registerTool(CreateNoteTool)
      .registerTool(GlobFilesTool)
      .registerTool(ReadFileTool)
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
      .registerTool(PluginSettingsTool)
      .registerTool(SunoTool);
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
    const options: Record<string, unknown> = { ...this.options };
    delete options.messages;
    if (!this.plugin.settings.agentMode) delete options.tools;

    const prechat = this.plugin.settings.useYAMLFrontMatter
      ? `---\n${stringifyYaml(options)}\n---\n${this.pretext
          .replace(/```json[\s\S]*?```/im, '')
          .replace(/---\n[\s\S]+?\n---/im, '')
          .trim()}`
      : PureChatLLMChat.changeCodeBlockMD(this.pretext, 'json', JSON.stringify(options, null, 2));

    return `${prechat.trim()}\n${this.chatText}`;
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
    markdown = '\n' + markdown.trim() + '\n'; // ensure newlines at start and end
    const matches = Array.from(markdown.matchAll(this.regexForRoles));

    this.pretext = matches[0] ? markdown.substring(0, matches[0].index).trim() : markdown;
    this.messages = matches.map((match, index) => {
      if (!match.index) {
        this.clines.push({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } });
        return {
          role: 'user',
          content: '',
        };
      }
      const contentStart = match.index + match[0].length;
      const contentEnd = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
      this.clines.push({
        from: { line: markdown.substring(0, contentStart).split('\n').length, ch: 0 },
        to: { line: markdown.substring(0, contentEnd).split('\n').length - 1, ch: 0 },
      });
      return {
        role: match[1].toLowerCase() as RoleType,
        content: markdown.substring(contentStart, contentEnd).trim(),
      };
    });

    this.endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (this.messages.length === 0) {
      // if the file has no # role: system|user|assistant|developer
      this.validChat = false;
      this.messages = [];
      this.appendMessage({
        role: 'system',
        content: this.plugin.settings.SystemPrompt,
      }).appendMessage({ role: 'user', content: this.pretext });
      this.pretext = '';
      return;
    }

    this.parsePretextOptions();
    this.updateEndpointFromModel();
  }

  private parsePretextOptions() {
    const optionsStr = PureChatLLMChat.extractCodeBlockMD(this.pretext, 'json');
    if (optionsStr) {
      this.options = { ...this.options, ...PureChatLLMChat.parseChatOptions(optionsStr) };
    } else {
      const yamlMatch = this.pretext.match(/^---\n([\s\S]+?)\n---/);
      if (yamlMatch) {
        try {
          const yaml: unknown = parseYaml(yamlMatch[1]);
          if (yaml && typeof yaml === 'object') {
            const allowedKeys = Object.keys(alloptions);
            const filteredOptions: Record<string, unknown> = {};
            for (const key of allowedKeys) {
              if (Object.prototype.hasOwnProperty.call(yaml, key)) {
                filteredOptions[key] = (yaml as Record<string, unknown>)[key];
              }
            }
            this.options = { ...this.options, ...filteredOptions };
          }
        } catch (e) {
          console.error('Error parsing frontmatter YAML:', e);
        }
      }
    }
  }

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

  isEnabled(classification: string): boolean {
    if (!this.options.tools) return false;
    if (Array.isArray(this.options.tools)) {
      return this.options.tools.some(
        (t: string) => this.toolregistry.classificationForTool(t) === classification,
      );
    }
    return this.toolregistry.isClassificationEnabled(classification as ToolClassification);
  }

  cleanUpChat() {
    // remove any empty messages except system
    const indicesToKeep: number[] = [];
    this.messages = this.messages.filter((msg, index) => {
      const keep = msg.role === 'system' || msg.content.trim() !== '';
      if (keep) indicesToKeep.push(index);
      return keep;
    });
    this.clines = indicesToKeep.map(i => this.clines[i]);

    // ensure first message is system
    if (this.messages[0]?.role !== 'system') {
      this.messages.unshift({
        role: 'system',
        content: this.plugin.settings.SystemPrompt,
      });
      this.clines.unshift({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } });
    } else {
      this.messages[0].content ||= this.plugin.settings.SystemPrompt;
    }
    // ensure last message is user and empty
    if (this.messages.length === 0 || this.messages[this.messages.length - 1].role !== 'user') {
      this.appendMessage({ role: 'user', content: '' });
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
    const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
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
  static extractAllCodeBlocks(markdown: string): CodeContent[] {
    const regex = /^```(\w*)\n([\s\S]*?)\n```/gm;
    const matches: { language: string; code: string }[] = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const [, language, code] = match;
      const lang = (language || 'plaintext').trim() || 'plaintext';
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
    const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
    if (!regex.test(text)) return `${text}\n\`\`\`${language}\n${newText}\n\`\`\``;
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
  appendMessage(...messages: { role: RoleType; content: string; cline?: EditorRange }[]) {
    messages.forEach(message =>
      this.plugin.settings.autoConcatMessagesFromSameRole &&
      this.messages[this.messages.length - 1]?.role === message.role
        ? (this.messages[this.messages.length - 1].content += message.content)
        : (this.messages.push({
            role: message.role,
            content: message.content.trim(),
          }),
          this.clines.push(message.cline || { from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } })),
    );
    return this;
  }

  /**
   * Resolves file links in a given markdown string by replacing them with the content
   * of the referenced files. If a file cannot be resolved, the original link is retained.
   *
   * @param markdown - The markdown string containing file links to resolve.
   * @param activeFile - The currently active file, used as a reference for resolving relative links.
   * @param app - The Obsidian application instance, providing access to the vault and metadata cache.
   * @param plugin - Optional plugin instance for blue file resolution support
   * @returns A promise that resolves to the markdown string with file links replaced by their content.
   *
   * @remarks
   * - File links are expected to be in the format `[[filename]]` or `![[filename]]`.
   * - If a file cannot be found, the original link will remain in the output.
   * - This function uses asynchronous operations to read file contents, so it returns a promise.
   * - If plugin is provided and blue file resolution is enabled, pending chats will be dynamically executed.
   */
  static async resolveFiles(
    markdown: string,
    activeFile: TFile,
    app: App,
    plugin?: PureChatLLM,
  ): Promise<string> {
    const regex = /^!?\[\[(.*?)\]\]$/gim;
    const matches = Array.from(markdown.matchAll(regex));
    const replacements: Promise<string>[] = [];

    // Check if blue file resolution is enabled
    const useBlueFileResolution = plugin?.settings.blueFileResolution.enabled;

    if (useBlueFileResolution && plugin) {
      // Use blue file resolver for dynamic chat execution
      const resolver = new BlueFileResolver(plugin);
      const context = resolver.createContext(activeFile);

      for (const match of matches) {
        const filename = match[1];
        const file = app.metadataCache.getFirstLinkpathDest(filename, activeFile.path);
        if (file instanceof TFile) {
          replacements.push(resolver.resolveFile(file, context, app));
        } else {
          replacements.push(Promise.resolve(match[0]));
        }
      }
    } else {
      // Original behavior: just read static file content
      for (const match of matches) {
        const filename = match[1];
        const file = app.metadataCache.getFirstLinkpathDest(filename, activeFile.path);
        if (file instanceof TFile) {
          replacements.push(app.vault.cachedRead(file));
        } else {
          replacements.push(Promise.resolve(match[0]));
        }
      }
    }

    if (replacements.length === 0) return markdown;

    const resolved = await Promise.all(replacements);
    let index = 0;
    const result = markdown.replace(regex, () => resolved[index++] || '');
    return result;
  }

  static getfileForLink(str: string, activeFile: TFile, app: App): TFile | null {
    return app.metadataCache.getFirstLinkpathDest(parseLinktext(str).path, activeFile.path);
  }

  /**
   * Major new function
   * Retrieves the content of a linked file or a specific subpath within a file in Obsidian.
   *
   * Given a link string, the currently active file, and the Obsidian app instance, this method:
   * - Parses the link to extract the file path and optional subpath.
   * - Resolves the file reference using Obsidian's metadata cache.
   * - If the file does not exist, returns the original link in double brackets.
   * - If a subpath is specified and found, returns the corresponding substring from the file.
   * - Otherwise, returns the entire file content (or dynamically generated if blue file resolution is enabled).
   *
   * @param str - The link string to resolve (e.g., "MyNote#Section").
   * @param activeFile - The currently active file, used as context for relative links.
   * @param app - The Obsidian app instance, providing access to the vault and metadata cache.
   * @param plugin - Optional plugin instance for blue file resolution support
   * @param context - Optional blue file resolution context (for recursive calls)
   * @returns A promise that resolves to the content of the linked file or subpath, or the original link if not found.
   */
  static async retrieveLinkContent(
    str: string,
    activeFile: TFile,
    app: App,
    plugin?: PureChatLLM,
    context?: import('./BlueFileResolver').ResolutionContext,
  ): Promise<string> {
    const { subpath, path } = parseLinktext(str);
    const file = app.metadataCache.getFirstLinkpathDest(path, activeFile.path);
    if (!file) return Promise.resolve(`[[${str}]]`);

    // If subpath is specified, return the specific section (no blue file resolution for subpaths)
    if (subpath) {
      const cache = app.metadataCache.getFileCache(file);
      const ref = cache && resolveSubpath(cache, subpath);
      if (ref) {
        const text = await app.vault.cachedRead(file);
        return text.substring(ref.start.offset, ref.end?.offset).trim();
      }
    }

    // Check if blue file resolution should be used
    if (plugin?.settings.blueFileResolution.enabled && context) {
      // Use blue file resolver
      const resolver = new BlueFileResolver(plugin);
      return resolver.resolveFile(file, context, app);
    } else if (plugin?.settings.blueFileResolution.enabled && !context) {
      // Create new context if not provided
      const resolver = new BlueFileResolver(plugin);
      const newContext = resolver.createContext(activeFile);
      return resolver.resolveFile(file, newContext, app);
    }

    // Default: just read the file
    return app.vault.cachedRead(file);
  }

  static async convertM4AToWav(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const audioBuffer = await audioContext.decodeAudioData(buffer);

    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer2 = new ArrayBuffer(length);
    const view = new DataView(buffer2);
    let pos = 0;

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    const channels = [];
    for (let i = 0; i < numOfChan; i++) channels.push(audioBuffer.getChannelData(i));

    let sampleIdx = 0;
    while (sampleIdx < audioBuffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][sampleIdx])); // clamp
        // bitwise OR 0 to truncate to integer
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      sampleIdx++;
    }

    return buffer2;
  }

  static async resolveFilesWithImagesAndAudio(
    markdown: string,
    activeFile: TFile,
    app: App,
    role: RoleType,
    plugin?: PureChatLLM,
    context?: import('./BlueFileResolver').ResolutionContext,
  ): Promise<MediaMessage[] | string> {
    const matches = Array.from(markdown.matchAll(/^!?\[\[([^\]]+)\]\]$/gm));

    const resolved: MediaMessage[] = await Promise.all(
      matches.map(async match => {
        const [originalLink, link] = match;
        const file = this.getfileForLink(link, activeFile, app);

        // Not found, return as text
        if (!(file instanceof TFile)) return { type: 'text', text: originalLink };

        const ext = file.extension.toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) && role === 'user') {
          const data = await app.vault.readBinary(file);
          const mime =
            ext === 'jpg'
              ? 'image/jpeg'
              : ext === 'jpeg'
                ? 'image/jpeg'
                : ext === 'png'
                  ? 'image/png'
                  : ext === 'gif'
                    ? 'image/gif'
                    : 'image/webp';
          const url = await this.arrayBufferToBase64DataURL(data, mime);
          return { type: 'image_url', image_url: { url } };
        }
        if (['mp3', 'wav', 'm4a'].includes(ext) && role === 'user') {
          let data = await app.vault.readBinary(file);
          let format = ext;
          if (ext === 'm4a') {
            data = await this.convertM4AToWav(data);
            format = 'wav';
          }
          const url = await this.arrayBufferToBase64DataURL(data, `audio/${format}`);
          return {
            type: 'input_audio',
            input_audio: {
              data: url.split(',')[1],
              format: format as 'wav' | 'mp3',
            },
          };
        }
        return {
          type: 'text',
          text: await this.retrieveLinkContent(link, activeFile, app, plugin, context),
        };
      }),
    );

    //get the surrounding text around the matches
    let lastIndex = 0;
    const allParts: MediaMessage[] = [];
    for (const match of matches) {
      const start = match.index ?? 0;
      const end = start + match[0].length;

      // Add text before the match
      if (start > lastIndex) {
        allParts.push({
          type: 'text',
          text: markdown.slice(lastIndex, start).trim(),
        });
      }

      // Add the resolved match
      const resolvedItem = resolved.shift();
      if (resolvedItem) allParts.push(resolvedItem);

      lastIndex = end;
    }
    // Add any remaining text after the last match
    if (lastIndex < markdown.length)
      allParts.push({
        type: 'text',
        text: markdown.slice(lastIndex).trim(),
      });

    const final = allParts.reduce((acc, item) => {
      const prev = acc[acc.length - 1];
      if (item.type === 'text' && prev?.type === 'text') {
        prev.text += `\n${item.text}`;
      } else {
        acc.push(item);
      }
      return acc;
    }, [] as MediaMessage[]);

    if (final.length === 0) return markdown; // If no valid parts, return original markdown

    if (final.length === 1 && final[0].type === 'text') return final[0].text; // If only one text part, return it directly

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
  async getChatGPTinstructions(activeFile: TFile, app: App): Promise<ChatRequestOptions> {
    this.file = activeFile;

    // Create blue file resolution context if enabled
    let context: import('./BlueFileResolver').ResolutionContext | undefined;
    if (this.plugin.settings.blueFileResolution.enabled) {
      const resolver = new BlueFileResolver(this.plugin);
      context = resolver.createContext(activeFile);
    }

    const messages = await Promise.all(
      this.messages.map(async ({ role, content }) => ({
        role: role,
        content: await PureChatLLMChat.resolveFilesWithImagesAndAudio(
          content,
          activeFile,
          app,
          role,
          this.plugin,
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

    if (this.plugin.settings.resolveFilesForChatAnalysis)
      this.messages = await Promise.all(
        this.messages.map(async ({ role, content }) => ({
          role,
          content: await PureChatLLMChat.resolveFiles(
            content,
            this.file,
            this.plugin.app,
            this.plugin,
          ),
        })),
      );

    new Notice('Generating chat response from template...');
    const messages: { role: RoleType; content: string }[] = [
      { role: 'system', content: Chatsysprompt },
      {
        role: 'user',
        content: `<Conversation>\n${this.chatText}\n\n</Conversation>`,
      },
      { role: 'user', content: templatePrompt },
    ];

    const options = { ...this.options, messages };
    delete options.tools;
    return this.sendChatRequest(
      options as ChatRequestOptions,
      new StreamNotice(this.plugin.app, 'Processing chat with template.').change,
    ).then(r => ({
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
   * @returns A Promise resolving to the LLM's response containing the processed markdown,
   *          or an empty response if no text is selected.
   */
  selectionResponse(templatePrompt: string, selectedText: string, fileText?: string) {
    if (!selectedText) return Promise.resolve({ role: 'assistant', content: selectedText });
    if (this.endpoint.apiKey === EmptyApiKey) {
      this.plugin.askForApiKey();
      return Promise.resolve({ role: 'assistant', content: selectedText });
    }
    //const systemprompt = `You are a ${templatePrompt.name}.`;
    const messages: { role: RoleType; content: string }[] = [
      ...((fileText
        ? [
            {
              role: 'system',
              content: `Here's the whole file that's being edited:\n<Markdown>\n${fileText}\n</Markdown>`,
            },
          ]
        : []) as { role: RoleType; content: string }[]),
      { role: 'system', content: Selectionsysprompt },
      {
        role: 'user',
        content: `<Selection>${selectedText}</Selection>`,
      },
      { role: 'user', content: templatePrompt },
    ];

    const options = { ...this.options, messages };
    delete options.tools;

    return this.sendChatRequest(
      options as ChatRequestOptions,
      new StreamNotice(this.plugin.app, 'Editing selection.').change,
    ).then(r => ({
      role: 'assistant',
      content: (r.content || '').replace(/^<Selection>|<\/Selection>$/gi, '').trim(),
    }));
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
    streamcallback?: (textFragment: { content: string }) => boolean,
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
    streamcallback?: (textFragment: StreamDelta) => boolean,
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

  reverseRoles() {
    this.messages = this.messages.map(msg => {
      if (msg.role === 'user') {
        msg.role = 'assistant';
      } else if (msg.role === 'assistant') {
        msg.role = 'user';
      }
      return msg;
    });
    return this;
  }

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
    const [agent, ...responses] = msgs;
    if (agent.tool_calls) {
      agent.tool_calls = agent.tool_calls.filter(call =>
        responses.some(i => i.tool_call_id === call.id),
      );
    }
    return [agent, ...responses];
  }

  async handleToolCalls(
    toolCalls: ToolCall[],
    options: ChatRequestOptions,
    streamcallback?: (textFragment: StreamDelta) => boolean,
    assistantMessage?: { role: RoleType; content?: string | null; tool_calls?: ToolCall[] },
  ): Promise<boolean> {
    for (const call of toolCalls) {
      const toolName = call.function.name;
      if (this.toolregistry.getTool(toolName)) {
        /* streamcallback?.({
          role: 'tool',
          content: `Executing ${toolName}...`,
        }); */

        this.toolregistry.setCallBack(streamcallback);
        // if arguments are not valid JSON, check if it's a duplicated call and only take the first half

        if (!PureChatLLMChat.tryJSONParse(call.function.arguments)) {
          const halfLength = Math.floor(call.function.arguments.length / 2);
          const firstHalf = call.function.arguments.slice(0, halfLength);
          const secondHalf = call.function.arguments.slice(halfLength);
          if (firstHalf === secondHalf) {
            call.function.arguments = firstHalf;
          }
        }
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const output = await this.toolregistry.executeTool(toolName, args);

        if (assistantMessage && typeof assistantMessage.role === 'string')
          this.appendMessage({
            role: assistantMessage.role,
            content: assistantMessage.content ?? '',
          });

        this.appendMessage({ role: 'tool', content: output ?? '' });

        options.messages.push(
          assistantMessage || { role: 'assistant', content: null, tool_calls: [call] },
          { role: 'tool', content: output, tool_call_id: call.id },
        );
        return true;
      }
    }
    return false;
  }

  static tryJSONParse(str: string): unknown {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.debug('JSON parse error:', e);
      return null;
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
    return this.messages
      .map(msg => `${this.parseRole(msg.role)}\n${msg.content.trim()}`)
      .join('\n');
  }

  parseRole(role: RoleType): string {
    return (JSON.parse(`"${this.parser}"`) as string).replace(/{role}/g, toTitleCase(role));
  }

  get regexForRoles() {
    return new RegExp(
      this.parser
        .replace(/([\^$*+?.()|[\]])/g, '\\$1')
        .replace(/{role}/g, '(system|user|assistant|developer|tool)'),
      'gim',
    );
  }

  thencb(cb: (chat: this) => unknown): this {
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

  static parseChatOptions(str: string): Partial<ChatOptions> | null {
    try {
      return JSON.parse(str) as Partial<ChatOptions>;
    } catch (e) {
      console.debug('JSON parse error:', e);
      return null;
    }
  }
}

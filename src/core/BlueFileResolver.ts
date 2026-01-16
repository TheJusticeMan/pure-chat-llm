import { App, Notice, parseLinktext, resolveSubpath, TFile } from 'obsidian';
import PureChatLLM from '../main';
import { PureChatLLMChat } from './Chat';
import { BrowserConsole } from '../utils/BrowserConsole';
import { MediaMessage, RoleType, ResolutionEvent } from '../types';

/**
 * Represents a node in the file resolution tree.
 * Each node tracks a file being resolved and its relationship to parent nodes.
 */
class ResolutionTreeNode {
  /** The file being resolved at this node */
  public readonly file: TFile;
  /** Parent node in the resolution tree (null for root) */
  public readonly parent: ResolutionTreeNode | null;
  /** Current depth in the tree (0 for root) */
  public readonly depth: number;

  constructor(file: TFile, parent: ResolutionTreeNode | null = null) {
    this.file = file;
    this.parent = parent;
    this.depth = parent ? parent.depth + 1 : 0;
  }

  /**
   * Checks if the given file path exists in this node's ancestor chain.
   * This is used for cycle detection.
   */
  hasAncestor(filePath: string): boolean {
    if (this.file.path === filePath) {
      return true;
    }
    return this.parent ? this.parent.hasAncestor(filePath) : false;
  }

  /**
   * Creates a child node for the given file.
   */
  createChild(file: TFile): ResolutionTreeNode {
    return new ResolutionTreeNode(file, this);
  }
}

/**
 * Interface for tracking resolution context during recursive chat execution
 */
export interface ResolutionContext {
  /** Current node in the resolution tree */
  currentNode: ResolutionTreeNode;
  /** Cache of resolved chat responses keyed by file path (stores Promises for parallel resolution) */
  cache: Map<string, Promise<string>>;
  /** The root file that initiated the resolution */
  rootFile: TFile;
}

/**
 * BlueFileResolver handles recursive, dynamic resolution of [[note]] links.
 * If a linked file is a pending chat (ends with a user message), it executes
 * that chat and uses the generated response instead of the static content.
 *
 * Features:
 * - Cycle detection to prevent infinite loops
 * - Depth limiting to prevent runaway recursion
 * - Per-invocation caching to avoid redundant API calls
 * - Configurable intermediate result persistence
 *
 * Architecture:
 * - Uses a tree data structure (ResolutionTreeNode) to track file resolution hierarchy
 * - Each node knows its parent, enabling efficient ancestor lookup for cycle detection
 * - Each parallel branch gets its own tree node with proper parent linkage
 * - Cache is shared across all branches for deduplication
 * - Cache check validates ancestor chain to detect cycles (A→B→A)
 * - Siblings (A→B, A→C) each have independent tree nodes, preventing false positives
 */
export class BlueFileResolver {
  private console: BrowserConsole;
  private eventListeners: Array<(event: ResolutionEvent) => void> = [];

  constructor(private plugin: PureChatLLM) {
    this.console = new BrowserConsole(plugin.settings.debug, 'BlueFileResolver');
  }

  /**
   * Register a callback to receive resolution events
   */
  onResolutionEvent(callback: (event: ResolutionEvent) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * Unregister a resolution event callback
   */
  offResolutionEvent(callback: (event: ResolutionEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
  }

  /**
   * Emit a resolution event to all registered listeners
   */
  private emitEvent(event: ResolutionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.console.error('Error in resolution event listener:', error);
      }
    });
  }

  /**
   * Creates a new resolution context for a top-level invocation
   */
  createContext(rootFile: TFile): ResolutionContext {
    return {
      currentNode: new ResolutionTreeNode(rootFile),
      cache: new Map<string, Promise<string>>(),
      rootFile,
    };
  }

  /**
   * Determines if a file is a pending chat (ends with a user message).
   * A pending chat is one that requires execution to get a response.
   *
   * @param content - The file content to analyze
   * @param chat - The parsed chat instance
   * @returns true if the file is a pending chat
   */
  isPendingChat(content: string, chat: PureChatLLMChat): boolean {
    // Check if the file has valid chat structure
    if (!chat.validChat || chat.messages.length === 0) {
      return false;
    }

    // Get the last message
    const lastMessage = chat.messages[chat.messages.length - 1];

    // A pending chat ends with a user message that has content
    // or ends with a user message with empty content (waiting for response)
    return lastMessage.role === 'user';
  }

  /**
   * Recursively resolves a file, executing pending chats if necessary.
   *
   * @param file - The file to resolve
   * @param context - The resolution context
   * @param app - The Obsidian app instance
   * @returns The resolved content (either static or dynamically generated)
   */
  async resolveFile(file: TFile, context: ResolutionContext, app: App): Promise<string> {
    const { blueFileResolution } = this.plugin.settings;

    // Check if feature is disabled
    if (!blueFileResolution.enabled) {
      return app.vault.cachedRead(file);
    }

    // Emit start event
    this.emitEvent({
      type: 'start',
      filePath: file.path,
      parentPath: context.currentNode.parent?.file.path || null,
      depth: context.currentNode.depth,
      status: 'resolving',
      isPendingChat: false, // Will be updated later
      timestamp: Date.now(),
    });

    // Check cache FIRST for existing Promise - this handles deduplication for siblings/parallel references
    if (blueFileResolution.enableCaching && context.cache.has(file.path)) {
      // Check if this file is in our ancestor chain using tree structure - if so, it's a cycle
      if (context.currentNode.hasAncestor(file.path)) {
        const error = `[Blue File Resolution] Circular dependency detected: ${file.path}`;
        this.console.error(error);
        new Notice(error);
        this.emitEvent({
          type: 'cycle-detected',
          filePath: file.path,
          parentPath: context.currentNode.parent?.file.path || null,
          depth: context.currentNode.depth,
          status: 'cycle-detected',
          isPendingChat: false,
          error: 'Circular dependency',
          timestamp: Date.now(),
        });
        return `[[${file.path}]] (Error: Circular dependency)`;
      }
      this.console.log(`[Blue File Resolution] Cache hit for: ${file.path}`);
      this.emitEvent({
        type: 'cache-hit',
        filePath: file.path,
        parentPath: context.currentNode.parent?.file.path || null,
        depth: context.currentNode.depth,
        status: 'cached',
        isPendingChat: false,
        timestamp: Date.now(),
      });
      return await context.cache.get(file.path)!;
    }

    // Check for cycles in ancestor chain - only for files we're about to resolve
    if (context.currentNode.hasAncestor(file.path)) {
      const error = `[Blue File Resolution] Circular dependency detected: ${file.path}`;
      this.console.error(error);
      new Notice(error);
      this.emitEvent({
        type: 'cycle-detected',
        filePath: file.path,
        parentPath: context.currentNode.parent?.file.path || null,
        depth: context.currentNode.depth,
        status: 'cycle-detected',
        isPendingChat: false,
        error: 'Circular dependency',
        timestamp: Date.now(),
      });
      return `[[${file.path}]] (Error: Circular dependency)`;
    }

    // Check depth limit using tree node depth
    if (context.currentNode.depth >= blueFileResolution.maxDepth) {
      const warning = `[Blue File Resolution] Max depth (${blueFileResolution.maxDepth}) reached at: ${file.path}`;
      this.console.log(warning);
      this.emitEvent({
        type: 'depth-limit',
        filePath: file.path,
        parentPath: context.currentNode.parent?.file.path || null,
        depth: context.currentNode.depth,
        status: 'complete',
        isPendingChat: false,
        timestamp: Date.now(),
      });
      return app.vault.cachedRead(file);
    }

    // Create a child node in the tree for this file
    const childNode = context.currentNode.createChild(file);

    // Create child context with the new tree node
    const childContext: ResolutionContext = {
      ...context,
      currentNode: childNode,
    };

    // Create the resolution Promise and start execution immediately.
    const resolutionPromise = this.resolveFileInternal(file, childContext, app);

    // Store Promise in cache for concurrent resolution deduplication.
    if (blueFileResolution.enableCaching) {
      context.cache.set(file.path, resolutionPromise);
    }

    try {
      // Await the resolution
      const result = await resolutionPromise;
      return result;
    } catch (error) {
      // On error, remove the failed Promise from cache to allow retry
      if (blueFileResolution.enableCaching) {
        context.cache.delete(file.path);
      }
      throw error;
    }
  }

  /**
   * Internal method that performs the actual file resolution logic.
   * Separated from resolveFile to enable Promise-based caching.
   *
   * @param file - The file to resolve
   * @param context - The resolution context
   * @param app - The Obsidian app instance
   * @returns The resolved content
   */
  private async resolveFileInternal(
    file: TFile,
    context: ResolutionContext,
    app: App,
  ): Promise<string> {
    const { blueFileResolution } = this.plugin.settings;

    try {
      // Read the file content
      const content = await app.vault.cachedRead(file);

      // Create a chat instance to parse the file
      const chat = new PureChatLLMChat(this.plugin);
      chat.setMarkdown(content);

      // Check if this is a pending chat
      const isPending = this.isPendingChat(content, chat);
      const isChatFile = chat.validChat && chat.messages.length > 0;

      if (!isPending) {
        this.console.log(`[Blue File Resolution] Not a pending chat: ${file.path}`);
        // Not a pending chat, resolve links within it recursively
        const resolved = await this.resolveLinksInContent(content, file, context, app);

        // Emit complete event
        this.emitEvent({
          type: 'complete',
          filePath: file.path,
          parentPath: context.currentNode.parent?.file.path || null,
          depth: context.currentNode.depth,
          status: 'complete',
          isPendingChat: false,
          isChatFile,
          timestamp: Date.now(),
        });

        return resolved;
      }

      this.console.log(`[Blue File Resolution] Executing pending chat: ${file.path}`);

      // It's a pending chat - execute it
      // Note: We pass the context to completeChatResponse so that getChatGPTinstructions
      // can use resolveFilesWithImagesAndAudio with proper cycle detection, depth tracking,
      // and caching. This ensures images and audio files are handled correctly.

      // Execute the chat (without streaming for intermediate resolutions)
      const response = await chat.completeChatResponse(file, undefined, context);

      // Get the assistant's response (second to last message, since completeChatResponse adds an empty user message)
      const assistantMessage =
        response.messages.length >= 2
          ? response.messages[response.messages.length - 2]
          : response.messages[response.messages.length - 1];

      const resolvedContent = assistantMessage?.content || '';

      // Write intermediate results if configured (and not root file)
      if (blueFileResolution.writeIntermediateResults && file.path !== context.rootFile.path) {
        await app.vault.modify(file, response.markdown);
        this.console.log(`[Blue File Resolution] Wrote intermediate result to: ${file.path}`);
      }

      // Emit complete event
      this.emitEvent({
        type: 'complete',
        filePath: file.path,
        parentPath: context.currentNode.parent?.file.path || null,
        depth: context.currentNode.depth,
        status: 'complete',
        isPendingChat: true,
        isChatFile: true,
        timestamp: Date.now(),
      });

      return resolvedContent;
    } catch (error) {
      this.console.error(`[Blue File Resolution] Error resolving file ${file.path}:`, error);

      // Emit error event
      this.emitEvent({
        type: 'error',
        filePath: file.path,
        parentPath: context.currentNode.parent?.file.path || null,
        depth: context.currentNode.depth,
        status: 'error',
        isPendingChat: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });

      return `[[${file.path}]] (Error: ${error instanceof Error ? error.message : 'Unknown error'})`;
    }
  }

  /**
   * Resolves all [[link]]s in the given content, recursively executing pending chats.
   *
   * @param content - The markdown content containing links
   * @param activeFile - The current file (for relative link resolution)
   * @param context - The resolution context
   * @param app - The Obsidian app instance
   * @returns The content with all links resolved
   */
  async resolveLinksInContent(
    content: string,
    activeFile: TFile,
    context: ResolutionContext,
    app: App,
  ): Promise<string> {
    // Match [[link]] patterns (whole line only, as per original implementation)
    const regex = /^!?\[\[(.*?)\]\]$/gim;
    const matches = Array.from(content.matchAll(regex));

    if (matches.length === 0) {
      return content;
    }

    // Resolve each link
    // Each sibling gets its own tree branch automatically via resolveFile's createChild
    // No need to manually copy parent chain - the tree structure handles this
    const replacements: Promise<string>[] = [];
    for (const match of matches) {
      const linkText = match[1];
      const file = app.metadataCache.getFirstLinkpathDest(linkText, activeFile.path);

      if (file instanceof TFile) {
        // Recursively resolve the file - it will create its own tree node
        replacements.push(this.resolveFile(file, context, app));
      } else {
        // File not found, keep original link
        replacements.push(Promise.resolve(match[0]));
      }
    }

    // Wait for all resolutions
    const resolved = await Promise.all(replacements);

    // Replace links with resolved content
    let index = 0;
    const result = content.replace(regex, () => resolved[index++] || '');

    return result;
  }

  /**
   * Resolves file links in a given markdown string by replacing them with the content
   * of the referenced files. Supports both static content and dynamic chat execution.
   *
   * @param markdown - The markdown string containing file links to resolve.
   * @param activeFile - The currently active file, used as a reference for resolving relative links.
   * @param app - The Obsidian application instance, providing access to the vault and metadata cache.
   * @returns A promise that resolves to the markdown string with file links replaced by their content.
   */
  async resolveFiles(markdown: string, activeFile: TFile, app: App): Promise<string> {
    const regex = /^!?\[\[(.*?)\]\]$/gim;
    const matches = Array.from(markdown.matchAll(regex));
    const replacements: Promise<string>[] = [];

    // Check if blue file resolution is enabled
    if (this.plugin.settings.blueFileResolution.enabled) {
      // Use blue file resolver for dynamic chat execution
      const context = this.createContext(activeFile);

      for (const match of matches) {
        const filename = match[1];
        const file = app.metadataCache.getFirstLinkpathDest(filename, activeFile.path);
        if (file instanceof TFile) {
          replacements.push(this.resolveFile(file, context, app));
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

  /**
   * Gets the TFile for a link string.
   */
  private getFileForLink(str: string, activeFile: TFile, app: App): TFile | null {
    return app.metadataCache.getFirstLinkpathDest(parseLinktext(str).path, activeFile.path);
  }

  /**
   * Retrieves the content of a linked file or a specific subpath within a file.
   *
   * @param str - The link string to resolve (e.g., "MyNote#Section").
   * @param activeFile - The currently active file, used as context for relative links.
   * @param app - The Obsidian app instance, providing access to the vault and metadata cache.
   * @param context - Optional blue file resolution context (for recursive calls)
   * @returns A promise that resolves to the content of the linked file or subpath.
   */
  async retrieveLinkContent(
    str: string,
    activeFile: TFile,
    app: App,
    context?: ResolutionContext,
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
    if (this.plugin.settings.blueFileResolution.enabled && context) {
      // Use blue file resolver with provided context
      return this.resolveFile(file, context, app);
    } else if (this.plugin.settings.blueFileResolution.enabled && !context) {
      // Create new context if not provided
      const newContext = this.createContext(activeFile);
      return this.resolveFile(file, newContext, app);
    }

    // Default: just read the file
    return app.vault.cachedRead(file);
  }

  /**
   * Converts m4a audio to WAV format.
   */
  private async convertM4AToWav(buffer: ArrayBuffer): Promise<ArrayBuffer> {
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

    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // Write WAVE header
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

  /**
   * Converts ArrayBuffer to base64 data URL.
   */
  private arrayBufferToBase64DataURL(buffer: ArrayBuffer, mime: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: mime });
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Resolves file links with support for images and audio files.
   * Returns either a string or an array of MediaMessage objects.
   *
   * @param markdown - The markdown string containing file links
   * @param activeFile - The currently active file
   * @param app - The Obsidian app instance
   * @param role - The role of the message (user/assistant)
   * @param context - Optional resolution context for recursive calls
   * @returns Resolved content as string or MediaMessage array
   */
  async resolveFilesWithImagesAndAudio(
    markdown: string,
    activeFile: TFile,
    app: App,
    role: RoleType,
    context?: ResolutionContext,
  ): Promise<MediaMessage[] | string> {
    const matches = Array.from(markdown.matchAll(/^!?\[\[([^\]]+)\]\]$/gm));

    const resolved: MediaMessage[] = await Promise.all(
      matches.map(async match => {
        const [originalLink, link] = match;
        const file = this.getFileForLink(link, activeFile, app);

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
          text: await this.retrieveLinkContent(link, activeFile, app, context),
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
}

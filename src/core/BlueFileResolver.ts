import { App, Notice, TFile } from 'obsidian';
import PureChatLLM from '../main';
import { PureChatLLMChat } from './Chat';
import { BrowserConsole } from '../utils/BrowserConsole';

/**
 * Interface for tracking resolution context during recursive chat execution
 */
export interface ResolutionContext {
  /** Set of file paths currently being resolved (for cycle detection) */
  visitedFiles: Set<string>;
  /** Current depth in the resolution tree */
  currentDepth: number;
  /** Cache of resolved chat responses keyed by file path */
  cache: Map<string, string>;
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
 */
export class BlueFileResolver {
  private console: BrowserConsole;

  constructor(private plugin: PureChatLLM) {
    this.console = new BrowserConsole(plugin.settings.debug, 'BlueFileResolver');
  }

  /**
   * Creates a new resolution context for a top-level invocation
   */
  createContext(rootFile: TFile): ResolutionContext {
    return {
      visitedFiles: new Set<string>(),
      currentDepth: 0,
      cache: new Map<string, string>(),
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

    // Check for cycles
    if (context.visitedFiles.has(file.path)) {
      const error = `[Blue File Resolution] Circular dependency detected: ${file.path}`;
      this.console.error(error);
      new Notice(error);
      return `[[${file.path}]] (Error: Circular dependency)`;
    }

    // Check depth limit
    if (context.currentDepth >= blueFileResolution.maxDepth) {
      const warning = `[Blue File Resolution] Max depth (${blueFileResolution.maxDepth}) reached at: ${file.path}`;
      this.console.log(warning);
      return app.vault.cachedRead(file);
    }

    // Check cache
    if (blueFileResolution.enableCaching && context.cache.has(file.path)) {
      this.console.log(`[Blue File Resolution] Cache hit for: ${file.path}`);
      return context.cache.get(file.path)!;
    }

    // Mark file as being visited
    context.visitedFiles.add(file.path);
    context.currentDepth++;

    try {
      // Read the file content
      const content = await app.vault.cachedRead(file);

      // Create a chat instance to parse the file
      const chat = new PureChatLLMChat(this.plugin);
      chat.setMarkdown(content);

      // Check if this is a pending chat
      if (!this.isPendingChat(content, chat)) {
        this.console.log(`[Blue File Resolution] Not a pending chat: ${file.path}`);
        // Not a pending chat, resolve links within it recursively
        const resolved = await this.resolveLinksInContent(content, file, context, app);
        context.currentDepth--;
        context.visitedFiles.delete(file.path);
        return resolved;
      }

      this.console.log(`[Blue File Resolution] Executing pending chat: ${file.path}`);

      // It's a pending chat - execute it
      // First, resolve any links in the chat messages recursively
      chat.messages = await Promise.all(
        chat.messages.map(async msg => ({
          ...msg,
          content: await this.resolveLinksInContent(msg.content, file, context, app),
        })),
      );

      // Execute the chat (without streaming for intermediate resolutions)
      const response = await chat.completeChatResponse(file, undefined);

      // Get the assistant's response (second to last message, since completeChatResponse adds an empty user message)
      const assistantMessage =
        response.messages.length >= 2
          ? response.messages[response.messages.length - 2]
          : response.messages[response.messages.length - 1];

      const resolvedContent = assistantMessage?.content || '';

      // Cache the result
      if (blueFileResolution.enableCaching) {
        context.cache.set(file.path, resolvedContent);
      }

      // Write intermediate results if configured (and not root file)
      if (blueFileResolution.writeIntermediateResults && file.path !== context.rootFile.path) {
        await app.vault.modify(file, response.markdown);
        this.console.log(`[Blue File Resolution] Wrote intermediate result to: ${file.path}`);
      }

      // Clean up context
      context.currentDepth--;
      context.visitedFiles.delete(file.path);

      return resolvedContent;
    } catch (error) {
      this.console.error(`[Blue File Resolution] Error resolving file ${file.path}:`, error);
      context.currentDepth--;
      context.visitedFiles.delete(file.path);
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
    const replacements: Promise<string>[] = [];
    for (const match of matches) {
      const linkText = match[1];
      const file = app.metadataCache.getFirstLinkpathDest(linkText, activeFile.path);

      if (file instanceof TFile) {
        // Recursively resolve the file
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
}

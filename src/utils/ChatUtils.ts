import { App, TFile } from 'obsidian';
import { PureChatLLMChat } from '../core/Chat';

/**
 * Utility class for chat-specific domain logic.
 * Extracted from BlueResolutionTreeView to separate concerns.
 */
export class ChatUtils {
  /**
   * Determines if a chat instance represents a valid chat file
   * (ends with a user message, indicating it's pending execution).
   * 
   * Moved from BlueResolutionTreeView.isChatFile()
   * 
   * @param chat - The parsed chat instance to check
   * @returns true if the chat is valid and ends with a user message
   */
  static isChatFile(chat: PureChatLLMChat): boolean {
    return (
      chat.validChat &&
      chat.messages.length > 0 &&
      chat.messages[chat.messages.length - 1].role === 'user'
    );
  }

  /**
   * Checks if a chat file has any outgoing links to other chat files.
   * This is used to determine if a file has potential child chats.
   * 
   * Moved from BlueResolutionTreeView.hasChildChats()
   * 
   * @param chat - The parsed chat instance
   * @param file - The file to check for child chats
   * @param app - The Obsidian app instance
   * @returns true if the chat has at least one link to another chat file
   */
  static async hasChildChats(chat: PureChatLLMChat, file: TFile, app: App): Promise<boolean> {
    try {
      for (const message of chat.messages) {
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        const matches = Array.from(message.content.matchAll(linkRegex));
        for (const match of matches) {
          const linkedFile = app.metadataCache.getFirstLinkpathDest(match[1], file.path);

          if (
            linkedFile instanceof TFile &&
            ChatUtils.isChatFile(
              new PureChatLLMChat(chat.plugin).setMarkdown(await app.vault.cachedRead(linkedFile)),
            )
          ) {
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error checking for child chats:', error);
    }
    return false;
  }

  /**
   * Extracts all chat file links from content.
   * Specifically looks for links to files with .chat extension.
   * 
   * @param content - The markdown content to search
   * @returns Array of chat file paths found in the content
   */
  static extractChatLinks(content: string): string[] {
    const chatLinkRegex = /\[\[([^\]]+\.chat)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = chatLinkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return links;
  }

  /**
   * Checks if content contains child chat references.
   * Uses regex to detect .chat file links.
   * 
   * @param content - The markdown content to check
   * @returns true if the content contains at least one .chat link
   */
  static hasChildChatLinks(content: string): boolean {
    const chatLinkRegex = /\[\[([^\]]+\.chat)\]\]/g;
    return chatLinkRegex.test(content);
  }
}

import { App, FuzzySuggestModal, Notice, TFolder } from 'obsidian';
import PureChatLLM from '../main';
import { PureChatLLMChat } from './Chat';

// Author of a message
interface ChatAuthor {
  role: 'user' | 'assistant' | 'system' | 'tool';
  name: string | null;
  metadata: Record<string, unknown>;
}

// Message content
interface ChatMessageContent {
  content_type: string;
  parts: string[];
  // Sometimes more, but this suffices for your example
}

// A message in the mapping
interface ChatMessage {
  id: string;
  author: ChatAuthor;
  create_time: number | null;
  update_time: number | null;
  content: ChatMessageContent;
  status: string;
  end_turn: boolean | null;
  weight: number;
  metadata: Record<string, unknown>;
  recipient: string;
  channel: string | null;
}

// One "node" in the mapping
interface ChatMappingNode {
  id: string;
  message: ChatMessage | null;
  parent: string | null;
  children: string[];
}

// The mapping object
interface ChatMapping {
  [id: string]: ChatMappingNode;
}

type ChatMappingEntry = {
  title: string;
  mapping: ChatMapping;
  [key: string]: unknown;
};

// Top-level chat object
/* interface PureChatGPTExportedChat {
  title: string;
  create_time: number;
  update_time: number;
  mapping: ChatMapping;
  moderation_results: any[];
  current_node: string;
  plugin_ids: string[] | null;
  conversation_id: string;
  conversation_template_id: string | null;
  gizmo_id: string | null;
  gizmo_type: string | null;
  is_archived: boolean;
  is_starred: boolean | null;
  safe_urls: string[];
  blocked_urls: string[];
  default_model_slug: string;
  conversation_origin: string | null;
  voice: string | null;
  async_status: string | null;
  disabled_tool_ids: string[];
  is_do_not_remember: boolean;
  memory_scope: string;
  sugar_item_id: string | null;
  id: string;
}
 */
/**
 * Handles importing ChatGPT conversation exports into Obsidian
 */
export class ImportChatGPT {
  /**
   * Creates a new ImportChatGPT instance and initiates the import process
   * @param app - The Obsidian app instance
   * @param plugin - The Pure Chat LLM plugin instance
   */
  constructor(
    public app: App,
    public plugin: PureChatLLM,
  ) {
    void this.promptAndImport();
  }

  /**
   *
   */
  private async promptAndImport() {
    try {
      const file = await this.getFileFromUser();
      const folderPath = await this.getFolderPath();
      if (!file) throw new Error('No file selected');
      await this.processChatFile(file, folderPath.path);
    } catch (error) {
      new Notice((error as Error).message || 'Error importing ChatGPT JSON');
    }
  }

  /**
   * Prompts user to select a folder for importing the ChatGPT conversations
   * @returns Promise resolving to the selected folder
   */
  private getFolderPath(): Promise<TFolder> {
    return new Promise(resolve => {
      new FolderSuggest(this.app, resolve, 'Where to load the files').open();
    });
  }

  /**
   * Prompts user to select a JSON file containing ChatGPT conversations
   * @returns Promise resolving to the selected file or null if cancelled
   */
  private getFileFromUser(): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.setCssProps({ display: 'none' });

      document.body.appendChild(input);
      input.onchange = () => {
        resolve(input.files?.[0] ?? null);
        document.body.removeChild(input);
      };
      input.click();
    });
  }

  /**
   * Processes a ChatGPT export JSON file and imports all conversations
   * @param file - The JSON file containing ChatGPT conversations
   * @param folderPath - The destination folder path in the vault
   * @returns Promise resolving when all conversations are imported
   */
  private async processChatFile(file: File, folderPath: string) {
    const text = await file.text();
    let chats: { title: string; [key: string]: unknown }[];
    try {
      chats = JSON.parse(text) as { title: string; [key: string]: unknown }[];
      if (!Array.isArray(chats)) throw new Error();
    } catch {
      throw new Error('Invalid ChatGPT JSON format');
    }

    const folder = this.app.fileManager.getNewFileParent(folderPath || '/');
    for (const chat of chats) {
      if (
        chat &&
        typeof chat === 'object' &&
        'mapping' in chat &&
        typeof chat.mapping === 'object'
      ) {
        await this.saveChatConversation(chat as ChatMappingEntry, folder, folderPath);
      }
    }
  }

  /**
   * Saves a single ChatGPT conversation as a markdown file
   * @param chat - The chat mapping entry from the export
   * @param folder - The destination folder
   * @param folderPath - The destination folder path
   * @returns Promise resolving when the conversation is saved
   */
  private async saveChatConversation(chat: ChatMappingEntry, folder: TFolder, folderPath: string) {
    const title = chat.title;
    const result = new PureChatLLMChat(this.plugin);

    // Find root message id
    const mapping = chat.mapping;
    const rootId =
      mapping['client-created-root']?.children?.[0] ||
      mapping[Object.keys(mapping).find(id => !mapping[id].parent) || '']?.children?.[0];

    this.collectConversation(mapping, rootId, result);

    await this.app.vault.create(
      `${folderPath}/${this.plugin.generateUniqueFileName(folder, title)}.md`,
      result.cleanUpChat().getMarkdown(),
    );
  }

  /**
   * Recursively collects conversation messages from the mapping tree
   * @param mapping - The chat mapping object
   * @param rootId - The ID of the root message node
   * @param result - The PureChatLLMChat instance to populate with messages
   * @returns void
   */
  private collectConversation(mapping: ChatMapping, rootId: string, result: PureChatLLMChat) {
    let currentId = rootId;
    while (currentId && mapping[currentId]) {
      const node = mapping[currentId];
      const message = node.message;
      if (
        message &&
        message.content &&
        message.content.content_type === 'text' &&
        message.author.role !== 'tool'
      ) {
        result.appendMessage({
          role: message.author.role,
          content: message.content.parts?.[0] ?? '',
        });
      }
      // Next child
      currentId = node.children?.[0]; // Assuming linear conversation; take the first child
    }
  }
}

/**
 * A modal dialog that provides fuzzy search and selection of folders within the vault.
 *
 * Extends `FuzzySuggestModal<TFolder>` to allow users to quickly find and select a folder.
 *
 * @remarks
 * - The list of folders is populated from all loaded files in the vault, filtered to only include instances of `TFolder`.
 * - The modal displays the folder's path as the search text.
 * - When a folder is chosen, the provided `onSubmit` callback is invoked with the selected folder.
 * - An optional prompt can be set as the placeholder text in the search input.
 *
 * @example
 * ```typescript
 * new FolderSuggest(app, (folder) => {
 *   // Handle selected folder
 * });
 * ```
 *
 * @param app - The Obsidian application instance.
 * @param onSubmit - Callback invoked when a folder is selected.
 * @param prompt - Optional placeholder text for the search input.
 */
class FolderSuggest extends FuzzySuggestModal<TFolder> {
  /**
   * Description placeholder
   *
   * @type {(result: TFolder) => void}
   */
  onSubmit: (result: TFolder) => void;
  /**
   * Description placeholder
   *
   * @type {TFolder[]}
   */
  folders: TFolder[];
  /**
   * Creates a new FolderSuggest modal
   * @param app - The Obsidian app instance
   * @param onSubmit - Callback invoked when a folder is selected
   * @param prompt - Optional placeholder text for the search input
   */
  constructor(app: App, onSubmit: (result: TFolder) => void, prompt?: string) {
    super(app);
    this.onSubmit = onSubmit;
    this.folders = app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder);
    this.setPlaceholder(prompt || 'Search for a folder...');
  }
  /**
   * Gets the list of folders to display in the suggestion modal
   * @returns Array of TFolder objects from the vault
   */
  getItems(): TFolder[] {
    return this.folders;
  }
  /**
   * Gets the display text for a folder in the suggestion modal
   * @param folder - The folder to get the text for
   * @returns The folder path
   */
  getItemText(folder: TFolder): string {
    return folder.path;
  }
  /**
   * Handles the folder selection event
   * @param folder - The selected folder
   * @param evt - The mouse or keyboard event that triggered the selection
   * @returns void
   */
  onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(folder);
  }
}

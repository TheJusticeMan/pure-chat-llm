/** @format */

import { App, Notice, TFolder } from "obsidian";
import { PureChatLLMChat } from "./Chat";
import PureChatLLM, { FolderSuggest } from "./main";

// Author of a message
interface ChatAuthor {
  role: "user" | "assistant" | "system" | "tool" | string;
  name: string | null;
  metadata: Record<string, any>;
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
  metadata: Record<string, any>;
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

// Top-level chat object
interface PureChatGPTExportedChat {
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

export class ImportChatGPT {
  constructor(public app: App, public plugin: PureChatLLM) {
    this.promptAndImport();
  }

  private async promptAndImport() {
    try {
      const file = await this.getFileFromUser();
      const folderPath = await this.getFolderPath();
      if (!file) throw new Error("No file selected");
      await this.processChatFile(file, folderPath.path);
    } catch (error) {
      new Notice(error.message || "Error importing ChatGPT JSON");
    }
  }

  // Prompts user to select a folder; returns a Promise
  private getFolderPath(): Promise<TFolder> {
    return new Promise(resolve => {
      new FolderSuggest(this.app, resolve, "Where to load the files").open();
    });
  }

  // Prompts user to select a file; returns a Promise<File>
  private getFileFromUser(): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = () => {
        resolve(input.files?.[0] ?? null);
        document.body.removeChild(input);
      };
      input.click();
    });
  }

  private async processChatFile(file: File, folderPath: string) {
    const text = await file.text();
    let chats: { title: string; [key: string]: any }[];
    try {
      chats = JSON.parse(text);
      if (!Array.isArray(chats)) throw new Error();
    } catch {
      throw new Error("Invalid ChatGPT JSON format");
    }

    const folder = this.app.fileManager.getNewFileParent(folderPath || "/");
    for (const chat of chats) {
      await this.saveChatConversation(chat, folder, folderPath);
    }
  }

  private async saveChatConversation(chat: any, folder: any, folderPath: string) {
    const title = chat.title;
    const result = new PureChatLLMChat(this.plugin);

    // Find root message id
    const mapping = chat.mapping;
    const rootId =
      mapping["client-created-root"]?.children?.[0] ||
      mapping[Object.keys(mapping).find(id => !mapping[id].parent) || ""]?.children?.[0];

    this.collectConversation(mapping, rootId, result);

    await this.app.vault.create(
      `${folderPath}/${this.plugin.generateUniqueFileName(folder, title)}.md`,
      result.cleanUpChat().Markdown
    );
  }

  private collectConversation(mapping: ChatMapping, rootId: string, result: PureChatLLMChat) {
    let currentId = rootId;
    while (currentId && mapping[currentId]) {
      const node = mapping[currentId];
      const message = node.message;
      if (message && message.content && message.content.content_type === "text" && message.author.role !== "tool") {
        result.appendMessage({
          role: message.author.role as "user" | "assistant" | "system",
          content: message.content.parts?.[0] ?? "",
        });
      }
      // Next child
      currentId = node.children?.[0]; // Assuming linear conversation; take the first child
    }
  }
}

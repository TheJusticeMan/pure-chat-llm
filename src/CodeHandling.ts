import { App, Modal, Notice, Setting } from "obsidian";
import { PureChatLLMChat } from "./Chat";
import PureChatLLM from "./main";
import { CodeAreaComponent, EditSelectionModal } from "./models";

/**
 * Modal dialog for displaying and handling code blocks extracted from a given string.
 *
 * This modal presents each code block in a separate section, showing its language and code content.
 * Users can edit the code in a textarea, copy the code to the clipboard, or open an advanced edit modal.
 *
 * @remarks
 * - Utilizes the `PureChatLLMChat.extractAllCodeBlocks` method to parse code blocks from the input string.
 * - Each code block is displayed with its language as a heading, an editable textarea, and action buttons.
 * - The modal is titled "Code handling".
 *
 * @example
 * const modal = new CodeHandling(app, plugin, codeString);
 * modal.open();
 *
 * @param app - The Obsidian application instance.
 * @param plugin - The instance of the PureChatLLM plugin.
 * @param code - The string containing code blocks to be extracted and displayed.
 */
export class CodeHandling extends Modal {
  plugin: PureChatLLM;
  code: codeContent[];

  constructor(app: App, plugin: PureChatLLM, code: string) {
    super(app);
    this.plugin = plugin;
    this.code = this.getCode(code);
    this.setTitle("Code handling");
    this.renderCodeBlocks();
  }

  private renderCodeBlocks() {
    if (!this.code.length) {
      new Setting(this.contentEl).setName("No code blocks found.");
      return;
    }
    this.code.forEach((c, idx) => {
      new Setting(this.contentEl).setName(c.language || `Code block ${idx + 1}`).setHeading();

      const textArea = new CodeAreaComponent(this.contentEl).setValue(c.code).onChange((value) => {
        c.code = value;
      });

      new Setting(this.contentEl)
        .addExtraButton((btn) =>
          btn
            .setIcon("copy")
            .setTooltip("Copy to clipboard")
            .onClick(() => {
              navigator.clipboard.writeText(c.code);
              new Notice("Code copied to clipboard");
            })
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("pencil")
            .setTooltip("Edit with prompt")
            .onClick(() => {
              new EditSelectionModal(this.app, this.plugin, c.code, (newCode) => {
                c.code = newCode;
                textArea.setValue(newCode);
              }).open();
            })
        );
    });
  }

  getCode(code: string): codeContent[] {
    return PureChatLLMChat.extractAllCodeBlocks(code);
  }
}

/**
 * The `SectionHandling` class extends the `CodeHandling` class and provides
 * functionality for extracting and organizing code sections from a given string.
 * It is specifically designed to work with headers and their associated content.
 *
 * @extends CodeHandling
 */
export class SectionHandling extends CodeHandling {
  plugin: PureChatLLM;
  code: codeContent[];
  getCode(code: string): codeContent[] {
    // Extract all Headers and content from the input string
    // capture the headers and the text following them
    const regex = /^(#{1,6})\s*(.*?)\n([\s\S]*?)(?=\n#{1,6}|\n$)/gm;
    const matches = code.matchAll(regex);
    const sections: codeContent[] = [];
    for (const match of matches) {
      const header = match[2].trim();
      const content = match[3].trim();
      const level = match[1].length;
      sections.push({ language: header, code: content });
    }
    return sections;
  }
}

export interface codeContent {
  language: string;
  code: string;
}

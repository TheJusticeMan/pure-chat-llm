import { Editor, MarkdownView, TFile } from 'obsidian';
import PureChatLLM from 'src/main';

/**
 * WriteHandler is responsible for handling write operations in the PureChatLLM plugin. It interacts with the MarkdownView and Editor to perform necessary actions when writing content.
 *
 * @export
 * @class WriteHandler
 * @typedef {WriteHandler}
 */
export class WriteHandler {
  /**
   * Creates an instance of the WriteHandler.
   *
   * @param plugin - The instance of the PureChatLLM plugin.
   * @param file - The path to the file being handled.
   * @param view - An optional MarkdownView instance associated with the file.
   * @param editor - An optional Editor instance for text manipulation.
   * @param followCursor - A boolean indicating whether to follow the cursor position when appending content.
   * @memberof WriteHandler
   */
  constructor(
    private plugin: PureChatLLM,
    readonly file: TFile,
    private view?: MarkdownView,
    private editor?: Editor,
    private followCursor = false,
  ) {}

  /**
   * Appends content to the editor.
   *
   * @param {string} content - The content to append.
   */
  async appendContent(content: string): Promise<void> {
    // make sure the user has not opened another file in the meantime, if so, we should append to the file instead of the editor
    if (this.editor && this.view?.file?.path === this.file.path) {
      const lastLine = this.editor.lastLine();
      const lastLineLength = this.editor.getLine(lastLine).length;

      this.editor.replaceRange(content, { line: lastLine, ch: lastLineLength });
      if (this.followCursor) {
        this.editor.scrollIntoView({
          from: { line: lastLine, ch: lastLineLength },
          to: { line: lastLine, ch: lastLineLength + content.length },
        });
      }
    } else {
      await this.plugin.app.vault.append(this.file, content);
    }
  }

  /**
   * Writes content to the editor, replacing existing content if necessary.
   *
   * @param {string} content - The content to write.
   * @returns {Promise<void>} - A promise that resolves when the write operation is complete.
   * @memberof WriteHandler
   */
  async write(content: string): Promise<void> {
    if (this.editor && this.view?.file?.path === this.file.path) {
      this.editor.setValue(content);
    } else {
      await this.plugin.app.vault.modify(this.file, content);
    }
  }

  /**
   * Retrieves the current content of the editor or file.
   *
   * @async
   * @returns {Promise<string>} - A promise that resolves with the current content.
   */
  async getValue(): Promise<string> {
    if (this.editor && this.view?.file?.path === this.file.path) {
      return this.editor.getValue();
    } else {
      return await this.plugin.app.vault.cachedRead(this.file);
    }
  }
}

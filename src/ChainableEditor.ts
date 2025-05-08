import {
  Editor,
  EditorPosition,
  EditorSelectionOrCaret,
  EditorRange,
  EditorSelection,
  EditorCommandName,
  EditorTransaction,
} from "obsidian";

/**
 * Represents a chainable wrapper around an Editor instance,
 * allowing multiple operations to be performed fluently.
 */
export class ChainableEditor {
  /**
   * The underlying editor instance.
   * @private
   */
  private editor: Editor;

  /**
   * Creates a new ChainableEditor wrapping the provided editor.
   * @param {Editor} editor - The editor instance to wrap.
   */
  constructor(editor: Editor) {
    this.editor = editor;
  }

  /**
   * Sets the editor content to the specified string.
   * @param {string} content - The content to set in the editor.
   * @returns {this} - The current ChainableEditor instance.
   */
  setValue(content: string): this {
    this.editor.setValue(content);
    return this;
  }

  /**
   * Inserts or replaces the specified line with provided text.
   * @param {number} n - Zero-based line number.
   * @param {string} text - The text to set at the specified line.
   * @returns {this} - The current ChainableEditor instance.
   */
  setLine(n: number, text: string): this {
    this.editor.setLine(n, text);
    return this;
  }

  /**
   * Sets the cursor position.
   * @param {EditorPosition|number} pos - The position as an object or offset.
   * @param {number} [ch] - Optional character position when using offset.
   * @returns {this} - The current ChainableEditor instance.
   */
  setCursor(pos: EditorPosition | number, ch?: number): this {
    this.editor.setCursor(pos, ch);
    return this;
  }

  /**
   * Sets the selection range in the editor.
   * @param {EditorPosition} anchor - The start position.
   * @param {EditorPosition} [head] - The end position (optional).
   * @returns {this} - The current ChainableEditor instance.
   */
  setSelection(anchor: EditorPosition, head?: EditorPosition): this {
    this.editor.setSelection(anchor, head);
    return this;
  }

  /**
   * Replaces the current selection in the editor with the provided text.
   *
   * @param text - The text to insert in place of the current selection.
   * @returns The current instance for method chaining.
   */
  replaceSelection(text: string): this {
    this.editor.replaceSelection(text);
    return this;
  }

  /**
   * Sets multiple selections in the editor.
   * @param {EditorSelectionOrCaret[]} ranges - Array of selection ranges or carets.
   * @param {number} [main] - Index of the primary selection (optional).
   * @returns {this} - The current ChainableEditor instance.
   */
  setSelections(ranges: EditorSelectionOrCaret[], main?: number): this {
    this.editor.setSelections(ranges, main);
    return this;
  }

  /**
   * Scrolls the editor view to the specified coordinates.
   * @param {number|null} [x] - Horizontal scroll position (optional).
   * @param {number|null} [y] - Vertical scroll position (optional).
   * @returns {this} - The current ChainableEditor instance.
   */
  scrollTo(x?: number | null, y?: number | null): this {
    this.editor.scrollTo(x, y);
    return this;
  }

  /**
   * Scrolls the editor to bring a range into view.
   * @param {EditorRange} range - The range to scroll into view.
   * @param {boolean} [center=false] - Whether to center the range (optional).
   * @returns {this} - The current ChainableEditor instance.
   */
  scrollIntoView(range: EditorRange, center?: boolean): this {
    this.editor.scrollIntoView(range, center);
    return this;
  }

  /**
   * Performs an undo operation.
   * @returns {this} - The current ChainableEditor instance.
   */
  undo(): this {
    this.editor.undo();
    return this;
  }

  /**
   * Performs a redo operation.
   * @returns {this} - The current ChainableEditor instance.
   */
  redo(): this {
    this.editor.redo();
    return this;
  }

  /**
   * Focuses the editor.
   * @returns {this} - The current ChainableEditor instance.
   */
  focus(): this {
    this.editor.focus();
    return this;
  }

  /**
   * Removes focus from the editor.
   * @returns {this} - The current ChainableEditor instance.
   */
  blur(): this {
    this.editor.blur();
    return this;
  }

  // Read-only methods - no chaining
  /**
   * Retrieves the current content of the editor.
   * @returns {string} - The editor's current value.
   */
  getValue(): string {
    return this.editor.getValue();
  }

  /**
   * Retrieves the content of a specific line.
   * @param {number} line - Zero-based line number.
   * @returns {string} - The content of the specified line.
   */
  getLine(line: number): string {
    return this.editor.getLine(line);
  }

  /**
   * Gets the currently selected text.
   * @returns {string} - The selected text.
   */
  getSelection(): string {
    return this.editor.getSelection();
  }

  /**
   * Lists all current selections.
   * @returns {EditorSelection[]} - Array of selection objects.
   */
  listSelections(): EditorSelection[] {
    return this.editor.listSelections();
  }

  /**
   * Gets scroll information.
   * @returns {{ top: number; left: number }} - Scroll positions.
   */
  getScrollInfo(): { top: number; left: number } {
    return this.editor.getScrollInfo();
  }

  /**
   * Checks if the editor currently has focus.
   * @returns {boolean} - True if focused, false otherwise.
   */
  hasFocus(): boolean {
    return this.editor.hasFocus();
  }

  /**
   * Retrieves the cursor position.
   * @param {'from'|'to'|'head'|'anchor'} [position] - Specific position type (optional).
   * @returns {EditorPosition} - The cursor position object.
   */
  getCursor(position?: "from" | "to" | "head" | "anchor"): EditorPosition {
    return this.editor.getCursor(position);
  }

  /**
   * Converts an editor position to an offset.
   * @param {EditorPosition} pos - The position to convert.
   * @returns {number} - The corresponding offset.
   */
  posToOffset(pos: EditorPosition): number {
    return this.editor.posToOffset(pos);
  }

  /**
   * Converts an offset to an editor position.
   * @param {number} offset - The offset to convert.
   * @returns {EditorPosition} - The corresponding position object.
   */
  offsetToPos(offset: number): EditorPosition {
    return this.editor.offsetToPos(offset);
  }

  /**
   * Executes a command in the editor.
   * @param {EditorCommandName} command - The name of the command to execute.
   * @returns {this} - The current ChainableEditor instance.
   */
  exec(command: EditorCommandName): this {
    this.editor.exec(command);
    return this;
  }

  /**
   * Performs a transaction, optionally with an origin description.
   * @param {EditorTransaction} tx - The transaction function to run.
   * @param {string} [origin] - Optional description of transaction origin.
   * @returns {this} - The current ChainableEditor instance.
   */
  transaction(tx: EditorTransaction, origin?: string): this {
    this.editor.transaction(tx, origin);
    return this;
  }

  /**
   * Exposes the underlying editor instance.
   * @returns {Editor} - The original editor object.
   */
  getEditor(): Editor {
    return this.editor;
  }
}

import { syntaxTree } from '@codemirror/language';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { App, ItemView, WorkspaceLeaf } from 'obsidian';
import PureChatLLM from '../main';

export interface CodeSnippetState {
  code: string;
  language: string;
}

export const CODE_PREVIEW_VIEW_TYPE = 'pure-chat-llm-code-preview';

/**
 * View component for displaying code previews in the Obsidian workspace.
 *
 * Renders code snippets in a preview pane with syntax highlighting or HTML rendering.
 * For HTML code blocks, renders content in an iframe with restricted permissions.
 */
export class CodePreview extends ItemView {
  state?: CodeSnippetState;
  /**
   * Creates a new code preview view instance.
   *
   * @param leaf - The workspace leaf to render the view in
   * @param plugin - The PureChatLLM plugin instance
   */
  constructor(
    leaf: WorkspaceLeaf,
    public plugin: PureChatLLM,
  ) {
    super(leaf);
    this.icon = 'code';
  }

  /**
   * Gets the unique identifier for this view type.
   *
   * @returns The view type identifier
   */
  getViewType(): string {
    return CODE_PREVIEW_VIEW_TYPE;
  }

  /**
   * Gets the display text shown in the view header.
   *
   * @returns The display text for this view
   */
  getDisplayText(): string {
    return 'Code preview';
  }

  /**
   * Sets ephemeral state for the view and renders the code preview.
   *
   * @param state - The code snippet state containing code and language
   */
  setEphemeralState(state: CodeSnippetState) {
    this.renderCodePreview(state);
    this.state = state;
  }

  /**
   * Called when the view is opened.
   *
   * @returns A promise that resolves when the view is ready
   */
  async onOpen() {
    //this.renderCodePreview();
  }

  /**
   * Renders the code preview based on the provided state.
   *
   * @param state - The code snippet state containing code and language
   */
  private renderCodePreview(state: CodeSnippetState) {
    this.contentEl.empty();

    const code = state.code || '';
    const language: string = state.language || 'text';

    if (language.toLowerCase() === 'html') {
      const iframe = this.contentEl.createEl('iframe');
      iframe.setAttr('sandbox', 'allow-scripts allow-same-origin');
      iframe.setCssProps({ width: '100%', height: '100%' });
      iframe.srcdoc = code;
    } else {
      this.contentEl.createEl('pre', {}, el =>
        el.createEl('code', { text: code }).addClass(`language-${language}`),
      );
    }
  }

  /**
   * Called when the view is closed.
   *
   * @returns A promise that resolves when cleanup is complete
   */
  async onClose() {
    this.contentEl.empty();
  }
}

/**
 * Creates a CodeMirror ViewPlugin that monitors the editor's selection to detect if the cursor is currently inside a code block.
 *
 * This extension iterates through the syntax tree within the current selection range. If a node with the name
 * 'HyperMD-codeblock_HyperMD-codeblock-bg' is found, it updates the plugin's state with the code block's
 * start and end positions. Otherwise, it clears the stored code block state.
 *
 * @param app - The Obsidian App instance.
 * @param plugin - The instance of the PureChatLLM plugin, used to store the detected code block range.
 * @returns A CodeMirror `ViewPlugin` instance that updates on view changes.
 */
export function createCodeblockExtension(app: App, plugin: PureChatLLM) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      app: App;
      plugin: PureChatLLM;
      /**
       * Constructs the ViewPlugin class instance.
       *
       * @param view - The CodeMirror EditorView instance
       */
      constructor(private view: EditorView) {
        this.decorations = Decoration.none;
        this.app = app;
        this.plugin = plugin;
      }
      /**
       * Updates the code block detection when the view changes.
       *
       * @param update - The view update containing state changes
       */
      update(update: ViewUpdate) {
        syntaxTree(update.view.state).iterate({
          from: update.view.state.selection.main.from,
          to: update.view.state.selection.main.to,
          enter: node => {
            if (node.name === 'HyperMD-codeblock_HyperMD-codeblock-bg') {
              const editor = this.app.workspace.activeEditor?.editor;
              if (!editor) return;
              const fullDoc = editor.getValue();

              const codeBlockRange = {
                from: fullDoc.lastIndexOf('```', node.from) - 3,
                to: fullDoc.indexOf('```', node.from) + 3,
              };

              const codeContent = fullDoc.slice(codeBlockRange.from, codeBlockRange.to);

              this.plugin.updateCodePreview({
                code: codeContent.match(/```(\w+)?\n([\w\W]*?)```/m)?.[2] || '',
                language: codeContent.match(/```(\w+)/m)?.[1] || 'text',
              });
            }
          },
        });
      }
    },
  );
}

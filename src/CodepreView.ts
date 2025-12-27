import { syntaxTree } from '@codemirror/language';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { App, Editor, ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import PureChatLLM from './main';

export interface CodeSnippetState {
  code: string;
  language: string;
  editor: Editor;
}

export const CODE_PREVIEW_VIEW_TYPE = 'pure-chat-llm-code-preview';
export function openCodePreview(app: App, code: string, language: string, editor: Editor) {
  void app.workspace.getLeaf('split').setViewState({
    type: CODE_PREVIEW_VIEW_TYPE,
    active: true,
    state: { code, language, editor },
  });
}

export class CodePreview extends ItemView {
  state?: CodeSnippetState;
  constructor(
    leaf: WorkspaceLeaf,
    public plugin: PureChatLLM,
  ) {
    super(leaf);
    this.icon = 'code';
  }

  getViewType(): string {
    return CODE_PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Code preview';
  }

  setState(state: CodeSnippetState, result: ViewStateResult): Promise<void> {
    this.renderCodePreview(state);
    this.state = state;
    this.plugin.offCodeBlockUpdate(this.update);
    this.plugin.onCodeBlockUpdate(this.update);
    return Promise.resolve();
  }

  update = () => {
    const { state } = this;
    if (!state) return;
    const { codeBlock } = this.plugin;
    if (!codeBlock) return;
    const { editor } = state;
    const content = editor.getValue().slice(codeBlock.from, codeBlock.to);
    this.renderCodePreview({
      code: content.match(/```\w+([\w\W]*?)```/m)?.[1] || '',
      language: content.match(/```(\w+)[\w\W]*?```/m)?.[1] || 'text',
      editor,
    });
  };

  async onOpen() {
    //this.renderCodePreview();
  }

  private renderCodePreview(state: CodeSnippetState) {
    this.contentEl.empty();
    this.contentEl.addClass('PURECodePreview');

    const code = state.code || '';
    const language: string = state.language || 'text';

    if (language.toLowerCase() === 'html') {
      const iframe = this.contentEl.createEl('iframe');
      iframe.setAttr('sandbox', 'allow-scripts allow-same-origin');
      iframe.setCssProps({ width: '100%', height: '100%' });
      iframe.srcdoc = code;
    } else {
      this.contentEl.createEl('pre', {}, el => {
        const codeEl = el.createEl('code', { text: code });
        codeEl.addClass(`language-${language}`);
      });
    }
  }

  async onClose() {
    this.plugin.offCodeBlockUpdate(this.update);
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
      constructor(private view: EditorView) {
        this.decorations = Decoration.none;
        this.app = app;
        this.plugin = plugin;
      }
      update(update: ViewUpdate) {
        syntaxTree(update.view.state).iterate({
          from: update.view.state.selection.main.from,
          to: update.view.state.selection.main.to,
          enter: node => {
            if (node.name === 'HyperMD-codeblock_HyperMD-codeblock-bg') {
              const fullDoc = update.view.state.doc.toString();
              const from = fullDoc.lastIndexOf('```', update.view.state.selection.main.from) - 3;
              const to = fullDoc.indexOf('```', update.view.state.selection.main.from) + 3;
              if (to === this.plugin.codeBlock?.to && from === this.plugin.codeBlock?.from) return;

              this.plugin.codeBlock = { from: from, to: to };
              this.plugin.callOnChange();
            } /* else {
              this.plugin.codeBlock = null;
            } */
          },
        });
      }
    },
  );
}

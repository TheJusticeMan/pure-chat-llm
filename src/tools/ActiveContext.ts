import { defineToolParameters, InferArgs, Tool } from '../tools';
import { MarkdownView } from 'obsidian';

const activeContextParameters = defineToolParameters({
  type: 'object',
  properties: {
    include_content: {
      type: 'boolean',
      description: 'Whether to include the full content of the active file. Defaults to false.',
      default: false,
    },
  },
  required: [],
} as const);

export type ActiveContextArgs = InferArgs<typeof activeContextParameters>;

/**
 *
 */
export class ActiveContextTool extends Tool<ActiveContextArgs> {
  readonly name = 'get_active_context';
  readonly classification = 'UI';
  readonly description =
    'Retrieves information about the currently active note, including path, selection, and cursor position.';
  readonly parameters = activeContextParameters;

  /**
   *
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   *
   * @param args
   */
  async execute(args: ActiveContextArgs): Promise<string> {
    const { include_content = false } = args;
    const app = this.chat.plugin.app;
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    if (!activeView) {
      return 'No active Markdown note found.';
    }

    const file = activeView.file;
    if (!file) {
      return 'Active view has no associated file.';
    }

    const editor = activeView.editor;
    const selection = editor.getSelection();
    const cursor = editor.getCursor();
    const lineCount = editor.lineCount();

    let response = `Active File: ${file.path}\n`;
    response += `Cursor Position: Line ${cursor.line + 1}, Column ${cursor.ch + 1}\n`;
    response += `Total Lines: ${lineCount}\n`;

    if (selection) {
      response += `Currently Selected Text:\n---\n${selection}\n---\n`;
    } else {
      response += 'No text currently selected.\n';
    }

    if (include_content) {
      const content = editor.getValue();
      response += `\nFull File Content:\n---\n${content}\n---\n`;
    }

    return response;
  }
}

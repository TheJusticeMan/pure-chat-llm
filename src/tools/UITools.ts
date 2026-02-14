import { defineToolParameters, InferArgs, Tool } from '../tools';
import { MarkdownView, TFile, normalizePath, Notice } from 'obsidian';

// --- Active Context ---
const activeContextParameters = defineToolParameters({
  type: 'object',
  properties: {
    include_content: {
      type: 'boolean',
      description: 'Include full content. Default: false',
      default: false,
    },
  },
  required: [],
} as const);

export type ActiveContextArgs = InferArgs<typeof activeContextParameters>;

export class ActiveContextTool extends Tool<ActiveContextArgs> {
  readonly name = 'get_active_context';
  readonly classification = 'UI';
  readonly description = 'Retrieves info about the active note (path, selection, cursor).';
  readonly parameters = activeContextParameters;
  isAvailable() {
    return true;
  }
  async execute(args: ActiveContextArgs): Promise<string> {
    const view = this.chat.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return 'No active Markdown note found.';
    const editor = view.editor;
    const cursor = editor.getCursor();
    let response = `Active File: ${view.file.path}\nCursor: Line ${cursor.line + 1}, Col ${cursor.ch + 1}\nLines: ${editor.lineCount()}\n`;
    if (editor.somethingSelected()) response += `Selection:\n---\n${editor.getSelection()}\n---\n`;
    else response += 'No selection.\n';
    if (args.include_content) response += `\nContent:\n---\n${editor.getValue()}\n---\n`;
    return response;
  }
}

// --- Manage Workspace ---
const manageWorkspaceParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: { type: 'string', description: '"open" or "close"', enum: ['open', 'close'] },
    path: { type: 'string', description: 'Path to open.' },
    split: {
      type: 'string',
      description: '"horizontal", "vertical", "none". Default: "none"',
      enum: ['horizontal', 'vertical', 'none'],
      default: 'none',
    },
    new_leaf: { type: 'boolean', description: 'Open in new tab. Default: true', default: true },
    mode: { type: 'string', description: '"source" or "preview"', enum: ['source', 'preview'] },
    active: { type: 'boolean', description: 'Focus the new leaf. Default: true', default: true },
  },
  required: ['action'],
} as const);

export type ManageWorkspaceArgs = InferArgs<typeof manageWorkspaceParameters>;

export class ManageWorkspaceTool extends Tool<ManageWorkspaceArgs> {
  readonly name = 'manage_workspace';
  readonly classification = 'UI';
  readonly description = 'Controls the Obsidian workspace (open/close tabs, split panes).';
  readonly parameters = manageWorkspaceParameters;
  isAvailable() {
    return true;
  }
  async execute(args: ManageWorkspaceArgs): Promise<string> {
    const { action, path, split = 'none', new_leaf = true, mode, active = true } = args;
    const app = this.chat.plugin.app;

    if (action === 'close') {
      if (path) {
        const target = normalizePath(path);
        const leaf = app.workspace
          .getLeavesOfType('markdown')
          .reverse()
          .find(l => (l.view as MarkdownView).file?.path === target);
        if (leaf) {
          leaf.detach();
          return `Closed tab for "${target}".`;
        }
      }
      const leaf = app.workspace.getMostRecentLeaf();
      if (leaf) {
        leaf.detach();
        return 'Closed active leaf.';
      }
      return 'No leaf to close.';
    }

    if (action === 'open') {
      if (!path) return 'Error: "path" required for "open".';
      const file = app.vault.getAbstractFileByPath(normalizePath(path));
      if (!file || !(file instanceof TFile)) return `Error: File not found "${path}"`;
      void this.status(`Opening "${path}"...`);

      const leaf =
        split === 'horizontal'
          ? app.workspace.getLeaf('split', 'horizontal')
          : split === 'vertical'
            ? app.workspace.getLeaf('split', 'vertical')
            : new_leaf
              ? app.workspace.getLeaf('tab')
              : app.workspace.getMostRecentLeaf();

      if (!leaf) return 'Error: No leaf available.';
      await leaf.openFile(file, { active });
      if (mode && leaf.view instanceof MarkdownView)
        await leaf.view.setState({ ...leaf.view.getState(), mode }, { history: false });
      return `Opened "${path}"`;
    }
    return 'Invalid action';
  }
}

// --- Show Notice ---
const showNoticeParameters = defineToolParameters({
  type: 'object',
  properties: {
    message: { type: 'string', description: 'Message to display.' },
    duration: { type: 'integer', description: 'Duration (ms). Default: 5000', default: 5000 },
  },
  required: ['message'],
} as const);

export type ShowNoticeArgs = InferArgs<typeof showNoticeParameters>;

export class ShowNoticeTool extends Tool<ShowNoticeArgs> {
  readonly name = 'show_obsidian_notice';
  readonly classification = 'UI';
  readonly description = 'Displays a toast notification.';
  readonly parameters = showNoticeParameters;
  isAvailable() {
    return true;
  }
  async execute(args: ShowNoticeArgs): Promise<string> {
    new Notice(args.message, args.duration ?? 5000);
    return `Displayed notice: "${args.message}"`;
  }
}

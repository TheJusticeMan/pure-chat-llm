import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath, MarkdownView } from 'obsidian';

const manageWorkspaceParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description: 'The action to perform: "open" to open a file, or "close" to close a leaf.',
      enum: ['open', 'close'],
    },
    path: {
      type: 'string',
      description: 'The path of the file to open (required for "open").',
    },
    split: {
      type: 'string',
      description:
        'How to split the leaf if opening a file: "horizontal", "vertical", or "none" (default).',
      enum: ['horizontal', 'vertical', 'none'],
      default: 'none',
    },
    new_leaf: {
      type: 'boolean',
      description: 'Whether to open the file in a new tab. Defaults to true if split is none.',
      default: true,
    },
    mode: {
      type: 'string',
      description: 'Set the view mode: "source" (Editing) or "preview" (Reading).',
      enum: ['source', 'preview'],
    },
    active: {
      type: 'boolean',
      description: 'Whether to make the opened file the active (focused) leaf. Defaults to true.',
      default: true,
    },
  },
  required: ['action'],
} as const);

export type ManageWorkspaceArgs = InferArgs<typeof manageWorkspaceParameters>;

export class ManageWorkspaceTool extends Tool<ManageWorkspaceArgs> {
  readonly name = 'manage_workspace';
  readonly classification = 'UI';
  readonly description =
    'Controls the Obsidian workspace layout. Use this to open notes in new tabs, split panes, or change view modes.';
  readonly parameters = manageWorkspaceParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: ManageWorkspaceArgs): Promise<string> {
    const { action, path, split = 'none', new_leaf = true, mode, active = true } = args;
    const app = this.chat.plugin.app;

    if (action === 'close') {
      const activeLeaf = app.workspace.getMostRecentLeaf();
      if (activeLeaf) {
        activeLeaf.detach();
        return 'Successfully closed the active leaf.';
      }
      return 'No active leaf found to close.';
    }

    if (action === 'open') {
      if (!path) return 'Error: "path" is required for "open" action.';
      const normalizedPath = normalizePath(path);
      const file = app.vault.getAbstractFileByPath(normalizedPath);

      if (!file || !(file instanceof TFile)) {
        return `Error: File not found at path "${normalizedPath}"`;
      }

      this.status(`Opening "${normalizedPath}"...`);

      let leaf;
      if (split === 'horizontal') {
        leaf = app.workspace.getLeaf('split', 'horizontal');
      } else if (split === 'vertical') {
        leaf = app.workspace.getLeaf('split', 'vertical');
      } else if (new_leaf) {
        leaf = app.workspace.getLeaf('tab');
      } else {
        leaf = app.workspace.getMostRecentLeaf();
      }

      if (!leaf) {
        return 'Error: Could not create or find a suitable workspace leaf.';
      }

      await leaf.openFile(file, { active });

      if (mode) {
        const view = leaf.view;
        if (view instanceof MarkdownView) {
          const state = view.getState();
          state.mode = mode;
          await view.setState(state, { history: false });
        }
      }

      return `Successfully opened "${normalizedPath}"${split !== 'none' ? ` with a ${split} split` : ''}${mode ? ` in ${mode} mode` : ''}.`;
    }

    return 'Error: Invalid action.';
  }
}

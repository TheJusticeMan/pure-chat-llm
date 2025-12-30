import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFolder } from 'obsidian';

const listFoldersParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The root path to start listing folders from. Defaults to the vault root (/).',
      default: '/',
    },
    recursive: {
      type: 'boolean',
      description: 'Whether to list folders recursively. Defaults to false.',
      default: false,
    },
  },
  required: [],
} as const);

export type ListFoldersArgs = InferArgs<typeof listFoldersParameters>;

export class ListFoldersTool extends Tool<ListFoldersArgs> {
  readonly name = 'list_vault_folders';
  readonly description =
    'Lists folders in the vault to understand the directory structure and suggest locations for new notes.';
  readonly parameters = listFoldersParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: ListFoldersArgs): Promise<string> {
    const { path = '/', recursive = false } = args;
    const app = this.chat.plugin.app;

    const targetPath = String(path);
    const rootFolder = app.vault.getAbstractFileByPath(targetPath === '' ? '/' : targetPath);

    if (!rootFolder || !(rootFolder instanceof TFolder)) {
      return `Error: Folder not found at path "${targetPath}"`;
    }

    this.status(`Listing folders in "${targetPath}"...`);

    const folders: string[] = [];

    const walk = (folder: TFolder, currentDepth: number) => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          folders.push(child.path);
          if (recursive) {
            walk(child, currentDepth + 1);
          }
        }
      }
    };

    walk(rootFolder, 0);

    if (folders.length === 0) {
      return `No subfolders found in "${targetPath}".`;
    }

    return `Folders in "${targetPath}":\n${folders.join('\n')}`;
  }
}

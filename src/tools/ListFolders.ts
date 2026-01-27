import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFolder, TFile } from 'obsidian';
import { ToolOutputBuilder } from './ToolOutputBuilder';

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
  readonly classification = 'Vault';
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
      return new ToolOutputBuilder()
        .addError(
          'FolderNotFoundError',
          `No folder exists at path "${targetPath}"`,
          [
            'list_vault_folders("/") - List folders from vault root',
            'Check the folder path spelling and structure',
          ],
        )
        .build();
    }

    void this.status(`Listing folders in "${targetPath}"...`);

    const folderStats: Array<{ path: string; fileCount: number; totalSize: number }> = [];

    const walk = (folder: TFolder, currentDepth: number) => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          // Calculate folder statistics
          let fileCount = 0;
          let totalSize = 0;
          
          const countFiles = (f: TFolder) => {
            for (const c of f.children) {
              if (c instanceof TFile) {
                fileCount++;
                totalSize += c.stat.size;
              } else if (c instanceof TFolder) {
                countFiles(c);
              }
            }
          };
          
          countFiles(child);
          folderStats.push({ path: child.path, fileCount, totalSize });
          
          if (recursive) {
            walk(child, currentDepth + 1);
          }
        }
      }
    };

    walk(rootFolder, 0);

    if (folderStats.length === 0) {
      return new ToolOutputBuilder()
        .addHeader('📁', `FOLDERS IN: "${targetPath}"`)
        .addKeyValue('Status', 'No subfolders found')
        .addSeparator()
        .addSuggestions(
          'This directory has no subdirectories',
          recursive ? '' : 'Try with recursive: true to see nested folders',
        )
        .build();
    }

    // Helper to format size
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const builder = new ToolOutputBuilder();
    builder.addHeader('📁', `FOLDERS IN: "${targetPath}"`);
    builder.addKeyValue('Total folders', folderStats.length.toString());
    builder.addKeyValue('Mode', recursive ? 'Recursive' : 'Direct children only');
    builder.addSeparator();

    // Show folders with statistics
    folderStats.forEach((folder, idx) => {
      builder.addKeyValue(
        `${idx + 1}. ${folder.path}`,
        `${folder.fileCount} file${folder.fileCount === 1 ? '' : 's'} (${formatSize(folder.totalSize)})`,
      );
    });

    builder.addSeparator();
    const totalFiles = folderStats.reduce((sum, f) => sum + f.fileCount, 0);
    const totalSize = folderStats.reduce((sum, f) => sum + f.totalSize, 0);
    builder.addKeyValue('📊 Total files', totalFiles.toString());
    builder.addKeyValue('Total size', formatSize(totalSize));

    // Add suggestions
    const suggestions = [];
    if (folderStats.length > 0) {
      suggestions.push(`glob_vault_files("${folderStats[0].path}/**/*.md") - List files in first folder`);
    }
    if (!recursive && folderStats.length > 0) {
      suggestions.push(`list_vault_folders("${targetPath}", recursive=true) - See nested folders`);
    }

    if (suggestions.length > 0) {
      builder.addSuggestions(...suggestions);
    }

    return builder.build();
  }
}

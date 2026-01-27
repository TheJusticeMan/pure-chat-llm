import { App, Modal, normalizePath, Notice, Setting, TFile } from 'obsidian';
import { defineToolParameters, InferArgs, Tool } from '../tools';
import { ToolOutputBuilder } from './ToolOutputBuilder';

const deleteNoteParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The path of the note or file to delete.',
    },
  },
  required: ['path'],
} as const);

export type DeleteNoteArgs = InferArgs<typeof deleteNoteParameters>;

export class DeleteNoteTool extends Tool<DeleteNoteArgs> {
  readonly name = 'delete_obsidian_note';
  readonly classification = 'Vault';
  readonly description =
    'Deletes a note or file from the vault. This triggers a user confirmation modal.';
  readonly parameters = deleteNoteParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: DeleteNoteArgs): Promise<string> {
    const { path } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);

    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      const parentDir = normalizedPath.split('/').slice(0, -1).join('/');
      const similarGlob = parentDir ? `${parentDir}/*.md` : '*.md';
      const listFolderPath = parentDir || '/';
      return new ToolOutputBuilder()
        .addError('FileNotFoundError', `No file exists at path "${normalizedPath}"`, [
          `glob_vault_files("${similarGlob}") - Search for similar files`,
          `list_vault_folders("${listFolderPath}") - Explore directory`,
        ])
        .build();
    }

    void this.status(`Requesting confirmation to delete "${normalizedPath}"...`);

    return new Promise(resolve => {
      new DeleteConfirmationModal(app, file, result => {
        resolve(result);
      }).open();
    });
  }
}

class DeleteConfirmationModal extends Modal {
  file: TFile;
  onResolve: (result: string) => void;
  resolved = false;

  constructor(app: App, file: TFile, onResolve: (result: string) => void) {
    super(app);
    this.file = file;
    this.onResolve = onResolve;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Confirm deletion' });

    // Show file details
    const details = contentEl.createEl('div', { cls: 'delete-details' });
    details.createEl('p', { text: `File: ${this.file.path}` });
    details.createEl('p', { text: `Size: ${this.formatSize(this.file.stat.size)}` });
    details.createEl('p', {
      text: `Last modified: ${new Date(this.file.stat.mtime).toLocaleString()}`,
    });

    contentEl.createEl('p', {
      text: '⚠️  This action cannot be undone. The file will be moved to trash.',
      cls: 'mod-warning',
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Delete')
          .setWarning()
          .onClick(async () => {
            try {
              await this.app.fileManager.trashFile(this.file);
              new Notice(`Deleted "${this.file.path}".`);
              this.resolved = true;

              const result = new ToolOutputBuilder()
                .addHeader('✅', 'FILE DELETED')
                .addKeyValue('Deleted file', this.file.path)
                .addKeyValue('Size', this.formatSize(this.file.stat.size))
                .addSeparator()
                .addKeyValue('Status', '✓ Moved to trash')
                .build();

              this.onResolve(result);
              this.close();
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              this.resolved = true;

              const result = new ToolOutputBuilder()
                .addError('DeleteError', message, [
                  'Check file permissions',
                  'Ensure the file is not open in another application',
                  'Verify vault trash settings',
                ])
                .build();

              this.onResolve(result);
              this.close();
            }
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => {
          this.resolved = true;
          this.onResolve('Deletion cancelled by user.');
          this.close();
        }),
      );
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onClose() {
    if (!this.resolved) {
      this.onResolve('Deletion review cancelled.');
    }
  }
}

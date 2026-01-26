import { App, Modal, normalizePath, Notice, Setting, TFile } from 'obsidian';
import { defineToolParameters, InferArgs, Tool } from '../tools';

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
      return `Error: File not found at path "${normalizedPath}"`;
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
    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${this.file.path}"? This action cannot be undone.`,
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
              this.onResolve(`Successfully deleted "${this.file.path}".`);
              this.close();
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              this.resolved = true;
              this.onResolve(`Error deleting file: ${message}`);
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

  onClose() {
    if (!this.resolved) {
      this.onResolve('Deletion review cancelled.');
    }
  }
}

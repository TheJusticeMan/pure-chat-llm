import {
  App,
  Modal,
  Setting,
  TextAreaComponent,
  TFile,
  normalizePath,
  Notice,
  TFolder,
} from 'obsidian';

export class EditReview {
  static async prompt(
    app: App,
    path: string,
    newContent: string,
    properties: Record<string, unknown> | undefined,
    overwrite: boolean,
    instruction?: string,
  ): Promise<string> {
    return new Promise(resolve => {
      new EditReviewModal(app, path, newContent, properties, overwrite, instruction, result =>
        resolve(result),
      ).open();
    });
  }
}

class EditReviewModal extends Modal {
  path: string;
  newContent: string;
  properties?: Record<string, unknown>;
  overwrite: boolean;
  instruction?: string;
  onResolve: (result: string) => void;
  originalContent: string | null = null;
  resolved = false;

  constructor(
    app: App,
    path: string,
    newContent: string,
    properties: Record<string, unknown> | undefined,
    overwrite: boolean,
    instruction: string | undefined,
    onResolve: (result: string) => void,
  ) {
    super(app);
    this.path = normalizePath(path);
    this.newContent = newContent;
    this.properties = properties;
    this.overwrite = overwrite;
    this.instruction = instruction;
    this.onResolve = onResolve;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const file = this.app.vault.getAbstractFileByPath(this.path);
    if (file && file instanceof TFile) {
      this.originalContent = await this.app.vault.cachedRead(file);
    }

    contentEl.createEl('h2', { text: 'Review proposed edit' });

    if (this.instruction) {
      contentEl.createEl('p', { text: `Goal: ${this.instruction}`, cls: 'edit-instruction' });
    }

    contentEl.createEl('h4', { text: `File: ${this.path}` });

    // Display Properties if present
    if (this.properties && Object.keys(this.properties).length > 0) {
      new Setting(contentEl)
        .setName('Frontmatter properties')
        .setDesc('These properties will be added or updated.')
        .setHeading();
      const propPre = contentEl.createEl('pre');
      propPre.createEl('code', { text: JSON.stringify(this.properties, null, 2) });
    }

    // Original Content (if exists)
    if (this.originalContent !== null) {
      new Setting(contentEl).setName('Original content').setHeading();

      const originalArea = new TextAreaComponent(contentEl);
      originalArea.setValue(this.originalContent);
      originalArea.setDisabled(true);
      originalArea.inputEl.addClass('PUREcodePreview');
        } else {
            contentEl.createEl('p', { text: 'New file' });
        }

    // New Content
    new Setting(contentEl).setName('Proposed content').setHeading();

    const newArea = new TextAreaComponent(contentEl);
    newArea.setValue(this.newContent);
    newArea.inputEl.addClass('PUREcodePreview');
    newArea.onChange(val => {
      this.newContent = val;
    });

    // Actions
    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Approve and apply')
          .setCta()
          .onClick(async () => {
            const result = await this.applyEdit();
            this.resolved = true;
            this.onResolve(result);
            this.close();
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Reject edit').onClick(() => {
          this.resolved = true;
          this.onResolve('Edit rejected by user.');
          this.close();
        }),
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.resolved) {
      this.onResolve('Edit review cancelled.');
    }
  }

  async applyEdit(): Promise<string> {
    try {
      // 1. Ensure directory exists
      const folders = this.path.split('/').slice(0, -1);
      if (folders.length > 0) {
        let currentPath = '';
        for (const folder of folders) {
          currentPath = currentPath === '' ? folder : `${currentPath}/${folder}`;
          const existingFolder = this.app.vault.getAbstractFileByPath(currentPath);
          if (!existingFolder) {
            await this.app.vault.createFolder(currentPath);
          } else if (!(existingFolder instanceof TFolder)) {
            return `Error: Path component "${currentPath}" exists but is not a folder.`;
          }
        }
      }

      // 2. Check for existing file
      const existingFile = this.app.vault.getAbstractFileByPath(this.path);
      let targetFile: TFile;

      if (existingFile) {
        if (!this.overwrite) {
          return `Error: File "${this.path}" already exists. Set 'overwrite' to true to replace it.`;
        }
        if (!(existingFile instanceof TFile)) {
          return `Error: Path "${this.path}" exists but is not a file.`;
        }
        // Atomic update using process
        await this.app.vault.process(existingFile, () => this.newContent);
        targetFile = existingFile;
      } else {
        // Create new file
        targetFile = await this.app.vault.create(this.path, this.newContent);
      }

      // 3. Update frontmatter if properties provided
      if (this.properties && typeof this.properties === 'object') {
        await this.app.fileManager.processFrontMatter(targetFile, frontmatter => {
          Object.assign(frontmatter, this.properties);
        });
      }

      new Notice(`Successfully saved "${this.path}".`);
      return `Successfully created/updated note at "${this.path}".`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Error saving note: ${message}`);
      return `Error creating note: ${message}`;
    }
  }
}

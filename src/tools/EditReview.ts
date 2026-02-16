import { createPatch } from 'diff';
import { App, Modal, normalizePath, Notice, Setting, TFile, TFolder } from 'obsidian';
import { CodeAreaComponent } from 'src/ui/Modals';
import { ToolOutputBuilder } from './ToolOutputBuilder';

/**
 * EditReview provides user confirmation for file modifications and creations
 */
export class EditReview {
  /**
   * Prompts user to review and approve a file edit or creation
   * @param app - The Obsidian App instance
   * @param path - The file path to create or modify
   * @param newContent - The new content for the file
   * @param properties - Optional frontmatter properties to add
   * @param overwrite - Whether to overwrite existing file if it exists
   * @param instruction - Instruction text to display to the user
   * @returns Promise resolving to success message or error description
   */
  static async prompt(
    app: App,
    path: string,
    newContent: string,
    properties: Record<string, unknown> | undefined,
    overwrite: boolean,
    instruction: string,
  ): Promise<string> {
    return new Promise(resolve => {
      new EditReviewModal(app, path, newContent, properties, overwrite, instruction, result =>
        resolve(result),
      ).open();
    });
  }
}

/**
 * Modal dialog for reviewing and approving file edits
 */
class EditReviewModal extends Modal {
  originalContent: string | null = null;
  resolved = false;

  /**
   * Creates a new EditReviewModal instance
   * @param app - The Obsidian App instance
   * @param path - The file path to create or modify
   * @param newContent - The new content for the file
   * @param properties - Optional frontmatter properties to add
   * @param overwrite - Whether to overwrite existing file if it exists
   * @param instruction - Instruction text to display to the user
   * @param onResolve - Callback function to handle the user's decision
   */
  constructor(
    public app: App,
    public path: string,
    public newContent: string,
    public properties: Record<string, unknown> | undefined,
    public overwrite: boolean,
    public instruction: string,
    public onResolve: (result: string) => void,
  ) {
    super(app);
    this.path = normalizePath(path);
  }

  /**
   * Opens the modal and displays the edit review UI
   */
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const file = this.app.vault.getAbstractFileByPath(this.path);
    if (file && file instanceof TFile) {
      this.originalContent = await this.app.vault.cachedRead(file);
    }

    this.setTitle('Review proposed edit');

    new Setting(contentEl)
      .setName(`File: ${this.path}`)
      .setDesc(`Goal: ${this.instruction}`)
      .setHeading();

    // Display Properties if present
    if (this.properties && Object.keys(this.properties).length > 0) {
      new Setting(contentEl)
        .setName('Frontmatter properties')
        .setDesc('These properties will be added or updated.')
        .setHeading();
      contentEl
        .createEl('pre')
        .createEl('code', { text: JSON.stringify(this.properties, null, 2) });
    }

    // Diff
    new Setting(contentEl).setName('Changes').setHeading();

    const diffContainer = contentEl.createEl('div');
    diffContainer.addClass('diff-container');

    if (this.originalContent !== null) {
      const patch = createPatch(this.path, this.originalContent, this.newContent);
      const lines = patch.split('\n');
      for (const line of lines) {
        const div = diffContainer.createEl('div');
        const type = line.startsWith('+')
          ? 'added'
          : line.startsWith('-')
            ? 'removed'
            : line.startsWith('@@')
              ? 'hunk'
              : 'equal';
        div.addClass(`diff-${type}`);
        div.setText(line);
      }
    } else {
      diffContainer.createEl('div').setText('New file - no diff available');
    }

    // New Content
    new Setting(contentEl).setName('Proposed content').setHeading();

    const newArea = new CodeAreaComponent(contentEl);
    newArea.setValue(this.newContent);

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

  /**
   * Closes the modal and cancels the edit if not yet resolved
   */
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.resolved) {
      this.onResolve('Edit review cancelled.');
    }
  }

  /**
   * Applies the edit by creating or modifying the file
   * @returns Promise resolving to success message or error description
   */
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
            return new ToolOutputBuilder()
              .addError(
                'InvalidPathError',
                `Path component "${currentPath}" exists but is not a folder`,
                [
                  `list_vault_folders("${currentPath.split('/').slice(0, -1).join('/')}") - Inspect the parent directory`,
                  'Choose a different path that does not conflict with existing files',
                  'Rename or move the conflicting file',
                ],
              )
              .build();
          }
        }
      }

      // 2. Check for existing file
      const existingFile = this.app.vault.getAbstractFileByPath(this.path);
      let targetFile: TFile;
      const isNewFile = !existingFile;
      const originalContent = this.originalContent || '';

      if (existingFile) {
        if (!this.overwrite) {
          return new ToolOutputBuilder()
            .addError(
              'FileExistsError',
              `File "${this.path}" already exists and overwrite is not enabled`,
              [
                `read_file("${this.path}") - Review the existing file content`,
                'Set overwrite parameter to true if you want to replace the existing file',
                'Choose a different file path to avoid overwriting',
              ],
            )
            .build();
        }
        if (!(existingFile instanceof TFile)) {
          return new ToolOutputBuilder()
            .addError('InvalidPathError', `Path "${this.path}" exists but is not a file`, [
              `list_vault_folders("${this.path.split('/').slice(0, -1).join('/')}") - Inspect the containing directory`,
              'Choose a different path that does not conflict with existing folders',
            ])
            .build();
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

      // Build enhanced success message
      const builder = new ToolOutputBuilder();
      builder.addHeader(isNewFile ? 'NOTE CREATED' : 'PATCH OPERATION APPROVED');
      builder.addKeyValue('Target', this.path);

      builder.addKeyValue('Action', this.instruction);

      // Calculate changes
      const originalLines = originalContent.split('\n').length;
      const newLines = this.newContent.split('\n').length;
      const lineDiff = newLines - originalLines;
      const charCount = this.newContent.length;

      if (!isNewFile) {
        if (lineDiff !== 0) {
          builder.addKeyValue(
            'Lines changed',
            `${lineDiff > 0 ? '+' : ''}${lineDiff} (${originalLines} -> ${newLines})`,
          );
        }
        builder.addKeyValue('Total characters', charCount.toLocaleString());
      } else {
        builder.addKeyValue('Lines created', newLines.toString());
        builder.addKeyValue('Characters', charCount.toLocaleString());
      }

      builder.addSeparator();
      builder.addKeyValue('File Status', 'Saved successfully');

      // Add helpful suggestions
      builder.addSeparator();
      builder.addSuggestions(
        `manage_workspace() to open the ${isNewFile ? 'new' : 'updated'} file`,
        `read_file("${this.path}") to verify the changes`,
      );

      return builder.build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Error saving note: ${message}`);
      return new ToolOutputBuilder()
        .addError('FileSystemError', message, [
          'Check file permissions and vault configuration',
          'Verify the file path is valid',
          'Ensure no other process is locking the file',
        ])
        .build();
    }
  }
}

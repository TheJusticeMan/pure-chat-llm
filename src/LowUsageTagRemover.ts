import { Modal, App, Setting, TFile, Notice } from 'obsidian';

/**
 * Modal dialog for cleaning up low-usage tags in the vault
 * Removes tags that appear in fewer than a specified number of files
 */
export class LowUsageTagRemover extends Modal {
  /**
   * Minimum number of uses for a tag to be kept
   * @type {number}
   */
  numUses = 3;
  /**
   * Creates a new LowUsageTagRemover modal
   * @param app - The Obsidian app instance
   */
  constructor(app: App) {
    super(app);
    this.open();
  }

  /**
   *
   */
  onOpen(): void {
    const { contentEl } = this;

    new Setting(contentEl)
      .setName('Clean up tags in vault')
      .setDesc(`Remove tags that are used less than this number of times in the vault.`)
      .addText(text =>
        text
          .setPlaceholder('Number of uses')
          .setValue(this.numUses.toString())
          .onChange(value => (this.numUses = parseInt(value) || 3)),
      )
      .addButton(btn =>
        btn
          .setButtonText('Start cleanup')
          .setCta()
          .onClick(async () => this.cleanupLowUsageTags(this.numUses)),
      );
  }

  /**
   * Cleans up tags that are used less than the specified number of times
   * @param numUses - Minimum number of uses required to keep a tag
   */
  private cleanupLowUsageTags(numUses: number) {
    // Get the frequency of all tags in the vault
    // If a tag is used less than three times, remove it from the files
    // Step 1: Count tag frequencies and build a map
    const tagFrequencyFile: Record<string, TFile[]> = {};
    const files = this.app.vault.getMarkdownFiles();

    files.forEach(file => {
      const tags = this.app.metadataCache.getFileCache(file)?.frontmatter?.tags as
        | string[]
        | undefined;

      if (tags) {
        tags.forEach(tagObj => {
          if (!tagFrequencyFile[tagObj]) tagFrequencyFile[tagObj] = [];
          tagFrequencyFile[tagObj].push(file);
        });
      }
    });

    new Notice('Tag frequencies calculated. Cleaning up tags...');
    /*
---
tags:
- board-game
- javascript
- single-file
- web-development
- mobile-friendly
- inspirational
aliases:
- the
---
*/
    // Step 2: Remove tags used less than three times
    Object.entries(tagFrequencyFile).forEach(([key, fileList]) => {
      if (fileList.length <= numUses) {
        fileList.forEach(file => {
          const cache = this.app.metadataCache.getFileCache(file);
          const start = cache?.frontmatterPosition?.start.offset || 0;
          const end = cache?.frontmatterPosition?.end.offset || 0;

          void this.app.vault.process(
            file,
            content =>
              content.substring(0, start) +
              content
                .substring(start, end)
                .replace(new RegExp(`^\\s*- ${key}\\s*$`, 'm'), '')
                .replace(/\n\n/g, '\n') +
              content.substring(end),
          );
        });
        new Notice(`Removed tag from ${fileList.length} files.`);
      }
    });

    new Notice('Tags used less than three times have been removed from all files.');
    this.close();
  }

  /**
   *
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

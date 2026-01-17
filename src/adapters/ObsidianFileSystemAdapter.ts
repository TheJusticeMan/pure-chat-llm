import { App, TFile } from 'obsidian';
import { FileSystemPort } from '../ports/FileSystemPort';

/**
 * Obsidian implementation of FileSystemPort.
 * Adapts Obsidian's Vault API to the FileSystemPort interface.
 */
export class ObsidianFileSystemAdapter implements FileSystemPort {
  constructor(private app: App) {}

  async read(file: TFile): Promise<string> {
    return this.app.vault.cachedRead(file);
  }

  async write(file: TFile, content: string): Promise<void> {
    await this.app.vault.modify(file, content);
  }

  async readBinary(file: TFile): Promise<ArrayBuffer> {
    return this.app.vault.readBinary(file);
  }

  getFile(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  getFirstLinkDest(linkPath: string, sourcePath: string): TFile | null {
    return this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
  }
}

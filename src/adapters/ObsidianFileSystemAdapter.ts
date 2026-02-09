import { App, TFile } from 'obsidian';
import { FileSystemPort } from '../ports/FileSystemPort';

/**
 * Obsidian implementation of FileSystemPort.
 * Adapts Obsidian's Vault API to the FileSystemPort interface.
 */
export class ObsidianFileSystemAdapter implements FileSystemPort {
  /**
   *
   * @param app The Obsidian app instance.
   */
  constructor(private app: App) {}

  /**
   * Reads the content of a file.
   * @param file The file to read.
   *
   * @returns The file type, which is always 'file' for TFile.
   */
  async read(file: TFile): Promise<string> {
    return this.app.vault.cachedRead(file);
  }

  /**
   * Writes content to a file.
   * @param file The file to write to.
   * @param content The content to write.
   */
  async write(file: TFile, content: string): Promise<void> {
    await this.app.vault.modify(file, content);
  }

  /**
   * Reads the binary content of a file.
   * @param file The file to read.
   *
   * @returns The file type, which is always 'file' for TFile.
   */
  async readBinary(file: TFile): Promise<ArrayBuffer> {
    return this.app.vault.readBinary(file);
  }

  /**
   * Gets a file by its path.
   * @param path The path of the file to retrieve.
   *
   * @returns The file at the given path, or null if it doesn't exist or is not a TFile.
   */
  getFile(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  /**
   * Gets the first link destination for a given link path and source path.
   * @param linkPath The link path to resolve.
   * @param sourcePath The source file path containing the link.
   *
   * @returns The first linked file, or null if it doesn't exist or is not a TFile.
   */
  getFirstLinkDest(linkPath: string, sourcePath: string): TFile | null {
    return this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
  }
}

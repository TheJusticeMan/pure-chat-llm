import { TFile } from 'obsidian';

/**
 * Port interface for file system operations.
 * Abstracts file I/O to enable testing and alternative implementations.
 */
export interface FileSystemPort {
  /**
   * Read text content from a file.
   * @param file - The file to read
   * @returns Promise resolving to file content
   */
  read(file: TFile): Promise<string>;

  /**
   * Write text content to a file.
   * @param file - The file to write to
   * @param content - The content to write
   */
  write(file: TFile, content: string): Promise<void>;

  /**
   * Read binary content from a file.
   * @param file - The file to read
   * @returns Promise resolving to file binary content
   */
  readBinary(file: TFile): Promise<ArrayBuffer>;

  /**
   * Get a file by its path.
   * @param path - The file path
   * @returns The file if found, null otherwise
   */
  getFile(path: string): TFile | null;

  /**
   * Get the first link destination file.
   * @param linkPath - The link path to resolve
   * @param sourcePath - The source file path for context
   * @returns The linked file if found, null otherwise
   */
  getFirstLinkDest(linkPath: string, sourcePath: string): TFile | null;
}

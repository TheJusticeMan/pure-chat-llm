import { parseLinktext } from 'obsidian';

// Fix the error where parseLinktext does not properly handle links with display text, e.g. [[file|display]]
/**
 * Parses an Obsidian-style link and extracts its subpath, path, and display text.
 *
 * This function fixes the error where `parseLinktext` does not properly handle links with display text,
 * such as `[[file|display]]`. It uses `parseLinktext` to extract the subpath and path, then further processes
 * the path to separate the display text if present.
 *
 * @param link - The Obsidian link string to parse (e.g., `[[file|display]]`).
 * @returns An object containing:
 * - `subpath`: The extracted subpath from the link.
 * - `path`: The file path portion of the link, with any display text removed.
 * - `display`: The display text portion of the link, if present; otherwise, an empty string.
 */
export function myParseLinkText(link: string) {
  const { subpath, path } = parseLinktext(link);
  return {
    subpath,
    path: path.split('|')[0],
    display: path.includes('|') ? path.split('|')[1] : '',
  };
}

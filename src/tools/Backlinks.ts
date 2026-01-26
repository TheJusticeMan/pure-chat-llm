import { defineToolParameters, InferArgs, Tool } from '../tools';
import { normalizePath, TFile } from 'obsidian';

const backlinksParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The path of the note to find backlinks for.',
    },
  },
  required: ['path'],
} as const);

export type BacklinksArgs = InferArgs<typeof backlinksParameters>;

export class BacklinksTool extends Tool<BacklinksArgs> {
  readonly name = 'get_backlinks';
  readonly classification = 'Vault';
  readonly description =
    'Finds all notes that link to a specific note (backlinks), helping map relationships in the vault.';
  readonly parameters = backlinksParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: BacklinksArgs): Promise<string> {
    const { path } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);

    const targetFile = app.vault.getAbstractFileByPath(normalizedPath);
    if (!targetFile || !(targetFile instanceof TFile)) {
      return `Error: File not found at path "${normalizedPath}"`;
    }

    void this.status(`Finding backlinks for "${normalizedPath}"...`);

    const backlinks: string[] = [];
    const resolvedLinks = app.metadataCache.resolvedLinks;

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (links[normalizedPath]) {
        backlinks.push(sourcePath);
      }
    }

    if (backlinks.length === 0) {
      return `No backlinks found for "${normalizedPath}".`;
    }

    return `Backlinks for "${normalizedPath}":\n${backlinks.join('\n')}`;
  }
}

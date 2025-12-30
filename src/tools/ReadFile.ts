import { defineToolParameters, InferArgs, Tool } from '../tools';
import { TFile, normalizePath } from 'obsidian';

const readFileParameters = defineToolParameters({
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'The path of the file to read within the vault.',
    },
    offset: {
      type: 'integer',
      description: 'The 0-based line number to start reading from. Requires limit to be set.',
    },
    limit: {
      type: 'integer',
      description: 'The maximum number of lines to read. Defaults to 2000.',
      default: 2000,
    },
  },
  required: ['path'],
} as const);

export type ReadFileArgs = InferArgs<typeof readFileParameters>;

export class ReadFileTool extends Tool<ReadFileArgs> {
  readonly name = 'read_file';
  readonly description = 'Reads the content of a file in the Obsidian vault. Supports line-based pagination.';
  readonly parameters = readFileParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: ReadFileArgs): Promise<string> {
    const { path, offset, limit = 2000 } = args;
    const app = this.chat.plugin.app;
    const normalizedPath = normalizePath(path);

    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof TFile)) {
      return `Error: File not found at path "${normalizedPath}"`;
    }

    try {
      this.status(`Reading file "${normalizedPath}"...`);
      const content = await app.vault.cachedRead(file);
      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;

      let start = 0;
      if (typeof offset === 'number') {
        start = Math.max(0, offset);
      }

      const end = start + limit;
      const slicedLines = lines.slice(start, end);
      const result = slicedLines.join('\n');

      if (start > 0 || end < totalLines) {
        return `[File content truncated: showing lines ${start + 1}-${Math.min(end, totalLines)} of ${totalLines} total lines...]
${result}`;
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error reading file: ${message}`;
    }
  }
}

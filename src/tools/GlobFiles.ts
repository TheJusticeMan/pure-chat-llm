import GlobToRegExp from 'glob-to-regexp';
import { defineToolParameters, InferArgs, Tool } from '../tools';

const globFilesParameters = defineToolParameters({
  type: 'object',
  properties: {
    pattern: {
      type: 'string',
      description:
        "The glob pattern to match (e.g., '**/*.md' for all markdown files, 'Attachments/*.png' for images in a specific folder, or 'Daily Notes/2025-*.md' for specific years).",
    },
    include_fields: {
      type: 'array',
      items: {
        type: 'string',
        description: 'Metadata field name',
        enum: ['path', 'name', 'extension', 'size', 'mtime'],
      },
      description:
        'Specific file metadata fields to return for each match. Default is just the path.',
    },
    limit: {
      type: 'integer',
      description: 'The maximum number of results to return to prevent context window overflow.',
      default: 100,
    },
  },
  required: ['pattern'],
} as const);

export type GlobFilesArgs = InferArgs<typeof globFilesParameters>;

export class GlobFilesTool extends Tool<GlobFilesArgs> {
  readonly name = 'glob_vault_files';
  readonly description =
    'Searches the vault for file paths matching a specific glob pattern. Useful for discovering files or mapping vault structure.';
  readonly parameters = globFilesParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: GlobFilesArgs): Promise<string> {
    const { pattern, include_fields = ['path'], limit = 100 } = args;
    const app = this.chat.plugin.app;
    const files = app.vault.getFiles();

    this.status(`Searching for files matching pattern: "${pattern}"...`);

    const regex = GlobToRegExp(pattern, { globstar: true });
    const matchedFiles = files.filter(file => regex.test(file.path)).slice(0, limit);

    if (matchedFiles.length === 0) {
      return `No files found matching pattern: "${pattern}"`;
    }

    const lines = matchedFiles.map(file => {
      const fields = include_fields as string[];
      if (fields.length === 1) {
        const field = fields[0];
        if (field === 'path') return file.path;
        if (field === 'name') return file.name;
        if (field === 'extension') return file.extension;
        if (field === 'size') return file.stat.size.toString();
        if (field === 'mtime') return file.stat.mtime.toString();
      }

      const parts: string[] = [];
      if (fields.includes('path')) parts.push(`path: ${file.path}`);
      if (fields.includes('name')) parts.push(`name: ${file.name}`);
      if (fields.includes('extension')) parts.push(`extension: ${file.extension}`);
      if (fields.includes('size')) parts.push(`size: ${file.stat.size}`);
      if (fields.includes('mtime')) parts.push(`mtime: ${file.stat.mtime}`);
      return parts.join(' | ');
    });

    return lines.join('\n');
  }
}

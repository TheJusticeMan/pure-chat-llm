import GlobToRegExp from 'glob-to-regexp';
import { defineToolParameters, InferArgs, Tool } from '../tools';
import { ToolOutputBuilder } from './ToolOutputBuilder';

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
  readonly classification = 'Vault';
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

    void this.status(`Searching for files matching pattern: "${pattern}"...`);

    const regex = GlobToRegExp(pattern, { globstar: true });
    const matchedFiles = files.filter(file => regex.test(file.path)).slice(0, limit);

    if (matchedFiles.length === 0) {
      return new ToolOutputBuilder()
        .addHeader('📁', `GLOB SEARCH RESULTS: "${pattern}"`)
        .addKeyValue('Status', 'No matches found')
        .addSeparator()
        .addSuggestions(
          'Check your glob pattern syntax (e.g., "**/*.md" for all markdown files)',
          'Use list_vault_folders() to explore directory structure',
        )
        .build();
    }

    const fields = include_fields as string[];
    
    // Helper to format file size
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Helper to format time ago
    const formatTimeAgo = (timestamp: number): string => {
      const now = Date.now();
      const diff = now - timestamp;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(diff / (1000 * 60));
      
      if (days > 7) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
      if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
      if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      return 'just now';
    };

    const builder = new ToolOutputBuilder();
    builder.addHeader('📁', `GLOB SEARCH RESULTS: "${pattern}"`);
    builder.addKeyValue('Found', `${matchedFiles.length} file${matchedFiles.length === 1 ? '' : 's'} matching pattern`);
    
    if (matchedFiles.length === limit) {
      builder.addKeyValue('⚠️  Note', 'Results limited to maximum, more files may exist');
    }
    
    builder.addSeparator();

    // If requesting multiple fields, show as table
    if (fields.length > 1 || (fields.length === 1 && fields[0] !== 'path')) {
      const headers = ['#'];
      const showPath = fields.includes('path');
      const showName = fields.includes('name');
      const showExt = fields.includes('extension');
      const showSize = fields.includes('size');
      const showMtime = fields.includes('mtime');

      if (showPath || showName) headers.push(showPath ? 'File Path' : 'Name');
      if (showExt) headers.push('Ext');
      if (showSize) headers.push('Size');
      if (showMtime) headers.push('Modified');

      const rows = matchedFiles.map((file, idx) => {
        const row = [(idx + 1).toString()];
        if (showPath) row.push(file.path);
        else if (showName) row.push(file.name);
        if (showExt) row.push(file.extension);
        if (showSize) row.push(formatSize(file.stat.size));
        if (showMtime) row.push(formatTimeAgo(file.stat.mtime));
        return row;
      });

      builder.addTable(headers, rows);
    } else {
      // Simple path list
      matchedFiles.forEach((file, idx) => {
        builder.addKeyValue(`${idx + 1}`, file.path);
      });
    }

    // Add summary statistics
    builder.addSeparator();
    const totalSize = matchedFiles.reduce((sum, f) => sum + f.stat.size, 0);
    const newestFile = matchedFiles.reduce((newest, f) => 
      f.stat.mtime > newest.stat.mtime ? f : newest, matchedFiles[0]);
    
    builder.addKeyValue('📊 Total size', formatSize(totalSize));
    builder.addKeyValue('Newest file', `${newestFile.name} (${formatTimeAgo(newestFile.stat.mtime)})`);

    // Add suggestions
    const suggestions = [];
    if (matchedFiles.length > 0) {
      suggestions.push(`read_file("${matchedFiles[0].path}") to view the first match`);
    }
    if (matchedFiles.length > 3) {
      suggestions.push('Refine your pattern to narrow down results');
    }
    
    if (suggestions.length > 0) {
      builder.addSuggestions(...suggestions);
    }

    return builder.build();
  }
}

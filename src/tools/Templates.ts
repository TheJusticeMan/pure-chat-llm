import { defineToolParameters, InferArgs, Tool } from '../tools';
import { App, TFile, TFolder, normalizePath } from 'obsidian';

// Define minimal interfaces for Obsidian internal plugins and 3rd party plugins
interface ObsidianAppWithPlugins extends App {
  internalPlugins?: {
    getPluginById(id: string): {
      enabled: boolean;
      instance: {
        options: {
          folder: string;
        };
      };
    };
  };
  plugins?: {
    getPlugin(id: string): {
      settings: {
        template_folder: string;
      };
    };
  };
}

const templatesParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description:
        'The action to perform: "list" to see available templates, or "apply" to apply a template.',
      enum: ['list', 'apply'],
    },
    template_path: {
      type: 'string',
      description: 'The path to the template file (required for "apply").',
    },
    target_path: {
      type: 'string',
      description:
        'The path to the note where the template should be applied (required for "apply"). If file doesn\'t exist, it will be created.',
    },
  },
  required: ['action'],
} as const);

export type TemplatesArgs = InferArgs<typeof templatesParameters>;

export class TemplatesTool extends Tool<TemplatesArgs> {
  readonly name = 'manage_templates';
  readonly description =
    'Lists available Obsidian templates and applies them to notes. Supports both core Templates and Templater plugin folders if configured.';
  readonly parameters = templatesParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: TemplatesArgs): Promise<string> {
    const { action, template_path, target_path } = args;

    if (action === 'list') {
      return await this.listTemplates();
    }

    if (action === 'apply') {
      if (!template_path) return 'Error: "template_path" is required for "apply" action.';
      if (!target_path) return 'Error: "target_path" is required for "apply" action.';
      return await this.applyTemplate(template_path, target_path);
    }

    return 'Error: Invalid action.';
  }

  private async listTemplates(): Promise<string> {
    const app = this.chat.plugin.app as ObsidianAppWithPlugins;
    let templateFolder: string | null = null;

    // 1. Check Core Templates plugin
    const coreTemplates = app.internalPlugins?.getPluginById('templates');
    if (coreTemplates?.enabled) {
      templateFolder = coreTemplates.instance?.options?.folder;
    }

    // 2. Check Templater plugin if core is not set or to supplement
    const templater = app.plugins?.getPlugin('templater-obsidian');
    if (templater && !templateFolder) {
      templateFolder = templater.settings?.template_folder;
    }

    if (!templateFolder) {
      // Fallback: search for folders named "Templates"
      const allFolders = app.vault
        .getAllLoadedFiles()
        .filter((f): f is TFolder => f instanceof TFolder);
      const likelyFolder = allFolders.find(f => f.name.toLowerCase() === 'templates');
      if (likelyFolder) templateFolder = likelyFolder.path;
    }

    if (!templateFolder) {
      return 'Could not automatically find a templates folder. Please provide the full path to a template file if you know it.';
    }

    const folder = app.vault.getAbstractFileByPath(normalizePath(templateFolder));
    if (!folder || !(folder instanceof TFolder)) {
      return `Templates folder found at "${templateFolder}" but it is not a valid folder.`;
    }

    const templates: string[] = [];
    const walk = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile && child.extension === 'md') {
          templates.push(child.path);
        } else if (child instanceof TFolder) {
          walk(child);
        }
      }
    };
    walk(folder);

    if (templates.length === 0) {
      return `No templates found in "${templateFolder}".`;
    }

    return `Available templates in "${templateFolder}":\n${templates.join('\n')}`;
  }

  private async applyTemplate(templatePath: string, targetPath: string): Promise<string> {
    const app = this.chat.plugin.app;
    const normTemplatePath = normalizePath(templatePath);
    const normTargetPath = normalizePath(targetPath);

    const templateFile = app.vault.getAbstractFileByPath(normTemplatePath);
    if (!templateFile || !(templateFile instanceof TFile)) {
      return `Error: Template file not found at "${normTemplatePath}"`;
    }

    const templateContent = await app.vault.cachedRead(templateFile);

    // Simple variable replacement
    const now = new Date();
    const processedContent = templateContent
      .replace(/{{date}}/g, now.toISOString().split('T')[0])
      .replace(/{{time}}/g, now.toTimeString().split(' ')[0])
      .replace(/{{title}}/g, normTargetPath.split('/').pop()?.replace('.md', '') || '');

    // Check if target exists
    const targetFile = app.vault.getAbstractFileByPath(normTargetPath);
    if (targetFile && targetFile instanceof TFile) {
      // If it exists, we might want to prepend or append, but usually "apply template" means fill it.
      // For safety, let's just return the content to the LLM so it can decide how to patch it,
      // or offer to overwrite.
      return `Template content for "${normTemplatePath}":\n\n${processedContent}\n\n(Target file "${normTargetPath}" already exists. You can use 'patch_note' or 'create_obsidian_note' with overwrite:true to apply this content.)`;
    } else {
      return `Template content for "${normTemplatePath}":\n\n${processedContent}\n\n(Target file "${normTargetPath}" does not exist. You can use 'create_obsidian_note' to create it with this content.)`;
    }
  }
}

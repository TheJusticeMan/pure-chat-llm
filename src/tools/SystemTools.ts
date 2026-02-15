import { defineToolParameters, InferArgs, Tool } from '../tools';
import { App, Modal, Setting, Notice, TFile, TFolder, normalizePath } from 'obsidian';

// --- Interfaces for Plugin System ---
interface InternalPlugin {
  enabled: boolean;
  instance: {
    options: {
      folder: string;
    };
  };
}

interface TemplaterPlugin {
  settings: {
    template_folder: string;
  };
}

// Extend Obsidian App interface to support plugin access
declare module 'obsidian' {
  interface App {
    internalPlugins: {
      getPluginById(id: string): InternalPlugin | undefined;
    };
    plugins: {
      getPlugin(id: string): unknown;
    };
  }
}

// --- Plugin Settings ---
const pluginSettingsParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: { type: 'string', description: '"read" or "update"', enum: ['read', 'update'] },
    key: { type: 'string', description: 'Setting key.' },
    value: { type: 'string', description: 'New value (JSON stringified if complex).' },
  },
  required: ['action'],
} as const);

type PluginSettingsArgs = InferArgs<typeof pluginSettingsParameters>;

/**
 *
 */
export class PluginSettingsTool extends Tool<PluginSettingsArgs> {
  readonly name = 'manage_plugin_settings';
  readonly classification = 'System';
  readonly description = 'Reads or updates plugin settings. Updates require confirmation.';
  readonly parameters = pluginSettingsParameters;
  /**
   *
   */
  isAvailable() {
    return true;
  }
  /**
   *
   * @param args
   */
  async execute(args: PluginSettingsArgs): Promise<string> {
    const { action, key, value } = args;
    const settings = this.chat.plugin.settings as unknown as Record<string, unknown>;

    if (action === 'read') {
      if (key)
        return key in settings
          ? `Setting "${key}": ${JSON.stringify(settings[key], null, 2)}`
          : `Error: "${key}" not found.`;
      return `Settings:\n${JSON.stringify(settings, null, 2)}`;
    }

    if (action === 'update') {
      if (!key || value === undefined) return 'Error: "key" and "value" required for update.';
      if (!(key in settings)) return `Error: "${key}" not found.`;
      let parsed: unknown = value;
      try {
        parsed = JSON.parse(value);
      } catch {
        /* ignore */
      }

      void this.status(`Requesting update for "${key}"...`);
      return new Promise(resolve =>
        new SettingsConfirmationModal(
          this.chat.plugin.app,
          key,
          settings[key],
          parsed,
          approved => {
            if (approved) {
              settings[key] = parsed;
              this.chat.plugin
                .saveSettings()
                .then(() => {
                  new Notice(`Updated "${key}".`);
                  resolve(`Updated "${key}" to: ${JSON.stringify(parsed)}`);
                })
                .catch((e: Error) => resolve(`Error: ${e.message}`));
            } else resolve('Update rejected.');
          },
        ).open(),
      );
    }
    return 'Invalid action';
  }
}

/**
 *
 */
class SettingsConfirmationModal extends Modal {
  /**
   *
   * @param app
   * @param key
   * @param oldVal
   * @param newVal
   * @param onResolve
   */
  constructor(
    app: App,
    public key: string,
    public oldVal: unknown,
    public newVal: unknown,
    public onResolve: (a: boolean) => void,
  ) {
    super(app);
  }
  /**
   *
   */
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Confirm setting change' });
    new Setting(contentEl).setName('Key').setDesc(this.key).setHeading();
    contentEl.createEl('h4', { text: 'Current' });
    contentEl.createEl('pre').createEl('code', { text: JSON.stringify(this.oldVal, null, 2) });
    contentEl.createEl('h4', { text: 'Proposed' });
    contentEl.createEl('pre').createEl('code', { text: JSON.stringify(this.newVal, null, 2) });
    new Setting(contentEl)
      .addButton(b =>
        b
          .setButtonText('Approve')
          .setCta()
          .onClick(() => {
            this.onResolve(true);
            this.close();
          }),
      )
      .addButton(b =>
        b.setButtonText('Reject').onClick(() => {
          this.onResolve(false);
          this.close();
        }),
      );
  }
  /**
   *
   */
  onClose() {
    /* handled */
  }
}

// --- Templates ---
const templatesParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: { type: 'string', description: '"list" or "apply"', enum: ['list', 'apply'] },
    template_path: { type: 'string', description: 'Path to template.' },
    target_path: { type: 'string', description: 'Target note path.' },
  },
  required: ['action'],
} as const);

type TemplatesArgs = InferArgs<typeof templatesParameters>;

/**
 *
 */
export class TemplatesTool extends Tool<TemplatesArgs> {
  readonly name = 'manage_templates';
  readonly classification = 'System';
  readonly description = 'Lists and applies Obsidian templates.';
  readonly parameters = templatesParameters;
  /**
   *
   */
  isAvailable() {
    return true;
  }
  /**
   *
   * @param args
   */
  async execute(args: TemplatesArgs): Promise<string> {
    const { action, template_path, target_path } = args;
    if (action === 'list') return await this.listTemplates();
    if (action === 'apply') {
      if (!template_path || !target_path) return 'Error: paths required.';
      return await this.applyTemplate(template_path, target_path);
    }
    return 'Invalid action';
  }

  /**
   *
   */
  private async listTemplates(): Promise<string> {
    const app = this.chat.plugin.app;
    let folderPath = app.internalPlugins.getPluginById('templates')?.instance.options.folder;

    if (!folderPath) {
      const templater = app.plugins.getPlugin('templater-obsidian') as TemplaterPlugin | undefined;
      folderPath = templater?.settings?.template_folder;
    }

    if (!folderPath) {
      const all = app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
      folderPath = all.find(f => f.name.toLowerCase() === 'templates')?.path;
    }

    if (!folderPath) return 'No templates folder found.';
    const folder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
    if (!folder || !(folder instanceof TFolder)) return `Invalid templates folder: "${folderPath}"`;

    const templates: string[] = [];
    const walk = (f: TFolder) => {
      for (const c of f.children) {
        if (c instanceof TFile && c.extension === 'md') {
          templates.push(c.path);
        } else if (c instanceof TFolder) {
          walk(c);
        }
      }
    };
    walk(folder);
    return templates.length
      ? `Templates in "${folderPath}":\n${templates.join('\n')}`
      : `No templates in "${folderPath}".`;
  }

  /**
   *
   * @param templatePath
   * @param targetPath
   */
  private async applyTemplate(templatePath: string, targetPath: string): Promise<string> {
    const app = this.chat.plugin.app;
    const tPath = normalizePath(templatePath);
    const file = app.vault.getAbstractFileByPath(tPath);
    if (!file || !(file instanceof TFile)) return `Error: Template not found "${tPath}"`;

    const content = await app.vault.cachedRead(file);
    const now = new Date();
    const processed = content
      .replace(/{{date}}/g, now.toISOString().split('T')[0])
      .replace(/{{time}}/g, now.toTimeString().split(' ')[0])
      .replace(/{{title}}/g, normalizePath(targetPath).split('/').pop()?.replace('.md', '') || '');

    const exists = app.vault.getAbstractFileByPath(normalizePath(targetPath));
    return `Template content for "${tPath}":\n\n${processed}\n\n(Target "${targetPath}" ${exists ? 'exists' : 'does not exist'}. Use create_obsidian_note or patch_note to apply.)`;
  }
}

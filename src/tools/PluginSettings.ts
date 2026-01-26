import { defineToolParameters, InferArgs, Tool } from '../tools';
import { Modal, Setting, Notice, App } from 'obsidian';

const pluginSettingsParameters = defineToolParameters({
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description:
        'The action to perform: "read" to see current settings, or "update" to change a setting.',
      enum: ['read', 'update'],
    },
    key: {
      type: 'string',
      description: 'The setting key to read or update (e.g., "defaultmaxTokens", "SystemPrompt").',
    },
    value: {
      type: 'string',
      description:
        'The new value for the setting (required for "update"). Will be parsed as JSON if possible.',
    },
  },
  required: ['action'],
} as const);

export type PluginSettingsArgs = InferArgs<typeof pluginSettingsParameters>;

export class PluginSettingsTool extends Tool<PluginSettingsArgs> {
  readonly name = 'manage_plugin_settings';
  readonly classification = 'System';
  readonly description =
    'Reads or updates the Pure Chat LLM plugin settings. Updates trigger a user confirmation modal.';
  readonly parameters = pluginSettingsParameters;

  isAvailable(): boolean {
    return true;
  }

  async execute(args: PluginSettingsArgs): Promise<string> {
    const { action, key, value } = args;
    const plugin = this.chat.plugin;
    const settings = plugin.settings as unknown as Record<string, unknown>;

    if (action === 'read') {
      if (key) {
        if (key in settings) {
          const val = settings[key];
          return `Setting "${key}": ${JSON.stringify(val, null, 2)}`;
        }
        return `Error: Setting "${key}" not found.`;
      }
      return `Current Settings:\n${JSON.stringify(plugin.settings, null, 2)}`;
    }

    if (action === 'update') {
      if (!key) return 'Error: "key" is required for "update" action.';
      if (value === undefined) return 'Error: "value" is required for "update" action.';

      if (!(key in settings)) {
        return `Error: Setting "${key}" not found.`;
      }

      let parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // If not valid JSON, treat as raw string
      }

      const oldValue = settings[key];

      void this.status(`Requesting approval to update setting "${key}"...`);

      return new Promise(resolve => {
        new SettingsConfirmationModal(plugin.app, key, oldValue, parsedValue, approved => {
          if (approved) {
            void (async () => {
              try {
                settings[key] = parsedValue;
                await plugin.saveSettings();
                new Notice(`Successfully updated setting "${key}".`);
                resolve(`Successfully updated setting "${key}" to: ${JSON.stringify(parsedValue)}`);
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                resolve(`Error updating setting: ${message}`);
              }
            })();
          } else {
            resolve(`Update of setting "${key}" was rejected by user.`);
          }
        }).open();
      });
    }

    return 'Error: Invalid action.';
  }
}

class SettingsConfirmationModal extends Modal {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  onResolve: (approved: boolean) => void;
  resolved = false;

  constructor(
    app: App,
    key: string,
    oldValue: unknown,
    newValue: unknown,
    onResolve: (approved: boolean) => void,
  ) {
    super(app);
    this.key = key;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.onResolve = onResolve;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Review setting change' });
    contentEl.createEl('p', { text: `The agent wants to update the following plugin setting:` });

    new Setting(contentEl).setName('Setting key').setDesc(this.key).setHeading();

    const diffContainer = contentEl.createDiv('settings-diff-container');

    const oldCol = diffContainer.createDiv('settings-diff-col');
    oldCol.createEl('h4', { text: 'Current value' });
    oldCol.createEl('pre').createEl('code', { text: JSON.stringify(this.oldValue, null, 2) });

    const newCol = diffContainer.createDiv('settings-diff-col');
    newCol.createEl('h4', { text: 'Proposed value' });
    newCol.createEl('pre').createEl('code', { text: JSON.stringify(this.newValue, null, 2) });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Approve and apply')
          .setCta()
          .onClick(() => {
            this.resolved = true;
            this.onResolve(true);
            this.close();
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Reject').onClick(() => {
          this.resolved = true;
          this.onResolve(false);
          this.close();
        }),
      );
  }

  onClose() {
    if (!this.resolved) {
      this.onResolve(false);
    }
  }
}

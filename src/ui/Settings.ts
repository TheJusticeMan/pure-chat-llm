import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
  SettingGroupItem,
} from 'obsidian';
import { DEFAULT_SETTINGS, PureChatLLMversion } from 'src/assets/constants';
import { PureChatLLMChat } from '../core/Chat';
import { ImportChatGPT } from '../core/ImportChatGPT';
import PureChatLLM from '../main';
import { PURE_CHAT_LLM_ICON_NAME, PureChatLLMSettings } from '../types';
import { AskForAPI, EditEndpointModal, EditSelectionTemplateModal } from './Modals';

/**
 * Represents the settings tab for the PureChatLLM plugin in Obsidian.
 *
 * This class extends `PluginSettingTab` and provides a user interface for configuring
 * various settings related to the PureChatLLM plugin, such as selecting endpoints,
 * managing API keys, setting the default system prompt, enabling debug mode, and
 * configuring the auto-generation of conversation titles.
 *
 * @remarks
 * The settings tab dynamically generates UI elements based on the plugin's current settings.
 * It allows users to interactively update settings, which are then persisted using the plugin's
 * `saveSettings` method.
 *
 * @extends PluginSettingTab
 *
 * @see PureChatLLM
 */
export class PureChatLLMSettingTab extends PluginSettingTab {
  plugin: PureChatLLM;
  icon: string = PURE_CHAT_LLM_ICON_NAME;

  /**
   * Creates a new settings tab instance.
   *
   * @param app - The Obsidian application instance
   * @param plugin - The PureChatLLM plugin instance
   */
  constructor(app: App, plugin: PureChatLLM) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Updates a specific setting value and saves to storage.
   *
   * @param key - The setting key to update
   * @param value - The new value for the setting
   * @returns A promise that resolves when the setting is saved
   */
  async sett<S extends keyof PureChatLLMSettings>(key: S, value: PureChatLLMSettings[S]) {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }

  /**
   * Retrieves the setting definitions for the plugin.
   *
   * @returns An array of setting definition items that define the UI structure and behavior
   * of the settings tab.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const { settings } = this.plugin;
    return [
      {
        type: 'group',
        items: [
          {
            name: 'Model provider',
            desc: 'Choose the default model provider. Configure API keys.',
            render: setting =>
              void setting
                .addDropdown(dropdown =>
                  dropdown
                    .addOptions(
                      Object.fromEntries(settings.endpoints.map((e, i) => [i.toString(), e.name])),
                    )
                    .setValue(settings.endpoint.toString())
                    .onChange(async value => await this.sett('endpoint', parseInt(value, 10))),
                )
                .addButton(btn =>
                  btn
                    .setIcon('key')
                    .setTooltip('Add API key')
                    .onClick(async () => new AskForAPI(this.plugin).open()),
                )
                .addButton(
                  // fixes issue that you can't refresh models after the first time
                  btn =>
                    btn
                      .setIcon('refresh-cw')
                      .setTooltip('Refresh list of models')
                      .onClick(async () => loadAllModels(this.plugin)),
                ),
          },
          {
            name: 'Default system prompt',
            desc: 'System message or file for each new chat.',
            control: {
              type: 'text',
              key: 'SystemPrompt',
              placeholder: DEFAULT_SETTINGS.SystemPrompt,
            },
          },
          {
            name: 'Default token count',
            desc: 'Default max tokens for models that support it.',
            control: {
              type: 'number',
              key: 'defaultmaxTokens',
            },
          },
          {
            type: 'page',
            name: 'Custom LLM providers',
            desc: 'Add custom LLM providers with API keys.',
            items: [
              {
                type: 'list',
                name: 'Custom LLM providers',
                desc: 'Add custom LLM providers with API keys.',
                addItem: {
                  name: 'Add provider',
                  action: () =>
                    new EditEndpointModal(
                      this.app,
                      { name: '', apiKey: '', endpoint: '', defaultmodel: '', getapiKey: '' },
                      ep => {
                        if (ep.name) {
                          this.plugin.settings.endpoints.push(ep);
                          void this.plugin.saveSettings();
                          this.update();
                        }
                      },
                    ).open(),
                },
                items: settings.endpoints.map((endpoint, index) => ({
                  name: endpoint.name,
                  render: (setting: Setting) =>
                    void setting.addExtraButton(btn =>
                      btn.setIcon('pencil').onClick(() =>
                        new EditEndpointModal(this.app, { ...endpoint }, ep => {
                          this.plugin.settings.endpoints[index] = ep;
                          void this.plugin.saveSettings();
                          this.update();
                        }).open(),
                      ),
                    ),
                  searchable: false,
                })),
                onReorder: (oldIndex: number, newIndex: number) => {
                  const endpoints = [...this.plugin.settings.endpoints];
                  const [moved] = endpoints.splice(oldIndex, 1);
                  endpoints.splice(newIndex, 0, moved);
                  this.plugin.settings.endpoints = endpoints;
                  void this.plugin.saveSettings();
                },
                onDelete: (idx: number) => {
                  this.plugin.settings.endpoints.splice(idx, 1);
                  void this.plugin.saveSettings();
                  this.update();
                },
              },
            ],
          },
        ],
      },
      {
        type: 'group',
        name: 'Agent & capabilities',
        items: [
          {
            name: 'Agent mode',
            desc: 'Enable this to allow the LLM to use tools (e.g., creating notes, searching the vault).',
            control: {
              type: 'toggle',
              key: 'agentMode',
            },
          },
          {
            name: 'Enabled tool classifications',
            desc: 'Control which categories of tools are available to the agent.',
            render: setting =>
              void (['Vault', 'UI', 'System', 'AI'] as const).forEach(classification => {
                setting.addButton(btn => {
                  if (settings.enabledToolClassifications[classification] ?? true) btn.setCta();
                  return btn.setButtonText(classification).onClick(async () => {
                    settings.enabledToolClassifications[classification] = !(
                      settings.enabledToolClassifications[classification] ?? true
                    );
                    if (settings.enabledToolClassifications[classification]) btn.setCta();
                    else btn.removeCta();
                    await this.plugin.saveSettings();
                  });
                });
              }),
          },
          {
            name: 'Realtime system prompt file',
            desc: 'Path to a file the system prompt for voice calls. Defaults to built-in prompts.',
            control: {
              type: 'file',
              key: 'realtimeSystemPromptFile',
              filter: file => file.extension === 'md',
            },
          },
        ],
      },
      {
        type: 'group',
        name: 'Prompts & templates',
        items: [
          this.makeTemplatePageItem(
            'Selection commands',
            'Edit selection prompt templates for the selection commands.',
            'selectionTemplates',
          ),
          this.makeTemplatePageItem(
            'Chat analyze commands',
            'Edit chat prompt templates for the analyze commands.',
            'chatTemplates',
          ),
          {
            name: 'Import/export templates',
            desc: 'Import or export selection and chat prompt templates to/from PureChatLLM-Templates.md.',
            render: setting =>
              void setting
                .addButton(btn =>
                  btn.setButtonText('Export').onClick(() => {
                    const { selectionTemplates, chatTemplates } = this.plugin.settings;
                    const content = getMarkdownFromObject({ selectionTemplates, chatTemplates });
                    const filePath = 'PureChatLLM-Templates.md';
                    const file = this.app.vault.getFileByPath(filePath);
                    if (file) void this.app.vault.modify(file, content);
                    else void this.app.vault.create(filePath, content).then(() => this.update());
                    new Notice('Templates exported to PureChatLLM-Templates.md');
                  }),
                )
                .addButton(btn =>
                  btn
                    .setButtonText('Import')
                    .then(btn =>
                      this.app.vault.getFileByPath('PureChatLLM-Templates.md')
                        ? btn
                        : btn.setDisabled(true),
                    )
                    .onClick(() => {
                      const file = this.app.vault.getFileByPath('PureChatLLM-Templates.md');
                      if (file)
                        void this.app.vault.cachedRead(file).then(data => {
                          this.plugin.settings = {
                            ...this.plugin.settings,
                            ...getObjectFromMarkdown(data, 1, 2),
                          };
                          void this.plugin.saveSettings();
                          new Notice('Templates imported.');
                        });
                    }),
                ),
          },
        ],
      },
      {
        type: 'group',
        name: 'Chat behavior & storage',
        items: [
          {
            name: 'Autogenerate title',
            desc: 'How long chat before creating a conversation title (set to 0 to disable).',
            control: {
              type: 'number',
              key: 'AutogenerateTitle',
            },
          },
          {
            name: 'Use YAML front matter',
            desc: 'Store chat metadata in YAML front matter instead of HTML comments.',
            control: {
              type: 'toggle',
              key: 'useYAMLFrontMatter',
            },
          },
          {
            name: 'Chat style',
            desc: 'Select how chats are written and interpreted in markdown',
            control: {
              type: 'text',
              key: 'messageRoleFormatter',
              placeholder: DEFAULT_SETTINGS.messageRoleFormatter,
              validate: value =>
                !value || !value.includes('{role}')
                  ? 'The chat style must include the {role} placeholder.'
                  : undefined,
            },
          },
          {
            name: 'Add file to context for editing',
            desc: 'Include the current file content in the context for selection editing.',
            control: {
              type: 'toggle',
              key: 'addfiletocontext',
            },
          },
          {
            name: 'Include linked files in chat analysis',
            desc: 'Automatically include linked files when using chat analysis commands.',
            control: {
              type: 'toggle',
              key: 'resolveFilesForChatAnalysis',
            },
          },
          {
            name: 'Maximum recursion depth',
            desc: 'Maximum depth for recursive [[link]] resolution (1-20). Default is 10.',
            control: {
              type: 'slider',
              key: 'maxRecursionDepth',
              min: 1,
              max: 20,
              step: 1,
            },
          },
        ],
      },
      {
        name: 'Utilities & maintenance',
        type: 'group',
        items: [
          {
            name: 'Import ChatGPT conversations',
            desc: `Import conversations exported from ${'chat.openai.com'}.`,
            action: (el: HTMLElement) => new ImportChatGPT(this.app, this.plugin, el),
          },
          {
            name: 'Debug',
            desc: 'Enable logging of debug information in the console.',
            control: {
              type: 'toggle',
              key: 'debug',
            },
          },
          {
            name: 'Version',
            desc: `v${PureChatLLMversion}`,
          },
        ],
      },
    ];
  }

  /**
   * Builds a page-type list item for editing a named template map in settings.
   * @param name - Display name for the setting and page heading
   * @param desc - Description shown below the setting name
   * @param key - The settings key of the template map to edit
   * @returns A setting definition item of type 'page' containing the list editor
   */
  private makeTemplatePageItem(
    name: string,
    desc: string,
    key: 'selectionTemplates' | 'chatTemplates',
  ): SettingGroupItem {
    const { settings } = this.plugin;
    return {
      name,
      desc,
      type: 'page',
      items: [
        {
          type: 'list',
          name,
          desc,
          addItem: {
            name: 'Add template',
            action: () =>
              new EditSelectionTemplateModal(
                this.app,
                this.plugin,
                this.plugin.settings[key],
                '',
                '',
                (k, value) => {
                  this.plugin.settings[key][k] = value;
                  void this.plugin.saveSettings();
                  this.update();
                },
              ).open(),
          },
          onReorder: (oldIndex: number, newIndex: number) => {
            const folders = Object.entries(this.plugin.settings[key]);
            const [moved] = folders.splice(oldIndex, 1);
            folders.splice(newIndex, 0, moved);
            this.plugin.settings[key] = Object.fromEntries(folders);
            void this.plugin.saveSettings();
          },
          onDelete: (idx: number) => {
            delete this.plugin.settings[key][Object.keys(this.plugin.settings[key])[idx]];
            void this.plugin.saveSettings();
            this.update();
          },
          items: Object.keys(settings[key]).map(k => ({
            name: k,
            render: (setting: Setting) =>
              void setting.addExtraButton(btn =>
                btn.setIcon('pencil').onClick(() =>
                  new EditSelectionTemplateModal(
                    this.app,
                    this.plugin,
                    this.plugin.settings[key],
                    k,
                    settings[key][k],
                    (newKey, value) => {
                      if (newKey !== k) delete this.plugin.settings[key][k];

                      this.plugin.settings[key][newKey] = value;
                      void this.plugin.saveSettings();
                      this.update();
                    },
                  ).open(),
                ),
              ),
            searchable: false,
          })),
        },
      ],
    };
  }
}

/**
 * Loads all available models for all configured endpoints.
 *
 * @param plugin - The PureChatLLM plugin instance
 */
function loadAllModels(plugin: PureChatLLM): void {
  const currentEndpoint = plugin.settings.endpoint;
  plugin.settings.endpoints.forEach((endpoint, index) => {
    try {
      plugin.settings.endpoint = index;
      plugin.settings.ModelsOnEndpoint[endpoint.name] = [];
      void new PureChatLLMChat(plugin).getAllModels().then(models => {
        void plugin.saveSettings();
        new Notice('Model list refreshed');
      });
    } catch (e) {
      plugin.console.error('Error loading models for endpoint', endpoint.name, e);
    }
  });
  plugin.settings.endpoint = currentEndpoint;
}
/**
 * Converts a markdown string into a nested object structure based on heading levels.
 *
 * @param rawMarkdown - The raw markdown text to parse
 * @param level - The current heading level to parse
 * @param maxlevel - The maximum heading level to parse
 * @returns An object representing the markdown structure
 */
function getObjectFromMarkdown(
  rawMarkdown: string,
  level = 1,
  maxlevel = 6,
): Record<string, string | Record<string, object | string>> {
  return Object.fromEntries(
    rawMarkdown
      .trim()
      .split(new RegExp(`^${'#'.repeat(level)} `, 'gm'))
      .slice(1)
      .map((s): [string, string | Record<string, object | string>] => {
        const [title, ...content] = s.split('\n');
        const joinedContent = content.join('\n');
        if (level < maxlevel && joinedContent.includes('\n' + '#'.repeat(level + 1) + ' ')) {
          return [title.trim(), getObjectFromMarkdown(joinedContent, level + 1, maxlevel)];
        }
        return [title.trim(), joinedContent.trim()];
      }),
  );
}

/**
 * Converts a nested object structure into a markdown string with headings.
 *
 * @param obj - The object to convert to markdown
 * @param level - The current heading level
 * @returns The markdown representation of the object
 */
function getMarkdownFromObject(
  obj: Record<string, string | Record<string, string | object>>,
  level = 1,
): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      const prefix = '#'.repeat(level);
      if (typeof value === 'string') {
        return `${prefix} ${key}\n\n${value}\n`;
      } else if (typeof value === 'object' && value !== null) {
        // Cast value to the expected type for recursion
        return `${prefix} ${key}\n\n${getMarkdownFromObject(
          value as Record<string, string | Record<string, string | object>>,
          level + 1,
        )}`;
      } else {
        return `${prefix} ${key}\n\n${String(value)}\n`;
      }
    })
    .join('\n');
}

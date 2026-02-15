import {
  AbstractInputSuggest,
  App,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  SettingGroup,
  TFile,
} from 'obsidian';
import { DEFAULT_SETTINGS, PureChatLLMversion } from 'src/assets/constants';
import { PureChatLLMChat } from '../core/Chat';
import { ImportChatGPT } from '../core/ImportChatGPT';
import PureChatLLM from '../main';
import { PURE_CHAT_LLM_ICON_NAME, PureChatLLMSettings } from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';
import { AskForAPI, CodeAreaComponent, EditModalProviders } from './Modals';

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
   *
   * @param app
   * @param plugin
   */
  constructor(app: App, plugin: PureChatLLM) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   *
   * @param key
   * @param value
   */
  async sett<S extends keyof PureChatLLMSettings>(key: S, value: PureChatLLMSettings[S]) {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }

  /**
   *
   * @param key
   */
  ifdefault<S extends keyof PureChatLLMSettings>(key: S): string {
    const { settings } = this.plugin;
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return settings[key] !== DEFAULT_SETTINGS[key] ? String(settings[key] ?? '') : '';
  }

  /**
   *
   */
  display(): void {
    const {
      containerEl,
      plugin: { settings },
    } = this;

    containerEl.empty();
    new SettingGroup(containerEl)
      .addSetting(
        setting =>
          void setting
            .setName('Model provider')
            .setDesc('Choose the default model provider. Configure API keys.')
            .addDropdown(dropdown =>
              dropdown
                .addOptions(
                  Object.fromEntries(settings.endpoints.map((e, i) => [i.toString(), e.name])),
                )
                .setValue(settings.endpoint.toString())
                .onChange(async value => {
                  await this.sett('endpoint', parseInt(value, 10));
                  this.plugin.modellist = [];
                }),
            )
            .addButton(btn =>
              btn
                .setIcon('key')
                .setTooltip('Add API key')
                .onClick(async () => new AskForAPI(this.app, this.plugin).open()),
            )
            .addButton(
              // fixes issue that you can't refresh models after the first time
              btn =>
                btn
                  .setIcon('refresh-cw')
                  .setTooltip('Refresh list of models')
                  .onClick(async () => {
                    loadAllModels(this.plugin);
                    /* this.plugin.settings.ModelsOnEndpoint[
                      this.plugin.settings.endpoints[this.plugin.settings.endpoint].name
                    ] = [];
                    void new PureChatLLMChat(this.plugin).getAllModels().then(models => {
                      void this.plugin.saveSettings();
                      new Notice('Model list refreshed');
                    }); */
                  }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Default system prompt')
            .setDesc('System message or file for each new chat.')
            .setClass('PURE')
            .addText(text =>
              new FileInputSuggest(
                this.app,
                text
                  .setPlaceholder(DEFAULT_SETTINGS.SystemPrompt)
                  .setValue(this.ifdefault('SystemPrompt'))
                  .onChange(
                    async value =>
                      await this.sett('SystemPrompt', value || DEFAULT_SETTINGS.SystemPrompt),
                  ).inputEl,
              ).onSelect((file: TFile) =>
                text.setValue(this.plugin.app.fileManager.generateMarkdownLink(file, file.path)),
              ),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Default token count')
            .setDesc('Default max tokens for models that support it.')
            .addText(text =>
              text
                .setPlaceholder(DEFAULT_SETTINGS.defaultmaxTokens.toString())
                .setValue(this.ifdefault('defaultmaxTokens'))
                .onChange(
                  async value =>
                    await this.sett(
                      'defaultmaxTokens',
                      Number(value || DEFAULT_SETTINGS.defaultmaxTokens) ||
                        DEFAULT_SETTINGS.defaultmaxTokens ||
                        4096,
                    ),
                ),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Custom LLM providers')
            .setDesc(
              'Add custom LLM providers with API keys. These will be available in the model provider dropdown.',
            )
            .addButton(btn =>
              btn
                .setButtonText('Add custom provider')
                .setCta()
                .onClick(() => new EditModalProviders(this.app, this.plugin).open()),
            ),
      );

    new SettingGroup(containerEl)
      .setHeading('Agent & capabilities')
      .addSetting(
        setting =>
          void setting
            .setName('Agent mode')
            .setDesc(
              'Enable this to allow the LLM to use tools (e.g., creating notes, searching the vault).',
            )
            .addToggle(toggle =>
              toggle
                .setValue(settings.agentMode)
                .onChange(async value => await this.sett('agentMode', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Enabled tool classifications')
            .setDesc('Control which categories of tools are available to the agent.')
            .then(() => {
              (['Vault', 'UI', 'System', 'AI'] as const).forEach(classification => {
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
              });
            }),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Use OpenAI image generation')
            .setDesc(
              "Enable this to use OpenAI's DALL-E for image generation. Requires an OpenAI API key.",
            )
            .addToggle(toggle =>
              toggle
                .setValue(settings.useImageGeneration)
                .onChange(async value => await this.sett('useImageGeneration', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Realtime system prompt file')
            .setDesc(
              'Path to a file containing the system prompt for voice calls. If empty or not found, defaults to built-in prompts.',
            )
            .addText(text =>
              new FileInputSuggest(
                this.app,
                text
                  .setPlaceholder('e.g., System Prompts/Realtime.md')
                  .setValue(this.ifdefault('realtimeSystemPromptFile'))
                  .onChange(
                    async value =>
                      await this.sett(
                        'realtimeSystemPromptFile',
                        value || DEFAULT_SETTINGS.realtimeSystemPromptFile,
                      ),
                  ).inputEl,
              ).onSelect((file: TFile) => text.setValue(file.path)),
            ),
      );
    new SettingGroup(containerEl)
      .setHeading('Prompts & templates')
      .addSetting(
        setting =>
          void setting
            .setName('Selection commands')
            .setDesc('Edit selection prompt templates for the selection commands.')
            .addButton(btn =>
              btn
                .setButtonText('Edit prompts')
                //.setCta()
                .setTooltip('Edit selection prompt templates')
                .onClick(() =>
                  new SelectionPromptEditor(
                    this.app,
                    this.plugin,
                    this.plugin.settings.selectionTemplates,
                    { ...DEFAULT_SETTINGS.selectionTemplates },
                    this.plugin.settings.CMDselectionTemplates,
                  ).open(),
                ),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Chat analyze commands')
            .setDesc('Edit chat prompt templates for the analyze commands.')
            .addButton(btn =>
              btn
                .setButtonText('Edit prompts')
                //.setCta()
                .setTooltip('Edit chat prompt templates')
                .onClick(() =>
                  new SelectionPromptEditor(
                    this.app,
                    this.plugin,
                    this.plugin.settings.chatTemplates,
                    { ...DEFAULT_SETTINGS.chatTemplates },
                    settings.CMDchatTemplates,
                  ).open(),
                ),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Import/export templates')
            .setDesc(
              'Import or export selection and chat prompt templates to/from PureChatLLM-Templates.md.',
            )
            .addButton(btn =>
              btn.setButtonText('Export').onClick(() => {
                const { selectionTemplates, chatTemplates } = this.plugin.settings;
                const content = getMarkdownFromObject({ selectionTemplates, chatTemplates });
                const filePath = 'PureChatLLM-Templates.md';
                const file = this.app.vault.getFileByPath(filePath);
                if (file) void this.app.vault.modify(file, content);
                else void this.app.vault.create(filePath, content);
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
                  if (file) {
                    void this.app.vault.cachedRead(file).then(data => {
                      this.plugin.settings = {
                        ...this.plugin.settings,
                        ...getObjectFromMarkdown(data, 1, 2),
                      };
                      void this.plugin.saveSettings();
                      new Notice('Templates imported. Please review them in the prompt editor.');
                    });
                  } else {
                    new Notice('PureChatLLM-Templates.md not found.');
                  }
                }),
            ),
      );
    new SettingGroup(containerEl)
      .setHeading('Chat behavior & storage')
      .addSetting(
        setting =>
          void setting
            .setName('Autogenerate title')
            .setDesc(
              'How many responses to wait for before automatically creating a conversation title (set to 0 to disable).',
            )
            .addText(text =>
              text
                .setPlaceholder(DEFAULT_SETTINGS.AutogenerateTitle.toString())
                .setValue(this.ifdefault('AutogenerateTitle'))
                .onChange(
                  async value =>
                    await this.sett(
                      'AutogenerateTitle',
                      Number(value || DEFAULT_SETTINGS.AutogenerateTitle) || 0,
                    ),
                ),
            ),
      ) //YAML front matter
      .addSetting(
        setting =>
          void setting
            .setName('Use YAML front matter')
            .setDesc('Store chat metadata in YAML front matter instead of HTML comments.')
            .addToggle(toggle =>
              toggle
                .setValue(settings.useYAMLFrontMatter)
                .onChange(async value => await this.sett('useYAMLFrontMatter', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Chat style')
            .setDesc('Select how chats are written and interpreted in markdown')
            .addText(text =>
              text
                .setPlaceholder(DEFAULT_SETTINGS.messageRoleFormatter)
                .setValue(this.ifdefault('messageRoleFormatter'))
                .onChange(
                  async value =>
                    await this.sett(
                      'messageRoleFormatter',
                      (value.includes('{role}') && value + ' {role}') ||
                        value ||
                        DEFAULT_SETTINGS.messageRoleFormatter,
                    ),
                ),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Auto-concat messages from same role')
            .setDesc(
              'Automatically combine consecutive messages from the same role into a single message.',
            )
            .addToggle(toggle =>
              toggle
                .setValue(settings.autoConcatMessagesFromSameRole)
                .onChange(async value => await this.sett('autoConcatMessagesFromSameRole', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Remove empty messages')
            .setDesc('Automatically remove messages with empty content when saving/loading chats.')
            .addToggle(toggle =>
              toggle
                .setValue(settings.removeEmptyMessages)
                .onChange(async value => await this.sett('removeEmptyMessages', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Auto reverse roles')
            .setDesc(
              'Automatically switch roles when the last message is empty, for replying to self.',
            )
            .addToggle(toggle =>
              toggle
                .setValue(settings.AutoReverseRoles)
                .onChange(async value => await this.sett('AutoReverseRoles', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Add file to context for editing')
            .setDesc('Include the current file content in the context for selection editing.')
            .addToggle(toggle =>
              toggle
                .setValue(settings.addfiletocontext)
                .onChange(async value => await this.sett('addfiletocontext', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('File resolution in chat analysis')
            .setDesc(
              'Enable this to automatically resolve and include file contents when using chat analysis commands. This helps provide context from linked files in the conversation.',
            )
            .addToggle(toggle =>
              toggle
                .setValue(settings.resolveFilesForChatAnalysis)
                .onChange(async value => await this.sett('resolveFilesForChatAnalysis', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Maximum recursion depth')
            .setDesc(
              'Maximum depth for recursive [[link]] resolution (1-20). Prevents infinite loops. Default is 10.',
            )
            .addText(text =>
              text
                .setPlaceholder('10')
                .setValue(settings.maxRecursionDepth.toString())
                .onChange(async value => {
                  const num = parseInt(value);
                  if (!isNaN(num) && num >= 1 && num <= 20) {
                    await this.sett('maxRecursionDepth', num);
                  }
                }),
            ),
      );

    new SettingGroup(containerEl)
      .setHeading('Utilities & maintenance')
      .addSetting(
        setting =>
          void setting
            .setName('Import ChatGPT conversations')
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .setDesc('Import conversations exported from chat.openai.com.')
            .addButton(btn => {
              btn
                .setButtonText('Import')
                .setCta()
                .onClick(() => new ImportChatGPT(this.app, this.plugin));
            }),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Debug')
            .setDesc(
              'Enable logging of detailed debug information in the console for troubleshooting.',
            )
            .addToggle(toggle =>
              toggle.setValue(settings.debug).onChange(async value => {
                await this.sett('debug', value);

                this.plugin.console = new BrowserConsole(settings.debug, 'PureChatLLM');
                //console.log('reload the plugin to apply the changes');
              }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Version')
            .setDesc(`v${PureChatLLMversion}`)
            .addButton(btn =>
              btn
                .setButtonText('Reset settings')
                .setTooltip("Won't delete the API keys.")
                .setWarning()
                .onClick(e => {
                  const oldSettings = { ...this.plugin.settings };
                  this.plugin.settings = { ...DEFAULT_SETTINGS };
                  this.plugin.settings.endpoints.forEach((ep, endpoint) => {
                    if (DEFAULT_SETTINGS.endpoints[endpoint])
                      this.plugin.settings.endpoints[endpoint].apiKey =
                        oldSettings.endpoints[endpoint].apiKey;
                  });
                  void this.plugin.saveSettings();
                  this.display();
                  new Notice('Settings reset to defaults.  API keys are unchanged.');
                }),
            )
            .addButton(btn =>
              btn
                .setButtonText('Hot keys')
                .setCta()
                .onClick(e => this.plugin.openHotkeys()),
            ),
      );
  }
}

/**
 *
 * @param plugin
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
 * Modal dialog for editing and managing selection prompt templates within the PureChatLLM plugin.
 *
 * This class provides a UI for users to create, select, and edit named prompt templates
 * that are stored in the plugin's settings. It features a dropdown for selecting existing
 * templates, a button to add new templates, and a code editor area for editing the template content.
 *
 * @extends Modal
 */
class SelectionPromptEditor extends Modal {
  /**
   * Description placeholder
   *
   * @type {string}
   */
  promptTitle: string;
  /**
   *
   * @param app
   * @param plugin
   */
  constructor(
    app: App,
    private plugin: PureChatLLM,
    private promptTemplates: { [key: string]: string },
    private defaultTemplates: { [key: string]: string } = {},
    private inCMD: { [key: string]: boolean } = {},
  ) {
    super(app);
    this.plugin = plugin;
    this.update();
  }
  /**
   *
   */
  update() {
    this.contentEl.empty();
    if (!this.promptTitle)
      this.promptTitle = Object.keys(this.promptTemplates)[0] || 'New template';
    if (this.promptTitle && !this.promptTemplates[this.promptTitle])
      this.promptTemplates[this.promptTitle] = '';
    Object.keys(this.promptTemplates).forEach(key => (this.inCMD[key] = Boolean(this.inCMD[key])));
    const isAllinCMD = Object.values(this.inCMD).every(v => v);
    new Setting(this.contentEl)
      .setName('All templates')

      .setDesc('Manage all prompt templates for the Pure Chat LLM plugin.')
      .setHeading()
      .addExtraButton(btn =>
        btn
          .setIcon(isAllinCMD ? 'minus' : 'plus')
          .setTooltip(isAllinCMD ? 'Remove all from command palette' : 'Add all to command palette')
          .onClick(() => {
            Object.keys(this.inCMD).forEach(key => (this.inCMD[key] = !isAllinCMD));
            this.update();
          }),
      )
      .addExtraButton(btn =>
        btn
          .setIcon('trash')
          .setTooltip('Delete all templates')
          .onClick(() => {
            Object.keys(this.promptTemplates).forEach(key => {
              delete this.promptTemplates[key];
              delete this.inCMD[key];
            });
            this.promptTitle = 'New template';
            this.update();
          }),
      );
    Object.keys(this.promptTemplates)
      .sort()
      .forEach(
        key =>
          void new Setting(this.contentEl)
            .setName(key !== this.promptTitle ? key : 'Editing...')
            .addExtraButton(btn =>
              btn
                .setIcon(this.inCMD[key] ? 'minus' : 'plus')
                .setTooltip('Use this template in the command palette')
                .onClick(() => {
                  this.inCMD[key] = !this.inCMD[key];
                  this.update();
                }),
            )
            .addExtraButton(btn =>
              btn
                .setIcon('trash')
                .setTooltip('Delete this template')
                .onClick(() => {
                  delete this.promptTemplates[key];
                  this.promptTitle = Object.keys(this.promptTemplates)[0];
                  this.update();
                }),
            )
            .addButton(btn => {
              btn
                .setIcon('pencil')
                .setTooltip('Edit this template')
                .onClick(() => {
                  this.promptTitle = key;
                  this.update();
                });
              if (key === this.promptTitle) btn.setCta();
            }),
      );
    new Setting(this.contentEl).setName('Add a new template').addText(text => {
      text.setPlaceholder('New template title').setValue('');
      text.inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const value = text.getValue().trim();
          if (value) this.generateTemplateContent(value);
        }
      });
      text.inputEl.addEventListener('blur', () => {
        const value = text.getValue().trim();
        if (value) this.generateTemplateContent(value);
      });
    });

    new Setting(this.contentEl)
      .setName('Template name')
      .setHeading()

      .setTooltip('Change the name of the current template.')
      .addText(text => {
        text
          .setPlaceholder('Template name')
          .setValue(this.promptTitle)
          .onChange(value => {
            if (value && value !== this.promptTitle) {
              this.promptTemplates[value] = this.promptTemplates[this.promptTitle];
              delete this.promptTemplates[this.promptTitle];
              this.promptTitle = value;
              this.setTitle(this.promptTitle);
              //this.update();
            }
          });
      });
    new CodeAreaComponent(this.contentEl)
      .setValue(this.promptTemplates[this.promptTitle])
      .onChange(value => (this.promptTemplates[this.promptTitle] = value));
    new Setting(this.contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(async () => this.close()),
      )
      .addButton(btn =>
        btn
          .setButtonText('Reset all')
          .setTooltip('Reset all templates to default values.')
          .setWarning()
          .onClick(async () => {
            Object.assign(this.promptTemplates, this.defaultTemplates);
            this.promptTitle = Object.keys(this.promptTemplates)[0] || 'New template';
            this.update();
          }),
      );
    this.setTitle(this.promptTitle);
  }

  /**
   *
   * @param value
   */
  private generateTemplateContent(value: string) {
    this.promptTitle = value;
    if (!this.promptTemplates[this.promptTitle]) this.promptTemplates[this.promptTitle] = '';
    const promptTemplatesSummary = Object.entries(this.promptTemplates)
      .map(([k, v]) => `## template: ${k} \n\n ${v}`)
      .join('\n');
    void new PureChatLLMChat(this.plugin)
      .appendMessage(
        {
          role: 'system',
          content: `You are editing templates for the PureChatLLM plugin.\n\n# Here are the templates:\n\n${promptTemplatesSummary}`,
        },
        {
          role: 'user',
          content: `You are creating a new template called: \`"${this.promptTitle}"\`.  Please predict the content for this prompt template.`,
        },
      )
      .completeChatResponse(([] as TFile[])[0])
      .then(chat => {
        if (!this.promptTemplates[this.promptTitle]) {
          this.promptTemplates[this.promptTitle] =
            chat.session.messages[chat.session.messages.length - 2]?.content.trim() || '';
          this.update();
        }
      });
    this.update();
  }

  /**
   *
   */
  onClose(): void {
    void this.plugin.saveSettings();
  }
}
/**
 *
 */
class FileInputSuggest extends AbstractInputSuggest<TFile> {
  files: TFile[];
  /**
   *
   * @param app
   * @param inputEl
   */
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.files = app.vault.getMarkdownFiles();
  }

  /**
   *
   * @param query
   */
  protected getSuggestions(query: string): TFile[] | Promise<TFile[]> {
    if (!query) return [];
    return this.files.filter(file => file.path.toLowerCase().includes(query.toLowerCase()));
  }

  /**
   *
   * @param value
   * @param el
   */
  renderSuggestion(value: TFile, el: HTMLElement): void {
    el.setText(value.path);
  }
}
/**
 *
 * @param rawMarkdown
 * @param level
 * @param maxlevel
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
} /**
 *
 * @param obj
 * @param level
 */

/**
 *
 * @param obj
 * @param level
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

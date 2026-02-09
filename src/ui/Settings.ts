import { App, Notice, PluginSettingTab, SettingGroup } from 'obsidian';
import { DEFAULT_SETTINGS, PureChatLLMversion } from 'src/assets/constants';
import { PureChatLLMChat } from '../core/Chat';
import { ImportChatGPT } from '../core/ImportChatGPT';
import PureChatLLM, {
  FileSuggest,
  getMarkdownFromObject,
  getObjectFromMarkdown,
  SelectionPromptEditor,
} from '../main';
import { PURE_CHAT_LLM_ICON_NAME, PureChatLLMSettings } from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';
import { AskForAPI, EditModalProviders } from './Modals';

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
            .setDesc('Wikilink to a file containing the system prompt (e.g., [[MyPrompt]]). Resolved relative to the current file for folder-specific prompts. Leave empty for default.')
            .setClass('PURE')
            .addTextArea(text =>
              text
                .setPlaceholder('[[SystemPrompt]] or leave empty for default')
                .setValue(this.ifdefault('SystemPrompt'))
                .onChange(
                  async value =>
                    await this.sett('SystemPrompt', value || DEFAULT_SETTINGS.SystemPrompt),
                )
                .inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                  if (e.key === '/' || e.key === '[') {
                    e.preventDefault();
                    new FileSuggest(this.app, file => {
                      // Insert the selected file at the cursor position as a wikilink
                      const cursorPos = text.inputEl.selectionStart ?? 0;
                      const before = text.inputEl.value.slice(0, cursorPos);
                      const after = text.inputEl.value.slice(cursorPos);
                      const insert = this.app.fileManager.generateMarkdownLink(file, file.path);
                      text.setValue(before + insert + after);
                      text.onChanged();
                      // Move cursor after inserted text
                      text.inputEl.selectionStart = text.inputEl.selectionEnd =
                        before.length + insert.length;
                    }).open();
                  }
                }),
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
              text
                .setPlaceholder('e.g., System Prompts/Realtime.md')
                .setValue(this.ifdefault('realtimeSystemPromptFile'))
                .onChange(
                  async value =>
                    await this.sett('realtimeSystemPromptFile', value || DEFAULT_SETTINGS.realtimeSystemPromptFile),
                )
                .inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                  if (e.key === '/' || e.key === '[') {
                    e.preventDefault();
                    new FileSuggest(this.app, file => {
                      text.setValue(file.path);
                      text.onChanged();
                    }).open();
                  }
                }),
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
                    {
                      ...DEFAULT_SETTINGS.chatTemplates,
                    },
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
                const content = getMarkdownFromObject({
                  selectionTemplates,
                  chatTemplates,
                });
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
      );

    // Blue File Resolution Settings
    new SettingGroup(containerEl)
      .setHeading('Blue File Resolution (Dynamic Chat Execution)')
      .addSetting(
        setting =>
          void setting.setDesc(
            'Blue File Resolution enables recursive, dynamic execution of pending chat notes when they are linked. ' +
              'When a [[note]] link is resolved and the linked file is a pending chat (ends with a user message), ' +
              'instead of inlining its static content, the plugin executes the chat and uses the generated response.',
          ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Enable blue file resolution')
            .setDesc(
              'Turn on dynamic chat execution for [[note]] links. When enabled, linked notes that are pending chats will be executed recursively.',
            )
            .addToggle(toggle =>
              toggle.setValue(settings.blueFileResolution.enabled).onChange(async value => {
                settings.blueFileResolution.enabled = value;
                void this.plugin.blueView?.onOpen();
                await this.plugin.saveSettings();
              }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Maximum resolution depth')
            .setDesc(
              'Maximum depth for recursive chat execution (1-20). Prevents runaway recursion. Default is 5.',
            )
            .addText(text =>
              text
                .setPlaceholder('5')
                .setValue(settings.blueFileResolution.maxDepth.toString())
                .onChange(async value => {
                  const num = parseInt(value);
                  if (!isNaN(num) && num >= 1 && num <= 20) {
                    settings.blueFileResolution.maxDepth = num;
                    await this.plugin.saveSettings();
                  }
                }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Enable caching')
            .setDesc(
              'Cache intermediate chat results during resolution to avoid redundant API calls for the same file within a single invocation.',
            )
            .addToggle(toggle =>
              toggle.setValue(settings.blueFileResolution.enableCaching).onChange(async value => {
                settings.blueFileResolution.enableCaching = value;
                await this.plugin.saveSettings();
              }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Write intermediate results')
            .setDesc(
              'Save intermediate chat responses to disk. By default, only the root invocation writes results; nested executions are ephemeral.',
            )
            .addToggle(toggle =>
              toggle
                .setValue(settings.blueFileResolution.writeIntermediateResults)
                .onChange(async value => {
                  settings.blueFileResolution.writeIntermediateResults = value;
                  await this.plugin.saveSettings();
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

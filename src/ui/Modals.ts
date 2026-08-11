import 'obsidian';
import { App, Modal, Setting, TextAreaComponent, TFile } from 'obsidian';
import { EmptyApiKey } from 'src/assets/constants';
import { PureChatLLMChat } from '../core/Chat';
import PureChatLLM from '../main';
import { PureChatLLMAPI } from '../types';

/**
 * Modal dialog prompting the user to enter an OpenAI API key for the PureChatLLM plugin.
 *
 * This modal displays a text input for the API key, a submit button to save the key,
 * and a cancel button to close the modal without saving. It also provides a link to
 * the OpenAI API key generation page. The entered API key is saved to the plugin's settings.
 *
 * @extends Modal
 * @param app - The Obsidian application instance.
 * @param plugin - The instance of the PureChatLLM plugin, used to access and save settings.
 */
export class AskForAPI extends Modal {
  private apiKey: string;

  /**
   * Creates a modal dialog for API key configuration.
   *
   * @param plugin - The PureChatLLM plugin instance
   */
  constructor(public plugin: PureChatLLM) {
    super(plugin.app);
    this.plugin = plugin;
    const endpoint = plugin.settings.endpoints[plugin.settings.endpoint];
    this.apiKey = endpoint.apiKey;
    this.setTitle(`Enter your ${endpoint.name} API key`);

    this.buildUI();
  }

  /**
   * Builds the user interface for the API key modal.
   */
  private buildUI() {
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];

    new Setting(this.contentEl)
      .setName('API key')
      .setDesc(`Enter your ${endpoint.name} API key.`)
      .addText(text => {
        text
          .setPlaceholder(this.apiKey)
          .setValue(this.apiKey)
          .onChange(value => {
            this.apiKey = value.trim();
          });
        text.inputEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            void this.saveAndClose();
          }
        });
      });
    new Setting(this.contentEl)
      .setName('Default model')
      .setDesc(`Enter the default model for ${endpoint.name}.`)
      .addText(text => {
        text
          .setPlaceholder(endpoint.defaultmodel)
          .setValue(endpoint.defaultmodel)
          .onChange(value => {
            endpoint.defaultmodel = value || endpoint.defaultmodel;
            void this.plugin.saveSettings();
          });
      });
    new Setting(this.contentEl)
      .setName(
        createFragment(el => el.createEl('a', { href: endpoint.getapiKey, text: endpoint.name })),
      )
      .setDesc(`Link to get API key from ${endpoint.name}`)
      .addButton(btn =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(() => {
            void this.saveAndClose();
          }),
      )
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  /**
   * Saves the API key to settings and closes the modal.
   *
   * @returns A promise that resolves when settings are saved
   */
  private async saveAndClose() {
    this.plugin.settings.endpoints[this.plugin.settings.endpoint].apiKey =
      this.apiKey || EmptyApiKey;
    await this.plugin.saveSettings();
    this.close();
  }
}

/**
 * A custom text area component that extends the base `TextAreaComponent`.
 *
 * This component adds the "codePreview" CSS class to its input element,
 * allowing for specialized styling or behavior in the UI.
 *
 * @extends TextAreaComponent
 * @example
 * const codeArea = new CodeAreaComponent(containerElement);
 */
export class CodeAreaComponent extends TextAreaComponent {
  /**
   * Creates a new code area component.
   *
   * @param containerEl - The HTML element to contain the text area
   */
  constructor(containerEl: HTMLElement) {
    super(containerEl);
    this.inputEl.addClass('codePreview');
  }
}

/**
 * Opens a new split view with a selection response initialized in a new file.
 *
 * @param plugin - The PureChatLLM plugin instance
 * @param selection - The selected text to include in the new chat
 * @returns A promise that resolves when the file is created and opened
 */
export async function editWand(plugin: PureChatLLM, selection: string) {
  await plugin.app.workspace
    .getLeaf('split')
    .openFile(
      await plugin.app.vault.create(
        await plugin.app.fileManager.getAvailablePathForAttachment('PUREselection.md'),
        new PureChatLLMChat(plugin).initSelectionResponse('', selection, '').getMarkdown(),
      ),
    );
}

const endpointNames: PureChatLLMAPI = {
  name: 'Endpoint name',
  apiKey: 'API key',
  endpoint: 'Endpoint URL',
  defaultmodel: 'Default model',
  getapiKey: 'API key retrieval URL (Optional)',
};

const endpointDescriptions: PureChatLLMAPI = {
  name: 'The name of the LLM provider.',
  apiKey: 'Your API key for the LLM provider.',
  endpoint:
    "The URL for the LLM provider's chat completions endpoint, including /v1/chat/completions.",
  defaultmodel:
    'The default model to use for requests. This is required for the plugin to function.',
  getapiKey: 'Optional URL the API key page for the provider.',
};

const endpointInputPlaceholders: PureChatLLMAPI = {
  name: 'Enter the name of the LLM provider...',
  apiKey: 'Enter your API key...',
  endpoint: 'https://api.example.com/v1',
  defaultmodel: 'gpt-3.5-turbo',
  getapiKey: 'https://example.com/get-api-key (Optional)',
};

/**
 * Modal for editing a single LLM provider endpoint configuration.
 */
export class EditEndpointModal extends Modal {
  /**
   * @param app - The Obsidian application instance
   * @param endpoint - A copy of the endpoint to edit (mutated on save)
   * @param onSave - Called with the updated endpoint when saved
   */
  constructor(
    app: App,
    private endpoint: PureChatLLMAPI,
    private onSave: (endpoint: PureChatLLMAPI) => void,
  ) {
    super(app);
    this.setTitle(endpoint.name || 'New provider');
  }

  /** Builds the form for editing endpoint fields. */
  onOpen() {
    const { contentEl } = this;

    Object.entries(endpointNames).forEach(([key, label]) => {
      new Setting(contentEl)
        .setName(label as string)
        .setDesc(endpointDescriptions[key as keyof PureChatLLMAPI])
        .addText(text =>
          text
            .setPlaceholder(endpointInputPlaceholders[key as keyof PureChatLLMAPI])
            .setValue(this.endpoint[key as keyof PureChatLLMAPI])
            .onChange(value => {
              this.endpoint[key as keyof PureChatLLMAPI] = value.trim();
              if (key === 'name') this.setTitle(value.trim() || 'New provider');
            }),
        );
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(() => {
            this.onSave(this.endpoint);
            this.close();
          }),
      )
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  /** Clears the content element on close. */
  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Modal dialog for editing selection templates.
 *
 * This modal allows users to edit template keys and values with save/cancel actions.
 *
 * @extends Modal
 */
export class EditSelectionTemplateModal extends Modal {
  templateKey: string;
  templateValue: string;
  onSave: (key: string, value: string) => void;

  /**
   * Creates a modal dialog for editing selection templates.
   *
   * @param app - The Obsidian application instance
   * @param plugin - The PureChatLLM plugin instance
   * @param promptTemplates - The current set of prompt templates
   * @param templateKey - The current template key
   * @param templateValue - The current template value
   * @param onSave - Callback function when save is clicked
   */
  constructor(
    public app: App,
    public plugin: PureChatLLM,
    public promptTemplates: Record<string, string>,
    templateKey: string,
    templateValue: string,
    onSave: (key: string, value: string) => void,
  ) {
    super(app);
    this.templateKey = templateKey;
    this.templateValue = templateValue;
    this.onSave = onSave;

    this.setTitle('Edit selection template');
  }

  /**
   * Builds the user interface for the edit selection template modal.
   */
  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName('Name').addText(text => {
      text.setValue(this.templateKey).onChange(value => {
        this.templateKey = value.trim();
      });
    });

    new Setting(contentEl).addTextArea(text =>
      text
        .setValue(this.templateValue)
        .onChange(value => {
          this.templateValue = value.trim();
        })
        .inputEl.addClass('codePreview'),
    );

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(() => {
            this.onSave(this.templateKey, this.templateValue);
            this.close();
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Generate prompt').onClick(() => {
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
                content: `You are creating a new template called: \`"${this.templateKey}"\`.  Please predict the content for this prompt template.  Return only the content of the template.`,
              },
            )
            .completeChatResponse(([] as TFile[])[0])
            .then(chat => {
              const predictedContent =
                chat.session.messages[chat.session.messages.length - 2]?.content.trim() || '';
              if (!predictedContent)
                return console.warn(
                  'No predicted content returned from chat response.',
                  chat.session.messages,
                );

              this.templateValue = predictedContent;
              this.close();
              this.onSave(this.templateKey, predictedContent);
            });
        }),
      )
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  /**
   * Called when the modal is closed. Clears the content element.
   */
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

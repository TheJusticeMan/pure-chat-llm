import 'obsidian';
import { App, Modal, Setting, TextAreaComponent } from 'obsidian';
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
  private modal: string;

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
        // eslint-disable-next-line no-undef
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
 * Modal dialog for editing and managing LLM provider configurations.
 *
 * Allows users to add, edit, and remove custom API endpoints for different
 * language model providers. Displays a list of configured providers and
 * provides forms for editing their details.
 */
export class EditModalProviders extends Modal {
  plugin: PureChatLLM;
  app: App;
  selectedIndex = 0; // Index of the currently selected endpoint

  /**
   * Creates a modal for editing LLM providers.
   *
   * @param app - The Obsidian application instance
   * @param plugin - The PureChatLLM plugin instance
   */
  constructor(app: App, plugin: PureChatLLM) {
    super(app);
    this.plugin = plugin;
    this.app = app;

    this.setTitle('Edit LLM providers');
    this.buildUI();
  }

  /**
   * Builds the user interface for the provider editor modal.
   */
  buildUI() {
    this.contentEl.empty();
    const { endpoints, endpoint } = this.plugin.settings;
    const selectedEndpoint = endpoints[this.selectedIndex] || endpoints[endpoint];

    endpoints.forEach(
      (key, i) =>
        void new Setting(this.contentEl)
          .setName(i !== this.selectedIndex ? key.name : 'Editing...')
          .addExtraButton(btn => {
            btn
              .setIcon('trash')
              .setTooltip(`Remove ${key.name}`)
              .onClick(() => {
                this.plugin.settings.endpoints.splice(i, 1);
                this.buildUI(); // Rebuild UI after removal
              });
          })
          .addButton(btn => {
            btn
              .setIcon('pencil')
              .setTooltip(`Edit ${key.name}`)
              .onClick(() => {
                this.selectedIndex = i;
                this.buildUI(); // Rebuild UI to show the selected endpoint details
              });
            if (i === this.selectedIndex) btn.setCta();
          }),
    );
    new Setting(this.contentEl).setName('Add new endpoint').addButton(btn => {
      btn
        .setIcon('plus')
        .setTooltip('Add a new endpoint')
        .onClick(() => {
          this.plugin.settings.endpoints.push({
            name: '',
            apiKey: '',
            endpoint: '',
            defaultmodel: '',

            getapiKey: '',
          });
          this.selectedIndex = this.plugin.settings.endpoints.length - 1;
          this.buildUI(); // Rebuild UI to show the new endpoint
        });
    });

    new Setting(this.contentEl).setName('Edit').setHeading();
    Object.entries(endpointNames).forEach(([key, label]) => {
      new Setting(this.contentEl)
        .setName(label as string)
        .setDesc(endpointDescriptions[key as keyof PureChatLLMAPI])
        .addText(text => {
          text
            .setPlaceholder(endpointInputPlaceholders[key as keyof PureChatLLMAPI])
            .setValue(selectedEndpoint[key as keyof PureChatLLMAPI])
            .onChange(value => {
              selectedEndpoint[key as keyof PureChatLLMAPI] = value.trim();
              if (key === 'name') this.setTitle(value.trim());
            });
        });
    });
    this.setTitle(selectedEndpoint.name);
  }
  /**
   * Called when the modal is closed. Filters out empty endpoints and saves settings.
   */
  onClose(): void {
    const { settings } = this.plugin;
    settings.endpoints = settings.endpoints.filter(endpoint => endpoint.name);
    void this.plugin.saveSettings();
    super.onClose();
  }
}

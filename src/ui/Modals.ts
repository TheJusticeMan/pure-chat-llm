import {
  App,
  ButtonComponent,
  ExtraButtonComponent,
  Modal,
  Notice,
  Setting,
  TextAreaComponent,
} from 'obsidian';
import { PureChatLLMChat } from '../core/Chat';
import PureChatLLM from '../main';
import { EmptyApiKey } from '../assets/s.json';
import { PureChatLLMAPI } from '../types';
import 'obsidian';

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
  plugin: PureChatLLM;
  app: App;
  private apiKey: string;
  private modal: string;

  constructor(app: App, plugin: PureChatLLM) {
    super(app);
    this.plugin = plugin;
    this.app = app;
    const endpoint = plugin.settings.endpoints[plugin.settings.endpoint];
    this.apiKey = endpoint.apiKey;
    this.setTitle(`Enter your ${endpoint.name} API key`);

    this.buildUI();
  }

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
 * This component adds the "PUREcodePreview" CSS class to its input element,
 * allowing for specialized styling or behavior in the UI.
 *
 * @extends TextAreaComponent
 * @example
 * const codeArea = new CodeAreaComponent(containerElement);
 */
export class CodeAreaComponent extends TextAreaComponent {
  constructor(containerEl: HTMLElement) {
    super(containerEl);
    this.inputEl.addClass('PUREcodePreview');
  }
}

/**
 * Modal dialog for modifying selected text using a prompt within the PureChatLLM Obsidian plugin.
 *
 * Features:
 * - View and edit the current selection.
 * - Enter a prompt to modify the selection via an LLM.
 * - Copy the selection to the clipboard.
 * - Submit the modified selection or cancel.
 *
 * @extends Modal
 *
 * @param app - The Obsidian app instance.
 * @param plugin - The instance of the PureChatLLM plugin.
 * @param selection - The initial text selected for modification.
 * @param onSubmit - Callback invoked with the final modified text.
 */
export class EditWand extends Modal {
  plugin: PureChatLLM;
  app: App;

  // History management
  hist: string[];
  iHist = 1; // Current index in history
  navButtons: (ButtonComponent | ExtraButtonComponent)[] = [];

  // UI components
  selectionEl: CodeAreaComponent;
  promptEl: CodeAreaComponent;

  // Original selection
  selection: string;

  // Callback for when user confirms the change
  onSubmit: (modifiedText: string) => void;

  constructor(
    app: App,
    plugin: PureChatLLM,
    selection: string,
    onSubmit: (modifiedText: string) => void,
  ) {
    super(app);
    this.plugin = plugin;
    this.app = app;
    this.selection = selection;
    this.onSubmit = onSubmit;

    // Initialize history with the initial selection
    this.hist = [selection, selection];

    this.setTitle('Change selection with prompt');

    // Setup navigation buttons
    this.setupNavigationButtons();

    // Create selection textarea
    this.selectionEl = new CodeAreaComponent(this.contentEl)
      .setPlaceholder('Selection')
      .setValue(this.selection)
      .onChange(value => {
        // Update the latest history entry when user edits selection
        this.hist[this.hist.length - 1] = value;
      });

    // Create prompt textarea
    this.promptEl = new CodeAreaComponent(this.contentEl)
      .setPlaceholder('Enter the prompt')
      .onChange(value => {
        if (value.endsWith('>go')) {
          this.promptEl.setValue(value.slice(0, -3));
          void this.send();
        }
      });

    // Setup action buttons
    this.setupActionButtons();

    // Initialize the display with the current selection
    this.update(this.selectionEl, this.selection);
  }

  /**
   * Setup navigation buttons for history traversal.
   */
  private setupNavigationButtons() {
    new Setting(this.contentEl)
      // Copy selection to clipboard
      .addExtraButton(btn =>
        btn.setIcon('copy').onClick(async () => {
          await navigator.clipboard.writeText(this.selectionEl.getValue());
          new Notice('Selection copied to clipboard');
        }),
      )
      .addExtraButton(
        btn =>
          (this.navButtons[0] = btn.setIcon('undo-2').onClick(async () => {
            this.iHist = Math.max(this.iHist - 1, 0);
            this.update(this.selectionEl, this.hist[this.iHist]);
          })),
      )
      .addExtraButton(
        btn =>
          (this.navButtons[1] = btn.setIcon('redo-2').onClick(async () => {
            this.iHist = Math.min(this.iHist + 1, this.hist.length - 1);
            this.update(this.selectionEl, this.hist[this.iHist]);
          })),
      );
  }

  /**
   * Setup action buttons: copy, send prompt, confirm, cancel.
   */
  private setupActionButtons() {
    new Setting(this.contentEl)
      // Send prompt to LLM and update selection with response
      .addExtraButton(btn => btn.setIcon('send').onClick(() => this.send()))
      // Confirm button
      .addButton(btn =>
        btn
          .setIcon('check')
          .setCta()
          .onClick(async () => {
            this.close();
            this.onSubmit(this.selectionEl.getValue());
          }),
      )
      // Cancel button
      .addButton(btn => btn.setIcon('x').onClick(() => this.close()));
  }

  async send() {
    const promptText = this.promptEl.getValue();

    // Create LLM chat request
    const response = await new PureChatLLMChat(this.plugin)
      .setMarkdown(promptText)
      .SelectionResponse(promptText, this.selectionEl.getValue());

    // Manage history for undo/redo
    if (this.iHist !== this.hist.length - 1) {
      this.hist = this.hist.slice(0, this.iHist + 1);
    }

    // Avoid duplicate consecutive entries
    if (this.hist[this.hist.length - 1] === response.content) {
      this.hist.pop();
    }

    this.hist.push(response.content, response.content);
    this.iHist = this.hist.length - 1;

    this.update(this.selectionEl, response.content);
  }

  /**
   * Update the selection textarea and navigation controls.
   * @param element - The CodeAreaComponent to update.
   * @param value - The new text value.
   */
  private update(element: CodeAreaComponent, value: string) {
    const [backBtn, forwardBtn] = this.navButtons;
    // Update navigation index display
    // Enable/disable navigation buttons based on position
    backBtn.setDisabled(this.iHist === 0);
    forwardBtn.setDisabled(this.iHist === this.hist.length - 1);
    // Update the textarea with the new value
    element.setValue(value);
    // Select all text for easy editing
    element.inputEl.select();
  }
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

export class EditModalProviders extends Modal {
  plugin: PureChatLLM;
  app: App;
  selectedIndex = 0; // Index of the currently selected endpoint

  constructor(app: App, plugin: PureChatLLM) {
    super(app);
    this.plugin = plugin;
    this.app = app;

    this.setTitle('Edit LLM providers');
    this.buildUI();
  }

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
  onClose(): void {
    const { settings } = this.plugin;
    settings.endpoints = settings.endpoints.filter(endpoint => endpoint.name);
    void this.plugin.saveSettings();
    super.onClose();
  }
}

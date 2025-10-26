import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import { ImportChatGPT } from "./ImportChatGPT";
import PureChatLLM, { FileSuggest, getMarkdownFromObject, getObjectFromMarkdown, SelectionPromptEditor } from "./main";
import { AskForAPI, EditModalProviders } from "./models";
import { version } from "./s.json";
import { DEFAULT_SETTINGS, PureChatLLMSettings } from "./types";

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

  constructor(app: App, plugin: PureChatLLM) {
    super(app, plugin);
    this.plugin = plugin;
  }

  ifdefault(key: keyof PureChatLLMSettings): string {
    const { settings } = this.plugin;
    return settings[key] !== DEFAULT_SETTINGS[key] ? settings[key].toString() : "";
  }

  display(): void {
    const {
      containerEl,
      plugin: { settings },
    } = this;

    containerEl.empty();
    new Setting(containerEl)
      .setName("Model provider")
      .setDesc("Choose the default model provider. Configure API keys.")
      .addDropdown(dropdown =>
        dropdown
          .addOptions(Object.fromEntries(settings.endpoints.map((e, i) => [i.toString(), e.name])))
          .setValue(settings.endpoint.toString())
          .onChange(async value => {
            settings.endpoint = parseInt(value, 10);
            this.plugin.modellist = [];
            await this.plugin.saveSettings();
          })
      )
      .addButton(btn =>
        btn
          .setIcon("key")
          .setTooltip("Add API key")
          .onClick(async () => new AskForAPI(this.app, this.plugin).open())
      );
    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc("System message for each new chat.  Press [ to link a file.")
      .setClass("PURE")
      .addTextArea(text =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.SystemPrompt)
          .setValue(this.ifdefault("SystemPrompt"))
          .onChange(async value => {
            settings.SystemPrompt = value || DEFAULT_SETTINGS.SystemPrompt;
            await this.plugin.saveSettings();
          })
          .inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "/" || e.key === "[") {
              e.preventDefault();
              new FileSuggest(this.app, file => {
                // Insert the selected file at the cursor position
                const cursorPos = text.inputEl.selectionStart ?? 0;
                const before = text.inputEl.value.slice(0, cursorPos);
                const after = text.inputEl.value.slice(cursorPos);
                const insert = this.app.fileManager.generateMarkdownLink(file, file.path);
                text.setValue(before + insert + after);
                text.onChanged();
                // Move cursor after inserted text
                text.inputEl.selectionStart = text.inputEl.selectionEnd = before.length + insert.length;
              }).open();
            }
          })
      );
    new Setting(containerEl)
      .setName("Default token count")
      .setDesc("Default max tokens for models that support it.")
      .addText(text =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.defaultmaxTokens.toString())
          .setValue(this.ifdefault("defaultmaxTokens"))
          .onChange(async value => {
            const num = value ? Number(value) : DEFAULT_SETTINGS.defaultmaxTokens;
            settings.defaultmaxTokens = num || 4096;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Selection commands")
      .setDesc("Edit selection prompt templates for the selection commands.")
      .addButton(btn =>
        btn
          .setButtonText("Edit prompts")
          //.setCta()
          .setTooltip("Edit selection prompt templates")
          .onClick(() =>
            new SelectionPromptEditor(
              this.app,
              this.plugin,
              this.plugin.settings.selectionTemplates,
              { ...DEFAULT_SETTINGS.selectionTemplates },
              this.plugin.settings.CMDselectionTemplates
            ).open()
          )
      );
    new Setting(containerEl)
      .setName("Chat analyze commands")
      .setDesc("Edit chat prompt templates for the analyze commands.")
      .addButton(btn =>
        btn
          .setButtonText("Edit prompts")
          //.setCta()
          .setTooltip("Edit chat prompt templates")
          .onClick(() =>
            new SelectionPromptEditor(
              this.app,
              this.plugin,
              this.plugin.settings.chatTemplates,
              {
                ...DEFAULT_SETTINGS.chatTemplates,
              },
              settings.CMDchatTemplates
            ).open()
          )
      );
    new Setting(containerEl)
      .setName("Import/Export templates")
      .setDesc("Import or export selection and chat prompt templates to/from a markdown file.")
      .addButton(btn =>
        btn.setButtonText("Write to PureChatLLM-Templates.md").onClick(() => {
          const { selectionTemplates, chatTemplates } = this.plugin.settings;
          const content = getMarkdownFromObject({ selectionTemplates, chatTemplates });
          const filePath = "PureChatLLM-Templates.md";
          const file = this.app.vault.getFileByPath(filePath);
          if (file) this.app.vault.modify(file, content);
          else this.app.vault.create(filePath, content);
          new Notice("Templates exported to PureChatLLM-Templates.md");
        })
      )
      .addButton(btn =>
        btn
          .setButtonText("Import from PureChatLLM-Templates.md")
          .then(btn => (this.app.vault.getFileByPath("PureChatLLM-Templates.md") ? btn : btn.setDisabled(true)))
          .onClick(() => {
            this.app.vault.cachedRead(this.app.vault.getFileByPath("PureChatLLM-Templates.md")!).then(data => {
              this.plugin.settings = { ...this.plugin.settings, ...getObjectFromMarkdown(data, 1, 2) };
              this.plugin.saveSettings();
              new Notice("Templates imported. Please review them in the prompt editor.");
            });
          })
      );
    new Setting(containerEl)
      .setName("Use OpenAI image generation")
      .setDesc("Enable this to use OpenAI's DALL-E for image generation. Requires an OpenAI API key.")
      .addToggle(toggle =>
        toggle.setValue(settings.useImageGeneration).onChange(async value => {
          settings.useImageGeneration = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("Import ChatGPT conversations")
      .setDesc("Import conversations exported from chat.openai.com.")
      .addButton(btn => {
        btn
          .setButtonText("Import")
          .setCta()
          .onClick(() => new ImportChatGPT(this.app, this.plugin));
      });

    new Setting(containerEl).setName("Advanced").setHeading();
    // resolveFilesForChatAnalysis
    new Setting(containerEl)
      .setName("File resolution in chat analysis")
      .setDesc(
        "Enable this to automatically resolve and include file contents when using chat analysis commands. This helps provide context from linked files in the conversation."
      )
      .addToggle(toggle =>
        toggle.setValue(settings.resolveFilesForChatAnalysis).onChange(async value => {
          settings.resolveFilesForChatAnalysis = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("Custom LLM Providers")
      .setDesc("Add custom LLM providers with API keys. These will be available in the model provider dropdown.")
      .addButton(btn =>
        btn
          .setButtonText("Add custom provider")
          .setCta()
          .onClick(() => new EditModalProviders(this.app, this.plugin).open())
      );
    new Setting(containerEl)
      .setName("Autogenerate title")
      .setDesc(
        "How many responses to wait for before automatically creating a conversation title (set to 0 to disable)."
      )
      .addText(text =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.AutogenerateTitle.toString())
          .setValue(this.ifdefault("AutogenerateTitle"))
          .onChange(async value => {
            const num = value ? Number(value) : DEFAULT_SETTINGS.AutogenerateTitle;
            settings.AutogenerateTitle = num || 0;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Auto reverse roles")
      .setDesc("Automatically switch roles when the last message is empty, for replying to self.")
      .addToggle(toggle =>
        toggle.setValue(settings.AutoReverseRoles).onChange(async value => {
          settings.AutoReverseRoles = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("Add file to context for editing")
      .setDesc("Include the current file content in the context for selection editing.")
      .addToggle(toggle =>
        toggle.setValue(settings.addfiletocontext).onChange(async value => {
          settings.addfiletocontext = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("Chat style")
      .setDesc("Select how chats are written and interpreted in markdown.")
      .addText(text =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.messageRoleFormatter)
          .setValue(this.ifdefault("messageRoleFormatter"))
          .onChange(async value => {
            settings.messageRoleFormatter = value || DEFAULT_SETTINGS.messageRoleFormatter;
            // make sure {role} is present
            if (!settings.messageRoleFormatter.includes("{role}")) settings.messageRoleFormatter += " {role}";
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Debug")
      .setDesc("Enable logging of detailed debug information in the console for troubleshooting.")
      .addToggle(toggle =>
        toggle.setValue(settings.debug).onChange(async value => {
          settings.debug = value;
          await this.plugin.saveSettings();
          this.plugin.console = new BrowserConsole(settings.debug, "PureChatLLM");
          console.log("reload the plugin to apply the changes");
        })
      );
    new Setting(containerEl)
      .setName("Version")
      .setDesc(`v${version}`)
      .addButton(btn =>
        btn
          .setButtonText("Reset settings")
          .setTooltip("Won't delete the API keys.")
          .setWarning()
          .onClick(e => {
            const oldSettings = { ...this.plugin.settings };
            this.plugin.settings = { ...DEFAULT_SETTINGS };
            for (const endpoint in this.plugin.settings.endpoints) {
              if (DEFAULT_SETTINGS.endpoints[endpoint])
                this.plugin.settings.endpoints[endpoint].apiKey = oldSettings.endpoints[endpoint].apiKey;
            }
            this.plugin.saveSettings();
            this.display();
            new Notice("Settings reset to defaults.  API keys are unchanged.");
          })
      )
      .addButton(btn =>
        btn
          .setButtonText("Hot keys")
          .setCta()
          .onClick(e => this.plugin.openHotkeys())
      );
  }
}

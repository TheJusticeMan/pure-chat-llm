import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  FuzzySuggestModal,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TextComponent,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import { PureChatLLMChat } from "./Chat";
import { codelanguages } from "./codelanguages";
import { AskForAPI, CodeAreaComponent, EditWand } from "./models";
import { EmptyApiKey, version } from "./s.json";
import { StatSett } from "./settings";
import { PureChatLLMSideView } from "./SideView";
import { PureChatLLMSpeech } from "./Speech";
import { toTitleCase } from "./toTitleCase";
import { DEFAULT_SETTINGS, PURE_CHAT_LLM_VIEW_TYPE, PureChatLLMSettings } from "./types";

declare module "obsidian" {
  interface App {
    commands: {
      commands: {
        [commandId: string]: {
          id: string;
          name: string;
          callback: () => void;
        };
      };
      executeCommandById(commandId: string): boolean;
    };
  }
}

/**
 * The main plugin class for the Pure Chat LLM Obsidian plugin.
 *
 * This class manages the lifecycle, commands, settings, and UI integration for the plugin,
 * enabling chat-based interactions powered by language models within Obsidian.
 *
 * Features:
 * - Loads and saves plugin settings.
 * - Registers custom views, ribbon icons, and commands for chat completion, title generation, and selection editing.
 * - Handles context menu integration for chat-related actions.
 * - Provides methods for activating the plugin view, managing templates, and processing chat responses.
 * - Supports auto-generating file titles based on chat content.
 * - Manages plugin state, including responding status and debug logging.
 *
 * @extends Plugin
 *
 * @property {PureChatLLMSettings} settings - The current plugin settings.
 * @property {boolean} isresponding - Indicates if the plugin is currently generating a response.
 * @property {BrowserConsole} console - Console instance for debug logging.
 *
 * @public
 */
export default class PureChatLLM extends Plugin {
  settings: PureChatLLMSettings;
  isresponding: boolean;
  console: BrowserConsole;
  modellist: string[] = [];

  async onload() {
    await this.loadSettings();
    this.console = new BrowserConsole(this.settings.debug, "PureChatLLM");
    this.console.log("settings loaded", this.settings);

    this.registerView(PURE_CHAT_LLM_VIEW_TYPE, (leaf) => new PureChatLLMSideView(leaf, this));

    this.addRibbonIcon("text", "Open conversation overview", this.activateView.bind(this));

    // Add command for completing chat response
    // No default hotkey
    this.addCommand({
      id: "complete-chat-response",
      name: "Complete chat response",
      icon: "send",
      editorCallback: this.CompleteChatResponse.bind(this),
    });
    // Add command for settings
    this.addCommand({
      id: "generate-title",
      name: "Generate title",
      icon: "text-cursor-input",
      editorCallback: this.GenerateTitle.bind(this),
    });
    this.addCommand({
      id: "edit-selection",
      name: "Edit selection",
      editorCheckCallback: (checking, e: Editor) => {
        const selected = e.getSelection();
        if (checking) return !!selected;
        this.EditSelection(selected, e);
      },
    });
    this.addCommand({
      id: "analyze-conversation",
      name: "Analyze conversation",
      icon: "messages-square",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new InstructPromptsHandler(
          this.app,
          (s) =>
            new PureChatLLMChat(this)
              .setMarkdown(editor.getValue())
              .ProcessChatWithTemplate(s)
              .then((response) => editor.replaceSelection(response.content)),
          this.settings.chatTemplates
        ).open();
      },
    });
    // Add command for opening the settings
    this.addCommand({
      id: "reverse-roles",
      name: "Reverse roles",
      icon: "swap-horizontal",
      editorCallback: (editor: Editor) => {
        const content = new PureChatLLMChat(this).setMarkdown(editor.getValue()).ReverseRoles();
        editor.setValue(content.Markdown);
        this.setCursorEnd(editor);
      },
    });
    this.addCommand({
      id: "speak-chat",
      name: "Speak chat",
      icon: "mic",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new PureChatLLMSpeech(
          this,
          new PureChatLLMChat(this).setMarkdown(editor.getValue()).thencb((chat) => {
            chat.messages = chat.messages.filter(
              (message) => message.role === "user" || message.role === "assistant"
            );
          })
        ).startStreaming();
      },
    });
    Object.entries(this.settings.CMDchatTemplates).forEach(([key, value]) => {
      if (value) {
        this.addCommand({
          id: `chat-template-${key.toLowerCase().replace(/\s+/g, "-")}`,
          name: `Chat: ${key}`,
          icon: "wand",
          editorCallback: (editor: Editor, view: MarkdownView) => {
            new PureChatLLMChat(this)
              .setMarkdown(editor.getValue())
              .ProcessChatWithTemplate(this.settings.chatTemplates[key])
              .then((response) => editor.replaceSelection(response.content));
          },
        });
      }
    });
    Object.entries(this.settings.CMDselectionTemplates).forEach(([key, value]) => {
      const template = this.settings.selectionTemplates[key];
      const { addfiletocontext } = this.settings;
      if (value && template) {
        this.addCommand({
          id: `selection-template-${key.toLowerCase().replace(/\s+/g, "-")}`,
          name: `Selection: ${key}`,
          icon: "wand",
          editorCheckCallback: (checking, e: Editor) => {
            const selected = e.getSelection();
            if (checking) return !!selected;
            new PureChatLLMChat(this)
              .SelectionResponse(template, selected, addfiletocontext ? e.getValue() : undefined)
              .then((response) => e.replaceSelection(response.content));
          },
        });
      }
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
        this.addItemsToMenu(menu, editor, view);
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("New conversation")
              .setIcon("message-square-plus")
              .setSection("action")
              .onClick(async () => {
                const fileName = this.generateUniqueFileName(file, "Untitled Conversation");
                const newFile = await this.app.vault.create(
                  `${file.path}/${fileName}.md`,
                  new PureChatLLMChat(this).setMarkdown("Type your message...").Markdown
                );
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(newFile);
                this.activateView();
              });
          });
        }
      })
    );

    this.registerEditorSuggest(new PureChatEditorSuggest(this.app, this));

    // Add settings tab
    this.addSettingTab(new PureChatLLMSettingTab(this.app, this));
  }

  private generateUniqueFileName(folder: TFolder, baseName: string) {
    // Generate a unique file name in the specified folder
    const files = folder.children.filter((f) => f instanceof TFile).map((f) => f.name);
    let name = baseName;
    let i = 1;
    while (files.includes(`${name}.md`)) name = `${baseName} ${i++}`;
    return name;
  }

  async openHotkeys(): Promise<void> {
    // make sure this stays up to date as the documentation does'nt include all the functions used here
    const setting = (this.app as any).setting;
    await setting.open();
    setting.openTabById("hotkeys");
    setting.activeTab.searchComponent.setValue("Pure Chat LLM");
    setting.activeTab.searchComponent.onChanged();
  }

  async openSettings(): Promise<void> {
    const setting = (this.app as any).setting;
    await setting.open();
    setting.openTabById("pure-chat-llm");
  }

  onUserEnable() {
    this.activateView();
    //this.openHotkeys();
    this.console.log("Plugin enabled");
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(PURE_CHAT_LLM_VIEW_TYPE);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0];
    } else {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({
        type: PURE_CHAT_LLM_VIEW_TYPE,
        active: true,
      });
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  addItemsToMenu(menu: Menu, editor: Editor, view: MarkdownView) {
    const selected = editor.getSelection();
    if (selected.length > 0)
      menu
        .addItem((item) =>
          item
            .setTitle("Edit selection")
            .setIcon("wand")
            .onClick(async () => {
              this.EditSelection(selected, editor);
            })
            .setSection("selection")
        )
        .addItem((item) =>
          item
            .setTitle("wand")
            .setIcon("wand")
            .onClick(async () => {
              new EditWand(this.app, this, editor.getSelection(), (s) =>
                editor.replaceSelection(s)
              ).open();
            })
            .setSection("selection")
        );

    return menu;
  }

  private EditSelection(selected: string, editor: Editor) {
    new InstructPromptsHandler(
      this.app,
      (s) =>
        s
          ? new PureChatLLMChat(this)
              .SelectionResponse(
                s,
                selected,
                this.settings.addfiletocontext ? editor.getValue() : undefined
              )
              .then((response) => editor.replaceSelection(response.content))
          : new EditWand(this.app, this, selected, (text) => editor.replaceSelection(text)).open(),
      { ...this.settings.selectionTemplates, "Custom prompt": "" }
    ).open();
  }

  askForApiKey() {
    new AskForAPI(this.app, this).open();
  }

  /**
   * Generates a new title for the currently active file based on its content using an LLM-powered chat template.
   * The generated title is sanitized to remove non-alphanumeric characters and is used to rename the file.
   * If no active file is found, a notice is displayed to the user.
   *
   * @param editor - The editor instance containing the file's content.
   * @param view - The Markdown view associated with the editor.
   */
  GenerateTitle(editor: Editor, view: MarkdownView): void {
    const ActiveFile = view.file;
    if (ActiveFile)
      new PureChatLLMChat(this)
        .setMarkdown(editor.getValue())
        .ProcessChatWithTemplate(this.settings.chatTemplates["Conversation titler"])
        .then((title) => {
          const sanitizedTitle = `${ActiveFile.parent?.path}/${title.content
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .trim()}.${ActiveFile.extension}`;
          this.app.fileManager.renameFile(ActiveFile, sanitizedTitle);
          new Notice(`File renamed to: ${sanitizedTitle}`);
        });
    else new Notice("No active file to rename.");
  }

  /**
   * Handles the process of generating a chat response using the PureChatLLMChat class.
   *
   * This method checks for a valid API key, prompts the user if missing, and initiates a chat completion
   * based on the current editor content. It appends a role header, sends the content to the LLM, and inserts
   * the response into the editor. If certain conditions are met (e.g., auto-title generation is enabled and
   * the file is untitled), it triggers title generation. The method manages the responding state and handles
   * errors gracefully.
   *
   * @param editor - The active Obsidian editor instance where the chat is being composed.
   * @param view - The current MarkdownView associated with the editor.
   */
  CompleteChatResponse(editor: Editor, view: MarkdownView) {
    const endpoint = this.settings.endpoints[this.settings.endpoint];
    if (endpoint.apiKey == EmptyApiKey) {
      new AskForAPI(this.app, this).open();
      return;
    }
    const activeFile = view.file;
    if (!activeFile) return;
    const editorcontent = editor.getValue();
    const chat = new PureChatLLMChat(this).setMarkdown(editorcontent);
    if (chat.messages[chat.messages.length - 1].content === "" && chat.validChat) {
      if (chat.messages.pop()?.role == "user" && this.settings.AutoReverseRoles)
        chat.ReverseRoles();
    }
    editor.setValue(chat.Markdown);
    this.setCursorEnd(editor, true);
    if (!chat.validChat) return;

    this.isresponding = true;

    editor.replaceSelection("\n# role: Assistant...\n");
    chat
      .CompleteChatResponse(activeFile, (e) => {
        this.setCursorEnd(editor);
        editor.replaceSelection(e.content);
        return true;
      })
      .then((chat) => {
        this.isresponding = false;
        if (
          this.settings.AutogenerateTitle > 0 &&
          chat.messages.length >= this.settings.AutogenerateTitle &&
          activeFile?.name.includes("Untitled") &&
          view
        ) {
          this.GenerateTitle(editor, view);
        }
        editor.setValue(chat.Markdown);
        // put the cursor at the end of the editor
        this.setCursorEnd(editor, true);
      })
      .catch((error) => this.console.error(error))
      .finally(() => {
        this.isresponding = false;
        return;
      });
  }

  setCursorEnd(editor: Editor, intoview = false) {
    editor.setCursor(editor.lastLine(), editor.getLine(editor.lastLine()).length);
    if (intoview) editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() });
  }

  async loadSettings() {
    const loadedData = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    this.settings = {
      ...loadedData,
      chatTemplates: {
        ...DEFAULT_SETTINGS.chatTemplates,
        ...loadedData.chatTemplates,
      },
      selectionTemplates: {
        ...DEFAULT_SETTINGS.selectionTemplates,
        ...loadedData.selectionTemplates,
      },
    };
    DEFAULT_SETTINGS.endpoints.forEach(
      (endpoint) =>
        this.settings.endpoints.find((e) => e.name === endpoint.name) ||
        this.settings.endpoints.push(endpoint)
    );
  }

  async saveSettings() {
    this.settings.selectionTemplates = Object.fromEntries(
      Object.keys(this.settings.selectionTemplates)
        .sort()
        .map((key) => [key, this.settings.selectionTemplates[key]])
        .filter(([key, value]) => key && value)
    );
    this.settings.chatTemplates = Object.fromEntries(
      Object.keys(this.settings.chatTemplates)
        .sort()
        .map((key) => [key, this.settings.chatTemplates[key]])
        .filter(([key, value]) => key && value)
    );
    await this.saveData(this.settings);
  }

  onunload() {
    // Cleanup code if needed
  }
}

/**
 * A modal dialog that displays a fuzzy search list of instruct prompts for selection.
 *
 * Extends the `FuzzySuggestModal` to allow users to search and select from a list of
 * `PureChatLLMInstructPrompt` items, which are provided via the `templates` parameter.
 * When a prompt is selected, the provided `onSubmit` callback is invoked with the selected prompt.
 *
 * @extends FuzzySuggestModal<PureChatLLMInstructPrompt>
 *
 * @param app - The Obsidian application instance.
 * @param onSubmit - Callback function to execute when a prompt is selected.
 * @param templates - An object containing available instruct prompts.
 *
 * @example
 * const handler = new InstructPromptsHandler(app, (prompt) => { ... }, templates);
 * handler.open();
 */
class InstructPromptsHandler extends FuzzySuggestModal<string> {
  onSubmit: (result: string) => void;
  templates: { [key: string]: string };
  constructor(app: App, onSubmit: (result: string) => void, templates: { [key: string]: string }) {
    super(app);
    this.onSubmit = onSubmit;
    this.templates = templates;
    this.setPlaceholder("Select a prompt...");
  }

  getItems(): string[] {
    return Object.keys(this.templates);
  }

  getItemText(templateKey: string): string {
    return templateKey;
  }

  onChooseItem(templateKey: string, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(this.templates[templateKey]);
  }
}

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
class PureChatLLMSettingTab extends PluginSettingTab {
  plugin: PureChatLLM;

  constructor(app: App, plugin: PureChatLLM) {
    super(app, plugin);
    this.plugin = plugin;
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
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(Object.fromEntries(settings.endpoints.map((e, i) => [i.toString(), e.name])))
          .setValue(settings.endpoint.toString())
          .onChange(async (value) => {
            settings.endpoint = parseInt(value, 10);
            this.plugin.modellist = [];
            await this.plugin.saveSettings();
          });
      })
      .addButton((btn) =>
        btn
          .setIcon("key")
          .setTooltip("Add API key")
          .onClick(async () => {
            new AskForAPI(this.app, this.plugin).open();
          })
      );
    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc(
        createFragment((frag) => {
          frag.appendText("System message for each new chat.");
          frag.createEl("br");
          frag.appendText("Press [ to link a file.");
        })
      )
      .setClass("PURE")
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.SystemPrompt)
          .setValue(
            settings.SystemPrompt !== DEFAULT_SETTINGS.SystemPrompt ? settings.SystemPrompt : ""
          )
          .onChange(async (value) => {
            settings.SystemPrompt = value || DEFAULT_SETTINGS.SystemPrompt;
            await this.plugin.saveSettings();
          });
        // Listen for "/" or "[" key to open FileSuggest
        text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "/" || e.key === "[") {
            e.preventDefault();
            new FileSuggest(this.app, (file) => {
              // Insert the selected file at the cursor position
              const cursorPos = text.inputEl.selectionStart ?? 0;
              const before = text.inputEl.value.slice(0, cursorPos);
              const after = text.inputEl.value.slice(cursorPos);
              const insert = `[[${file}]]`;
              text.setValue(before + insert + after);
              // Move cursor after inserted text
              setTimeout(() => {
                text.inputEl.selectionStart = text.inputEl.selectionEnd =
                  before.length + insert.length;
                text.inputEl.focus();
              }, 0);
            }).open();
          }
        });

        return text.inputEl;
      });
    new Setting(containerEl)
      .setName("Selection commands")
      .setDesc("Edit selection prompt templates for the selection commands.")
      .addButton((btn) =>
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
      .addButton((btn) =>
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

    new Setting(containerEl).setName("Advanced").setHeading();
    new Setting(containerEl)
      .setName("Autogenerate title")
      .setDesc(
        "How many responses to wait for before automatically creating a conversation title (set to 0 to disable)."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.AutogenerateTitle.toString())
          .setValue(
            settings.AutogenerateTitle !== DEFAULT_SETTINGS.AutogenerateTitle
              ? settings.AutogenerateTitle.toString()
              : ""
          )
          .onChange(async (value) => {
            const num = value ? Number(value) : DEFAULT_SETTINGS.AutogenerateTitle;
            settings.AutogenerateTitle = num || 0;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto reverse roles")
      .setDesc("Automatically switch roles when the last message is empty, for replying to self.")
      .addToggle((toggle) => {
        toggle.setValue(settings.AutoReverseRoles).onChange(async (value) => {
          settings.AutoReverseRoles = value;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName("Add file to context for editing")
      .setDesc("Include the current file content in the context for selection editing.")
      .addToggle((toggle) => {
        toggle.setValue(settings.addfiletocontext).onChange(async (value) => {
          settings.addfiletocontext = value;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName("Chat style")
      .setDesc("Select how chats are written and interpreted in markdown.")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(
            Object.fromEntries(
              Object.entries(StatSett.chatParser).map(([key, value]) => [key, value.description])
            )
          )
          .setValue(settings.chatParser.toString())
          .onChange(async (value) => {
            settings.chatParser = parseInt(value, 10);
            await this.plugin.saveSettings();
          });
      });
    new Setting(containerEl)
      .setName("Debug")
      .setDesc("Enable logging of detailed debug information in the console for troubleshooting.")
      .addToggle((toggle) =>
        toggle.setValue(settings.debug).onChange(async (value) => {
          settings.debug = value;
          await this.plugin.saveSettings();
          this.plugin.console = new BrowserConsole(settings.debug, "PureChatLLM");
          console.log("reload the plugin to apply the changes");
        })
      );
    new Setting(containerEl)
      .setName("Version")
      .setDesc(`v${version}`)
      .addButton((btn) =>
        btn
          .setButtonText("Reset settings")
          .setTooltip("Won't delete the API keys.")
          .setWarning()
          .onClick((e) => {
            const oldSettings = { ...this.plugin.settings };
            this.plugin.settings = { ...DEFAULT_SETTINGS };
            for (const endpoint in this.plugin.settings.endpoints) {
              if (DEFAULT_SETTINGS.endpoints[endpoint])
                this.plugin.settings.endpoints[endpoint].apiKey =
                  oldSettings.endpoints[endpoint].apiKey;
            }
            this.plugin.saveSettings();
            this.display();
            new Notice("Settings reset to defaults.  API keys are unchanged.");
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Hot keys")
          .setCta()
          .onClick((e) => this.plugin.openHotkeys())
      );
  }
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
  promptTitle: string;
  constructor(
    app: App,
    private plugin: PureChatLLM,
    private promptTemplates: { [key: string]: string },
    private defaultTemplates: { [key: string]: string } = {},
    private inCMD: { [key: string]: boolean } = {}
  ) {
    super(app);
    this.plugin = plugin;
    this.update();
  }
  update() {
    this.contentEl.empty();
    if (!this.promptTitle)
      this.promptTitle = Object.keys(this.promptTemplates)[0] || "New template";
    if (this.promptTitle && !this.promptTemplates[this.promptTitle])
      this.promptTemplates[this.promptTitle] = "";
    this.setTitle("Selection prompt templates");
    Object.keys(this.promptTemplates)
      .sort()
      .forEach((key) =>
        new Setting(this.contentEl)
          .setName(key !== this.promptTitle ? key : "Editing...")
          .addExtraButton((btn) =>
            btn.setIcon(this.inCMD[key] ? "minus" : "plus").onClick(() => {
              this.inCMD[key] = !this.inCMD[key];
              this.update();
            })
          )
          .addExtraButton((btn) =>
            btn
              .setIcon("trash")
              .setTooltip("Delete this template")
              .onClick(() => {
                delete this.promptTemplates[key];
                this.promptTitle = Object.keys(this.promptTemplates)[0];
                this.update();
              })
          )
          .addButton((btn) => {
            btn
              .setIcon("pencil")
              .setTooltip("Edit this template")
              .onClick(() => {
                this.promptTitle = key;
                this.update();
              });
            if (key === this.promptTitle) btn.setCta();
          })
      );
    new Setting(this.contentEl).setName("Add a new template").addText((text) =>
      text
        .setPlaceholder("New template title")
        .setValue("")
        .inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            const value = text.getValue().trim();
            if (value) {
              this.promptTitle = value;
              if (!this.promptTemplates[this.promptTitle])
                this.promptTemplates[this.promptTitle] = "";
              const promptTemplatesSummary = Object.entries(this.promptTemplates)
                .map(([k, v]) => `## template: ${k} \n\n ${v}`)
                .join("\n");
              new PureChatLLMChat(this.plugin)
                .appendMessage({
                  role: "system",
                  content: `You are editing templates for the PureChatLLM plugin.  # Here are the templates:\n\n${promptTemplatesSummary}`,
                })
                .appendMessage({
                  role: "user",
                  content: `You are creating a new template called: \`"${this.promptTitle}"\`.  Please predict the content for this prompt template.`,
                })
                .CompleteChatResponse(null as any)
                .then((chat) => {
                  if (!this.promptTemplates[this.promptTitle]) {
                    this.promptTemplates[this.promptTitle] =
                      chat.messages
                        .at(-2)
                        ?.content.replace(/^#.+?\n/, "")
                        .trim() || "";
                    this.update();
                  }
                });

              this.update();
            }
          }
        })
    );
    new Setting(this.contentEl)
      .setName("Template name")
      .setHeading()

      .setTooltip("Change the name of the current template.")
      .addText((text) => {
        text
          .setPlaceholder("Template name")
          .setValue(this.promptTitle)
          .onChange((value) => {
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
      .onChange((value) => (this.promptTemplates[this.promptTitle] = value));
    new Setting(this.contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(async () => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Reset all")
          .setTooltip("Reset all templates to default values.")
          .setWarning()
          .onClick(async () => {
            Object.assign(this.promptTemplates, this.defaultTemplates);
            this.promptTitle = Object.keys(this.promptTemplates)[0] || "New template";
            this.update();
          })
      );
    this.setTitle(this.promptTitle);
  }
  onClose(): void {
    this.plugin.saveSettings();
  }
}

/**
 * A modal dialog for prompting the user to enter a string value.
 *
 * Displays a text input field and "OK" and "Cancel" buttons.
 * When "OK" is clicked, the provided callback is invoked with the entered value.
 *
 * @extends Modal
 * @param app - The Obsidian application instance.
 * @param title - The title of the modal dialog.
 * @param placeholder - The placeholder text for the input field.
 * @param cb - Optional callback function to receive the entered value when "OK" is clicked.
 */
class PromptName extends Modal {
  constructor(app: App, title: string, placeholder: string, cb?: (value: string) => void) {
    super(app);
    this.setTitle(title);
    const t = new TextComponent(this.contentEl).setPlaceholder(placeholder);
    new Setting(this.contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("OK")
          .setCta()
          .onClick(() => {
            cb?.(t.getValue());
            this.close();
          })
      )
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }
}

/**
 * A modal dialog that provides a fuzzy search interface for selecting markdown files
 * from the current Obsidian vault. Extends `FuzzySuggestModal` to display file paths
 * and returns the selected file path via the provided `onSubmit` callback.
 *
 * @extends FuzzySuggestModal<string>
 *
 * @example
 * ```typescript
 * new FileSuggest(app, (filePath) => {
 *   // Handle the selected file path
 * });
 * ```
 *
 * @param app - The current Obsidian application instance.
 * @param onSubmit - Callback invoked with the selected file path when a file is chosen.
 *
 * @public
 */
class FileSuggest extends FuzzySuggestModal<string> {
  onSubmit: (result: string) => void;
  files: TFile[];
  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.files = app.vault.getMarkdownFiles();
    this.setPlaceholder("Search for a file...");
  }
  getItems(): string[] {
    return this.files.map((f) => f.path);
  }
  getItemText(file: string): string {
    return file;
  }
  onChooseItem(file: string, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(file);
  }
}

class PureChatEditorSuggest extends EditorSuggest<string> {
  type: string;
  plugin: PureChatLLM;
  constructor(app: App, plugin: PureChatLLM) {
    super(app);
    this.plugin = plugin;
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile | null
  ): EditorSuggestTriggerInfo | null {
    //const line = editor.getLine(cursor.line);
    const line = editor.getRange({ ...cursor, ch: 0 }, cursor); // Get the line text
    if (/^(```|# |send)/i.test(line))
      return {
        start: { line: cursor.line, ch: 0 },
        end: { line: cursor.line, ch: line.length },
        query: line.toLowerCase(),
      };
    else return null;
  }

  getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
    if (context.query === "send") {
      this.type = "send";
      return ["send"];
    }
    if (context.query.startsWith("```")) {
      this.type = "code";
      const query = context.query.slice(3).toLowerCase().trim();
      if (query) return codelanguages.filter((lang) => lang.startsWith(query)).slice(0, 100);
      else return ["", ...codelanguages.sort().slice(0, 100)];
    } else if (context.query.startsWith("# ")) {
      this.type = "role";
      const roles = ["user", "assistant", "system", "developer"];
      const query = context.query.slice(2).toLowerCase().trim();

      return roles.filter((h) => h.startsWith(query) || ("role: " + h).startsWith(query));
    }
    return [];
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    switch (this.type) {
      case "send":
        el.textContent = "Send to LLM";
        break;
      case "code":
        el.textContent = value;
        break;
      case "role":
        el.textContent = `role: ${toTitleCase(value)}`;
        break;
    }
  }

  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const { start, end, editor, query } = this.context;
    switch (this.type) {
      case "send":
        editor.replaceRange("", start, end);
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        this.plugin.CompleteChatResponse(editor, view);
        break;
      case "code":
        editor.replaceRange(`\`\`\`${value}\n`, start, end);
        editor.setCursor({
          line: start.line + 1,
          ch: 0,
        });
        break;
      case "role":
        editor.replaceRange(`# role: ${toTitleCase(value)}\n`, start, end);
        editor.setCursor({
          line: start.line + 1,
          ch: 0,
        });
    }
  }
}

import {
  App,
  ButtonComponent,
  Editor,
  ExtraButtonComponent,
  FuzzySuggestModal,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TextAreaComponent,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { codeContent, PureChatLLMChat } from "./Chat";
import { BrowserConsole } from "./BrowserConsole";
import { StatSett } from "./settings";
import { PureChatLLMSideView } from "./SideView";
import { PureChatLLMSpeech } from "./Speech";
import {
  DEFAULT_PROCESS_CHAT_TEMPLATES,
  DEFAULT_SELECTION_TEMPLATES,
  DEFAULT_SETTINGS,
  EmptyApiKey,
  PURE_CHAT_LLM_VIEW_TYPE,
  PureChatLLMInstructPrompt,
  PureChatLLMInstructPrompts,
  PureChatLLMSettings,
} from "./types";

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
    if (this.settings.endpoints.length == 0) {
      this.settings.endpoints = StatSett.ENDPOINTS;
    }

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
      name: "Edit Selection",
      editorCheckCallback: (checking, e: Editor) => {
        const selected = e.getSelection();
        if (checking) return !!selected;
        this.GetInstructPrompts("PureChatLLM/templates.md", {
          ...DEFAULT_SELECTION_TEMPLATES,
          "Custom prompt": { name: "Custom prompt", template: "" },
        }).then((templates) =>
          new InstructPromptsHandler(
            this.app,
            (s) =>
              s.template
                ? new PureChatLLMChat(this)
                    .SelectionResponse(s, selected)
                    .then((response) => e.replaceSelection(response.content))
                : new EditSelectionModal(this.app, this, selected, (text) =>
                    e.replaceSelection(text)
                  ).open(),
            templates
          ).open()
        );
      },
    });
    this.addCommand({
      id: "save-templates",
      name: "Save templates",
      callback: async () => {
        const folderPath = "PureChatLLM";
        const filePath = `${folderPath}/templates.md`;
        // Check if folder exists, create if not
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
          await this.app.vault.createFolder(folderPath);
        }
        await this.app.vault.create(
          filePath,
          Object.values(DEFAULT_SELECTION_TEMPLATES)
            .map((t) => `# ${t.name}\n${t.template}`)
            .join("\n\n")
        );
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
          DEFAULT_PROCESS_CHAT_TEMPLATES
        ).open();
      },
    });
    // Add command for opening the settings
    this.addCommand({
      id: "open-hotkeys",
      name: "Open hotkeys",
      icon: "key",
      callback: async () => {
        this.openHotkeys();
      },
    });
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
      name: "Speak Chat",
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

    // Add a context menu item for simplifying the selection
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
        //menu.addChild(new MenuItem().setTitle("Pure Chat LLM").setIcon("wand"))
        this.addItemsToMenu(menu, editor, view);
      })
    );

    // Add settings tab
    this.addSettingTab(new PureChatLLMSettingTab(this.app, this));
    if (this.settings.debug) {
      this.app.workspace.onLayoutReady(() => {
        this.activateView();
        //this.openHotkeys();
      });
    }
  }

  async openHotkeys(): Promise<void> {
    // make sure this stays up to date as the documentation does'nt include all the functions used here
    const setting = (this.app as any).setting;
    await setting.open();
    this.console.log(setting.activeTab.searchComponent);
    setting.openTabById("hotkeys");
    setting.activeTab.searchComponent.setValue("Pure Chat LLM");
    setting.activeTab.searchComponent.onChanged();
  }

  onUserEnable() {
    this.activateView();
    this.openHotkeys();
    this.console.log("Plugin enabled");
  }

  private GetInstructPrompts(
    folderNName: string,
    DefaultInstructPrompts: PureChatLLMInstructPrompts
  ): Promise<PureChatLLMInstructPrompts> {
    const file = this.app.vault.getAbstractFileByPath(folderNName);
    if (file instanceof TFile)
      this.app.vault.cachedRead(file).then((InstructPrompts) =>
        Object.assign(
          DefaultInstructPrompts,
          Object.fromEntries(
            InstructPrompts.split("# ")
              .filter(Boolean)
              .map((tm) => {
                const [name, ...content] = tm.split("\n");
                return [
                  name.trim(),
                  {
                    name: name.trim(),
                    template: content.join("\n").trim(),
                  },
                ] as [string, PureChatLLMInstructPrompt];
              })
          )
        )
      );
    return Promise.resolve(DefaultInstructPrompts);
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
            .setTitle("Edit Selection")
            .setIcon("wand")
            .onClick(async () => {
              this.GetInstructPrompts("PureChatLLM/templates.md", DEFAULT_SELECTION_TEMPLATES).then(
                (templates) =>
                  new InstructPromptsHandler(
                    this.app,
                    (s) =>
                      new PureChatLLMChat(this)
                        .SelectionResponse(s, selected)
                        .then((response) => editor.replaceSelection(response.content)),
                    templates
                  ).open()
              );
            })
            .setSection("selection")
        )
        .addItem((item) =>
          item
            .setTitle("wand")
            .setIcon("wand")
            .onClick(async () => {
              new EditSelectionModal(this.app, this, editor.getSelection(), (s) =>
                editor.replaceSelection(s)
              ).open();
            })
            .setSection("selection")
        );

    return menu;
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
        .ProcessChatWithTemplate(DEFAULT_PROCESS_CHAT_TEMPLATES["Conversation titler"])
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // Cleanup code if needed
  }
}

/**
 * Modal dialog for displaying and handling code blocks extracted from a given string.
 *
 * This modal presents each code block in a separate section, showing its language and code content.
 * Users can edit the code in a textarea, copy the code to the clipboard, or open an advanced edit modal.
 *
 * @remarks
 * - Utilizes the `PureChatLLMChat.extractAllCodeBlocks` method to parse code blocks from the input string.
 * - Each code block is displayed with its language as a heading, an editable textarea, and action buttons.
 * - The modal is titled "Code Handling".
 *
 * @example
 * const modal = new CodeHandling(app, plugin, codeString);
 * modal.open();
 *
 * @param app - The Obsidian application instance.
 * @param plugin - The instance of the PureChatLLM plugin.
 * @param code - The string containing code blocks to be extracted and displayed.
 */
export class CodeHandling extends Modal {
  plugin: PureChatLLM;
  code: codeContent[];

  constructor(app: App, plugin: PureChatLLM, code: string) {
    super(app);
    this.plugin = plugin;
    this.code = this.getCode(code);
    this.setTitle("Code Handling");
    this.renderCodeBlocks();
  }

  private renderCodeBlocks() {
    if (!this.code.length) {
      new Setting(this.contentEl).setName("No code blocks found.");
      return;
    }
    this.code.forEach((c, idx) => {
      new Setting(this.contentEl).setName(c.language || `Code Block ${idx + 1}`).setHeading();

      const textArea = new CodeAreaComponent(this.contentEl).setValue(c.code).onChange((value) => {
        c.code = value;
      });

      new Setting(this.contentEl)
        .addExtraButton((btn) =>
          btn
            .setIcon("copy")
            .setTooltip("Copy to clipboard")
            .onClick(() => {
              navigator.clipboard.writeText(c.code);
              new Notice("Code copied to clipboard");
            })
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("pencil")
            .setTooltip("Edit with prompt")
            .onClick(() => {
              new EditSelectionModal(this.app, this.plugin, c.code, (newCode) => {
                c.code = newCode;
                textArea.setValue(newCode);
              }).open();
            })
        );
    });
  }

  getCode(code: string): codeContent[] {
    return PureChatLLMChat.extractAllCodeBlocks(code);
  }
}

/**
 * The `SectionHandling` class extends the `CodeHandling` class and provides
 * functionality for extracting and organizing code sections from a given string.
 * It is specifically designed to work with headers and their associated content.
 *
 * @extends CodeHandling
 */
export class SectionHandling extends CodeHandling {
  plugin: PureChatLLM;
  code: codeContent[];
  getCode(code: string): codeContent[] {
    // Extract all Headers and content from the input string
    // capture the headers and the text following them
    const regex = /^(#{1,6})\s*(.*?)\n([\s\S]*?)(?=\n#{1,6}|\n$)/gm;
    const matches = code.matchAll(regex);
    const sections: codeContent[] = [];
    for (const match of matches) {
      const header = match[2].trim();
      const content = match[3].trim();
      const level = match[1].length;
      sections.push({ language: header, code: content });
    }
    return sections;
  }
}

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
      .setName("API Key")
      .setDesc(`Enter your ${endpoint.name} API key.`)
      .addText((text) => {
        text
          .setPlaceholder(this.apiKey)
          .setValue(this.apiKey)
          .onChange((value) => {
            this.apiKey = value.trim();
          });
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            this.saveAndClose();
          }
        });
      });
    new Setting(this.contentEl)
      .setName("Default Model")
      .setDesc(`Enter the default model for ${endpoint.name}.`)
      .addText((text) => {
        text
          .setPlaceholder(endpoint.defaultmodel)
          .setValue(endpoint.defaultmodel)
          .onChange((value) => {
            endpoint.defaultmodel = value || endpoint.defaultmodel;
            this.plugin.saveSettings();
          });
      });
    new Setting(this.contentEl)
      .setName(
        createFragment((el) => el.createEl("a", { href: endpoint.getapiKey, text: endpoint.name }))
      )
      .setDesc(`Link to Get API key from ${endpoint.name}`)
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            this.saveAndClose();
          })
      )
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }

  private async saveAndClose() {
    this.plugin.settings.endpoints[this.plugin.settings.endpoint].apiKey =
      this.apiKey || EmptyApiKey;
    await this.plugin.saveSettings();
    this.close();
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
export class InstructPromptsHandler extends FuzzySuggestModal<PureChatLLMInstructPrompt> {
  onSubmit: (result: PureChatLLMInstructPrompt) => void;
  templates: PureChatLLMInstructPrompts;
  constructor(
    app: App,
    onSubmit: (result: PureChatLLMInstructPrompt) => void,
    templates: PureChatLLMInstructPrompts
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.templates = templates;
  }

  getItems(): PureChatLLMInstructPrompt[] {
    return Object.values(this.templates);
  }

  getItemText(book: PureChatLLMInstructPrompt): string {
    return book.name;
  }

  onChooseItem(book: PureChatLLMInstructPrompt, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(book);
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
      .setName("Pure Chat LLM")
      .setDesc(`v${StatSett.version}`)
      .addButton((btn) => btn.setButtonText("Hot keys").onClick((e) => this.plugin.openHotkeys()))
      .setHeading();
    new Setting(containerEl)
      .setName("Endpoint")
      .setDesc("Choose the server endpoint used for chat interactions.")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(Object.fromEntries(settings.endpoints.map((e, i) => [i.toString(), e.name])))
          .setValue(settings.endpoint.toString())
          .onChange(async (value) => {
            settings.endpoint = parseInt(value, 10);
            this.plugin.modellist = [];
            await this.plugin.saveSettings();
          });
      });
    new Setting(containerEl)
      .setName("Api keys")
      .setDesc("Configure API keys for different AI providers")
      .addButton((btn) =>
        btn
          .setIcon("key")
          .setTooltip("Add API keys")
          .onClick(async () => {
            new AskForAPI(this.app, this.plugin).open();
          })
      );
    new Setting(containerEl)
      .setName("Chat style")
      .setDesc(
        "Select how chats are written and interpreted in markdown (choose from multiple styles)."
      )
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
      .setName("Autogenerate title")
      .setDesc(
        "Specify how many responses to wait for before automatically creating a conversation title (set to 0 to disable)."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.AutogenerateTitle.toString())
          .setValue(settings.AutogenerateTitle.toString())
          .onChange(async (value) => {
            const num =
              value.length != 0 ? parseInt(value, 10) : DEFAULT_SETTINGS.AutogenerateTitle;
            if (!isNaN(num) && num >= 0) {
              settings.AutogenerateTitle = num;
              await this.plugin.saveSettings();
            }
          })
      );
    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc("Define the initial message or instructions the AI uses at the start of each chat.")
      .setClass("PURE")
      .addTextArea((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.SystemPrompt)
          .setValue(settings.SystemPrompt)
          .onChange(async (value) => {
            settings.SystemPrompt = value || DEFAULT_SETTINGS.SystemPrompt;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Auto Reverse Roles")
      .setDesc("Automatically switch roles when the last message is empty, for replying to self.")
      .addToggle((toggle) => {
        toggle.setValue(settings.AutoReverseRoles).onChange(async (value) => {
          settings.AutoReverseRoles = value;
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
  }
}

class CodeAreaComponent extends TextAreaComponent {
  constructor(containerEl: HTMLElement) {
    super(containerEl);
    this.inputEl.addClass("PUREcodePreview");
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
class EditSelectionModal extends Modal {
  plugin: PureChatLLM;
  app: App;

  // History management
  hist: string[];
  iHist: number = 1; // Current index in history
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
    onSubmit: (modifiedText: string) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.app = app;
    this.selection = selection;
    this.onSubmit = onSubmit;

    // Initialize history with the initial selection
    this.hist = [selection, selection];

    this.setTitle("Change Selection with Prompt");

    // Setup navigation buttons
    this.setupNavigationButtons();

    // Create selection textarea
    this.selectionEl = new CodeAreaComponent(this.contentEl)
      .setPlaceholder("Selection")
      .setValue(this.selection)
      .onChange((value) => {
        // Update the latest history entry when user edits selection
        this.hist[this.hist.length - 1] = value;
      });

    // Create prompt textarea
    this.promptEl = new CodeAreaComponent(this.contentEl)
      .setPlaceholder("Enter the prompt")
      .onChange((value) => {
        if (value.endsWith(">go")) {
          this.promptEl.setValue(value.slice(0, -3));
          this.send();
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
      .addExtraButton((btn) =>
        btn.setIcon("copy").onClick(async () => {
          await navigator.clipboard.writeText(this.selectionEl.getValue());
          new Notice("Selection copied to clipboard");
        })
      )
      .addExtraButton(
        (btn) =>
          (this.navButtons[0] = btn.setIcon("undo-2").onClick(async () => {
            this.iHist = Math.max(this.iHist - 1, 0);
            this.update(this.selectionEl, this.hist[this.iHist]);
          }))
      )
      .addExtraButton(
        (btn) =>
          (this.navButtons[1] = btn.setIcon("redo-2").onClick(async () => {
            this.iHist = Math.min(this.iHist + 1, this.hist.length - 1);
            this.update(this.selectionEl, this.hist[this.iHist]);
          }))
      );
  }

  /**
   * Setup action buttons: copy, send prompt, confirm, cancel.
   */
  private setupActionButtons() {
    new Setting(this.contentEl)
      // Send prompt to LLM and update selection with response
      .addExtraButton((btn) => btn.setIcon("send").onClick(this.send.bind(this)))
      // Confirm button
      .addButton((btn) =>
        btn
          .setIcon("check")
          .setCta()
          .onClick(async () => {
            this.close();
            this.onSubmit(this.selectionEl.getValue());
          })
      )
      // Cancel button
      .addButton((btn) => btn.setIcon("x").onClick(() => this.close()));
  }

  async send() {
    const promptText = this.promptEl.getValue();

    // Create LLM chat request
    const response = await new PureChatLLMChat(this.plugin)
      .setMarkdown(promptText)
      .SelectionResponse({ name: "", template: promptText }, this.selectionEl.getValue());

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

    console.log(this.hist);
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

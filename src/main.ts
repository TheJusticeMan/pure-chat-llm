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
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import { PureChatLLMChat } from "./Chat";
import { codelanguages } from "./codelanguages";
import { AskForAPI, CodeAreaComponent, EditWand } from "./models";
import { replaceNonKeyboardChars } from "./replaceNonKeyboard";
import { EmptyApiKey } from "./s.json";
import { PureChatLLMSettingTab } from "./settings";
import { modelAndProviderChooser, PureChatLLMSideView } from "./SideView";
import { PureChatLLMSpeech } from "./Speech";
import { toTitleCase } from "./toTitleCase";
import { DEFAULT_SETTINGS, PURE_CHAT_LLM_VIEW_TYPE, PureChatLLMSettings } from "./types";

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
  pureChatStatusElement: HTMLElement;

  async onload() {
    await this.loadSettings();
    this.pureChatStatusElement = this.addStatusBarItem();
    this.status("Loading...");
    this.console = new BrowserConsole(this.settings.debug, "PureChatLLM");
    this.console.log("settings loaded", this.settings);
    //runTest(this.settings.endpoints[0].apiKey); // Run the test function to check if the plugin is working

    this.registerView(PURE_CHAT_LLM_VIEW_TYPE, leaf => new PureChatLLMSideView(leaf, this));

    this.addRibbonIcon("text", "Open conversation overview", this.activateView.bind(this));

    this.setupChatCommandHandlers();

    this.setupContextMenuActions();

    this.registerEditorSuggest(new PureChatEditorSuggest(this.app, this));

    // Add settings tab
    this.addSettingTab(new PureChatLLMSettingTab(this.app, this));
    this.status("");
  }

  private setupContextMenuActions() {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
        this.addItemsToMenu(menu, editor, view);
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem(item => {
            item
              .setTitle("New conversation")
              .setIcon("message-square-plus")
              .setSection("action-primary")
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
        } else if (file instanceof TFile && file.extension === "md") {
          const link = this.app.fileManager.generateMarkdownLink(file, file.path);
          menu.addItem(item => {
            item
              .setTitle("New chat from file")
              .setIcon("message-square-plus")
              .setSection("action")
              .onClick(async () => {
                const fileName = this.generateUniqueFileName(file.parent!, `Untitled ${file.basename}`);

                const newFile = await this.app.vault.create(
                  `${file.parent!.path}/${fileName}.md`,
                  new PureChatLLMChat(this).setMarkdown(link).Markdown
                );
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(newFile);
                this.activateView();
              });
          });
          menu.addItem(item => {
            item
              .setTitle("New chat from file system prompt")
              .setIcon("message-square-plus")
              .setSection("action")
              .onClick(async () => {
                const fileName = this.generateUniqueFileName(file.parent!, `Untitled ${file.basename}`);

                const newFile = await this.app.vault.create(
                  `${file.parent!.path}/${fileName}.md`,
                  new PureChatLLMChat(this).setMarkdown(`# role: System\n${link}\n# role: User\n`).Markdown
                );
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(newFile);
                this.activateView();
              });
          });
        }
      })
    );
  }

  private setupChatCommandHandlers() {
    this.addCommand({
      id: "complete-chat-response",
      name: "Complete chat response",
      icon: "send",
      editorCallback: this.CompleteChatResponse.bind(this),
    });
    // Add command for choosing model and provider
    this.addCommand({
      id: "choose-model-and-provider",
      name: "Choose model and provider",
      icon: "cpu",
      editorCallback: (editor: Editor) => new modelAndProviderChooser(this.app, this, editor),
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
      icon: "wand",
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
          s =>
            new PureChatLLMChat(this)
              .setMarkdown(editor.getValue())
              .ProcessChatWithTemplate(s)
              .then(response => editor.replaceSelection(response.content)),
          this.settings.chatTemplates
        ).open();
      },
    });
    // Add command for opening the settings
    this.addCommand({
      id: "reverse-roles",
      name: "Reverse roles",
      icon: "arrow-left-right",
      editorCallback: (editor: Editor) => {
        const content = new PureChatLLMChat(this).setMarkdown(editor.getValue()).ReverseRoles();
        editor.setValue(content.Markdown);
        this.setCursorEnd(editor);
      },
    });
    this.addCommand({
      id: "speak-chat",
      name: "Speak chat",
      icon: "audio-lines",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new PureChatLLMSpeech(
          this,
          new PureChatLLMChat(this).setMarkdown(editor.getValue()).thencb(chat => {
            chat.messages = chat.messages.filter(message => message.role === "user" || message.role === "assistant");
          })
        ).startStreaming();
      },
    });
    // replaceNonKeyboardChars is used to replace non-keyboard characters with their keyboard equivalents
    this.addCommand({
      id: "replace-non-keyboard-chars",
      name: "Replace non-keyboard characters",
      icon: "text-cursor-input",
      editorCallback: (editor: Editor) => {
        editor.setValue(replaceNonKeyboardChars(this, editor.getValue()));
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
              .then(response => editor.replaceSelection(response.content));
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
              .setMarkdown(e.getValue())
              .SelectionResponse(template, selected, addfiletocontext ? e.getValue() : undefined)
              .then(response => e.replaceSelection(response.content));
          },
        });
      }
    });
  }

  status(text: string) {
    // Display a message in the status bar
    this.pureChatStatusElement.setText(`[Pure Chat LLM] ${text}`);
  }

  generateUniqueFileName(folder: TFolder, baseName: string) {
    // Generate a unique file name in the specified folder
    const files = folder.children.filter(f => f instanceof TFile).map(f => f.name);
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
        .addItem(item =>
          item
            .setTitle("Edit selection")
            .setIcon("wand")
            .onClick(async () => {
              this.EditSelection(selected, editor);
            })
            .setSection("selection")
        )
        .addItem(item =>
          item
            .setTitle("wand")
            .setIcon("wand")
            .onClick(async () => {
              new EditWand(this.app, this, editor.getSelection(), s => editor.replaceSelection(s)).open();
            })
            .setSection("selection")
        );

    return menu;
  }

  private EditSelection(selected: string, editor: Editor) {
    new InstructPromptsHandler(
      this.app,
      s =>
        s
          ? new PureChatLLMChat(this)
              .setMarkdown(editor.getValue())
              .SelectionResponse(s, selected, this.settings.addfiletocontext ? editor.getValue() : undefined)
              .then(response => editor.replaceSelection(response.content))
          : new EditWand(this.app, this, selected, text => editor.replaceSelection(text)).open(),
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
        .then(title => {
          const sanitizedTitle = `${ActiveFile.parent?.path}/${title.content
            .replace(/^<think>[\s\S]+?<\/think>/gm, "") // Remove <think> tags for ollama
            .replace(/[^a-zA-Z0-9 !.,+\-_=]/g, "")
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
      if (chat.messages.pop()?.role == "user" && this.settings.AutoReverseRoles) chat.ReverseRoles();
    }
    editor.setValue(chat.Markdown);
    this.setCursorEnd(editor, true);
    if (!chat.validChat) return;

    this.isresponding = true;

    editor.replaceSelection(`\n${chat.parseRole("assistant..." as any)}\n`);
    chat
      .CompleteChatResponse(activeFile, e => {
        this.setCursorEnd(editor);
        editor.replaceSelection(e.content);
        return true;
      })
      .then(chat => {
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
      .catch(error => this.console.error(error))
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

    // Compatibility fixes for older versions

    if (loadedData.chatParser === 1) {
      this.settings.messageRoleFormatter = "\\n> [!note] {role}\\n> # role: {role}\\n";
      // @ts-ignore
      delete this.settings.chatParser;
    }
    const oldSystemPrompt =
      "You are ChatGPT, a large language model trained by OpenAI. Carefully heed the user's instructions. Respond using Markdown.\n\nBe attentive, thoughtful, and precise—provide clear, well-structured answers that honor the complexity of each query. Avoid generic responses; instead, offer insights that encourage creativity, reflection, and learning. Employ subtle, dry humor or depth when appropriate. Respect the user’s individuality and values, adapting your tone and approach as needed to foster a conversational, meaningful, and genuinely supportive exchange.";
    if (this.settings.SystemPrompt === oldSystemPrompt) this.settings.SystemPrompt = DEFAULT_SETTINGS.SystemPrompt;

    DEFAULT_SETTINGS.endpoints.forEach(
      endpoint => this.settings.endpoints.find(e => e.name === endpoint.name) || this.settings.endpoints.push(endpoint)
    );
  }

  async saveSettings() {
    this.settings.selectionTemplates = Object.fromEntries(
      Object.keys(this.settings.selectionTemplates)
        .sort()
        .map(key => [key, this.settings.selectionTemplates[key]])
        .filter(([key, value]) => key && value)
    );
    this.settings.chatTemplates = Object.fromEntries(
      Object.keys(this.settings.chatTemplates)
        .sort()
        .map(key => [key, this.settings.chatTemplates[key]])
        .filter(([key, value]) => key && value)
    );
    await this.saveData(this.settings);
  }

  onunload() {
    // Cleanup code if needed
  }
}

export class StreamNotice {
  fulltext: string = "";
  notice: Notice;
  constructor(public app: App, init?: string) {
    this.notice = new Notice(init || "Generating response for selection...");
  }
  change = (e: any) => {
    if (!e?.content) return true;
    this.fulltext += e.content;
    this.notice.setMessage(this.fulltext);
    return true;
  };
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
 * Modal dialog for editing and managing selection prompt templates within the PureChatLLM plugin.
 *
 * This class provides a UI for users to create, select, and edit named prompt templates
 * that are stored in the plugin's settings. It features a dropdown for selecting existing
 * templates, a button to add new templates, and a code editor area for editing the template content.
 *
 * @extends Modal
 */
export class SelectionPromptEditor extends Modal {
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
    if (!this.promptTitle) this.promptTitle = Object.keys(this.promptTemplates)[0] || "New template";
    if (this.promptTitle && !this.promptTemplates[this.promptTitle]) this.promptTemplates[this.promptTitle] = "";
    Object.keys(this.promptTemplates).forEach(key => (this.inCMD[key] = Boolean(this.inCMD[key])));
    const isAllinCMD = Object.values(this.inCMD).every(v => v);
    new Setting(this.contentEl)
      .setName("All templates")
      .setDesc("Manage all prompt templates for the PureChatLLM plugin.")
      .setHeading()
      .addExtraButton(btn =>
        btn
          .setIcon(isAllinCMD ? "minus" : "plus")
          .setTooltip(isAllinCMD ? "Remove all from command palette" : "Add all to command palette")
          .onClick(() => {
            Object.keys(this.inCMD).forEach(key => (this.inCMD[key] = !isAllinCMD));
            this.update();
          })
      )
      .addExtraButton(btn =>
        btn
          .setIcon("trash")
          .setTooltip("Delete all templates")
          .onClick(() => {
            Object.keys(this.promptTemplates).forEach(key => {
              delete this.promptTemplates[key];
              delete this.inCMD[key];
            });
            this.promptTitle = "New template";
            this.update();
          })
      );
    Object.keys(this.promptTemplates)
      .sort()
      .forEach(key =>
        new Setting(this.contentEl)
          .setName(key !== this.promptTitle ? key : "Editing...")
          .addExtraButton(btn =>
            btn
              .setIcon(this.inCMD[key] ? "minus" : "plus")
              .setTooltip("Use this template in the command palette")
              .onClick(() => {
                this.inCMD[key] = !this.inCMD[key];
                this.update();
              })
          )
          .addExtraButton(btn =>
            btn
              .setIcon("trash")
              .setTooltip("Delete this template")
              .onClick(() => {
                delete this.promptTemplates[key];
                this.promptTitle = Object.keys(this.promptTemplates)[0];
                this.update();
              })
          )
          .addButton(btn => {
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
    new Setting(this.contentEl).setName("Add a new template").addText(text =>
      text
        .setPlaceholder("New template title")
        .setValue("")
        .inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === "Tab") {
            const value = text.getValue().trim();
            if (value) this.generateTemplateContent(value);
          }
        })
    );

    new Setting(this.contentEl)
      .setName("Template name")
      .setHeading()

      .setTooltip("Change the name of the current template.")
      .addText(text => {
        text
          .setPlaceholder("Template name")
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
          .setButtonText("Save")
          .setCta()
          .onClick(async () => this.close())
      )
      .addButton(btn =>
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

  private generateTemplateContent(value: string) {
    this.promptTitle = value;
    if (!this.promptTemplates[this.promptTitle]) this.promptTemplates[this.promptTitle] = "";
    const promptTemplatesSummary = Object.entries(this.promptTemplates)
      .map(([k, v]) => `## template: ${k} \n\n ${v}`)
      .join("\n");
    new PureChatLLMChat(this.plugin)
      .appendMessage(
        {
          role: "system",
          content: `You are editing templates for the PureChatLLM plugin.\n\n# Here are the templates:\n\n${promptTemplatesSummary}`,
        },
        {
          role: "user",
          content: `You are creating a new template called: \`"${this.promptTitle}"\`.  Please predict the content for this prompt template.`,
        }
      )
      .CompleteChatResponse(null as any)
      .then(chat => {
        if (!this.promptTemplates[this.promptTitle]) {
          this.promptTemplates[this.promptTitle] = chat.messages.at(-2)?.content.trim() || "";
          this.update();
        }
      });
    this.update();
  }

  onClose(): void {
    this.plugin.saveSettings();
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
export class FileSuggest extends FuzzySuggestModal<TFile> {
  onSubmit: (File: TFile) => void;
  files: TFile[];
  constructor(app: App, onSubmit: (result: TFile) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.files = app.vault.getMarkdownFiles();
    this.setPlaceholder("Search for a file...");
  }
  getItems(): TFile[] {
    return this.files;
  }
  getItemText(file: TFile): string {
    return file.path;
  }
  onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(file);
  }
}

/**
 * A modal dialog that provides fuzzy search and selection of folders within the vault.
 *
 * Extends `FuzzySuggestModal<TFolder>` to allow users to quickly find and select a folder.
 *
 * @remarks
 * - The list of folders is populated from all loaded files in the vault, filtered to only include instances of `TFolder`.
 * - The modal displays the folder's path as the search text.
 * - When a folder is chosen, the provided `onSubmit` callback is invoked with the selected folder.
 * - An optional prompt can be set as the placeholder text in the search input.
 *
 * @example
 * ```typescript
 * new FolderSuggest(app, (folder) => {
 *   // Handle selected folder
 * });
 * ```
 *
 * @param app - The Obsidian application instance.
 * @param onSubmit - Callback invoked when a folder is selected.
 * @param prompt - Optional placeholder text for the search input.
 */
export class FolderSuggest extends FuzzySuggestModal<TFolder> {
  onSubmit: (result: TFolder) => void;
  folders: TFolder[];
  constructor(app: App, onSubmit: (result: TFolder) => void, prompt?: string) {
    super(app);
    this.onSubmit = onSubmit;
    this.folders = app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder) as TFolder[];
    this.setPlaceholder(prompt || "Search for a folder...");
  }
  getItems(): TFolder[] {
    return this.folders;
  }
  getItemText(folder: TFolder): string {
    return folder.path;
  }
  onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(folder);
  }
}

export class PureChatEditorSuggest extends EditorSuggest<string> {
  type: string;
  plugin: PureChatLLM;
  constructor(app: App, plugin: PureChatLLM) {
    super(app);
    this.plugin = plugin;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    //const line = editor.getLine(cursor.line);
    const line = editor.getRange({ ...cursor, ch: 0 }, cursor); // Get the line text
    if (/^(```[a-z]|# |send)/i.test(line))
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
      if (query) return codelanguages.filter(lang => lang.startsWith(query)).slice(0, 100);
      else return ["", ...codelanguages.sort().slice(0, 100)];
    } else if (context.query.startsWith("# ")) {
      this.type = "role";
      const roles = ["user", "assistant", "system", "developer"];
      const query = context.query.slice(2).toLowerCase().trim();

      return roles.filter(h => h.startsWith(query) || ("role: " + h).startsWith(query));
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
        this.plugin.settings.messageRoleFormatter;
        editor.replaceRange(`${new PureChatLLMChat(this.plugin).parseRole(value as any)}\n`, start, end);
        editor.setCursor({
          line: start.line + 1,
          ch: 0,
        });
    }
  }
}

export function getObjectFromMarkdown(
  rawMarkdown: string,
  level = 1,
  maxlevel = 6
): Record<string, string | Record<string, any>> {
  return Object.fromEntries(
    rawMarkdown
      .trim()
      .split(new RegExp(`^${"#".repeat(level)} `, "gm"))
      .slice(1)
      .map((s): [string, string | Record<string, any>] => {
        const [title, ...content] = s.split("\n");
        const joinedContent = content.join("\n");
        if (level < maxlevel && joinedContent.includes("\n" + "#".repeat(level + 1) + " ")) {
          return [title.trim(), getObjectFromMarkdown(joinedContent, level + 1, maxlevel)];
        }
        return [title.trim(), joinedContent.trim()];
      })
  );
}

export function getMarkdownFromObject(obj: Record<string, string | Record<string, any>>, level = 1): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      const prefix = "#".repeat(level);
      if (typeof value === "string") {
        return `${prefix} ${key}\n\n${value}\n`;
      } else {
        return `${prefix} ${key}\n\n${getMarkdownFromObject(value, level + 1)}`;
      }
    })
    .join("\n");
}

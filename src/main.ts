import {
  addIcon,
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  FuzzySuggestModal,
  loadPrism,
  MarkdownView,
  Menu,
  Plugin,
  setIcon,
  TFile,
  TFolder,
} from 'obsidian';
import { DEFAULT_SETTINGS } from './assets/constants';
import { completeChatResponse, generateTitle, PureChatLLMChat } from './core/Chat';
import { PureChatLLMSpeech } from './core/Speech';
import {
  PURE_CHAT_LLM_ICON_NAME,
  PURE_CHAT_LLM_ICON_SVG,
  PURE_CHAT_LLM_VIEW_TYPE,
  PureChatLLMSettings,
  RoleType,
  VOICE_CALL_VIEW_TYPE,
} from './types';
import {
  CODE_PREVIEW_VIEW_TYPE,
  CodePreview,
  CodeSnippetState,
  createCodeblockExtension,
} from './ui/CodePreview';
import { editWand } from './ui/Modals';
import { PureChatLLMSettingTab } from './ui/Settings';
import { ModelAndProviderChooser, PureChatLLMSideView } from './ui/SideView';
import { VoiceCallSideView } from './ui/VoiceCallSideView';
import { BrowserConsole } from './utils/BrowserConsole';
import { replaceNonKeyboardChars } from './utils/replaceNonKeyboard';
import { toTitleCase } from './utils/toTitleCase';
import { WriteHandler } from './utils/write-handler';

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
  pureChatStatusElement: HTMLElement;
  codeBlock: CodeSnippetState = { code: '', language: '' };

  /**
   * Initializes the plugin by loading settings, registering views, commands, and setting up the UI.
   *
   * This method is called when the plugin is loaded. It sets up all the necessary components
   * including status bar items, views, commands, context menus, and editor extensions.
   *
   * @returns {Promise<void>}
   */
  async onload() {
    await this.loadSettings();
    addIcon(PURE_CHAT_LLM_ICON_NAME, PURE_CHAT_LLM_ICON_SVG);

    this.pureChatStatusElement = this.addStatusBarItem();

    void this.status('Loading...');
    this.console = new BrowserConsole(this.settings.debug, 'PureChatLLM');
    this.console.log('settings loaded', this.settings);
    //runTest(this.settings.endpoints[0].apiKey); // Run the test function to check if the plugin is working

    this.registerView(PURE_CHAT_LLM_VIEW_TYPE, leaf => new PureChatLLMSideView(leaf, this));
    this.registerView(CODE_PREVIEW_VIEW_TYPE, leaf => new CodePreview(leaf, this));
    this.registerView(VOICE_CALL_VIEW_TYPE, leaf => new VoiceCallSideView(leaf, this));

    this.addRibbonIcon(
      PURE_CHAT_LLM_ICON_NAME,
      'Open conversation overview',
      this.activateChatView,
    );
    this.addRibbonIcon('phone', 'Open voice call', this.activateVoiceCallView);

    this.setupChatCommandHandlers();
    this.setupVoiceCallCommandHandlers();

    this.setupContextMenuActions();

    this.registerEditorExtension(createCodeblockExtension(this.app, this));

    // Add settings tab
    this.addSettingTab(new PureChatLLMSettingTab(this.app, this));
    void this.status('');
    this.app.workspace.onLayoutReady(async () =>
      this.registerEditorSuggest(
        new PureChatEditorSuggest(
          this.app,
          this,
          Object.keys(((await loadPrism()) as { languages: { [key: string]: string } }).languages),
        ),
      ),
    );
  }

  /**
   * Sets up context menu actions for the plugin.
   *
   * Registers event handlers for editor and file context menus, adding custom items
   * for creating new conversations, chats from files, and chat-related actions.
   *
   * @returns {void}
   */
  private setupContextMenuActions() {
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) =>
        this.addItemsToMenu(menu, editor, view),
      ),
    );

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFolder)
          menu.addItem(item =>
            item
              .setTitle('New conversation')
              .setIcon('message-square-plus')
              .setSection('action-primary')
              .onClick(
                async () => (
                  await this.app.workspace
                    .getLeaf(true)
                    .openFile(
                      await this.app.vault.create(
                        `${file.path}/${this.generateUniqueFileName(file, 'Untitled Conversation')}.md`,
                        new PureChatLLMChat(this).setMarkdown('Type your message...').getMarkdown(),
                      ),
                    ),
                  void this.activateChatView()
                ),
              ),
          );
        else if (file instanceof TFile && file.extension === 'md') {
          const link = this.app.fileManager.generateMarkdownLink(file, file.path);
          const parent = file.parent || this.app.vault.getRoot();
          menu
            .addItem(item =>
              item
                .setTitle('New chat from file')
                .setIcon('message-square-plus')
                .setSection('action')
                .onClick(
                  async () => (
                    await this.app.workspace
                      .getLeaf(true)
                      .openFile(
                        await this.app.vault.create(
                          `${parent.path}/${this.generateUniqueFileName(parent, `Untitled ${file.basename}`)}.md`,
                          new PureChatLLMChat(this).setMarkdown(link).getMarkdown(),
                        ),
                      ),
                    void this.activateChatView()
                  ),
                ),
            )
            .addItem(item =>
              item
                .setTitle('New chat from file system prompt')
                .setIcon('message-square-plus')
                .setSection('action')
                .onClick(
                  async () => (
                    await this.app.workspace
                      .getLeaf(true)
                      .openFile(
                        await this.app.vault.create(
                          `${parent.path}/${this.generateUniqueFileName(parent, `Untitled ${file.basename}`)}.md`,
                          new PureChatLLMChat(this)
                            .setMarkdown(`# role: System\n${link}\n# role: User\n`)
                            .getMarkdown(),
                        ),
                      ),
                    void this.activateChatView()
                  ),
                ),
            );
        }
      }),
    );
  }

  /**
   * Sets up all chat-related command handlers for the plugin.
   *
   * Registers commands for completing chat responses, choosing models and providers,
   * generating titles, editing selections, analyzing conversations, reversing roles,
   * speaking chats, and handling custom templates. Also registers dynamic commands
   * for user-defined chat and selection templates.
   *
   * @returns {void}
   */
  private setupChatCommandHandlers() {
    this.addCommand({
      id: 'complete-chat-response',
      name: 'Complete chat response',
      icon: 'send',
      editorCallback: (editor: Editor, view: MarkdownView) =>
        this.completeChatResponse(editor, view),
    });
    // Add command for choosing model and provider
    this.addCommand({
      id: 'choose-model-and-provider',
      name: 'Choose model and provider',
      icon: 'cpu',
      editorCallback: (editor: Editor) => new ModelAndProviderChooser(this.app, this, editor),
    });
    // Add command for settings
    this.addCommand({
      id: 'generate-title',
      name: 'Generate title',
      icon: 'text-cursor-input',
      editorCallback: (editor: Editor, view: MarkdownView) => this.generateTitle(editor, view),
    });
    this.addCommand({
      id: 'edit-selection',
      name: 'Edit selection',
      icon: 'wand',
      editorCheckCallback: (checking, e: Editor) => {
        const selected = e.getSelection();
        if (checking) return !!selected;
        this.editSelection(selected, e);
      },
    });

    this.addCommand({
      id: 'analyze-conversation',
      name: 'Analyze conversation',
      icon: 'messages-square',
      editorCallback: (editor: Editor) =>
        new InstructPromptsHandler(
          this.app,
          s =>
            void new PureChatLLMChat(this)
              .setMarkdown(editor.getValue())
              .processChatWithTemplate(s)
              .then(response => editor.replaceSelection(response.content)),
          this.settings.chatTemplates,
        ).open(),
    });
    // Add command for opening the settings
    this.addCommand({
      id: 'reverse-roles',
      name: 'Reverse roles',
      icon: 'arrow-left-right',
      editorCallback: (editor: Editor) =>
        editor.setValue(
          new PureChatLLMChat(this).setMarkdown(editor.getValue()).reverseRoles().getMarkdown(),
        ),
    });
    this.addCommand({
      id: 'speak-chat',
      name: 'Speak chat',
      icon: 'audio-lines',
      editorCallback: (editor: Editor) =>
        void new PureChatLLMSpeech(
          this,
          new PureChatLLMChat(this)
            .setMarkdown(editor.getValue())
            .thencb(
              chat =>
                (chat.session.messages = chat.session.messages.filter(
                  message => message.role === 'user' || message.role === 'assistant',
                )),
            ),
        ).startStreaming(),
    });
    // replaceNonKeyboardChars is used to replace non-keyboard characters with their keyboard equivalents
    this.addCommand({
      id: 'replace-non-keyboard-chars',
      name: 'Replace non-keyboard characters',
      icon: 'text-cursor-input',
      editorCallback: (editor: Editor) =>
        editor.setValue(replaceNonKeyboardChars(this, editor.getValue())),
    });
    Object.keys(this.settings.CMDchatTemplates).forEach(key =>
      this.addCommand({
        id: `chat-template-${key.toLowerCase().replace(/\s+/g, '-')}`,
        name: `Chat: ${key}`,
        icon: 'wand',
        editorCallback: (editor: Editor) =>
          void new PureChatLLMChat(this)
            .setMarkdown(editor.getValue())
            .processChatWithTemplate(this.settings.chatTemplates[key])
            .then(response => editor.replaceSelection(response.content)),
      }),
    );
    Object.keys(this.settings.CMDselectionTemplates).forEach(key =>
      this.addCommand({
        id: `selection-template-${key.toLowerCase().replace(/\s+/g, '-')}`,
        name: `Selection: ${key}`,
        icon: 'wand',
        editorCheckCallback: (checking, e: Editor) => {
          const selected = e.getSelection();
          if (checking) return !!selected;
          void new PureChatLLMChat(this)
            .setMarkdown(e.getValue())
            .selectionResponse(
              this.settings.selectionTemplates[key],
              selected,
              this.settings.addfiletocontext ? e.getValue() : undefined,
            )
            .then(response => e.replaceSelection(response.content));
        },
      }),
    );
  }

  /**
   * Sets up voice call and blue resolution tree command handlers.
   *
   * Registers commands for opening the voice call panel, starting voice calls,
   * and opening the blue resolution tree view.
   *
   * @returns {void}
   */
  private setupVoiceCallCommandHandlers() {
    this.addCommand({
      id: 'open-voice-call',
      name: 'Open voice call panel',
      icon: 'phone',
      callback: this.activateVoiceCallView,
    });
  }

  /**
   * Updates the status bar with the provided text.
   *
   * Displays a message in the status bar prefixed with '[Pure Chat LLM]'.
   *
   * @param {string} text - The message text to display in the status bar.
   * @returns {void}
   */
  status(text: string) {
    this.pureChatStatusElement.empty();
    // Display a message in the status bar
    setIcon(this.pureChatStatusElement, PURE_CHAT_LLM_ICON_NAME);
    this.pureChatStatusElement.append(` ${text}`);
  }

  /**
   * Generates a unique file name in the specified folder.
   *
   * Checks for existing files with the same name and appends a number suffix
   * until a unique name is found.
   *
   * @param {TFolder} folder - The folder where the file will be created.
   * @param {string} baseName - The base name for the file (without extension).
   * @returns {string} A unique file name with .md extension.
   */
  generateUniqueFileName(folder: TFolder, baseName: string) {
    // Generate a unique file name in the specified folder
    const files = folder.children.filter(f => f instanceof TFile).map(f => f.name);
    let name = baseName;
    let i = 1;
    while (files.includes(`${name}.md`)) name = `${baseName} ${i++}`;
    return name;
  }

  /**
   * Opens the hotkeys settings tab and searches for Pure Chat LLM commands.
   *
   * Opens the settings panel, navigates to the hotkeys tab, and filters
   * the hotkeys to show only Pure Chat LLM related commands.
   *
   * @returns {Promise<void>}
   */
  openHotkeys = async (): Promise<void> => {
    // make sure this stays up to date as the documentation does'nt include all the functions used here
    await this.app.setting.open();
    this.app.setting.openTabById('hotkeys');
    this.app.setting.activeTab.searchComponent.setValue('Pure Chat LLM');
    this.app.setting.activeTab.searchComponent.onChanged();
  };

  /**
   *
   */
  openSettings = async (): Promise<void> => {
    await this.app.setting.open();
    this.app.setting.openTabById('pure-chat-llm');
  };

  /**
   * Called when the user enables the plugin.
   *
   * Activates the chat view when the plugin is first enabled by the user.
   * This provides immediate feedback and shows the plugin is ready to use.
   *
   * @returns {void}
   */
  onUserEnable() {
    void this.activateChatView();
  }

  /**
   * Activates the chat view in the workspace.
   *
   * @returns A promise that resolves when the view is activated
   */
  activateChatView = async () => await this.activateView(PURE_CHAT_LLM_VIEW_TYPE, 'right');

  /**
   * Activates the voice call view in the workspace.
   *
   * @returns A promise that resolves when the view is activated
   */
  activateVoiceCallView = async () => await this.activateView(VOICE_CALL_VIEW_TYPE, 'right');

  /**
   * Activates a specific view in the workspace.
   *
   * Creates or reveals a view of the specified type at the given position.
   * If the view already exists, it will be brought to the front. Otherwise,
   * a new leaf will be created at the specified position.
   *
   * @param {string} viewType - The type identifier of the view to activate (e.g., PURE_CHAT_LLM_VIEW_TYPE).
   * @param {'right' | 'left' | ''} position - The position to place the view: 'right', 'left', or empty for default.
   * @returns {Promise<void>}
   */
  async activateView(viewType: string, position: 'right' | 'left' | '' = ''): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(viewType)[0];

    if (!leaf) {
      const targetLeaf =
        position === 'right'
          ? workspace.getRightLeaf(false)
          : position === 'left'
            ? workspace.getLeftLeaf(false)
            : workspace.getLeaf(false);
      if (targetLeaf) {
        void targetLeaf.setViewState({ type: viewType, active: true });
        leaf = targetLeaf;
      }
    }

    if (leaf) await workspace.revealLeaf(leaf);
  }

  /**
   * Opens a code preview view with the provided state.
   *
   * @param state - The code snippet state to preview
   * @returns A promise that resolves when the preview is opened
   */
  async openCodePreview(state: CodeSnippetState) {
    const leaves = this.app.workspace.getLeavesOfType(CODE_PREVIEW_VIEW_TYPE);
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeaf('split');
      await leaf.setViewState({ type: CODE_PREVIEW_VIEW_TYPE, active: true });
    }
    if (
      state.code === this.codeBlock.code &&
      state.language === this.codeBlock.language &&
      leaves.length > 0
    )
      return;
    this.updateCodePreview(state);
  }

  /**
   * Updates the code preview view with new state.
   *
   * @param state - The code snippet state to update with
   */
  updateCodePreview(state: CodeSnippetState) {
    this.codeBlock = state;
    this.app.workspace.getLeavesOfType(CODE_PREVIEW_VIEW_TYPE)[0]?.setEphemeralState(state);
  }

  /**
   * Adds Pure Chat LLM items to the editor context menu.
   *
   * Populates the context menu with plugin-specific actions based on the current selection
   * and editor state. Adds options for editing selections and opening code previews when
   * the cursor is inside a code block.
   *
   * @param {Menu} menu - The menu to add items to.
   * @param {Editor} editor - The current editor instance.
   * @param {MarkdownView} view - The current markdown view.
   * @returns {Menu} The menu with added items.
   */
  addItemsToMenu(menu: Menu, editor: Editor, view: MarkdownView) {
    const selected = editor.getSelection();
    if (selected.length > 0)
      menu.addItem(item =>
        item
          .setTitle('Edit selection')
          .setIcon('wand')
          .onClick(() => this.editSelection(selected, editor))
          .setSection('selection'),
      );
    menu.addItem(item =>
      item
        .setTitle('Open code preview')
        .setIcon('code')
        .onClick(() => this.openCodePreview(this.codeBlock)),
    );

    return menu;
  }

  /**
   * Opens a prompt handler to edit the selected text.
   *
   * Creates an InstructPromptsHandler modal with available selection templates.
   * When a template is selected, it processes the selection through the LLM and
   * replaces the selected text with the generated response.
   *
   * @param {string} selected - The currently selected text in the editor.
   * @param {Editor} editor - The editor instance for replacing the selection.
   * @returns {void}
   * @private
   */
  private editSelection(selected: string, editor: Editor) {
    new InstructPromptsHandler(
      this.app,
      s =>
        s
          ? void new PureChatLLMChat(this)
              .setMarkdown(editor.getValue())
              .selectionResponse(
                s,
                selected,
                this.settings.addfiletocontext ? editor.getValue() : undefined,
              )
              .then(response => editor.replaceSelection(response.content))
          : void editWand(this, selected),
      { ...this.settings.selectionTemplates, 'Custom prompt': '' },
    ).open();
  }

  /**
   * Generates a new title for the currently active file based on its content using an LLM-powered chat template.
   * The generated title is sanitized to remove non-alphanumeric characters and is used to rename the file.
   * If no active file is found, a notice is displayed to the user.
   *
   * @param editor - The editor instance containing the file's content.
   * @param view - The Markdown view associated with the editor.
   */
  async generateTitle(editor: Editor, view: MarkdownView): Promise<void> {
    const activeFile = view.file;
    if (!activeFile) return;

    const writeHandler = new WriteHandler(this, activeFile, view, editor, true);
    await generateTitle(this, writeHandler);
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
  async completeChatResponse(editor: Editor, view: MarkdownView) {
    const activeFile = view.file;
    if (!activeFile) return;

    await completeChatResponse(this, new WriteHandler(this, activeFile, view, editor, true));
  }

  /**
   * Loads and initializes the plugin settings from persistent storage.
   *
   * Merges default settings with saved data, performing compatibility fixes
   * for older versions. Also handles migration of legacy settings formats
   * and ensures all required settings fields are populated.
   *
   * @returns {Promise<void>}
   */
  async loadSettings() {
    const loadedData: PureChatLLMSettings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as PureChatLLMSettings),
    };

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

    const toSentenceCase = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

    this.settings.chatTemplates = Object.fromEntries(
      Object.entries(this.settings.chatTemplates)
        .map(([key, value]) => [toSentenceCase(key), value])
        .filter(([key, value]) => key && value)
        .sort(([a], [b]) => a.localeCompare(b)),
    ) as { [key: string]: string };

    this.settings.selectionTemplates = Object.fromEntries(
      Object.entries(this.settings.selectionTemplates)
        .map(([key, value]) => [toSentenceCase(key), value])
        .filter(([key, value]) => key && value)
        .sort(([a], [b]) => a.localeCompare(b)),
    ) as { [key: string]: string };

    DEFAULT_SETTINGS.endpoints.forEach(
      endpoint =>
        this.settings.endpoints.find(e => e.name === endpoint.name) ||
        this.settings.endpoints.push(endpoint),
    );
  }

  /**
   *
   */
  async saveSettings() {
    this.settings.selectionTemplates = this.settings.selectionTemplates || {};
    await this.saveData(this.settings);
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
  /**
   * Creates a new instruction prompts handler modal.
   *
   * @param app - The Obsidian application instance
   * @param onSubmit - Callback function to handle selected prompt
   * @param templates - Object containing template key-value pairs
   */
  constructor(app: App, onSubmit: (result: string) => void, templates: { [key: string]: string }) {
    super(app);
    this.onSubmit = onSubmit;
    this.templates = templates;
    this.setPlaceholder('Select a prompt...');
  }

  /**
   * Gets the list of available template keys.
   *
   * @returns Array of template keys
   */
  getItems(): string[] {
    return Object.keys(this.templates);
  }

  /**
   * Gets the display text for a template item.
   *
   * @param templateKey - The template key
   * @returns The display text for the template
   */
  getItemText(templateKey: string): string {
    return templateKey;
  }

  /**
   * Called when a template is selected from the list.
   *
   * @param templateKey - The selected template key
   * @param evt - The mouse or keyboard event that triggered the selection
   */
  onChooseItem(templateKey: string, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(this.templates[templateKey]);
  }
}

/**
 * Editor suggest component for auto-completing chat-related syntax.
 *
 * Provides suggestions for model names, roles, code languages, and the send command
 * based on the current editor context.
 */
class PureChatEditorSuggest extends EditorSuggest<string> {
  type: string;
  /**
   * Creates a new editor suggest instance.
   *
   * @param app - The Obsidian application instance
   * @param plugin - The PureChatLLM plugin instance
   * @param codelanguages - An array containing code languages
   */
  constructor(
    app: App,
    public plugin: PureChatLLM,
    public codelanguages: string[],
  ) {
    super(app);
  }

  /**
   * Determines if suggestions should be triggered at the current cursor position.
   *
   * @param cursor - The current cursor position
   * @param editor - The editor instance
   * @param file - The current file (if any)
   * @returns Trigger info if suggestions should be shown, null otherwise
   */
  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile | null,
  ): EditorSuggestTriggerInfo | null {
    //const line = editor.getLine(cursor.line);
    const line = editor.getRange({ ...cursor, ch: 0 }, cursor); // Get the line text
    if (/^(model: |\s\s"model": |```[a-z]|# |send)/i.test(line))
      return {
        start: { line: cursor.line, ch: 0 },
        end: { line: cursor.line, ch: line.length },
        query: line.toLowerCase(),
      };
    else return null;
  }

  /**
   * Provides suggestions based on the current query context in the editor.
   *
   * @param context - The editor suggest context containing the query
   * @returns Array of suggestion strings or a promise resolving to suggestions
   */
  getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
    if (context.query === 'send') {
      this.type = 'send';
      return ['send'];
    }
    if (context.query.startsWith('```')) {
      this.type = 'code';
      const query = context.query.slice(3).toLowerCase().trim();
      if (query) return this.codelanguages.filter(lang => lang.startsWith(query)).slice(0, 100);
      else return ['', ...this.codelanguages.sort().slice(0, 100)];
    } else if (context.query.startsWith('# ')) {
      this.type = 'role';
      const roles = ['user', 'assistant', 'system', 'developer'];
      const query = context.query.slice(2).toLowerCase().trim();

      return roles.filter(h => h.startsWith(query) || ('role: ' + h).startsWith(query));
    } else if (context.query.startsWith('model: ') || context.query.startsWith('  "model": ')) {
      this.type = 'model';
      const query = context.query
        .replace('model: ', '')
        .replace(/\s\s"model": "?/g, '')
        .replace(/",?/g, '')
        .toLowerCase()
        .trim();
      const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint].name;
      if (endpoint) {
        const models = this.plugin.settings.ModelsOnEndpoint[endpoint] || [];
        return models.filter(m => m.toLowerCase().startsWith(query)).slice(0, 100);
      }
    }
    return [];
  }

  /**
   * Renders a suggestion item in the suggestion list.
   *
   * @param value - The suggestion value to render
   * @param el - The HTML element to render into
   */
  renderSuggestion(value: string, el: HTMLElement): void {
    switch (this.type) {
      case 'send':
        el.textContent = 'Send to LLM';
        break;
      case 'code':
        el.textContent = value;
        break;
      case 'role':
        el.textContent = `role: ${toTitleCase(value)}`;
        break;
      case 'model':
        el.textContent = value;
        break;
    }
  }

  /**
   * Called when a suggestion is selected.
   *
   * @param value - The selected suggestion value
   * @param evt - The mouse or keyboard event that triggered the selection
   */
  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const { start, end, editor } = this.context;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    let text: string;
    switch (this.type) {
      case 'send':
        editor.replaceRange('', start, end);
        if (!view) return;
        void this.plugin.completeChatResponse(editor, view);
        break;
      case 'code':
        editor.replaceRange(`\`\`\`${value}\n`, start, end);
        editor.setCursor({
          line: start.line + 1,
          ch: 0,
        });
        break;
      case 'role':
        editor.replaceRange(
          `${new PureChatLLMChat(this.plugin).adapter.parseRole(value as RoleType)}\n`,
          start,
          end,
        );
        editor.setCursor({
          line: start.line + 1,
          ch: 0,
        });
        break;
      case 'model':
        text = editor.getLine(start.line).includes('"model":')
          ? `  "model": "${value}",`
          : `model: ${value}`;

        editor.replaceRange(text, start, {
          line: start.line,
          ch: editor.getLine(start.line).length,
        });
        editor.setCursor({
          line: start.line,
          ch: text.length,
        });
        break;
    }
  }
}

declare module 'obsidian' {
  interface App {
    setting: {
      open: () => Promise<void>;
      openTabById: (id: string) => void;
      activeTab: {
        searchComponent: { setValue: (value: string) => void; onChanged: () => void };
      };
    };
  }
}

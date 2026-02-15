import {
  addIcon,
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  FuzzySuggestModal,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  setIcon,
  TFile,
  TFolder,
} from 'obsidian';

import { DEFAULT_SETTINGS, EmptyApiKey } from './assets/constants';
import { PureChatLLMChat } from './core/Chat';
import { PureChatLLMSpeech } from './core/Speech';
import { LowUsageTagRemover } from './LowUsageTagRemover';
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
  createCodeblockExtension,
  openCodePreview,
} from './ui/CodePreview';
import { AskForAPI, editWand } from './ui/Modals';
import { PureChatLLMSettingTab } from './ui/Settings';
import { ModelAndProviderChooser, PureChatLLMSideView } from './ui/SideView';
import { VoiceCallSideView } from './ui/VoiceCallSideView';
import { BrowserConsole } from './utils/BrowserConsole';
import { codelanguages } from './utils/codelanguages';
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
  /**
   * Description placeholder
   *
   * @type {PureChatLLMSettings}
   */
  settings: PureChatLLMSettings;
  /**
   * Description placeholder
   *
   * @type {boolean}
   */
  isresponding: boolean;
  /**
   * Description placeholder
   *
   * @type {BrowserConsole}
   */
  console: BrowserConsole;
  /**
   * Description placeholder
   *
   * @type {string[]}
   */
  modellist: string[] = [];
  /**
   * Description placeholder
   *
   * @type {HTMLElement}
   */
  pureChatStatusElement: HTMLElement;
  /**
   * Description placeholder
   *
   * @type {({ from: number; to: number } | null)}
   */
  codeBlock: { from: number; to: number } | null = null;

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

    this.registerEditorSuggest(new PureChatEditorSuggest(this.app, this));
    this.registerEditorExtension(createCodeblockExtension(this.app, this));
    // Add settings tab
    this.addSettingTab(new PureChatLLMSettingTab(this.app, this));
    void this.status('');
  }

  /**
   * Description placeholder
   *
   * @private
   * @type {Array<() => void>}
   */
  private onupdate: Array<() => void> = [];

  /**
   * Notifies all registered listeners that the code block has been updated.
   *
   * Iterates through all registered callbacks in the onupdate array and invokes each one.
   *
   * @returns {void}
   */
  callOnChange() {
    this.onupdate.forEach(callback => callback());
  }

  /**
   * Registers a callback to be invoked when the code block is updated.
   *
   * Adds the provided callback function to the list of listeners that will be notified
   * whenever the code block changes.
   *
   * @param {() => void} cb - The callback function to register.
   * @returns {void}
   */
  onCodeBlockUpdate(cb: () => void) {
    this.onupdate.push(cb);
  }

  /**
   * Unregisters a previously registered code block update callback.
   *
   * Removes the specified callback from the list of listeners so it will no longer
   * be invoked when the code block updates.
   *
   * @param {() => void} cb - The callback function to unregister.
   * @returns {void}
   */
  offCodeBlockUpdate(cb: () => void) {
    this.onupdate = this.onupdate.filter(c => c !== cb);
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
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
        this.addItemsToMenu(menu, editor, view);
      }),
    );

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem(item => {
            item
              .setTitle('New conversation')
              .setIcon('message-square-plus')
              .setSection('action-primary')
              .onClick(async () => {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(
                  await this.app.vault.create(
                    `${file.path}/${this.generateUniqueFileName(file, 'Untitled Conversation')}.md`,
                    new PureChatLLMChat(this).setMarkdown('Type your message...').getMarkdown(),
                  ),
                );
                void this.activateChatView();
              });
          });
        } else if (file instanceof TFile && file.extension === 'md') {
          const link = this.app.fileManager.generateMarkdownLink(file, file.path);
          menu.addItem(item => {
            item
              .setTitle('New chat from file')
              .setIcon('message-square-plus')
              .setSection('action')
              .onClick(async () => {
                const parent = file.parent || this.app.vault.getRoot();

                await this.app.workspace
                  .getLeaf(true)
                  .openFile(
                    await this.app.vault.create(
                      `${parent.path}/${this.generateUniqueFileName(parent, `Untitled ${file.basename}`)}.md`,
                      new PureChatLLMChat(this).setMarkdown(link).getMarkdown(),
                    ),
                  );
                void this.activateChatView();
              });
          });
          menu.addItem(item => {
            item
              .setTitle('New chat from file system prompt')
              .setIcon('message-square-plus')
              .setSection('action')
              .onClick(async () => {
                const parent = file.parent || this.app.vault.getRoot();

                await this.app.workspace
                  .getLeaf(true)
                  .openFile(
                    await this.app.vault.create(
                      `${parent.path}/${this.generateUniqueFileName(parent, `Untitled ${file.basename}`)}.md`,
                      new PureChatLLMChat(this)
                        .setMarkdown(`# role: System\n${link}\n# role: User\n`)
                        .getMarkdown(),
                    ),
                  );
                void this.activateChatView();
              });
          });
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
      id: 'clean-up-tags-in-vault',
      name: 'Clean up tags in vault',
      icon: 'tags',
      callback: async () => new LowUsageTagRemover(this.app).open(),
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
          new PureChatLLMChat(this).setMarkdown(editor.getValue()).thencb(chat => {
            chat.session.messages = chat.session.messages.filter(
              message => message.role === 'user' || message.role === 'assistant',
            );
          }),
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

    this.addCommand({
      id: 'start-voice-call',
      name: 'Start voice call',
      icon: 'phone-call',
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
  async openHotkeys(): Promise<void> {
    // make sure this stays up to date as the documentation does'nt include all the functions used here
    await this.app.setting.open();
    this.app.setting.openTabById('hotkeys');
    this.app.setting.activeTab.searchComponent.setValue('Pure Chat LLM');
    this.app.setting.activeTab.searchComponent.onChanged();
  }

  /**
   *
   */
  async openSettings(): Promise<void> {
    await this.app.setting.open();
    this.app.setting.openTabById('pure-chat-llm');
  }

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
   * Description placeholder
   *
   * @async
   * @returns {unknown}
   */
  activateChatView = async () => await this.activateView(PURE_CHAT_LLM_VIEW_TYPE, 'right');

  /**
   * Description placeholder
   *
   * @async
   * @returns {unknown}
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
      menu
        .addItem(item =>
          item
            .setTitle('Edit selection')
            .setIcon('wand')
            .onClick(async () => {
              this.editSelection(selected, editor);
            })
            .setSection('selection'),
        )
        .addItem(item =>
          item
            .setTitle('Wand')
            .setIcon('wand')
            .onClick(async () => editWand(this, selected))
            .setSection('selection'),
        );
    const { codeBlock } = this;
    if (codeBlock)
      menu.addItem(item =>
        item
          .setTitle('Open code preview')
          .setIcon('code')
          .onClick(() => {
            const content = editor.getValue().slice(codeBlock.from, codeBlock.to);
            openCodePreview(
              this.app,
              content.match(/```\w+([\w\W]*?)```/m)?.[1] || '',
              content.match(/```(\w+)[\w\W]*?```/m)?.[1] || 'text',
              editor,
            );
          }),
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
   *
   */
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
  generateTitle(editor: Editor, view: MarkdownView): void {
    const activeFile = view.file;
    if (activeFile)
      void new PureChatLLMChat(this)
        .setMarkdown(editor.getValue())
        .processChatWithTemplate(this.settings.chatTemplates['Conversation titler'])
        .then(title => {
          const sanitizedTitle = `${activeFile.parent?.path}/${title.content
            .replace(/^<think>[\s\S]+?<\/think>/gm, '') // Remove <think> tags for ollama
            .replace(/[^a-zA-Z0-9 !.,+\-_=]/g, '')
            .trim()}.${activeFile.extension}`;
          void this.app.fileManager.renameFile(activeFile, sanitizedTitle);
          new Notice(`File renamed to: ${sanitizedTitle}`);
        });
    else new Notice('No active file to rename.');
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

    const endpoint = this.settings.endpoints[this.settings.endpoint];
    if (endpoint.apiKey == EmptyApiKey) {
      new AskForAPI(this.app, this).open();
      return;
    }
    const writeHandler = new WriteHandler(this, activeFile, view, editor, true);

    const editorcontent = await writeHandler.getValue();

    const chat = new PureChatLLMChat(this).setMarkdown(editorcontent);
    if (
      chat.session.messages[chat.session.messages.length - 1].content === '' &&
      chat.session.validChat &&
      this.settings.AutoReverseRoles
    ) {
      if (chat.session.messages.pop()?.role == 'user') chat.reverseRoles();
    }
    await writeHandler.write(chat.getMarkdown());

    if (!chat.session.validChat) return;

    this.isresponding = true;

    await writeHandler.appendContent(`\n${chat.adapter.parseRole('assistant...' as RoleType)}\n`);
    chat
      .completeChatResponse(activeFile, async e => {
        await writeHandler.appendContent(e.content);
        return true;
      })
      .then(async chat => {
        this.isresponding = false;
        if (
          this.settings.AutogenerateTitle > 0 &&
          chat.session.messages.length >= this.settings.AutogenerateTitle &&
          (activeFile?.name.includes('Untitled') || / \d+\.md$/.test(activeFile?.name)) &&
          view
        ) {
          this.generateTitle(editor, view);
        }
        await writeHandler.write(chat.getMarkdown());
      })
      .catch(error => this.console.error(error))
      .finally(() => {
        this.isresponding = false;
        return;
      });
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

    this.settings = { ...loadedData };
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
      Object.entries(this.settings.chatTemplates).map(([key, value]) => [
        toSentenceCase(key),
        value,
      ]),
    );

    this.settings.selectionTemplates = Object.fromEntries(
      Object.entries(this.settings.selectionTemplates).map(([key, value]) => [
        toSentenceCase(key),
        value,
      ]),
    );

    // Compatibility fixes for older versions

    this.settings.endpoints.forEach(
      endpoint =>
        (endpoint.endpoint = endpoint.endpoint.replace(
          '/chat/completions',
          '',
        )) /* Old endpoints had /chat/completions appended*/,
    );

    DEFAULT_SETTINGS.endpoints.forEach(endpoint => {
      if (!this.settings.endpoints.find(e => e.name === endpoint.name))
        this.settings.endpoints.push(endpoint);
    });

    if ((loadedData as unknown as { chatParser?: number }).chatParser === 1) {
      this.settings.messageRoleFormatter = '\\n> [!note] {role}\\n> # role: {role}\\n';
      // @ts-ignore
      delete this.settings.chatParser;
    }
    const oldSystemPrompt =
      "You are ChatGPT, a large language model trained by OpenAI. Carefully heed the user's instructions. Respond using Markdown.\n\nBe attentive, thoughtful, and precise—provide clear, well-structured answers that honor the complexity of each query. Avoid generic responses; instead, offer insights that encourage creativity, reflection, and learning. Employ subtle, dry humor or depth when appropriate. Respect the user’s individuality and values, adapting your tone and approach as needed to foster a conversational, meaningful, and genuinely supportive exchange.";
    if (this.settings.SystemPrompt === oldSystemPrompt)
      this.settings.SystemPrompt = DEFAULT_SETTINGS.SystemPrompt;

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

    this.settings.selectionTemplates = Object.fromEntries(
      Object.keys(this.settings.selectionTemplates)
        .sort()
        .map(key => [key, this.settings.selectionTemplates[key]])
        .filter(([key, value]) => key && value),
    ) as { [key: string]: string };
    this.settings.chatTemplates = Object.fromEntries(
      Object.keys(this.settings.chatTemplates)
        .sort()
        .map(key => [key, this.settings.chatTemplates[key]])
        .filter(([key, value]) => key && value),
    ) as { [key: string]: string };
    await this.saveData(this.settings);
  }

  /**
   *
   */
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
  /**
   * Description placeholder
   *
   * @type {(result: string) => void}
   */
  onSubmit: (result: string) => void;
  /**
   * Description placeholder
   *
   * @type {{ [key: string]: string }}
   */
  templates: { [key: string]: string };
  /**
   *
   * @param app
   * @param onSubmit
   */
  constructor(app: App, onSubmit: (result: string) => void, templates: { [key: string]: string }) {
    super(app);
    this.onSubmit = onSubmit;
    this.templates = templates;
    this.setPlaceholder('Select a prompt...');
  }

  /**
   * Description placeholder
   *
   * @returns {string[]}
   */
  getItems(): string[] {
    return Object.keys(this.templates);
  }

  /**
   * Description placeholder
   *
   * @param {string} templateKey
   * @returns {string}
   */
  getItemText(templateKey: string): string {
    return templateKey;
  }

  /**
   *
   * @param templateKey
   * @param evt
   */
  onChooseItem(templateKey: string, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(this.templates[templateKey]);
  }
}

/**
 *
 */
class PureChatEditorSuggest extends EditorSuggest<string> {
  /**
   * Description placeholder
   *
   * @type {string}
   */
  type: string;
  /**
   * Description placeholder
   *
   * @type {PureChatLLM}
   */
  plugin: PureChatLLM;
  /**
   *
   * @param app
   * @param plugin
   */
  constructor(app: App, plugin: PureChatLLM) {
    super(app);
    this.plugin = plugin;
  }

  /**
   *
   * @param cursor
   * @param editor
   * @param file
   * @returns {EditorSuggestTriggerInfo | null}
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
   *
   * @param context
   * @returns {string[] | Promise<string[]>}
   * @description
   * Provides suggestions based on the current query context in the editor.
   */
  getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
    if (context.query === 'send') {
      this.type = 'send';
      return ['send'];
    }
    if (context.query.startsWith('```')) {
      this.type = 'code';
      const query = context.query.slice(3).toLowerCase().trim();
      if (query) return codelanguages.filter(lang => lang.startsWith(query)).slice(0, 100);
      else return ['', ...codelanguages.sort().slice(0, 100)];
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
   *
   * @param value
   * @param el
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
   *
   * @param value
   * @param evt
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

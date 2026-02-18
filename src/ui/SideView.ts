import {
  App,
  Editor,
  EditorRange,
  ExtraButtonComponent,
  FuzzySuggestModal,
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Platform,
  Setting,
  WorkspaceLeaf,
} from 'obsidian';
import { alloptions, EmptyApiKey } from 'src/assets/constants';
import { PureChatLLMChat } from '../core/Chat';
import PureChatLLM from '../main';
import { ChatMessage, PURE_CHAT_LLM_ICON_NAME, PURE_CHAT_LLM_VIEW_TYPE } from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';
import { AskForAPI } from './Modals';

/**
 * Represents the side view for the Pure Chat LLM plugin in Obsidian.
 *
 * This view displays chat messages parsed from the current Markdown editor,
 * provides interactive controls for navigating, copying, and deleting messages,
 * and integrates with the plugin's chat completion features.
 *
 * The view listens to workspace events such as editor changes, file openings,
 * and active leaf changes to update its content in real-time.
 *
 * @extends ItemView
 *
 * @remarks
 * - The view is updated whenever the user types, opens a file, or changes the active leaf.
 * - Provides UI elements for message preview, navigation, copying, and code handling.
 * - Integrates with the plugin's debugging and chat completion logic.
 *
 * @see PureChatLLM
 * @see PureChatLLMChat
 * @see MarkdownView
 * @see Editor
 */
export class PureChatLLMSideView extends ItemView {
  ischat = false;
  isExpanded = false;
  icon: string = PURE_CHAT_LLM_ICON_NAME;
  console: BrowserConsole = new BrowserConsole(this.plugin.settings.debug, 'PureChatLLMSideView');
  navigation: boolean = false;

  /**
   * Creates a new side view instance.
   *
   * @param leaf - The workspace leaf to render in
   * @param plugin - The PureChatLLM plugin instance
   * @param viewText - The display text for the view
   */
  constructor(
    leaf: WorkspaceLeaf,
    public plugin: PureChatLLM,
    public viewText = 'Conversation overview',
  ) {
    super(leaf);
  }

  /**
   * Gets the view type identifier.
   *
   * @returns The view type string
   */
  getViewType() {
    return PURE_CHAT_LLM_VIEW_TYPE;
  }

  /**
   * Gets the display text for the view.
   *
   * @returns The view display text
   */
  getDisplayText() {
    return this.viewText;
  }

  /**
   * Called when the view is opened. Registers event listeners for editor changes and file operations.
   *
   * @returns A promise that resolves when initialization is complete
   */
  async onOpen() {
    // when a file is loaded or changed, update the view

    this.registerEvent(
      this.app.workspace.on('editor-change', (editor: Editor, view: MarkdownView) => {
        // if the user is typing in the editor, update the view
        if (!this.plugin.isresponding) this.update(editor, view);
      }),
    );
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        this.defaultContent();
        /* this.console.log('Active leaf changed, updating side view'); */
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        if (!view) return;
        if (!editor) return;
        this.update(editor, view);
      }),
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', leaf => {
        if (!leaf) return;
        const v = leaf.view;
        if (!(v instanceof MarkdownView)) return;

        const e = v.editor;
        this.update(e, v);
        const c = e.getCursor();
        if (c.ch === 0 && c.line === 0 && this.ischat) {
          e.setCursor({
            line: e.lastLine(),
            ch: e.getLine(e.lastLine()).length,
          });
          e.scrollIntoView(
            {
              from: { line: e.lastLine(), ch: 0 },
              to: { line: e.lastLine(), ch: e.getLine(e.lastLine()).length },
            },
            true,
          );
        }
      }),
    );
    // check it the editor is open
    this.defaultContent();
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const editor = view.editor;
      if (editor) {
        this.update(editor, view);
      }
    }
  }

  /**
   * Renders default content when no valid conversation is detected.
   */
  defaultContent() {
    this.contentEl.empty();

    new Setting(this.contentEl)
      .setName('Pure Chat LLM')
      .setClass('headerfloattop')
      .setHeading()
      .addButton(btn => btn.setButtonText('Hot keys').onClick(() => this.plugin.openHotkeys()))
      .then(b => {
        const editor = this.app.workspace.activeEditor?.editor;
        if (editor)
          b.addExtraButton(btn =>
            btn
              .setIcon('cpu')
              .onClick(() => new ModelAndProviderChooser(this.app, this.plugin, editor))
              .setTooltip('Choose model and provider'),
          );
      })
      .addExtraButton(btn => btn.setIcon('settings').onClick(() => this.plugin.openSettings()))
      .addExtraButton(btn =>
        btn
          .setIcon('phone')
          .setTooltip('Open voice call view')
          .onClick(() => this.plugin.activateVoiceCallView()),
      );
    new Setting(this.contentEl).setName(
      'The current editor does not contain a valid conversation.',
    );
    new Setting(this.contentEl).setName('Available commands').setHeading();
    new Setting(this.contentEl)
      .setName('Complete chat response')
      .setDesc('This will start a new chat with the current editor content.');
    new Setting(this.contentEl)
      .setName('Generate title')
      .setDesc('This will generate a title for the current editor content.');
    new Setting(this.contentEl)
      .setName('Edit selection')
      .setDesc('This will edit the selected text in the current editor.');
    new Setting(this.contentEl)
      .setName('Analyze conversation')
      .setDesc('This will analyze the current conversation.');
    new Setting(this.contentEl)
      .setName('Reverse roles')
      .setDesc('This will reverse the roles of the current conversation.');
    new Setting(this.contentEl)
      .setName('Speak chat')
      .setDesc('This will speak the current chat using two voices.');
  }

  /**
   * Updates the view content based on the current editor and chat state.
   *
   * @param editor - The active editor instance
   * @param view - The active markdown view
   */
  update(editor: Editor, view: MarkdownView) {
    //MetadataCache
    //resolveSubpath
    const editorValue = editor.getValue();
    const chat = new PureChatLLMChat(this.plugin);
    chat.setMarkdown(editorValue);
    const allshown: boolean = Object.keys(alloptions).every(k =>
      Object.prototype.hasOwnProperty.call(chat.session.options, k),
    );
    this.ischat = chat.session.validChat;
    const container = this.contentEl;
    container.empty();
    if (!chat.session.validChat || !editorValue) {
      this.defaultContent();
      return;
    }

    new Setting(container)
      .setDesc(`${chat.endpoint.name} (${chat.session.options.model})`)
      .setHeading()
      .setClass('headerfloattop')
      .addExtraButton(btn =>
        btn
          .setIcon('cpu')
          .setTooltip(`${chat.endpoint.name} (${chat.session.options.model})`)
          .onClick(() => new ModelAndProviderChooser(this.app, this.plugin, editor)),
      )
      .addExtraButton(btn =>
        btn
          .setIcon(this.isExpanded ? 'chevron-up' : 'chevron-down')
          .setTooltip(this.isExpanded ? 'Collapse view' : 'Expand view')
          .onClick(() => {
            this.isExpanded = !this.isExpanded;
            this.update(editor, view);
          }),
      )
      .addExtraButton(btn =>
        btn
          .setIcon(allshown ? 'chevrons-down-up' : 'chevrons-up-down')
          //.setButtonText(allshown ? "Hide" : "Show all")
          .setTooltip('Show all options')
          .onClick(() =>
            //new PureChatLLMChat(this.plugin).setMarkdown(editor.getValue()).thencb(chat => )
            editor.setValue(
              new PureChatLLMChat(this.plugin)
                .setMarkdown(editor.getValue())
                .thencb(chat =>
                  allshown
                    ? (chat.session.options = {
                        model: chat.session.options.model,
                        max_completion_tokens: chat.session.options.max_completion_tokens,
                        stream: chat.session.options.stream,
                      } as typeof chat.session.options)
                    : Object.assign(
                        chat.session.options,
                        { ...alloptions },
                        { ...chat.session.options },
                      ),
                )
                .getMarkdown(),
            ),
          ),
      )
      .then(
        b =>
          chat.session.messages.some(m => m.role === 'tool') &&
          b.addExtraButton(btn =>
            btn
              .setIcon('remove-formatting')
              .setTooltip('Remove tool messages')
              .onClick(() =>
                editor.setValue(
                  chat
                    .thencb(
                      c => (c.session.messages = c.session.messages.filter(m => m.role !== 'tool')),
                    )
                    .getMarkdown(),
                ),
              ),
          ),
      )
      .addExtraButton(btn =>
        btn
          .setIcon('phone')
          .setTooltip('Open voice call view')
          .onClick(() => this.plugin.activateVoiceCallView()),
      );
    if (this.isExpanded) {
      new Setting(container).setName('Tools used in this chat').then(s => {
        (['Vault', 'UI', 'System', 'AI'] as const).forEach(classification => {
          s.addButton(btn => {
            const en = chat.isEnabled(classification);
            if (en) btn.setCta();
            return btn
              .setButtonText(classification)
              .setTooltip(`${en ? 'Disable' : 'Enable'} ${classification} tools`)
              .onClick(() => {
                if (en) {
                  chat.session.options.tools = chat.session.options.tools?.filter(
                    t => chat.toolregistry.classificationForTool(t) !== classification,
                  );
                } else {
                  chat.session.options.tools = Array.from(
                    new Set([
                      ...(chat.session.options.tools || []),
                      ...chat.toolregistry.getToolNamesByClassification(classification),
                    ]),
                  );
                }
                editor.setValue(chat.getMarkdown());
              });
          });
        });
      });
    }

    container.addClass('LLMSideView');
    // Process markdown messages
    this.renderChatMessages(chat, container, editor, view);

    // scroll to bottom of container
    // if the editor is focused
    if (editor.hasFocus()) {
      container.scrollTo(0, container.scrollHeight);
    } else if (this.isExpanded) {
      container.scrollTo(0, 0);
    }
  }

  /**
   * Renders all chat messages in the conversation view.
   *
   * @param chat - The chat session to render
   * @param container - The container element to render into
   * @param editor - The active editor instance
   * @param view - The active markdown view
   */
  private renderChatMessages(
    chat: PureChatLLMChat,
    container: HTMLElement,
    editor: Editor,
    view: MarkdownView,
  ) {
    chat.session.messages.forEach((message, index) => {
      const preview = message.content.substring(0, 400);

      // Role header with clickable position jump
      container.createDiv({ text: '', cls: ['messageContainer', message.role] }, contain => {
        this.renderMessageContainer(contain, message, editor, chat, index, preview, view);
      });
    });
  }

  /**
   * Renders a single message container with interactive controls.
   *
   * @param contain - The container div element
   * @param message - The chat message to render
   * @param editor - The active editor instance
   * @param chat - The chat session
   * @param index - The message index in the conversation
   * @param preview - The preview text for the message
   * @param view - The active markdown view
   */
  private renderMessageContainer(
    contain: HTMLDivElement,
    message: ChatMessage,
    editor: Editor,
    chat: PureChatLLMChat,
    index: number,
    preview: string,
    view: MarkdownView,
  ) {
    // Preview of message content with copy button
    contain.createEl('div', { text: '', cls: 'preview' }, div => {
      const extr = (icon: string, tip: string, onClick: () => void) =>
        new ExtraButtonComponent(div).setIcon(icon).setTooltip(tip).onClick(onClick);
      if (preview) {
        div.createDiv({ text: '', cls: 'message' }, el => {
          el.onClickEvent(() => this.goToPostion(editor, chat.session.clines[index], true));
          void MarkdownRenderer.render(this.app, preview, el, view.file?.basename || '', this);
        });
        extr('copy', 'Copy message to clipboard', () => {
          void navigator.clipboard.writeText(message.content);
          new Notice('Copied message to clipboard');
        });
        extr(
          'save',
          'Save message to a new note',
          () =>
            void this.app.fileManager
              .getAvailablePathForAttachment(
                `Message ${(
                  message.content.match(/^#+? (.+)$/m)?.[0] ||
                  view.file?.basename ||
                  'Untitled'
                )
                  .replace(/^#+ /, '')
                  .replace(/[^a-zA-Z0-9 !.,+\-_=]/g, '')
                  .trim()}.md`,
                view.file?.path,
              )
              .then(path =>
                this.app.vault
                  .create(path, message.content)
                  .then(() => this.app.workspace.openLinkText(path, '', true)),
              ),
        );
      }
      extr('message-square-x', 'Delete message', () =>
        editor.setValue(chat.thencb(c => c.session.messages.splice(index, 1)).getMarkdown()),
      );
      extr('refresh-cw', 'Regenerate response from this message onward', () => {
        editor.setValue(chat.thencb(c => c.session.messages.splice(index + 1)).getMarkdown());
        void this.plugin.completeChatResponse(editor, view);
      });
    });
  }

  /**
   * Navigates to and optionally selects a position in the editor.
   *
   * @param editor - The editor instance to navigate in
   * @param position - The position range to navigate to
   * @param select - Whether to select the range (default: false)
   */
  private goToPostion(editor: Editor, position: EditorRange, select = false) {
    if (select) {
      editor.setSelections([{ anchor: position.from, head: position.to }]);
      editor.scrollIntoView(position);
      // if it's mobile, wait 100ms to focus the editor again
      // this will make the selection work on mobile
      editor.focus();
      if (Platform.isMobile) window.setTimeout(() => editor.focus(), 100);
    } else {
      editor.setCursor(position.from);
      editor.scrollTo(0, editor.posToOffset(position.from));
      editor.focus();
    }
  }

  /**
   * Called when the view is closed.
   *
   * @returns A promise that resolves when cleanup is complete
   */
  async onClose() {
    // Nothing to clean up.
  }
}

type ModelAndProvider = { name: string; ismodel: boolean };

/**
 * Modal for choosing LLM model and provider configurations.
 */
export class ModelAndProviderChooser extends FuzzySuggestModal<ModelAndProvider> {
  items: ModelAndProvider[];
  modellist: ModelAndProvider[] = [];
  currentmodel = '';
  firstrun = true;

  /**
   * Creates a new model and provider chooser modal.
   *
   * @param app - The Obsidian application instance
   * @param plugin - The PureChatLLM plugin instance
   * @param editor - The active editor instance
   */
  constructor(
    app: App,
    private plugin: PureChatLLM,
    private editor: Editor,
  ) {
    super(app);
    const name = new PureChatLLMChat(this.plugin).setMarkdown(this.editor.getValue()).endpoint.name;
    const endpointIndex = this.plugin.settings.endpoints.findIndex(e => e.name === name);
    this.items = this.plugin.settings.endpoints.map(e => ({
      name: e.name,
      ismodel: false,
    }));
    this.updatemodelist(endpointIndex === -1 ? 0 : endpointIndex);
    this.firstrun = false;
  }

  /**
   * Gets the list of available items (providers and models).
   *
   * @returns Array of model and provider options
   */
  getItems(): ModelAndProvider[] {
    return [...this.items, ...this.modellist];
  }

  /**
   * Gets the display text for a list item.
   *
   * @param item - The item to get text for
   * @returns The display text for the item
   */
  getItemText(item: ModelAndProvider): string {
    return item.name + (item.ismodel ? '' : '       (provider)');
  }

  /**
   * Called when an item is selected from the list.
   *
   * @param item - The selected item
   * @param evt - The mouse or keyboard event that triggered the selection
   */
  onChooseItem(item: ModelAndProvider, evt: MouseEvent | KeyboardEvent): void {
    // see if it's a provider or a model
    const endpointnum = this.plugin.settings.endpoints.findIndex(e => e.name === item.name);
    if (endpointnum !== -1) {
      this.editor.setValue(
        new PureChatLLMChat(this.plugin)
          .setMarkdown(this.editor.getValue())
          .setModel(this.plugin.settings.endpoints[endpointnum].defaultmodel)
          .getMarkdown(),
      );
      this.updatemodelist(endpointnum);
    } else
      this.editor.setValue(
        new PureChatLLMChat(this.plugin)
          .setMarkdown(this.editor.getValue())
          .setModel(item.name)
          .getMarkdown(),
      );
  }

  /**
   * Updates the model list for a specific endpoint.
   *
   * @param endpointIndex - The index of the endpoint to load models for
   * @returns void
   */
  updatemodelist(endpointIndex: number): void {
    this.currentmodel = this.plugin.settings.endpoints[endpointIndex].name;
    this.plugin.settings.endpoint = endpointIndex;
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (endpoint.apiKey === EmptyApiKey) {
      if (this.firstrun) return this.updatemodelist(0);
      new AskForAPI(this.plugin).open();
      return;
    }
    void new PureChatLLMChat(this.plugin).getAllModels().then(models => {
      this.plugin.settings.ModelsOnEndpoint[endpoint.name] = models;
      void this.plugin.saveSettings();
      this.modellist = models.map(m => ({ name: m, ismodel: true }));
      this.open();
    });
  }
}

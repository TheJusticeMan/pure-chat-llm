import {
  App,
  ButtonComponent,
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
import { BrowserConsole } from '../utils/BrowserConsole';
import { PureChatLLMChat } from '../core/Chat';
import { CodeHandling, SectionHandling } from './CodeHandling';
import { CODE_PREVIEW_VIEW_TYPE } from './CodePreview';
import PureChatLLM from '../main';
import { AskForAPI } from './Modals';
import { toTitleCase } from '../utils/toTitleCase';
import { PURE_CHAT_LLM_VIEW_TYPE } from '../types';
import { alloptions, EmptyApiKey } from 'src/assets/constants';

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
  console: BrowserConsole;
  ischat = false;
  isExpanded = false;

  constructor(
    leaf: WorkspaceLeaf,
    public plugin: PureChatLLM,
    public viewText = 'Conversation overview',
  ) {
    super(leaf);
    this.icon = 'messages-square';
    this.console = new BrowserConsole(plugin.settings.debug, 'PureChatLLMSideView');
    this.navigation = false;
  }

  getViewType() {
    return PURE_CHAT_LLM_VIEW_TYPE;
  }

  getDisplayText() {
    return this.viewText;
  }

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

  defaultContent() {
    //MarkdownRenderer.render(this.app, splash, this.contentEl, view.file?.basename || "", this);
    this.contentEl.empty();

    new Setting(this.contentEl)
      .setName('Pure Chat LLM')
      .setHeading()
      .then(b => {
        const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
        if (editor)
          b.addExtraButton(btn =>
            btn
              .setIcon('cpu')
              .onClick(() => new ModelAndProviderChooser(this.app, this.plugin, editor))
              .setTooltip('Choose model and provider'),
          );
      })
      .addExtraButton(btn => btn.setIcon('settings').onClick(() => this.plugin.openSettings()))
      .addButton(btn => btn.setButtonText('Hot keys').onClick(() => this.plugin.openHotkeys()));
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

  update(editor: Editor, view: MarkdownView) {
    //MetadataCache
    //resolveSubpath
    const editorValue = editor.getValue();
    const chat = new PureChatLLMChat(this.plugin);
    chat.markdown = editorValue;
    const allshown: boolean = Object.keys(alloptions).every(k =>
      Object.prototype.hasOwnProperty.call(chat.options, k),
    );
    this.ischat = chat.validChat;
    const container = this.contentEl;
    container.empty();
    if (!chat.validChat || !editorValue) {
      this.defaultContent();
      return;
    }
    if (this.isExpanded) {
      new Setting(container).setName('Tools used in this chat');
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
                  chat.options.tools = chat.options.tools?.filter(
                    t => chat.toolregistry.classificationForTool(t) !== classification,
                  );
                } else {
                  chat.options.tools = Array.from(
                    new Set([
                      ...(chat.options.tools || []),
                      ...chat.toolregistry.getToolNamesByClassification(classification),
                    ]),
                  );
                }
                editor.setValue(chat.markdown);
              });
          });
        });
      });
      /* (['Vault', 'UI', 'System', 'AI'] as const).forEach(classification => {
        chat.toolregistry.getToolNamesByClassification(classification).forEach(toolname => {
          new Setting(container).setName(toolname).then(s => {
            const en = chat.options.tools?.includes(toolname);
            s.addExtraButton(btn =>
              btn
                .setIcon(!en ? 'check' : 'cross')
                .setTooltip('Enabled')
                .onClick(() => {
                  if (en) chat.options.tools = chat.options.tools?.filter(t => t !== toolname);
                  else
                    chat.options.tools = Array.from(
                      new Set([...(chat.options.tools || []), toolname]),
                    );

                  editor.setValue(chat.Markdown);
                }),
            );
          });
        });
      }); */
    }

    container.createDiv({ text: '' }, contain => {
      contain.addClass('PURE', 'floattop');

      new ButtonComponent(contain)
        .setButtonText(`${chat.endpoint.name} (${chat.options.model})`)
        .onClick(() => new ModelAndProviderChooser(this.app, this.plugin, editor));

      new ButtonComponent(contain)
        .setIcon(this.isExpanded ? 'chevron-up' : 'chevron-down')
        .setTooltip(this.isExpanded ? 'Collapse view' : 'Expand view')
        .onClick(() => {
          this.isExpanded = !this.isExpanded;
          this.update(editor, view);
        });

      new ButtonComponent(contain)
        .setIcon(allshown ? 'chevrons-down-up' : 'chevrons-up-down')
        //.setButtonText(allshown ? "Hide" : "Show all")
        .setTooltip('Show all options')
        .onClick(() =>
          //new PureChatLLMChat(this.plugin).setMarkdown(editor.getValue()).thencb(chat => )
          editor.setValue(
            new PureChatLLMChat(this.plugin).setMarkdown(editor.getValue()).thencb(chat =>
              allshown
                ? (chat.options = {
                    model: chat.options.model,
                    max_completion_tokens: chat.options.max_completion_tokens,
                    stream: chat.options.stream,
                  } as typeof chat.options)
                : Object.assign(chat.options, { ...alloptions }, { ...chat.options }),
            ).markdown,
          ),
        );
    });

    container.addClass('PURESideView');
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

  private renderChatMessages(
    chat: PureChatLLMChat,
    container: HTMLElement,
    editor: Editor,
    view: MarkdownView,
  ) {
    chat.messages.forEach((message, index) => {
      const preview = message.content.substring(0, 400);

      // Role header with clickable position jump
      container.createDiv({ text: '' }, contain => {
        contain.addClass('PURE', 'messageContainer', message.role);
        contain.createEl('h1', { text: toTitleCase(message.role) }, el => {
          el.onClickEvent(() => this.goToPostion(editor, chat.clines[index]));
          el.addClass('PURE', 'messageHeader', message.role);
        });
        // Preview of message content with copy button
        contain.createEl('div', '', div => {
          div.addClass('PURE', 'preview', message.role);
          if (preview)
            div.createDiv({ text: '' }, el => {
              el.onClickEvent(() => this.goToPostion(editor, chat.clines[index], true));
              el.addClass('PURE', 'messageMarkdown', message.role);
              void MarkdownRenderer.render(this.app, preview, el, view.file?.basename || '', this);
            });
          if (preview)
            new ExtraButtonComponent(div)
              .setIcon('copy')
              .setTooltip('Copy message to clipboard')
              .onClick(() => {
                void navigator.clipboard.writeText(message.content);
                new Notice('Copied message to clipboard');
              });
          if (preview)
            new ExtraButtonComponent(div)
              .setIcon('save')
              .setTooltip('Save message to a new note')
              .onClick(() => {
                const title = (
                  message.content.match(/^#+? (.+)$/m)?.[0] ||
                  view.file?.basename ||
                  'Untitled'
                )
                  .replace(/^#+ /, '')
                  .replace(/[^a-zA-Z0-9 !.,+\-_=]/g, '')
                  .trim();
                void this.app.fileManager
                  .getAvailablePathForAttachment(`Message ${title}.md`, view.file?.path)
                  .then(path =>
                    this.app.vault
                      .create(path, message.content)
                      .then(() => this.app.workspace.openLinkText(path, '', true)),
                  );
              });
          new ExtraButtonComponent(div)
            .setIcon('message-square-x')
            .setTooltip('Delete message')
            .onClick(() => {
              editor.setValue(chat.thencb(c => c.messages.splice(index, 1)).markdown);
            });
          if (/> \[!assistant\]/gim.test(message.content))
            new ExtraButtonComponent(div)
              .setIcon('brain-cog')
              .setTooltip('Remove the thinking process from this message')
              .onClick(() => {
                editor.setValue(
                  chat.thencb(
                    c =>
                      (c.messages[index].content = c.messages[index].content.replace(
                        /[\W\w]+?> \[!assistant\]\n*/i,
                        '',
                      )),
                  ).markdown,
                );
              });
          if (/# \w+/gm.test(message.content))
            new ExtraButtonComponent(div)
              .setIcon('table-of-contents')
              .setTooltip('View and edit sections')
              .onClick(() => {
                new SectionHandling(this.app, this.plugin, message.content).open();
              });
          if (/```[\w\W]*?```/gm.test(message.content))
            new ExtraButtonComponent(div)
              .setIcon('code')
              .setTooltip('View and edit code')
              .onClick(() => {
                new CodeHandling(this.app, this.plugin, message.content).open();
              });
          if (/```[\w\W]*?```/gm.test(message.content))
            new ExtraButtonComponent(div)
              .setIcon('scan-eye')
              .setTooltip('Preview code')
              .onClick(() => {
                this.openCodePreview(
                  message.content.match(/```\w+([\w\W]*?)```/m)?.[1] || '',
                  message.content.match(/```(\w+)[\w\W]*?```/m)?.[1] || 'text',
                  editor,
                );
              });

          if (
            Number(/```html\n([\s\S]*?)```/i.test(message.content)) +
              Number(/```css\n([\s\S]*?)```/i.test(message.content)) +
              Number(/```(?:js|javascript)\n([\s\S]*?)```/i.test(message.content)) >
            1
          )
            new ExtraButtonComponent(div)
              .setTooltip('Copy unified HTML code block')
              .setIcon('file-code-2')
              .onClick(() => {
                copyUnifiedHTMLCodeblock(message.content);
                new Notice('Unified HTML code block copied to clipboard');
              });
          new ExtraButtonComponent(div)
            .setIcon('refresh-cw')
            .setTooltip('Regenerate response')
            .onClick(() => {
              editor.setValue(chat.thencb(c => c.messages.splice(index + 1)).markdown);
              this.plugin.completeChatResponse(editor, view);
            });
        });
      });
    });
  }

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

  openCodePreview(code: string, language: string, editor: Editor) {
    this.console.log('Opening code preview', { code, language });
    void this.app.workspace.getLeaf('tab').setViewState({
      type: CODE_PREVIEW_VIEW_TYPE,
      active: true,
      state: { code, language, editor },
    });
  }

  async onClose() {
    // Nothing to clean up.
  }
}

type ModelAndProvider = { name: string; ismodel: boolean };

export class ModelAndProviderChooser extends FuzzySuggestModal<ModelAndProvider> {
  items: ModelAndProvider[];
  modellist: ModelAndProvider[] = [];
  currentmodel = '';
  firstrun = true;

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

  getItems(): ModelAndProvider[] {
    return [...this.items, ...this.modellist];
  }

  getItemText(item: ModelAndProvider): string {
    return item.name + (item.ismodel ? '' : '       (provider)');
  }

  onChooseItem(item: ModelAndProvider, evt: MouseEvent | KeyboardEvent): void {
    // see if it's a provider or a model
    const endpointnum = this.plugin.settings.endpoints.findIndex(e => e.name === item.name);
    if (endpointnum !== -1) {
      this.editor.setValue(
        new PureChatLLMChat(this.plugin)
          .setMarkdown(this.editor.getValue())
          .setModel(this.plugin.settings.endpoints[endpointnum].defaultmodel).markdown,
      );
      this.updatemodelist(endpointnum);
    } else
      this.editor.setValue(
        new PureChatLLMChat(this.plugin).setMarkdown(this.editor.getValue()).setModel(item.name)
          .markdown,
      );
  }

  updatemodelist(endpointIndex: number): void {
    this.currentmodel = this.plugin.settings.endpoints[endpointIndex].name;
    this.plugin.settings.endpoint = endpointIndex;
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (endpoint.apiKey === EmptyApiKey) {
      if (this.firstrun) return this.updatemodelist(0);
      new AskForAPI(this.app, this.plugin).open();
      return;
    }
    this.plugin.modellist = [];
    void new PureChatLLMChat(this.plugin).getAllModels().then(models => {
      this.plugin.modellist = models;
      this.plugin.settings.ModelsOnEndpoint[endpoint.name] = models;
      void this.plugin.saveSettings();
      this.modellist = models.map(m => ({ name: m, ismodel: true }));
      this.open();
    });
  }
}

/**
 * Extracts HTML, CSS, and JavaScript code blocks from a given text range, combines them into a single HTML file, and copies to clipboard.
 * @param text The text to extract code blocks from (e.g., editor selection)
 */
export function copyUnifiedHTMLCodeblock(text: string) {
  // Regex to match code blocks: ```html ... ```, ```css ... ```, ```js ... ``` or ```javascript ... ```
  const htmlMatch = /```html\n([\s\S]*?)```/i.exec(text);
  const cssMatch = /```css\n([\s\S]*?)```/i.exec(text);
  const jsMatch = /```(?:js|javascript)\n([\s\S]*?)```/i.exec(text);

  const html = htmlMatch ? htmlMatch[1].trim() : '';
  const css = cssMatch ? cssMatch[1].trim() : '';
  const js = jsMatch ? jsMatch[1].trim() : '';

  // Compose unified HTML
  let unified = '```html\n<!DOCTYPE html>\n<html>\n<head>\n';
  if (css) unified += `<style>\n${css}\n</style>\n`;
  unified += '</head>\n<body>\n';
  unified += html ? html + '\n' : '';
  if (js) unified += `<script>\n${js}\n</script>\n`;
  unified += '</body>\n</html>\n```';

  // Copy to clipboard

  void navigator.clipboard.writeText(unified);
}

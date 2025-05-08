import {
  ItemView,
  WorkspaceLeaf,
  Editor,
  MarkdownView,
  setIcon,
  MarkdownRenderer,
  EditorRange,
  Notice,
  ButtonComponent,
  Platform,
  Menu,
  DropdownComponent,
} from "obsidian";
import { PureChatLLMChat } from "./Chat";
import PureChatLLM, { AskForAPI, CodeHandling, SectionHandling } from "./main";
import { toSentanceCase } from "./toSentanceCase";
import { EmptyApiKey, PURE_CHAT_LLM_VIEW_TYPE } from "./types";
import { BrowserConsole } from "./MyBrowserConsole";

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
  plugin: PureChatLLM;
  console: BrowserConsole;
  viewText: string;

  constructor(leaf: WorkspaceLeaf, plugin: PureChatLLM) {
    super(leaf);
    this.icon = "text";
    this.plugin = plugin;
    this.console = new BrowserConsole(plugin.settings.debug, "PureChatLLMSideView");
    this.viewText = "Conversation Overview";
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
      this.app.workspace.on("editor-change", (editor: Editor, view: MarkdownView) => {
        // if the user is typing in the editor, update the view
        if (!this.plugin.isresponding) this.update(editor, view);
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        if (!editor) return;
        if (!view) return;
        this.update(editor, view);
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!leaf) return;
        const v = leaf.view;
        if (!(v instanceof MarkdownView)) return;
        const e = v.editor;
        this.update(e, v);
      })
    );
    // check it the editor is open
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const editor = view.editor;
      if (editor) {
        this.update(editor, view);
      }
    }
  }

  menumodels(e: MouseEvent, editor: Editor) {
    //if (!this.plugin.isresponding) return;
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (endpoint.apiKey === EmptyApiKey) {
      new AskForAPI(this.app, this.plugin).open();
      return;
    }
    new PureChatLLMChat(this.plugin).getAllModels().then((models) => {
      const m = new Menu();
      this.plugin.modellist = models;
      models.forEach((model) => {
        m.addItem((item) => {
          item.setTitle(model);
          item.onClick(() => {
            editor.setValue(
              new PureChatLLMChat(this.plugin).setMarkdown(editor.getValue()).setModel(model)
                .Markdown
            );
            // this.plugin.saveSettings();
            new Notice("Model changed to " + model);
          });
        });
      });
      m.showAtMouseEvent(e);
    });
  }

  update(editor: Editor, view: MarkdownView) {
    const editorValue = editor.getValue();
    const chat = new PureChatLLMChat(this.plugin);
    chat.Markdown = editorValue;
    const container = this.contentEl;
    container.empty();
    container.createDiv({ text: "" }, (contain) => {
      contain.addClass("PURE", "floattop");
      new ButtonComponent(contain)
        //.setIcon("box")
        .setButtonText("Models")
        .setTooltip("Change model")
        .onClick((e) => {
          this.menumodels(e, editor);
        });
      new DropdownComponent(contain)
        .addOptions(
          Object.fromEntries(this.plugin.settings.endpoints.map((e, i) => [i.toString(), e.name]))
        )
        .setValue(this.plugin.settings.endpoint.toString())
        .onChange(async (value) => {
          this.plugin.settings.endpoint = parseInt(value, 10);
          editor.setValue(
            new PureChatLLMChat(this.plugin)
              .setMarkdown(editor.getValue())
              .setModel(this.plugin.settings.endpoints[this.plugin.settings.endpoint].defaultmodel)
              .Markdown
          );
          this.plugin.modellist = [];
          await this.plugin.saveSettings();
        });
    });

    // Process markdown messages
    chat.messages.forEach((message) => {
      const preview =
        message.content.substring(0, 400) + (message.content.length > 200 ? "\n... " : "");

      // Role header with clickable position jump
      container.createDiv({ text: "" }, (contain) => {
        contain.addClass("PURE", "messageContainer", message.role);
        contain.createEl("h1", { text: toSentanceCase(message.role) }, (el) => {
          el.onClickEvent(() => this.goToPostion(editor, message.cline));
          el.addClass("PURE", "messageHeader", message.role);
        });
        // Preview of message content with copy button
        if (preview)
          contain.createEl("div", "", (div) => {
            div.addClass("PURE", "preview", message.role);
            div.createDiv({ text: "" }, (el) => {
              el.onClickEvent(() => this.goToPostion(editor, message.cline, true));
              el.addClass("PURE", "messageMarkdown", message.role);
              MarkdownRenderer.render(this.app, preview, el, view.file?.basename || "", this);
            });
            new ButtonComponent(div)
              .setIcon("copy")
              .setTooltip("Copy message to clipboard")
              .onClick(() => {
                navigator.clipboard.writeText(message.content);
                new Notice("Copied message to clipboard");
              });
            new ButtonComponent(div)
              .setIcon("message-square-x")
              .setTooltip("Delete message")
              .onClick(() => {
                editor.replaceRange(
                  "",
                  {
                    line: message.cline.from.line - 1,
                    ch: 0,
                  },
                  message.cline.to
                );
                new Notice("Deleted message");
              });
            if (/# \w+/gm.test(message.content))
              new ButtonComponent(div)
                .setIcon("table-of-contents")
                .setTooltip("View and edit sections")
                .onClick(() => {
                  new SectionHandling(this.app, this.plugin, message.content).open();
                });
            if (/```[\w\W]*?```/gm.test(message.content))
              new ButtonComponent(div)
                .setIcon("code")
                .setTooltip("View and edit code")
                .onClick(() => {
                  new CodeHandling(this.app, this.plugin, message.content).open();
                });
            new ButtonComponent(div)
              .setIcon("refresh-cw")
              .setTooltip("Regenerate response")
              .onClick(() => {
                editor.replaceRange(
                  "",
                  { line: message.cline.to.line, ch: 0 },
                  {
                    line: editor.lastLine(),
                    ch: editor.getLine(editor.lastLine()).length,
                  }
                );
                this.plugin.CompleteChatResponse(editor, view);
              });
          });
      });
    });
    // scroll to bottom of container
    // if the editor is focused
    if (editor.hasFocus()) {
      container.scrollTo(0, container.scrollHeight);
    }
  }

  private goToPostion(editor: Editor, position: EditorRange, select = false) {
    if (select) {
      editor.setSelections([{ anchor: position.from, head: position.to }]);
      //editor.setSelection(position.from, position.to);
      editor.scrollIntoView(position);
    } else {
      editor.setCursor(position.from);
      editor.scrollTo(0, editor.posToOffset(position.from));
    }
    editor.focus();
    // if it's mobile, wait 100ms to focus the editor again
    // this will make the selection work on mobile
    if (Platform.isMobile) {
      window.setTimeout(() => {
        editor.focus();
      }, 100);
    }
  }

  async onClose() {
    // Nothing to clean up.
  }
}

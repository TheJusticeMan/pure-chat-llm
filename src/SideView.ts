import {
  App,
  ButtonComponent,
  DropdownComponent,
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
} from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import { PureChatLLMChat } from "./Chat";
import { CodeHandling, SectionHandling } from "./CodeHandling";
import PureChatLLM from "./main";
import { AskForAPI } from "./models";
import { alloptions, EmptyApiKey } from "./s.json";
import { toTitleCase } from "./toTitleCase";
import { PURE_CHAT_LLM_VIEW_TYPE } from "./types";

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
    this.viewText = "Conversation overview";
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
      this.app.workspace.on("editor-change", (editor: Editor, view: MarkdownView) => {
        // if the user is typing in the editor, update the view
        if (!this.plugin.isresponding) this.update(editor, view);
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.defaultContent();
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        if (!view) return;
        if (!editor) return;
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
        const c = e.getCursor();
        if (c.ch === 0 && c.line === 0) {
          e.setCursor({
            line: e.lastLine(),
            ch: e.getLine(e.lastLine()).length,
          });
          e.scrollIntoView(
            {
              from: { line: e.lastLine(), ch: 0 },
              to: { line: e.lastLine(), ch: e.getLine(e.lastLine()).length },
            },
            true
          );
        }
      })
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

  menumodels(e: MouseEvent, editor: Editor) {
    //if (!this.plugin.isresponding) return;
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
    if (endpoint.apiKey === EmptyApiKey) {
      new AskForAPI(this.app, this.plugin).open();
      return;
    }
    new PureChatLLMChat(this.plugin).getAllModels().then((models) => {
      this.plugin.modellist = models;
      this.plugin.settings.ModelsOnEndpoint[endpoint.name] = models;
      this.plugin.saveSettings();
      new modelChooser(this.app, this.plugin.modellist, (model) =>
        editor.setValue(
          new PureChatLLMChat(this.plugin).setMarkdown(editor.getValue()).setModel(model).Markdown
        )
      ).open();
    });
  }

  defaultContent() {
    //MarkdownRenderer.render(this.app, splash, this.contentEl, view.file?.basename || "", this);
    this.contentEl.empty();
    new Setting(this.contentEl)
      .setName("Pure Chat LLM")
      .setHeading()
      .addExtraButton((btn) => btn.setIcon("settings").onClick(() => this.plugin.openSettings()))
      .addButton((btn) => btn.setButtonText("Hot keys").onClick(() => this.plugin.openHotkeys()));
    new Setting(this.contentEl).setName(
      "The current editor does not contain a valid conversation."
    );
    new Setting(this.contentEl).setName("Available commands").setHeading();
    new Setting(this.contentEl)
      .setName("Complete chat response")
      .setDesc("This will start a new chat with the current editor content.");
    new Setting(this.contentEl)
      .setName("Generate title")
      .setDesc("This will generate a title for the current editor content.");
    new Setting(this.contentEl)
      .setName("Edit selection")
      .setDesc("This will edit the selected text in the current editor.");
    new Setting(this.contentEl)
      .setName("Analyze conversation")
      .setDesc("This will analyze the current conversation.");
    new Setting(this.contentEl)
      .setName("Reverse roles")
      .setDesc("This will reverse the roles of the current conversation.");
    new Setting(this.contentEl)
      .setName("Speak chat")
      .setDesc("This will speak the current chat using two voices.");
  }

  update(editor: Editor, view: MarkdownView) {
    const editorValue = editor.getValue().trim();
    const chat = new PureChatLLMChat(this.plugin);
    chat.Markdown = editorValue;
    const container = this.contentEl;
    container.empty();
    if (!chat.validChat || !editorValue) {
      this.defaultContent();
      return;
    }
    const index =
      (this.plugin.settings.endpoints.findIndex((e) => e.name === chat.endpoint.name) + 1 || 1) - 1;

    container.createDiv({ text: "" }, (contain) => {
      contain.addClass("PURE", "floattop");
      new ButtonComponent(contain)
        //.setIcon("box")
        .setButtonText(chat.options.model)
        .setTooltip("Change model")
        .onClick((e) => {
          this.menumodels(e, editor);
        });
      new DropdownComponent(contain)
        .addOptions(
          Object.fromEntries(this.plugin.settings.endpoints.map((e, i) => [i.toString(), e.name]))
        )
        .setValue(index.toString())
        .onChange(async (value) => {
          this.plugin.settings.endpoint = parseInt(value, 10);
          const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
          editor.setValue(
            new PureChatLLMChat(this.plugin)
              .setMarkdown(editor.getValue())
              .setModel(endpoint.defaultmodel).Markdown
          );
          this.plugin.modellist = [];
          await this.plugin.saveSettings();
        });
      new ButtonComponent(contain)
        .setButtonText("Show all")
        .setTooltip("Show all options")
        .onClick(() =>
          editor.setValue(
            new PureChatLLMChat(this.plugin)
              .setMarkdown(editor.getValue())
              .thencb((chat) => Object.assign(chat.options, { ...alloptions }, { ...chat.options }))
              .Markdown
          )
        );
    });

    container.addClass("PURESideView");
    // Process markdown messages
    chat.messages.forEach((message) => {
      const preview = message.content.substring(0, 400);

      // Role header with clickable position jump
      container.createDiv({ text: "" }, (contain) => {
        contain.addClass("PURE", "messageContainer", message.role);
        contain.createEl("h1", { text: toTitleCase(message.role) }, (el) => {
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
            new ExtraButtonComponent(div)
              .setIcon("copy")
              .setTooltip("Copy message to clipboard")
              .onClick(() => {
                navigator.clipboard.writeText(message.content);
                new Notice("Copied message to clipboard");
              });
            new ExtraButtonComponent(div)
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
              });
            if (/# \w+/gm.test(message.content))
              new ExtraButtonComponent(div)
                .setIcon("table-of-contents")
                .setTooltip("View and edit sections")
                .onClick(() => {
                  new SectionHandling(this.app, this.plugin, message.content).open();
                });
            if (/```[\w\W]*?```/gm.test(message.content))
              new ExtraButtonComponent(div)
                .setIcon("code")
                .setTooltip("View and edit code")
                .onClick(() => {
                  new CodeHandling(this.app, this.plugin, message.content).open();
                });
            new ExtraButtonComponent(div)
              .setIcon("refresh-cw")
              .setTooltip("Regenerate response")
              .onClick(() => {
                new Notice(`${message.cline.to.line} ${editor.lastLine()}`);
                if (message.cline.to.line !== editor.lastLine())
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

class modelChooser extends FuzzySuggestModal<string> {
  items: string[];
  onChoose: (item: string) => void;

  constructor(app: App, items: string[], onChoose: (item: string) => void) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
  }

  getItems(): string[] {
    return this.items;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(item);
  }
}

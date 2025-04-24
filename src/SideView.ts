import { ItemView, WorkspaceLeaf, Editor, MarkdownView, setIcon, MarkdownRenderer, EditorRange } from 'obsidian';
import { PureChatLLMChat } from './Chat';
import PureChatLLM from './main';
import { PURE_CHAT_LLM_VIEW_TYPE } from './types';

export class PureChatLLMSideView extends ItemView {
	plugin: PureChatLLM;

	private speedofUpdate: number = 0;

	constructor(leaf: WorkspaceLeaf, plugin: PureChatLLM) {
		super(leaf);
		this.icon = 'dice';
		this.plugin = plugin;
	}

	getViewType() {
		return PURE_CHAT_LLM_VIEW_TYPE;
	}

	getDisplayText() {
		return 'Pure Chat LLM';
	}

	async onOpen() {
		this.speedofUpdate = 0;
		// when a file is loaded or changed, update the view

		this.registerEvent(this.app.workspace.on("editor-change", (editor: Editor, view: MarkdownView) => {
			// if the user is typing in the editor, update the view
			if (!this.plugin.isresponding) this.update(editor, view);
		}));
		this.registerEvent(this.app.workspace.on("file-open", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = view?.editor;
			if (!editor) return;
			if (!view) return;
			this.update(editor, view);
		}));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = view?.editor;
			if (!editor) return;
			if (!view) return;
			this.update(editor, view);
		}));
	}


	update(editor: Editor, view: MarkdownView) {
		/* if (Date.now() - this.speedofUpdate < 20) {// optional speedup not working
			this.speedofUpdate = Date.now();
			window.setTimeout(() => this.update(), 20);
			return;
		} */
		const editorValue = editor.getValue();
		const chat = new PureChatLLMChat(this.plugin);
		chat.Markdown = editorValue;

		const container = this.containerEl.children[1];
		container.empty();
		if (false) {
			container.addClass("PURE", "case");
			container.createDiv({ text: "" }, (el) => {
				//el.createDiv
				el.createEl('button', "", (btn) => {
					btn.onClickEvent(() => {
						const vl = el.querySelector("input")?.value;
						if (!vl) return;
						editor.replaceRange(vl, { line: editor.lastLine(), ch: 0 });
						this.plugin.CompleteChatResponse(editor, view);
					});
					setIcon(btn, "send");
					el.createEl('textarea', { type: "text", placeholder: "send to GPT...", }, (ipt) => {
						ipt.onkeydown = (e) => {
							if (e.shiftKey && e.key === "Enter") {
								editor.replaceRange(ipt.value + "\n", { line: editor.lastLine(), ch: 0 });
								this.plugin.CompleteChatResponse(editor, view);
							}
						};
					});
				});
				el.addClass("PURE", "floatbottom");
				//el.createEl('span', { text: `Speed of update: ${this.speedofUpdate}ms` });
			});
			container.createDiv({ text: "" }, (el) => {
				// json editor for chat options
				el.addClass("PURE", "floattop");
			});
		}

		// Process markdown messages
		chat.messages.forEach((message) => {
			const preview = message.content.substring(0, 200) + (message.content.length > 200 ? "\n... " : "");

			// Role header with clickable position jump
			container.createEl('h1', { text: message.role + " " }, (el) => {
				el.onClickEvent(() => this.goToPostion(editor, message.cline));
				el.addClass("PURE", "is-clickable");
			});
			// Preview of message content with copy button
			if (preview)
				container.createEl('div', "", (div) => {
					div.createDiv({ text: "" }, (el) => {
						div.onClickEvent(() => this.goToPostion(editor, message.cline, true));
						div.addClass("PURE", "is-clickable", "markdown");
						MarkdownRenderer.render(this.app, preview, el, view.file?.basename || "", this);
						/* div.createEl("button", { text: "copy" }, (btn) => {
							btn.onClickEvent(() => navigator.clipboard.writeText(message.content));
						}); */
						el.createEl("span", { text: "delete" }, (btn) => {
							btn.onClickEvent(() => editor.replaceRange("", message.cline.from, message.cline.to));
							setIcon(btn, "delete");
							btn.addClass("PURE", "icn");
						});
						el.createEl("span", { text: "copy" }, (btn) => {
							btn.onClickEvent(() => navigator.clipboard.writeText(message.content));
							setIcon(btn, "copy");
							btn.addClass("PURE", "icn");
						});
						PureChatLLMChat.extractAllCodeBlocks(message.content).forEach((cb) => {
							el.createEl("button", { text: cb.language }, (btn) => {
								btn.onClickEvent(() => navigator.clipboard.writeText(cb.code));
							});
						});
					});
				});
		});
		// scroll to bottom of container
		container.scrollTo(0, container.scrollHeight);
	}

	updateV2() {
		// same as update() exept better use of components.
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = view?.editor;
		if (!editor) return;
	}


	private goToPostion(editor: Editor, position: EditorRange, select = false) {
		if (select) {
			editor.setSelections([{ anchor: position.from, head: position.to }], 0);
			editor.scrollIntoView(position);
		} else {
			editor.setCursor(position.from);
			editor.scrollTo(0, editor.posToOffset(position.from));
		}
		editor.focus();
	}

	async onClose() {
		// Nothing to clean up.
	}
}

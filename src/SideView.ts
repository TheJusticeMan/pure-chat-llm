import { ItemView, WorkspaceLeaf, Editor, MarkdownView, setIcon, MarkdownRenderer, EditorRange, Notice, ButtonComponent, Platform } from 'obsidian';
import { PureChatLLMChat } from './Chat';
import PureChatLLM, { CodeHandling } from './main';
import { toSentanceCase } from './toSentanceCase';
import { PURE_CHAT_LLM_VIEW_TYPE } from './types';
import { BrowserConsole } from './MyBrowserConsole';

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
		this.icon = 'text';
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
		this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
			if (!leaf) return;
			const v = leaf.view;
			if (!(v instanceof MarkdownView)) return;
			const e = v.editor;
			this.update(e, v);
		}));
		// check it the editor is open
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const editor = view.editor;
			if (editor) {
				this.update(editor, view);
			}
		}
	}

	update(editor: Editor, view: MarkdownView) {
		const editorValue = editor.getValue();
		const chat = new PureChatLLMChat(this.plugin);
		chat.Markdown = editorValue;
		const container = this.contentEl;
		container.empty();

		// Process markdown messages
		chat.messages.forEach((message) => {
			const preview = message.content.substring(0, 400) + (message.content.length > 200 ? "\n... " : "");

			// Role header with clickable position jump
			container.createDiv({ text: "" }, (contain) => {
				contain.addClass("PURE", "preview2", message.role);
				contain.createEl('h1', { text: toSentanceCase(message.role) }, (el) => {
					el.onClickEvent(() => this.goToPostion(editor, message.cline));
					el.addClass("PURE", "is-clickable", message.role);
				});
				// Preview of message content with copy button
				if (preview)
					contain.createEl('div', "", (div) => {
						div.addClass("PURE", "preview", message.role);
						div.createDiv({ text: "" }, (el) => {
							el.onClickEvent(() => this.goToPostion(editor, message.cline, true));
							el.addClass("PURE", "is-clickable", "markdown");
							MarkdownRenderer.render(this.app, preview, el, view.file?.basename || "", this);
						});
						new ButtonComponent(div)
							.setIcon("copy")
							.onClick(() => {
								navigator.clipboard.writeText(message.content);
								new Notice("Copied message to clipboard");
							});
						new ButtonComponent(div)
							.setIcon("message-square-x")
							.onClick(() => {
								editor.replaceRange("", { line: message.cline.from.line - 1, ch: 0 }, message.cline.to);
								new Notice("Deleted message");
							});
						const iscode = /```[\w\W]*?```/gm.test(message.content);
						if (iscode)
							new ButtonComponent(div)
								.setIcon("code")
								.onClick(() => {
									new CodeHandling(this.app, this.plugin, message.content).open();
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

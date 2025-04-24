import { App, Editor, FuzzySuggestModal, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf } from 'obsidian';
import { PureChatLLMChat } from './Chat';
import { PureChatLLMSideView } from './SideView';
import { DEFAULT_PROCESS_CHAT_TEMPLATES, DEFAULT_SELECTION_TEMPLATES, DEFAULT_SETTINGS, PURE_CHAT_LLM_VIEW_TYPE, PureChatLLMPromptTemplate, PureChatLLMPromptTemplates, PureChatLLMSettings } from './types';
/* declare module 'obsidian' {
	interface Editor {
		goToEnd(): void;

	}
}

Editor.prototype.goToEnd = function () {
	if (!this) return;
	this.setCursor(this.lastLine(), this.getLine(this.lastLine()).length);
	this.scrollIntoView({ from: { line: this.lastLine(), ch: 0 }, to: { line: this.lastLine(), ch: 0 } });
}; */

export default class PureChatLLM extends Plugin {
	settings: PureChatLLMSettings;
	isresponding: boolean;

	async onload() {
		await this.loadSettings();
		console.log('PureChatLLM settings loaded', this.settings);

		this.registerView(
			PURE_CHAT_LLM_VIEW_TYPE,
			(leaf) => new PureChatLLMSideView(leaf, this)
		);


		// Add icon to the ribbon
		//this.addRibbonIcon('send', 'Pure Chat LLM', this.handleRibbonClick.bind(this))
		//this.addRibbonIcon('wand', 'Pure Chat LLM menu', this.handleRibbonMenuClick.bind(this))
		this.addRibbonIcon('text-cursor-input', 'Pure Chat LLM Leaf', this.activateView.bind(this))

		// Add command for completing chat response
		this.addCommand({
			id: 'complete-chat-response',
			name: 'Complete chat response',
			icon: "send",
			hotkeys: [{ modifiers: ["Shift"], key: "Enter" }],
			editorCallback: this.CompleteChatResponse.bind(this),
		});
		// Add command for settings
		this.addCommand({
			id: 'generate-title',
			name: 'Generate title',
			icon: "text-cursor-input",
			editorCallback: this.GenerateTitle.bind(this),
		});
		this.addCommand({
			id: 'edit-selection',
			name: 'Edit Selection',
			editorCheckCallback: (checking, e: Editor) => {
				const selected = e.getSelection();
				if (checking) return !!selected;
				this.GetTemplates("PureChatLLM/templates.md", DEFAULT_SELECTION_TEMPLATES)
					.then((templates) => {
						new PromptTemplatesHandler(this.app, (s) => {
							new PureChatLLMChat(this)
								.SelectionResponse(s, selected)
								.then((response) => {
									e.replaceSelection(response.content);
								});
						}, templates).open();
					});
			}
		});
		this.addCommand({
			id: 'save-templates',
			name: 'Save templates',
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
						.map((t) => `# ${t.name}\n${t.template}`).join("\n\n")
				);
			}
		})
		// Add a context menu item for simplifying the selection
		this.registerEvent(this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
			//menu.addChild(new MenuItem().setTitle("Pure Chat LLM").setIcon("wand"))
			this.addItemsToMenu(menu, editor, view);
		}));

		// Add settings tab
		this.addSettingTab(new PureChatLLMSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.activateView();
		})
	}

	private GetTemplates(folderNName: string, DefaultTemplates: PureChatLLMPromptTemplates): Promise<PureChatLLMPromptTemplates> {
		const file = this.app.vault.getAbstractFileByPath(folderNName);
		if (file instanceof TFile)
			this.app.vault.cachedRead(file).then((templates) => {
				const parsedTemplates = templates
					.split("# ")
					.filter(Boolean)
					.map((tm) => {
						const [name, ...content] = tm.split("\n");
						return [name.trim(), { name: name.trim(), template: content.join("\n").trim() }] as [string, PureChatLLMPromptTemplate];
					});
				return Object.assign(DefaultTemplates, Object.fromEntries(parsedTemplates));
			});
		return Promise.resolve(DefaultTemplates);
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
			await leaf?.setViewState({ type: PURE_CHAT_LLM_VIEW_TYPE, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			//workspace.revealLeaf(leaf);
		}
	}

	addItemsToMenu(menu: Menu, editor: Editor, view: MarkdownView) {
		const selected = editor.getSelection();
		if (selected.length > 0) {
			menu.addItem((item) => {
				item
					.setTitle("Edit Selection")
					.setIcon('wand')
					.onClick(async () => {
						this.GetTemplates("PureChatLLM/templates.md", DEFAULT_SELECTION_TEMPLATES)
							.then((templates) => {
								new PromptTemplatesHandler(this.app, (s) => {
									new PureChatLLMChat(this)
										.SelectionResponse(s, selected)
										.then((response) => {
											editor.replaceSelection(response.content);
										});
								}, templates).open();
							});
					})
					.setSection('pure-chat-llm')
			});
		}

		Object.entries(DEFAULT_PROCESS_CHAT_TEMPLATES).forEach(([key, template]) => {
			menu.addItem((item) => {
				item
					.setTitle(`Run: ${template.name}, on the chat.`)
					.setIcon('wand')
					.onClick(async () => {
						new PureChatLLMChat(this)
							.setMarkdown(editor.getValue())
							.ProcessChatWithTemplate(template)
							.then((response) => {
								if (response) {
									editor.replaceSelection(response.content);
								}
							});
					});
			});
		});
		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle('Generate title')
				.setIcon('text-cursor-input')
				.onClick(async () => {
					this.GenerateTitle(editor, view);
				}
				);
		});
		return menu;
	}

	GenerateTitle(editor: Editor, view: MarkdownView) {
		const defaultOptions = { model: this.settings.Model, max_tokens: 1000 };

		const ActiveFile = this.app.workspace.getActiveFile();
		if (ActiveFile) {
			new PureChatLLMChat(this)
				.setMarkdown(editor.getValue())
				.ProcessChatWithTemplate(DEFAULT_PROCESS_CHAT_TEMPLATES["Conversation titler"])
				.then((title) => {
					const sanitizedTitle = `${ActiveFile.parent?.path}/${title.content.replace(/[^a-zA-Z0-9 ]/g, '').trim()}.${ActiveFile.extension}`;
					this.app.fileManager.renameFile(ActiveFile, sanitizedTitle);
					new Notice(`File renamed to: ${sanitizedTitle}`);
				})
		} else {
			new Notice('No active file to rename.');
			return;
		}
	}

	CompleteChatResponse(editor: Editor, view: MarkdownView) {
		if (this.settings.apiKey == DEFAULT_SETTINGS.apiKey) {
			new AskForAPI(this.app, this).open();
			return;
		}
		const activeFile = view.file;
		if (!activeFile) return;
		this.isresponding = true;
		const editorcontent = editor.getValue();
		editor.setCursor(editor.lastLine(), editor.getLine(editor.lastLine()).length);
		editor.replaceSelection("\n# role: assistant...\n");
		//editor.setValue(
		new PureChatLLMChat(this)
			.setMarkdown(editorcontent)
			.CompleteChatResponse(activeFile, (e) => {
				editor.replaceSelection(e.content);
				editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() })
				return true;
			})
			.then((chat) => {
				this.isresponding = false;
				if (
					this.settings.AutogenerateTitle > 0 &&
					chat.messages.length >= this.settings.AutogenerateTitle &&
					activeFile?.name.includes('Untitled') &&
					view
				) {
					this.GenerateTitle(editor, view);
				}
				editor.setValue(chat.Markdown);
				editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() })
			})
			.catch((error) => console.error(error))
			.finally(() => {
				this.isresponding = false;
			})
	}

	changeCodeBlockMD(text: string, language: string, newText: string) {
		const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
		return text.replace(regex, `\`\`\`${language}\n${newText}\n\`\`\``) || `${text}\n\`\`\`${language}\n${newText}\n\`\`\``;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(PURE_CHAT_LLM_VIEW_TYPE);
	}
}

export class AskForAPI extends Modal {
	constructor(app: App, plugin: PureChatLLM) {
		super(app);
		this.setTitle('You need an API key to use chatGPT.');

		let name = '';
		new Setting(this.contentEl)
			.setName('Api key')
			.setDesc('Api key for OpenAI')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiKey)
				.setValue(plugin.settings.apiKey)
				.onChange(async (value) => {
					name = value;
				}));

		new Setting(this.contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Submit')
					.setCta()
					.onClick(async () => {
						this.close();
						plugin.settings.apiKey = name || DEFAULT_SETTINGS.apiKey;
						await plugin.saveSettings();
					}))
			.addButton((btn) =>
				btn
					.setButtonText('Cancel')
					.setCta()
					.onClick(async () => {
						this.close();
					}))
		this.contentEl.createDiv({ text: "You can get an API key from:  " }, (e) => {

			e.createEl("a", { text: "OpenAI api", href: "https://platform.openai.com/api-keys" })
		});
	}
}

export class PromptTemplatesHandler extends FuzzySuggestModal<PureChatLLMPromptTemplate> {
	onSubmit: (result: PureChatLLMPromptTemplate) => void;
	templates: PureChatLLMPromptTemplates;
	constructor(app: App, onSubmit: (result: PureChatLLMPromptTemplate) => void, templates: PureChatLLMPromptTemplates) {
		super(app);
		this.onSubmit = onSubmit;
		this.templates = templates;
	}

	getItems(): PureChatLLMPromptTemplate[] {
		return Object.values(this.templates);
	}

	getItemText(book: PureChatLLMPromptTemplate): string {
		return book.name;
	}

	onChooseItem(book: PureChatLLMPromptTemplate, evt: MouseEvent | KeyboardEvent) {
		this.onSubmit(book);
		new Notice(`Selected ${book.name}`);
	}
}

class PureChatLLMSettingTab extends PluginSettingTab {
	plugin: PureChatLLM;

	constructor(app: App, plugin: PureChatLLM) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		const settings = this.plugin.settings;

		new Setting(containerEl)
			.setName('Api key')
			.setDesc('Api key for OpenAI')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiKey)
				.setValue(settings.apiKey)
				.onChange(async (value) => {
					settings.apiKey = value || DEFAULT_SETTINGS.apiKey;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Autogenerate title')
			.setDesc('Number of responces before generateing title for the conversation, 0 to disable')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.AutogenerateTitle.toString())
				.setValue(settings.AutogenerateTitle.toString())
				.onChange(async (value) => {
					const num = value.length != 0 ? parseInt(value, 10) : DEFAULT_SETTINGS.AutogenerateTitle;
					if (!isNaN(num) && num >= 0) {
						settings.AutogenerateTitle = num;
						await this.plugin.saveSettings();
					} else {
						new Notice('Please enter a valid number.');
					}
				}));
		new Setting(containerEl)
			.setName('Default model')
			.setDesc('Default model to use for chat completions')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.Model)
				.setValue(settings.Model)
				.onChange(async (value) => {
					settings.Model = value || DEFAULT_SETTINGS.Model;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Default system prompt')
			.setDesc('Default system prompt to use for chat completions')
			.setClass("PURE")
			.addTextArea(text => text
				.setPlaceholder(DEFAULT_SETTINGS.SystemPrompt)
				.setValue(settings.SystemPrompt)
				.onChange(async (value) => {
					settings.SystemPrompt = value || DEFAULT_SETTINGS.SystemPrompt;
					await this.plugin.saveSettings();
				}));
	}
}

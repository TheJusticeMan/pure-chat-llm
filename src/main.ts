import { App, ButtonComponent, Editor, FuzzySuggestModal, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent, TFile, WorkspaceLeaf } from 'obsidian';
import { codeContent, PureChatLLMChat } from './Chat';
import { PureChatLLMSideView } from './SideView';
import { DEFAULT_PROCESS_CHAT_TEMPLATES, DEFAULT_SELECTION_TEMPLATES, DEFAULT_SETTINGS, PURE_CHAT_LLM_VIEW_TYPE, PureChatLLMInstructPrompt, PureChatLLMInstructPrompts, PureChatLLMSettings } from './types';
import { BrowserConsole } from './MyBrowserConsole';

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

	async onload() {
		await this.loadSettings();
		this.console = new BrowserConsole(this.settings.debug, "PureChatLLM");
		this.console.log('settings loaded', this.settings);

		this.registerView(
			PURE_CHAT_LLM_VIEW_TYPE,
			(leaf) => new PureChatLLMSideView(leaf, this)
		);

		this.addRibbonIcon('text', 'Open conversation overview', this.activateView.bind(this))

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
				this.GetInstructPrompts("PureChatLLM/templates.md", DEFAULT_SELECTION_TEMPLATES)
					.then(templates =>
						new InstructPromptsHandler(this.app, (s) =>
							new PureChatLLMChat(this)
								.SelectionResponse(s, selected)
								.then(response => e.replaceSelection(response.content))
							, templates).open()
					);
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

	}

	onUserEnable() {
		this.activateView();
		this.console.log('Plugin enabled');
	}

	private GetInstructPrompts(folderNName: string, DefaultInstructPrompts: PureChatLLMInstructPrompts): Promise<PureChatLLMInstructPrompts> {
		const file = this.app.vault.getAbstractFileByPath(folderNName);
		if (file instanceof TFile)
			this.app.vault.cachedRead(file).then((InstructPrompts) => (
				Object.assign(
					DefaultInstructPrompts,
					Object.fromEntries(InstructPrompts
						.split("# ")
						.filter(Boolean)
						.map((tm) => {
							const [name, ...content] = tm.split("\n");
							return [name.trim(), { name: name.trim(), template: content.join("\n").trim() }] as [string, PureChatLLMInstructPrompt];
						})
					)
				)
			));
		return Promise.resolve(DefaultInstructPrompts);
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
			workspace.revealLeaf(leaf);
		}
	}

	addItemsToMenu(menu: Menu, editor: Editor, view: MarkdownView) {
		const selected = editor.getSelection();
		if (selected.length > 0)
			menu.addItem((item) => item
				.setTitle("Edit Selection")
				.setIcon('wand')
				.onClick(async () => {
					this.GetInstructPrompts("PureChatLLM/templates.md", DEFAULT_SELECTION_TEMPLATES)
						.then((templates) =>
							new InstructPromptsHandler(
								this.app, (s) => new PureChatLLMChat(this)
									.SelectionResponse(s, selected)
									.then((response) => editor.replaceSelection(response.content)),
								templates).open()
						);
				})
				.setSection('selection')
			)
				.addItem((item) =>
					item
						.setTitle('wand')
						.setIcon('wand')
						.onClick(async () => {
							new ChangeAPeace(this.app, this, editor.getSelection(), (s) => editor.replaceSelection(s)).open();
						})
						.setSection('selection')
				);


		menu.addItem((item) =>
			item
				.setTitle(`Analyze conversation`)
				.setIcon("messages-square")
				.onClick(async () =>
					new InstructPromptsHandler(
						this.app, (s) => new PureChatLLMChat(this)
							.setMarkdown(editor.getValue())
							.ProcessChatWithTemplate(s)
							.then((response) => editor.replaceSelection(response.content)),
						DEFAULT_PROCESS_CHAT_TEMPLATES).open()
				)
		);
		return menu.addSeparator()
			.addItem(item =>
				item
					.setTitle('Generate title')
					.setIcon('text-cursor-input')
					.onClick(async () => this.GenerateTitle(editor, view)))
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
				.ProcessChatWithTemplate(DEFAULT_PROCESS_CHAT_TEMPLATES["Conversation titler"])
				.then((title) => {
					const sanitizedTitle = `${ActiveFile.parent?.path}/${title.content.replace(/[^a-zA-Z0-9 ]/g, '').trim()}.${ActiveFile.extension}`;
					this.app.fileManager.renameFile(ActiveFile, sanitizedTitle);
					new Notice(`File renamed to: ${sanitizedTitle}`);
				});
		else
			new Notice('No active file to rename.');
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
		if (this.settings.apiKey == DEFAULT_SETTINGS.apiKey) {
			new AskForAPI(this.app, this).open();
			return;
		}
		const activeFile = view.file;
		if (!activeFile) return;
		this.isresponding = true;
		const editorcontent = editor.getValue();
		editor.setCursor(editor.lastLine(), editor.getLine(editor.lastLine()).length);
		editor.replaceSelection("\n# role: Assistant...\n");
		editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() })
		//editor.setValue(
		new PureChatLLMChat(this)
			.setMarkdown(editorcontent)
			.CompleteChatResponse(activeFile, (e) => {
				editor.replaceSelection(e.content);
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
			.catch((error) => this.console.error(error))
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

/**
 * Modal dialog for displaying and handling code blocks extracted from a given string.
 * 
 * This modal presents each code block in a separate section, showing its language and code content.
 * Users can edit the code in a textarea and copy the code to the clipboard using a button.
 *
 * @remarks
 * - Utilizes the `PureChatLLMChat.extractAllCodeBlocks` method to parse code blocks from the input string.
 * - Each code block is displayed with its language as a heading, an editable textarea, and a copy-to-clipboard button.
 * - The modal is titled "Code Handling".
 *
 * @example
 * ```typescript
 * const modal = new CodeHandling(app, plugin, codeString);
 * modal.open();
 * ```
 *
 * @param app - The Obsidian application instance.
 * @param plugin - The instance of the PureChatLLM plugin.
 * @param code - The string containing code blocks to be extracted and displayed.
 */
export class CodeHandling extends Modal {
	plugin: PureChatLLM;
	code: codeContent[];
	constructor(app: App, plugin: PureChatLLM, code: string) {
		super(app);
		this.plugin = plugin;
		this.code = PureChatLLMChat.extractAllCodeBlocks(code);
		this.setTitle('Code Handling');
		for (const c of this.code) {
			this.contentEl.createDiv({}, (e) => {
				e.createEl("h1", { text: c.language })
				const text = new TextAreaComponent(e)
					.setValue(c.code)
					.onChange(async (value) => {
						c.code = value;
					})
				text.inputEl.addClass("PUREcodePreview");
				new ButtonComponent(e)
					.setIcon("copy")
					.onClick(async () => {
						navigator.clipboard.writeText(c.code);
						new Notice("Code copied to clipboard");
					});
				new ButtonComponent(e)
					.setIcon("pencil")
					.onClick(async () => {
						new ChangeAPeace(this.app, this.plugin, `\`\`\`${c.code}\n${text.getValue()}\n\`\`\``, (s) => text.setValue(s)).open();
					});
			});
		}
	}
}

/**
 * Modal dialog prompting the user to enter an OpenAI API key for the PureChatLLM plugin.
 *
 * This modal displays a text input for the API key, a submit button to save the key,
 * and a cancel button to close the modal without saving. It also provides a link to
 * the OpenAI API key generation page. The entered API key is saved to the plugin's settings.
 *
 * @extends Modal
 * @param app - The Obsidian application instance.
 * @param plugin - The instance of the PureChatLLM plugin, used to access and save settings.
 */
export class AskForAPI extends Modal {
	plugin: PureChatLLM;
	app: App;
	constructor(app: App, plugin: PureChatLLM) {
		super(app);
		this.plugin = plugin;
		this.app = app;
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
				})
				.inputEl.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') {
						this.close();
						plugin.settings.apiKey = name || DEFAULT_SETTINGS.apiKey;
						plugin.saveSettings();
					}
				})
			);

		new Setting(this.contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Ok')
					.setCta()
					.onClick(async () => {
						this.close();
						plugin.settings.apiKey = name || DEFAULT_SETTINGS.apiKey;
						await plugin.saveSettings();
					}))
			.addButton((btn) =>
				btn
					.setButtonText('Cancel')
					.onClick(async () => {
						this.close();
					}))
		this.contentEl.createDiv({ text: "You can get an API key from:  " }, (e) => {
			e.createEl("a", { text: "OpenAI API", href: "https://platform.openai.com/api-keys" })
		});
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
export class InstructPromptsHandler extends FuzzySuggestModal<PureChatLLMInstructPrompt> {
	onSubmit: (result: PureChatLLMInstructPrompt) => void;
	templates: PureChatLLMInstructPrompts;
	constructor(app: App, onSubmit: (result: PureChatLLMInstructPrompt) => void, templates: PureChatLLMInstructPrompts) {
		super(app);
		this.onSubmit = onSubmit;
		this.templates = templates;
	}

	getItems(): PureChatLLMInstructPrompt[] {
		return Object.values(this.templates);
	}

	getItemText(book: PureChatLLMInstructPrompt): string {
		return book.name;
	}

	onChooseItem(book: PureChatLLMInstructPrompt, evt: MouseEvent | KeyboardEvent) {
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
		new Setting(containerEl)
			.setName('Debug')
			.setDesc('Log debug information to the console')
			.addToggle(toggle => toggle
				.setValue(settings.debug)
				.onChange(async (value) => {
					settings.debug = value;
					await this.plugin.saveSettings();
					this.plugin.console = new BrowserConsole(settings.debug, "PureChatLLM");
					console.log("reload the plugin to apply the changes");
				}));
	}
}

class ChangeAPeace extends Modal {
	plugin: PureChatLLM;
	app: App;
	selection: string;
	history: string[];
	constructor(app: App, plugin: PureChatLLM, selection: string, onSubmit: (s: string) => void) {
		super(app);
		this.plugin = plugin;
		this.app = app;
		this.setTitle('Change selection with prompt');
		const selectionEl = new TextAreaComponent(this.contentEl)
			.setPlaceholder("Selection")
			.setValue(selection);
		selectionEl.inputEl.addClass("PUREcodePreview");
		const promptEl = new TextAreaComponent(this.contentEl)
			.setPlaceholder("Enter the prompt");
		promptEl.inputEl.addClass("PUREcodePreview");
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setIcon('copy')
				.onClick(async () => {
					navigator.clipboard.writeText(selectionEl.getValue());
					new Notice("Code copied to clipboard");
				}))
			.addButton((btn) => btn
				.setIcon('send')
				.setCta()
				.onClick(async () => {
					new PureChatLLMChat(this.plugin)
						.setMarkdown(promptEl.getValue())
						.SelectionResponse({ name: "", template: promptEl.getValue() }, selectionEl.getValue())
						.then((response) => {
							selectionEl.setValue(response.content);
						});
				}));
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setIcon('check')
				.setCta()
				.onClick(async () => {
					this.close();
					onSubmit(selectionEl.getValue());
				}))
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.onClick(async () => {
					this.close();
				}))
	}
}
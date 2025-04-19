import { App, Editor, MarkdownView, Notice, Menu, Modal, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

interface PureChatLLMSettings {
	apiKey: string;
	AutogenerateTitle: number;
	Model: string;
}
interface PureChatLLMTemplate {
	name: string;
	template: string;
}
interface PureChatLLMTemplates {
	[key: string]: PureChatLLMTemplate;
}



const DEFAULT_SETTINGS: PureChatLLMSettings = {
	apiKey: '',
	AutogenerateTitle: 0,
	Model: "gpt-4.1-nano",
}

const DEFAULT_PROCESS_CHAT_TEMPLATES: PureChatLLMTemplates = {
	"titleGenerate": {
		name: "Conversation titler",// this is the file name.  `You are a ${template.name}.`
		template: `Summarize the conversation in 5 words or fewer:

Be as concise as possible without losing the context of the conversation.

Your goal is to extract the key point of the conversation.`
	},
	"analizeChat": {
		name: "Conversation analizer",// this is the file name.  `You are a ${template.name}.`
		// look at the system role and the rest of the chat.
		// look at what the user is trying
		// Write a better system role.
		// Write a few prompt's that the user could try.
		template: `Analyze the conversation.

The role's are the \`user\` chatting with the \`assistant\` on the \`system\`.
- The roles include the \`user\`, the \`assistant\`, and the \`system\` (instructions).
The \`# role: system\` is the instructions to the \`system\`. In other words it's the system prompt.

Write a better system prompt based on what the user was trying to use the system for.

Write another prompt by condensing all the user requests into one to get the final assistant response with just one user message.
`
	}
}

// this is the selection templates
// role system: `You are a ${template.name}.`
// role user: `---BEGIN Selection---\n\n---\n${selectedText}\n\n---\n\n---END Selection---`
// role user: template.template

const DEFAULT_SELECTION_TEMPLATES: PureChatLLMTemplates = {
	summarize: {
		name: "Seletion Summarizer",// `You are a ${template.name}.`
		// `---BEGIN Selection---\n\n---\n${selectedText}\n\n---\n\n---END Selection---`
		template: "Create a bullet-point summary of the provided selection.\nEach bullet point should capture a key point.\nReturn only the bullet-point summary."
	},
	simplify: {
		name: "Seletion Simplifyer",
		template: "Simplify the provided selection to a 6th-grade reading level (ages 11-12).\nUse simple sentences, common words, and clear explanations.\nMaintain the original key concepts.\nReturn only the simplified selection."
	},
	emojify: {
		name: "Selection Emojifier",
		template: "Add relevant emojis to enhance the provided selection. Follow these rules:\n1. Insert emojis at natural breaks in the text\n2. Never place two emojis next to each other\n3. Keep all original text unchanged\n4. Choose emojis that match the context and tone\nReturn only the emojified selection."
	},
	fix: {
		name: "Grammar and Spelling Corrector",
		template: "Fix the grammar and spelling of the provided selection. Preserve all formatting, line breaks, and special characters. Do not add or remove any content. Return only the corrected text."
	},
	shorten: {
		name: "Selection Condenser",
		template: "Reduce the provided selection to half its length while preserving the following elements:\n1. Main ideas and key points\n2. Essential details\n3. Original tone and style\nReturn only the shortened selection."
	},
	expand: {
		name: "Selection Expander",
		template: "Expand the provided selection to twice its length by:\n1. Adding relevant details and examples\n2. Elaborating on key points\n3. Maintaining the original tone and style\nReturn only the expanded selection."
	},
	expandInstructions: {
		name: "Instruction Clarifier and Expander",
		template: "The provided selection contains instructions that need to be expanded and clarified. Expand these instructions so that someone new to the task fully understands what needs to be done. Use clear, detailed explanations, examples if necessary, and break down any complex points into simpler parts. Ensure the expanded instructions maintain the original meaning and provide a comprehensive understanding. Return only the expanded instructions."
	},
	expandRole: {
		name: "Role Clarifier and Expander",
		template: "The provided selection contains a brief role description. Expand and clarify this description by explaining the responsibilities, goals, and perspective someone playing this role should adopt. Use detailed and clear language, including relevant context or examples. Maintain the original intent while making the explanation comprehensive. Return only the expanded role description."
	},
}

export default class PureChatLLM extends Plugin {
	settings: PureChatLLMSettings;

	async onload() {
		await this.loadSettings();

		// Add icon to the ribbon
		this.addRibbonIcon('send', 'Pure Chat LLM', this.handleRibbonClick.bind(this))
			.addClass('my-plugin-ribbon-class');
		this.addRibbonIcon('wand', 'Pure Chat LLM menu', this.handleRibbonMenuClick.bind(this))
			.addClass('my-plugin-ribbon-class');

		// Add command for completing chat response
		this.addCommand({
			id: 'complete-chat-response',
			name: 'Complete chat response',
			editorCallback: this.CompleteChatResponse.bind(this),
		});
		// Add command for settings
		this.addCommand({
			id: 'generate-title',
			name: 'Generate title',
			editorCallback: this.GenerateTitle.bind(this),
		});
		// Add a context menu item for simplifying the selection
		this.registerEvent(this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
			this.addItemsToMenu(menu, editor, view);
		}));

		// Add settings tab
		this.addSettingTab(new PureChatLLMSettingTab(this.app, this));
	}

	addItemsToMenu(menu: Menu, editor: Editor, view: MarkdownView) {
		const selected = editor.getSelection();
		if (selected.length > 0) {
			menu.addSeparator();
			Object.entries(DEFAULT_SELECTION_TEMPLATES).forEach(([key, template]) => {
				menu.addItem((item) => {
					item
						.setTitle(`Run: ${template.name}`)
						.setIcon('wand')
						.onClick(async () => {
							const response = await this.SelectionResponse(template, selected);
							if (response) {
								editor.replaceSelection(response);
							}
						});
				});
			});
			menu.addSeparator();
		}
		Object.entries(DEFAULT_PROCESS_CHAT_TEMPLATES).forEach(([key, template]) => {
			menu.addItem((item) => {
				item
					.setTitle(`Run: ${template.name}, on the chat.`)
					.setIcon('wand')
					.onClick(async () => {
						const response = await this.ProcessChatWithTemplate(template, editor.getValue());
						if (response) {
							editor.replaceSelection(response);
						}
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
	}
	handleRibbonClick(event: MouseEvent) {
		// check if its a right click
		const editor = this.app.workspace.activeEditor?.editor;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (editor && view) {
			this.CompleteChatResponse(editor, view);
		}
	}

	handleRibbonMenuClick(event: MouseEvent) {
		const editor = this.app.workspace.activeEditor?.editor;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (editor && view) {
			const menu = new Menu();
			this.addItemsToMenu(menu, editor, view);
			menu.showAtMouseEvent(event);
		}
	}

	GenerateTitle(editor: Editor, view: MarkdownView) {
		const ActiveFile = this.app.workspace.getActiveFile();
		if (ActiveFile) {
			let parts = editor.getValue().split(/^# role: (?=system|user|assistant|developer)/im);
			const chat = parts.slice(1).map((text) => `# role: ${text.trim()}`).join("\n");
			this.ProcessChatWithTemplate(DEFAULT_PROCESS_CHAT_TEMPLATES["titleGenerate"], chat)
				.then((title) => {
					const sanitizedTitle = `${ActiveFile.parent?.path}/${title.replace(/[^a-zA-Z0-9 ]/g, '').trim()}.${ActiveFile.extension}`;
					this.app.fileManager.renameFile(ActiveFile, sanitizedTitle);
					new Notice(`File renamed to: ${sanitizedTitle}`);
				})
		} else {
			new Notice('No active file to rename.');
			return;
		}
	}

	ProcessChatWithTemplate(templatePrompt: PureChatLLMTemplate, chat: string) {
		console.log('FullChatOuterPerspectiveResponceFromTemplate', templatePrompt);
		new Notice('Generating chat response from template...');
		return this.sendChatRequest({
			model: this.settings.Model,
			messages: [
				{ role: 'system', content: `You are a ${templatePrompt.name}.` },
				{ role: 'user', content: `<Conversation>\n${chat}\n\n</Conversation>` },
				{ role: 'user', content: templatePrompt.template }],
			max_tokens: 4000
		})
	}

	getChatContent(editor: Editor) {
		let parts = editor.getValue().split(/^# role: (?=system|user|assistant|developer)/im);
		const chat = parts.slice(1).map((text) => `# role: ${text.trim()}`).join("\n");
		return chat;
	}

	SelectionResponse(templatePrompt: PureChatLLMTemplate, selectedText: string) {
		if (selectedText.length > 0) {
			new Notice('Generating response for selection...');
			return this.sendChatRequest({
				model: this.settings.Model,
				messages: [
					{ role: 'system', content: `You are a ${templatePrompt.name}.` },
					{ role: 'user', content: `<Selection>\n${selectedText}\n\n</Selection>` },
					{ role: 'user', content: templatePrompt.template }],
				max_tokens: 4000
			})
		}
	}

	CompleteChatResponse(editor: Editor, view: MarkdownView) {
		new Notice('Completing chat response...');

		const defaultOptions = { model: this.settings.Model, max_tokens: 1000 };
		const fullText = editor.getValue();
		let parts = fullText.split(/^# role: (?=system|user|assistant|developer)/im);

		if (parts.length === 1) {
			parts = [`\`\`\`json\n{}\n\`\`\``, `user\n${parts[0]}`];
		}

		let options = this.parseJsonCodeBlock(parts[0], defaultOptions);

		options.messages = this.buildMessages(parts.slice(1));

		if (options.messages[0].role !== 'system') {
			options.messages.unshift({ role: 'system', content: 'You are a helpful assistant.' });
		}

		this.sendChatRequest(options)
			.then(content => this.updateEditorContent(editor, parts, options, content))
			.catch(error => console.error(error));
	}

	parseJsonCodeBlock(text: string, defaults: any) {
		try {
			return Object.assign({}, defaults, JSON.parse(this.extractCodeBlockMD(text, 'json')));
		} catch {
			return defaults;
		}
	}

	buildMessages(parts: string[]) {
		return parts.map(text => {
			const [role, ...content] = text.split(/\n/);
			return { role: role.toLowerCase(), content: content.join("\n").trim() };
		});
	}

	sendChatRequest(options: any) {
		return fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.settings.apiKey.trim()}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(options)
		})
			.then(res => res.ok ? res.json() : Promise.reject(`Network error: ${res.statusText}`))
			.then(data => data.choices[0].message.content);
	}

	updateEditorContent(editor: Editor, parts: string[], options: any, content: string) {
		const fullChat = [...options.messages, { role: "assistant", content }, { role: "user", content: "" }];
		const pretext = this.changeCodeBlockMD(parts[0], 'json', JSON.stringify({ ...options, messages: undefined }, null, 2)).trim();
		const fullChatinMarkdown = fullChat.map(({ role, content }) => `# role: ${role}\n${content}`).join("\n");

		editor.setValue(`${pretext}\n${fullChatinMarkdown}`);
		editor.setCursor(editor.lineCount(), 0);
		editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() });
		new Notice('Chat response completed!');
		const activeFile = this.app.workspace.getActiveFile();
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (
			this.settings.AutogenerateTitle > 0 &&
			parts.length >= this.settings.AutogenerateTitle &&
			activeFile?.name.includes('Untitled') &&
			view
		) {
			this.GenerateTitle(editor, view);
		}
	}

	extractCodeBlockMD(text: string, language: string) {
		const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
		const match = text.match(regex);
		return match ? match[1] : '';
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

	onunload() { }
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

		new Setting(containerEl)
			.setName('Api key')
			.setDesc('Api key for OpenAI')
			.addText(text => text
				.setPlaceholder('sk-XXXXXXXXX')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Autogenerate title')
			.setDesc('Number of responces before generateing title for the conversation, 0 to disable')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(this.plugin.settings.AutogenerateTitle.toString())
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 0) {
						this.plugin.settings.AutogenerateTitle = num;
						await this.plugin.saveSettings();
					} else {
						new Notice('Please enter a valid number.');
					}
				}));
		new Setting(containerEl)
			.setName('Default model')
			.setDesc('Default model to use for chat completions')
			.addText(text => text
				.setPlaceholder('gpt-4.1-nano')
				.setValue(this.plugin.settings.Model)
				.onChange(async (value) => {
					this.plugin.settings.Model = value;
					await this.plugin.saveSettings();
				}));
	}
}

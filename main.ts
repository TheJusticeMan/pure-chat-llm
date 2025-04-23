import { App, Editor, MarkdownView, Notice, Menu, setIcon, ItemView, WorkspaceLeaf, Modal, Plugin, PluginSettingTab, Setting, TFile, EditorPosition, EditorRange, MarkdownRenderer } from 'obsidian';

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

const PURE_CHAT_LLM_VIEW_TYPE = 'pure-chat-llm-left-pane';


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
		name: "Summarize",
		template: "Create a bullet-point summary of the provided selection.\nEach bullet point should capture a key point.\nReturn only the bullet-point summary."
	},
	simplify: {
		name: "Simplify",
		template: "Simplify the provided selection to a 6th-grade reading level (ages 11-12).\nUse simple sentences, common words, and clear explanations.\nMaintain the original key concepts.\nReturn only the simplified selection."
	},
	emojify: {
		name: "Add Emojis",
		template: "Add relevant emojis to enhance the provided selection. Follow these rules:\n1. Insert emojis at natural breaks in the text\n2. Never place two emojis next to each other\n3. Keep all original text unchanged\n4. Choose emojis that match the context and tone\nReturn only the emojified selection."
	},
	fix: {
		name: "Correct Grammar & Spelling",
		template: "Fix the grammar and spelling of the provided selection. Preserve all formatting, line breaks, and special characters. Do not add or remove any content. Return only the corrected text."
	},
	shorten: {
		name: "Concentrate",
		template: "Reduce the provided selection to half its length while preserving the following elements:\n1. Main ideas and key points\n2. Essential details\n3. Original tone and style\nReturn only the shortened selection."
	},
	expand: {
		name: "Expand",
		template: "Expand the provided selection to twice its length by:\n1. Adding relevant details and examples\n2. Elaborating on key points\n3. Maintaining the original tone and style\nReturn only the expanded selection."
	},
	expandInstructions: {
		name: "Clarify & Expand Instructions",
		template: "The provided selection contains instructions that need to be expanded and clarified. Expand these instructions so that someone new to the task fully understands what needs to be done. Use clear, detailed explanations, examples if necessary, and break down any complex points into simpler parts. Ensure the expanded instructions maintain the original meaning and provide a comprehensive understanding. Return only the expanded instructions."
	},
	expandRole: {
		name: "Clarify & Expand Role Description",
		template: "The provided selection contains a brief role description. Expand and clarify this description by explaining the responsibilities, goals, and perspective someone playing this role should adopt. Use detailed and clear language, including relevant context or examples. Maintain the original intent while making the explanation comprehensive. Return only the expanded role description."
	},
}

interface ChatMessage {
	role: string;
	content: string;
	cline: EditorRange;
}


class PureChatLLMChat {
	options: object = { model: "GPT-4.1-nano", max_tokens: 1000 };
	messages: ChatMessage[];

	constructor() {
		//this.options = init.options;
		//this.messages = init.messages;
	}

	// Static factory method to create an instance from markdown
	static fromMarkdown(markdown: string): PureChatLLMChat {
		const chat = new PureChatLLMChat();
		chat.Markdown = markdown;
		return chat;
	}

	// Instance method: extract specific code block
	static extractCodeBlockMD(markdown: string, language: string): string | null {
		const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
		const match = markdown.match(regex);
		return match ? match[1] : null;
	}

	// Instance method: extract all code blocks
	static extractAllCodeBlocks(markdown: string): { language: string; code: string }[] {
		const regex = /^```(\w*)\n([\s\S]*?)\n```/gm;
		const matches: { language: string; code: string }[] = [];
		let match;
		while ((match = regex.exec(markdown)) !== null) {
			const [, language, code] = match;
			matches.push({
				language: (language || 'plaintext').trim(),
				code: code.trim()
			});
		}
		return matches;
	}

	// Instance method: resolve Obsidian links in content
	static async resolveFiles(markdown: string, activeFile: TFile, app: App): Promise<string> {
		const regex = /\[\[(.*?)\]\]/gim;
		const matches = Array.from(markdown.matchAll(regex));
		const replacements: Promise<string>[] = [];

		for (const match of matches) {
			const filename = match[1];
			const file = app.metadataCache.getFirstLinkpathDest(filename, activeFile.path);
			if (file instanceof TFile) {
				replacements.push(app.vault.read(file));
			} else {
				replacements.push(Promise.resolve(match[0]));
			}
		}

		if (replacements.length === 0) return markdown;

		const resolved = await Promise.all(replacements);
		let index = 0;
		const result = markdown.replace(regex, () => resolved[index++] || "");
		return result;
	}

	// Instance method: get chat instructions with resolved files
	async getChatGPTinstructions(
		activeFile: TFile,
		app: App,
	): Promise<{ messages: { role: string; content: string; }[]; }> {
		const resolvedMessages = await Promise.all(
			this.messages.map(async ({ role, content }) => ({
				role: role,
				content: await PureChatLLMChat.resolveFiles(content, activeFile, app),
			}))
		);

		return {
			...this.options,
			messages: resolvedMessages,
		};
	}

	// Instance method: convert chat back to markdown
	getChatText(): string {
		return this.messages
			.map(msg => `# role: ${msg.role}\n${msg.content}\n`)
			.join("");
	}

	get Markdown(): string {
		return "\n```json\n" + JSON.stringify(this.options, null, 2) + "\n```\n" + this.getChatText();
	}

	set Markdown(markdown: string) {
		let [prechat, ...chat] = markdown.split(/^# role: (?=system|user|assistant|developer)/im);
		let lengthtoHere = prechat.split("\n").length;
		if (chat.length === 0) {// if the file has no # role: system|user|assistant|developer
			this.messages = [];
			this.appendMessage({ role: "system", content: "You are a helpful assistant." });
			this.appendMessage({ role: "user", content: prechat });
			return;
		}

		this.messages = chat.map(text => {
			const [role, ...contentLines] = text.split(/\n/);
			const cline: EditorRange = {
				from: { line: lengthtoHere, ch: 0 },
				to: { line: lengthtoHere + contentLines.length - 1, ch: 0 }
			};
			lengthtoHere += contentLines.length;
			return {
				role: role.toLowerCase().trim(),
				content: contentLines.join("\n").trim(),
				cline
			};
		});

		const optionsStr = PureChatLLMChat.extractCodeBlockMD(prechat, 'json') || "";
		this.options = PureChatLLMChat.tryJSONParse(optionsStr) || this.options;
	}

	appendMessage(message: { role: string; content: string; }) {
		this.messages.push({
			role: message.role,
			content: message.content,
			cline: {
				from: { line: 0, ch: 0 },
				to: { line: 0, ch: 0 }
			}
		});
	}

	static tryJSONParse(str: string): any {
		try {
			return JSON.parse(str);
		} catch (e) {
			return null;
		}
	}
}

export default class PureChatLLM extends Plugin {
	settings: PureChatLLMSettings;
	isresponding: boolean;

	async onload() {
		await this.loadSettings();

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
			id: 'process-menu',
			name: 'Manipulate Selection',
			icon: "wand",
			editorCallback: (e: Editor, v: MarkdownView) => this.addItemsToMenu(new Menu(), e, v).showAtPosition({ x: 0, y: 0 }),
		});
		// Add a context menu item for simplifying the selection
		this.registerEvent(this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
			this.addItemsToMenu(menu, editor, view);
		}));

		// Add settings tab
		this.addSettingTab(new PureChatLLMSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.activateView();
		})
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
			menu.addSeparator();
			Object.entries(DEFAULT_SELECTION_TEMPLATES).forEach(([key, template]) => {
				menu.addItem((item) => {
					item
						.setTitle(template.name)
						.setIcon('wand')
						.onClick(async () => {
							const response = await this.SelectionResponse(template, selected);
							if (response) {
								editor.replaceSelection(response.content);
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
							editor.replaceSelection(response.content);
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
		return menu;
	}

	GenerateTitle(editor: Editor, view: MarkdownView) {
		const defaultOptions = { model: this.settings.Model, max_tokens: 1000 };

		const ActiveFile = this.app.workspace.getActiveFile();
		if (ActiveFile) {
			let chat = PureChatLLMChat.fromMarkdown(editor.getValue());
			this.ProcessChatWithTemplate(DEFAULT_PROCESS_CHAT_TEMPLATES["titleGenerate"], chat.getChatText())
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

	ProcessChatWithTemplate(templatePrompt: PureChatLLMTemplate, chat: string) {
		const systemprompt = `You are working with a markdown chat between a human and AI. The conversation is inside <Conversation> tags, and a command follows after.

Your task:
1. Extract the chat from <Conversation> tags.
2. Read the command that comes after the chat.
3. Do what the command says—like summarize, clarify, or modify the chat.
4. Only send back the final chat content in markdown, without tags or the command.

Always follow this to process the chat based on the instruction.`;
		//const systemprompt = `You are a ${templatePrompt.name}.`;
		new Notice('Generating chat response from template...');
		return this.sendChatRequest({
			model: this.settings.Model,
			messages: [
				{ role: 'system', content: systemprompt },
				{ role: 'user', content: `<Conversation>\n${chat}\n\n</Conversation>` },
				{ role: 'user', content: templatePrompt.template }],
			max_tokens: 4000
		})
	}

	SelectionResponse(templatePrompt: PureChatLLMTemplate, selectedText: string) {
		const systemprompt = `You are a markdown content processor. 

You will receive:
- A selected piece of markdown text inside <Selection> and </Selection> tags.
- A command or instruction immediately after the selection.

Your job:
1. Extract the markdown inside the <Selection> tags.
2. Follow the command to process or expand that markdown.
3. Return only the processed markdown content, without tags or instructions.

Use this workflow to help modify markdown content accurately.`;
		//const systemprompt = `You are a ${templatePrompt.name}.`;
		if (selectedText.length > 0) {
			new Notice('Generating response for selection...');
			return this.sendChatRequest({
				model: this.settings.Model,
				messages: [
					{ role: 'system', content: systemprompt },
					{ role: 'user', content: `<Selection>\n${selectedText}\n\n</Selection>` },
					{ role: 'user', content: templatePrompt.template }],
				max_tokens: 4000
			})
		}
	}

	CompleteChatResponse(editor: Editor, view: MarkdownView) {
		this.isresponding = true;
		new Notice('Completing chat response...');

		const defaultOptions = { model: this.settings.Model, max_tokens: 1000 };
		const chat = new PureChatLLMChat();
		chat.options = defaultOptions;
		chat.Markdown = editor.getValue();
		console.log(chat);
		// put the cursor at the end of the file.
		editor.setCursor(editor.lastLine(), editor.getLine(editor.lastLine()).length);
		editor.replaceSelection("\n# role: assistant...\n")

		if (chat.messages[0].role !== 'system') {
			chat.messages.unshift({ role: 'system', content: 'You are a helpful assistant.', cline: { from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } } });
		}
		const file = this.app.workspace.getActiveFile()
		if (!file) return;
		const options = chat.getChatGPTinstructions(file, this.app)
			.then(options => this.sendChatRequest(options, (e) => {
				editor.replaceSelection(e.content);
				editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() })
				return true;
			}))
			.then(content => this.updateEditorContent(editor, chat, content))
			.catch(error => console.error(error))
			.finally(() => {
				this.isresponding = false;
			})
	}

	/**
	 * Sends a chat request to the OpenAI API and returns the response.
	 * Supports streaming responses if a streamcallback is provided.
	 * 
	 * Note: Requires a browser or environment that supports ReadableStream.
	 * In Node.js, you'll need to adapt using the 'node-fetch' package with stream support.
	 *
	 * @param {Object} options - The options object containing the request payload.
	 *   This should include properties such as model, messages, temperature, etc.,
	 *   as specified by the OpenAI API documentation.
	 * @param {(textFragment: Object) => boolean} [streamcallback] - Optional callback function
	 *   to handle text fragments received during streaming responses. The callback receives
	 *   a text fragment object and should return a boolean indicating whether to continue 
	 *   processing.
	 * 
	 * @returns {Promise<Object>} - A promise that resolves to the message object
	 *   from the first choice in the API response, or null if streaming.
	 * 
	 * @throws {Error} - If the network response is not successful, the promise is rejected
	 *   with an error message.
	 */
	async sendChatRequest(options: any, streamcallback?: (textFragment: any) => boolean): Promise<any> {
		//console.log("Initiating fetch request to OpenAI API...");
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.settings.apiKey.trim()}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ ...options, stream: options.stream && !!streamcallback }) // Add stream flag if callback provided
		});
		//console.log(`Received response with status: ${response.status} (${response.statusText})`);

		if (!response.ok) {
			console.error(`Network error: ${response.statusText}`);
			throw new Error(`Network error: ${response.statusText}`);
		}

		// If a streamcallback is provided, handle streaming
		if (options.stream && !!streamcallback) {
			//console.log("Streaming response detected. Starting to process stream...");
			if (!response.body) {
				throw new Error("Response body is null. Streaming is not supported in this environment.");
			}
			const reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let done = false;
			let buffer = "";
			let fullText = "";

			while (!done) {
				const { value, done: streamDone } = await reader.read();
				if (streamDone) {
					//console.log("Stream has ended.");
					break;
				}
				buffer += decoder.decode(value, { stream: true });

				// The OpenAI streaming format sends data in chunks prefixed with "data: "
				let lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmedLine = line.trim();
					if (trimmedLine.startsWith("data: ")) {
						const dataStr = trimmedLine.replace(/^data:\s*/, '');
						if (dataStr === "[DONE]") {
							//console.log("Received [DONE] signal. Ending stream processing.");
							done = true;
							break;
						}
						try {
							const data = JSON.parse(dataStr);
							const delta = data.choices[0].delta;
							if (delta.content) {
								fullText += delta.content;
								// Call the callback with the new fragment
								const continueProcessing = streamcallback(delta);
								if (!continueProcessing) {
									//console.log("Callback requested to stop processing stream.");
									done = true;
									break;
								}
							}
						} catch (err) {
							console.error("Error parsing stream data:", err);
						}
					}
				}
			}

			//console.log("Finished processing streaming response.");
			return { role: "assistant", content: fullText }; // Since this is streaming, return result
		} else {
			// Non-streaming response; parse JSON and return the first message
			const data = await response.json();
			//console.log("Received complete response:", data);
			return data.choices[0].message;
		}
	}
	updateEditorContent(editor: Editor, options: PureChatLLMChat, content: any) {
		const cline: EditorRange = { from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } };
		options.appendMessage(content);
		options.appendMessage({ role: "user", content: "" });

		editor.setValue(options.Markdown);
		editor.setCursor(editor.lineCount(), 0);
		editor.scrollIntoView({ from: editor.getCursor(), to: editor.getCursor() });
		new Notice('Chat response completed!');
		const activeFile = this.app.workspace.getActiveFile();
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (
			this.settings.AutogenerateTitle > 0 &&
			options.messages.length >= this.settings.AutogenerateTitle &&
			activeFile?.name.includes('Untitled') &&
			view
		) {
			this.GenerateTitle(editor, view);
		}
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

class PureChatLLMSideView extends ItemView {
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
		this.registerEvent(this.app.workspace.on("file-open", this.update.bind(this)));
		this.registerEvent(this.app.workspace.on("active-leaf-change", this.update.bind(this)));
		this.registerEvent(this.app.workspace.on("editor-change", this.update.bind(this)));
	}


	update() {
		/* if (Date.now() - this.speedofUpdate < 20) {// optional speedup not working
			this.speedofUpdate = Date.now();
			window.setTimeout(() => this.update(), 20);
			return;
		} */
		if (this.plugin.isresponding) return;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = view?.editor;
		if (!editor) return;
		if (!view) return;

		const editorValue = editor.getValue();
		const chat = PureChatLLMChat.fromMarkdown(editorValue)

		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("PURE", "case");
		container.createDiv({ text: "" }, (el) => {
			//el.createDiv
			el.createEl('button', "", (btn) => {
				btn.onClickEvent(() => {
					const vl = el.querySelector("input")?.value;
					if (!vl) return;
					editor.replaceRange(vl, { line: editor.lastLine(), ch: 0 });
					this.plugin.CompleteChatResponse(editor, view)
				});
				setIcon(btn, "send");
				el.createEl('textarea', { type: "text", placeholder: "send to GPT...", }, (ipt) => {
					ipt.onkeydown = (e) => {
						if (e.shiftKey && e.key === "Enter") {
							editor.replaceRange(ipt.value + "\n", { line: editor.lastLine(), ch: 0 });
							this.plugin.CompleteChatResponse(editor, view);
						}
					}
				})
			})
			el.addClass("PURE", "floatbottom")
			//el.createEl('span', { text: `Speed of update: ${this.speedofUpdate}ms` });
		});
		container.createDiv({ text: "" }, (el) => {
			// json editor for chat options
			el.addClass("PURE", "floattop");
		});

		// Process markdown messages
		const messages = PureChatLLMChat.fromMarkdown(editorValue).messages;
		messages.forEach((message) => {
			const preview = message.content.substring(0, 200) + (message.content.length > 200 ? "\n... " : "");

			// Role header with clickable position jump
			container.createEl('h1', { text: message.role + " " }, (el) => {
				el.onClickEvent(() => this.goToPostion(editor, message.cline));
				el.addClass("PURE", "is-clickable");

				// Buttons to copy code blocks
			});
			// Preview of message content with copy button
			if (preview)
				container.createEl('div', "", (div) => {
					div.createDiv({ text: "" }, (el) => {
						div.onClickEvent(() => this.goToPostion(editor, message.cline, true));
						div.addClass("PURE", "is-clickable", "markdown");
						MarkdownRenderer.render(this.app, preview, el, view.file?.basename || "", this)
						/* div.createEl("button", { text: "copy" }, (btn) => {
							btn.onClickEvent(() => navigator.clipboard.writeText(message.content));
						}); */
						el.createEl("span", { text: "delete" }, (btn) => {
							btn.onClickEvent(() => editor.replaceRange("", message.cline.from, message.cline.to));
							setIcon(btn, "delete");
							btn.addClass("PURE", "icn");
						})
						el.createEl("span", { text: "copy" }, (btn) => {
							btn.onClickEvent(() => navigator.clipboard.writeText(message.content));
							setIcon(btn, "copy");
							btn.addClass("PURE", "icn");
						})
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

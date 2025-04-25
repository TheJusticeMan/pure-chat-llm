import { App, EditorRange, Notice, TFile } from 'obsidian';
import { codelanguage } from './codelanguages';
import PureChatLLM from './main';
import { toSentanceCase } from './toSentanceCase';
import { ChatMessage, PureChatLLMInstructPrompt } from './types';
import { BrowserConsole } from './MyBrowserConsole';
import OpenAI from "openai";

export interface codeContent {
	language: codelanguage;
	code: string;
}

/**
 * Represents a chat session for the Pure Chat LLM Obsidian plugin.
 * 
 * Handles chat message management, markdown serialization/deserialization, 
 * OpenAI API communication, and integration with Obsidian files and templates.
 * 
 * @remarks
 * - Supports parsing and formatting chat conversations in markdown.
 * - Can resolve Obsidian file links within chat messages.
 * - Provides methods for sending chat requests to the OpenAI API, including streaming support.
 * - Integrates with prompt templates for advanced chat processing and selection-based responses.
 * 
 * @example
 * ```typescript
 * const chat = new PureChatLLMChat(pluginInstance);
 * chat.appendMessage({ role: "user", content: "Hello!" });
 * await chat.CompleteChatResponse(activeFile);
 * ```
 * 
 * @public
 */
export class PureChatLLMChat {
	options: object = { model: "gpt-4.1-nano", max_tokens: 1000 };
	messages: ChatMessage[];
	plugin: PureChatLLM;
	console: BrowserConsole;

	constructor(plugin: PureChatLLM) {
		this.plugin = plugin;
		this.console = new BrowserConsole(plugin.settings.debug, "PureChatLLMChat");
	}

	get Markdown(): string {
		return "\n```json\n" + JSON.stringify(this.options, null, 2) + "\n```\n" + this.getChatText();
	}

	set Markdown(markdown: string) {
		let [prechat, ...chat] = markdown.split(/^# role: (?=system|user|assistant|developer)/im);
		let lengthtoHere = prechat.split("\n").length;
		if (chat.length === 0) { // if the file has no # role: system|user|assistant|developer
			this.messages = [];
			this.appendMessage({ role: "system", content: this.plugin.settings.SystemPrompt });
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

	setMarkdown(markdown: string) {// make this chainable
		this.Markdown = markdown;
		return this;
	}

	static isChat(markdown: string): boolean {
		return (/^# role: (system|user|assistant|developer)/im).test(markdown);
	}

	isChat(): boolean {
		return this.messages[0].content !== this.plugin.settings.SystemPrompt;
	}

	// Instance method: extract specific code block
	static extractCodeBlockMD(markdown: string, language: codelanguage): string | null {
		const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
		const match = markdown.match(regex);
		return match ? match[1] : null;
	}

	// Instance method: extract all code blocks
	static extractAllCodeBlocks(markdown: string): codeContent[] {
		const regex = /^```(\w*)\n([\s\S]*?)\n```/gm;
		const matches: { language: codelanguage; code: string; }[] = [];
		let match;
		while ((match = regex.exec(markdown)) !== null) {
			const [, language, code] = match;
			const lang = (language || 'plaintext').trim() as codelanguage || 'plaintext';
			matches.push({
				language: lang,
				code: code.trim()
			});
		}
		return matches;
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


	// Instance method: resolve Obsidian links in content
	static async resolveFiles(markdown: string, activeFile: TFile, app: App): Promise<string> {
		const regex = /^\!?\[\[(.*?)\]\]$/gim;
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
		app: App
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

	/**
	 * Processes a chat conversation using a specified template prompt.
	 *
	 * This method constructs a system prompt instructing the chat model to:
	 * 1. Extract the chat content enclosed within `<Conversation>` tags.
	 * 2. Follow a command or instruction provided after the conversation.
	 * 3. Return the processed chat in markdown format, omitting any tags or instructions.
	 *
	 * The method then sends a chat request to the model with the constructed prompts and user input.
	 *
	 * @param templatePrompt - The template prompt containing the instruction and template name to guide the chat processing.
	 * @returns A Promise resolving to the processed chat response from the model.
	 */
	ProcessChatWithTemplate(templatePrompt: PureChatLLMInstructPrompt) {
		const systemprompt =
			`You are a markdown chat processor.

You will receive:
- A chat conversation enclosed within <Conversation> and </Conversation> tags.
- A command or instruction immediately after the conversation.

Your task:
1. Extract the chat content inside the <Conversation> tags.
2. Follow the command to process, summarize, clarify, or modify the chat.
3. Return only the final processed chat in markdown format, without any tags or instructions.

Use this workflow to accurately handle the chat based on the instruction.`;
		//const systemprompt = `You are a ${templatePrompt.name}.`;
		new Notice('Generating chat response from template...');
		return this.sendChatRequest({
			model: this.plugin.settings.Model,
			messages: [
				{ role: 'system', content: systemprompt },
				{ role: 'user', content: `<Conversation>\n${this.getChatText()}\n\n</Conversation>` },
				{ role: 'user', content: templatePrompt.template }],
			max_tokens: 4000
		})
	}

	/**
	 * Processes a selected piece of markdown text using a specified instruction prompt.
	 *
	 * This method constructs a system prompt to guide a markdown content processor,
	 * then sends a chat request to an LLM model with the selected markdown and the
	 * provided instruction. The LLM is expected to extract the markdown within
	 * <Selection> tags, apply the instruction, and return only the processed markdown.
	 *
	 * @param templatePrompt - The instruction prompt containing the name and template for processing.
	 * @param selectedText - The markdown text selected by the user to be processed.
	 * @returns A Promise resolving to the LLM's response containing the processed markdown,
	 *          or an empty response if no text is selected.
	 */
	SelectionResponse(templatePrompt: PureChatLLMInstructPrompt, selectedText: string) {
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
				model: this.plugin.settings.Model,
				messages: [
					{ role: 'system', content: systemprompt },
					{ role: 'user', content: `<Selection>\n${selectedText}\n\n</Selection>` },
					{ role: 'user', content: templatePrompt.template }],
				max_tokens: 4000
			});
		}
		return Promise.resolve({ role: "assistant", content: "" });
	}


	CompleteChatResponse(file: TFile, streamcallback?: (textFragment: any) => boolean): Promise<this> {
		return this.getChatGPTinstructions(file, this.plugin.app)
			.then(options => this.sendChatRequest(options, streamcallback))
			.then(content => {
				this.appendMessage(content);
				this.appendMessage({ role: "user", content: "" });
				return this;
			})
			.catch(error => {
				this.plugin.console.error(`Error in chat completion:`, error);
				return this;
			});
	}

	async sendChatRequestV2(options: any, streamcallback?: (textFragment: any) => boolean) {
		const openai = new OpenAI();
	}

	async sendChatRequest(options: any, streamcallback?: (textFragment: any) => boolean) {
		//const openai = new OpenAI({ apiKey: this.plugin.settings.apiKey.trim() });

		//console.log("Initiating fetch request to OpenAI API...");
		this.plugin.console.log(`Sending chat request with options: `, options);
		this.console.log("Sending chat request with options:", options);
		this.console.log("Using API key:", this.plugin.settings.apiKey.trim());
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.plugin.settings.apiKey.trim()}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ ...options, stream: options.stream && !!streamcallback }) // Add stream flag if callback provided
		});
		//console.log(`Received response with status: ${response.status} (${response.statusText})`);

		if (!response.ok) {
			this.console.error(`Network error: ${response.statusText}`);
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
							this.console.error("Error parsing stream data:", err);
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

	// Instance method: convert chat back to markdown
	getChatText(): string {
		return this.messages
			.map(msg => `# role: ${toSentanceCase(msg.role)}\n${msg.content}\n`)
			.join("");
	}

	static tryJSONParse(str: string): any {
		try {
			return JSON.parse(str);
		} catch (e) {
			return null;
		}
	}
}

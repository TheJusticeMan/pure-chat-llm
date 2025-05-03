import { EditorRange } from "obsidian";
export interface PureChatLLMSettings {
	AutogenerateTitle: number;
	SystemPrompt: string;
	debug: boolean;
	endpoint: number;
	endpoints: PureChatLLMAPI[];
	chatParser: number;
}
export const DEFAULT_SETTINGS: PureChatLLMSettings = {
	AutogenerateTitle: 4,
	SystemPrompt: `You are ChatGPT, a large language model trained by OpenAI. Carefully heed the user's instructions. Respond using Markdown.\n\nBe attentive, thoughtful, and precise—provide clear, well-structured answers that honor the complexity of each query. Avoid generic responses; instead, offer insights that encourage creativity, reflection, and learning. Employ subtle, dry humor or depth when appropriate. Respect the user’s individuality and values, adapting your tone and approach as needed to foster a conversational, meaningful, and genuinely supportive exchange.`,
	debug: false,
	endpoint: 0,
	endpoints: [],
	chatParser: 0,
};

export interface PureChatLLMAPI {
	name: string;
	apiKey: string;
	endpoint: string;
	defaultmodel: string;
	listmodels: string;
	getapiKey: string;
}

interface ChatParser {
	name: string;
	description: string;
	SplitMessages: RegExp;
	getRole: RegExp;
	rolePlacement: string;
	isChat?: RegExp;
}

export const chatParser: ChatParser[] = [
	{
		name: "SimpleMarkdownHeader",
		description: "Simple markdown header parser",
		SplitMessages: /^# role: (?=system|user|assistant|developer)/im,
		getRole: /^(system|user|assistant|developer)[^\n]+\n/i,
		rolePlacement: "# role: {role}",
		isChat: /^# role: (system|user|assistant|developer)/i,
	},
	{
		name: "NoteMarkdownHeader",
		description: "Note markdown header parser",
		SplitMessages:
			/^\n> \[!note\] \w+\n> # role: (?=system|user|assistant|developer)/im,
		getRole: /^(system|user|assistant|developer)[^\n]+\n/i,
		rolePlacement: "\n> [!note] {role}\n> # role: {role}\n",
		isChat: /^> \[!note\] \w+\n> # role: (system|user|assistant|developer)/i,
	},
];

export const EmptyApiKey = "sk-XXXXXXXXX";

export const ENDPOINTS: PureChatLLMAPI[] = [
	{
		name: "OpenAI",
		apiKey: EmptyApiKey,
		defaultmodel: "gpt-4.1-nano",
		endpoint: "https://api.openai.com/v1/chat/completions",
		listmodels: "https://api.openai.com/v1/models",
		getapiKey: "https://platform.openai.com/api-keys",
	},
	{
		name: "Gemini",
		apiKey: EmptyApiKey,
		defaultmodel: "gemini-2.0-flash-lite",
		endpoint:
			"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
		listmodels:
			"https://generativelanguage.googleapis.com/v1beta/openai/models",
		getapiKey: "https://aistudio.google.com/apikey",
	},
	{
		name: "xAI",
		apiKey: EmptyApiKey,
		defaultmodel: "grok-3-mini",
		endpoint: "https://api.x.ai/v1/chat/completions",
		listmodels: "https://api.x.ai/v1/models",
		getapiKey: "https://console.x.ai",
	},
	{
		name: "Anthropic",
		apiKey: EmptyApiKey,
		defaultmodel: "claude-3-7-sonnet-20250219",
		endpoint: "https://api.anthropic.com/v1/messages",
		listmodels: "https://api.anthropic.com/v1/models",
		getapiKey: "https://console.anthropic.com/settings/keys",
	},
	{
		name: "Cohere",
		apiKey: EmptyApiKey,
		defaultmodel: "command",
		endpoint: "https://api.cohere.ai/v1/generate",
		listmodels: "https://api.cohere.ai/v1/models",
		getapiKey: "https://dashboard.cohere.com/api-keys",
	},
	{
		name: "Mistral AI",
		apiKey: EmptyApiKey,
		defaultmodel: "mixtral-8x7b",
		endpoint: "https://api.mistral.ai/v1/chat/completions",
		listmodels: "https://api.mistral.ai/v1/models",
		getapiKey: "https://console.mistral.ai/api-keys",
	},
	{
		name: "DeepSeek",
		apiKey: EmptyApiKey,
		defaultmodel: "deepseek-llm",
		endpoint: "https://api.deepseek.com/v1/chat/completions",
		listmodels: "https://api.deepseek.com/v1/models",
		getapiKey: "https://platform.deepseek.com/api_keys",
	},
];

/**
 * Represents a collection of instruct prompts for PureChat LLM,
 * where each prompt is identified by a unique string key.
 *
 * @remarks
 * The keys are typically descriptive names or identifiers for each instruct prompt.
 * The values are of type {@link PureChatLLMInstructPrompt}.
 *
 * @example
 * ```typescript
 * const prompts: PureChatLLMInstructPrompts = {
 *   "summarize": { /* prompt details *\/ },
 *   "translate": { /* prompt details *\/ }
 * };
 * ```
 */
export interface PureChatLLMInstructPrompts {
	[key: string]: PureChatLLMInstructPrompt;
}

/**
 * Represents an instruction prompt for the Pure Chat LLM plugin.
 *
 * @property name - The unique name identifying the prompt.
 * @property template - The template string used for the prompt's content.
 */
export interface PureChatLLMInstructPrompt {
	name: string;
	template: string;
}

export type RoleType = "system" | "user" | "assistant" | "developer";

export interface ChatMessage {
	role: RoleType;
	content: string;
	cline: EditorRange;
}

export const PURE_CHAT_LLM_VIEW_TYPE = "pure-chat-llm-left-pane";

export const DEFAULT_PROCESS_CHAT_TEMPLATES: PureChatLLMInstructPrompts = {
	"Conversation titler": {
		name: "Conversation titler",
		template: `Summarize the conversation in 5 words or fewer:

Be as concise as possible without losing the context of the conversation.

Your goal is to extract the key point of the conversation.`,
	},
	"Conversation analizer": {
		name: "Conversation analizer",
		template: `Analyze the conversation.

The role's are the \`user\` chatting with the \`assistant\` on the \`system\`.
- The roles include the \`user\`, the \`assistant\`, and the \`system\` (instructions).
The \`# role: system\` is the instructions to the \`system\`. In other words it's the system prompt.

Write a better system prompt based on what the user was trying to use the system for.

Write another prompt by condensing all the user requests into one to get the final assistant response with just one user message.
`,
	},
};

export const DEFAULT_SELECTION_TEMPLATES: PureChatLLMInstructPrompts = {
	Summarize: {
		name: "Summarize",
		template:
			"Create a bullet-point summary of the provided selection.\nEach bullet point should capture a key point.\nReturn only the bullet-point summary.",
	},
	Simplify: {
		name: "Simplify",
		template:
			"Simplify the provided selection to a 6th-grade reading level (ages 11-12).\nUse simple sentences, common words, and clear explanations.\nMaintain the original key concepts.\nReturn only the simplified selection.",
	},
	"Add Emojis": {
		name: "Add Emojis",
		template:
			"Add relevant emojis to enhance the provided selection. Follow these rules:\n1. Insert emojis at natural breaks in the text\n2. Never place two emojis next to each other\n3. Keep all original text unchanged\n4. Choose emojis that match the context and tone\nReturn only the emojified selection.",
	},
	"Correct Grammar & Spelling": {
		name: "Correct Grammar & Spelling",
		template:
			"Fix the grammar and spelling of the provided selection. Preserve all formatting, line breaks, and special characters. Do not add or remove any content. Return only the corrected text.",
	},
	Concentrate: {
		name: "Concentrate",
		template:
			"Reduce the provided selection to half its length while preserving the following elements:\n1. Main ideas and key points\n2. Essential details\n3. Original tone and style\nReturn only the shortened selection.",
	},
	Expand: {
		name: "Expand",
		template:
			"Expand the provided selection to twice its length by:\n1. Adding relevant details and examples\n2. Elaborating on key points\n3. Maintaining the original tone and style\nReturn only the expanded selection.",
	},
	"Clarify & Expand Instructions": {
		name: "Clarify & Expand Instructions",
		template:
			"The provided selection contains instructions that need to be expanded and clarified. Expand these instructions so that someone new to the task fully understands what needs to be done. Use clear, detailed explanations, examples if necessary, and break down any complex points into simpler parts. Ensure the expanded instructions maintain the original meaning and provide a comprehensive understanding. Return only the expanded instructions.",
	},
	"Clarify & Expand Role Description": {
		name: "Clarify & Expand Role Description",
		template:
			"The provided selection contains a brief role description. Expand and clarify this description by explaining the responsibilities, goals, and perspective someone playing this role should adopt. Use detailed and clear language, including relevant context or examples. Maintain the original intent while making the explanation comprehensive. Return only the expanded role description.",
	},
};

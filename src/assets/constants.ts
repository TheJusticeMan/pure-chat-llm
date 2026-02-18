import { PureChatLLMSettings } from 'src/types';
import { version } from '../../package.json';

// import { readme, splash } from '../assets/s.json';

export const EmptyApiKey = 'sk-XXXXXXXXX';

const selectionTemplates = {
  'Add emojis':
    'Insert relevant emojis into the `<Selection>` at natural breaks to enhance context and tone. Ensure no two emojis are adjacent and keep all original text unchanged. Return only the emojified selection.',
  'Auto complete 5 suggestions':
    'Generate five distinct, numbered suggestions to complete the provided `<Selection>`. Ensure they vary in style (formal, casual, creative) while maintaining context and flow. Suggestions should be actionable and roughly the same length as the original. Return only the numbered list (1-5).',
  'Change "me" to "you" and vice versa':
    'Rewrite the `<Selection>` by swapping perspectives: change first-person pronouns ("I", "my") to second-person ("you", "your") and vice versa. Adjust grammar to maintain meaning and tone. Return only the rewritten selection.',
  'Concentrate: Half-Length':
    'Reduce the `<Selection>` to approximately half its word count. Preserve main ideas, key points, and tone while removing redundancy and unnecessary elaboration. Return only the shortened text.',
  'Concentrate: Paragraph':
    'Condense the `<Selection>` into a single, cohesive paragraph. Retain main ideas and logical flow, removing unnecessary details. Maintain the original tone. Return only the condensed paragraph.',
  'Convert talk into actions':
    'Convert the `<Selection>` into a clear list of actionable steps. Rephrase key statements into concise, imperative commands (e.g., "Do this"). Maintain the original sequence and meaning. Return only the bulleted list of actions.',
  'Correct grammar & spelling':
    'Correct grammar and spelling errors in the `<Selection>`. Preserve all original formatting, special characters, and content. Do not add or remove text beyond necessary fixes. Return only the corrected text.',
  Expand:
    'Expand the `<Selection>` to 1.5-2 times its length. Elaborate on key points, add relevant examples, and explore implications while maintaining the original tone and structure. Return only the expanded text.',
  'Fill in ellipsis':
    'Replace all ellipses (...) in the `<Selection>` with logical, contextually appropriate content. Ensure additions match the original voice and flow naturally. Return only the text with ellipses filled.',
  'Format markdown':
    'Format the `<Selection>` into clean, structured Markdown. Use appropriate headings, bullet/numbered lists, and emphasis (bold/italics) to improve readability while maintaining the original meaning. Return only the formatted Markdown.',
  'Image prompt generator':
    'Generate five detailed image prompts based on the `<Selection>`. Include specific style, lighting, and composition details. Ensure diversity in perspective and tone. Return only the numbered prompts (1-5).',
  'Remove —':
    'Remove all em dashes (—) from the `<Selection>`, replacing them with appropriate punctuation (commas, periods) to maintain flow and clarity. Return only the revised text.',
  'Simplify 2.0':
    'Simplify the `<Selection>` by reducing sentence complexity and replacing jargon with common vocabulary. Clarify abstract concepts while keeping the core message accurate. Return only the simplified text.',
  'Simplify 6th-grade':
    'Simplify the `<Selection>` to a 6th-grade reading level. Use simple sentences and common words while maintaining key concepts. Return only the simplified text.',
  Summarize:
    'Create a bullet-point summary of the `<Selection>`, capturing key points in each bullet. Return only the summary.',
  Title:
    'Generate a concise, engaging title (5-10 words) for the `<Selection>`. Use title case and reflect the main theme without adding new info. Return only the title.',
  'Translate to english':
    'Translate the `<Selection>` into accurate English, maintaining original meaning, tone, and context. Return only the translated text.',
  'Write 5 ways to rephrase It':
    'Provide five distinct ways to rephrase the `<Selection>`. Vary style, tone, and structure while preserving core meaning. Ensure each version is a standalone unit. Return only the five numbered versions.',
};

export const PureChatLLMversion = version;

// export const splashScreenMD = splash;
// export const readmeMD = readme;

const chatTemplates = {
  'Analyzer pro':
    'Analyze the `<Conversation>`. Provide a brief analysis of roles and goals. Then, generate a "Better System Prompt" (rewritten for clarity/constraints) and a "Condensed User Prompt" (synthesized intent). Return output in markdown with specific headers.',
  'Conversation titler':
    'Generate a concise, engaging title (6-12 words) for the `<Conversation>` based on its themes and interactions. Use title case. Return only the title.',
  'Predict next message':
    "Predict the user's likely next message based on the `<Conversation>`. Keep it concise and relevant to the context. Return only the predicted message.",
  'Refine last user message':
    "Enhance the user's last message within the `<Conversation>` by enriching it with relevant details, context, and examples to deepen understanding and clarify its points. Simultaneously, improve clarity and structure by rephrasing for precision and polish, ensuring the original intent remains intact while increasing overall comprehensiveness and readability.",
  'Rewrite the user message that initiated this conversation':
    'Rewrite the initial user message in `<Conversation>` to be clearer and more effective. Add precise instructions and context while maintaining original goals. Return only the rewritten initial message.',
  'Upgrade system prompt':
    "Analyze the `<Conversation>` to infer or synthesize an optimized system prompt. Define the assistant's role, tone, and constraints to effectively replicate and enhance the interaction. Ensure the instructions are explicit, comprehensive, and structured for maximum effectiveness. Return only the upgraded system prompt.",
};

export const alloptions = {
  model: 'gpt-4o',
  stream: false,
  max_completion_tokens: 100,
  temperature: 1,
  top_p: 1,
  n: 1,
  stop: null,
  logit_bias: null,
  metadata: {},
  modalities: ['text'],
  tool_choice: 'none',
  tools: [],
  web_search_options: {},
};

export const Chatsysprompt =
  'You are a markdown chat processor.\n\nYou will receive:\n\n- A chat conversation enclosed within <Conversation> and </Conversation> tags.\n- A command or instruction immediately after the conversation.\n\nYour task:\n\n1. Extract the chat content inside the <Conversation> and </Conversation> tags.\n2. Follow the command to process, summarize, clarify, or modify the chat.\n3. Return only the final processed chat in markdown format, without any tags or instructions.\n\nUse this workflow to accurately handle the chat based on the instruction.';
export const Selectionsysprompt =
  'You are a markdown content processor.\n\nYou will receive:\n\n- A selected piece of markdown text inside <Selection> and </Selection> tags.\n- A command or instruction immediately after the selection.\n\nYour job:\n\n1. Extract the markdown inside the <Selection> and </Selection> tags.\n2. Follow the command to process or expand that markdown.\n3. Return only the processed markdown content, without tags or instructions.\n\nUse this workflow to help modify markdown content accurately.';

const ENDPOINTS = [
  {
    name: 'OpenAI',
    apiKey: EmptyApiKey,
    defaultmodel: 'gpt-4.1-nano',
    endpoint: 'https://api.openai.com/v1',
    getapiKey: 'https://platform.openai.com/api-keys',
  },
  {
    name: 'Gemini',
    apiKey: EmptyApiKey,
    defaultmodel: 'models/gemini-2.0-flash-lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    getapiKey: 'https://aistudio.google.com/apikey',
  },
  {
    name: 'xAI',
    apiKey: EmptyApiKey,
    defaultmodel: 'grok-3-mini',
    endpoint: 'https://api.x.ai/v1',
    getapiKey: 'https://console.x.ai',
  },
  {
    name: 'Anthropic',
    apiKey: EmptyApiKey,
    defaultmodel: 'claude-3-7-sonnet-20250219',
    endpoint: 'https://api.anthropic.com/v1',
    getapiKey: 'https://console.anthropic.com/settings/keys',
  },
  {
    name: 'Cohere',
    apiKey: EmptyApiKey,
    defaultmodel: 'command',
    endpoint: 'https://api.cohere.ai/v1',
    getapiKey: 'https://dashboard.cohere.com/api-keys',
  },
  {
    name: 'Mistral AI',
    apiKey: EmptyApiKey,
    defaultmodel: 'mixtral-8x7b',
    endpoint: 'https://api.mistral.ai/v1',
    getapiKey: 'https://console.mistral.ai/api-keys',
  },
  {
    name: 'DeepSeek',
    apiKey: EmptyApiKey,
    defaultmodel: 'deepseek-llm',
    endpoint: 'https://api.deepseek.com/v1',
    getapiKey: 'https://platform.deepseek.com/api_keys',
  },
  {
    name: 'Ollama',
    apiKey: 'ollama',
    endpoint: 'http://localhost:11434/v1',
    defaultmodel: 'qwen3:0.6b',
    getapiKey: '',
  },
  {
    name: 'Suno',
    apiKey: EmptyApiKey,
    defaultmodel: 'V4_5ALL',
    endpoint: 'https://api.sunoapi.org',
    getapiKey: 'https://sunoapi.org/api-key',
  },
];

export const DEFAULT_SETTINGS: PureChatLLMSettings = {
  AutogenerateTitle: 4,
  SystemPrompt: `You are Pure Chat LLM, a personality created by the great Justice Vellacott. You are running on a large language model. Carefully heed the user's instructions. Respond using Markdown.\n\nBe attentive, thoughtful, and precise. Provide clear, well-structured answers that honor the complexity of each query. Avoid generic responses; instead, offer insights that encourage creativity, reflection, and learning. Employ subtle, dry humor or depth when appropriate. Respect the user's individuality and values, adapting your tone and approach as needed to foster a conversational, meaningful, and genuinely supportive exchange.`,
  debug: false,
  endpoint: 0,
  endpoints: ENDPOINTS,
  defaultmaxTokens: 4096,
  messageRoleFormatter: '# role: {role}',
  selectionTemplates: selectionTemplates,
  chatTemplates: chatTemplates,
  addfiletocontext: false,
  CMDselectionTemplates: {},
  CMDchatTemplates: {},
  ModelsOnEndpoint: {},
  resolveFilesForChatAnalysis: false,
  agentMode: true,
  useYAMLFrontMatter: false,
  enabledToolClassifications: { Vault: true, UI: true, System: true, AI: true },
  maxRecursionDepth: 10,
  realtimeSystemPromptFile: '',
};

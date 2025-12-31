import { chatTemplates, EmptyApiKey, selectionTemplates } from './assets/s.json';

export const StatSett = {
  ENDPOINTS: [
    {
      name: 'OpenAI',
      apiKey: EmptyApiKey,
      defaultmodel: 'gpt-4.1-nano',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      listmodels: 'https://api.openai.com/v1/models',
      getapiKey: 'https://platform.openai.com/api-keys',
    },
    {
      name: 'Gemini',
      apiKey: EmptyApiKey,
      defaultmodel: 'models/gemini-2.0-flash-lite',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      listmodels: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
      getapiKey: 'https://aistudio.google.com/apikey',
    },
    {
      name: 'xAI',
      apiKey: EmptyApiKey,
      defaultmodel: 'grok-3-mini',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      listmodels: 'https://api.x.ai/v1/models',
      getapiKey: 'https://console.x.ai',
    },
    {
      name: 'Anthropic',
      apiKey: EmptyApiKey,
      defaultmodel: 'claude-3-7-sonnet-20250219',
      endpoint: 'https://api.anthropic.com/v1/messages',
      listmodels: 'https://api.anthropic.com/v1/models',
      getapiKey: 'https://console.anthropic.com/settings/keys',
    },
    {
      name: 'Cohere',
      apiKey: EmptyApiKey,
      defaultmodel: 'command',
      endpoint: 'https://api.cohere.ai/v1/generate',
      listmodels: 'https://api.cohere.ai/v1/models',
      getapiKey: 'https://dashboard.cohere.com/api-keys',
    },
    {
      name: 'Mistral AI',
      apiKey: EmptyApiKey,
      defaultmodel: 'mixtral-8x7b',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      listmodels: 'https://api.mistral.ai/v1/models',
      getapiKey: 'https://console.mistral.ai/api-keys',
    },
    {
      name: 'DeepSeek',
      apiKey: EmptyApiKey,
      defaultmodel: 'deepseek-llm',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      listmodels: 'https://api.deepseek.com/v1/models',
      getapiKey: 'https://platform.deepseek.com/api_keys',
    },
    {
      name: 'Ollama',
      apiKey: 'ollama',
      endpoint: 'http://localhost:11434/v1/chat/completions',
      defaultmodel: 'qwen3:0.6b',
      listmodels: 'http://localhost:11434/v1/models',
      getapiKey: '',
    },
  ],
  chatParser: [
    {
      name: 'Simple markdown header parser',
      SplitMessages: /^# role: (?=system|user|assistant|developer)/im,
      getRole: /^(system|user|assistant|developer)[^\n]+\n/i,
      rolePlacement: '# role: {role}',
      isChat: /^# role: (system|user|assistant|developer)/i,
    },
    {
      name: 'Double hash markdown header parser',
      SplitMessages: /^## role: (?=system|user|assistant|developer)/im,
      getRole: /^(system|user|assistant|developer)[^\n]+\n/i,
      rolePlacement: '\n## role: {role}\n',
      isChat: /^## role: (system|user|assistant|developer)/i,
    },
    {
      name: 'Note markdown header parser',
      SplitMessages: /^\n> \[!note\] \w+\n> # role: (?=system|user|assistant|developer)/im,
      getRole: /^(system|user|assistant|developer)[^\n]+\n/i,
      rolePlacement: '\n> [!note] {role}\n> # role: {role}\n',
      isChat: /^> \[!note\] \w+\n> # role: (system|user|assistant|developer)/i,
    },
  ],
};

export interface PureChatLLMSettings {
  AutogenerateTitle: number;
  SystemPrompt: string;
  debug: boolean;
  endpoint: number;
  endpoints: PureChatLLMAPI[];
  defaultmaxTokens: number;
  messageRoleFormatter: string;
  AutoReverseRoles: boolean;
  selectionTemplates: { [key: string]: string };
  chatTemplates: { [key: string]: string };
  addfiletocontext: boolean;
  CMDselectionTemplates: { [key: string]: boolean };
  CMDchatTemplates: { [key: string]: boolean };
  ModelsOnEndpoint: { [key: string]: string[] };
  useImageGeneration: boolean;
  resolveFilesForChatAnalysis: boolean;
  autoConcatMessagesFromSameRole: boolean;
  agentMode: boolean;
  useYAMLFrontMatter: boolean;
}

export const DEFAULT_SETTINGS: PureChatLLMSettings = {
  AutogenerateTitle: 4,
  SystemPrompt: `You are Pure Chat LLM, a personality created by the great Justice Vellacott. You are running on a large language model. Carefully heed the user's instructions. Respond using Markdown.\n\nBe attentive, thoughtful, and precise. Provide clear, well-structured answers that honor the complexity of each query. Avoid generic responses; instead, offer insights that encourage creativity, reflection, and learning. Employ subtle, dry humor or depth when appropriate. Respect the user's individuality and values, adapting your tone and approach as needed to foster a conversational, meaningful, and genuinely supportive exchange.`,
  debug: false,
  endpoint: 0,
  endpoints: StatSett.ENDPOINTS,
  defaultmaxTokens: 4096,
  messageRoleFormatter: '# role: {role}',
  AutoReverseRoles: true,
  selectionTemplates: selectionTemplates,
  chatTemplates: chatTemplates,
  addfiletocontext: false,
  CMDselectionTemplates: {},
  CMDchatTemplates: {},
  ModelsOnEndpoint: {},
  useImageGeneration: true, // Default to true for OpenAI image generation
  resolveFilesForChatAnalysis: false,
  autoConcatMessagesFromSameRole: true,
  agentMode: true,
  useYAMLFrontMatter: false,
};

export interface PureChatLLMAPI {
  name: string;
  apiKey: string;
  endpoint: string;
  defaultmodel: string;
  listmodels: string;
  getapiKey: string;
}

export interface ChatParser {
  name: string;
  SplitMessages: RegExp;
  getRole: RegExp;
  rolePlacement: string;
  isChat: RegExp;
}

export const PURE_CHAT_LLM_VIEW_TYPE = 'pure-chat-llm-left-pane';

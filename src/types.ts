import { chatTemplates, EmptyApiKey, selectionTemplates } from './assets/s.json';

export const StatSett = {
  ENDPOINTS: [
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
  enabledToolClassifications: { [key: string]: boolean };
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
  enabledToolClassifications: {
    Vault: true,
    UI: true,
    System: true,
    AI: true,
  },
};

export interface PureChatLLMAPI {
  name: string;
  apiKey: string;
  endpoint: string;
  defaultmodel: string;
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

// Tool Types
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  additionalProperties?: boolean | ToolParameter | Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface ToolDefinition {
  type: 'function';
  function: ToolFunction;
}

export type ToolClassification = 'Vault' | 'UI' | 'System' | 'AI';

// Chat Types
export interface ChatMessage {
  role: RoleType;
  content: string;
}

export type RoleType = 'system' | 'user' | 'assistant' | 'developer' | 'tool';

export interface ToolCall {
  index?: number;
  id?: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface StreamDelta {
  content?: string;
  tool_calls?: ToolCall[];
  role?: string;
}

export type MediaMessage =
  | {
      type: 'image_url';
      image_url: { url: string };
    }
  | {
      type: 'input_audio';
      input_audio: { data: string; format: 'wav' | 'mp3' };
    }
  | {
      type: 'text';
      text: string;
    };

export interface ChatResponse {
  role: RoleType;
  content?: string | null;
  tool_calls?: ToolCall[];
}

export interface ChatRequestOptions {
  model: string;
  messages: {
    role: RoleType;
    content?: string | MediaMessage[] | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    [key: string]: unknown;
  }[];
  stream?: boolean;
  max_completion_tokens?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  [key: string]: unknown;
}

export interface ChatOptions {
  model: string;
  messages: { role: RoleType; content: string }[];
  stream?: boolean;
  max_completion_tokens?: number;
  max_tokens?: number;
  tools?: string[];
}

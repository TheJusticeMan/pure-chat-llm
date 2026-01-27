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
  enabledToolClassifications: { Vault: boolean; UI: boolean; System: boolean; AI: boolean };
  blueFileResolution: {
    enabled: boolean;
    maxDepth: number;
    enableCaching: boolean;
    writeIntermediateResults: boolean;
  };
  blueResolutionViewMode?: 'tree' | 'graph';
  removeEmptyMessages: boolean;
}

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
export const VOICE_CALL_VIEW_TYPE = 'voice-call-side-view';
export const BLUE_RESOLUTION_VIEW_TYPE = 'blue-resolution-tree-view';

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

// Voice Call Types
export type CallStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CallState {
  status: CallStatus;
  isMuted: boolean;
  isLocalAudioEnabled: boolean;
  remoteParticipants: string[];
  error?: string;
}

export const PURE_CHAT_LLM_ICON_SVG = `<g
		stroke="currentColor"
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path
			stroke-width="8"
			d="m 15.354732,74.616162 a 42.5,42.5 0 0 1 2.75854,-52.713966 42.5,42.5 0 0 1 51.947897,-9.369508"
		/>
		<path stroke-width="8" d="m 31.25,42.5 h 42.5" />
		<path stroke-width="8" d="m 26.25,57.5 h 42.5" />
		<path stroke-width="8" d="M 47.5,30 30,87.5" />
		<path stroke-width="8" d="M 52.5,70 70,12.5" />
		<path stroke-width="8" d="M 30,87.5 7.5,92.5 15,75" />
		<path
			stroke-width="8"
			d="M 83.039667,23.267427 A 42.5,42.5 0 0 1 87.575737,69.857342 42.5,42.5 0 0 1 46.52797,92.357939"
		/>
	</g>`;

export const PURE_CHAT_LLM_ICON_NAME = 'pure-chat-llm';

// Blue File Resolution Types
export type ResolutionStatus =
  | 'idle'
  | 'resolving'
  | 'complete'
  | 'error'
  | 'cached'
  | 'cycle-detected';

export interface ResolutionEvent {
  type: 'start' | 'complete' | 'error' | 'cache-hit' | 'cycle-detected' | 'depth-limit';
  filePath: string;
  parentPath: string | null;
  depth: number;
  status: ResolutionStatus;
  isPendingChat: boolean;
  isChatFile?: boolean;
  error?: string;
  timestamp: number;
}

export interface ResolutionTreeData {
  rootFile: string;
  nodes: Map<string, ResolutionNodeData>;
  edges: Array<{ from: string; to: string }>;
}

export interface ResolutionNodeData {
  filePath: string;
  depth: number;
  status: ResolutionStatus;
  isPendingChat: boolean;
  isChatFile?: boolean;
  children: string[];
  error?: string;
}

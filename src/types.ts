import { selectionTemplates, chatTemplates } from "./s.json";
import { StatSett } from "./settings";

export interface PureChatLLMSettings {
  AutogenerateTitle: number;
  SystemPrompt: string;
  debug: boolean;
  endpoint: number;
  endpoints: PureChatLLMAPI[];
  chatParser: number;
  AutoReverseRoles: boolean;
  selectionTemplates: { [key: string]: string };
  chatTemplates: { [key: string]: string };
  addfiletocontext: boolean;
  CMDselectionTemplates: { [key: string]: boolean };
  CMDchatTemplates: { [key: string]: boolean };
  ModelsOnEndpoint: { [key: string]: string[] };
}

export const DEFAULT_SETTINGS: PureChatLLMSettings = {
  AutogenerateTitle: 4,
  SystemPrompt: `You are Pure Chat LLM, a personality created by the great Justice Vellacott. You are running on a large language model. Carefully heed the user's instructions. Respond using Markdown.\n\nBe attentive, thoughtful, and precise. Provide clear, well-structured answers that honor the complexity of each query. Avoid generic responses; instead, offer insights that encourage creativity, reflection, and learning. Employ subtle, dry humor or depth when appropriate. Respect the user's individuality and values, adapting your tone and approach as needed to foster a conversational, meaningful, and genuinely supportive exchange.`,
  debug: false,
  endpoint: 0,
  endpoints: StatSett.ENDPOINTS,
  chatParser: 0,
  AutoReverseRoles: true,
  selectionTemplates: selectionTemplates,
  chatTemplates: chatTemplates,
  addfiletocontext: false,
  CMDselectionTemplates: {},
  CMDchatTemplates: {},
  ModelsOnEndpoint: {},
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
  description: string;
  SplitMessages: RegExp;
  getRole: RegExp;
  rolePlacement: string;
  isChat: RegExp;
}

export const PURE_CHAT_LLM_VIEW_TYPE = "pure-chat-llm-left-pane";

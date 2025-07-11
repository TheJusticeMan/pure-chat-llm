import { EmptyApiKey } from "./s.json";

export const StatSett = {
  ENDPOINTS: [
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
      defaultmodel: "models/gemini-2.0-flash-lite",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      listmodels: "https://generativelanguage.googleapis.com/v1beta/openai/models",
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
    {
      name: "Olama",
      apiKey: "ollama",
      endpoint: "http://localhost:11434/v1/chat/completions",
      defaultmodel: "qwen3:0.6b",
      listmodels: "http://localhost:11434/v1/models",
      getapiKey: "",
    },
  ],
  chatParser: [
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
      SplitMessages: /^\n> \[!note\] \w+\n> # role: (?=system|user|assistant|developer)/im,
      getRole: /^(system|user|assistant|developer)[^\n]+\n/i,
      rolePlacement: "\n> [!note] {role}\n> # role: {role}\n",
      isChat: /^> \[!note\] \w+\n> # role: (system|user|assistant|developer)/i,
    },
  ],
};

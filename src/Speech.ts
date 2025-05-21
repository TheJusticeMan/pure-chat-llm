import { PureChatLLMChat } from "./Chat";
import PureChatLLM from "./main";
import { BrowserConsole } from "./MyBrowserConsole";

export class PureChatLLMSpeech {
  chat: PureChatLLMChat;
  plugin: PureChatLLM;
  console: BrowserConsole;
  assistantvoice = "alloy";
  uservoice = "echo";

  constructor(plugin: PureChatLLM, chat: PureChatLLMChat) {
    this.plugin = plugin;
    this.chat = chat;
    this.console = new BrowserConsole(this.plugin.settings.debug, "Speech");
  }

  // Speak the chat using OpenAI's TTS API
  async speak() {
    this.chat.messages.forEach(async (message) => {
      if (!message || !message.content) return;

      const voice = message.role === "assistant" ? this.assistantvoice : this.uservoice;

      // Replace with your OpenAI API key management
      const apiKey = this.plugin.settings.endpoints[this.plugin.settings.endpoint].apiKey;
      if (!apiKey) {
        console.error("OpenAI API key is missing.");
        return;
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: message.content,
          voice: voice,
        }),
      });

      if (!response.ok) {
        console.error("OpenAI TTS API error:", await response.text());
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    });
  }

  getVoices(): { name: string }[] {
    // OpenAI supported voices as of 2024
    return [
      { name: "alloy" },
      { name: "echo" },
      { name: "fable" },
      { name: "onyx" },
      { name: "nova" },
      { name: "shimmer" },
    ];
  }
}

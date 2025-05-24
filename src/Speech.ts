import { BrowserConsole } from "./BrowserConsole";
import { PureChatLLMChat } from "./Chat";
import PureChatLLM from "./main";

/**
 * Handles text-to-speech (TTS) functionality for chat messages using the OpenAI TTS API.
 *
 * The `PureChatLLMSpeech` class manages the conversion of chat messages into speech audio,
 * queues audio segments for sequential playback, and provides methods for both batch and streaming
 * speech synthesis. It supports splitting long messages into natural-sounding chunks, selecting
 * different voices for assistant and user roles, and error handling for API and playback issues.
 *
 * @remarks
 * - Requires a valid OpenAI API key and endpoint configuration.
 * - Designed for integration with the PureChatLLM plugin and chat message structure.
 * - Supports both batch (`speak`) and streaming (`startStreaming`) speech generation/playback.
 *
 * @example
 * ```typescript
 * const speech = new PureChatLLMSpeech(plugin, chat);
 * await speech.speak(); // Converts all chat messages to speech and plays them sequentially
 * ```
 *
 * @public
 */
export class PureChatLLMSpeech {
  chat: PureChatLLMChat;
  plugin: PureChatLLM;
  console: BrowserConsole;
  assistantvoice = "alloy";
  uservoice = "echo";
  speechQueue: { audio: HTMLAudioElement }[] = [];
  isPlaying = false; // To prevent multiple concurrent plays

  constructor(plugin: PureChatLLM, chat: PureChatLLMChat) {
    this.plugin = plugin;
    this.chat = chat;
    this.console = new BrowserConsole(this.plugin.settings.debug, "Speech");
  }

  /**
   * Enqueues a speech audio object generated from the given message using the OpenAI TTS API.
   *
   * This method selects a voice based on the message role ("assistant" or "user"),
   * retrieves the appropriate API key from plugin settings, and sends a POST request
   * to the OpenAI `/v1/audio/speech` endpoint to generate speech audio from the message content.
   * If the API key is missing or the API call fails, an error is logged.
   * On success, the resulting audio is converted to a Blob, then to an Audio object,
   * and pushed onto the speech queue for playback.
   *
   * @param message - An object containing the role ("assistant" or "user") and the content to be spoken.
   * @returns A Promise that resolves when the speech audio has been enqueued or logs an error if unsuccessful.
   */
  async enqueueSpeech(message: { role: string; content: string }) {
    const voice = message.role === "assistant" ? this.assistantvoice : this.uservoice;
    const apiKey = this.plugin.settings.endpoints[this.plugin.settings.endpoint]?.apiKey;
    if (!apiKey) {
      this.console.error("OpenAI API key is missing.");
      return;
    }
    try {
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
        this.console.error("OpenAI TTS API error:", await response.text());
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Enqueue
      this.speechQueue.push({ audio });
    } catch (err) {
      this.console.error("Error generating speech:", err);
    }
  }

  /**
   * Splits a long string message into smaller chunks, each not exceeding the specified maximum length.
   * Attempts to split at the last period ('.') or space (' ') within a threshold near the maximum length
   * to preserve natural sentence or word boundaries.
   *
   * @param content - The input string to be split into chunks.
   * @param maxLength - The maximum allowed length for each chunk. Defaults to 4096.
   * @returns An array of string chunks, each with a length up to `maxLength`.
   */
  splitMessage(content: string, maxLength: number = 4096): string[] {
    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > maxLength) {
      // Find the last period or space within maxLength
      const sliceCandidate = remaining.slice(0, maxLength + 1);
      const lastPeriod = sliceCandidate.lastIndexOf(".");
      const lastSpace = sliceCandidate.lastIndexOf(" ");

      let splitIndex = maxLength;
      if (lastPeriod !== -1 && lastPeriod >= maxLength - 50) {
        // Split after the period for natural pause
        splitIndex = lastPeriod + 1;
      } else if (lastSpace !== -1 && lastSpace >= maxLength - 50) {
        // Split at space
        splitIndex = lastSpace;
      }

      const chunk = remaining.slice(0, splitIndex).trim();
      chunks.push(chunk);
      remaining = remaining.slice(splitIndex).trim();
    }
    if (remaining.length > 0) {
      chunks.push(remaining);
    }
    return chunks;
  }

  /**
   * Plays all audio segments in the speech queue sequentially.
   *
   * This method prevents overlapping playback by checking the `isPlaying` flag.
   * It iterates through the `speechQueue`, playing each audio segment one after another.
   * Playback of each segment is awaited until it finishes or encounters an error.
   * If an error occurs during playback, it is logged and playback continues with the next segment.
   * The `isPlaying` flag is reset to `false` after the queue is empty.
   *
   * @returns {Promise<void>} Resolves when all queued audio segments have been played.
   */
  async playQueue(): Promise<void> {
    if (this.isPlaying) return; // Prevent overlapping calls
    this.isPlaying = true;

    while (this.speechQueue.length > 0) {
      const segment = this.speechQueue.shift()!;
      await new Promise<void>((resolve) => {
        segment.audio.onended = () => resolve();
        segment.audio.play().catch((err) => {
          this.console.error("Audio play error:", err);
          resolve();
        });
      });
    }
    this.isPlaying = false;
  }

  /**
   * Processes all chat messages by splitting them into manageable chunks,
   * enqueues each chunk for speech synthesis, and then plays the entire speech queue sequentially.
   *
   * This method iterates through all messages in the chat, splits each message's content
   * into segments of up to 4096 characters, enqueues each segment for speech synthesis,
   * and finally plays the queued speech segments in order.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when all speech segments have been played.
   */
  async speak() {
    // Generate all speech segments upfront
    for (const message of this.chat.messages) {
      if (!message || !message.content) continue;
      const messageChunks = this.splitMessage(message.content, 4096);

      for (const chunk of messageChunks) {
        await this.enqueueSpeech({ role: message.role, content: chunk });
      }
    }
    // Play the entire queue sequentially
    await this.playQueue();
  }

  /**
   * Starts streaming speech synthesis for the chat messages.
   *
   * This method processes the chat messages by splitting them into manageable chunks,
   * enqueues the first message's chunks for speech synthesis, and begins playback.
   * While the first message is being played, it asynchronously enqueues the remaining
   * messages' chunks for playback. The method waits until all speech playback is complete
   * before resolving.
   *
   * @returns {Promise<void>} A promise that resolves when all speech playback has finished.
   */
  async startStreaming(): Promise<void> {
    if (!this.chat.messages || this.chat.messages.length === 0) return;

    // Reset queue and state
    this.speechQueue = [];
    this.isPlaying = false;

    // Generate and enqueue first message
    const firstMessage = this.chat.messages[0];
    const firstChunks = this.splitMessage(firstMessage.content, 4096);
    for (const chunk of firstChunks) {
      await this.enqueueSpeech({ role: firstMessage.role, content: chunk });
    }

    // Start playing the first message
    const playbackPromise = this.playQueue();

    // While playing, generate speech for remaining messages
    const remainingMessages = this.chat.messages.slice(1);
    for (const message of remainingMessages) {
      const messageChunks = this.splitMessage(message.content, 4096);
      for (const chunk of messageChunks) {
        // Queue asynchronously in background
        this.enqueueSpeech({ role: message.role, content: chunk });
      }
    }

    // Wait for all speech to finish
    await playbackPromise;
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

import { Notice } from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import PureChatLLM from "./main";
import { PureChatLLMAPI } from "./types";

/**
 * Handles audio recording and transcription functionality for the Pure Chat LLM plugin.
 *
 * The `PureChatLLMAudioRecorder` class manages audio capture using the MediaRecorder API,
 * provides methods for starting and stopping recordings, and sends recorded audio to
 * an OpenAI-compatible transcription API for transcription.
 *
 * @remarks
 * - Requires a valid API key for the selected provider.
 * - Designed for integration with the PureChatLLM plugin.
 * - Supports configurable audio formats and transcription models.
 * - Works with any provider that has an OpenAI-compatible /audio/transcriptions endpoint.
 *
 * @example
 * ```typescript
 * const recorder = new PureChatLLMAudioRecorder(plugin);
 * await recorder.startRecording();
 * // ... user records audio ...
 * const transcription = await recorder.stopRecording();
 * console.log(transcription);
 * ```
 *
 * @public
 */
export class PureChatLLMAudioRecorder {
  plugin: PureChatLLM;
  console: BrowserConsole;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  isRecording = false;

  constructor(plugin: PureChatLLM) {
    this.plugin = plugin;
    this.console = new BrowserConsole(this.plugin.settings.debug, "AudioRecorder");
  }

  /**
   * Requests microphone access and starts audio recording.
   *
   * @returns A Promise that resolves when recording has started successfully,
   *          or rejects if microphone access is denied or unavailable.
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      this.console.warn("Already recording");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // Prefer webm format if supported, fallback to other formats
      const mimeType = this.getSupportedMimeType();
      this.console.log(`Using audio format: ${mimeType}`);

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      new Notice("🎤 Recording started...");
      this.console.log("Audio recording started");
    } catch (error) {
      this.console.error("Error accessing microphone:", error);
      new Notice("❌ Failed to access microphone. Please check permissions.");
      throw error;
    }
  }

  /**
   * Stops the current audio recording and returns the recorded audio as a Blob.
   *
   * @returns A Promise that resolves to the recorded audio Blob,
   *          or null if no recording was in progress.
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      this.console.warn("No recording in progress");
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        new Notice("🎤 Recording stopped.");
        this.console.log("Audio recording stopped, blob size:", audioBlob.size);
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancels the current recording without saving.
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    new Notice("🎤 Recording cancelled.");
    this.console.log("Audio recording cancelled");
  }

  /**
   * Cleans up recording resources.
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  /**
   * Gets the best supported MIME type for audio recording.
   */
  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "audio/webm"; // Default fallback
  }

  /**
   * Sends the recorded audio to the provider's transcription API for transcription.
   * Uses the currently selected provider's endpoint to build the transcription URL.
   *
   * @param audioBlob - The recorded audio blob to transcribe.
   * @returns A Promise that resolves to the transcribed text,
   *          or an empty string if transcription fails.
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];

    if (!endpoint?.apiKey) {
      this.console.error("API key is missing for transcription.");
      new Notice("❌ API key is missing. Please configure your API key in settings.");
      return "";
    }

    // Build transcription endpoint URL from the provider's chat endpoint
    const transcriptionUrl = this.getTranscriptionUrl(endpoint);
    if (!transcriptionUrl) {
      new Notice("❌ Transcription is not supported for this provider.");
      return "";
    }

    // Determine file extension from MIME type
    const extension = this.getFileExtension(audioBlob.type);
    const fileName = `recording.${extension}`;

    const formData = new FormData();
    formData.append("file", audioBlob, fileName);
    formData.append("model", this.getTranscriptionModel(endpoint));

    // Add optional language parameter if set
    const language = this.plugin.settings.transcriptionLanguage;
    if (language && language !== "auto") {
      formData.append("language", language);
    }

    try {
      new Notice("📝 Transcribing audio...");
      this.plugin.status(`Transcribing audio via ${endpoint.name}...`);

      const response = await fetch(transcriptionUrl, {
        method: "POST",
        headers: this.getHeaders(endpoint),
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.console.error("Transcription API error:", errorText);
        new Notice(`❌ Transcription failed: ${response.statusText}`);
        this.plugin.status("");
        return "";
      }

      const data = await response.json();
      this.plugin.status("");
      new Notice("✅ Transcription complete!");
      this.console.log("Transcription result:", data.text);
      return data.text || "";
    } catch (error) {
      this.console.error("Error during transcription:", error);
      new Notice("❌ Failed to transcribe audio. Check console for details.");
      this.plugin.status("");
      return "";
    }
  }

  /**
   * Gets the transcription API URL for the given provider endpoint.
   * Uses custom endpoint if configured, otherwise derives from provider.
   */
  private getTranscriptionUrl(endpoint: PureChatLLMAPI): string | null {
    // If a custom transcription endpoint is configured, use it
    const customEndpoint = this.plugin.settings.customTranscriptionEndpoint;
    if (customEndpoint) {
      this.console.log(`Using custom transcription endpoint: ${customEndpoint}`);
      return customEndpoint;
    }

    const chatEndpoint = endpoint.endpoint;

    // Parse the URL to get the hostname for accurate matching
    let hostname: string;
    try {
      hostname = new URL(chatEndpoint).hostname;
    } catch {
      this.console.warn(`Invalid endpoint URL: ${chatEndpoint}`);
      return null;
    }

    // Handle different providers with specific transcription endpoints
    if (hostname === "api.openai.com") {
      return "https://api.openai.com/v1/audio/transcriptions";
    }

    if (hostname === "api.groq.com") {
      return "https://api.groq.com/openai/v1/audio/transcriptions";
    }

    // Google's Gemini API doesn't have a Whisper-compatible transcription endpoint
    if (hostname === "generativelanguage.googleapis.com") {
      this.console.warn(
        "Gemini does not support OpenAI-compatible audio transcription. " +
          "Set a custom transcription endpoint in settings to use a different provider.",
      );
      return null;
    }

    // Anthropic doesn't have a transcription API
    if (hostname === "api.anthropic.com") {
      this.console.warn(
        "Anthropic does not support audio transcription. " +
          "Set a custom transcription endpoint in settings to use a different provider.",
      );
      return null;
    }

    // For OpenAI-compatible providers (including Ollama and custom providers),
    // derive the transcription URL from the chat endpoint
    if (chatEndpoint.includes("/chat/completions")) {
      return chatEndpoint.replace("/chat/completions", "/audio/transcriptions");
    }

    // Unknown endpoint format - suggest using custom endpoint
    this.console.warn(
      `Cannot determine transcription URL for endpoint: ${chatEndpoint}. ` +
        `Set a custom transcription endpoint in settings.`,
    );
    return null;
  }

  /**
   * Gets the appropriate transcription model for the given provider.
   * Uses custom model if configured, otherwise uses provider defaults.
   */
  private getTranscriptionModel(endpoint: PureChatLLMAPI): string {
    // If a custom transcription model is configured, use it
    const customModel = this.plugin.settings.customTranscriptionModel;
    if (customModel) {
      this.console.log(`Using custom transcription model: ${customModel}`);
      return customModel;
    }

    const chatEndpoint = endpoint.endpoint;

    // Parse the URL to get the hostname for accurate matching
    let hostname: string;
    try {
      hostname = new URL(chatEndpoint).hostname;
    } catch {
      return "whisper-1"; // Default if URL is invalid
    }

    if (hostname === "api.groq.com") {
      return "whisper-large-v3"; // Groq uses whisper-large-v3
    }

    // For Ollama and other local providers, use "whisper" as the model name
    if (this.isLocalEndpoint(hostname)) {
      return "whisper";
    }

    return "whisper-1"; // Default OpenAI model
  }

  /**
   * Checks if the hostname is a local server (localhost or 127.0.0.1).
   */
  private isLocalEndpoint(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  /**
   * Gets the appropriate headers for the transcription request.
   */
  private getHeaders(endpoint: PureChatLLMAPI): Record<string, string> {
    // Most providers use Bearer token auth for transcription
    return {
      Authorization: `Bearer ${endpoint.apiKey}`,
    };
  }

  /**
   * Records audio, transcribes it, and returns the transcribed text.
   * This is a convenience method that combines startRecording, stopRecording, and transcribeAudio.
   *
   * @param durationMs - Optional maximum recording duration in milliseconds.
   *                     If not provided, recording continues until stopRecording is called manually.
   * @returns A Promise that resolves to the transcribed text.
   */
  async recordAndTranscribe(durationMs?: number): Promise<string> {
    await this.startRecording();

    if (durationMs) {
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      const audioBlob = await this.stopRecording();
      if (audioBlob) {
        return this.transcribeAudio(audioBlob);
      }
    }

    return "";
  }

  /**
   * Gets the appropriate file extension for a given MIME type.
   */
  private getFileExtension(mimeType: string): string {
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("wav")) return "wav";
    return "webm"; // Default
  }
}

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
   * If no dedicated transcription endpoint is available, falls back to using the
   * chat completions endpoint with audio embedded in the message (for Gemini, etc.).
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

    // Check if endpoint has a dedicated transcription endpoint
    const transcriptionUrl = this.getTranscriptionUrl(endpoint);

    if (transcriptionUrl) {
      // Use dedicated Whisper-style transcription API
      return this.transcribeWithWhisperApi(audioBlob, endpoint, transcriptionUrl);
    } else {
      // Fallback: Use chat completions with embedded audio (for Gemini, etc.)
      return this.transcribeWithChatCompletions(audioBlob, endpoint);
    }
  }

  /**
   * Transcribes audio using a Whisper-compatible API endpoint.
   */
  private async transcribeWithWhisperApi(
    audioBlob: Blob,
    endpoint: PureChatLLMAPI,
    transcriptionUrl: string,
  ): Promise<string> {
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
   * Transcribes audio using the chat completions endpoint with embedded audio.
   * This is used for providers like Gemini that support audio in chat messages
   * but don't have a dedicated Whisper-style transcription endpoint.
   */
  private async transcribeWithChatCompletions(
    audioBlob: Blob,
    endpoint: PureChatLLMAPI,
  ): Promise<string> {
    try {
      new Notice("📝 Transcribing audio via chat...");
      this.plugin.status(`Transcribing audio via ${endpoint.name} chat...`);

      // Convert audio blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      const audioFormat = this.getAudioFormat(audioBlob.type);

      // Build the chat completion request with embedded audio
      const requestBody = {
        model: endpoint.defaultmodel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this audio file. Return only the transcribed text, nothing else.",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: audioFormat,
                },
              },
            ],
          },
        ],
      };

      const response = await fetch(endpoint.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpoint.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.console.error("Chat transcription API error:", errorText);
        new Notice(`❌ Transcription failed: ${response.statusText}`);
        this.plugin.status("");
        return "";
      }

      const data = await response.json();
      this.plugin.status("");
      new Notice("✅ Transcription complete!");

      // Extract the transcribed text from the chat response
      const transcribedText = data.choices?.[0]?.message?.content || "";
      this.console.log("Chat transcription result:", transcribedText);
      return transcribedText;
    } catch (error) {
      this.console.error("Error during chat transcription:", error);
      new Notice("❌ Failed to transcribe audio. Check console for details.");
      this.plugin.status("");
      return "";
    }
  }

  /**
   * Converts a Blob to a base64 string (without the data URL prefix).
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Gets the audio format string for the chat completions API.
   */
  private getAudioFormat(mimeType: string): string {
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("mp3")) return "mp3";
    if (mimeType.includes("mpeg")) return "mp3";
    return "webm"; // Default
  }

  /**
   * Gets the transcription API URL for the given provider endpoint.
   * Uses endpoint-specific transcriptionEndpoint if configured.
   * Returns null if no Whisper-style transcription is available (will fall back to chat completions).
   */
  private getTranscriptionUrl(endpoint: PureChatLLMAPI): string | null {
    // If endpoint has a transcription endpoint configured, use it
    if (endpoint.transcriptionEndpoint) {
      this.console.log(`Using endpoint transcription URL: ${endpoint.transcriptionEndpoint}`);
      return endpoint.transcriptionEndpoint;
    }

    // Check if this provider is known to NOT support Whisper-style transcription
    // These providers will fall back to chat completions with embedded audio
    const chatEndpoint = endpoint.endpoint;
    try {
      const hostname = new URL(chatEndpoint).hostname;

      // Providers that don't have Whisper-style transcription API
      const noWhisperProviders = [
        "generativelanguage.googleapis.com", // Gemini - uses chat completions with audio
        "api.anthropic.com", // Anthropic - uses chat completions with audio
      ];

      if (noWhisperProviders.some((provider) => hostname === provider)) {
        this.console.log(
          `${endpoint.name} doesn't have Whisper API, will use chat completions with audio`,
        );
        return null;
      }
    } catch {
      // Invalid URL, continue with derivation attempt
    }

    // Try to derive transcription URL from chat endpoint for OpenAI-compatible providers
    if (chatEndpoint.includes("/chat/completions")) {
      const derivedUrl = chatEndpoint.replace("/chat/completions", "/audio/transcriptions");
      this.console.log(`Derived transcription URL: ${derivedUrl}`);
      return derivedUrl;
    }

    // Cannot determine transcription URL - will fall back to chat completions
    this.console.log(
      `No transcription endpoint for ${endpoint.name}, will try chat completions with audio`,
    );
    return null;
  }

  /**
   * Gets the appropriate transcription model for the given provider.
   * Uses endpoint-specific transcriptionModel if configured.
   */
  private getTranscriptionModel(endpoint: PureChatLLMAPI): string {
    // If endpoint has a transcription model configured, use it
    if (endpoint.transcriptionModel) {
      this.console.log(`Using endpoint transcription model: ${endpoint.transcriptionModel}`);
      return endpoint.transcriptionModel;
    }

    // Default to whisper-1 (OpenAI default)
    return "whisper-1";
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

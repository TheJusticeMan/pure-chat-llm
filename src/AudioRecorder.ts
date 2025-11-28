import { Notice } from "obsidian";
import { BrowserConsole } from "./BrowserConsole";
import PureChatLLM from "./main";

/**
 * Handles audio recording and transcription functionality for the Pure Chat LLM plugin.
 *
 * The `PureChatLLMAudioRecorder` class manages audio capture using the MediaRecorder API,
 * provides methods for starting and stopping recordings, and sends recorded audio to
 * OpenAI's Whisper API for transcription.
 *
 * @remarks
 * - Requires a valid OpenAI API key for transcription.
 * - Designed for integration with the PureChatLLM plugin.
 * - Supports configurable audio formats and transcription models.
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
   * Sends the recorded audio to the OpenAI Whisper API for transcription.
   *
   * @param audioBlob - The recorded audio blob to transcribe.
   * @returns A Promise that resolves to the transcribed text,
   *          or an empty string if transcription fails.
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const apiKey = this.plugin.settings.endpoints[this.plugin.settings.endpoint]?.apiKey;

    if (!apiKey) {
      this.console.error("API key is missing for transcription.");
      new Notice("❌ API key is missing. Please configure your API key in settings.");
      return "";
    }

    // Determine file extension from MIME type
    const extension = this.getFileExtension(audioBlob.type);
    const fileName = `recording.${extension}`;

    const formData = new FormData();
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-1");

    // Add optional language parameter if set
    const language = this.plugin.settings.transcriptionLanguage;
    if (language && language !== "auto") {
      formData.append("language", language);
    }

    try {
      new Notice("📝 Transcribing audio...");
      this.plugin.status("Transcribing audio...");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
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

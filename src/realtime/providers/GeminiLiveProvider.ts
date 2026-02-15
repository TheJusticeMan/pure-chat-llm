import { Notice } from 'obsidian';
import { IToolExecutor, IVoiceCallProvider, VoiceCallConfig } from './IVoiceCallProvider';

const PCM_PROCESSOR_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const float32 = input[0];
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface GeminiMessage {
  setupComplete?: boolean;
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
}

interface GeminiSetup {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: string;
          };
        };
      };
    };
    systemInstruction?: {
      parts: { text: string }[];
    };
    tools?: Array<{
      function_declarations: Array<{
        name: string;
        description: string;
        parameters: JsonValue;
      }>;
    }>;
  };
}

/**
 * Google Gemini Live API provider
 * Uses WebSocket and AudioWorklet
 */
export class GeminiLiveProvider implements IVoiceCallProvider {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Audio playback queue
  private nextStartTime = 0;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;

  // Callbacks
  private onRemoteTrackCallback?: (stream: MediaStream) => void;
  private onMessageCallback?: (event: unknown) => void;
  private onErrorCallback?: (error: Error) => void;

  /**
   * Creates a new GeminiLiveProvider
   * @param toolExecutor - Optional tool executor for function calling
   */
  constructor(private toolExecutor?: IToolExecutor) {}

  /**
   * Gets the provider name
   * @returns The display name of the provider
   */
  getName(): string {
    return this.toolExecutor ? 'Google Gemini Live (Tools)' : 'Google Gemini Live';
  }

  /**
   * Registers callback for remote audio tracks
   * @param callback - Function to call when remote audio is received
   */
  onRemoteTrack(callback: (stream: MediaStream) => void): void {
    this.onRemoteTrackCallback = callback;
  }

  /**
   * Registers callback for server messages
   * @param callback - Function to call when server sends a message
   */
  onMessage(callback: (event: unknown) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Registers callback for errors
   * @param callback - Function to call when an error occurs
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Connects to Gemini Live API
   * @param localStream - The local audio stream from the microphone
   * @param config - Configuration including API key and model settings
   * @returns Promise that resolves when connection is established
   */
  async connect(localStream: MediaStream, config: VoiceCallConfig): Promise<void> {
    try {
      const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${config.apiKey}`;

      this.ws = new WebSocket(endpoint);
      this.ws.binaryType = 'arraybuffer';

      // Setup Audio Context (16kHz for input to Gemini)
      this.audioContext = new AudioContext({ sampleRate: 16000 }); // Gemini likes 16kHz input

      // Load AudioWorklet
      const blob = new Blob([PCM_PROCESSOR_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url); // Cleanup

      // Setup processing pipeline
      this.sourceNode = this.audioContext.createMediaStreamSource(localStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

      this.workletNode.port.onmessage = event => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.sendAudioChunk(event.data);
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      // Wait for WS Open
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('No WS'));

        const timer = setTimeout(() => reject(new Error('Timeout')), 10000);

        this.ws.onopen = () => {
          clearTimeout(timer);
          this.sendSetup(config);
          resolve();
        };

        this.ws.onerror = err => {
          clearTimeout(timer);
          console.error('WS Error during connect', err);
        };

        this.ws.onmessage = event => this.handleMessage(event);
        this.ws.onclose = () => void this.disconnect();
      });

      // Resume context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      if (this.onErrorCallback && error instanceof Error) {
        this.onErrorCallback(error);
      }
      throw error;
    }
  }

  /**
   * Disconnects from Gemini Live API and cleans up resources
   * @returns Promise that resolves when disconnection is complete
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
  }

  /**
   * Sends an event to the Gemini API
   * @param event - The event to send
   */
  send(event: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  /**
   * Sends setup configuration to initialize the Gemini session
   * @param config - Voice call configuration including model and instructions
   */
  private sendSetup(config: VoiceCallConfig) {
    const setup: GeminiSetup = {
      setup: {
        model: config.model || 'models/gemini-2.0-flash-exp',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voice || 'Puck',
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: config.instructions || 'You are a helpful assistant.' }],
        },
      },
    };

    if (this.toolExecutor && config.tools) {
      const functionDeclarations = config.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: this.removeAdditionalProperties(t.function.parameters),
      }));

      if (functionDeclarations.length > 0) {
        setup.setup.tools = [{ function_declarations: functionDeclarations }];
      }
    }

    this.ws?.send(JSON.stringify(setup));
  }

  /**
   * Sends an audio chunk to Gemini
   * @param data - PCM audio data as ArrayBuffer
   */
  private sendAudioChunk(data: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const base64 = this.arrayBufferToBase64(data);
    const msg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64,
          },
        ],
      },
    };
    this.ws.send(JSON.stringify(msg));
  }

  /**
   * Handles incoming WebSocket messages from Gemini
   * @param event - The WebSocket message event
   */
  private handleMessage(event: MessageEvent) {
    let data: GeminiMessage;
    try {
      if (event.data instanceof ArrayBuffer) {
        data = JSON.parse(new TextDecoder().decode(event.data)) as GeminiMessage;
      } else {
        data = JSON.parse(event.data as string) as GeminiMessage;
      }
    } catch (e) {
      console.error('Parse error', e);
      return;
    }

    if (data.setupComplete && this.onMessageCallback) {
      this.onMessageCallback({ type: 'connected' });
    }

    // Audio
    if (data.serverContent?.modelTurn?.parts) {
      for (const part of data.serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
          const pcmData = this.base64ToArrayBuffer(part.inlineData.data);
          this.queueAudio(pcmData);
        }
      }
    }

    // Tools
    if (data.toolCall) {
      void this.handleToolCall(data.toolCall);
    }
  }

  /**
   * Queues audio data for playback
   * @param data - PCM audio data to queue
   */
  private queueAudio(data: ArrayBuffer) {
    this.audioQueue.push(data);
    if (!this.isPlaying) {
      void this.playQueue();
    }
  }

  /**
   * Plays queued audio chunks
   * @returns Promise that resolves when playback completes or queue is empty
   */
  private async playQueue() {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;

    const chunk = this.audioQueue.shift();
    if (!chunk) {
      this.isPlaying = false;
      return;
    }

    const pcm16 = new Int16Array(chunk);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    const start = Math.max(now, this.nextStartTime);
    source.start(start);
    this.nextStartTime = start + buffer.duration;

    source.onended = () => {
      void this.playQueue();
    };
  }

  /**
   * Handles tool/function calls from Gemini
   * @param toolCall - The tool call request from Gemini
   * @returns Promise that resolves when tool execution completes
   */
  private async handleToolCall(toolCall: NonNullable<GeminiMessage['toolCall']>) {
    if (!this.toolExecutor || !toolCall.functionCalls) return;

    const responses = [];
    for (const call of toolCall.functionCalls) {
      try {
        new Notice(`Executing ${call.name}`);
        const result = await this.toolExecutor.executeTool(call.name, call.args);
        responses.push({
          id: call.id,
          name: call.name,
          response: { result },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        responses.push({
          id: call.id,
          name: call.name,
          response: { error: msg },
        });
      }
    }

    const responseMsg = {
      toolResponse: {
        functionResponses: responses,
      },
    };
    this.send(responseMsg);
  }

  // Helpers
  /**
   * Converts an ArrayBuffer to base64 string
   * @param buffer - The buffer to convert
   * @returns Base64 encoded string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts a base64 string to ArrayBuffer
   * @param base64 - The base64 string to decode
   * @returns Decoded ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Recursively removes additionalProperties from an object
   * @param obj - The object to process
   * @returns The processed object without additionalProperties
   */
  private removeAdditionalProperties(obj: unknown): JsonValue {
    if (typeof obj !== 'object' || obj === null) return obj as JsonValue;

    if (Array.isArray(obj)) {
      return obj.map(i => this.removeAdditionalProperties(i));
    }

    const newObj: Record<string, JsonValue> = {};
    const record = obj as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      if (key !== 'additionalProperties') {
        newObj[key] = this.removeAdditionalProperties(record[key]);
      }
    }
    return newObj;
  }
}

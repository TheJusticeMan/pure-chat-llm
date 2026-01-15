import { Notice } from 'obsidian';
import { PureChatLLMChat } from '../../core/Chat';
import { ToolDefinition } from '../../types';
import { IVoiceCallProvider, VoiceCallConfig } from './IVoiceCallProvider';

/**
 * Google Gemini Live API provider implementation
 * Uses WebSocket connection for real-time audio streaming
 * Adapts Gemini's WebSocket protocol to work with WebRTC peer connections
 */
export class GeminiLiveProvider implements IVoiceCallProvider {
  protected ws: WebSocket | null = null;
  protected audioContext: AudioContext | null = null;
  protected mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  protected scriptProcessor: ScriptProcessorNode | null = null;
  protected remoteAudioQueue: ArrayBuffer[] = [];
  protected isPlaying = false;
  private chat: PureChatLLMChat | null = null;

  constructor(chat?: PureChatLLMChat) {
    this.chat = chat || null;
  }

  getName(): string {
    return this.chat ? 'Google Gemini Live API (with tools)' : 'Google Gemini Live API';
  }

  /**
   * Starts a voice call session with Google Gemini Live API
   */
  async startSession(
    peerConnection: RTCPeerConnection,
    localStream: MediaStream,
    config: VoiceCallConfig,
  ): Promise<void> {
    // Get tool definitions from the chat's tool registry if available
    let tools: Record<string, unknown>[] | undefined;
    
    if (this.chat && this.chat.plugin.settings.agentMode) {
      const toolDefinitions = this.chat.toolregistry.getAllDefinitions();
      
      if (toolDefinitions.length > 0) {
        // Transform tool definitions to Gemini's format
        // Group all functions into a single "function_declarations" list
        const functionDeclarations = toolDefinitions.map((tool: ToolDefinition) => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: this.removeAdditionalProperties(tool.function.parameters),
        }));

        tools = [{ function_declarations: functionDeclarations }];
      }
    }

    // Determine WebSocket endpoint
    const wsEndpoint = config.endpoint || this.getDefaultEndpoint(config.apiKey, config.model);

    // Connect to Gemini Live API via WebSocket
    this.ws = new WebSocket(wsEndpoint);
    this.ws.binaryType = 'arraybuffer';

    // Set up audio context for processing
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(localStream);

    // Create script processor for capturing audio
    // Note: Using deprecated createScriptProcessor for compatibility
    // TODO: Migrate to AudioWorklet when browser support is widespread
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      let setupComplete = false;

      this.ws.onopen = () => {
        console.log('Gemini Live WebSocket opened');
        // Send setup message with tools if available
        const enhancedConfig = {
          ...config,
          instructions: config.instructions || (this.chat ? 'You are a helpful assistant with access to tools.' : 'You are a helpful assistant.'),
          tools: tools,
        };
        this.sendSetupMessage(enhancedConfig);
      };

      this.ws.onerror = (error: Event) => {
        console.error('Gemini Live WebSocket error:', error);
        if (!setupComplete) {
          reject(new Error(`WebSocket connection error: ${error.type || 'unknown'}`));
        }
      };

      this.ws.onmessage = event => {
        console.log('Gemini Live WebSocket message received');
        // Check for setup complete before resolving
        try {
          const data = this.parseEventData(event.data);
          console.log('Gemini Live WebSocket parsed message:', data);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (data.setupComplete && !setupComplete) {
            console.log('Gemini Live setup complete');
            setupComplete = true;
            resolve();
          }
        } catch (e) {
          console.error('Error parsing message in onmessage:', e);
          // Continue processing in handleWebSocketMessage
        }
        this.handleWebSocketMessage(event);
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log('Gemini Live WebSocket closed:', event.code, event.reason);
        if (!setupComplete) {
          reject(new Error(`WebSocket closed before setup complete. Code: ${event.code}, Reason: ${event.reason}`));
        }
        void this.cleanup();
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!setupComplete) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });

    // Start audio streaming
    // Note: Using deprecated ScriptProcessorNode for compatibility
    // TODO: Migrate to AudioWorklet when browser support is widespread
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.startAudioStreaming(localStream);

    new Notice(tools ? 'Voice call started with tool access' : 'Voice call started');
  }

  /**
   * Gets the default Gemini Live API endpoint
   */
  private getDefaultEndpoint(apiKey: string, model?: string): string {
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  }

  /**
   * Sends the setup message to configure the Gemini session
   */
  protected sendSetupMessage(config: VoiceCallConfig): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupMessage: Record<string, unknown> = {
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
          parts: [
            {
              text: config.instructions || 'You are a helpful assistant.',
            },
          ],
        },
      },
    };

    // Add tools if available
    if (config.tools && Array.isArray(config.tools) && config.tools.length > 0) {
      (setupMessage.setup as Record<string, unknown>).tools = config.tools;
    }

    this.ws.send(JSON.stringify(setupMessage));
  }

  /**
   * Starts streaming audio from the microphone to Gemini
   */
  private startAudioStreaming(localStream: MediaStream): void {
    if (!this.scriptProcessor || !this.mediaStreamSource || !this.audioContext) return;

    // Note: Using deprecated onaudioprocess and inputBuffer for compatibility
    // TODO: Migrate to AudioWorklet when browser support is widespread
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.scriptProcessor.onaudioprocess = event => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = this.convertFloat32ToPCM16(inputData);
      this.sendAudioChunk(pcm16);
    };

    this.mediaStreamSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  /**
   * Converts Float32Array audio to PCM16 format
   */
  private convertFloat32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  /**
   * Sends an audio chunk to Gemini
   */
  private sendAudioChunk(pcm16: Int16Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Create a new ArrayBuffer from the typed array to avoid SharedArrayBuffer issues
    const arrayBuffer = new ArrayBuffer(pcm16.byteLength);
    new Uint8Array(arrayBuffer).set(
      new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength),
    );
    const base64Audio = this.arrayBufferToBase64(arrayBuffer);
    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handles incoming WebSocket messages from Gemini
   */
  protected handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = this.parseEventData(event.data);
      this.processMessage(data);
    } catch (error) {
      console.error('Failed to parse Gemini message:', error);
    }
  }

  /**
   * Processes parsed WebSocket messages
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected processMessage(data: any): void {
    // Handle setup complete
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.setupComplete) {
      new Notice('Connected to API');
    }

    // Handle server content (audio response)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.serverContent && data.serverContent.modelTurn) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const parts = data.serverContent.modelTurn.parts;
      for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
          // Decode and queue audio for playback
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          const audioData = this.base64ToArrayBuffer(part.inlineData.data);
          this.remoteAudioQueue.push(audioData);
          void this.playQueuedAudio();
        }
        
        // Handle function calls within tool call requests
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (part.functionCall) {
          console.warn('Received inline functionCall, but expecting top-level toolCall');
        }
      }
    }

    // Handle tool calls
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.toolCall) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      void this.handleToolCall(data.toolCall);
    }
  }

  /**
   * Handles tool call requests from Gemini
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleToolCall(toolCall: any): Promise<void> {
    try {
      if (toolCall.functionCalls && Array.isArray(toolCall.functionCalls)) {
        const responses = [];
        
        for (const call of toolCall.functionCalls) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          new Notice(`Executing tool: ${call.name}`);
          
          try {
            // Execute the tool via the chat's tool registry
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            const result = await this.chat?.toolregistry.executeTool(call.name, call.args);
            
            responses.push({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              id: call.id,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              name: call.name,
              response: { result: result }
            });
          } catch (error) {
            console.error(`Failed to execute tool ${call.name}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            responses.push({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              id: call.id,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              name: call.name,
              response: { error: errorMessage }
            });
          }
        }
        
        this.sendToolResponse(responses);
      }
    } catch (error) {
      console.error('Failed to handle tool call:', error);
    }
  }

  /**
   * Sends tool execution results back to Gemini
   */
  private sendToolResponse(responses: Array<{ id: string; name: string; response: unknown }>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const toolResponse = {
      toolResponse: {
        functionResponses: responses,
      },
    };

    console.log('Sending tool response:', toolResponse);
    this.ws.send(JSON.stringify(toolResponse));
  }

  private nextStartTime = 0;

  /**
   * Plays queued audio from Gemini using scheduled playback
   */
  private async playQueuedAudio(): Promise<void> {
    if (this.isPlaying || this.remoteAudioQueue.length === 0 || !this.audioContext) return;

    this.isPlaying = true;

    try {
      while (this.remoteAudioQueue.length > 0) {
        const audioData = this.remoteAudioQueue.shift();
        if (!audioData) continue;

        // Gemini sends raw PCM 16-bit audio at 24kHz
        const pcm16 = new Int16Array(audioData);
        const float32 = new Float32Array(pcm16.length);

        for (let i = 0; i < pcm16.length; i++) {
          // Convert Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
          float32[i] = pcm16[i] / 32768.0;
        }

        // Create buffer with 1 channel, proper length, and 24kHz sample rate
        const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
        audioBuffer.copyToChannel(float32, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Schedule playback
        const currentTime = this.audioContext.currentTime;
        
        // If next start time is in the past (underrun), reset to current time
        if (this.nextStartTime < currentTime) {
          this.nextStartTime = currentTime;
        }

        source.start(this.nextStartTime);
        
        // Advance next start time by buffer duration
        this.nextStartTime += audioBuffer.duration;
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
    } finally {
      this.isPlaying = false;
      // Check if more items were added while processing
      if (this.remoteAudioQueue.length > 0) {
        void this.playQueuedAudio();
      }
    }
  }

  /**
   * Converts ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Sets up the data channel (not used by Gemini, but required by interface)
   */
  setupDataChannel(dataChannel: RTCDataChannel, onServerEvent?: (event: unknown) => void): void {
    // Gemini uses WebSocket, not RTCDataChannel
    // This method is here to satisfy the interface but isn't used
    dataChannel.addEventListener('open', () => {
      // No-op: Gemini doesn't use RTCDataChannel
    });
  }

  /**
   * Sends an event (not used by Gemini WebSocket, but required by interface)
   */
  sendEvent(dataChannel: RTCDataChannel, event: unknown): void {
    // Gemini uses WebSocket for all communication
    // Events would be sent via this.ws instead
  }

  /**
   * Cleans up Gemini-specific resources
   */
  async cleanup(): Promise<void> {
    // Stop audio processing
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Close WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
      this.ws = null;
    }

    // Clear audio queue
    this.remoteAudioQueue = [];
    this.isPlaying = false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseEventData(data: any): any {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    if (data instanceof ArrayBuffer) {
      const text = new TextDecoder().decode(data);
      return JSON.parse(text);
    }
    return {};
  }

  /**
   * Recursively removes 'additionalProperties' from an object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private removeAdditionalProperties(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeAdditionalProperties(item));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const newObj: any = {};
    for (const key in obj) {
      if (key !== 'additionalProperties') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        newObj[key] = this.removeAdditionalProperties(obj[key]);
      }
    }

    return newObj;
  }
}

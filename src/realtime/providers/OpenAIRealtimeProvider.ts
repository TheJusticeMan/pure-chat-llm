import { Notice } from 'obsidian';
import { IToolExecutor, IVoiceCallProvider, VoiceCallConfig } from './IVoiceCallProvider';

interface OpenAIEvent {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  [key: string]: unknown;
}

/**
 * OpenAI Realtime API provider implementation
 * Manages WebRTC connection internally
 */
export class OpenAIRealtimeProvider implements IVoiceCallProvider {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private sessionEndpoint = 'https://api.openai.com/v1/realtime/calls';

  // Callbacks
  private onRemoteTrackCallback?: (stream: MediaStream) => void;
  private onMessageCallback?: (event: unknown) => void;
  private onErrorCallback?: (error: Error) => void;

  /**
   * Creates a new OpenAIRealtimeProvider
   * @param toolExecutor - Optional tool executor for function calling
   */
  constructor(private toolExecutor?: IToolExecutor) {}

  /**
   * Gets the provider name
   * @returns The display name of the provider
   */
  getName(): string {
    return this.toolExecutor ? 'OpenAI Realtime API (Tools)' : 'OpenAI Realtime API';
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
   * Connects to OpenAI Realtime API via WebRTC
   * @param localStream - The local audio stream from the microphone
   * @param config - Configuration including API key and model settings
   * @returns Promise that resolves when connection is established
   */
  async connect(localStream: MediaStream, config: VoiceCallConfig): Promise<void> {
    try {
      this.peerConnection = new RTCPeerConnection();

      // Setup audio tracks
      localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, localStream);
      });

      // Handle remote tracks
      this.peerConnection.ontrack = event => {
        if (event.streams && event.streams[0] && this.onRemoteTrackCallback) {
          this.onRemoteTrackCallback(event.streams[0]);
        }
      };

      // Create Data Channel
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannel(this.dataChannel);

      // Create Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Prepare session config
      const sessionConfig: Record<string, unknown> = {
        type: 'realtime',
        model: config.model || 'gpt-realtime',
        instructions: config.instructions || 'You are a helpful assistant.',
        ...(config.voice && { audio: { output: { voice: config.voice } } }),
      };

      // Add tools if available
      if (this.toolExecutor && config.tools && config.tools.length > 0) {
        sessionConfig.tools = config.tools.map(tool => ({
          type: tool.type,
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        }));
      }

      // Exchange SDP
      const formData = new FormData();
      formData.append('sdp', offer.sdp || '');
      formData.append('session', JSON.stringify(sessionConfig));

      // eslint-disable-next-line no-restricted-globals
      const response = await fetch(config.endpoint || this.sessionEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
      }

      const answerSdp = await response.text();
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (error) {
      if (this.onErrorCallback && error instanceof Error) {
        this.onErrorCallback(error);
      }
      throw error;
    }
  }

  /**
   * Disconnects from OpenAI Realtime API and cleans up resources
   * @returns Promise that resolves when disconnection is complete
   */
  disconnect(): Promise<void> {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    return Promise.resolve();
  }

  /**
   * Sends an event to the OpenAI API
   * @param event - The event to send
   */
  send(event: unknown): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    }
  }

  /**
   * Sets up the WebRTC data channel for events
   * @param dc - The RTCDataChannel to configure
   */
  private setupDataChannel(dc: RTCDataChannel): void {
    dc.addEventListener('open', () => {
      // Channel ready
    });

    dc.addEventListener('message', event => {
      void (async () => {
        try {
          const data = JSON.parse(event.data as string) as OpenAIEvent;

          if (data.type === 'response.function_call_arguments.done' && this.toolExecutor) {
            await this.handleToolCall(data);
          }

          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        } catch (e) {
          console.error('Failed to parse OpenAI event:', e);
        }
      })();
    });
  }

  /**
   * Handles tool/function calls from OpenAI
   * @param event - The function call event from OpenAI
   * @returns Promise that resolves when tool execution completes
   */
  private async handleToolCall(event: OpenAIEvent): Promise<void> {
    if (!this.toolExecutor) return;

    try {
      const callId = event.call_id;
      const name = event.name;
      const args = JSON.parse(event.arguments || '{}') as Record<string, unknown>;

      if (!name) return;

      new Notice(`Executing tool: ${name}`);
      const result = await this.toolExecutor.executeTool(name, args);

      // Send result back
      const toolResponse = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result),
        },
      };
      this.send(toolResponse);
      this.send({ type: 'response.create' }); // Trigger response
    } catch (error) {
      console.error(`Tool execution failed:`, error);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const toolResponse = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify({ error: errMsg }),
        },
      };
      this.send(toolResponse);
      this.send({ type: 'response.create' });
    }
  }
}

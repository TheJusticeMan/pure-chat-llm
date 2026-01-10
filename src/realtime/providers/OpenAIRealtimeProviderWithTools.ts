import { Notice } from 'obsidian';
import { PureChatLLMChat } from '../../core/Chat';
import { IVoiceCallProvider, VoiceCallConfig } from './IVoiceCallProvider';

/**
 * OpenAI Realtime API provider with tool integration
 * Extends the base OpenAI provider to support PureChatLLMChat tools
 */
export class OpenAIRealtimeProviderWithTools implements IVoiceCallProvider {
  private sessionEndpoint = 'https://api.openai.com/v1/realtime/calls';
  private chat: PureChatLLMChat | null = null;

  constructor(chat?: PureChatLLMChat) {
    this.chat = chat || null;
  }

  getName(): string {
    return 'OpenAI Realtime API with Tools';
  }

  /**
   * Starts a voice call session with OpenAI Realtime API
   * Includes tool definitions if chat is available
   */
  async startSession(
    peerConnection: RTCPeerConnection,
    localStream: MediaStream,
    config: VoiceCallConfig,
  ): Promise<void> {
    // Create offer and set local description
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Prepare session configuration
    const sessionConfig: Record<string, unknown> = {
      type: 'realtime',
      model: config.model || 'gpt-realtime',
      instructions: config.instructions || 'You are a helpful assistant.',
      ...(config.voice && { audio: { output: { voice: config.voice } } }),
    };

    // Add tool definitions if chat is available
    if (this.chat && this.chat.plugin.settings.agentMode) {
      const toolDefinitions = this.chat.toolregistry.getAllDefinitions();
      if (toolDefinitions.length > 0) {
        // Convert tool definitions to OpenAI Realtime API format
        // The Realtime API expects tools with direct name/description/parameters
        // rather than the Chat Completions API format with type:'function' wrapper
        sessionConfig.tools = toolDefinitions.map(tool => ({
          type: tool.type,
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        }));
        new Notice(`Voice call started with ${toolDefinitions.length} tools enabled`);
      }
    }

    // Create FormData with SDP and session config (unified interface pattern)
    const formData = new FormData();
    formData.append('sdp', offer.sdp || '');
    formData.append('session', JSON.stringify(sessionConfig));

    // Note: Using native fetch for FormData support
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
      throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
    }

    // Set remote description from OpenAI's answer
    const answerSdp = await response.text();
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp: answerSdp,
    };
    await peerConnection.setRemoteDescription(answer);

    new Notice(this.chat ? 'Voice call started with tool access' : 'Voice call started');
  }

  /**
   * Sets up the OpenAI-specific data channel ('oai-events')
   * Handles tool calls from the AI
   */
  setupDataChannel(dataChannel: RTCDataChannel, onServerEvent?: (event: unknown) => void): void {
    dataChannel.addEventListener('open', () => {
      new Notice('Connected to OpenAI realtime API');
    });

    dataChannel.addEventListener('message', event => {
      void (async () => {
        try {
          const eventData = String(event.data);
          const serverEvent = JSON.parse(eventData) as {
            type: string;
            [key: string]: unknown;
          };

        // Handle tool calls
        if (serverEvent.type === 'response.function_call_arguments.done' && this.chat) {
          await this.handleToolCall(serverEvent, dataChannel);
        }

        // Forward all events to the callback
        if (onServerEvent) {
          onServerEvent(serverEvent);
        }
      } catch (error) {
        console.error('Failed to parse server event:', error);
      }
      })();
    });

    dataChannel.addEventListener('error', error => {
      console.error('Data channel error:', error);
    });

    dataChannel.addEventListener('close', () => {
      // Connection closed
    });
  }

  /**
   * Handles tool call execution from the AI
   */
  private async handleToolCall(
    serverEvent: { type: string; [key: string]: unknown },
    dataChannel: RTCDataChannel,
  ): Promise<void> {
    if (!this.chat) return;

    try {
      const callId = serverEvent.call_id as string;
      const functionName = serverEvent.name as string;
      const functionArgs = serverEvent.arguments as string;

      // Parse arguments
      const args = JSON.parse(functionArgs) as Record<string, unknown>;

      // Execute tool via the chat's tool registry
      new Notice(`Executing tool: ${functionName}...`);
      const result = await this.chat.toolregistry.executeTool(functionName, args);

      // Send tool result back to OpenAI
      const toolResponse = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: result,
        },
      };

      this.sendEvent(dataChannel, toolResponse);

      // Request response generation
      this.sendEvent(dataChannel, {
        type: 'response.create',
      });

      new Notice(`Tool ${functionName} executed successfully`);
    } catch (error) {
      console.error('Tool execution error:', error);
      new Notice(
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Sends a client event to the OpenAI Realtime API via data channel
   */
  sendEvent(dataChannel: RTCDataChannel, event: unknown): void {
    if (dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(event));
    }
  }

  /**
   * Cleans up OpenAI-specific resources
   */
  async cleanup(): Promise<void> {
    // No special cleanup needed for OpenAI
  }
}

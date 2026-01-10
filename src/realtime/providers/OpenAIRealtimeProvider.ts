import { Notice } from 'obsidian';
import { IVoiceCallProvider, VoiceCallConfig } from './IVoiceCallProvider';

/**
 * OpenAI Realtime API provider implementation
 * Implements the unified interface pattern with direct SDP exchange
 */
export class OpenAIRealtimeProvider implements IVoiceCallProvider {
  private sessionEndpoint = 'https://api.openai.com/v1/realtime/calls';

  getName(): string {
    return 'OpenAI Realtime API';
  }

  /**
   * Starts a voice call session with OpenAI Realtime API
   */
  async startSession(
    peerConnection: RTCPeerConnection,
    localStream: MediaStream,
    config: VoiceCallConfig,
  ): Promise<void> {
    // Create offer and set local description
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Prepare session configuration as per OpenAI docs
    const sessionConfig = {
      type: 'realtime',
      model: config.model || 'gpt-realtime',
      instructions: config.instructions || 'You are a helpful assistant.',
      ...(config.voice && { audio: { output: { voice: config.voice } } }),
    };

    // Create FormData with SDP and session config (unified interface pattern)
    const formData = new FormData();
    formData.append('sdp', offer.sdp || '');
    formData.append('session', JSON.stringify(sessionConfig));

    // Note: Using native fetch instead of requestUrl because:
    // 1. OpenAI's unified interface requires multipart/form-data
    // 2. requestUrl may not properly handle FormData body
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

    new Notice('Voice call started');
  }

  /**
   * Sets up the OpenAI-specific data channel ('oai-events')
   */
  setupDataChannel(
    dataChannel: RTCDataChannel,
    onServerEvent?: (event: unknown) => void,
  ): void {
    dataChannel.addEventListener('open', () => {
      new Notice('Connected to OpenAI realtime API');
    });

    dataChannel.addEventListener('message', event => {
      try {
        const eventData = String(event.data);
        const serverEvent = JSON.parse(eventData) as unknown;
        if (onServerEvent) {
          onServerEvent(serverEvent);
        }
      } catch (error) {
        console.error('Failed to parse server event:', error);
      }
    });

    dataChannel.addEventListener('error', error => {
      console.error('Data channel error:', error);
    });

    dataChannel.addEventListener('close', () => {
      // Connection closed
    });
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

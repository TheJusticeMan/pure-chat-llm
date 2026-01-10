import { Notice } from 'obsidian';
import { CallState } from '../types';

/**
 * Manages WebRTC connections to OpenAI Realtime API.
 * Implements the unified interface pattern with direct SDP exchange.
 */
export class VoiceCall {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private state: CallState = {
    status: 'idle',
    isMuted: false,
    isLocalAudioEnabled: false,
    remoteParticipants: [],
  };

  constructor(
    private sessionEndpoint: string,
    private apiKey: string,
    private onStateChange: (state: CallState) => void,
    private onServerEvent?: (event: unknown) => void,
  ) {}

  /**
   * Initializes and starts a voice call using OpenAI Realtime API
   */
  async startCall(): Promise<void> {
    try {
      console.debug('[VoiceCall] Starting call initialization...');
      this.updateState({ status: 'connecting' });

      // Create peer connection
      console.debug('[VoiceCall] Creating RTCPeerConnection...');
      this.peerConnection = new RTCPeerConnection();

      // Set up data channel for sending and receiving events
      console.debug('[VoiceCall] Setting up data channel "oai-events"...');
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannel();

      // Request microphone access
      console.debug('[VoiceCall] Requesting microphone access...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      console.debug('[VoiceCall] Microphone access granted');

      this.state.isLocalAudioEnabled = true;

      // Add local audio track for microphone input
      console.debug('[VoiceCall] Adding local audio tracks to peer connection...');
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Handle remote audio tracks
      this.peerConnection.ontrack = event => {
        console.debug('[VoiceCall] Received remote track');
        // Remote audio will be handled by the UI layer
        if (event.streams && event.streams[0]) {
          this.updateState({ status: 'connected' });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.debug(`[VoiceCall] Connection state changed: ${state}`);
        if (state === 'disconnected' || state === 'failed') {
          this.updateState({ status: 'disconnected' });
        } else if (state === 'connected') {
          this.updateState({ status: 'connected' });
        }
      };

      // Create offer and set local description
      console.debug('[VoiceCall] Creating SDP offer...');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.debug('[VoiceCall] Local description set');

      // Prepare session configuration as per OpenAI docs
      const sessionConfig = {
        type: 'realtime',
        model: 'gpt-4o-realtime-preview-2024-12-17',
        modalities: ['audio', 'text'],
        instructions: 'You are a helpful assistant.',
      };

      console.debug('[VoiceCall] Session config:', sessionConfig);
      console.debug('[VoiceCall] Endpoint:', this.sessionEndpoint);
      console.debug('[VoiceCall] SDP offer length:', offer.sdp?.length || 0);

      // Create FormData with SDP and session config (unified interface pattern)
      // Note: Obsidian's requestUrl may not support FormData directly
      // We need to use the underlying fetch API or build the multipart/form-data manually
      const formData = new FormData();
      formData.append('sdp', offer.sdp || '');
      formData.append('session', JSON.stringify(sessionConfig));

      console.debug('[VoiceCall] Sending request to OpenAI...');

      try {
        // Note: Using native fetch instead of requestUrl because:
        // 1. OpenAI's unified interface requires multipart/form-data
        // 2. requestUrl may not properly handle FormData body
        // eslint-disable-next-line no-restricted-globals
        const response = await fetch(this.sessionEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: formData,
        });

        console.debug(`[VoiceCall] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[VoiceCall] Failed to create session:', errorText);
          throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
        }

        // Set remote description from OpenAI's answer
        const answerSdp = await response.text();
        console.debug('[VoiceCall] Received answer SDP, length:', answerSdp.length);
        console.debug('[VoiceCall] Setting remote description...');
        const answer: RTCSessionDescriptionInit = {
          type: 'answer',
          sdp: answerSdp,
        };
        await this.peerConnection.setRemoteDescription(answer);
        console.debug('[VoiceCall] Remote description set successfully');

        new Notice('Voice call started');
      } catch (fetchError) {
        console.error('[VoiceCall] Fetch error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('[VoiceCall] Failed to start call:', error);
      if (error instanceof Error) {
        console.error('[VoiceCall] Error details:', {
          message: error.message,
          stack: error.stack,
        });
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to start voice call';
      this.updateState({ status: 'error', error: errorMessage });

      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        new Notice('Microphone permission denied. Please allow microphone access.');
      } else {
        new Notice(`Call error: ${errorMessage}`);
      }
    }
  }

  /**
   * Sets up the data channel for sending and receiving Realtime API events
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.addEventListener('open', () => {
      console.debug('[VoiceCall] Data channel opened');
      new Notice('Connected to OpenAI realtime API');
    });

    this.dataChannel.addEventListener('message', event => {
      try {
        const eventData = String(event.data);
        console.debug('[VoiceCall] Received server event:', eventData.substring(0, 200));
        const serverEvent = JSON.parse(eventData) as unknown;
        if (this.onServerEvent) {
          this.onServerEvent(serverEvent);
        }
      } catch (error) {
        console.error('[VoiceCall] Failed to parse server event:', error);
      }
    });

    this.dataChannel.addEventListener('error', error => {
      console.error('[VoiceCall] Data channel error:', error);
      this.updateState({ status: 'error', error: 'Data channel error' });
    });

    this.dataChannel.addEventListener('close', () => {
      console.debug('[VoiceCall] Data channel closed');
      this.updateState({ status: 'disconnected' });
    });
  }

  /**
   * Sends a client event to the Realtime API via data channel
   */
  sendEvent(event: unknown): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      console.warn('Data channel not open, cannot send event');
    }
  }

  /**
   * Toggles microphone mute state
   */
  toggleMute(): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.state.isMuted = !this.state.isMuted;
      this.onStateChange({ ...this.state });
      new Notice(this.state.isMuted ? 'Microphone muted' : 'Microphone unmuted');
    }
  }

  /**
   * Ends the voice call and cleans up resources
   */
  async endCall(): Promise<void> {
    try {
      // Close data channel
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }

      // Stop local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      this.updateState({
        status: 'idle',
        isMuted: false,
        isLocalAudioEnabled: false,
        remoteParticipants: [],
      });

      new Notice('Voice call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  /**
   * Gets the peer connection for accessing remote tracks
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  /**
   * Gets the current call state
   */
  getState(): CallState {
    return { ...this.state };
  }

  /**
   * Updates the call state and notifies listeners
   */
  private updateState(update: Partial<CallState>): void {
    this.state = { ...this.state, ...update };
    this.onStateChange(this.state);
  }
}

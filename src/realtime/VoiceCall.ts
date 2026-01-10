import { Notice } from 'obsidian';
import { CallState } from '../types';
import { IVoiceCallProvider, VoiceCallConfig } from './providers/IVoiceCallProvider';

/**
 * Manages WebRTC voice call connections using a provider pattern.
 * Supports multiple voice call providers through the IVoiceCallProvider interface.
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
    private provider: IVoiceCallProvider,
    private config: VoiceCallConfig,
    private onStateChange: (state: CallState) => void,
    private onServerEvent?: (event: unknown) => void,
    private onRemoteTrack?: (stream: MediaStream) => void,
    private dataChannelName: string = 'oai-events',
  ) {}

  /**
   * Initializes and starts a voice call using the configured provider
   */
  async startCall(): Promise<void> {
    try {
      this.updateState({ status: 'connecting' });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection();

      // Set up data channel for sending and receiving events
      this.dataChannel = this.peerConnection.createDataChannel(this.dataChannelName);
      this.provider.setupDataChannel(this.dataChannel, this.onServerEvent);

      // Request microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.state.isLocalAudioEnabled = true;

      // Add local audio track for microphone input
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Handle remote audio tracks
      this.peerConnection.ontrack = event => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          
          // Notify UI layer of remote track
          if (this.onRemoteTrack) {
            this.onRemoteTrack(stream);
          }
          
          this.updateState({ status: 'connected' });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'disconnected' || state === 'failed') {
          this.updateState({ status: 'disconnected' });
        } else if (state === 'connected') {
          this.updateState({ status: 'connected' });
        }
      };

      // Use provider to establish session
      await this.provider.startSession(
        this.peerConnection,
        this.localStream,
        this.config,
      );
    } catch (error) {
      console.error('Failed to start call:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start voice call';
      this.updateState({ status: 'error', error: errorMessage });

      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        new Notice('Microphone permission denied. Please allow microphone access.');
      } else {
        new Notice(`Call error: ${errorMessage}`);
      }
    }
  }

  /**
   * Sends a client event to the provider via data channel
   */
  sendEvent(event: unknown): void {
    if (this.dataChannel) {
      this.provider.sendEvent(this.dataChannel, event);
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
      // Provider-specific cleanup
      await this.provider.cleanup();

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

import { Notice } from 'obsidian';
import { CallState } from '../types';
import { IVoiceCallProvider, VoiceCallConfig } from './providers/IVoiceCallProvider';

/**
 * Manages voice call sessions using a provider pattern.
 * Handles microphone access, UI state, and delegates transport to the provider.
 */
export class VoiceCall {
  private localStream: MediaStream | null = null;
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
  ) {
    // Wire up provider callbacks
    this.provider.onRemoteTrack(stream => {
      if (this.onRemoteTrack) {
        this.onRemoteTrack(stream);
      }
    });

    this.provider.onMessage(event => {
      if (this.onServerEvent) {
        this.onServerEvent(event);
      }
    });

    this.provider.onError(error => {
      this.updateState({ status: 'error', error: error.message });
      new Notice(`Call error: ${error.message}`);
    });
  }

  /**
   * Initializes and starts a voice call
   */
  async startCall(): Promise<void> {
    try {
      this.updateState({ status: 'connecting', error: undefined });

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

      // Connect using the provider
      await this.provider.connect(this.localStream, this.config);

      this.updateState({ status: 'connected' });
      new Notice(`Call started with ${this.provider.getName()}`);
    } catch (error) {
      console.error('Failed to start call:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start voice call';
      this.updateState({ status: 'error', error: errorMessage });

      // Clean up stream if acquired but connection failed
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        new Notice('Microphone permission denied. Please allow microphone access.');
      } else {
        new Notice(`Call connection failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Sends a client event to the provider
   */
  sendEvent(event: unknown): void {
    if (this.state.status === 'connected') {
      this.provider.send(event);
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
      // Provider cleanup
      await this.provider.disconnect();

      // Stop local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
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
      // Even if cleanup fails, ensure UI is reset
      this.updateState({ status: 'idle' });
    }
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

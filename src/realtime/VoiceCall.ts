import { Notice } from 'obsidian';
import { CallSignaling } from './CallSignaling';
import { CallState, SignalingMessage } from '../types';

/**
 * Manages WebRTC peer-to-peer voice connections.
 * Handles audio streams, peer connection setup, and signaling.
 */
export class VoiceCall {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signaling: CallSignaling | null = null;
  private state: CallState = {
    status: 'idle',
    isMuted: false,
    isLocalAudioEnabled: false,
    remoteParticipants: [],
  };

  constructor(
    private signalingUrl: string,
    private onStateChange: (state: CallState) => void,
    private iceServers?: RTCIceServer[],
  ) {
    // Default ICE servers for STUN/TURN
    this.iceServers = iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  /**
   * Initializes and starts a voice call
   */
  async startCall(): Promise<void> {
    try {
      this.updateState({ status: 'connecting' });

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

      // Setup signaling
      this.signaling = new CallSignaling(
        this.signalingUrl,
        message => {
          void this.handleSignalingMessage(message);
        },
        connected => {
          if (!connected && this.state.status === 'connected') {
            this.updateState({ status: 'error', error: 'Signaling connection lost' });
          }
        },
      );

      await this.signaling.connect();

      // Create peer connection
      this.createPeerConnection();

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Send join message
      this.signaling.send({ type: 'join' });

      new Notice('Voice call started');
      this.updateState({ status: 'connected' });
    } catch (error) {
      console.error('Failed to start call:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to start voice call';
      this.updateState({ status: 'error', error: errorMessage });

      if (errorMessage.includes('Permission denied')) {
        new Notice('Microphone permission denied. Please allow microphone access.');
      } else {
        new Notice(`Call error: ${errorMessage}`);
      }
    }
  }

  /**
   * Creates and configures the RTCPeerConnection
   */
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = event => {
      if (event.candidate && this.signaling) {
        this.signaling.send({
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote tracks
    this.peerConnection.ontrack = event => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream?.addTrack(track);
      });
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
  }

  /**
   * Handles incoming signaling messages
   */
  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    try {
      if (!this.peerConnection) return;

      switch (message.type) {
        case 'offer': {
          if (message.data) {
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(message.data as RTCSessionDescriptionInit),
            );
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            if (this.signaling) {
              this.signaling.send({
                type: 'answer',
                data: answer,
              });
            }
          }
          break;
        }

        case 'answer': {
          if (message.data) {
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(message.data as RTCSessionDescriptionInit),
            );
          }
          break;
        }

        case 'ice-candidate': {
          if (message.data) {
            await this.peerConnection.addIceCandidate(
              new RTCIceCandidate(message.data as RTCIceCandidateInit),
            );
          }
          break;
        }

        case 'join': {
          // Create and send offer when someone joins
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);

          if (this.signaling) {
            this.signaling.send({
              type: 'offer',
              data: offer,
            });
          }
          break;
        }

        case 'leave':
          // Handle peer leaving
          new Notice('Participant left the call');
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
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
      // Send leave message
      if (this.signaling) {
        this.signaling.send({ type: 'leave' });
        this.signaling.disconnect();
        this.signaling = null;
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

      // Clear remote stream
      this.remoteStream = null;

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
   * Gets the remote audio stream for playback
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
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

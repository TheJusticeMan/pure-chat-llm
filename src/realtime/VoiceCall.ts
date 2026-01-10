import { Notice, requestUrl } from 'obsidian';
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
      this.updateState({ status: 'connecting' });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection();

      // Set up data channel for sending and receiving events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannel();

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
        // Remote audio will be handled by the UI layer
        if (event.streams && event.streams[0]) {
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

      // Create offer and set local description
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send SDP to server endpoint (unified interface pattern)
      const sdpResponse = await requestUrl({
        url: this.sessionEndpoint,
        method: 'POST',
        body: offer.sdp || '',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (sdpResponse.status !== 200) {
        throw new Error(`Failed to create session: ${sdpResponse.status}`);
      }

      // Set remote description from OpenAI's answer
      const answerSdp = sdpResponse.text;
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp,
      };
      await this.peerConnection.setRemoteDescription(answer);

      new Notice('Voice call started');
    } catch (error) {
      console.error('Failed to start call:', error);
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
      new Notice('Connected to OpenAI realtime API');
    });

    this.dataChannel.addEventListener('message', event => {
      try {
        const eventData = String(event.data);
        const serverEvent = JSON.parse(eventData) as unknown;
        if (this.onServerEvent) {
          this.onServerEvent(serverEvent);
        }
      } catch (error) {
        console.error('Failed to parse server event:', error);
      }
    });

    this.dataChannel.addEventListener('error', error => {
      console.error('Data channel error:', error);
      this.updateState({ status: 'error', error: 'Data channel error' });
    });

    this.dataChannel.addEventListener('close', () => {
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

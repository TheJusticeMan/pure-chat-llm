/**
 * Configuration for initializing a voice call session
 */
export interface VoiceCallConfig {
  apiKey: string;
  endpoint: string;
  model?: string;
  instructions?: string;
  voice?: string;
  [key: string]: unknown;
}

/**
 * Interface for voice call providers
 * Implementations should handle provider-specific WebRTC setup and signaling
 */
export interface IVoiceCallProvider {
  /**
   * Initializes and starts a voice call session
   * @param peerConnection The RTCPeerConnection to use
   * @param localStream The local audio stream
   * @param config Provider-specific configuration
   */
  startSession(
    peerConnection: RTCPeerConnection,
    localStream: MediaStream,
    config: VoiceCallConfig,
  ): Promise<void>;

  /**
   * Sets up provider-specific data channel for events
   * @param dataChannel The RTCDataChannel to configure
   * @param onServerEvent Callback for server events
   */
  setupDataChannel(
    dataChannel: RTCDataChannel,
    onServerEvent?: (event: unknown) => void,
  ): void;

  /**
   * Sends a client event to the provider
   * @param dataChannel The data channel to send through
   * @param event The event to send
   */
  sendEvent(dataChannel: RTCDataChannel, event: unknown): void;

  /**
   * Cleans up provider-specific resources
   */
  cleanup(): Promise<void>;

  /**
   * Gets the provider name
   */
  getName(): string;
}

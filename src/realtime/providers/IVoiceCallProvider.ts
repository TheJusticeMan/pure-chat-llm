import { ToolDefinition } from '../../types';

/**
 * Configuration for initializing a voice call session
 */
export interface VoiceCallConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
  instructions?: string;
  voice?: string;
  tools?: ToolDefinition[];
  [key: string]: unknown;
}

/**
 * Interface for tool execution capability
 */
export interface IToolExecutor {
  executeTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  getToolDefinitions(): ToolDefinition[];
}

/**
 * Interface for voice call providers
 * Decouples the transport (WebRTC vs WebSocket) from the application logic
 */
export interface IVoiceCallProvider {
  /**
   * Initializes and starts a voice call session
   * @param localStream The local audio stream from user's microphone
   * @param config Provider-specific configuration
   */
  connect(localStream: MediaStream, config: VoiceCallConfig): Promise<void>;

  /**
   * Disconnects the session and cleans up resources
   */
  disconnect(): Promise<void>;

  /**
   * Sends a generic event to the provider
   * @param event The event payload
   */
  send(event: unknown): void;

  /**
   * Gets the provider name
   */
  getName(): string;

  /**
   * Callback for when a remote audio stream is received
   */
  onRemoteTrack(callback: (stream: MediaStream) => void): void;

  /**
   * Callback for when a server event is received
   */
  onMessage(callback: (event: unknown) => void): void;

  /**
   * Callback for error handling
   */
  onError(callback: (error: Error) => void): void;
}

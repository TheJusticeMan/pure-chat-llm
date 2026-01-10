import { Notice } from 'obsidian';
import { SignalingMessage } from '../types';

/**
 * Handles WebSocket signaling for WebRTC voice calls via the /realtime/calls endpoint.
 * Manages the exchange of offer, answer, and ICE candidates between peers.
 */
export class CallSignaling {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private signalingUrl: string,
    private onMessage: (message: SignalingMessage) => void,
    private onConnectionChange: (connected: boolean) => void,
  ) {}

  /**
   * Establishes WebSocket connection to the signaling server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.signalingUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.onConnectionChange(true);
          new Notice('Connected to signaling server');
          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const data = String(event.data);
            const message = JSON.parse(data) as SignalingMessage;
            this.onMessage(message);
          } catch (error) {
            console.error('Failed to parse signaling message:', error);
          }
        };

        this.ws.onerror = error => {
          console.error('WebSocket error:', error);
          new Notice('Signaling connection error');
        };

        this.ws.onclose = () => {
          this.onConnectionChange(false);
          this.attemptReconnect();
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown WebSocket error');
        reject(err);
      }
    });
  }

  /**
   * Sends a signaling message to the server
   */
  send(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }

  /**
   * Attempts to reconnect to the signaling server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;

      setTimeout(() => {
        new Notice(`Reconnecting... (Attempt ${this.reconnectAttempts})`);
        void this.connect().catch(() => {
          // Silently handle reconnection errors
        });
      }, delay);
    } else {
      new Notice('Failed to reconnect to signaling server');
    }
  }

  /**
   * Closes the WebSocket connection
   */
  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Checks if the signaling connection is active
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

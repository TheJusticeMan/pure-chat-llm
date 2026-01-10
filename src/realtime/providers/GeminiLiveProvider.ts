import { Notice } from 'obsidian';
import { IVoiceCallProvider, VoiceCallConfig } from './IVoiceCallProvider';

/**
 * Google Gemini Live API provider implementation
 * Uses WebSocket connection for real-time audio streaming
 * Adapts Gemini's WebSocket protocol to work with WebRTC peer connections
 */
export class GeminiLiveProvider implements IVoiceCallProvider {
	protected ws: WebSocket | null = null;
	protected audioContext: AudioContext | null = null;
	protected mediaStreamSource: MediaStreamAudioSourceNode | null = null;
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	protected scriptProcessor: ScriptProcessorNode | null = null;
	protected remoteAudioQueue: ArrayBuffer[] = [];
	protected isPlaying = false;

	getName(): string {
		return 'Google Gemini Live API';
	}

	/**
	 * Starts a voice call session with Google Gemini Live API
	 */
	async startSession(
		peerConnection: RTCPeerConnection,
		localStream: MediaStream,
		config: VoiceCallConfig,
	): Promise<void> {
		// Determine WebSocket endpoint
		const wsEndpoint = config.endpoint || this.getDefaultEndpoint(config.apiKey, config.model);

		// Connect to Gemini Live API via WebSocket
		this.ws = new WebSocket(wsEndpoint);
		this.ws.binaryType = 'arraybuffer';

		// Set up audio context for processing
		this.audioContext = new AudioContext({ sampleRate: 16000 });
		this.mediaStreamSource = this.audioContext.createMediaStreamSource(localStream);

		// Create script processor for capturing audio
		// Note: Using deprecated createScriptProcessor for compatibility
		// TODO: Migrate to AudioWorklet when browser support is widespread
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

		await new Promise<void>((resolve, reject) => {
			if (!this.ws) {
				reject(new Error('WebSocket not initialized'));
				return;
			}

			this.ws.onopen = () => {
				// Send setup message
				this.sendSetupMessage(config);
				resolve();
			};

			this.ws.onerror = (error: Event) => {
				reject(new Error(`WebSocket connection error: ${error.type || 'unknown'}`));
			};

			this.ws.onmessage = event => {
				this.handleWebSocketMessage(event);
			};

			this.ws.onclose = () => {
				void this.cleanup();
			};

			// Timeout after 10 seconds
			void setTimeout(() => reject(new Error('Connection timeout')), 10000);
		});

		// Start audio streaming
		// Note: Using deprecated ScriptProcessorNode for compatibility
		// TODO: Migrate to AudioWorklet when browser support is widespread
		this.startAudioStreaming(localStream);

		new Notice('Voice call started');
	}

	/**
	 * Gets the default Gemini Live API endpoint
	 */
	private getDefaultEndpoint(apiKey: string, model?: string): string {
		const modelName = model || 'gemini-2.0-flash-exp';
		return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}&alt=sse&model=${modelName}`;
	}

	/**
	 * Sends the setup message to configure the Gemini session
	 */
	protected sendSetupMessage(config: VoiceCallConfig): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const setupMessage = {
			setup: {
				model: config.model || 'models/gemini-2.0-flash-exp',
				generation_config: {
					response_modalities: ['AUDIO'],
					speech_config: {
						voice_config: {
							prebuilt_voice_config: {
								voice_name: config.voice || 'Puck',
							},
						},
					},
				},
				system_instruction: {
					parts: [
						{
							text: config.instructions || 'You are a helpful assistant.',
						},
					],
				},
			},
		};

		this.ws.send(JSON.stringify(setupMessage));
	}

	/**
	 * Starts streaming audio from the microphone to Gemini
	 */
	private startAudioStreaming(localStream: MediaStream): void {
		if (!this.scriptProcessor || !this.mediaStreamSource || !this.audioContext) return;

		// Note: Using deprecated onaudioprocess and inputBuffer for compatibility
		// TODO: Migrate to AudioWorklet when browser support is widespread
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		this.scriptProcessor.onaudioprocess = event => {
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			const inputData = event.inputBuffer.getChannelData(0);
			const pcm16 = this.convertFloat32ToPCM16(inputData);
			this.sendAudioChunk(pcm16);
		};

		this.mediaStreamSource.connect(this.scriptProcessor);
		this.scriptProcessor.connect(this.audioContext.destination);
	}

	/**
	 * Converts Float32Array audio to PCM16 format
	 */
	private convertFloat32ToPCM16(float32Array: Float32Array): Int16Array {
		const pcm16 = new Int16Array(float32Array.length);
		for (let i = 0; i < float32Array.length; i++) {
			const s = Math.max(-1, Math.min(1, float32Array[i]));
			pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}
		return pcm16;
	}

	/**
	 * Sends an audio chunk to Gemini
	 */
	private sendAudioChunk(pcm16: Int16Array): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		// Create a new ArrayBuffer from the typed array to avoid SharedArrayBuffer issues
		const arrayBuffer = new ArrayBuffer(pcm16.byteLength);
		new Uint8Array(arrayBuffer).set(new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength));
		const base64Audio = this.arrayBufferToBase64(arrayBuffer);
		const message = {
			realtime_input: {
				media_chunks: [
					{
						mime_type: 'audio/pcm',
						data: base64Audio,
					},
				],
			},
		};

		this.ws.send(JSON.stringify(message));
	}

	/**
	 * Handles incoming WebSocket messages from Gemini
	 */
	protected handleWebSocketMessage(event: MessageEvent): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const data = JSON.parse(event.data as string);

			// Handle setup complete
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (data.setupComplete) {
				new Notice('Connected to API');
			}

			// Handle server content (audio response)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (data.serverContent && data.serverContent.modelTurn) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				const parts = data.serverContent.modelTurn.parts;
				for (const part of parts) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
						// Decode and queue audio for playback
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
						const audioData = this.base64ToArrayBuffer(part.inlineData.data);
						this.remoteAudioQueue.push(audioData);
						void this.playQueuedAudio();
					}
				}
			}

			// Handle tool calls
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (data.serverContent && data.serverContent.toolCall) {
				// Tool calls would be handled here if needed
			}
		} catch (error) {
			console.error('Failed to parse Gemini message:', error);
		}
	}

	/**
	 * Plays queued audio from Gemini
	 */
	private async playQueuedAudio(): Promise<void> {
		if (this.isPlaying || this.remoteAudioQueue.length === 0 || !this.audioContext) return;

		this.isPlaying = true;

		while (this.remoteAudioQueue.length > 0) {
			const audioData = this.remoteAudioQueue.shift();
			if (!audioData) continue;

			try {
				const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
				const source = this.audioContext.createBufferSource();
				source.buffer = audioBuffer;
				source.connect(this.audioContext.destination);
				source.start();

				// Wait for audio to finish playing
				await new Promise(resolve => {
					source.onended = resolve;
				});
			} catch (error) {
				console.error('Failed to play audio:', error);
			}
		}

		this.isPlaying = false;
	}

	/**
	 * Converts ArrayBuffer to Base64
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Converts Base64 to ArrayBuffer
	 */
	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	/**
	 * Sets up the data channel (not used by Gemini, but required by interface)
	 */
	setupDataChannel(dataChannel: RTCDataChannel, onServerEvent?: (event: unknown) => void): void {
		// Gemini uses WebSocket, not RTCDataChannel
		// This method is here to satisfy the interface but isn't used
		dataChannel.addEventListener('open', () => {
			// No-op: Gemini doesn't use RTCDataChannel
		});
	}

	/**
	 * Sends an event (not used by Gemini WebSocket, but required by interface)
	 */
	sendEvent(dataChannel: RTCDataChannel, event: unknown): void {
		// Gemini uses WebSocket for all communication
		// Events would be sent via this.ws instead
	}

	/**
	 * Cleans up Gemini-specific resources
	 */
	async cleanup(): Promise<void> {
		// Stop audio processing
		if (this.scriptProcessor) {
			this.scriptProcessor.disconnect();
			this.scriptProcessor = null;
		}

		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
			this.mediaStreamSource = null;
		}

		if (this.audioContext && this.audioContext.state !== 'closed') {
			await this.audioContext.close();
			this.audioContext = null;
		}

		// Close WebSocket
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.close();
			this.ws = null;
		}

		// Clear audio queue
		this.remoteAudioQueue = [];
		this.isPlaying = false;
	}
}

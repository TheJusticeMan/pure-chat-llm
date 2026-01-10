import { Notice } from 'obsidian';
import { PureChatLLMChat } from '../../Chat';
import { GeminiLiveProvider } from './GeminiLiveProvider';
import { VoiceCallConfig } from './IVoiceCallProvider';

/**
 * Google Gemini Live API provider with tool/function calling support
 * Extends GeminiLiveProvider to integrate with PureChatLLMChat tool registry
 */
export class GeminiLiveProviderWithTools extends GeminiLiveProvider {
	constructor(private chat: PureChatLLMChat) {
		super();
	}

	getName(): string {
		return 'Google Gemini Live API (with tools)';
	}

	/**
	 * Starts a voice call session with tool support
	 */
	async startSession(
		peerConnection: RTCPeerConnection,
		localStream: MediaStream,
		config: VoiceCallConfig,
	): Promise<void> {
		// Get tool definitions from the chat's tool registry
		const toolDefinitions = this.chat.toolregistry.getAllDefinitions();

		// Transform tool definitions to Gemini's format
		// Gemini uses a similar format to OpenAI's Chat Completions API
		const tools = toolDefinitions.map(tool => ({
			function_declarations: [
				{
					name: tool.function.name,
					description: tool.function.description,
					parameters: tool.function.parameters,
				},
			],
		}));

		// Add tools to config for the setup message
		const enhancedConfig = {
			...config,
			tools: tools,
		};

		// Call parent implementation with enhanced config
		await super.startSession(peerConnection, localStream, enhancedConfig);
	}

	/**
	 * Override sendSetupMessage to include tools
	 */
	protected sendSetupMessage(config: VoiceCallConfig): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const setupMessage: Record<string, unknown> = {
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
							text: config.instructions || 'You are a helpful assistant with access to tools.',
						},
					],
				},
			},
		};

		// Add tools if available
		if (config.tools && Array.isArray(config.tools) && config.tools.length > 0) {
			(setupMessage.setup as Record<string, unknown>).tools = config.tools;
		}

		this.ws.send(JSON.stringify(setupMessage));
	}

	/**
	 * Override handleWebSocketMessage to process tool calls
	 */
	protected handleWebSocketMessage(event: MessageEvent): void {
		// Call parent handler first
		super.handleWebSocketMessage(event);

		try {
			const data = JSON.parse(event.data);

			// Handle tool calls
			if (data.serverContent && data.serverContent.toolCall) {
				this.handleToolCall(data.serverContent.toolCall);
			}

			// Handle function calls within tool call requests
			if (data.serverContent && data.serverContent.modelTurn) {
				const parts = data.serverContent.modelTurn.parts;
				for (const part of parts) {
					if (part.functionCall) {
						this.handleFunctionCall(part.functionCall);
					}
				}
			}
		} catch (error) {
			console.error('Failed to process tool call:', error);
		}
	}

	/**
	 * Handles tool call requests from Gemini
	 */
	private async handleToolCall(toolCall: unknown): Promise<void> {
		try {
			const functionCall = toolCall as { name: string; args: Record<string, unknown> };
			await this.handleFunctionCall(functionCall);
		} catch (error) {
			console.error('Failed to handle tool call:', error);
		}
	}

	/**
	 * Handles function call requests from Gemini
	 */
	private async handleFunctionCall(functionCall: { name: string; args: Record<string, unknown> }): Promise<void> {
		try {
			new Notice(`Executing tool: ${functionCall.name}`);

			// Execute the tool via the chat's tool registry
			const result = await this.chat.toolregistry.executeTool(functionCall.name, functionCall.args);

			// Send tool response back to Gemini
			this.sendToolResponse(functionCall.name, result);
		} catch (error) {
			console.error(`Failed to execute tool ${functionCall.name}:`, error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.sendToolResponse(functionCall.name, { error: errorMessage });
		}
	}

	/**
	 * Sends tool execution results back to Gemini
	 */
	private sendToolResponse(toolName: string, result: unknown): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const toolResponse = {
			tool_response: {
				function_responses: [
					{
						name: toolName,
						response: result,
					},
				],
			},
		};

		this.ws.send(JSON.stringify(toolResponse));
	}
}

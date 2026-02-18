import { Menu, Notice } from 'obsidian';
import {
  ChatRequestOptions,
  ChatResponse,
  PureChatLLMAPI,
  RoleType,
  StreamDelta,
  ToolCall,
} from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';

/**
 * Service class for handling LLM API communication
 */
export class LLMService {
  console: BrowserConsole;

  /**
   * Creates a new LLMService instance
   * @param debug - Whether to enable debug logging
   */
  constructor(debug: boolean) {
    this.console = new BrowserConsole(debug, 'LLMService');
  }

  /**
   * Gets the appropriate HTTP headers for the given endpoint
   * @param endpoint - The API endpoint configuration
   * @returns An object containing the required HTTP headers
   */
  getHeaders(endpoint: PureChatLLMAPI): Record<string, string> {
    if (endpoint.endpoint.includes('api.anthropic.com')) {
      return {
        'x-api-key': endpoint.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };
    }
    return {
      Authorization: `Bearer ${endpoint.apiKey}`,
      'content-type': 'application/json',
    };
  }

  stopping = false;

  /**
   * Sends a chat request to the LLM API and handles the response
   * @param endpoint - The API endpoint configuration
   * @param options - The chat request options
   * @param statusCallback - Optional callback for status updates
   * @param streamCallback - Optional callback for streaming responses
   * @returns Promise resolving to the chat response
   */
  async fetchResponse(
    endpoint: PureChatLLMAPI,
    options: ChatRequestOptions,
    statusCallback?: (status: string, onMenu?: (menu: Menu) => Menu) => void,
    streamCallback?: (textFragment: StreamDelta) => Promise<void>,
  ): Promise<ChatResponse> {
    this.console.log('Sending chat request with options:', options);
    statusCallback?.(`running: ${options.model}`, menu =>
      menu.addItem(item =>
        item
          .setTitle('Stop')
          .setIcon('cross')
          .onClick(() => (this.stopping = true)),
      ),
    );

    const requestOptions = { ...options };

    // Mistral AI uses max_tokens instead of max_completion_tokens
    if (endpoint.name === 'Mistral AI' && requestOptions.max_completion_tokens) {
      requestOptions.max_tokens = requestOptions.max_completion_tokens;
      delete requestOptions.max_completion_tokens;
    }

    let response: Response;
    try {
      // eslint-disable-next-line no-restricted-globals
      response = await fetch(`${endpoint.endpoint}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(endpoint),
        body: JSON.stringify({
          ...requestOptions,
          stream: requestOptions.stream && !!streamCallback,
        }),
      });
    } catch (error) {
      this.console.error(`Network request failed:`, error);
      statusCallback?.('');
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(
        `Network error: Unable to connect to ${endpoint.name}. Check your internet connection.`,
      );
      throw new Error(`Network request failed: ${errorMsg}`);
    }

    if (!response.ok) {
      statusCallback?.('');
      let errorMessage = `API Error (${response.status}): ${response.statusText}`;
      let userMessage = `Error from ${endpoint.name}: ${response.statusText}`;

      try {
        const errorData = (await response.json()) as { error?: string | { message?: string } };
        if (errorData.error) {
          let apiError: string;
          if (typeof errorData.error === 'string') {
            apiError = errorData.error;
          } else if (errorData.error.message) {
            apiError = errorData.error.message;
          } else {
            apiError = JSON.stringify(errorData.error);
          }
          errorMessage = `API Error: ${apiError}`;
          userMessage = `${endpoint.name}: ${apiError}`;
        }
      } catch (parseError) {
        this.console.error(`Failed to parse error response:`, parseError);
      }

      this.console.error(errorMessage);

      if (response.status === 401) {
        new Notice(`Authentication failed: Please check your API key for ${endpoint.name}.`);
      } else if (response.status === 429) {
        new Notice(`Rate limit exceeded for ${endpoint.name}. Please wait and try again.`);
      } else if (response.status === 400) {
        new Notice(`Invalid request: ${userMessage}`);
      } else if (response.status === 403) {
        new Notice(`Access forbidden: Check your API permissions for ${endpoint.name}.`);
      } else if (response.status === 404) {
        new Notice(`Endpoint not found: ${endpoint.endpoint} may be incorrect.`);
      } else if (response.status >= 500) {
        new Notice(`Server error from ${endpoint.name}: ${response.statusText}. Try again later.`);
      } else {
        new Notice(userMessage);
      }

      throw new Error(errorMessage);
    }

    if (options.stream && !!streamCallback) {
      try {
        const fullText = await this.handleStreamingResponse(response, streamCallback);
        statusCallback?.('');
        return fullText;
      } catch (error) {
        statusCallback?.('');
        this.console.error(`Error during streaming response:`, error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        new Notice(`Error processing streaming response: ${errorMsg}`);
        throw error;
      }
    } else {
      try {
        const data = (await response.json()) as {
          choices: { message: { role: RoleType; content?: string; tool_calls?: ToolCall[] } }[];
        };

        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          this.console.error(`Invalid API response structure:`, data);
          statusCallback?.('');
          new Notice(`Invalid response from ${endpoint.name}: Missing or empty choices array.`);
          throw new Error('Invalid API response structure: Missing choices');
        }

        if (!data.choices[0].message) {
          this.console.error(`Invalid API response structure:`, data);
          statusCallback?.('');
          new Notice(`Invalid response from ${endpoint.name}: Missing message in response.`);
          throw new Error('Invalid API response structure: Missing message');
        }
        statusCallback?.('');
        return data.choices[0].message;
      } catch (error) {
        statusCallback?.('');
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('Invalid API response structure')) {
          throw error;
        }
        this.console.error(`Error parsing API response:`, error);
        new Notice(`Error parsing response from ${endpoint.name}: ${errorMsg}`);
        throw new Error(`Failed to parse API response: ${errorMsg}`);
      }
    }
  }

  /**
   * Handles streaming response from the LLM API
   * @param response - The fetch Response object with streaming body
   * @param streamCallback - Callback function to process each text fragment
   * @returns Promise resolving to the complete chat response with full text and tool calls
   */
  async handleStreamingResponse(
    response: Response,
    streamCallback: (textFragment: StreamDelta) => Promise<void>,
  ): Promise<ChatResponse> {
    if (!response.body) {
      throw new Error('Response body is null. Streaming is not supported in this environment.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';
    let fullText = '';
    const fullcalls = new Map<string | number, ToolCall>();
    let contentBuffer = '';
    let lastFlushTime = Date.now();

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            done = true;
            break;
          }
          try {
            const data = JSON.parse(dataStr) as { choices: { delta: StreamDelta }[] };
            const delta = data.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              contentBuffer += delta.content;

              // Flush buffer if enough time has passed (100ms debouncing)
              if (Date.now() - lastFlushTime >= 100) {
                await streamCallback({ content: contentBuffer });
                contentBuffer = '';
                lastFlushTime = Date.now();
                if (this.stopping) {
                  this.stopping = false;
                  await reader.cancel();
                  done = true;
                  break;
                }
              }
            } else if (delta?.tool_calls) {
              delta.tool_calls.forEach((call: ToolCall) => {
                // Handle both OpenAI format (with index) and Gemini format (with id)
                const key = call.index ?? call.id ?? 0;
                if (key === undefined) return;
                const existing = fullcalls.get(key);
                if (!existing) {
                  fullcalls.set(key, call);
                } else {
                  // Merge function object
                  if (call.function) {
                    if (!existing.function) {
                      existing.function = { name: '', arguments: '' };
                    }
                    if (call.function.name) {
                      existing.function.name = call.function.name;
                    }
                    if (call.function.arguments) {
                      // Only append if not already present (avoid duplication)
                      if (!existing.function.arguments.includes(call.function.arguments)) {
                        existing.function.arguments += call.function.arguments;
                      }
                    }
                  }
                  // Merge other fields
                  if (call.id && !existing.id) {
                    existing.id = call.id;
                  }
                  if (call.type && !existing.type) {
                    existing.type = call.type;
                  }
                }
              });
            }
          } catch (err) {
            console.error('Error parsing streaming data:', err);
            await reader.cancel();
            throw err;
          }
        }
      }
    }

    // Flush any remaining buffered content
    if (contentBuffer) {
      await streamCallback({ content: contentBuffer });
    }

    if (fullcalls.size > 0) {
      const toolCallsArray = Array.from(fullcalls.values()).map(call => {
        delete call.index;
        return call;
      });

      return { role: 'assistant', content: fullText, tool_calls: toolCallsArray };
    }
    return { role: 'assistant', content: fullText };
  }
}

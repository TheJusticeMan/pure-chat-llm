import { Notice } from 'obsidian';
import {
  ChatRequestOptions,
  ChatResponse,
  PureChatLLMAPI,
  RoleType,
  StreamDelta,
  ToolCall,
} from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';

export class LLMService {
  console: BrowserConsole;

  constructor(debug: boolean) {
    this.console = new BrowserConsole(debug, 'LLMService');
  }

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

  async fetchResponse(
    endpoint: PureChatLLMAPI,
    options: ChatRequestOptions,
    statusCallback?: (status: string) => void,
    streamCallback?: (textFragment: StreamDelta) => Promise<boolean>,
  ): Promise<ChatResponse> {
    this.console.log('Sending chat request with options:', options);
    statusCallback?.(`running: ${options.model}`);

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

  async handleStreamingResponse(
    response: Response,
    streamCallback: (textFragment: StreamDelta) => Promise<boolean>,
  ): Promise<ChatResponse> {
    if (!response.body) {
      throw new Error('Response body is null. Streaming is not supported in this environment.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';
    let fullText = '';
    const fullcalls: ToolCall[] = [];
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
                const continueProcessing = await streamCallback({ content: contentBuffer });
                contentBuffer = '';
                lastFlushTime = Date.now();
                if (!continueProcessing) {
                  await reader.cancel();
                  done = true;
                  break;
                }
              }
            } else if (delta?.tool_calls) {
              delta.tool_calls.forEach((call: ToolCall) => {
                const index = call.index;
                if (index === undefined) return;
                if (!fullcalls[index]) fullcalls[index] = call;
                if (call.function.arguments) {
                  if (!fullcalls[index].function.arguments) {
                    fullcalls[index].function.arguments = '';
                  }
                  fullcalls[index].function.arguments += `${call.function.arguments}`;
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

    if (fullcalls.length > 0) {
      fullcalls.forEach(call => {
        delete call.index;
      });

      return { role: 'assistant', content: fullText, tool_calls: fullcalls };
    }
    return { role: 'assistant', content: fullText };
  }
}

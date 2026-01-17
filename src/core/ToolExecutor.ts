import { ChatSession } from './ChatSession';
import { ToolRegistry } from '../tools';
import { ChatRequestOptions, RoleType, StreamDelta, ToolCall } from '../types';

/**
 * ToolExecutor handles the execution of tool calls from LLM responses.
 *
 * Responsibilities:
 * - Execute tool calls using the ToolRegistry
 * - Manage tool execution flow
 * - Filter uncalled tool calls from message history
 * - Update chat session with tool execution results
 */
export class ToolExecutor {
  private streamCallback?: (delta: StreamDelta) => boolean;

  constructor(private toolRegistry: ToolRegistry) {}

  /**
   * Sets the stream callback for tool status updates.
   * @param callback - The callback function to invoke with tool status updates
   */
  setStreamCallback(callback?: (delta: StreamDelta) => boolean): void {
    this.streamCallback = callback;
    this.toolRegistry.setCallBack(callback);
  }

  /**
   * Executes tool calls and updates the session and options.
   *
   * @param toolCalls - The tool calls to execute
   * @param session - The chat session to update
   * @param options - The request options to update
   * @param assistantMessage - Optional assistant message containing the tool calls
   * @returns True if any tools were executed, false otherwise
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
    session: ChatSession,
    options: ChatRequestOptions,
    assistantMessage?: { role: RoleType; content?: string | null; tool_calls?: ToolCall[] },
  ): Promise<boolean> {
    for (const call of toolCalls) {
      const toolName = call.function.name;
      if (this.toolRegistry.getTool(toolName)) {
        this.toolRegistry.setCallBack(this.streamCallback);

        // Fix duplicated arguments if JSON is invalid
        const fixedArguments = this.fixDuplicatedArguments(call.function.arguments);
        const args = JSON.parse(fixedArguments) as Record<string, unknown>;
        const output = await this.toolRegistry.executeTool(toolName, args);

        // Add assistant message if provided
        if (assistantMessage && typeof assistantMessage.role === 'string') {
          session.appendMessage({
            role: assistantMessage.role,
            content: assistantMessage.content ?? '',
          });
        }

        // Add tool response to session
        session.appendMessage({ role: 'tool', content: output ?? '' });

        // Update request options
        options.messages.push(
          assistantMessage || { role: 'assistant', content: null, tool_calls: [call] },
          { role: 'tool', content: output, tool_call_id: call.id },
        );

        return true;
      }
    }
    return false;
  }

  /**
   * Filters out tool calls that don't have corresponding responses.
   *
   * @param msgs - The messages to filter
   * @returns Filtered messages with only called tools
   */
  filterOutUncalledToolCalls(
    msgs: {
      role: RoleType;
      content?: string;
      tool_call_id?: string;
      tool_calls?: ToolCall[];
    }[],
  ): {
    role: RoleType;
    content?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
  }[] {
    const [agent, ...responses] = msgs;
    if (agent.tool_calls) {
      agent.tool_calls = agent.tool_calls.filter(call =>
        responses.some(i => i.tool_call_id === call.id),
      );
    }
    return [agent, ...responses];
  }

  /**
   * Fixes duplicated arguments in tool calls (a known issue with some LLMs).
   * If arguments are invalid JSON and the string is duplicated, returns the first half.
   *
   * @param args - The arguments string to fix
   * @returns Fixed arguments string
   */
  private fixDuplicatedArguments(args: string): string {
    try {
      JSON.parse(args);
      return args; // Valid JSON, no fix needed
    } catch {
      // Invalid JSON, check for duplication
      const halfLength = Math.floor(args.length / 2);
      const firstHalf = args.slice(0, halfLength);
      const secondHalf = args.slice(halfLength);
      if (firstHalf === secondHalf) {
        return firstHalf;
      }
      return args;
    }
  }
}

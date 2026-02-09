import { ToolRegistry } from '../tools';
import { ChatRequestOptions, RoleType, StreamDelta, ToolCall } from '../types';
import { ChatSession } from './ChatSession';

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
  private streamCallback?: (delta: StreamDelta) => Promise<boolean>;

  /**
   *
   * @param toolRegistry
   */
  constructor(private toolRegistry: ToolRegistry) {}

  /**
   * Sets the stream callback for tool status updates.
   * @param callback - The callback function to invoke with tool status updates
   */
  setStreamCallback(callback?: (delta: StreamDelta) => Promise<boolean>): void {
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
   * @param assistantMessage.role
   * @param assistantMessage.content
   * @param assistantMessage.tool_calls
   * @returns True if any tools were executed, false otherwise
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
    session: ChatSession,
    options: ChatRequestOptions,
    assistantMessage?: { role: RoleType; content?: string | null; tool_calls?: ToolCall[] },
  ): Promise<boolean> {
    let hasExecutedAnyTool = false;
    const executedTools: { call: ToolCall; output: string }[] = [];

    // Execute all tools first
    for (const call of toolCalls) {
      const toolName = call.function.name;
      if (this.toolRegistry.getTool(toolName)) {
        this.toolRegistry.setCallBack(this.streamCallback);

        // Fix duplicated arguments if JSON is invalid
        const fixedArguments = this.fixDuplicatedArguments(call.function.arguments);
        const args = JSON.parse(fixedArguments) as Record<string, unknown>;
        const output = await this.toolRegistry.executeTool(toolName, args);

        executedTools.push({ call, output });
        hasExecutedAnyTool = true;
      }
    }

    // If any tools were executed, add the assistant message with all tool calls
    if (hasExecutedAnyTool) {
      // Add assistant message with all tool calls
      const messageToAdd = assistantMessage || {
        role: 'assistant' as RoleType,
        content: null,
        tool_calls: toolCalls,
      };

      session.appendMessage({
        role: messageToAdd.role,
        content: messageToAdd.content ?? '',
      });

      options.messages.push(messageToAdd);

      // Add all tool responses
      for (const { call, output } of executedTools) {
        session.appendMessage({ role: 'tool', content: output ?? '' });
        options.messages.push({ role: 'tool', content: output, tool_call_id: call.id });
      }
    }

    return hasExecutedAnyTool;
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

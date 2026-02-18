import type { PureChatLLMChat } from './core/Chat';
import type { ChatSession } from './core/ChatSession';
import type {
  ChatRequestOptions,
  RoleType,
  StreamDelta,
  ToolCall,
  ToolClassification,
  ToolDefinition,
  ToolParameter,
  ToolParameters,
} from './types';

// Abstract base class for all tools
/**
 * Abstract base class for all LLM tools providing common functionality
 */
export abstract class Tool<TArgs = Record<string, unknown>> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameters;
  abstract readonly classification: ToolClassification;

  /**
   * Creates a new Tool instance
   * @param chat - The chat instance this tool operates within
   * @param registry - The tool registry managing this tool
   */
  constructor(
    protected chat: PureChatLLMChat,
    protected registry: ToolRegistry,
  ) {}

  // Send status update about what the tool is doing
  /**
   * Sends a status update message during tool execution
   * @param message - The status message to send
   */
  protected async status(message: string): Promise<void> {
    await this.registry.statusUpdate(message);
    /* this.platform.statusUpdate(`  ↳ ${message}`); */
  }

  // Check if the tool is currently available
  abstract isAvailable(): boolean;

  // Execute the tool with the given arguments
  abstract execute(args: TArgs): Promise<string>;

  // Get the tool definition for OpenAI API (concrete implementation)
  /**
   * Gets the tool definition for OpenAI API format
   * @returns The tool definition object with type, function name, description, and parameters
   */
  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}

// Helper to create tool parameters with type inference
/**
 * Helper function to define tool parameters with proper type inference
 * @param params - The tool parameters definition
 * @returns The same parameters with enforced type safety
 */
export function defineToolParameters<T extends ToolParameters>(params: T): T {
  return params;
}

// Helper to infer TypeScript type from tool parameters
export type InferArgs<T extends ToolParameters> = {
  [K in T['required'][number]]: T['properties'][K] extends ToolParameter
    ? T['properties'][K]['type'] extends 'string'
      ? string
      : T['properties'][K]['type'] extends 'number' | 'integer'
        ? number
        : T['properties'][K]['type'] extends 'boolean'
          ? boolean
          : unknown
    : never;
} & {
  [K in Exclude<
    keyof T['properties'],
    T['required'][number]
  >]?: T['properties'][K] extends ToolParameter
    ? T['properties'][K]['type'] extends 'string'
      ? string
      : T['properties'][K]['type'] extends 'number' | 'integer'
        ? number
        : T['properties'][K]['type'] extends 'boolean'
          ? boolean
          : unknown
    : never;
};

// Tool registry to manage all available tools
/**
 * Registry for managing all available tools and their execution
 */
export class ToolRegistry {
  private allTools: Map<string, Tool<Record<string, unknown>>>;
  private enabledTools: Set<string>;
  private streamCallback?: (textFragment: StreamDelta) => Promise<void>;

  /**
   * Creates a new ToolRegistry instance
   * @param chat - The chat instance this registry serves
   */
  constructor(protected chat: PureChatLLMChat) {
    this.allTools = new Map();
    this.enabledTools = new Set();
  }

  /**
   * Sends a status update message through the stream callback
   * @param message - The status message to send
   */
  async statusUpdate(message: string) {
    await this.streamCallback?.({ role: 'tool', content: `\n${message}` });
  }

  /**
   * Sets the stream callback for status updates
   * @param streamcallback - The callback function to handle status updates
   */
  setCallBack(streamcallback: ((textFragment: StreamDelta) => Promise<void>) | undefined) {
    this.streamCallback = streamcallback;
  }

  /**
   * Enables a specific tool by name
   * @param toolName - The name of the tool to enable
   * @returns This registry instance for chaining
   */
  enable(toolName: string): this {
    this.enabledTools.add(toolName);
    return this;
  }

  /**
   * Disables a specific tool by name
   * @param toolName - The name of the tool to disable
   * @returns This registry instance for chaining
   */
  disable(toolName: string): this {
    this.enabledTools.delete(toolName);
    return this;
  }

  /**
   * Disables all tools
   * @returns This registry instance for chaining
   */
  disableAll(): this {
    this.enabledTools.clear();
    return this;
  }

  /**
   * Checks if a tool classification is enabled in settings
   * @param classification - The tool classification to check (UI, Vault, System, AI)
   * @returns True if the classification is enabled, defaults to true if not set
   */
  isClassificationEnabled(classification: ToolClassification): boolean {
    const settings = this.chat.plugin.settings;
    return settings.enabledToolClassifications?.[classification] ?? true;
  }

  /**
   * Gets available tools by their names
   * @param names - Array of tool names to retrieve
   * @returns Array of available tool instances
   */
  getTools(names: string[]): Tool<Record<string, unknown>>[] {
    return names
      .map(name => this.allTools.get(name))
      .filter(
        (tool): tool is Tool<Record<string, unknown>> =>
          tool !== undefined &&
          tool.isAvailable() &&
          this.isClassificationEnabled(tool.classification),
      );
  }

  /**
   * Gets list of enabled tool names that are available
   * @returns Array of tool names that are enabled and available
   */
  getNameList(): string[] {
    return Array.from(this.enabledTools).filter(name => {
      const tool = this.allTools.get(name);
      return tool && tool.isAvailable() && this.isClassificationEnabled(tool.classification);
    });
  }

  /**
   * Gets tool names filtered by classification type
   * @param classification - The tool classification to filter by (UI, Vault, System, AI)
   * @returns Array of tool names matching the classification
   */
  getToolNamesByClassification(classification: ToolClassification): string[] {
    return Array.from(this.allTools.values())
      .filter(tool => tool.classification === classification)
      .map(tool => tool.name);
  }

  /**
   * Gets all enabled and available tool instances
   * @returns Array of tool instances that are enabled and available
   */
  get tools(): Tool<Record<string, unknown>>[] {
    return Array.from(this.enabledTools)
      .map(name => this.allTools.get(name))
      .filter(
        (tool): tool is Tool<Record<string, unknown>> =>
          tool !== undefined &&
          tool.isAvailable() &&
          this.isClassificationEnabled(tool.classification),
      );
  }

  /**
   * Registers a special tool instance (already instantiated)
   * @param tool - The tool instance to register
   * @returns This registry instance for chaining
   */
  registerToolSpecial(tool: Tool<Record<string, unknown>>): this {
    this.allTools.set(tool.name, tool);
    return this;
  }

  /**
   * Registers a tool class and creates an instance
   * @param tool - The tool class constructor to instantiate and register
   * @returns This registry instance for chaining
   */
  registerTool(
    tool: new (chat: PureChatLLMChat, registry: ToolRegistry) => Tool<Record<string, unknown>>,
  ): this {
    const toolInstance = new tool(this.chat, this);
    this.allTools.set(toolInstance.name, toolInstance);
    this.enabledTools.add(toolInstance.name);
    return this;
  }

  /**
   * Gets a tool by name if it exists and is available
   * @param name - The name of the tool to retrieve
   * @returns The tool instance if available, undefined otherwise
   */
  getTool(name: string): Tool<Record<string, unknown>> | undefined {
    const tool = this.allTools.get(name);
    return tool && tool.isAvailable() ? tool : undefined;
  }

  /**
   * Gets a tool by name regardless of availability status
   * @param name - The name of the tool to retrieve
   * @returns The tool instance if registered, undefined otherwise
   */
  classificationForTool(name: string): ToolClassification | undefined {
    return this.allTools.get(name)?.classification;
  }

  /**
   * Gets all tool definitions for available tools
   * @returns Array of tool definitions in OpenAI API format
   */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.allTools.values())
      .filter(tool => tool.isAvailable())
      .map(tool => tool.getDefinition());
  }

  /**
   * Executes a specific tool with the given arguments
   * @param name - The name of the tool to execute
   * @param args - The arguments to pass to the tool
   * @returns The tool execution result or error message
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.getTool(name);
    if (!tool) {
      return `Error: Unknown tool '${name}' `;
    }

    try {
      return await tool.execute(args);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error: ${message}`;
    }
  }

  /**
   * Executes multiple tool calls and updates the session
   * @param toolCalls - Array of tool calls from the LLM
   * @param session - The chat session to update
   * @param options - Chat request options containing messages
   * @param assistantMessage - Optional assistant message containing the tool calls
   * @param assistantMessage.role - The role of the assistant message
   * @param assistantMessage.content - The content of the assistant message
   * @param assistantMessage.tool_calls - The tool calls in the message
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

    for (const call of toolCalls) {
      const toolName = call.function.name;
      if (this.getTool(toolName)) {
        const fixedArguments = this.fixDuplicatedArguments(call.function.arguments);
        const args = JSON.parse(fixedArguments) as Record<string, unknown>;
        const output = await this.executeTool(toolName, args);

        executedTools.push({ call, output });
        hasExecutedAnyTool = true;
      }
    }

    if (hasExecutedAnyTool) {
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

      for (const { call, output } of executedTools) {
        session.appendMessage({ role: 'tool', content: output ?? '' });
        options.messages.push({ role: 'tool', content: output, tool_call_id: call.id });
      }
    }

    return hasExecutedAnyTool;
  }

  /**
   * Filters out tool calls that were not executed from message history
   * @param msgs - Array of messages containing potential tool calls
   * @returns Filtered messages with only executed tool calls
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
   * Fixes duplicated JSON arguments sometimes returned by LLMs
   * @param args - The arguments string that may be duplicated
   * @returns Fixed arguments string with duplication removed
   */
  private fixDuplicatedArguments(args: string): string {
    try {
      JSON.parse(args);
      return args;
    } catch {
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

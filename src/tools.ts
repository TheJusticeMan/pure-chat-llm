import type { PureChatLLMChat, StreamDelta } from './core/Chat';

// Type definitions for OpenAI tool schema
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  additionalProperties?: boolean | ToolParameter | Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface ToolDefinition {
  type: 'function';
  function: ToolFunction;
}

// Abstract base class for all tools
export abstract class Tool<TArgs = Record<string, unknown>> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameters;

  constructor(
    protected chat: PureChatLLMChat,
    protected registry: ToolRegistry,
  ) {}

  // Send status update about what the tool is doing
  protected status(message: string): void {
    this.registry.statusUpdate(message);
    /* this.platform.statusUpdate(`  ↳ ${message}`); */
  }

  // Check if the tool is currently available
  abstract isAvailable(): boolean;

  // Execute the tool with the given arguments
  abstract execute(args: TArgs): Promise<string>;

  // Get the tool definition for OpenAI API (concrete implementation)
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
export class ToolRegistry {
  private allTools: Map<string, Tool<Record<string, unknown>>>;
  private enabledTools: Set<string>;
  private streamCallback?: (textFragment: StreamDelta) => boolean;

  constructor(protected chat: PureChatLLMChat) {
    this.allTools = new Map();
    this.enabledTools = new Set();
  }

  statusUpdate(message: string) {
    this.streamCallback?.({ role: 'tool', content: `\n${message}` });
  }

  setCallBack(streamcallback: ((textFragment: StreamDelta) => boolean) | undefined) {
    this.streamCallback = streamcallback;
  }

  enable(toolName: string): this {
    this.enabledTools.add(toolName);
    return this;
  }

  disable(toolName: string): this {
    this.enabledTools.delete(toolName);
    return this;
  }

  disableAll(): this {
    this.enabledTools.clear();
    return this;
  }

  getTools(names: string[]): Tool<Record<string, unknown>>[] {
    return names
      .map(name => this.allTools.get(name))
      .filter(
        (tool): tool is Tool<Record<string, unknown>> => tool !== undefined && tool.isAvailable(),
      );
  }

  getNameList(): string[] {
    return Array.from(this.enabledTools).filter(name => this.allTools.get(name)?.isAvailable());
  }

  get tools(): Tool<Record<string, unknown>>[] {
    return Array.from(this.enabledTools)
      .map(name => this.allTools.get(name))
      .filter(
        (tool): tool is Tool<Record<string, unknown>> => tool !== undefined && tool.isAvailable(),
      );
  }

  registerToolSpecial(tool: Tool<Record<string, unknown>>): this {
    this.allTools.set(tool.name, tool);
    return this;
  }

  registerTool(
    tool: new (chat: PureChatLLMChat, registry: ToolRegistry) => Tool<Record<string, unknown>>,
  ): this {
    const toolInstance = new tool(this.chat, this);
    this.allTools.set(toolInstance.name, toolInstance);
    this.enabledTools.add(toolInstance.name);
    return this;
  }

  getTool(name: string): Tool<Record<string, unknown>> | undefined {
    const tool = this.allTools.get(name);
    return tool && tool.isAvailable() ? tool : undefined;
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.allTools.values())
      .filter(tool => tool.isAvailable())
      .map(tool => tool.getDefinition());
  }

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
}

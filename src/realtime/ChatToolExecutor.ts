import { PureChatLLMChat } from '../core/Chat';
import { IToolExecutor } from './providers/IVoiceCallProvider';
import { ToolDefinition } from '../types';

/**
 * Executor for chat tools in realtime voice calls
 * Bridges tool execution from voice providers to the chat tool registry
 */
export class ChatToolExecutor implements IToolExecutor {
  /**
   * Creates a new ChatToolExecutor
   * @param chat - The chat instance containing the tool registry
   */
  constructor(private chat: PureChatLLMChat) {}

  /**
   * Executes a tool by name with the provided arguments
   * @param name - The name of the tool to execute
   * @param args - The arguments to pass to the tool
   * @returns The result of the tool execution
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.chat.toolregistry.executeTool(name, args);
  }

  /**
   * Gets all available tool definitions from the registry
   * @returns Array of tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.chat.toolregistry.getAllDefinitions();
  }
}

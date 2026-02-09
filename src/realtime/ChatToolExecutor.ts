import { PureChatLLMChat } from '../core/Chat';
import { IToolExecutor } from './providers/IVoiceCallProvider';
import { ToolDefinition } from '../types';

/**
 *
 */
export class ChatToolExecutor implements IToolExecutor {
  /**
   *
   * @param chat
   */
  constructor(private chat: PureChatLLMChat) {}

  /**
   *
   * @param name
   * @param args
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.chat.toolregistry.executeTool(name, args);
  }

  /**
   *
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.chat.toolregistry.getAllDefinitions();
  }
}

import { PureChatLLMChat } from '../core/Chat';
import { IToolExecutor } from './providers/IVoiceCallProvider';
import { ToolDefinition } from '../types';

export class ChatToolExecutor implements IToolExecutor {
  constructor(private chat: PureChatLLMChat) {}

  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.chat.toolregistry.executeTool(name, args);
  }

  getToolDefinitions(): ToolDefinition[] {
     return this.chat.toolregistry.getAllDefinitions();
  }
}

import { EditorRange } from 'obsidian';
import { ChatMessage, ChatOptions, RoleType } from '../types';

/**
 * ChatSession represents a chat conversation as a pure domain model.
 * It contains the messages, options, and metadata for a chat session.
 *
 * This class handles domain logic like message management, cleanup, and role reversal,
 * but does NOT handle:
 * - API communication
 * - File I/O
 * - Tool execution
 * - Markdown serialization
 */
export class ChatSession {
  messages: ChatMessage[] = [];
  options: ChatOptions;
  clines: EditorRange[] = [];
  pretext: string = '';
  validChat: boolean = true;

  /**
   * Creates a new ChatSession instance
   * @param options - The chat options for this session
   */
  constructor(options: ChatOptions) {
    this.options = options;
  }

  /**
   * Appends one or more messages to the chat session.
   * Optionally associates editor ranges (line positions) with each message.
   *
   * @param messages - The messages to append (single message or array)
   * @param clines - Optional editor ranges for the messages
   * @returns The session instance for chaining
   */
  appendMessage(message: ChatMessage): this;
  /**
   * Appends one or more messages to the chat session.
   * Optionally associates editor ranges (line positions) with each message.
   *
   * @param messages - The messages to append (single message or array)
   * @param clines - Optional editor ranges for the messages
   * @returns The session instance for chaining
   */
  appendMessage(messages: ChatMessage[]): this;
  /**
   * Appends one or more messages to the chat session.
   * Optionally associates editor ranges (line positions) with each message.
   *
   * @param messages - The messages to append (single message or array)
   * @param clines - Optional editor ranges for the messages
   * @returns The session instance for chaining
   */
  appendMessage(messages: ChatMessage[], clines: EditorRange[]): this;
  /**
   * Appends one or more messages to the chat session.
   * Optionally associates editor ranges (line positions) with each message.
   *
   * @param messageOrMessages - The message or array of messages to append
   * @param clines - Optional editor ranges for the messages
   * @returns The session instance for chaining
   */
  appendMessage(messageOrMessages: ChatMessage | ChatMessage[], clines?: EditorRange[]): this {
    // Handle single message
    if (!Array.isArray(messageOrMessages)) {
      this.messages.push(messageOrMessages);
      this.clines.push({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } });
      return this;
    }

    // Handle array of messages
    const messages = messageOrMessages;
    this.messages.push(...messages);

    if (clines && clines.length === messages.length) {
      this.clines.push(...clines);
    } else {
      // Add empty clines if not provided
      this.clines.push(
        ...messages.map(() => ({
          from: { line: 0, ch: 0 },
          to: { line: 0, ch: 0 },
        })),
      );
    }

    return this;
  }

  /**
   * Cleans up the chat session:
   * - Removes empty messages (except system messages)
   * - Ensures first message is system
   * - Ensures last message is user and empty
   *
   * @param systemPrompt - The default system prompt to use if needed
   * @returns The session instance for chaining
   */
  cleanUpChat(systemPrompt: string): this {
    // Remove any empty messages except system
    this.messages = this.messages.filter(msg => msg.content.trim() !== '');

    // Ensure last message is user
    if (this.messages.length === 0 || this.messages[this.messages.length - 1].role !== 'user') {
      this.appendMessage({ role: 'user', content: '' });
    }

    return this;
  }

  /**
   * Reverses the roles of user and assistant messages.
   * Useful for importing conversations from other sources.
   *
   * @returns The session instance for chaining
   */
  reverseRoles(): this {
    this.messages = this.messages.map(
      msg =>
        (msg.role === 'user' && { ...msg, role: 'assistant' }) ||
        (msg.role === 'assistant' && { ...msg, role: 'user' }) ||
        msg,
    );
    return this;
  }

  /**
   * Generates a text representation of the chat.
   * Each message is formatted with a role prefix.
   *
   * @param roleFormatter - Function to format the role prefix
   * @returns Text representation of the chat
   */
  getChatText(roleFormatter: (role: RoleType) => string): string {
    return this.messages.map(m => `${roleFormatter(m.role)}\n${m.content}`).join('\n');
  }

  /**
   * Sets the model for this session.
   * @param model - The model identifier
   * @returns The session instance for chaining
   */
  setModel(model: string): this {
    this.options.model = model;
    return this;
  }

  /**
   * Sets the max tokens for this session.
   * @param maxTokens - The max tokens value
   * @returns The session instance for chaining
   */
  setMaxTokens(maxTokens: number): this {
    if (maxTokens !== undefined) {
      this.options.max_completion_tokens = maxTokens;
    }
    return this;
  }

  /**
   * Creates a copy of the chat session.
   * @returns A new ChatSession instance with copied data
   */
  clone(): ChatSession {
    const newSession = new ChatSession({ ...this.options });
    newSession.messages = this.messages.map(m => ({ ...m }));
    newSession.clines = this.clines.map(c => ({ ...c }));
    newSession.pretext = this.pretext;
    newSession.validChat = this.validChat;
    return newSession;
  }
}

import { parseYaml, stringifyYaml } from 'obsidian';
import { alloptions } from '../assets/constants';
import { ChatOptions, RoleType } from '../types';
import { CodeContent } from '../ui/CodeHandling';
import { ChatSession } from './ChatSession';

/**
 * ChatMarkdownAdapter handles serialization and deserialization of chat sessions
 * to/from markdown format.
 *
 * Responsibilities:
 * - Parse markdown text into ChatSession objects
 * - Serialize ChatSession objects into markdown text
 * - Extract and manipulate code blocks
 * - Parse chat options from JSON/YAML frontmatter
 */
export class ChatMarkdownAdapter {
  constructor(
    private roleFormatter: string,
    private useYAMLFrontMatter: boolean,
    private agentMode: boolean,
  ) {}

  /**
   * Generates a regex pattern for matching role headers in markdown.
   * @returns RegExp for matching role headers
   */
  get regexForRoles(): RegExp {
    const formatter = this.roleFormatter.replace('{role}', '(\\w+)');
    return new RegExp(`^${formatter}$`, 'gm');
  }

  /**
   * Parses a role string using the formatter template.
   * @param role - The role to format
   * @returns Formatted role string
   */
  parseRole(role: RoleType): string {
    return this.roleFormatter.replace('{role}', role);
  }

  /**
   * Parses markdown text into a ChatSession.
   *
   * @param markdown - The markdown text to parse
   * @param defaultOptions - Default chat options to use
   * @param systemPrompt - Default system prompt
   * @returns A ChatSession object
   */
  parse(markdown: string, defaultOptions: ChatOptions, systemPrompt: string): ChatSession {
    markdown = '\n' + markdown.trim() + '\n'; // ensure newlines at start and end
    const matches = Array.from(markdown.matchAll(this.regexForRoles));

    const session = new ChatSession(defaultOptions);
    session.pretext = matches[0] ? markdown.substring(0, matches[0].index).trim() : markdown;

    // Parse messages
    session.messages = matches.map((match, index) => {
      if (!match.index) {
        session.clines.push({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } });
        return {
          role: 'user' as RoleType,
          content: '',
        };
      }
      const contentStart = match.index + match[0].length;
      const contentEnd = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
      session.clines.push({
        from: { line: markdown.substring(0, contentStart).split('\n').length, ch: 0 },
        to: { line: markdown.substring(0, contentEnd).split('\n').length - 1, ch: 0 },
      });
      return {
        role: match[1].toLowerCase() as RoleType,
        content: markdown.substring(contentStart, contentEnd).trim(),
      };
    });

    // Handle case where there are no role markers
    if (session.messages.length === 0) {
      session.validChat = false;
      session.messages = [];
      session.appendMessage({ role: 'system', content: systemPrompt });
      session.appendMessage({ role: 'user', content: session.pretext });
      session.pretext = '';
      return session;
    }

    // Parse options from pretext
    this.parsePretextOptions(session);

    return session;
  }

  /**
   * Serializes a ChatSession into markdown text.
   *
   * @param session - The chat session to serialize
   * @returns Markdown text representation
   */
  serialize(session: ChatSession): string {
    const options: Record<string, unknown> = { ...session.options };
    delete options.messages;
    if (!this.agentMode) delete options.tools;

    const prechat = this.useYAMLFrontMatter
      ? `---\n${stringifyYaml(options)}\n---\n${session.pretext
          .replace(/```json[\s\S]*?```/im, '')
          .replace(/---\n[\s\S]+?\n---/im, '')
          .trim()}`
      : ChatMarkdownAdapter.changeCodeBlockMD(
          session.pretext,
          'json',
          JSON.stringify(options, null, 2),
        );

    const chatText = session.getChatText(role => this.parseRole(role));
    return `${prechat.trim()}\n${chatText}`;
  }

  /**
   * Parses chat options from the pretext (JSON code block or YAML frontmatter).
   * @param session - The session to update with parsed options
   */
  private parsePretextOptions(session: ChatSession): void {
    const optionsStr = ChatMarkdownAdapter.extractCodeBlockMD(session.pretext, 'json');
    if (optionsStr) {
      session.options = { ...session.options, ...ChatMarkdownAdapter.parseChatOptions(optionsStr) };
    } else {
      const yamlMatch = session.pretext.match(/^---\n([\s\S]+?)\n---/);
      if (yamlMatch) {
        try {
          const yaml: unknown = parseYaml(yamlMatch[1]);
          if (yaml && typeof yaml === 'object') {
            const allowedKeys = Object.keys(alloptions);
            const filteredOptions: Record<string, unknown> = {};
            for (const key of allowedKeys) {
              if (Object.prototype.hasOwnProperty.call(yaml, key)) {
                filteredOptions[key] = (yaml as Record<string, unknown>)[key];
              }
            }
            session.options = { ...session.options, ...filteredOptions };
          }
        } catch (e) {
          console.error('Error parsing frontmatter YAML:', e);
        }
      }
    }
  }

  /**
   * Extracts the content of a code block from markdown based on language.
   *
   * @param markdown - The markdown string containing the code block
   * @param language - The programming language of the code block to extract
   * @returns The content of the code block as a string if found, otherwise null
   */
  static extractCodeBlockMD(markdown: string, language: string): string | null {
    const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
    const match = markdown.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Extracts all code blocks from a given markdown string.
   *
   * @param markdown - The markdown string to extract code blocks from
   * @returns An array of objects containing language and code
   */
  static extractAllCodeBlocks(markdown: string): CodeContent[] {
    const regex = /^```(\w*)\n([\s\S]*?)\n```/gm;
    const matches: { language: string; code: string }[] = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const [, language, code] = match;
      const lang = (language || 'plaintext').trim() || 'plaintext';
      matches.push({
        language: lang,
        code: code.trim(),
      });
    }
    return matches;
  }

  /**
   * Replaces or adds a code block in markdown text.
   *
   * @param text - The original markdown string
   * @param language - The programming language of the code block
   * @param newText - The new text to insert into the code block
   * @returns The modified markdown string
   */
  static changeCodeBlockMD(text: string, language: string, newText: string): string {
    const regex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'im');
    if (!regex.test(text)) return `${text}\n\`\`\`${language}\n${newText}\n\`\`\``;
    return (
      text.replace(regex, `\`\`\`${language}\n${newText}\n\`\`\``) ||
      `${text}\n\`\`\`${language}\n${newText}\n\`\`\``
    );
  }

  /**
   * Parses a JSON string into ChatOptions.
   *
   * @param str - The JSON string to parse
   * @returns Partial ChatOptions object or null if parsing fails
   */
  static parseChatOptions(str: string): Partial<ChatOptions> | null {
    try {
      const parsed = JSON.parse(str) as Partial<ChatOptions>;
      const allowedKeys = Object.keys(alloptions);
      const filteredOptions: Record<string, unknown> = {};
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          filteredOptions[key] = parsed[key as keyof ChatOptions];
        }
      }
      return filteredOptions as Partial<ChatOptions>;
    } catch {
      return null;
    }
  }

  /**
   * Safely parses JSON, returning the parsed object or the original string on error.
   *
   * @param str - The string to parse
   * @returns Parsed object or original string
   */
  static tryJSONParse(str: string): string | object {
    try {
      return JSON.parse(str) as object;
    } catch {
      return str;
    }
  }
}

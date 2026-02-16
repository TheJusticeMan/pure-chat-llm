# Pure Chat LLM ^\_^

<div align="center">

![Pure Chat LLM Banner](https://img.shields.io/badge/Obsidian-Plugin-8B5CF6?style=for-the-badge&logo=obsidian&logoColor=white)
[![Version](https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge)](https://github.com/TheJusticeMan/pure-chat-llm/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

**Transform your Obsidian notes into powerful AI conversations with built-in agent capabilities.**

[Installation](#installation-v) | [Quick Start](#quick-start-) | [Features](#features-) | [Documentation](#documentation-i)

</div>

---

## Overview ?

**Pure Chat LLM** turns Obsidian notes into interactive AI chat interfaces with unprecedented integration into your knowledge base. Unlike typical AI plugins, Pure Chat LLM provides **13 intelligent tools** that allow AI models to autonomously read, write, search, and manage your vault -- with your explicit approval.

### What Makes It Different? >>>

- **Agentic AI** > : AI can autonomously use tools to interact with your vault (with your permission)
- **Note-as-Chat** = : Transform any note into a conversation -- no separate chat windows
- **Deep Integration** & : Leverages Obsidian's API for vault operations, workspace management, and more
- **Safety First** ! : All destructive operations require explicit user approval via visual diff modals
- **38% Smaller** v : Optimized architecture (131KB bundle, down from 211KB in v1.x)
- **Voice Calls** o : Real-time voice conversations with tool access via OpenAI Realtime API
- **Multi-Provider** \* : OpenAI, Gemini, xAI, Anthropic, Cohere, Mistral AI, DeepSeek

---

## Features +

### Intelligent Tool System (Agent Mode)

Pure Chat LLM includes **13 sophisticated tools** that enable AI to work with your vault:

#### Vault Operations =

- **Read notes** with section/heading/block support (`[[Note#Header]]`, `[[Note#^block]]`)
- **Write notes** with create/append/prepend modes + user approval modal
- **Search content** with boolean logic (AND/OR/NOT), regex, and context windows
- **Discover files** using glob patterns (`**/*.md`, `src/**/*.ts`)
- **Analyze backlinks** to explore your knowledge graph

#### AI Capabilities \*

- **Generate images** (OpenAI, xAI, Gemini) with aspect ratio control
- **Semantic search** via Smart Connections plugin integration (RAG)

#### System Control @

- **Manage settings** with confirmation modals for safety
- **Apply templates** programmatically with placeholder replacement

#### Workspace Management ^

- **Get active context**: Current file, cursor position, selection
- **Manage workspace**: Open/close tabs with split pane options
- **Show notices**: Display toast notifications

> **Agent Mode** must be enabled in settings to allow AI autonomous tool access during conversations.

### Chat Features

- **Inline conversations**: Transform any note into a chat interface
- **Multiple AI providers**: Switch between OpenAI, Gemini, xAI, Anthropic, and more
- **Note linking**: Use `[[Note name]]` to include content from other notes
- **Per-note configuration**: Customize model, tokens, temperature via JSON block
- **System prompts**: Modify AI behavior per conversation
- **Markdown rendering**: Full formatting support (lists, code blocks, tables)
- **Streaming responses**: Real-time token streaming for supported models

### Voice Call Feature

Real-time voice conversations using OpenAI Realtime API with optional tool access:

- **WebRTC audio streaming**: Direct connection to OpenAI
- **Tool integration**: When Agent Mode is enabled, AI can use tools during voice calls
- **Natural interaction**: "Create a note about my meeting", "Search for project deadlines"
- **High-quality audio**: Echo cancellation, noise suppression, auto-gain control
- **Provider extensibility**: Designed to support multiple voice providers

### Safety & Privacy !

- **Explicit approval**: All file writes and settings changes require user confirmation
- **Visual diff modals**: See exactly what will change before accepting
- **Local processing**: Notes stay in your vault; only API calls go to providers
- **Configurable permissions**: Control which tools AI can access

---

## Installation v

### From Obsidian Community Plugins (Recommended)

1. Open **Settings** -> **Community Plugins**
2. Click **Browse** and search for **Pure Chat LLM**
3. Click **Install**, then **Enable**
4. Configure your API key (see [Configuration](#configuration-))

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/TheJusticeMan/pure-chat-llm/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to:
   ```
   <vault>/.obsidian/plugins/pure-chat-llm/
   ```
3. Reload Obsidian
4. Enable the plugin in Settings -> Community Plugins

---

## Quick Start >

### Basic Chat

1. **Create a note** in your vault
2. **Write your message**:

   ```markdown
   # role: user

   What is the meaning of life?
   ```

3. **Initiate chat** with **Shift + Enter** or command palette -> "Complete chat response"
4. The AI will respond, and you can continue the conversation

### Using Note Context

Include content from other notes using WikiLinks:

```markdown
# role: user

[[Meeting Notes]]

Based on the meeting notes above, create an action items list.
```

The content of "Meeting Notes" will be included automatically.

### With Configuration

Customize per-note with a JSON block at the top:

```markdown
{
"model": "gpt-4",
"max_completion_tokens": 4096,
"temperature": 0.7
}

# role: system

You are a helpful writing assistant specializing in technical documentation.

# role: user

Help me improve this README section...
```

### Using Tools (Agent Mode)

Enable **Agent Mode** in settings, then:

```markdown
# role: user

Search my vault for all notes about "project deadlines" and create a summary note.
```

The AI will:

1. Use `search_vault` to find relevant notes
2. Read the content using `read_note_section`
3. Use `write_note_section` to create the summary (with your approval)

---

## Configuration @

### API Keys

1. Navigate to **Settings** -> **Pure Chat LLM**
2. Enter your API key for your chosen provider:
   - **OpenAI**: [Get API Key](https://platform.openai.com/account/api-keys)
   - **Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **xAI**: [xAI Console](https://console.x.ai/)
   - **Anthropic**: [Anthropic Console](https://console.anthropic.com/)
3. Save settings

### Endpoints & Models

Configure multiple endpoints for different providers:

- **Name**: Friendly name (e.g., "OpenAI GPT-4")
- **Endpoint**: API URL (e.g., `https://api.openai.com/v1/chat/completions`)
- **API Key**: Your provider's key
- **Models**: Available model list for dropdown

### Agent Mode

Enable autonomous tool usage:

1. Go to **Settings** -> **Pure Chat LLM**
2. Toggle **Agent Mode** on
3. Select which tools to make available
4. Configure tool-specific settings (e.g., max recursion depth)

### Voice Calls

For voice call support:

1. Configure OpenAI API key with Realtime API access
2. Grant microphone permissions
3. Click phone icon in ribbon or use command palette -> "Open voice call panel"

---

## Usage Examples $

### Example 1: Research Assistant

```markdown
{
"model": "gpt-4",
"tools": ["search_vault", "read_note_section", "smart_connections_rag"]
}

# role: system

You are a research assistant. Use the available tools to find relevant information from the user's vault.

# role: user

Find all notes related to "quantum computing" and summarize the key concepts.
```

### Example 2: Note Organizer

```markdown
{
"model": "gpt-4",
"tools": ["glob_vault_files", "read_note_section", "write_note_section"]
}

# role: user

Review all notes in my "Projects" folder and create an index note with links organized by topic.
```

### Example 3: Writing Coach

```markdown
{
"model": "claude-3-opus",
"temperature": 0.7
}

# role: system

You are a writing coach. Help improve writing clarity and structure.

# role: user

[[Draft Article]]

Review this draft and suggest improvements for clarity and flow.
```

### Example 4: Voice Meeting Transcription

1. Open voice call panel
2. Start call with Agent Mode enabled
3. Say: "Take notes on our conversation and create a meeting note when we're done"
4. Have your discussion
5. AI creates the note automatically (with your approval)

---

## Available Tools \*

See the complete [Tool Documentation](src/tools/GUIDE.md) for detailed information on all 13 tools.

| Tool                     | Description                            | Category |
| ------------------------ | -------------------------------------- | -------- |
| `read_note_section`      | Read notes with section/block support  | Vault    |
| `write_note_section`     | Write/modify notes with approval modal | Vault    |
| `search_vault`           | Boolean search with context            | Search   |
| `glob_vault_files`       | Pattern-based file discovery           | Search   |
| `list_vault_folders`     | Directory structure listing            | Search   |
| `get_backlinks`          | Analyze note connections               | Vault    |
| `generate_image`         | Create AI images                       | AI       |
| `smart_connections_rag`  | Semantic search (requires plugin)      | AI       |
| `get_active_context`     | Current file/cursor info               | UI       |
| `manage_workspace`       | Tab/split operations                   | UI       |
| `show_obsidian_notice`   | Display notifications                  | UI       |
| `manage_plugin_settings` | Update settings with confirmation      | System   |
| `manage_templates`       | Apply templates programmatically       | System   |

---

## Screenshots o

### Chat Interface

Transform any note into an interactive conversation:

```markdown
# role: user

What are the main themes in my literature review notes?

# role: assistant

I'll search your vault for literature review notes and analyze the themes...
```

### Tool Approval Modal

All destructive operations require explicit approval with diff visualization:

```
+-------------------------------------+
|  Review Changes                     |
+-------------------------------------+
|  - Old content                      |
|  + New content                      |
|                                     |
|  (Accept)  (Reject)                 |
+-------------------------------------+
```

### Voice Call Panel

Real-time voice conversations with optional tool access:

```
+-------------------------------------+
|   @  Voice Call                     |
+-------------------------------------+
|  Status: Connected                  |
|  Agent Mode: Enabled                |
|                                     |
|  (~ Mute)  (@ End Call)             |
+-------------------------------------+
```

---

## Troubleshooting !

### Chat Issues

**Q: "Complete chat response" does nothing**

- Verify API key is configured in settings
- Check your model is available at the endpoint
- Ensure note has proper role formatting (`# role: user`)

**Q: Note links `[[Note]]` aren't working**

- Links must be on their own line
- Verify the linked note exists
- Check recursion depth setting if nested links

### Tool Issues

**Q: AI says tools aren't available**

- Enable Agent Mode in settings
- Verify tools are selected in tool configuration
- Check tool-specific requirements (e.g., Smart Connections plugin)

**Q: File write failed**

- Ensure you clicked "Accept" in the approval modal
- Check file/folder permissions
- Verify vault path is accessible

### Voice Call Issues

**Q: Connection fails**

- Verify OpenAI API key has Realtime API access
- Check microphone permissions
- Ensure WebRTC is supported (desktop app recommended)

**Q: Tools don't work during voice calls**

- Enable Agent Mode in settings
- Grant tool permissions
- Check browser console for errors

---

## Architecture ^

### v2.0.0 Improvements

Pure Chat LLM v2.0.0 represents a major architectural refactoring:

- **38% bundle size reduction** (211KB -> 131KB main.js, plus 84% styles.css reduction)
- **Simplified file resolution**: Removed complex BlueFileResolver system (~70KB) in favor of lightweight recursive resolution
- **100% JSDoc coverage**: All 26 TypeScript files fully documented
- **Enhanced type safety**: Improved error handling and type definitions
- **Code quality tools**: Integrated Knip for detecting unused code

### Technical Highlights

- **Recursive resolution** with cycle detection and depth limiting
- **Chunked binary encoding** for large media files (prevents stack overflow)
- **Tool registry pattern** for extensible agent capabilities
- **Provider abstraction** for multi-LLM support
- **WebRTC integration** for real-time voice (OpenAI Realtime API)

---

## Contributing &

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/TheJusticeMan/pure-chat-llm.git
cd pure-chat-llm

# Install dependencies
npm install

# Build for development (watch mode)
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Run code quality checks
npm run knip
```

---

## Documentation i

- **[Tool Guide](src/tools/GUIDE.md)**: Comprehensive tool documentation (1,662 lines)
- **[Changelog](CHANGELOG.md)**: Version history and breaking changes
- **[OpenAI API Docs](https://platform.openai.com/docs)**: API reference
- **[Obsidian Plugin Dev](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)**: Plugin development guide

---

## License ~

MIT License - see [LICENSE](LICENSE) file for details.

---

## Credits <3

**Author**: Justice Vellacott
**Website**: [thejusticeman.github.io](https://thejusticeman.github.io/)

### Acknowledgments

- Obsidian team for the amazing platform
- OpenAI for GPT models and Realtime API
- All contributors and users providing feedback

---

## Links

- [GitHub Repository](https://github.com/TheJusticeMan/pure-chat-llm)
- [Obsidian Community Plugins](https://obsidian.md/plugins)
- [Report Issues](https://github.com/TheJusticeMan/pure-chat-llm/issues)
- [Feature Requests](https://github.com/TheJusticeMan/pure-chat-llm/discussions)

---

<div align="center">

**Star (\*) this repository if you find it helpful!**

Made with <3 for the Obsidian community

</div>

---

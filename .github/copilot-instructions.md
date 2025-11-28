# Pure Chat LLM - Copilot Instructions

## Project Overview

Pure Chat LLM is an Obsidian community plugin that enables users to chat with LLMs directly within their notes. It treats Markdown files as chat sessions, parsing role headers and content to construct API requests.

## Architecture & Core Components

### Entry Point (`src/main.ts`)

- **`PureChatLLM` Class**: The main plugin class extending `Plugin`.
  - Manages lifecycle (`onload`, `onunload`).
  - Registers commands, views (`PureChatLLMSideView`), and settings.
  - Handles global state like `isresponding`.
  - **Key Method**: `CompleteChatResponse` orchestrates the chat flow: reads editor content -> parses chat -> calls API -> updates editor.

### Chat Logic (`src/Chat.ts`)

- **`PureChatLLMChat` Class**: The core logic for handling chat sessions.
  - **Markdown Parsing**: Converts Markdown text into `ChatMessage` objects (`role`, `content`, `cline`) and vice-versa.
  - **Role Format**: Uses regex to identify roles (e.g., `# role: user`). Configurable via `settings.messageRoleFormatter`.
  - **API Communication**: `sendChatRequest` handles calls to LLM endpoints (OpenAI-compatible). Supports streaming.
  - **Context Resolution**: `resolveFiles` and `resolveFilesWithImages` replace `[[links]]` with actual file content before sending to the API.

### UI Components (`src/SideView.ts`)

- **`PureChatLLMSideView` Class**: A custom `ItemView` displayed in the side panel.
  - Renders a structured view of the chat from the active Markdown file.
  - Provides interactive controls (regenerate, delete, copy, model selection).
  - Updates in real-time on `editor-change` events.

### Settings (`src/settings.ts`)

- **`PureChatLLMSettingTab` Class**: Manages plugin configuration.
- **`PureChatLLMSettings` Interface**: Defines the shape of the settings object (endpoints, templates, API keys).

## Developer Workflows

### Build & Run

- **Install Dependencies**: `npm install`
- **Dev Mode (Watch)**: `npm run dev` (uses `esbuild` to bundle to `main.js`)
- **Production Build**: `npm run build`
- **Formatting**: `npm run format` (Prettier)

### Debugging

- **Browser Console**: Use the custom `BrowserConsole` class wrapper for logging.
  - Enable debug mode in settings to see logs.
  - Access via `this.console.log(...)` in classes.

## Project-Specific Patterns & Conventions

### Chat Storage Format

- **Markdown-First**: The "database" is the Markdown file itself.
- **Role Headers**: Messages are delimited by headers defined in settings (default: `# role: {role}`).
- **Metadata**: Chat options (model, tokens) are stored in a JSON code block at the top of the file.

### File Linking & Context

- **Syntax**: `[[Note Name]]` or `![[Note Name]]`.
- **Resolution**: The plugin resolves these links to their file content _before_ sending the request to the LLM.
- **Images**: Supports embedding images via `![[image.png]]` which are converted to base64 for vision-capable models.

### Command Implementation

- **Editor Commands**: Most commands operate on the active `Editor` instance.
- **Templates**: "Edit Selection" and "Analyze Conversation" commands use user-defined templates stored in settings.

### Error Handling

- **User Feedback**: Use `Notice` for user-facing errors (e.g., missing API key).
- **Logging**: Use `this.console.error` for internal errors.

## Key Files

- `src/main.ts`: Plugin entry point and command orchestration.
- `src/Chat.ts`: Chat parsing, API logic, and context resolution.
- `src/SideView.ts`: Side panel UI implementation.
- `src/types.ts`: TypeScript interfaces for settings and data structures.
- `esbuild.config.mjs`: Build configuration.

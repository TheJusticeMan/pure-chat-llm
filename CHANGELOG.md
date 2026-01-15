# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.9.3] - 2026-01-14

### Added

- **Voice Call Feature**: Introduced a dedicated Voice Call side panel with real-time audio interaction capabilities.
- **Multi-Provider Realtime Support**: Integrated both OpenAI Realtime API and Google Gemini Live API.
- **WebRTC Integration**: Leveraged WebRTC for high-performance, low-latency audio streaming.
- **Tool Integration in Voice**: Enabled the AI to use vault tools (like searching and reading notes) during live voice conversations.
- **Provider Selection UI**: Added a UI to switch between different voice call providers (OpenAI, Gemini).
- **Audio Feedback**: Implemented visual audio levels and connection status indicators in the side panel.

### Changed

- **Realtime Architecture Refactor**: Overhauled the voice architecture to use a more robust provider pattern for better extensibility and maintenance.
- **Improved Type Safety**: Enhanced type safety in `GeminiLiveProvider` and other realtime modules by defining explicit interfaces and reducing `any` usage.
- **Refined Command Palette**: Removed redundant commands to streamline the user experience.

### Fixed

- **Audio Stability**: Fixed issues with audio playback underruns in Gemini Live by optimizing the scheduling logic.
- **Connection Reliability**: Resolved a bug where the Gemini provider would hang at the "connecting..." state.
- **API Authentication**: Fixed 401 Unauthorized errors by implementing proper API key validation for realtime endpoints.
- **Tool Definition Format**: Corrected the tool definition format to comply with OpenAI's Realtime API requirements.

## [1.9.2] - 2026-01-04

### Added

- **Suno API Integration**: Integrated Suno AI for generating music directly from the chat interface via tool calls.
- **Tool Classification System**: Introduced a new settings-based classification system for tools, allowing users to enable/disable categories of tools.
- **Enhanced Image Generation**: Updated the image generation tool with support for more model configurations and improved API endpoints.

### Changed

- **Modular Architecture Refactor**: Migrated chat-related types and constants to a centralized `src/assets/constants.ts` file.
- **Service Integration**: Integrated `LLMService` into the core `PureChatLLMChat` class for more consistent API interactions.
- **Global Naming Refactor**: Performed a project-wide refactor of symbols and variables for better consistency and readability.

### Fixed

- **Metadata Parsing**: Improved the robustness of chat metadata parsing and setting migration logic.

## [1.9.1] - 2025-12-30

### Added

- **YAML Front Matter Support**: Added a new setting to store chat metadata (model, temperature, etc.) in YAML front matter instead of JSON code blocks.
- **Model Suggestions**: The editor now provides autocomplete suggestions for model names within both YAML front matter and JSON configuration blocks.

### Changed

- **Improved Tool Handling**: Refined logic for enabling all available tools when `tools: true` is set in the chat configuration.
- **Enhanced Editor Suggestions**: Updated the suggest provider to recognize more trigger patterns for model selection.

## [1.9.0] - 2025-12-29

### Added

- **Agentic Capabilities**: Added a suite of tools for the LLM to interact with the vault:
  - `create_obsidian_note`: Create new notes with frontmatter.
  - `delete_obsidian_note`: Delete notes or files with user confirmation.
  - `read_file`: Read file contents efficiently with pagination.
  - `patch_note`: Append content to specific sections/headings atomically.
  - `replace_in_note`: Perform search and replace or regex updates in notes.
  - `search_vault`: Search for text or regex patterns across all notes.
  - `glob_vault_files`: Find files using glob patterns with metadata filtering.
  - `list_vault_folders`: Explore the vault's directory structure.
  - `get_backlinks`: Find all notes linking to a specific file.
  - `smart_connections_rag`: Perform semantic search using Smart Connections for RAG.
  - `manage_workspace`: Control workspace layout (open/close files, split panes).
  - `get_active_context`: Retrieve context about the active file and selection.
  - `show_obsidian_notice`: Display transient notifications.
  - `manage_plugin_settings`: Read and update plugin-specific settings.
  - `manage_templates`: List and apply Obsidian templates.
- **Safety Workflow**: Implemented `EditReview`, `DeleteConfirmation`, and `SettingsConfirmation` systems where modifications, deletions, and setting changes trigger a user approval modal before application.
- **High-Performance Architecture**:
  - Utilized `app.vault.cachedRead` for fast, memory-efficient reading.
  - Utilized `app.vault.process` for atomic, race-condition-free file updates.
  - Leveraged `app.metadataCache` for smart link resolution and structural editing.

## [1.8.0] - 2025-12-29

### Changed

- Modularized project structure: reorganized `src/` into `assets/`, `core/`, `ui/`, and `utils/`
- Renamed UI components for clarity (e.g., `models.ts` -> `Modals.ts`)
- Updated imports and configuration to reflect the new structure
- Enhanced ESLint configuration for better code quality
- Removed unused `src/test.ts` file
- Improved code readability in `ImageGen.ts` and `settings.ts`

## [1.7.1] - 2025-12-28

### Added

- New setting to automatically concatenate consecutive messages from the same role

## [1.7.0] - 2025-12-27

### Added

- Comprehensive CHANGELOG.md
- New "Open code preview" context menu item for code blocks
- Code block tracking extension to detect when cursor is inside a code block

### Changed

- Refactored code for consistency and readability
- Updated dependencies and added ESLint configuration
- Moved `CodePreview` to a separate file `src/CodepreView.ts`
- Refactored `Chat.ts` for better type safety and error handling
- Updated `ChatRequestOptions` interface
- Improved error handling in `ImportChatGPT.ts`
- Updated dependencies in `package.json`
- Applied `void` operator to unawaited promises for better linting compliance

## [1.6.0] - 2025-12-07

### Added

- Comprehensive error notifications to sendChatRequest with detailed HTTP status code messages

### Changed

- Improved code clarity by simplifying error extraction logic
- Enhanced error message handling based on code review feedback

## [1.5.0] - 2025-11-28

### Changed

- Refactored settings and templates for improved readability and functionality

## [1.4.8] - 2025-11-18

### Changed

- Minor updates and improvements

## [1.4.7] - 2025-11-16

### Changed

- Minor updates and improvements

## [1.4.6] - 2025-11-02

### Changed

- Minor updates and improvements

## [1.4.5] - 2025-11-02

### Fixed

- Fix add new template on mobile (Fixes #15)

## [1.4.4] - 2025-11-02

### Changed

- Minor updates and improvements

## [1.4.3] - 2025-11-02

### Changed

- Minor updates and improvements

## [1.4.2] - 2025-10-25

### Changed

- Minor updates and improvements

## [1.4.1] - 2025-10-25

### Fixed

- Convert max_completion_tokens to max_tokens for Mistral AI compatibility

## [1.3.14] - 2025-10-12

### Fixed

- Fixed titling of message boxes (Issue #11)

## [1.3.13] - 2025-09-21

### Changed

- Minor updates and improvements

## [1.3.12] - 2025-09-20

### Changed

- Minor updates and improvements

## [1.3.11] - 2025-09-20

### Changed

- Minor updates and improvements

## [1.3.10] - 2025-09-20

### Changed

- Minor updates and improvements

## [1.3.9] - 2025-08-28

### Changed

- Minor updates and improvements

## [1.3.8] - 2025-08-26

### Changed

- Minor updates and improvements

## [1.3.7] - 2025-08-26

### Changed

- Minor updates and improvements

## [1.3.6] - 2025-08-26

### Changed

- Minor updates and improvements

## [1.3.5] - 2025-08-26

### Changed

- Minor updates and improvements

## [1.3.4] - 2025-08-24

### Added

- Import conversations from ChatGPT app feature (Issue #5)

## [1.3.2] - 2025-08-19

### Changed

- Minor updates and improvements

## [1.3.1] - 2025-07-02

### Changed

- Minor updates and improvements

## [1.3.0] - 2025-07-01

### Added

- Image generation and recognition support (Issue #6)
- Auto-detect model provider from model name (Issue #3)

## [1.2.12] - 2025-06-25

### Changed

- Minor updates and improvements

## [1.2.11] - 2025-06-21

### Changed

- Minor updates and improvements

## [1.2.10] - 2025-06-17

### Added

- Custom LLM provider management
- Input placeholders for LLM provider settings in EditModalProviders

### Changed

- Enhanced cursor behavior in PureChatLLMSideView
- Improved template management in SelectionPromptEditor

## [1.2.9] - 2025-06-16

### Changed

- Refactored README.md installation instructions
- Updated package-lock.json dependencies
- Initialized messages array in PureChatLLMChat
- Replaced EditSelectionModal with EditWand
- Enhanced SideView cursor behavior
- Improved settings management in main.ts and types.ts

## [1.2.8] - 2025-06-11

### Changed

- Minor updates and improvements

## [1.2.7] - 2025-06-06

### Changed

- Minor updates and improvements

## [1.2.6] - 2025-06-04

### Changed

- Minor updates and improvements

## [1.2.5] - 2025-05-30

### Changed

- Minor updates and improvements

## [1.2.4] - 2025-05-30

### Changed

- Minor updates and improvements

## [1.2.3] - 2025-05-25

### Changed

- Minor updates and improvements

## [1.2.2] - 2025-05-23

### Changed

- Minor updates and improvements

## [1.2.1] - 2025-05-22

### Changed

- Minor updates and improvements

## [1.2.0] - 2025-05-21

### Changed

- Minor updates and improvements

## [1.1.6] - 2025-05-15

### Changed

- Minor updates and improvements

## [1.1.5] - 2025-05-07

### Changed

- Minor updates and improvements

## [1.1.4] - 2025-05-02

### Changed

- Minor updates and improvements

## [1.1.3] - 2025-05-02

### Changed

- Improved API key handling
- Updated dependencies

## [1.1.2] - 2025-05-01

### Changed

- Minor updates and improvements

## [1.1.1] - 2025-05-01

### Added

- Enhanced all classes with detailed documentation

## [1.1.0] - 2025-04-30

### Added

- Implemented multiple API endpoints support

## [1.0.5] - 2025-04-24

### Changed

- Removed OpenAI API package dependency

### Added

- Powerful selection tools

## [1.0.1] - 2025-04-23

### Added

- Initial release with core chat functionality
- Interactive chat interface with ChatGPT directly in Obsidian notes
- Support for OpenAI API
- Note linking for context using `[[Note name]]` syntax
- Per-note customization with JSON blocks
- Flexible system prompts
- Markdown rendering support
- Side panel view with streaming support
- Selection command handling
- Simple API key setup

### Changed

- Switched from Rollup to ESBuild for bundling
- Upgraded to modern build system
- Improved settings management
- Enhanced code quality with ESLint

### Technical

- Target ES2018
- Use ESBuild for fast builds
- Add version bump automation
- Implement type checking with TypeScript
- Add proper licensing (MIT)

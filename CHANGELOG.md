# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-15

This is a **major release** with breaking changes focused on simplification, performance optimization, and code quality improvements.

### (*) Highlights

- **38% Bundle Size Reduction**: main.js reduced from 211KB -> 131KB (80KB savings) through architectural simplification
- **100% JSDoc Documentation Coverage**: All 26 TypeScript files fully documented (352 issues resolved)
- **Comprehensive Tool Documentation**: 1,662 lines of LLM-friendly documentation for all 13 tools
- **Repository Cleanup**: Removed 6 unnecessary files and organized scripts into dedicated folder
- **Removed Complex Dependencies**: Eliminated ~70KB of BlueFileResolver infrastructure
- **Added Code Quality Tools**: Integrated Knip for detecting unused code
- **Improved Type Safety**: Added @typescript-eslint/parser for better linting

### Changed - BREAKING

- **Replaced BlueFileResolver with Simple Recursive Resolution**: Removed the entire BlueFileResolver architecture (~70KB of code) in favor of a lightweight, built-in recursive file resolution system. This significantly reduces bundle size while maintaining core functionality:
  - **Removed files** (13 files total):
    - `src/core/BlueFileResolver.ts` (34KB)
    - `src/ui/BlueResolutionTreeView.ts` (21KB)
    - `src/ui/ResolutionGraphRenderer.ts` (11KB)
    - `src/ui/ResolutionTreeRenderer.ts` (3KB)
    - All graph rendering utilities in `src/ui/graph/`
    - Port and adapter files (`src/ports/`, `src/adapters/`)
    - `AGENTS/BLUE_FILE_RESOLUTION.md` documentation
  - **Removed UI components**:
    - Blue Resolution Tree view
    - Blue Resolution Graph view
    - Associated ribbon icon and commands
  - **New implementation**: File resolution now happens directly in the `Chat` class via a new `resolveContentRecursive()` method with:
    - Chunked binary encoding for images/audio (prevents stack overflow on large files)
    - Proper cycle detection using visited Set
    - Configurable depth limiting (default: 10)
    - Preserved features: recursive [[link]] resolution, image/audio embedding, section references
  - **Settings simplified**: Replaced complex `blueFileResolution` object with a single `maxRecursionDepth` number setting
  - **API changes**:
    - `getChatGPTinstructions()` no longer accepts a `context` parameter
    - `completeChatResponse()` no longer accepts a `context` parameter
  - **Type removals**:
    - `ResolutionEvent` interface
    - `ResolutionNodeData` interface
    - `ResolutionTreeData` interface
    - `ResolutionStatus` type
    - `BLUE_RESOLUTION_VIEW_TYPE` constant

### Added

- **Complete JSDoc Documentation Coverage**: Added comprehensive JSDoc documentation to all 26 TypeScript files (100% coverage)
  - Resolved all 352 JSDoc lint issues (103 errors, 249 warnings eliminated)
  - Every class, method, and function now has complete documentation
  - All parameters documented with descriptions
  - All return values documented with @returns declarations
  - Consistent, professional documentation style throughout
  - Tools: All 14 tool classes (UITools, SearchTools, SystemTools, AITools, VaultTools, base Tool class, ToolRegistry, ToolOutputBuilder, EditReview)
  - Core: Chat, ChatSession, LLMService, Speech, ChatMarkdownAdapter, ImportChatGPT
  - UI: main.ts, CodePreview, Modals, Settings, SideView, VoiceCallSideView
  - Realtime: ChatToolExecutor, VoiceCall, GeminiLiveProvider, OpenAIRealtimeProvider
  - Utilities: BooleanSearchParser, LowUsageTagRemover
- **Scripts Organization**: Moved all build and utility scripts to dedicated `scripts/` folder
  - `scripts/Release.sh` - Release automation
  - `scripts/version-bump.mjs` - Version bumping
  - `scripts/esbuild.config.mjs` - Build configuration
  - Updated all package.json script paths accordingly
  - Cleaner repository root directory
- **Comprehensive Tool Documentation**: Completely rewrote `src/tools/GUIDE.md` (1,662 lines)
  - All 13 tools documented with complete parameter tables
  - Strategic "When to Use" heuristics for each tool
  - Best practices for Obsidian integration
  - JSON examples with expected outputs
  - LLM-friendly format for better tool selection
  - Categories: AI Tools (2), Search Tools (3), System Tools (2), UI Tools (3), Vault Tools (3)
- **Knip Integration**: Added Knip (v5.83.1) for detecting unused files, dependencies, and exports
  - New `knip` script in package.json: `npm run knip`
  - Configuration file: `knip.json` with schema reference
  - Initial analysis identifies potential cleanup opportunities (3 unused files, 1 unlisted dependency, 26 unused exports/types)
- **Helper Function**: New `arrayBufferToBase64()` method in Chat class for safe chunked binary-to-base64 conversion
  - Processes data in 8KB chunks to prevent stack overflow
  - Reusable for both image and audio file handling

### Changed

- **Dependencies Updated**:
  - Added `@typescript-eslint/parser` v8.55.0 for improved ESLint configuration
  - Updated `@types/node` from v25.0.2 -> v25.2.3
  - Updated `knip` to v5.83.1
- **Type Safety Improvements**:
  - Removed unsafe type assertions in `processChatWithTemplate()`
  - Added proper MediaMessage array handling with explicit type checks
  - Improved error handling for edge cases in recursive resolution
  - Standardized type definitions across all tool files
  - Enhanced code formatting consistency

### Removed

- **Repository Cleanup**: Removed unnecessary files for cleaner repository structure
  - `styles copy.css` - Duplicate backup file
  - `JSDOC_COMPLETION_GUIDE.md` - Temporary scaffolding documentation (work completed)
  - `AGENTS/` directory (4 files) - Obsolete documentation for removed Blue File Resolution feature:
    - `AGENTS/GRAPH_VIEW.md`
    - `AGENTS/INTERACTIVE_GRAPH_FEATURES.md`
    - `AGENTS/PR_SUMMARY.md`
    - `AGENTS/TESTING_GUIDE.md`

### Fixed

- **Stack Overflow Prevention**: Binary data (images/audio) now converted to base64 in 8KB chunks instead of spreading entire arrays
  - Fixes potential crashes with large media files (multi-megabyte images/audio)
- **Build Artifacts**: Fixed `.gitignore` to properly exclude `meta.json` build artifact

### Developer Experience

- **Documentation Excellence**: 100% JSDoc documentation coverage across all 26 TypeScript files
  - Zero ESLint JSDoc violations
  - Professional-grade inline documentation
  - Better IDE autocomplete and IntelliSense support
  - Easier onboarding for new contributors
- **Code Quality**: Reduced codebase by 3,851 lines (-3,851 lines, +179 lines for new implementation)
  - Comprehensive tool documentation (1,662 lines in GUIDE.md)
  - Standardized type definitions and formatting
  - Improved error handling throughout
- **Repository Organization**: Cleaner structure with scripts in dedicated folder
  - 6 unnecessary files removed (52KB of obsolete documentation)
  - Better separation of concerns
  - Easier to navigate and maintain
- **Maintainability**: Simplified architecture makes the codebase easier to understand and maintain
- **Performance**: Faster load times due to smaller bundle size (26% reduction)
- **Security**: No vulnerabilities found in CodeQL security scan
- **Code Quality Tools**: Knip integration for detecting unused code and dependencies

### Migration Guide

If you were using the Blue Resolution features:

1. **Settings**: The `blueFileResolution` setting is replaced by `maxRecursionDepth` (default: 10)
2. **Views**: The Blue Resolution Tree view is no longer available - file resolution happens automatically
3. **API**: If you have custom code calling `getChatGPTinstructions()` or `completeChatResponse()`, remove the `context` parameter

## [1.12.1] - 2026-02-09

### Added

- **Realtime System Prompt File Setting**: Added a new setting to configure a file path for the realtime voice call system prompt. When configured, the plugin will read the system prompt from the specified file instead of using hardcoded defaults. This makes it easy to customize the AI's behavior during voice calls. The feature includes:
  - New `realtimeSystemPromptFile` setting in plugin settings
  - UI control in settings with file path autocomplete (press `/` or `[` to browse files)
  - Automatic fallback to default prompts if file is not found or empty
  - User notifications when file reading fails or file is empty
  - Works with both OpenAI Realtime and Gemini Live providers

## [1.12.0] - 2026-01-27

### Added

- **ToolOutputBuilder Utility**: Introduced a new `ToolOutputBuilder` class that provides a fluent API for creating consistent, structured tool outputs across all tools with ASCII-only formatting.
- **Enhanced Tool Output Formatting**: Completely redesigned tool outputs to be more informative and actionable for the LLM:
  - **Rich Metadata**: Tools now return detailed metadata including file sizes, line counts, timestamps, and content statistics.
  - **ASCII-Only Structure**: All outputs use only ASCII characters with markdown-style separators (`---`) for maximum compatibility.
  - **Tabular Data**: File listings use markdown tables with human-readable sizes and relative timestamps.
  - **Suggested Actions**: All tools provide contextual suggestions for logical next steps to guide the LLM.
  - **Structured Errors**: Error messages include specific error types and actionable recovery options with example tool calls.
- **Tool Output Format Guide**: Added comprehensive documentation in `src/tools/GUIDE.md` explaining output conventions, formatting standards, and interpretation guidelines.
- **Setting to Remove Empty Messages**: Added a new setting option to automatically filter out empty or whitespace-only messages from chat sessions, improving chat cleanliness and relevance.
- **Enhanced Tool Message Handling**: Improved tool message processing with better descriptions and more robust error handling.
- **Diff Functionality in EditReview**: Implemented visual diff comparison in the EditReview component for enhanced content change visualization.
- **onRender Callback in ResolutionGraphRenderer**: Added callback support for improved rendering control and extensibility in graph visualization.
- **Async Stream Callbacks**: Enhanced `LLMService` and `ToolExecutor` to support asynchronous stream callbacks for more flexible response handling.

### Changed

- **ReadFile Output**: Enhanced to include file metadata (size, lines, last modified), content statistics (headings, links, tags), pagination info, and navigation suggestions.
- **SearchVault Output**: Now displays search statistics (files searched, time taken), numbered results with line numbers, and follow-up suggestions.
- **GlobFiles Output**: Upgraded to show results in table format with file sizes, modification times, summary statistics, and suggested actions.
- **Backlinks Output**: Enhanced to show relationship strength using ASCII brackets `[***]`/`[**-]`/`[*--]`, sort by connection count, and provide exploration suggestions.
- **ListFolders Output**: Now includes folder statistics (file counts, total sizes) with summary information.
- **DeleteNote Modal**: Updated confirmation dialog to show file details (size, last modified) before deletion.
- **Edit Operations (CreateNote, PatchNote, ReplaceInNote)**: Approval messages now include operation details, line counts, character counts, and suggested next actions.
- **Error Messages**: All file-not-found and operation errors now follow a consistent format with specific error types, recovery suggestions, and correct glob patterns for root-level files.
- **ASCII-Only Output**: Replaced all non-ASCII characters (Unicode box drawing, bullets, checkmarks, arrows, curly quotes) with ASCII equivalents throughout all tool outputs and documentation.
- **Tool Descriptions**: Refined all tool descriptions and error messages for improved clarity and user experience.
- **Title Generation Logic**: Updated title generation to include numbered files, allowing better handling of copied notes with automatic title numbering.
- **JSON Parsing in ChatMarkdownAdapter**: Refactored JSON parsing for improved type safety and error resilience.

### Fixed

- **Tool Error Handling**: Enhanced error handling across all vault tools with better error messages and recovery strategies.
- **Root-Level File Glob Patterns**: Fixed invalid glob patterns (`/*.md`) generated for root-level files, now correctly uses `*.md` pattern.
- **Conditional Suggestions**: Fixed empty suggestion strings in ListFolders output when recursive mode is enabled.
- **Streaming Performance**: Resolved UI freezing during heavy LLM response streaming by implementing buffered updates (100ms debouncing) instead of updating the editor on every token.
- **Memory Leak**: Fixed potential memory leaks in response streaming by adding proper `ReadableStream` reader cancellation on errors and early termination.

### Documentation

- Updated `src/tools/GUIDE.md` with a new "Tool Output Format Guide" section
- Added before/after examples for key tools (ReadFile, SearchVault, GlobFiles)
- Documented ASCII-only formatting standards and conventions
- Included interpretation guidelines for LLMs
- Updated CHANGELOG.md to consolidate all changes into version 1.11.1

## [1.11.0] - 2026-01-16

### Added

- **Graph View Mode**: Introduced a new visual way to explore file dependencies.
  - **Interactive Graph**: Navigate the dependency tree with zoom, pan, and drag capabilities.
  - **Minimap & Tooltips**: Added a minimap for better orientation and tooltips for file details.
  - **Fit-to-View**: Automatically adjust the graph to fit the available viewport.
  - **Touch Support**: Enabled interaction on touch devices.
  - **Persistent View Mode**: The plugin now remembers your preference between Tree View and Graph View.

### Changed

- **Architectural Refactor**: Significant separation of concerns to improve code maintainability and testability.
  - **Domain-Driven Design**: Introduced `ChatSession`, `ChatMarkdownAdapter`, and `ToolExecutor` classes to decouple business logic from UI.
  - **FileSystem Port**: Abstracted file system operations behind a `FileSystemPort` interface.
  - **Unified Rendering**: Centralized rendering logic for different views.

### Fixed

- **Memory Management**: Addressed critical memory leaks in the `ResolutionGraphRenderer`.
- **Graph View Stability**: Fixed multiple issues related to click detection, icon duplication during zoom, and layout aspect ratios.
- **Rendering Issues**: Corrected canvas clearing and dimension calculations for sharper graphics.
- **Link Handling**: Improved support for links with whitespace and nested file resolution.

## [1.10.0] - 2026-01-14

### Added

- **Blue File Resolution System**: Introduced a robust, specialized file resolution engine (`BlueFileResolver`) designed to recursively resolve note links, images, and audio files. This system replaces the previous ad-hoc logic with a graph-based approach that intelligently handles circular dependencies, depth limits, and caching for optimal performance.
- **Blue Resolution Tree View**: Implemented a new "Blue Resolution Tree" side panel view. This interactive visualization allows users to explore the dependency graph of the current note in real-time.
  - **Interactive Hierarchy**: Expand and collapse nodes to see exactly what files are being pulled into the context.
  - **Status Indicators**: Visual cues for resolution status (resolved, missing, cyclic dependency, ignored).
  - **Cyber-Neon Aesthetic**: A distinct visual style with "Blue" accents to differentiate it from standard Obsidian views.
  - **Navigation**: Click on any node in the tree to immediately open that file in the editor.
- **Enhanced Documentation**: Added `BLUE_FILE_RESOLUTION.md` providing in-depth architectural details and usage guides for the new resolution system.
- **Visual Updates**: Updated icons for the Conversation Overview and Voice Call views to better align with the new design language.
- **Settings Overhaul**: Refactored the settings UI to accommodate the new resolution options, improving organization and usability.

### Changed

- **Core Logic Refactor**: Completely centralized all file resolution logic from `Chat.ts` into the `BlueFileResolver` class. This major architectural change improves maintainability and reliability of context generation.
- **Dependency Management**: Updated the minimum required Obsidian app version to 1.11.4 to leverage the latest API capabilities.
- **UI/UX Improvements**: Various refinements to the user interface and internal code structure for better stability and performance.

### Fixed

- **Stability Improvements**: Addressed various minor bugs and edge cases in the file resolution and chat handling logic.

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

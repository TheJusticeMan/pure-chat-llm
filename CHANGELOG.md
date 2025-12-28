# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

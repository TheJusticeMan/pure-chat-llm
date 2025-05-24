# Changelog

## 1.2.2

Refactor Pure Chat LLM Plugin: Consolidate settings, enhance selection templates, and improve user interface

- Migrate settings to a new JSON structure in `src/s.json` for better organization.
- Update `SideView.ts` and `Speech.ts` to utilize new settings structure.
- Simplify API endpoint management and remove redundant code in `main.ts`.
- Introduce a new `SelectionPromptEditor` modal for managing selection templates.
- Enhance user experience with improved splash screen and README documentation.
- Add functionality for customizable system prompts and selection commands.
- Update TypeScript configuration to support JSON module imports.
- Bump version to 1.2.2 and update related documentation.

# 1.2.1

feat: Enhance speech functionality with OpenAI TTS API integration

- Implemented PureChatLLMSpeech class for text-to-speech capabilities.
- Added methods for enqueuing speech audio, splitting long messages, and playing audio segments sequentially.
- Introduced streaming speech synthesis for chat messages.
- Updated main plugin to include a command for speaking chat messages.
- Refactored settings to include multiple AI endpoints and improved chat parser structure.
- Created a new BrowserConsole class for better logging management.
- Removed unused toSentanceCase utility and added toTitleCase utility.
- Updated CSS styles for improved UI presentation.

## 1.1.4

### Changes

- Refactored chat handling logic for improved maintainability.
- Added `chatParser` utility to centralize chat message parsing.
- Removed extra munu options prefering commands

## 1.1.2

### Bug Fixes

- Automatically ask for API key when **any command** requiring it is used

### Changes

- Improved API key prompt logic.
- Minor UI tweaks.
- Updated dependencies.

## 1.1.1 (2025-05-01)

### Bug Fixes

- Fixed Selection editing doesn't work

### Changes

- Better code documentation.
- Nicer styling for sidebar

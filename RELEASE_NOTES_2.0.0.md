# Pure Chat LLM v2.0.0 Release Notes

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

# Blue File Resolution Documentation

## Overview

Blue File Resolution is a feature that enables recursive, dynamic execution of pending chat notes when they are linked in other notes. Instead of inlining static content when resolving `[[note]]` links, the plugin can detect if the linked note is a "pending chat" (ends with a user message) and execute it dynamically to generate a response.

## How It Works

### Pending Chat Detection

A note is considered a "pending chat" if:
1. It has valid chat structure (role markers like `# role: user`, `# role: assistant`, etc.)
2. The last message in the chat has the role `user`

When you link to a pending chat in another note, Blue File Resolution will:
1. Execute the linked chat (calling the LLM API)
2. Capture the assistant's response
3. Use that response as the resolved content instead of the static file content

### Recursive Resolution

Blue File Resolution works recursively:
- If Chat A links to `[[Chat B]]`, and Chat B is a pending chat that links to `[[Chat C]]`
- Chat C will be resolved first (if it's also pending)
- Then Chat B will be resolved using Chat C's output
- Finally Chat A will use Chat B's output

### Safety Features

#### Cycle Detection
The resolver maintains a set of visited files during resolution. If a circular dependency is detected (e.g., Chat A → Chat B → Chat A), the resolver will:
- Log an error message
- Show a notice to the user
- Return an error placeholder instead of entering an infinite loop

#### Depth Limiting
To prevent runaway recursion, you can set a maximum resolution depth (default: 5). When this depth is reached:
- The resolver logs a warning
- Returns the static content instead of executing the chat
- No error is shown, just limits the recursion

#### Caching
To avoid redundant API calls, the resolver caches intermediate results:
- Cache is per-invocation (not persistent across plugin sessions)
- Keyed by file path
- When the same file is referenced multiple times in a single resolution tree, the cached result is reused

## Configuration Options

### Enable Blue File Resolution
**Default:** `false` (disabled)

Turn on dynamic chat execution for `[[note]]` links. When enabled, linked notes that are pending chats will be executed recursively.

### Maximum Resolution Depth
**Default:** `5`
**Range:** `1-20`

Maximum depth for recursive chat execution. Prevents runaway recursion.

### Enable Caching
**Default:** `true`

Cache intermediate chat results during resolution to avoid redundant API calls for the same file within a single invocation.

### Write Intermediate Results
**Default:** `false`

Save intermediate chat responses to disk. By default, only the root invocation writes results; nested executions are ephemeral (not saved).

## Use Cases

### Modular Prompts
Create reusable prompt components:
```markdown
# File: analysis-helper.md
# role: system
You are an expert analyst.

# role: user
Analyze the following data and provide insights: [[data-file]]
```

Then use it in multiple places:
```markdown
# File: report.md
# role: user
Create a report based on: [[analysis-helper]]
```

### Workflow Chains
Build multi-step workflows:
```markdown
# File: step-1-research.md
# role: user
Research topic: [[topic]]

# File: step-2-outline.md
# role: user
Create an outline based on: [[step-1-research]]

# File: final-document.md
# role: user
Write a complete document using: [[step-2-outline]]
```

### Function-like Behavior
Treat chat notes as "functions" that take inputs and return outputs:
```markdown
# File: summarize.md
# role: system
You are a summarization expert.

# role: user
Summarize: [[input-text]]

# File: my-task.md
# role: user
Compare these two summaries:
1. [[summarize]] with input [[article-1]]
2. [[summarize]] with input [[article-2]]
```

## Technical Implementation

### Architecture

The implementation consists of three main components:

1. **BlueFileResolver** (`src/core/BlueFileResolver.ts`)
   - Handles recursive resolution logic
   - Maintains resolution context (visited files, depth, cache)
   - Detects pending chats
   - Executes chats and manages intermediate results

2. **Modified Resolution Methods** (`src/core/Chat.ts`)
   - `resolveFiles()` - Enhanced to support blue file resolution
   - `resolveFilesWithImagesAndAudio()` - Passes plugin context for blue resolution
   - `retrieveLinkContent()` - Uses blue resolver when enabled

3. **Settings Integration** (`src/ui/Settings.ts`)
   - UI for all configuration options
   - Grouped under "Blue File Resolution (Dynamic Chat Execution)"

### Resolution Context

Each top-level invocation creates a `ResolutionContext` containing:
- `visitedFiles: Set<string>` - Tracks files being resolved (for cycle detection)
- `currentDepth: number` - Current depth in the resolution tree
- `cache: Map<string, string>` - Cached results for this invocation
- `rootFile: TFile` - The file that initiated the resolution

### Error Handling

The resolver handles several edge cases:
- **Circular dependencies**: Detected and blocked with error message
- **Max depth exceeded**: Gracefully falls back to static content
- **File not found**: Returns original link text with error note
- **API errors**: Caught and returned as error placeholders
- **Invalid chat format**: Treated as static content (not executed)

## Limitations

1. **No streaming for nested resolutions**: Only the root invocation supports streaming output. Nested chat executions wait for complete responses before proceeding.

2. **Per-invocation cache only**: The cache is not persisted. If you invoke the same workflow multiple times, each invocation will make fresh API calls.

3. **Subpath links not supported**: Blue file resolution does not work with subpath links like `[[note#section]]`. These always return static content.

4. **Single file resolution**: The feature works on single `[[link]]` patterns. Complex inline links or multiple links per line may not work as expected.

5. **Requires valid chat format**: The linked note must have proper role markers for the chat to be detected and executed.

## Future Enhancements

Potential improvements for future versions:
- Persistent caching across sessions
- Streaming support for nested resolutions
- Visual workflow graph viewer
- Conditional execution based on context
- Parameter passing to linked chats
- Timeout configuration for long-running resolutions
- Progress indicators for deep resolution trees

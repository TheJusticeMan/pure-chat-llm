# Pure Chat LLM Tools Guide

## Introduction

Pure Chat LLM provides a comprehensive set of tools that enable Large Language Models to interact with Obsidian vaults programmatically. This tool system allows LLMs to read, write, search, and manage notes while respecting Obsidian's architecture and user workflows.

### Tool System Architecture

Tools are organized into five categories:

- **AI Tools**: Advanced AI capabilities like image generation and semantic search
- **Search Tools**: Pattern matching, directory exploration, and content search
- **System Tools**: Plugin settings and template management
- **UI Tools**: Workspace control, context awareness, and notifications
- **Vault Tools**: Note reading, writing, and relationship management

All tools follow a consistent interface:
- Structured JSON parameters with type validation
- Standardized output format for easy parsing
- Error handling with recovery suggestions
- Availability checks for optional dependencies

---

## Tool Output Format Standards

### Successful Operations

Tools return structured, formatted output designed to enhance LLM understanding:

```
FILE READ SUCCESSFUL
---
Path: Projects/AI Research.md
Size: 2,048 bytes (204 lines)
Last Modified: 2025-01-27 14:23:05
---
METADATA
- Frontmatter properties: 3 found
- Headings: 4 sections
- Links: 5 internal links
---

Content:
[file content here]
```

### Error Messages

All errors follow a structured format with recovery suggestions:

```
ERROR: FileNotFoundError (Recoverable)
---
Reason: No file exists at path "Projects/Missing.md"

RECOVERY OPTIONS:
1. glob_vault_files("Projects/*.md") - Search similar files
2. create_obsidian_note(path="Projects/Missing.md", ...) - Create file
3. list_vault_folders("Projects") - Explore directory
```

### List/Table Results

Tools that return multiple items use tables or numbered lists:

```
GLOB SEARCH RESULTS: "Projects/*.md"
---
Found 3 files matching pattern

| # | File Path           | Size   | Modified   |
|---|---------------------|--------|------------|
| 1 | Projects/AI.md      | 2.1 KB | 2 days ago |
| 2 | Projects/Research.md| 5.4 KB | 1 week ago |

---
STATISTICS - Total size: 7.5 KB | Newest: Projects/AI.md

SUGGESTED ACTIONS:
1. read_file("Projects/AI.md") to view the first match
2. Refine your pattern to narrow down results
```

### Operation Confirmations

Write operations show detailed change information:

```
PATCH OPERATION APPROVED
---
Target: Projects/AI.md
Action: Appended to section "## Tasks"
Lines changed: +3 (67 -> 70)
Total characters: 1,234

File Status: [x] Saved successfully
---
SUGGESTED ACTIONS:
1. manage_workspace() to open the updated file
2. read_file("Projects/AI.md") to verify the changes
```

---

## AI Tools

### generate_image

**Classification**: AI  
**Availability**: OpenAI and xAI endpoints only

#### Overview
Creates high-quality AI-generated images from text prompts. Supports multiple aspect ratios and can generate multiple images in a single call. Generated images are automatically saved to the vault's attachment folder and embedded in the note using Obsidian's wiki-link format.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Detailed description of the image to generate (max 4,000 characters) |
| `ratio` | string | No | `"square"` | Aspect ratio: `"landscape"`, `"portrait"`, or `"square"` |
| `n` | integer | No | `1` | Number of images to generate (1-10 depending on provider) |

#### When to Use

- **Visual Content Creation**: User requests illustrations, diagrams, or artwork
- **Document Enhancement**: Adding visual elements to notes or documentation
- **Concept Visualization**: Converting abstract ideas into visual representations
- **Multiple Variations**: When user wants several versions of the same concept (`n` > 1)

**Strategic Heuristics**:
- Use landscape for wide scenes, banners, or horizontal compositions
- Use portrait for people, vertical objects, or mobile-friendly images
- Use square for icons, profile pictures, or balanced compositions
- Generate multiple images (`n` > 1) when user wants options or variations
- Keep prompts detailed and specific (mention style, colors, mood, composition)

#### Best Practices

1. **Prompt Engineering**:
   - Be specific about style (photorealistic, cartoon, watercolor, etc.)
   - Include details about lighting, colors, and atmosphere
   - Specify what should NOT be in the image if relevant
   - Example: "A serene mountain landscape at sunset, photorealistic style, warm golden lighting, no people or buildings"

2. **Error Handling**:
   - Check endpoint availability before attempting generation
   - Validate prompt length (4,000 character limit)
   - Handle network failures gracefully
   - Inform user if provider-specific limits apply

3. **Obsidian Integration**:
   - Images are saved with timestamp-based names to avoid conflicts
   - Wiki-links are generated relative to the current note
   - Revised prompts (if provided by the API) are included in output

#### Example Usage

```json
{
  "prompt": "A cozy library with floor-to-ceiling bookshelves, warm lighting from table lamps, leather armchairs, and a fireplace. Photorealistic style with rich wood tones and ambient atmosphere.",
  "ratio": "landscape",
  "n": 2
}
```

**Output**:
```
![[generated-image-1737984123-0.png]]
Revised prompt: A warm and inviting library scene...

![[generated-image-1737984123-1.png]]
Revised prompt: A cozy library interior with extensive bookshelves...
```

#### Obsidian-Specific Context

- Uses `app.fileManager.getAvailablePathForAttachment()` to determine save location
- Respects user's attachment folder settings
- Generates proper Obsidian wiki-links with relative paths
- Images are immediately viewable in Reading mode

---

### smart_connections_rag

**Classification**: AI  
**Availability**: Requires Smart Connections plugin to be installed and initialized

#### Overview
Performs semantic search across the vault using embeddings-based retrieval. Unlike text-based search, this finds notes and blocks based on conceptual similarity, making it ideal for discovering related content even when exact keywords don't match.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | The search query or concept to find semantically similar content |
| `limit` | integer | No | `5` | Maximum number of results to return (1-50) |
| `type` | string | No | `"blocks"` | Retrieval granularity: `"blocks"` (sections) or `"sources"` (entire files) |

#### When to Use

- **Conceptual Search**: Finding notes by meaning rather than exact keywords
- **Research Discovery**: Locating related content across disconnected notes
- **Context Gathering**: Retrieving relevant background information for a topic
- **Knowledge Exploration**: Discovering connections the user may not be aware of

**Strategic Heuristics**:
- Use `"blocks"` for precise, section-level retrieval (default, most common)
- Use `"sources"` when you need file-level context or want to identify whole documents
- Increase `limit` when casting a wider net (research phases)
- Keep `limit` low for focused, high-quality results (specific questions)
- Query should be a natural language question or concept, not just keywords

#### Best Practices

1. **Query Formulation**:
   - Use full sentences or questions for best results
   - Be specific about the concept, not just keywords
   - Example: "How do neural networks learn from data?" vs "neural networks"
   - Avoid query strings that are too short (< 5 words)

2. **Result Interpretation**:
   - Similarity scores are percentages (0-100%)
   - Scores above 70% typically indicate strong relevance
   - Scores 50-70% are moderately relevant
   - Scores below 50% may be tangentially related

3. **Performance Considerations**:
   - First query may be slower (embedding initialization)
   - Large vaults benefit from lower limit values
   - Smart Connections must have completed initial indexing
   - Check plugin status if results seem incomplete

4. **Type Selection**:
   - `"blocks"`: Returns sections with line numbers and content excerpts
   - `"sources"`: Returns entire file paths with similarity scores
   - Use blocks for citations, sources for high-level discovery

#### Example Usage

```json
{
  "query": "What are effective note-taking strategies for learning complex topics?",
  "limit": 5,
  "type": "blocks"
}
```

**Output**:
```
Found 5 relevant blocks:

[Result 1] (Similarity: 87%)
Location: Learning/Study Techniques.md#^learning-strategies
Content:
## Active Recall and Spaced Repetition

The most effective learning strategies involve active engagement...

---
[Result 2] (Similarity: 82%)
Location: PKM/Zettelkasten Method.md#Note Types
Content:
### Permanent Notes

When processing fleeting notes, transform them into permanent notes...
```

#### Obsidian-Specific Context

- Requires Smart Connections community plugin (v2.x)
- Works with the plugin's embedding cache
- Respects Smart Connections settings (excluded folders, file types)
- Uses plugin's internal API (`smart_blocks` and `smart_sources` collections)
- Results include line-level precision using Obsidian's cache

---

## Search Tools

### glob_vault_files

**Classification**: Vault  
**Availability**: Always available

#### Overview
Searches for files using glob pattern matching. Ideal for finding files by name patterns, extensions, or folder structure. Supports wildcards and recursive directory traversal.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pattern` | string | Yes | - | Glob pattern (e.g., `"**/*.md"`, `"Attachments/*.png"`) |
| `include_fields` | array | No | `["path"]` | Metadata fields: `"path"`, `"name"`, `"extension"`, `"size"`, `"mtime"` |
| `limit` | integer | No | `100` | Maximum number of results to return |

#### When to Use

- **File Discovery**: Finding files by name patterns or extensions
- **Folder Exploration**: Listing all files in a specific directory
- **Asset Management**: Locating attachments (images, PDFs, etc.)
- **Pattern Matching**: Finding files with specific naming conventions

**Strategic Heuristics**:
- Use `**/*.md` for all Markdown files (recursive)
- Use `FolderName/*.md` for files in a specific folder only
- Use `**/*daily*.md` to find files containing "daily" in the name
- Use `*.{png,jpg,jpeg}` to match multiple extensions in the root
- Request metadata fields when you need more than just paths

#### Best Practices

1. **Pattern Syntax**:
   - `*` matches any characters except `/` (within a folder)
   - `**` matches any characters including `/` (across folders)
   - `?` matches exactly one character
   - `{a,b}` matches either pattern a or b
   - Patterns are case-sensitive on some systems

2. **Performance Optimization**:
   - Be as specific as possible to reduce result set
   - Use folder prefixes to limit scope (e.g., `Projects/**/*.md`)
   - Set appropriate `limit` to avoid overwhelming output
   - Request only needed fields in `include_fields`

3. **Common Patterns**:
   ```
   "**/*.md"                    # All Markdown files
   "Daily Notes/*.md"           # Files in specific folder
   "**/*2024*.md"               # Files with 2024 in name
   "Attachments/**/*.{png,jpg}" # Images in attachments
   "**/README.md"               # All README files
   ```

4. **Metadata Fields**:
   - `path`: Full vault path (always useful)
   - `name`: Filename with extension
   - `extension`: File type (useful for filtering)
   - `size`: File size in bytes
   - `mtime`: Last modification timestamp

#### Example Usage

```json
{
  "pattern": "Projects/**/*.md",
  "include_fields": ["path", "name", "size"],
  "limit": 50
}
```

**Output**:
```
GLOB RESULTS: "Projects/**/*.md"
---
Found: 12 matches

| # | Path                    | Name              | Size  |
|---|-------------------------|-------------------|-------|
| 1 | Projects/AI/GPT4.md     | GPT4.md           | 2048  |
| 2 | Projects/AI/Vision.md   | Vision.md         | 3156  |
| 3 | Projects/Web/React.md   | React.md          | 4201  |
```

#### Obsidian-Specific Context

- Works with all file types in vault, not just Markdown
- Paths are relative to vault root
- Uses Obsidian's `TFile` abstraction for metadata
- Respects vault structure but ignores `.obsidian` folder
- Results are stable and deterministic (sorted by path)

---

### list_vault_folders

**Classification**: Vault  
**Availability**: Always available

#### Overview
Lists folders in the vault to help understand directory structure. Can list folders recursively or just immediate children. Each folder includes a count of files it contains.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | No | `"/"` | Root path to start listing from |
| `recursive` | boolean | No | `false` | Whether to list all subfolders recursively |

#### When to Use

- **Vault Exploration**: Understanding the organization of a new vault
- **Directory Discovery**: Finding where specific types of content live
- **Structure Analysis**: Mapping out the folder hierarchy
- **Path Validation**: Checking if a folder exists before operations

**Strategic Heuristics**:
- Use `recursive: false` (default) for immediate children only
- Use `recursive: true` for complete directory tree
- Start with root (`/`) to get a full overview
- Use specific paths when you know roughly where to look
- Check file counts to identify content-heavy areas

#### Best Practices

1. **Starting Points**:
   - Begin with root (`/`) and `recursive: false` for overview
   - Drill down with specific paths once you identify areas of interest
   - Use in combination with `glob_vault_files` for comprehensive exploration

2. **Performance Considerations**:
   - `recursive: true` on large vaults can return many results
   - File counting includes all nested files (can be slow for deep trees)
   - Consider breaking down into multiple calls for very large vaults

3. **Interpretation**:
   - Empty folders (0 files) still appear in listings
   - File counts include all nested files when recursive
   - Paths are always relative to vault root
   - Hidden folders (starting with `.`) are excluded by Obsidian

#### Example Usage

```json
{
  "path": "Projects",
  "recursive": true
}
```

**Output**:
```
FOLDERS IN: "Projects"
---
1. Projects/AI (12 files)
2. Projects/AI/Research (8 files)
3. Projects/AI/Experiments (4 files)
4. Projects/Web (5 files)
5. Projects/Web/Frontend (3 files)
```

#### Obsidian-Specific Context

- Uses Obsidian's `TFolder` abstraction
- Respects vault boundaries (won't escape vault root)
- `.obsidian` config folder is excluded from results
- File counts are recursive even when `recursive: false`
- Paths can be used directly with other tools

---

### search_vault

**Classification**: Vault  
**Availability**: Always available

#### Overview
Performs full-text content search across all Markdown files in the vault. Supports boolean logic (AND, OR, NOT), regular expressions, and context windows around matches. This is the most powerful text-based search tool.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Text phrase, boolean expression, or regex pattern |
| `regex` | boolean | No | `false` | Treat query as regular expression |
| `limit` | integer | No | `20` | Maximum number of matches to return |
| `context_lines` | integer | No | `1` | Lines of context before and after each match |

#### When to Use

- **Content Discovery**: Finding specific text or phrases in notes
- **Boolean Search**: Complex queries with AND, OR, NOT logic
- **Pattern Matching**: Using regex to find structured content
- **Context Exploration**: Seeing how terms are used across the vault

**Strategic Heuristics**:
- Use simple text for basic keyword searches
- Use boolean logic for complex queries (e.g., `"AI AND ethics NOT bias"`)
- Use regex for structured patterns (dates, tags, specific formats)
- Increase `context_lines` to understand usage context
- Set appropriate `limit` to balance comprehensiveness and performance

#### Best Practices

1. **Query Types**:
   
   **Simple Text** (case-insensitive):
   ```json
   {"query": "machine learning"}
   ```
   
   **Boolean Logic**:
   ```json
   {"query": "neural network AND training NOT backpropagation"}
   ```
   - `AND`: Both terms must be present
   - `OR`: Either term must be present
   - `NOT`: Following term must not be present
   - Use parentheses for grouping: `"(AI OR ML) AND ethics"`
   
   **Regular Expression**:
   ```json
   {"query": "\\d{4}-\\d{2}-\\d{2}", "regex": true}
   ```

2. **Context Windows**:
   - `context_lines: 0` for exact match lines only
   - `context_lines: 1` (default) for immediate context
   - `context_lines: 3-5` for understanding usage
   - Higher values can help understand intent and meaning

3. **Performance Optimization**:
   - Keep `limit` reasonable (default 20 is good starting point)
   - Specific queries are faster than broad ones
   - Boolean queries are faster than regex
   - Consider using glob first to narrow down files

4. **Result Interpretation**:
   - Matches are marked with `>` prefix in context
   - Line numbers are provided for reference
   - Results are ordered by file path, then line number
   - Empty contexts mean surrounding lines are blank

#### Example Usage

**Simple Search**:
```json
{
  "query": "obsidian plugin development",
  "limit": 10,
  "context_lines": 2
}
```

**Boolean Search**:
```json
{
  "query": "(TypeScript OR JavaScript) AND API NOT deprecated",
  "limit": 15
}
```

**Regex Search**:
```json
{
  "query": "#\\w+",
  "regex": true,
  "limit": 50
}
```

**Output**:
```
SEARCH: "machine learning"
---
Found: 3 matches

[1] Projects/AI/Overview.md (Line 15)
 and understanding of complex systems.
> Machine learning enables computers to learn
 patterns from data without explicit programming.

[2] Research/Deep Learning.md (Line 42)
 The field has evolved significantly since
> machine learning first emerged in the 1950s.
 Today's models can process vast amounts of
```

#### Obsidian-Specific Context

- Only searches Markdown files (`.md` extension)
- Uses Obsidian's `cachedRead()` for performance
- Line numbers match what you see in the editor
- Results respect vault boundaries
- Does not search in excluded folders (if configured)

---

## System Tools

### manage_plugin_settings

**Classification**: System  
**Availability**: Always available

#### Overview
Reads and updates Pure Chat LLM plugin settings. Update operations require user confirmation through a modal dialog, ensuring settings are never changed without explicit approval. This is critical for maintaining user control over plugin behavior.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | string | Yes | - | Operation: `"read"` or `"update"` |
| `key` | string | No | - | Specific setting key (required for update, optional for read) |
| `value` | string | No | - | New value for the setting (required for update, JSON-stringified if complex) |

#### When to Use

- **Configuration Inspection**: Understanding current plugin settings
- **User-Requested Changes**: When user explicitly asks to modify settings
- **Troubleshooting**: Checking configuration issues
- **Preference Management**: Adjusting behavior based on user needs

**Strategic Heuristics**:
- Always read settings first before updating
- Never update settings without explicit user request
- Use `key` parameter to read specific settings
- Omit `key` to read all settings (useful for debugging)
- Complex values must be JSON-stringified

#### Best Practices

1. **Read Operations**:
   - Read all settings: `{"action": "read"}`
   - Read specific setting: `{"action": "read", "key": "endpoint"}`
   - Always review before suggesting changes
   - Settings are returned as formatted JSON

2. **Update Operations**:
   - Always confirm with user before attempting update
   - Explain what the change does and why
   - Provide the old and new values clearly
   - User sees a modal with approve/reject buttons
   - Only updates are saved if user approves

3. **Value Formatting**:
   - Simple strings: `"value": "new-value"`
   - Numbers: `"value": "42"`
   - Booleans: `"value": "true"`
   - Objects/Arrays: `"value": "{\"key\": \"value\"}"`
   - Plugin attempts JSON parsing, falls back to string

4. **Common Settings**:
   - `endpoint`: Current LLM endpoint selection
   - `endpoints`: Array of configured endpoints
   - `messageRoleFormatter`: Chat role header format
   - `debugMode`: Enable debug logging
   - `toolsEnabled`: Enable/disable tool calling

#### Example Usage

**Read All Settings**:
```json
{
  "action": "read"
}
```

**Read Specific Setting**:
```json
{
  "action": "read",
  "key": "debugMode"
}
```

**Update Setting** (triggers confirmation):
```json
{
  "action": "update",
  "key": "debugMode",
  "value": "true"
}
```

**Output** (Read):
```
Settings:
{
  "endpoint": 0,
  "endpoints": [...],
  "messageRoleFormatter": "# role: {{role}}",
  "debugMode": false,
  "toolsEnabled": true,
  ...
}
```

**Output** (Update after approval):
```
Updated "debugMode" to: true
```

**Output** (Update rejected):
```
Update rejected.
```

#### Obsidian-Specific Context

- Uses Obsidian's `Modal` class for confirmation UI
- Settings are persisted to `data.json` in plugin folder
- Changes take effect immediately after save
- Some settings may require plugin reload
- Settings are scoped to the plugin instance
- Confirmation modal cannot be bypassed (security feature)

---

### manage_templates

**Classification**: System  
**Availability**: Always available (but requires templates folder)

#### Overview
Lists and applies Obsidian templates. Automatically detects the templates folder from core Templates plugin, Templater plugin, or a folder named "Templates". Supports variable substitution (`{{date}}`, `{{time}}`, `{{title}}`).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | string | Yes | - | Operation: `"list"` or `"apply"` |
| `template_path` | string | No | - | Path to template file (required for `"apply"`) |
| `target_path` | string | No | - | Target note path (required for `"apply"`) |

#### When to Use

- **Template Discovery**: Finding available templates in the vault
- **Content Generation**: Applying templates to create structured notes
- **Standardization**: Creating notes with consistent formatting
- **Automation**: Using templates programmatically

**Strategic Heuristics**:
- List templates first to discover available options
- Use descriptive template names for easy selection
- Apply templates to new or existing notes
- Templates are ideal for recurring note structures
- Combine with `write_note_section` for full note creation

#### Best Practices

1. **Template Discovery**:
   - Always list templates before applying
   - Template folder detection order:
     1. Core Templates plugin settings
     2. Templater plugin settings
     3. Any folder named "Templates"
   - Templates must be Markdown files (`.md`)

2. **Variable Substitution**:
   - `{{date}}`: Current date (ISO format: YYYY-MM-DD)
   - `{{time}}`: Current time (HH:MM:SS)
   - `{{title}}`: Target file name without extension
   - Variables are case-sensitive
   - Unknown variables are left unchanged

3. **Application Workflow**:
   - Template content is processed (variables replaced)
   - Content is returned for review
   - Use `write_note_section` to actually create/update the note
   - Check if target exists before applying

4. **Template Organization**:
   - Keep templates in a dedicated folder
   - Use subfolders for categories
   - Name templates descriptively
   - Include frontmatter for metadata

#### Example Usage

**List Templates**:
```json
{
  "action": "list"
}
```

**Apply Template**:
```json
{
  "action": "apply",
  "template_path": "Templates/Daily Note.md",
  "target_path": "Daily/2025-01-27.md"
}
```

**Output** (List):
```
Templates in "Templates":
Templates/Daily Note.md
Templates/Meeting Notes.md
Templates/Project/Overview.md
Templates/Project/Task List.md
```

**Output** (Apply):
```
Template content for "Templates/Daily Note.md":

---
date: 2025-01-27
type: daily-note
---

# Daily Note for 2025-01-27

## Tasks for 2025-01-27
- [ ] 

## Notes


(Target "Daily/2025-01-27.md" does not exist. Use create_obsidian_note or patch_note to apply.)
```

#### Obsidian-Specific Context

- Detects templates folder automatically
- Works with both core Templates and Templater plugins
- Templates must be Markdown files
- Variable substitution is basic (not full Templater syntax)
- Does not trigger Templater plugin's advanced features
- Returns processed content for manual application
- Respects folder structure within templates directory

---

## UI Tools

### get_active_context

**Classification**: UI  
**Availability**: Always available

#### Overview
Retrieves information about the currently active note in Obsidian, including file path, cursor position, selection, and optionally the full content. Essential for understanding what the user is currently working on.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `include_content` | boolean | No | `false` | Whether to include the full note content in output |

#### When to Use

- **Context Awareness**: Understanding what note the user is working in
- **Selection-Based Operations**: When user asks to work with selected text
- **Cursor-Relative Actions**: Inserting content at cursor position
- **Active Note Operations**: Any operation that should target the current note

**Strategic Heuristics**:
- Call at the start of multi-step operations for context
- Use when user says "this note", "here", "current file"
- Set `include_content: true` only when you need to read the content
- Cursor position is zero-indexed (Line 0 = first line)
- Selection being empty doesn't mean the note is empty

#### Best Practices

1. **Context Interpretation**:
   - "Active File" is the note currently being edited
   - "Cursor" shows where insertions would occur
   - "Selection" is only present if text is highlighted
   - "Lines" indicates total line count

2. **Content Handling**:
   - Default `include_content: false` for metadata only
   - Use `include_content: true` when you need to analyze content
   - Large notes can result in substantial output
   - Content includes the full file, not just visible area

3. **Common Use Cases**:
   - Determining where to insert generated content
   - Understanding user's current focus
   - Extracting selected text for operations
   - Validating that a note is open before operations

4. **Error Handling**:
   - Returns error message if no Markdown note is active
   - Does not work with non-Markdown files
   - Graph view, canvas, or settings won't have active notes

#### Example Usage

**Basic Context** (metadata only):
```json
{
  "include_content": false
}
```

**Full Context** (with content):
```json
{
  "include_content": true
}
```

**Output** (without content):
```
Active File: Projects/AI/GPT Research.md
Cursor: Line 45, Col 12
Lines: 156
Selection:
---
Large language models have shown remarkable capabilities
in natural language understanding and generation.
---
```

**Output** (with content):
```
Active File: Projects/AI/GPT Research.md
Cursor: Line 45, Col 12
Lines: 156
No selection.

Content:
---
# GPT Research

## Overview
[... full note content ...]
---
```

#### Obsidian-Specific Context

- Uses `workspace.getActiveViewOfType(MarkdownView)`
- Only works when a Markdown editor is active
- Cursor positions are zero-indexed internally but displayed as 1-indexed
- Selection is always the current editor selection (live)
- Works in both edit and live preview modes
- Does not include properties (frontmatter) separately

---

### manage_workspace

**Classification**: UI  
**Availability**: Always available

#### Overview
Controls the Obsidian workspace by opening and closing notes in various layouts. Supports splitting panes horizontally or vertically, opening in new tabs, and setting view modes (source/preview). Essential for managing the user's workspace programmatically.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | string | Yes | - | Operation: `"open"` or `"close"` |
| `path` | string | No | - | File path (required for `"open"`, optional for `"close"`) |
| `split` | string | No | `"none"` | Split direction: `"horizontal"`, `"vertical"`, or `"none"` |
| `new_leaf` | boolean | No | `true` | Whether to open in a new tab |
| `mode` | string | No | - | View mode: `"source"` or `"preview"` |
| `active` | boolean | No | `true` | Whether to focus the newly opened tab |

#### When to Use

- **Note Navigation**: Opening specific notes programmatically
- **Workspace Organization**: Arranging notes in split views
- **Reference Display**: Opening related notes side-by-side
- **Tab Management**: Opening or closing tabs based on workflow

**Strategic Heuristics**:
- Use `split: "horizontal"` for notes you want to compare vertically
- Use `split: "vertical"` for side-by-side reference (most common)
- Use `new_leaf: true` to preserve current note
- Use `new_leaf: false` to replace current tab
- Set `active: false` for background opens (less disruptive)
- Use `mode: "source"` for editing, `mode: "preview"` for reading

#### Best Practices

1. **Opening Notes**:
   
   **Simple Open** (replaces current tab if `new_leaf: false`):
   ```json
   {"action": "open", "path": "Projects/AI.md", "new_leaf": false}
   ```
   
   **New Tab** (preserves current):
   ```json
   {"action": "open", "path": "Reference/Terms.md", "new_leaf": true}
   ```
   
   **Split View** (side-by-side):
   ```json
   {
     "action": "open",
     "path": "Research/Paper.md",
     "split": "vertical",
     "mode": "preview"
   }
   ```

2. **Closing Notes**:
   
   **Close Specific Tab**:
   ```json
   {"action": "close", "path": "Projects/Old.md"}
   ```
   
   **Close Active Tab**:
   ```json
   {"action": "close"}
   ```

3. **Split Directions**:
   - `"horizontal"`: Creates top/bottom split (good for long documents)
   - `"vertical"`: Creates left/right split (most common for references)
   - `"none"`: Opens in tab (no split)

4. **View Modes**:
   - `"source"`: Shows raw Markdown with syntax highlighting
   - `"preview"`: Shows rendered Markdown (reading mode)
   - Omit to keep current mode or use default

#### Example Usage

**Open for Editing**:
```json
{
  "action": "open",
  "path": "Projects/TODO.md",
  "new_leaf": true,
  "mode": "source",
  "active": true
}
```

**Open Reference in Split**:
```json
{
  "action": "open",
  "path": "Reference/API Docs.md",
  "split": "vertical",
  "mode": "preview",
  "active": false
}
```

**Close Active Tab**:
```json
{
  "action": "close"
}
```

**Output** (Open):
```
Opened "Projects/TODO.md"
```

**Output** (Close):
```
Closed tab for "Projects/Old.md".
```

#### Obsidian-Specific Context

- Uses Obsidian's leaf system for tab management
- Leaves are the building blocks of the workspace
- Split panes create new leaves in the workspace
- Path normalization is handled automatically
- Works with Obsidian's workspace state persistence
- `active` parameter determines focus, not visibility
- Mode changes may not apply to non-Markdown views

---

### show_obsidian_notice

**Classification**: UI  
**Availability**: Always available

#### Overview
Displays a toast-style notification in Obsidian. These appear in the upper-right corner and automatically dismiss after a specified duration. Useful for providing feedback about operations without interrupting the user's workflow.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `message` | string | Yes | - | The message to display in the notification |
| `duration` | integer | No | `5000` | Duration in milliseconds (1000 = 1 second) |

#### When to Use

- **Operation Feedback**: Confirming that an action completed
- **Status Updates**: Informing user of background processes
- **Warnings**: Non-critical alerts that don't require interaction
- **Success Messages**: Quick confirmations

**Strategic Heuristics**:
- Use for confirmations, not errors (errors should be in tool output)
- Keep messages short and clear (under 50 characters ideal)
- Standard duration (5000ms) is good for most messages
- Increase duration for important messages (7000-10000ms)
- Decrease duration for trivial confirmations (3000ms)
- Don't overuse (can be distracting)

#### Best Practices

1. **Message Content**:
   - Be concise and specific
   - Use present tense for ongoing actions
   - Use past tense for completed actions
   - Include essential details only
   - Examples:
     - [x] "Note saved successfully"
     - [x] "Searching 1,247 notes..."
     - [ ] "The operation that you requested has been completed"

2. **Duration Guidelines**:
   - Quick confirmations: 3000ms
   - Standard messages: 5000ms (default)
   - Important info: 7000-10000ms
   - Never less than 2000ms (too quick to read)
   - Never more than 15000ms (annoying)

3. **When NOT to Use**:
   - Don't duplicate information already in tool output
   - Don't use for errors (return in tool output instead)
   - Don't use for questions (use modal or tool output)
   - Don't use for long explanations

4. **Multiple Notices**:
   - Can display multiple notices simultaneously
   - They stack vertically in the UI
   - Each has independent duration
   - Use sparingly to avoid clutter

#### Example Usage

**Standard Notification**:
```json
{
  "message": "Note updated successfully",
  "duration": 5000
}
```

**Quick Confirmation**:
```json
{
  "message": "Copied to clipboard",
  "duration": 3000
}
```

**Important Alert**:
```json
{
  "message": "Large search in progress (2,500+ files)",
  "duration": 8000
}
```

**Output**:
```
Displayed notice: "Note updated successfully"
```

#### Obsidian-Specific Context

- Uses Obsidian's `Notice` class
- Appears in upper-right corner by default
- Notices are non-blocking (don't prevent interaction)
- Multiple notices stack vertically
- User can dismiss by clicking the notice
- Does not persist across Obsidian restarts
- Visual style matches Obsidian's theme

---

## Vault Tools

### read_note_section

**Classification**: Vault  
**Availability**: Always available

#### Overview
Reads content from Obsidian notes with support for sections, headers, and block references. Can return full notes, specific sections, or just the heading structure (outline). This is the primary tool for retrieving note content.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `link` | string | Yes | - | Wiki link format: `[[Filename]]`, `[[Filename#Header]]`, `[[Filename#^block-id]]` |
| `headings_only` | boolean | No | `false` | Return only heading structure (outline mode) instead of content |
| `depth` | integer | No | `6` | Maximum heading depth when `headings_only: true` (1-6) |

#### When to Use

- **Full Note Reading**: Retrieving entire note content
- **Section Reading**: Getting specific sections by header
- **Block Reading**: Retrieving specific block references
- **Outline Extraction**: Understanding note structure without reading content

**Strategic Heuristics**:
- Use full link `[[Note]]` for entire notes
- Use `[[Note#Header]]` for specific sections
- Use `[[Note#^blockid]]` for specific blocks
- Use `headings_only: true` for structure discovery
- Set `depth` lower (2-3) for high-level outline
- Always validate link format before calling

#### Best Practices

1. **Link Formats**:
   
   **Full Note**:
   ```json
   {"link": "[[Projects/AI Research]]"}
   ```
   
   **Section by Header**:
   ```json
   {"link": "[[Projects/AI Research#Methodology]]"}
   ```
   
   **Block Reference**:
   ```json
   {"link": "[[Projects/AI Research#^key-findings]]"}
   ```
   
   **Nested Header**:
   ```json
   {"link": "[[Projects/AI Research#Results > Performance]]"}
   ```

2. **Outline Mode**:
   
   **Full Outline**:
   ```json
   {"link": "[[Projects/AI Research]]", "headings_only": true}
   ```
   
   **High-Level Outline** (H1-H3 only):
   ```json
   {"link": "[[Projects/AI Research]]", "headings_only": true, "depth": 3}
   ```

3. **Error Handling**:
   - Returns structured error if file not found
   - Returns structured error if section not found
   - Suggests recovery options (glob search, create note)
   - Always check error format before proceeding

4. **Performance Considerations**:
   - Full notes are cached by Obsidian (fast)
   - Section resolution uses metadata cache (fast)
   - Large notes (>1MB) may take longer
   - Outline mode is faster than full content

#### Example Usage

**Read Full Note**:
```json
{
  "link": "[[Projects/Machine Learning]]"
}
```

**Read Specific Section**:
```json
{
  "link": "[[Projects/Machine Learning#Training Process]]"
}
```

**Get Note Outline**:
```json
{
  "link": "[[Projects/Machine Learning]]",
  "headings_only": true,
  "depth": 4
}
```

**Output** (Full Note):
```
NOTE SECTION READ SUCCESSFUL
---
Path: Projects/Machine Learning.md
---

Content:
# Machine Learning

## Overview
Machine learning is a subset of artificial intelligence...

## Training Process
Models learn by adjusting weights...
```

**Output** (Section):
```
NOTE SECTION READ SUCCESSFUL
---
Path: Projects/Machine Learning.md
Section: #Training Process
---

Content:
## Training Process
Models learn by adjusting weights through backpropagation...
```

**Output** (Outline):
```
NOTE OUTLINE
---
Path: Projects/Machine Learning.md
Size: 12,458 bytes
---

Heading Structure:
# Machine Learning
  ## Overview
    ### History
    ### Applications
  ## Training Process
    ### Supervised Learning
    ### Unsupervised Learning
  ## Conclusion
```

#### Obsidian-Specific Context

- Uses `parseLinktext()` for wiki link parsing
- Leverages `metadataCache` for section resolution
- Block references use Obsidian's `^blockid` syntax
- Headers match exactly (case-sensitive)
- Supports nested headers with `>` separator
- Uses `resolveSubpath()` for section extraction
- Respects Obsidian's cache for performance

---

### write_note_section

**Classification**: Vault  
**Availability**: Always available

#### Overview
Writes or modifies content in Obsidian notes with support for sections, multiple write modes, and frontmatter properties. Can create new notes, modify existing ones, or update specific sections. Includes user confirmation through an edit review modal.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `link` | string | Yes | - | Wiki link: `[[Filename]]` or `[[Filename#Header]]` |
| `content` | string | Yes | - | The content to write |
| `mode` | string | No | Contextual | Write mode: `"append"`, `"prepend"`, or `"replace"` |
| `properties` | object | No | - | YAML frontmatter properties (only used when creating new notes) |

#### When to Use

- **Note Creation**: Creating new notes with initial content
- **Content Modification**: Updating existing note content
- **Section Updates**: Modifying specific sections within notes
- **Batch Operations**: Multiple writes in sequence

**Strategic Heuristics**:
- Default mode for full files: `"replace"`
- Default mode for sections: `"append"`
- Use `"replace"` to completely rewrite content
- Use `"append"` to add content at the end
- Use `"prepend"` to add content at the beginning
- Properties only apply to new note creation
- Always confirm operation is what user intended

#### Best Practices

1. **Write Modes Explained**:
   
   **Replace** (default for full files):
   - Completely replaces all content
   - Use for major rewrites
   - Careful with existing content
   
   **Append** (default for sections):
   - Adds content at the end
   - Preserves existing content
   - Good for adding to lists, logs
   
   **Prepend**:
   - Adds content at the beginning
   - Useful for reverse-chronological logs
   - Preserves existing content

2. **Creating New Notes**:
   
   ```json
   {
     "link": "[[Projects/New Research]]",
     "content": "# New Research\n\n## Overview\nInitial research notes...",
     "properties": {
       "tags": ["research", "ai"],
       "created": "2025-01-27",
       "status": "in-progress"
     }
   }
   ```

3. **Modifying Sections**:
   
   **Append to Section**:
   ```json
   {
     "link": "[[Projects/TODO#Tasks]]",
     "content": "- [ ] Complete documentation",
     "mode": "append"
   }
   ```
   
   **Replace Section**:
   ```json
   {
     "link": "[[Projects/TODO#Tasks]]",
     "content": "- [x] All tasks completed!",
     "mode": "replace"
   }
   ```

4. **Content Formatting**:
   - Include proper Markdown formatting
   - Add newlines (`\n`) for spacing
   - Preserve existing heading for sections
   - Use consistent indentation
   - Include frontmatter separator (`---`) if needed

5. **Error Prevention**:
   - Can't write to section in non-existent file
   - Create the file first, then write to sections
   - Section must exist when using `#Header`
   - Properties don't overwrite existing frontmatter

#### Example Usage

**Create New Note**:
```json
{
  "link": "[[Projects/AI Ethics]]",
  "content": "# AI Ethics\n\n## Considerations\n- Bias\n- Privacy\n- Transparency",
  "properties": {
    "tags": ["ai", "ethics"],
    "date": "2025-01-27"
  }
}
```

**Append to Existing Section**:
```json
{
  "link": "[[Projects/TODO#In Progress]]",
  "content": "- [ ] Review pull request #42",
  "mode": "append"
}
```

**Replace Full Note**:
```json
{
  "link": "[[Daily/2025-01-27]]",
  "content": "# Daily Note\n\n## Summary\nCompleted all tasks for today.",
  "mode": "replace"
}
```

**Output** (Success):
```
WRITE OPERATION APPROVED
---
Target: Projects/AI Ethics.md
Action: Created new note
Lines changed: +8 (0 -> 8)
Total characters: 156

File Status: [x] Saved successfully
---
SUGGESTED ACTIONS:
1. manage_workspace(action="open", path="Projects/AI Ethics.md")
2. read_note_section(link="[[Projects/AI Ethics]]")
```

**Output** (Error - Section in non-existent file):
```
ERROR: FileNotFoundError
---
Reason: Cannot write to section "#Tasks" because file "Projects/New.md" does not exist.

RECOVERY OPTIONS:
1. write_note_section(link="[[Projects/New]]", content="...", ...) - Create the file first
```

#### Obsidian-Specific Context

- Uses `EditReview` modal for user confirmation
- Shows diff preview before applying changes
- Can be rejected by user (returns rejection message)
- Preserves file metadata (creation time, etc.)
- Respects vault boundaries and restrictions
- Uses `metadataCache` for section resolution
- Frontmatter properties follow YAML format
- Section operations preserve heading line
- All writes are atomic (all or nothing)

---

### get_backlinks

**Classification**: Vault  
**Availability**: Always available

#### Overview
Finds all notes that link to a specific note (backlinks). Results include the number of times each note links to the target. This is essential for understanding note relationships and knowledge graph structure.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | Yes | - | The path of the note to find backlinks for |

#### When to Use

- **Relationship Discovery**: Understanding what notes reference a topic
- **Graph Analysis**: Mapping knowledge connections
- **Impact Assessment**: Seeing how widely a note is referenced
- **Navigation**: Finding related content through links

**Strategic Heuristics**:
- Use to discover notes related to a specific topic
- Check backlinks before deleting notes (impact assessment)
- Find all notes that might need updates when you change one
- Identify hub notes (many backlinks = important)
- Sort by link count to find most connected notes

#### Best Practices

1. **Path Formats**:
   - Use exact vault paths: `"Projects/AI Research.md"`
   - Include `.md` extension
   - Paths are case-sensitive
   - Use `normalizePath()` format

2. **Interpreting Results**:
   - Higher link counts = stronger connection
   - Zero backlinks = orphaned note (might be new or isolated)
   - Many backlinks = hub note (central to knowledge graph)
   - Link count includes all mentions, not unique locations

3. **Use Cases**:
   
   **Before Deleting**:
   ```json
   {"path": "Projects/Deprecated.md"}
   ```
   Check if any notes reference it.
   
   **Finding Related Work**:
   ```json
   {"path": "Concepts/Machine Learning.md"}
   ```
   Discover all notes discussing this topic.
   
   **Hub Identification**:
   ```json
   {"path": "Index/AI.md"}
   ```
   See if this is a well-connected index.

4. **Performance**:
   - Uses Obsidian's `resolvedLinks` cache (very fast)
   - Results are pre-computed by Obsidian
   - No file reading required
   - Works with large vaults efficiently

#### Example Usage

**Find Backlinks**:
```json
{
  "path": "Concepts/Neural Networks.md"
}
```

**Output** (with backlinks):
```
BACKLINKS FOR: "Concepts/Neural Networks.md"
---
1. Projects/AI Research.md (5 links)
2. Papers/Deep Learning Survey.md (3 links)
3. Daily/2025-01-20.md (1 link)
4. Research/Experiments/Trial-03.md (1 link)
```

**Output** (no backlinks):
```
BACKLINKS FOR: "Concepts/Neural Networks.md"
---
Status: No backlinks found
```

**Output** (error):
```
Error: File not found at "Concepts/Missing.md"
```

#### Obsidian-Specific Context

- Uses `app.metadataCache.resolvedLinks` for link data
- Only includes resolved internal links (not unresolved)
- Counts multiple links on same line separately
- Includes links in all contexts (paragraphs, lists, tables, etc.)
- Does not include:
  - Unresolved links (broken links)
  - External links
  - Embeds (`![[]]` syntax) - these are separate
  - Links in code blocks (depends on Obsidian version)
- Results are sorted by link count (descending)
- Updates automatically when links change in vault

---

## Best Practices Summary

### Tool Selection Strategy

1. **Start with Search**: Use `glob_vault_files` or `list_vault_folders` to explore
2. **Read Before Writing**: Always read content before modifications
3. **Confirm Destructive Operations**: Write operations show confirmation modals
4. **Use Semantic Search Wisely**: `smart_connections_rag` for conceptual queries
5. **Chain Tools Logically**: Search -> Read -> Analyze -> Write

### Error Recovery

All tools provide structured error messages with:
- Error type and description
- Recovery suggestions
- Alternative tool calls

Follow the recovery options provided in error messages.

### Performance Considerations

- **Cached Operations**: `read_note_section`, `get_backlinks` use Obsidian's cache
- **Search Limits**: Set appropriate limits to balance speed and comprehensiveness
- **Recursive Operations**: Use sparingly on large vaults
- **Content Inclusion**: Only include full content when necessary

### Obsidian Integration

All tools respect:
- Vault boundaries and permissions
- Obsidian's file system abstraction
- User settings and plugin configurations
- Obsidian's caching and indexing systems
- Wiki-link and Markdown conventions

---

## Version Information

**Guide Version**: 2.0  
**Last Updated**: 2025-01-27  
**Pure Chat LLM Version**: 2.0.0+

For plugin updates and changes, refer to the project's CHANGELOG.md.

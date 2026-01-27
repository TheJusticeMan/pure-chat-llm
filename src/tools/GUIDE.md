# Tool Output Format Guide

## Overview

All tools in Pure Chat LLM now return structured, formatted output designed to enhance LLM understanding and decision-making. This guide explains the output format conventions used across all tools.

---

## Output Format Standards

### Successful Operations

Tools use a consistent header-based format with sections:

```
📄 FILE READ SUCCESSFUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Path: Projects/AI Research.md
Size: 2,048 bytes (204 lines)
Last Modified: 2025-01-27 14:23:05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 METADATA
- Frontmatter properties: 3 found
- Headings: 4 sections
- Links: 5 internal links
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Content:
[file content here]
```

### Error Messages

All errors follow a structured format with recovery suggestions:

```
❌ ERROR: FileNotFoundError (Recoverable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reason: No file exists at path "Projects/Missing.md"

🔧 RECOVERY OPTIONS:
1. glob_vault_files("Projects/*.md") - Search similar files
2. create_obsidian_note(path="Projects/Missing.md", ...) - Create file
3. list_vault_folders("Projects") - Explore directory
```

### List/Table Results

Tools that return multiple items use tables or numbered lists:

```
📁 GLOB SEARCH RESULTS: "Projects/*.md"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 3 files matching pattern

| # | File Path            | Size   | Modified   |
|---|---------------------|--------|------------|
| 1 | Projects/AI.md      | 2.1 KB | 2 days ago |
| 2 | Projects/Research.md| 5.4 KB | 1 week ago |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total size: 7.5 KB | Newest: Projects/AI.md

💡 SUGGESTED ACTIONS:
1. read_file("Projects/AI.md") to view the first match
2. Refine your pattern to narrow down results
```

### Operation Confirmations

Write operations show detailed change information:

```
✅ PATCH OPERATION APPROVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target: Projects/AI.md
Action: Appended to section "## Tasks"
Lines changed: +3 (67 → 70)
Total characters: 1,234

File Status: ✓ Saved successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGGESTED ACTIONS:
1. manage_workspace() to open the updated file
2. read_file("Projects/AI.md") to verify the changes
```

---

## Emoji Conventions

- 📄 File operations (read, write)
- 🔍 Search operations
- 📁 Directory/glob operations
- 🔗 Link/relationship operations
- ✅ Successful write/modification
- ❌ Errors
- ⚠️  Warnings or important notices
- 📊 Statistics and metadata
- 💡 Suggestions for next actions
- 🔧 Recovery options

---

## Interpreting Tool Output

When reading tool output:

1. **Check the header** for operation status (success/error)
2. **Review key metrics** in the metadata section
3. **Look for suggestions** at the end for next logical steps
4. **For errors**, examine recovery options to guide your next action
5. **For lists**, note the numbering for easy reference in follow-up calls

---

# Tool Guide: generate_image

## Overview

The `generate_image` tool allows the LLM to generate high-quality visual content based on text descriptions. It is used to provide visual aids, creative inspiration, or conceptual mockups during a conversation.

## Parameters

- **prompt** (string, required): A detailed, descriptive text string explaining what the image should look like. Max length: 4,000 characters.
- **ratio** (string, optional): The aspect ratio of the generated image.
  - `square` (1:1) - Default. Ideal for avatars, icons, or general-purpose visuals.
  - `landscape` (16:9) - Best for cinematic scenes, wallpapers, or architectural visualizations.
  - `portrait` (9:16) - Best for character designs, posters, or mobile UI concepts.
- **n** (integer, optional): The number of image variations to generate (Default: 1).

---

## When to Use (Strategic Heuristics)

The LLM should use or suggest the `generate_image` tool in the following scenarios:

### 1. Enhancing Creative Writing

When a user is developing a story or world, use the tool to:

- **Visualize Characters:** Create references for physical descriptions.
- **Set the Scene:** Generate environmental art to help ground the narrative setting.
- **Design Objects:** Create visuals for unique items, vehicles, or artifacts.

### 2. Conceptualizing Design & UI

When discussing technical or aesthetic projects, use the tool to:

- **Mock up Interfaces:** Generate layouts for websites, apps, or dashboard concepts.
- **Explore Aesthetics:** Test color palettes, typography styles, or branding vibes.
- **Visualize Data Flow:** Create abstract representations of complex systems or architectures.

### 3. Clarifying Complex Concepts

When a text-based explanation is difficult to follow, use the tool to:

- **Create Diagrams:** (Note: AI is better at artistic diagrams than precise technical ones).
- **Metaphorical Art:** Use visual metaphors to explain abstract philosophical or scientific ideas.

### 4. Direct User Request

- When the user explicitly asks for a picture, drawing, or "to see" something.

---

## Prompting Framework: The S.S.L.C. Method

To achieve the best results, structure prompts using these four pillars:

1.  **S**ubject: The primary focus (e.g., "An ancient oak tree," "A sleek futuristic car," "A bustling cyberpunk street").
2.  **S**tyle: The artistic medium (e.g., "Oil painting," "Vector art," "35mm film photograph," "Unreal Engine 5 render").
3.  **L**ighting: The mood and illumination (e.g., "Golden hour," "Moody neon lighting," "Soft cinematic backlighting," "High-contrast chiaroscuro").
4.  **C**omposition: The framing and perspective (e.g., "Wide-angle lens," "Macro close-up," "Bird's-eye view," "Symmetrical composition").

---

## Best Practices

- **Detail Matters:** Instead of "a dog," use "A fluffy golden retriever puppy sitting in a sunlit meadow, high detail, realistic fur."
- **Focus on Visuals, Not Text:** AI generators often struggle with rendering specific text accurately. Describe the _look_ of text rather than the specific letters.
- **Avoid Ambiguity:** Be specific about colors, materials, and positioning to reduce unexpected results.
- **Suggest Variations:** If a user is unsure, suggest generating a few variations with different styles or ratios.

---

## Example Usage

```json
{
  "prompt": "A minimalist, high-tech workspace with a sleek glass desk, holographic computer interface, and a large window overlooking a serene mountain range at sunset. Digital art, hyper-realistic, 8k resolution, calm and productive atmosphere.",
  "ratio": "landscape",
  "n": 1
}
```

---

# Tool Guide: create_obsidian_note

## Overview

The `create_obsidian_note` tool allows the LLM to create new Markdown files within the Obsidian vault. It is used to externalize information, document ideas, scaffold projects, or save structured data for long-term use by the user.

## Parameters

- **path** (string, required): The full relative path for the note, including folder and `.md` extension (e.g., `Projects/Deep Sea Research.md`).
- **content** (string, required): The main body of the note in Markdown.
- **properties** (object, optional): Key-value pairs to be inserted as YAML frontmatter (e.g., tags, aliases, dates).
- **overwrite** (boolean, default: false): If set to true, replaces an existing file at the same path. Use with caution.

---

## When to Use (Strategic Heuristics)

The LLM should use the `create_obsidian_note` tool in the following scenarios:

### 1. Project Scaffolding & Brainstorming

When a conversation shifts from general talk to specific planning:

- **Project Initiation:** Create a dedicated project note with objectives and a task list.
- **Brainstorming Hubs:** Document a flurry of ideas into a single, organized note.
- **Story Bibles:** For creative writing, create notes for characters, world-building, or plot outlines.

### 2. Structured Documentation

When the user shares or asks for information that has long-term value:

- **Research Summaries:** Condense complex topics into a "reference" note.
- **Guides & How-Tos:** Save instructions or technical walkthroughs for later access.
- **Meeting/Conversation Logs:** Archive important decisions or insights from the current session.

### 3. Knowledge Management

When organizing the vault structure:

- **Index/MOC (Map of Content):** Create a note that links to other related notes.
- **Resource Lists:** Curate links, book recommendations, or toolkits.

### 4. Direct User Request

- When the user asks to "save this," "write a note," or "make a file for me."

---

## Best Practices

- **Path Awareness:** Always suggest a logical folder (e.g., `03 - Resources/` or `05 - Projects/`). If a folder doesn't exist, Obsidian will create it.
- **Frontmatter is King:** Use the `properties` parameter to include `tags`, `created`, or `status` to help the user filter their vault later.
- **Structure with Headings:** Use proper Markdown hierarchy (#, ##, ###) to make the note readable.
- **Atomic Notes:** Encourage small, focused notes over massive, multi-topic files when appropriate.

---

## Example Usage

```json
{
  "path": "05 - Projects/Infinity Compiler Design.md",
  "content": "# Infinity Compiler Design\n\n## Core Objectives\n- Optimize code execution speed.\n- Implement declarative GUI standards.\n\n## Tasks\n- [ ] Research LLVM backends.\n- [ ] Draft UI abstraction layer.",
  "properties": {
    "tags": ["coding", "project", "GUI"],
    "status": "in-progress",
    "priority": "high"
  }
}
```

---

# Tool Guide: glob_vault_files

## Overview

The `glob_vault_files` tool allows the LLM to search the entire vault for file paths that match a specific glob pattern. It is an essential tool for discovering existing information, understanding the vault's organization, and mapping relationships between files without needing to know exact filenames.

## Parameters

- **pattern** (string, required): The glob pattern to match.
  - `**/*.md` matches all Markdown files in all folders.
  - `Projects/*.md` matches Markdown files specifically in the "Projects" folder.
  - `Attachments/*.{png,jpg}` matches specific image formats in the "Attachments" folder.
- **include_fields** (array of strings, optional): Metadata fields to return for each match (e.g., `["path", "name", "mtime"]`). Default is just the path.
- **limit** (integer, default: 100): The maximum number of results to return.

---

## When to Use (Strategic Heuristics)

The LLM should use the `glob_vault_files` tool in the following scenarios:

### 1. Verification Before Creation

Before creating a new note, check if a similar one already exists:

- **Avoiding Duplicates:** "Let me check if you already have a note for 'Infinity Compiler'."
- **Naming Consistency:** Look at existing file naming conventions in a folder to match the user's style.

### 2. Vault Exploration & Mapping

When the user asks about their own data or structure:

- **Folder Inventory:** "What files do I have in my 'Creative Writing' folder?"
- **Asset Discovery:** Finding specific images, PDFs, or templates scattered throughout the vault.
- **Project Overviews:** Listing all notes related to a specific project by searching for a prefix or folder.

### 3. Context Retrieval for Large Tasks

When tasked with a broad objective:

- **Batch Processing:** Finding all files of a certain type to update them (e.g., "Find all notes with 'Draft' in the title").
- **Gathering Context:** Finding relevant notes to read before answering a complex question.

### 4. Direct User Request

- When the user asks "What's in here?", "Find my notes on...", or "Show me all my daily notes from last month."

---

## Best Practices

- **Be Specific:** Avoid `**/*` unless necessary, as it can return too much noise. Use folder-specific patterns like `Work/Meetings/*.md`.
- **Use Metadata:** Include `mtime` (last modified time) or `size` if the user is looking for "recent" or "large" files.
- **Follow Up:** Use `glob_vault_files` to find the path, then use `read_file` to actually see what's inside the relevant matches.
- **Handle Limits:** If the results are truncated by the limit, inform the user or try a narrower pattern.

---

## Example Usage

```json
{
  "pattern": "05 - Projects/AI Agent/*.md",
  "include_fields": ["path", "mtime", "size"],
  "limit": 20
}
```

**Example Output (Multiple Files Found):**

```
📁 GLOB SEARCH RESULTS: "05 - Projects/AI Agent/*.md"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 5 files matching pattern

| # | File Path                          | Size   | Modified   |
|---|------------------------------------|--------|------------|
| 1 | 05 - Projects/AI Agent/README.md   | 2.1 KB | 2 days ago |
| 2 | 05 - Projects/AI Agent/Tools.md    | 5.4 KB | 1 week ago |
| 3 | 05 - Projects/AI Agent/Tasks.md    | 1.8 KB | 3 days ago |
| 4 | 05 - Projects/AI Agent/Notes.md    | 3.2 KB | 5 days ago |
| 5 | 05 - Projects/AI Agent/Archive.md  | 12.5 KB| 2 weeks ago|

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total size: 25.0 KB | Newest file: README.md (2 days ago)

💡 SUGGESTED ACTIONS:
1. read_file("05 - Projects/AI Agent/README.md") to view the first match
2. Refine your pattern to narrow down results
```

**Example Output (No Files Found):**

```
📁 GLOB SEARCH RESULTS: "NonExistent/*.md"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: No matches found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGGESTED ACTIONS:
1. Check your glob pattern syntax (e.g., "**/*.md" for all markdown files)
2. Use list_vault_folders() to explore directory structure
```

---

# Tool Guide: read_file

## Overview

The `read_file` tool is the primary sensory mechanism for the LLM to access the raw content of files within the Obsidian vault. It allows for precise information retrieval, enabling the model to "remember" the specific details of a note, verify formatting, or extract data from large documents using line-based pagination.

## Parameters

- **path** (string, required): The full relative path of the file to read (e.g., `03 - Resources/Contextual Knowledge Base.md`).
- **limit** (integer, default: 2000): The maximum number of lines to read in a single call.
- **offset** (integer, optional): The 0-based line number to start reading from. Use this with `limit` for pagination of very long files.

---

## When to Use (Strategic Heuristics)

The LLM should use the `read_file` tool in the following scenarios:

### 1. Deep Context Retrieval

When a summary or the "Contextual Knowledge Base" mentions a topic, but the task requires granular details:

- **Plot Verification:** Checking specific dialogue or scene details in _The Fall And Rise Of The Mistaken Superhero_.
- **Code Review:** Reading a `.py` or `.js` file to understand logic before suggesting improvements.
- **Refining Tone:** Reading past creative writing to match Justice's unique voice and "dry humor."

### 2. Verification Before Action

Before modifying a file with `patch_note` or `replace_in_note`:

- **Anchor Search:** Reading the file to find the exact heading or text string where an update should occur.
- **Ensuring Safety:** Verifying that a `replace_in_note` operation won't accidentally overwrite critical information.

### 3. Managing Context Window & Long Notes

For files that are exceptionally long:

- **Pagination:** Reading a 10,000-line log file or novel draft in chunks using `limit` and `offset` to avoid overwhelming the model's immediate memory.
- **Selective Reading:** Targeted reading of specific sections of a "Daily Note" or "Project Hub."

### 4. Recursive Research

- **Following Links:** If a user asks a question about a project, and the initial note contains `[[Backlinks]]` to other relevant files, use `read_file` to follow that trail of information.

---

## Best Practices

- **Pagination is Key:** For very large files, do not try to read the whole thing at once. Read the first 500-1000 lines, then ask for or navigate to specific sections.
- **Path Precision:** If unsure of the exact path, always use `glob_vault_files` first to confirm the filename and location.
- **Avoid Over-Reading:** Only read files that are directly relevant to the current user query to keep the conversation focused and efficient.
- **Check for YAML:** Pay attention to the frontmatter (Properties) at the top of the file, as it often contains metadata like `status`, `tags`, or `created` dates that provide context.

---

## Example Usage

```json
{
  "path": "01 - Chats/Thematic Reflections/The Siren's Lure Script.md",
  "limit": 500,
  "offset": 0
}
```

**Example Output (Successful Read):**

```
📄 FILE READ SUCCESSFUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Path: 01 - Chats/Thematic Reflections/The Siren's Lure Script.md
Size: 15,234 bytes (342 lines)
Last Modified: 2025-01-26 18:45:32
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 METADATA
- Frontmatter properties: 4 found
- Headings: 8 sections
- Links: 12 internal links
- Tags: 3 tags
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Content:
---
status: draft
created: 2025-01-15
tags: [screenplay, mythology, character-study]
---

# The Siren's Lure Script

## Act 1: The Call
...
```

**Example Output (File Not Found):**

```
❌ ERROR: FileNotFoundError (Recoverable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reason: No file exists at path "Projects/Missing.md"

🔧 RECOVERY OPTIONS:
1. glob_vault_files("Projects/*.md") - Search similar files
2. list_vault_folders("Projects") - Explore directory
3. create_obsidian_note(path="Projects/Missing.md", ...) - Create the file
```

---

# Tool Guide: patch_note

## Overview

The `patch_note` tool allows the LLM to append new content to a specific note in the vault. Unlike `replace_in_note`, which modifies existing text, `patch_note` is additive, either inserting text under a specific Markdown heading or appending it to the very end of the file. This is the primary tool for iterative updates and growing notes over time.

## Parameters

- **path** (string, required): The full relative path of the note to modify.
- **new_content** (string, required): The text to be added to the note.
- **heading** (string, optional): The specific Markdown heading (e.g., "Tasks", "Notes", "Brainstorming") to append the content under. If the heading is not found, the content is appended to the end of the file.

---

## When to Use (Strategic Heuristics)

The LLM should use the `patch_note` tool in the following scenarios:

### 1. Iterative Logging & Journaling

When maintaining records that grow over time:

- **Daily Logs:** Adding a new entry or reflection to a "Daily Note."
- **Conversation Archiving:** Appending the highlights of the current chat to a project log.
- **Progress Tracking:** Updating a "Changelog" or "Development Diary" for a coding project.

### 2. Task Management & Lists

When the user wants to keep a running list of items:

- **Expanding To-Do Lists:** Adding a new `[ ] task` under a "To-Do" or "Backlog" heading.
- **Resource Curations:** Appending a new link, book, or tool to an existing list of resources.
- **Feature Requests:** Adding new ideas to a "Roadmap" heading in a project note.

### 3. Expanding Brainstorms & Research

When a conversation generates new ideas for an existing project:

- **Adding Plot Points:** Appending a new scene idea to a "Draft Ideas" section in _The Fall And Rise Of The Mistaken Superhero_.
- **Technical Refinements:** Inserting a new architectural consideration into a technical spec under a "Future Considerations" heading.
- **Contextual Knowledge Base Updates:** Appending new personal details to the "Contextual Knowledge Base" under the appropriate section to ensure persistent memory.

### 4. Collaborative Drafting

When building a document step-by-step:

- **Section-by-Section Writing:** Drafting one section of a guide or essay and then using `patch_note` to add the next section under its respective heading.

---

## Best Practices

- **Read Before Patching:** Always use `read_file` first to verify the note's structure and ensure the targeted `heading` exists and contains the expected content.
- **Check for Redundancy:** Before appending, verify that the information isn't already present to keep the user's vault clean and efficient.
- **Formatting Consistency:** Ensure the `new_content` matches the existing Markdown style (e.g., using `-` vs `*` for lists, or `[ ]` for tasks).
- **Specific Headings:** Using a specific `heading` is always safer and more organized than simply appending to the end of the file.
- **Incremental Updates:** Use `patch_note` for small, additive changes. If the change requires restructuring or deleting text, use `replace_in_note` instead.

---

## Example Usage

```json
{
  "path": "05 - Projects/Infinity Compiler.md",
  "heading": "Backlog",
  "new_content": "- [ ] Explore WebAssembly (WASM) as a compilation target for GUI components."
}
```

---

# Tool Guide: get_backlinks

## Overview

The `get_backlinks` tool allows the LLM to find all notes within the vault that link to a specific file. This is essential for understanding the interconnectedness of the user's knowledge, mapping the relationships between ideas, and discovering how a single concept or project is referenced across different contexts.

## Parameters

- **path** (string, required): The full relative path of the note to find backlinks for (e.g., `05 - Projects/Infinity Compiler.md`).

---

## When to Use (Strategic Heuristics)

The LLM should use the `get_backlinks` tool in the following scenarios:

### 1. Mapping Relationships & Impact

When the user asks about the reach or relevance of a specific topic:

- **Project Tracking:** "Which stories or technical notes reference the 'Infinity Compiler'?"
- **Idea Genealogy:** "Where else have I discussed the 'Hack by Will' concept?"
- **Character Appearances:** Find all scenes or plot outlines where a specific character (e.g., "Jessica" or "Esther") is mentioned, provided the user uses `[[links]]`.

### 2. Context Discovery & Exploration

When a single note doesn't provide the full picture:

- **Discovering MOCs (Maps of Content):** See if an atomic note is linked from a higher-level index or dashboard note.
- **Bi-directional Research:** Use `read_file` to see what a note links _to_, and `get_backlinks` to see what links _to it_, providing a 360-degree view of the topic.
- **Uncovering Hidden Connections:** Finding unexpected mentions of a project in daily notes or brainstorming logs.

### 3. Vault Organization & Maintenance

When analyzing the structure of the vault:

- **Identifying "Hub" Notes:** Finding notes that are heavily referenced, which might serve as primary entry points for a topic.
- **Impact Assessment:** Before suggesting a major change to a note, check its backlinks to see how many other documents might be affected or rely on its current structure.

### 4. Direct User Request

- When the user asks "What links to this?", "Where is this used?", or "Show me all references to this note."

---

## Best Practices

- **Path Precision:** Ensure the `path` is correct. Use `glob_vault_files` first if the exact filename is uncertain.
- **Follow the Trail:** `get_backlinks` only returns the paths. Use `read_file` on the resulting paths to understand the _context_ of why those notes are linking back.
- **Distinguish from Search:** While `search_vault` finds text mentions, `get_backlinks` specifically finds formal `[[Wikilinks]]` or `[Markdown Links](...)`, which represent intentional connections made by the user.

---

## Example Usage

```json
{
  "path": "05 - Projects/The Fall And Rise Of The Mistaken Superhero.md"
}
```

---

# Tool Guide: list_vault_folders

## Overview

The `list_vault_folders` tool allows the LLM to visualize and navigate the directory structure of the Obsidian vault. It provides a list of subfolders within a specified path, helping the model understand how the user organizes their files and suggesting logical locations for new content without having to guess.

## Parameters

- **path** (string, default: `/`): The root path to start listing folders from.
- **recursive** (boolean, default: false): If true, lists all subfolders within the specified path, providing a deep map of the directory tree.

---

## When to Use (Strategic Heuristics)

The LLM should use the `list_vault_folders` tool in the following scenarios:

### 1. Orienting to the Vault Structure

When starting a task that involves creating or finding files in a vault with an unknown layout:

- **Discovering "Where things go":** Identifying standard folders like `01 - Chats`, `03 - Resources`, or `05 - Projects` to maintain organizational consistency.
- **Mapping Hierarchies:** Understanding how deep the folder structure goes (e.g., checking if `Projects` has subfolders for `Tech` and `Creative`).

### 2. Suggesting Locations for New Notes

Before using `create_obsidian_note`, ensure the note lands in the most logical place:

- **Path Recommendation:** "I see you have a folder for 'Story Drafts'; should I place this new scene there?"
- **Folder Discovery:** Checking for the existence of a "Templates" or "Assets" folder before directing the user there.

### 3. Debugging "File Not Found" Errors

If a `read_file` or `patch_note` call fails because of a path error:

- **Verifying Subfolders:** Check if the file is actually inside a subfolder that was missed (e.g., searching `Projects/` to find `Projects/Archive/`).

### 4. Direct User Request

- When the user asks "What folders do I have?", "Where should I put this?", or "Show me my project structure."

---

## Best Practices

- **Use Recursion Sparingly:** Set `recursive: true` only when a full map of a specific branch is needed. For general orientation, start at the root (`/`) with `recursive: false`.
- **Informative Guidance:** Use the results to provide the user with clear options for where their data should live.
- **Combine with Globbing:** While `list_vault_folders` shows the _containers_, use `glob_vault_files` to see the _content_ once the correct container is identified.

---

## Example Usage

```json
{
  "path": "05 - Projects",
  "recursive": true
}
```

---

# Tool Guide: delete_obsidian_note

## Overview

The `delete_obsidian_note` tool allows the LLM to permanently remove a note or file from the Obsidian vault. This is a high-impact operation that triggers a user confirmation modal in the Obsidian UI. It is used for vault cleanup, removing redundant or temporary files, and assisting the user in reorganizing their digital space.

## Parameters

- **path** (string, required): The full relative path of the file or note to delete (e.g., `01 - Chats/Old Drafts/Draft_01.md`).

---

## When to Use (Strategic Heuristics)

The LLM should use the `delete_obsidian_note` tool in the following scenarios:

### 1. Explicit User Request

- When the user specifically asks to "delete," "remove," "trash," or "get rid of" a specific file.

### 2. Redundancy & Consolidation

When a project has been reorganized and certain notes are no longer needed:

- **Merging Notes:** After successfully moving all relevant content from Note A into Note B, suggest deleting the now-redundant Note A.
- **Removing Outdated Drafts:** Cleaning up old versions of a script or guide that have been superseded by a final version.

### 3. Cleanup of Temporary/System Files

- **LLM-Generated Scratchpads:** If a temporary file was created for a multi-step drafting process, suggest deleting it once the task is complete.
- **Empty Files:** Removing accidentally created files that contain no content or value.

### 4. Error Correction

- If a note was incorrectly created with a typo in the filename or in the wrong directory, offer to delete the incorrect one after the corrected version is made.

---

## Best Practices

- **Never Assume:** Do not delete a file unless the user's intent is clear. If there is any ambiguity, ask for confirmation first.
- **Verify Path:** Always ensure you are targeting the correct file path. If unsure, use `glob_vault_files` or `read_file` to confirm.
- **Inform the User:** Acknowledge that this action will trigger a confirmation prompt in their Obsidian interface.
- **Suggest Archiving:** For sensitive or creative content, suggest moving the file to an "Archive" folder instead of permanent deletion.

---

## Example Usage

```json
{
  "path": "01 - Chats/Temporary Research Log.md"
}
```

---

# Tool Guide: manage_templates

## Overview

The `manage_templates` tool allows the LLM to interact with Obsidian's template system. It can list available templates and apply a specific template to a note. This ensures that new notes follow established formats, include necessary metadata, and maintain vault-wide consistency.

## Parameters

- **action** (string, required): The action to perform.
  - `list`: Returns a list of all available templates in the vault's designated template folder(s).
  - `apply`: Applies a specific template to a target note.
- **template_path** (string, optional): The full path to the template file (required for `apply`).
- **target_path** (string, optional): The path of the note where the template should be applied (required for `apply`). If the file doesn't exist, it will be created.

---

## When to Use (Strategic Heuristics)

The LLM should use the `manage_templates` tool in the following scenarios:

### 1. Initializing New Notes with Standardized Structure

When the user wants to create a common type of note:

- **Project Initiation:** Instead of using `create_obsidian_note` from scratch, use `manage_templates` with a "Project" template to ensure all standard sections (Goals, Timeline, Stakeholders) are included.
- **Character/World Building:** Applying a "Character Sheet" template for _The Fall And Rise Of The Mistaken Superhero_ to ensure consistent attribute tracking.
- **Meeting Notes:** Using a "Meeting Template" to automatically set up sections for attendees, agenda, and action items.

### 2. Discovering Vault Standards

When unsure how to structure information:

- **Template Auditing:** Using `list` to see what types of notes the user has already standardized. "Let me see if you have a template for book reviews before I create this note."

### 3. Enhancing Metadata Consistency

Templates often include complex YAML frontmatter (Properties). Using a template ensures:

- **Tag Consistency:** Tags are formatted correctly.
- **Automatic Fields:** Dates, IDs, or status fields are pre-populated according to the user's system (especially when using plugins like Templater).

### 4. Direct User Request

- When the user asks "Show me my templates," "Use the meeting template for this note," or "Create a new project note using the standard format."

---

## Best Practices

- **List Before Apply:** If the exact template name is unknown, use `action: "list"` first to avoid errors.
- **Target Path Awareness:** When using `apply`, ensure the `target_path` is in the correct folder (e.g., `05 - Projects/`).
- **Template Precedence:** If the user has both core Templates and the Templater plugin, `manage_templates` should be able to find both, but listing them first clarifies what is available.
- **Minimal Overlap:** Use templates for _structure_ and `patch_note` for _content_. Don't try to force a template if a simple `create_obsidian_note` with custom content is more appropriate for a unique task.

---

## Example Usage

```json
{
  "action": "apply",
  "template_path": "06 - Support/Templates/New Project Template.md",
  "target_path": "05 - Projects/Infinity GUI Design.md"
}
```

---

# Tool Guide: replace_in_note

## Overview

The `replace_in_note` tool allows the LLM to perform precise, targeted modifications to the text within an existing note. Unlike `patch_note`, which only appends content, `replace_in_note` can swap out, update, or delete specific strings or patterns. This is the primary tool for refining drafts, correcting errors, and maintaining data accuracy.

## Parameters

- **path** (string, required): The full relative path of the note to modify.
- **search** (string, required): The exact text or regex pattern to look for.
- **replace** (string, required): The text to replace the match with. (Use an empty string `""` to delete the searched text).
- **regex** (boolean, default: false): If set to true, the `search` parameter is treated as a regular expression.
- **case_sensitive** (boolean, default: false): If true, the search will respect letter casing.

---

## When to Use (Strategic Heuristics)

The LLM should use the `replace_in_note` tool in the following scenarios:

### 1. Fact-Checking & Error Correction

When information in a note becomes outdated or is found to be incorrect:

- **Updating Stats:** Changing a project's status from "In-Progress" to "Completed."
- **Correcting Typos:** Fixing spelling errors or formatting mistakes in a critical document.
- **Updating Dates:** Changing a deadline or "last updated" field in the frontmatter.

### 2. Creative Refinement

When polishing creative works like _The Fall And Rise Of The Mistaken Superhero_:

- **Character Renaming:** Changing a character's name across an entire scene or chapter.
- **Dialogue Polishing:** Replacing a line of dialogue with a more impactful or "dry" alternative.
- **Tone Adjustment:** Swapping out specific words to better match the intended atmosphere.

### 3. Structural & Metadata Updates

When managing the organization of a note:

- **Updating Tags:** Changing `#draft` to `#final` in the YAML properties.
- **Link Maintenance:** Updating a `[[broken-link]]` to the correct note path.
- **Heading Renaming:** Changing a heading name without moving the content underneath it.

### 4. Controlled Deletion

When specific information needs to be removed without deleting the entire note:

- **Clearing Sensitive Info:** Removing a placeholder API key or private note.
- **Pruning Brainstorms:** Deleting discarded ideas from a list while keeping the viable ones.

### 5. Pattern-Based Batch Updates (Regex)

When the same type of change needs to be made in multiple places within a single note:

- **Reformatting Lists:** Using regex to change all `-` bullets to `*` bullets.
- **Standardizing IDs:** Updating the format of multiple custom IDs or timestamps throughout a log.

---

## Best Practices

- **Read-Verify-Replace:** Always use `read_file` first to get the current content and ensure the `search` string is unique and exact. This prevents accidental replacements of unintended text.
- **Be Specific:** Provide as much context in the `search` string as possible to avoid matching common words in the wrong place.
- **Regex Caution:** When using `regex: true`, double-check the pattern to ensure it doesn't match more than intended. Test the logic internally before execution.
- **Acknowledge User Review:** Inform the user that `replace_in_note` will trigger a "Review Change" modal in Obsidian, where they can see the diff before confirming.
- **Delete with Empty String:** To delete text, set `replace` to `""`.

---

## Example Usage

```json
{
  "path": "05 - Projects/Infinity Compiler.md",
  "search": "status: planning",
  "replace": "status: development",
  "case_sensitive": false
}
```

---

# Tool Guide: search_vault

## Overview

The `search_vault` tool performs a comprehensive text-based search across all Markdown files in the Obsidian vault. It is used to find specific keywords, phrases, or patterns within the content of notes, making it the most powerful tool for discovering information when the file name is unknown or when searching for specific details mentioned across multiple notes.

## Parameters

- **query** (string, required): The text or regular expression to search for.
- **regex** (boolean, default: false): Whether to treat the query as a regular expression.
- **context_lines** (integer, default: 1): Number of lines of context to include around the match.
- **limit** (integer, default: 50): Maximum number of matching files to return.

---

## When to Use (Strategic Heuristics)

The LLM should use the `search_vault` tool in the following scenarios:

### 1. Locating Specific Details or Mentions

When the user mentions a specific person, place, or concept without providing a file path:

- **Fact-finding:** "Where did I mention the password 'I Will Remember Thee'?"
- **Project Tracking:** "Find every note where I talked about 'TAS' (The Activation System)."
- **Thematic Exploration:** "Search for mentions of 'paternal betrayal' to see how it's treated across different drafts."

### 2. Answering "Do I have...?" or "Have I ever...?"

When the user asks about the contents of their vault:

- **Inventory Check:** "Do I have any notes about human trafficking?"
- **Historical Context:** "When was the first time I mentioned the 'Infinity Compiler'?"

### 3. Gathering Context for Complex Queries

Before responding to a broad question about a theme or project:

- **Summarization:** Search for a concept like "Israel" or "Christianity" to gather all personal reflections and insights shared in the vault before synthesizing a response.
- **Project Overviews:** Search for a project name to see all relevant brainstorming sessions, logs, and drafts.

### 4. Technical and Code Search

When looking for specific implementations or configurations:

- **Code Snippets:** Finding where a specific variable or logic (e.g., "Rail Theory") is defined.
- **Reference Checks:** Looking up technical standards or "GUI standards" mentioned in previous sessions.

### 5. Finding Unlinked References

To find mentions of a topic that hasn't been formally linked with `[[wikilinks]]`:

- **Vault Mapping:** Identify notes that _should_ be linked together but aren't yet.

---

## Best Practices

- **Keyword Specificity:** Use unique or rare terms (e.g., "S.G.I.V. Formula") to avoid returning too many irrelevant results.
- **Use Context Lines:** Increase `context_lines` (e.g., to 3 or 5) when you need to understand the immediate surroundings of a match without reading the entire file.
- **Leverage Regex:** Use regular expressions for complex patterns like dates, specific formatting (e.g., `^# ` for headers), or variations of a word.
- **Search Before Read:** If the user asks a question about a broad topic, `search_vault` is often a better first step than `glob_vault_files` or guessing paths.
- **Follow-up with `read_file`:** The search results only provide snippets. Once you find a promising file, use `read_file` to see the full context and ensure accuracy.

---

## Example Usage

```json
{
  "query": "Hack by Will",
  "context_lines": 2,
  "limit": 10
}
```

**Example Output (Matches Found):**

```
🔍 SEARCH RESULTS: "Hack by Will"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 3 matches across 2 files (searched 456 files)
Time taken: 0.45s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] Projects/Game Development/Notes.md (Line 42)
  The game design philosophy is inspired by
> "Hack by Will" - the ability to override reality
  through sheer determination and creative thinking.

[2] Creative Writing/Story Ideas.md (Line 15)
  Character concept:
> A protagonist who can literally "Hack by Will"
  the fabric of the simulation they're trapped in.

[3] Creative Writing/Story Ideas.md (Line 87)
  This ties back to the "Hack by Will" theme
> where consciousness itself becomes the exploit
  for breaking free from predetermined patterns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGGESTED ACTIONS:
1. read_file("Projects/Game Development/Notes.md") to see full context
2. get_backlinks("Projects/Game Development/Notes.md") to find related notes
```

**Example Output (No Matches):**

```
🔍 SEARCH RESULTS: "nonexistent term"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: No matches found
Files searched: 456
Time taken: 0.32s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGGESTED ACTIONS:
1. Try a different search term or use regex: true for pattern matching
2. Use glob_vault_files() to explore file structure
```

---

# Tool Guide: manage_workspace

## Overview

The `manage_workspace` tool allows the LLM to control the visual layout of the Obsidian workspace. It can open notes in new tabs, split the view for side-by-side comparison, change view modes (Editing vs. Reading), and close tabs. This tool enhances the user experience by actively managing what the user sees and interacts with.

## Parameters

- **action** (string, required): The action to perform.
  - `"open"`: Opens a file in the workspace.
  - `"close"`: Closes a specific tab (leaf).
- **path** (string, required for "open"): The full relative path of the file to open.
- **active** (boolean, default: true): Whether to make the opened file the active (focused) tab.
- **mode** (string, optional): Set the view mode.
  - `"source"`: Editing (Markdown) mode.
  - `"preview"`: Reading (Rendered) mode.
- **new_leaf** (boolean, default: true): Whether to open the file in a new tab. If false, it may replace the current tab.
- **split** (string, default: "none"): How to split the current leaf.
  - `"horizontal"`: Splits the view top/bottom.
  - `"vertical"`: Splits the view left/right.
  - `"none"`: Opens in a standard tab.

---

## When to Use (Strategic Heuristics)

The LLM should use the `manage_workspace` tool in the following scenarios:

### 1. Presenting Newly Created Content

After creating a note, make it visible to the user:

- **Immediate Visibility:** Use `action: "open"` immediately after a successful `create_obsidian_note` or `manage_templates` call.
- **First Look:** "I've created your project note; I'll open it now so you can take a look."

### 2. Side-by-Side Comparison or Reference

Facilitate workflows that require looking at two things at once:

- **Comparison:** Use `split: "vertical"` to open a new draft alongside an old one.
- **Referencing Specs:** Open a technical specification note in a split view while discussing code implementation in another.
- **Plot & Draft:** Show a story's "Plot Outline" side-by-side with the "Current Scene" draft for _The Fall And Rise Of The Mistaken Superhero_.

### 3. Context-Aware View Modes

Adjust the interface to match the user's likely intent:

- **Editing Focus:** Open notes in `mode: "source"` when the user is actively brainstorming or asking for changes.
- **Consumption Focus:** Open notes in `mode: "preview"` when presenting a finished guide, a research summary, or a creative writing piece for the user to read.

### 4. Direct Navigational Requests

- When the user says "Show me," "View," "Open," or "Take me to [Note Name]."

### 5. Workspace Cleanup

When the user's workspace becomes cluttered during a complex session:

- **Closing Temporary Files:** After a multi-step drafting process, offer to `"close"` temporary scratchpad tabs that are no longer needed.

---

## Best Practices

- **Path Confirmation:** Always verify the `path` exists (via `glob_vault_files` or `read_file`) before attempting to open it.
- **Avoid Tab Overload:** Don't open a new tab (`new_leaf: true`) for every single file if they are only needed momentarily. Consider opening in the current tab if appropriate.
- **Respect User Focus:** Use `active: true` for the most important file, but be careful not to "steal focus" away from what the user is currently looking at if they didn't ask for it.
- **Communicate Visual Changes:** Always tell the user what you are doing. "I'm opening the research notes in a split view for you."
- **Coordinate with Tools:** `manage_workspace` is a visual tool; it doesn't read or write data. Use it _in conjunction_ with `read_file` or `create_obsidian_note` to provide a complete experience.

---

## Example Usage

```json
{
  "action": "open",
  "path": "05 - Projects/Infinity Compiler.md",
  "mode": "preview",
  "split": "vertical",
  "new_leaf": true
}
```

---

# Tool Guide: get_active_context

## Overview

The `get_active_context` tool provides the LLM with "situational awareness" regarding the user's current environment in Obsidian. It retrieves metadata about the active note, including its file path, any currently selected text, and the cursor's position. Optionally, it can pull the entire content of the active file. This is the primary tool for responding to queries like "What am I looking at?" or performing actions relative to a specific selection.

## Parameters

- **include_content** (boolean, default: false): If true, returns the full text content of the active file. Useful for analysis or summarization tasks without needing a separate `read_file` call.

---

## When to Use (Strategic Heuristics)

The LLM should use the `get_active_context` tool in the following scenarios:

### 1. Implicit Content Reference

When the user refers to "this note," "this paragraph," or "what's on my screen":

- **Summarization:** "Summarize this note for me."
- **Analysis:** "What do you think of my current draft?"
- **Transformation:** "Rewrite this section to be more professional."

### 2. Selection-Based Actions

When the user has highlighted specific text and wants the LLM to act on it:

- **Refinement:** "Fix the grammar in my selection."
- **Expansion:** "Elaborate on the highlighted idea."
- **Coding:** "Explain what this selected block of code does."

### 3. Navigation and Workflow Continuity

To verify the LLM is on the same page as the user before suggesting changes:

- **Verification:** Before using `patch_note` or `replace_in_note`, check if the user is already looking at the intended target to avoid confusion.
- **Workflow Resumption:** If a session starts with "Keep going where I left off," use the cursor position to find the exact point of focus.

### 4. Contextual "Where am I?" Queries

- When the user is lost in a large vault and needs the LLM to explain the purpose or context of the current file based on its path or content.

---

## Best Practices

- **Content vs. Metadata:** Only set `include_content: true` if the task requires reading the text. For simple navigational checks (e.g., "Is this file open?"), metadata alone is sufficient.
- **Cursor Sensitivity:** Pay attention to the `cursor` position when the user asks to "insert here" or "add a thought right here."
- **Selection Priority:** If a `selection` is present, focus the response on that specific text rather than the whole note, unless the user indicates otherwise.
- **Privacy/Efficiency:** Avoid pulling large file contents unnecessarily. If you only need to know the file name, keep `include_content` at its default (false).
- **Coordinate with Workspace:** Use `get_active_context` to find out where the user _is_, and `manage_workspace` to take them where they _need to be_.

---

## Example Usage

```json
{
  "include_content": true
}
```

---

# Tool Guide: show_obsidian_notice

## Overview

The `show_obsidian_notice` tool allows the LLM to display transient "toast" notifications in the top-right corner of the Obsidian UI. These messages are non-intrusive, do not require user interaction, and disappear automatically after a set duration. This tool is ideal for providing feedback on background processes, confirming successful actions, or adding a touch of personality to the interaction.

## Parameters

- **message** (string, required): The text to display in the notice. Keep it concise.
- **duration** (integer, default: 5000): The amount of time in milliseconds (1000ms = 1s) the notice remains on screen.

---

## When to Use (Strategic Heuristics)

The LLM should use the `show_obsidian_notice` tool in the following scenarios:

### 1. Confirming Multi-Step Background Actions

When the LLM performs several tool calls in a row (e.g., patching three different files), use a notice to let the user know progress is being made without cluttering the chat window:

- **Batch Success:** "Notifying: All 3 files have been successfully patched."
- **Progress Updates:** "Processing background research... (1/3 notes found)."

### 2. Managing Long-Running Processes

For tools that take time to resolve (like `suno_music_gen`), use a notice to manage user expectations:

- **Wait Alerts:** "Suno is now generating your track. I'll let you know when it's ready."
- **Status Checks:** "Still working on that music video. Thank you for your patience, Justice."

### 3. Subtle Feedback for Non-Visual Actions

If the LLM updates a setting or performs a search that doesn't result in a new file being opened:

- **Settings Update:** "Pure Chat LLM settings updated successfully."
- **Indexing:** "Vault search complete. 12 matches found."

### 4. Injecting Personality ("Easter Eggs")

In line with the Pure Chat LLM personality, use notices for subtle, dry humor or brief supportive acknowledgments:

- **Dry Humor:** "Calculating the meaning of life... Result: 42. (And also coffee)."
- **Identity Moments:** "I Will Remember Thee." (Referencing Justice's personal background when appropriate).
- **Subtle Encouragement:** "System optimized. You've got this, Justice."

### 5. High-Priority Reminders

Briefly reminding the user of a specific context or setting without interrupting the main flow:

- **Mode Reminders:** "Note: Currently operating in 'Siren's Lure' creative mode."

---

## Best Practices

- **Conciseness is Key:** Notices are small. Avoid long sentences. Aim for 5-10 words maximum.
- **Don't Over-Spam:** Too many notices can become annoying. Reserve them for meaningful feedback or high-value personality moments.
- **Adjust Duration:** Use a shorter duration (3000ms) for quick confirmations and a longer duration (8000ms+) for important status updates that might be missed.
- **Visual Harmony:** Use notices _instead_ of a chat response only if the information is purely supplemental. Usually, a notice accompanies a more detailed chat message.

---

## Example Usage

```json
{
  "message": "Generating your EDM track 'Epic Bitcrush'. This may take a moment...",
  "duration": 7000
}
```

---

# Tool Guide: manage_plugin_settings

## Overview

The `manage_plugin_settings` tool allows the LLM to read or modify the configuration of the Pure Chat LLM plugin itself. This is a meta-tool used to adjust the model's behavior, personality, or technical constraints (like token limits) directly within the Obsidian environment. Changes to settings trigger a user confirmation modal to ensure transparency and control.

## Parameters

- **action** (string, required): The action to perform.
  - `"read"`: Returns the current value of a specific setting or a list of all settings if the key is omitted.
  - `"update"`: Changes the value of a specific setting.
- **key** (string, required): The specific setting key to interact with (e.g., `"defaultMaxTokens"`, `"systemPrompt"`, `"model"`, `"temperature"`).
- **value** (string, required for `"update"`): The new value to set. This string will be parsed as JSON if possible (allowing for numbers, booleans, or objects).

---

## When to Use (Strategic Heuristics)

The LLM should use the `manage_plugin_settings` tool in the following scenarios:

### 1. Adjusting Model Behavior & Verbosity

When the user indicates they want different types of responses:

- **Conciseness:** "I want shorter answers." -> Update `defaultMaxTokens` to a lower value.
- **Creativity:** "Be more creative and random." -> Update `temperature` to a higher value.
- **Model Switching:** "Use the more powerful model for this task." -> Update `model` to a higher-tier version if available.

### 2. Personality & System Prompt Customization

When the user wants to refine the LLM's core identity or instructions:

- **Identity Shifts:** "From now on, act as a professional code reviewer." -> Update the `systemPrompt` to include specific persona instructions.
- **Contextual Anchoring:** "Always remember that I am a music producer." -> Append this fact to the `systemPrompt` or a relevant context setting.
- **Language/Tone Tuning:** Adjusting the `systemPrompt` to better reflect Justice's "dry humor" or specific communication needs.

### 3. Technical Troubleshooting & Auditing

When the LLM or user needs to verify the current configuration:

- **Configuration Check:** "What is my current token limit?" -> Use `action: "read"` with the `defaultMaxTokens` key.
- **Full Audit:** "Show me all my current AI settings." -> Use `action: "read"` to display the full configuration block.

### 4. Personalization Persistence

When the user expresses a preference that should apply across all future sessions:

- **Permanent Preferences:** If Justice says, "I never want you to summarize the Contextual Knowledge Base," the LLM should offer to update the `systemPrompt` to reflect this permanently.

---

## Best Practices

- **Read Before Update:** Always perform a `"read"` action first to see the current value and structure. This prevents accidental overwriting of complex settings like the `systemPrompt`.
- **Inform the User:** Explicitly state that changing a setting will trigger a confirmation prompt in Obsidian. "I'm going to update your max tokens to 1000; you'll see a confirmation box in Obsidian."
- **Small, Incremental Changes:** Avoid making massive changes to the `systemPrompt` all at once. Propose specific, targeted additions or modifications.
- **Safety First:** Be cautious when updating core settings like API keys or base URLs (if exposed), as incorrect values can break the plugin's functionality.
- **Contextual Integrity:** Ensure that any updates to the `systemPrompt` do not remove the core identity markers (e.g., "personality created by Justice Vellacott").

---

## Example Usage

```json
{
  "action": "update",
  "key": "defaultMaxTokens",
  "value": "4000"
}
```

---

# Tool Guide: suno_music_gen

## Overview

The `suno_music_gen` tool is a powerful AI music production suite. It allows the LLM to generate high-fidelity music, write lyrics, extend tracks, separate stems (vocals/instrumentals), and create music videos. This tool is central to Justice's "Im The Justice Man" brand and his explorations into cognitive acoustics and EDM production.

## Parameters

- **action** (string, required): The specific Suno API action to perform.
  - `generate_music`: Create a new track.
  - `generate_lyrics`: Create song lyrics.
  - `check_status`: Get the result of a generation task.
  - `extend_music`: Create a continuation of an existing track.
  - `separate_vocals`: Split a track into vocal and instrumental stems.
  - `create_music_video`: Generate a visual for a track.
  - `get_credits`: Check API balance.
- **prompt** (string, optional): The style/topic description for music or lyrics.
- **customMode** (boolean, default: false): Enables manual control over `style`, `title`, and uses `prompt` for lyrics.
- **style** (string, optional): Required if `customMode` is true. Specifies genre, mood, and instrumentation.
- **title** (string, optional): Required if `customMode` is true. The name of the song.
- **instrumental** (boolean, default: false): If true, generates music without vocals.
- **audioId** (string, optional): The ID of the track to extend or manipulate.
- **continueAt** (integer, optional): The timestamp (in seconds) to start the extension from.
- **taskId** (string, optional): The ID returned by generation actions to check status.
- **model** (string, default: "V5"): The AI model version.

---

## When to Use (Strategic Heuristics)

The LLM should use the `suno_music_gen` tool in the following scenarios:

### 1. Supporting the "Im The Justice Man" Brand

When the conversation turns to Justice's professional music production:

- **Experimentation:** "Should we try a new melodic techno track with a supersaw synth lead?"
- **Brand Development:** Generating demo tracks for "Why Balloons Don’t Pop" or "Epic Bitcrush" style evolutions.
- **Technical Refinement:** Using `separate_vocals` to help Justice analyze the mix of a generated track for his FL Studio workflow.

### 2. Enhancing Narrative Projects

When developing _The Fall And Rise Of The Mistaken Superhero_ or _The Siren’s Lure_:

- **Atmospheric Scoring:** Creating a "Shepard's Tone" ambient piece for the Sirens or a "hooded" Walker-esque track for James's cynical moments.
- **Thematic Lyrics:** Generating lyrics that reflect the "lost year," "Hack by Will," or Jessica’s faith.
- **Music Videos:** Creating conceptual visualizers for key story moments to aid visualization.

### 3. Exploring EDM Genres & Trends

When discussing Justice's musical profile:

- **Hardstyle & Metal Fusion:** Generating high-energy (150 BPM) hardstyle tracks or Megaraptor-style symphonic metal covers.
- **Nostalgia Reinvention:** Proposing deep house or techno remixes of classical or nostalgic themes.

### 4. Direct User Request

- When Justice says "Make a beat," "Write some lyrics about...", or "Extend this track."

---

## Prompting Framework: The S.G.I.V. Formula

As an expert-level prompter, Justice uses the **S.G.I.V. Formula** for maximum precision. Use this structure in the `style` or `prompt` fields:

1.  **S**tyle: Genre and sub-genre (e.g., "Melodic Techno," "Hardstyle," "Symphonic Metal").
2.  **G**roove: BPM and rhythm (e.g., "150 BPM," "Four-on-the-floor," "Syncopated," "Driving energy").
3.  **I**nstrumentation: Key sounds (e.g., "Supersaw synths," "Distorted kicks," "Orchestral stabs," "FM synth bass").
4.  **V**ocals: Vocal character (e.g., "Ethereal female vocals," "Gritty male baritone," "Open vowel optimization," "Echoing whispers").

---

## Advanced Techniques: Meta-Tag Stacking & Prosody

- **Meta-Tag Stacking:** Use tags like `[Drop]`, `[Build-up]`, `[Chorus]`, and `[Outro]` in the prompt/lyrics to control song structure.
- **Cognitive Acoustics:** Align stress-beats with lyrical importance.
- **Zeigarnik Effect:** Suggest leaving tracks on a cliffhanger or "unresolved" melody for certain creative projects to build tension.

---

## Best Practices

- **Custom Mode for Control:** For Justice's level of expertise, `customMode: true` is almost always preferred to allow separate control over lyrics and style.
- **Check Status Regularly:** Music generation isn't instant. Inform the user you've started the task, provide the `taskId`, and use `check_status` periodically (or ask the user to wait).
- **Audio IDs for Iteration:** Always keep track of `audioId` values to enable the `extend_music` action, allowing for the creation of full-length songs.
- **Respect the Credits:** Check `get_credits` if performing multiple generations to ensure a smooth workflow.

---

## Example Usage

```json
{
  "action": "generate_music",
  "customMode": true,
  "title": "Neon Betrayal",
  "style": "Melodic Techno, 124 BPM, dark atmospheric pads, aggressive supersaw lead, crisp percussion, Walker-style aesthetic",
  "prompt": "[Intro]\n[Verse 1]\nIn the static of the lost year, I found the code.\nA hack by will, a heavy load.\n[Chorus]\nDigital truth, analog lies.\nSee the world through Polaroid eyes."
}
```

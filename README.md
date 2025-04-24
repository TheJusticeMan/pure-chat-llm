# Pure Chat LLM

**Pure Chat LLM** leverages Obsidian notes to provide a graphical user interface (GUI) for ChatGPT directly within your vault. This plugin transforms your notes into interactive chat windows, enabling seamless conversations, brainstorming, questions, and prompt generation - all without leaving Obsidian.

---

## Features

- Embed a user-friendly ChatGPT interface within Obsidian  
- Use `[[Note Name]]` to include the content of a note in your chat messages or roles (note must start at the beginning of a line)  
- Link notes to specific chats  
- Customize API parameters per note, including model, max tokens, and more  
- Modify system prompts within notes to influence ChatGPT’s behavior  

> [!IMPORTANT]  
> **Please note:** This plugin is *not* an AI note editor. It is designed solely for chatting with ChatGPT through notes. It does not edit or manage your notes beyond the chat interface. It simply turns notes into GUI elements for ChatGPT.

---

## How to Use

1. Create a new note in Obsidian.  
2. Write your question, prompt, or message.  
3. To initiate chat, press **Shift + Enter** or use the **Complete Chat Response** command.  
4. Your note will transform into a chat interface, allowing you to continue the conversation.  
5. To customize API parameters, add a JSON block at the top of your note, specifying options like:  
   - `model` (e.g., `"gpt-4.1-nano"`)  
   - `max_tokens`  
   - Other API options (see [OpenAI API documentation](https://platform.openai.com/docs/api-reference/create))  
6. To include content from other notes, use `[[Note Name]]` within your note. This will insert the entire content of that note at the position, which can be used as part of your message or role, helping you structure complex prompts or context.

---

## Example Chat

> [!NOTE]  
> ```json
> {
>   "model": "gpt-4.1-nano",
>   "max_tokens": 1000
> }
> ```
> # role: system  
> You are a helpful assistant.  
> # role: user  
> [[Introduction]]  
> # role: assistant  
> Hello! How can I assist you today?  
> # role: user

*(In this example, the content of the note named "Introduction" will be included in the message.)*

---

## Installation

### In Obsidian

1. Open **Settings** -> **Community Plugins**  
2. Turn off **Safe Mode**  
3. Click **Browse** and search for **Pure Chat LLM**  
4. Click **Install** and then **Enable**  
5. (Optional) Configure plugin settings as desired

### Manual Installation (if plugin isn't available in the community plugins directory)

- Download the plugin from [GitHub](https://github.com/TheJusticeMan/pure-chat-llm)  
- Extract the ZIP file  
- Place the plugin folder into `.obsidian/plugins/` inside your vault  
- Enable it in **Community Plugins**

---

## Useful Links

- [OpenAI API documentation](https://platform.openai.com/docs)  
- [API authentication](https://platform.openai.com/docs/api-reference/authentication)  
- [Chat API reference](https://platform.openai.com/docs/api-reference/chat)  
- [Responses & parameters](https://platform.openai.com/docs/api-reference/responses/create)

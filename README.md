# Pure Chat LLM

**Pure Chat LLM** leverages Obsidian notes to provide a graphical user interface (GUI) for ChatGPT directly within your vault. This plugin transforms your notes into interactive chat windows, enabling seamless conversations, brainstorming, questions, and prompt generation — all without leaving Obsidian.

---

## Features

- **Interactive chat interface:** Engage in seamless conversations with ChatGPT and other leading AI models directly from any Obsidian note. Edit your questions or responses and continue the chat without leaving your vault.
- **Multiple AI providers:** Choose from a wide range of supported model providers, including OpenAI, Gemini, xAI, Anthropic, Cohere, Mistral AI, and DeepSeek. Easily switch between providers and models to suit your needs.
- **Note linking for context:** Use `[[Note name]]` or Markdown links to include the content of other notes in your chat, providing additional context or structuring complex prompts. (Referenced notes must start at the beginning of a line.)
- **Per-note customization:** Configure API parameters (such as `model`, `max_completion_tokens`, and more) on a per-note basis using a JSON block at the top of your note.
- **Flexible system prompts:** Modify system prompts within your notes to influence the AI’s behavior for each conversation.
- **Chat-linked notes:** Link specific notes to individual chat sessions for organized, context-rich discussions.
- **Markdown rendering:** All chat responses support full Markdown formatting, including lists, code blocks, and more.
- **Simple setup:** Just add your API key for your chosen provider in the plugin settings to get started.

> [!IMPORTANT] > **Note:** This plugin is _not_ an AI note editor. It is designed solely for chatting with AI models through notes. It does not edit or manage your notes beyond the chat interface—it simply turns notes into GUI elements for AI chat.

---

## How to Use

1. Create a new note in Obsidian.
2. Write your question, prompt, or message.
3. To initiate chat, press **Shift + Enter** or use the **Complete chat response** command.
4. Your note will transform into a chat interface, allowing you to continue the conversation.
5. To customize API parameters, add a JSON block at the top of your note, specifying options like:
   - `model` (e.g., `"gpt-4.1-nano"`)
   - `max_completion_tokens`
   - `stream`
   - Other API options (see [OpenAI API documentation](https://platform.openai.com/docs/api-reference/create))
6. To include content from other notes, use `[[Note name]]` within your note. This will insert the entire content of that note at the position, which can be used as part of your message or role, helping you structure complex prompts or context.

---

## Example Chat

> [!NOTE]
> To include the content from another note, use the following JSON configuration:
>
> ```json
> {
>   "model": "gpt-4.1-nano",
>   "max_completion_tokens": 4096,
>   "stream": true
> }
> ```
>
> Then, start your message with:
>
> ```markdown
> # role: system
>
> You are a helpful assistant.
>
> # role: user
>
> [[Introduction]]
>
> # role: assistant
>
> Hello! How can I assist you today?
> ```
>
> _(In this example, the content of the note named "Introduction" will be included in the message.)_
>
> **Note:** The note you reference must start at the beginning of a line in your markdown for this feature to work correctly.

---

## Installation

1. Open **Settings** -> **Community Plugins**
2. Turn off **Safe Mode**
3. Click **Browse** and search for **Pure Chat LLM**
4. Click **Install** and then **Enable**
5. (Optional) Configure plugin settings as desired

---

## Setting Your API key

Before using the **Pure Chat LLM** plugin, you must enter your OpenAI API key:

- Navigate to **Settings** -> **Community Plugins** -> **Pure Chat LLM**
- Find the **API key** field
- Enter your OpenAI API key (you can generate one from the [OpenAI API keys page](https://platform.openai.com/account/api-keys))
- Save your settings

_Note:_ The API key must be set before initiating chats. If you use the **Complete chat response** command without a configured API key, the plugin will prompt you to enter it.

---

## Usage Reminder

- When you first try to run **Complete chat response** or start a new chat, if the API key isn't configured, you'll be prompted to enter it.
- After entering your API key, it will be saved for future sessions. You won't need to re-enter it unless you change it.

---

## Voice Call Feature

The plugin now supports real-time voice calls using WebRTC technology. This allows users to communicate via voice directly from Obsidian.

### How to Use Voice Calls

1. **Open Voice Call Panel:**
   - Click the phone icon in the ribbon bar, or
   - Use the command palette (Ctrl/Cmd + P) and select "Open voice call panel"

2. **Start a New Call:**
   - Click the "Start call" button in the voice call panel
   - Grant microphone permissions when prompted
   - Wait for the connection to establish

3. **Join an Existing Call:**
   - Click the "Join call" button in the voice call panel
   - The system will connect you to an active call session

4. **During a Call:**
   - **Mute/Unmute:** Click the "Mute" button to toggle your microphone
   - **End Call:** Click the "End call" button to disconnect

### Requirements

- **Microphone permissions:** Your browser/Obsidian must have access to your microphone
- **WebRTC support:** Modern browsers and Obsidian desktop app support WebRTC
- **Signaling server:** The `/realtime/calls` endpoint must be configured in your API provider settings

### Troubleshooting

- **Microphone not working:** Check your system permissions and browser settings
- **Connection fails:** Verify your API endpoint supports the `/realtime/calls` WebSocket endpoint
- **No audio:** Check that your audio output device is working and not muted

### Technical Details

The voice call feature uses:
- **WebRTC** for peer-to-peer audio streaming
- **WebSocket** signaling via `/realtime/calls` endpoint
- **STUN servers** for NAT traversal (Google's public STUN servers by default)
- **Echo cancellation, noise suppression, and auto-gain control** for better audio quality

---

## Useful Links

- [OpenAI API documentation](https://platform.openai.com/docs)
- [API authentication](https://platform.openai.com/docs/api-reference/authentication)
- [Chat API reference](https://platform.openai.com/docs/api-reference/chat)
- [Responses & parameters](https://platform.openai.com/docs/api-reference/responses/create)

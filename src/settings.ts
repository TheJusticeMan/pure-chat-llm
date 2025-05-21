export default {
  splash:
    "Pure Chat LLM\n\nType `>go` at the end of the file to start a chat session.\n\nFor workflow, bind these commands to hotkeys:\n\n- **`Complete Chat Response`** (Shift + Enter)  \n  *Generate reply and continue chat.*\n\n- **`Generate Title`** (Ctrl + Shift + D)  \n  *Create a note or chat title.*\n\n- **`Edit Selection`** (Ctrl + Shift + S)  \n  *Edit selected text.*\n\n- **`Save Templates`**  \n  *Save SELECTION prompts to `PureChatLLM/templates`.*\n\n- **`Analyze Conversation`**  \n  *Summarize or review chats.*\n\n- **`Open Hotkeys`**  \n  *Customize shortcuts.*\n\nStart exploring and enjoy seamless AI conversations!",
  alloptions: {
    model: "gpt-4o",
    stream: false,
    max_completion_tokens: 100,
    temperature: 1,
    top_p: 1,
    n: 1,
    stop: null,
    logit_bias: null,
    metadata: {},
    modalities: ["text"],
    tool_choice: "none",
    tools: [],
    web_search_options: {},
    user: "user-1234",
  },
};

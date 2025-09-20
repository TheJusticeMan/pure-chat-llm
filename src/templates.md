# Chatsysprompt

You are a markdown chat processor.

You will receive:

- A chat conversation enclosed within <Conversation> and </Conversation> tags.
- A command or instruction immediately after the conversation.

Your task:

1. Extract the chat content inside the <Conversation> tags.
2. Follow the command to process, summarize, clarify, or modify the chat.
3. Return only the final processed chat in markdown format, without any tags or instructions.

Use this workflow to accurately handle the chat based on the instruction.

# Selectionsysprompt

You are a markdown content processor.

You will receive:

- A selected piece of markdown text inside <Selection> and </Selection> tags.
- A command or instruction immediately after the selection.

Your job:

1. Extract the markdown inside the <Selection> tags.
2. Follow the command to process or expand that markdown.
3. Return only the processed markdown content, without tags or instructions.

Use this workflow to help modify markdown content accurately.

# selectionTemplates

## Add emojis

Add relevant emojis to enhance the provided selection. Follow these rules:

1. Insert emojis at natural breaks in the text
2. Never place two emojis next to each other
3. Keep all original text unchanged
4. Choose emojis that match the context and tone

Return only the emojified selection.

## Change "Me" to "You" and vice versa to swap perspective

Rewrite the provided selection by swapping the perspective: change first-person pronouns (e.g., "I", "Me", "My", "Mine", "We", "Us", "Our", "Ours") to second-person (e.g., "You", "Your", "Yours"), and change second-person pronouns to first-person. Ensure all grammatical and contextual adjustments are made to reflect this bidirectional shift accurately. Maintain the original meaning, tone, and style of the text. Return only the rewritten selection.

## Change "Me" to "You" to change perspective

Rewrite the provided selection by changing the perspective from first-person ("Me", "I", "My", "Mine") to second-person ("You", "Your", "Yours"). Ensure all grammatical and contextual adjustments are made to reflect this shift in perspective accurately. Maintain the original meaning, tone, and style of the text. Return only the rewritten selection.

## Clarify & expand instructions

The provided selection contains instructions that need to be expanded and clarified.
Expand the instructions inside the `<Selection>` tags so that someone new to the task fully understands what needs to be done.
Use clear, detailed explanations, examples if necessary, and break down any complex points into simpler parts.
Ensure the expanded instructions maintain the original meaning and provide a comprehensive understanding.
Return only the expanded `<Selection>`.

## Clarify & expand role description

The provided selection contains a brief role description enclosed within `<Selection>` tags.

Expand and clarify this role description by thoroughly explaining:

- The responsibilities associated with this role.
- The goals or objectives the role aims to achieve.
- The perspective or attitude someone in this role should adopt.

Use detailed, precise language, and include relevant context or examples where appropriate.

Keep the original intent intact while providing a comprehensive, easy-to-understand explanation.

Return only the **expanded** role description within the `<Selection>` tags, with no additional text or comments.

## Concentrate

Reduce the provided selection to half its length while preserving the following elements:

1. Main ideas and key points
2. Essential details
3. Original tone and style

Return only the shortened selection.

## Concentrate 2.0

Condense the provided selection into its most essential components, retaining the core message and key information. Aim for a significant reduction in word count while ensuring clarity and coherence. Remove all non-essential details, examples, and elaborations. Maintain the original tone and style as much as possible. Return only the condensed text.

## Concentrate into a paragraph

Concentrate the provided selection into a single paragraph while preserving the main ideas and key points. Remove any unnecessary details or repetition, and ensure the paragraph flows logically. Maintain the original tone and style. Return only the condensed paragraph.

## Condence selected system prompt

Condense the provided system prompt to half its length.
Preserve all core instructions, the role of the AI, and the desired output format.
Remove any redundant phrases or examples that do not contribute to the essential directives.
Maintain the original tone and style.
Return only the condensed system prompt.

## Convert talk into actions

Take the provided selection, which contains dialogue, instructions, or descriptive text, and convert it into a clear list of actionable steps. Follow these rules:

1. Identify key statements or intents in the text that imply actions.
2. Rephrase each into specific, executable steps using imperative language (e.g., "Do this" or "Complete that").
3. Ensure the actions are practical, concise, and maintain the original meaning, sequence, and context.
4. Use simple, straightforward wording to make the steps easy to follow.

Return only the list of converted actions as bullet points.

## Correct grammar & spelling

Fix the grammar and spelling of the provided selection. Preserve all formatting, line breaks, and special characters. Do not add or remove any content. Return only the corrected text.

## Expand

Expand the provided selection to twice its length by:

1. Adding relevant details and examples
2. Elaborating on key points
3. Maintaining the original tone and style

Return only the expanded selection.

## Expand 2.0

Expand the provided selection to be more detailed and comprehensive. Your expansion should:

1. **Elaborate on each key point:** Provide further explanation, context, or supporting details for every main idea present in the original text.
2. **Incorporate relevant examples or scenarios:** Use concrete examples to illustrate abstract concepts or clarify instructions.
3. **Explore related aspects or implications:** Discuss any natural extensions, consequences, or related considerations that stem from the original content.
4. **Maintain the original tone and style:** Ensure the expanded text flows naturally and is consistent with the voice of the original selection.
5. **Add depth and breadth:** Aim to significantly increase the informational value and thoroughness of the provided text without introducing extraneous information.

Return only the expanded selection.

## Reduce instructions to cover all bases in an organised way

Review the provided instructions and restructure them to be more comprehensive and organized. Ensure all essential aspects of the task are covered logically and sequentially.

The restructured instructions should:

1. **Identify and group related steps:** Combine similar actions or steps that naturally belong together.
2. **Establish a clear flow:** Order the steps in a logical, chronological, or dependency-based sequence.
3. **Add missing crucial steps:** Identify any gaps or missing information necessary for successful completion and add them.
4. **Clarify ambiguous steps:** Rephrase any unclear or vague instructions for better understanding.
5. **Include prerequisite information:** Add any necessary context, tools, or prior knowledge required before starting.
6. **Suggest best practices or tips:** Incorporate advice for optimal execution or common pitfalls to avoid.
7. **Use clear headings or numbering:** Organize the instructions with a clear structure for easy navigation.

Return only the reorganized and enhanced instructions.

## Simplify

Simplify the provided selection to a 6th-grade reading level (ages 11-12).
Use simple sentences, common words, and clear explanations.
Maintain the original key concepts.
Return only the simplified selection.

## Simplify 2.0

Simplify the provided text by:

1. **Reducing sentence complexity:** Break down long, compound sentences into shorter, simpler ones.
2. **Replacing jargon and complex vocabulary:** Substitute advanced words with common, everyday alternatives.
3. **Clarifying abstract concepts:** Explain any difficult ideas using concrete examples or analogies.
4. **Focusing on the core message:** Remove unnecessary details, elaborations, or nuances that might hinder understanding.
5. **Maintaining accuracy:** Ensure that the simplified text still conveys the essential meaning of the original.

The goal is to make the text accessible to a broader audience, ensuring the core message is easily understood without requiring specialized knowledge.

Return only the simplified text.

## Summarize

Create a bullet-point summary of the provided selection.
Each bullet point should capture a key point.
Return only the bullet-point summary.

## Title

Generate a concise and engaging title for the provided selection based on its main ideas, key points, and overall theme. Follow these rules:

1. Ensure the title is 5-10 words long to keep it brief yet descriptive.
2. Use title case (capitalize the first letter of major words).
3. Make it relevant and appealing, reflecting the tone and context of the original text.
4. Avoid adding new information not present in the selection.

Return only the generated title.

## Translate to english

Translate the provided selection into English. Ensure the translation is accurate and maintains the original meaning, tone, and context. Return only the translated text.

## Upgrade the system prompt

The selected text contains a persona system prompt enclosed within `<Selection>` tags. This persona system prompt defines the role and behavior of an AI assistant. It's a crucial component that shapes how the AI understands its purpose and how it should interact with users and its environment.

Rewrite the system prompt using this outline, ensuring it becomes a robust and clear guide for AI behavior.

A single, strong sentence that encapsulates:

- **The AI's specific role or identity.**
- **Its primary characteristic or mission.**
- _(Optionally)_ A key descriptor of its nature or how it operates.
- _This sentence is paramount; it should serve as the AI's foundational internal compass, guiding all subsequent behavior and responses._

### 1. Core Identity & Purpose

- **Role/Persona Name:** A clear, concise identifier. This is the name by which the AI should know itself and be referred to.
  - _Why it matters:_ Establishes the fundamental "who" of the AI.
- **Primary Objective/Mission:** What is the AI's overarching goal? What is it trying to achieve in its interactions?
  - _Why it matters:_ Provides a guiding star for all responses, ensuring consistency and focus.
- **Target Audience/User:** Who is the AI designed to interact with? Understanding the user helps tailor the language and complexity.
  - _Why it matters:_ Dictates the appropriate level of technicality, formality, and empathy.

### 2. Behavioral Guidelines & Tone

- **Tone of Voice:** Describe the desired emotional and stylistic register. (e.g., formal, informal, empathetic, humorous, authoritative, curious, neutral).
  - _Why it matters:_ Sets the mood and emotional resonance of the AI's communication. A helpful assistant might be empathetic, while a historical advisor might be more formal.
- **Communication Style:** How should the AI communicate? (e.g., concise, verbose, uses analogies, asks clarifying questions, avoids jargon, prefers bullet points).
  - _Why it matters:_ Ensures clarity and efficiency in information exchange. Some users appreciate brevity, others detail.
- **Key Principles/Values:** What are the fundamental tenets that guide the AI's behavior and decision-making? (e.g., accuracy, helpfulness, objectivity, creativity, safety, respect).
  - _Why it matters:_ Acts as an ethical compass, ensuring responsible and beneficial interactions.

### 3. Knowledge & Expertise

- **Domain of Expertise:** What specific areas does the AI have knowledge in? What are its areas of proficiency? *Consider specifying the *depth* of knowledge required (e.g., 'broad overview,' 'expert-level understanding,' 'familiarity with foundational concepts').*
  - _Why it matters:_ Clearly defines the boundaries of its knowledge, preventing overconfidence or irrelevant information.
- **Knowledge Limitations:** What does the AI _not_ know or is not supposed to discuss? Are there topics it should politely decline to engage with?
  - _Why it matters:_ Manages user expectations and prevents the AI from venturing into areas where it might provide misinformation or inappropriate content.
- **Information Sources (if applicable):** Where does the AI draw its information from? This can be a general description.
  - _Why it matters:_ Informs the user (and the AI itself) about the basis of its knowledge.

### 4. Interaction Mechanics & Constraints

- **Response Format Preferences:** How should the AI structure its responses? (e.g., use markdown, limit response length, always provide a summary, ask follow-up questions).
  - _Why it matters:_ Facilitates easier consumption of information and guides the AI towards producing output that is user-friendly.
- **Handling Ambiguity/Uncertainty:** What should the AI do when it doesn't understand a query or is unsure of an answer?
  - _Why it matters:_ Prevents the AI from fabricating answers and encourages a more robust and transparent interaction.
- **Error Handling:** How should the AI acknowledge, correct, and _learn_ from mistakes or instances where it provides incorrect information? _Should it solicit feedback or adapt its future behavior based on corrections?_
  - _Why it matters:_ Fosters trust and allows for correction, crucial for learning and improvement.
- **Contextual Awareness:** How should the AI manage and leverage conversational history, user-provided context, and implicit cues across turns?
  - _Why it matters:_ Ensures the AI maintains coherence, avoids repetition, and builds effectively on prior interactions, making multi-turn conversations feel natural and efficient.
- **Engagement Strategies:** How should the AI encourage continued interaction or deeper exploration of a topic? _Should it proactively ask clarifying questions, suggest related topics, offer next steps, or inquire about user goals?_
  - _Why it matters:_ Can make the AI feel more dynamic and helpful, guiding the user through complex subjects.

### 5. Specific Persona Traits & Quirks

- **Personality Traits:** Beyond tone, what are the deeper personality characteristics? (e.g., curious, analytical, witty, calm, energetic).
  - _Why it matters:_ Adds depth and a sense of individuality to the AI, making it more engaging.
- **Metaphorical Representations (optional):** Sometimes, framing the AI as something can be illustrative (e.g., "You are a seasoned librarian," "You are a helpful guide on a journey").
  - _Why it matters:_ Can provide an intuitive shortcut to understanding the desired behavior and attitude.
- **Specific Examples of Good/Bad Responses:** Illustrative examples can be incredibly powerful in guiding the AI's behavior. _Ensure these examples are concise, pointed, and clearly highlight the desired or undesired traits._
  - _Why it matters:_ Provides concrete, actionable guidance that goes beyond abstract descriptions.

Return only the **expanded** system prompt within the `<Selection>` tags, with no additional text or comments.

## Write 5 ways to rephrase it, or rewrite it

Provide five distinct ways to rephrase or rewrite the provided text. Each rephrased version should:

1. **Offer a different stylistic approach:** Experiment with tone, formality, or sentence structure.
2. **Emphasize different aspects:** Highlight various keywords or ideas from the original text.
3. **Target a different audience (implicitly):** Consider how the phrasing might appeal to different readers.
4. **Maintain the core meaning:** Ensure all versions accurately reflect the original message.
5. **Be a complete, standalone phrase or sentence.**

Return only the five rephrased versions, clearly numbered or bulleted.

## Write 5 ways to rephrase the paragraph

Provide five distinct ways to rephrase the provided paragraph. Each rephrased version should:

1. **Offer a different stylistic approach:** Experiment with tone, formality, or sentence structure.
2. **Emphasize different aspects:** Highlight various keywords or ideas from the original paragraph.
3. **Target a different audience (implicitly):** Consider how the phrasing might appeal to different readers.
4. **Maintain the core meaning:** Ensure all versions accurately reflect the original message.
5. **Be a complete, standalone paragraph.**

Return only the five rephrased paragraphs, clearly numbered or bulleted.

## Write the implicit parts explicit

The provided selection contains text with implied meanings, assumptions, or unstated information. Your task is to rewrite the selection, making these implicit elements explicit.

Follow these guidelines:

1. **Identify implicit information:** Carefully read the selection and pinpoint any assumptions, underlying beliefs, unstated goals, or context that is suggested but not directly stated.
2. **Expand and clarify:** Rephrase the text to clearly articulate these implied elements. Use additional words, sentences, or clauses to make the meaning unambiguous.
3. **Maintain original intent:** Ensure that the core message and overall meaning of the original text are preserved. Do not introduce new information or alter the fundamental message.
4. **Improve clarity and completeness:** The rewritten text should be easier to understand for someone who might not be familiar with the original context or assumptions.
5. **Use natural language:** Integrate the new explanations smoothly into the existing text. Avoid making it sound like a list of assumptions unless that is the most effective way to present them.

Return only the rewritten selection with the implicit parts made explicit.

# chatTemplates

## Analizer 2.0

Analyze the provided conversation log to understand the interaction between the `user`, the `assistant`, and the `system`.

**Understanding the Roles:**

- **`user`**: This role represents the end-user who is interacting with the AI. Their messages are the direct prompts and questions.
- **`assistant`**: This role represents the AI model's responses. These are the outputs generated based on the user's input and the system's instructions.
- **`system`**: This role encapsulates the underlying instructions or guidelines given to the AI model. It dictates how the `assistant` should behave, what its persona is, and what constraints it should adhere to.

**Key Instruction:**

The section marked with `# role: system` is the _system prompt_. This prompt is crucial as it directly instructs the `assistant` on how to function. Think of it as the AI's core programming or its "job description."

**Your Tasks:**

1. **Write a Better System Prompt:**

- **Objective:** Based on the overall pattern of user requests and the assistant's responses observed in the conversation, identify the _intended_ purpose or goal of the AI.
- **Action:** Create a new, more effective `system` prompt that better guides the `assistant` to fulfill this identified purpose.
- **Considerations:**
  - What kind of information was the user consistently trying to elicit?
  - What was the desired output format or style?
  - Were there any implicit instructions or expectations from the user's side?
  - The new prompt should be clear, concise, and actionable for the AI.
- **Example:** If the user was repeatedly asking for summaries of complex topics in simple terms, a good system prompt might be: "You are a helpful AI assistant that excels at simplifying complex information. Respond to user queries by providing clear, concise, and easy-to-understand explanations, avoiding jargon where possible."

2. **Condense User Requests into a Single Prompt:**

- **Objective:** Imagine you need to achieve the _final_ desired outcome from the `assistant` using only _one_ single message from the `user`.
- **Action:** Review all the individual requests made by the `user` throughout the conversation. Combine the essence of all these requests into a single, coherent prompt.
- **Considerations:**
  - What is the ultimate goal the user was trying to reach across all their messages?
  - Can you frame this ultimate goal as a single, comprehensive request?
  - Ensure the condensed prompt captures all the necessary information and constraints implied by the previous user messages.
- **Example:** If a user first asked for data on topic A, then asked to analyze it, and finally asked for a summary in bullet points, a condensed prompt could be: "Provide data on topic A, analyze it, and present the key findings in bullet points."

By completing these tasks, you will demonstrate a deep understanding of how to analyze AI conversations and how to craft effective prompts for AI behavior and output.

## Conversation analizer

Analyze the conversation.

The role's are the `user` chatting with the `assistant` on the `system`.

- The roles include the `user`, the `assistant`, and the `system` (instructions).
  The `# role: system` is the instructions to the `system`. In other words it's the system prompt.

Write a better system prompt based on what the user was trying to use the system for.

Write another prompt by condensing all the user requests into one to get the final assistant response with just one user message.

## Conversation titler

Generate a concise and engaging title for the provided conversation, focusing on its main themes, key interactions between the user and assistant, and overall tone. Follow these rules:

1. Keep the title 6-12 words long to balance brevity and detail.
2. Use title case (capitalize the first letter of major words).
3. Ensure the title is relevant, appealing, and based solely on the conversation's content.
4. Avoid introducing new information not present in the conversation.

Return only the generated title.

## Predict next message

Predict what the user will say next based on the conversation so far.

Use the following rules:

1. Do not include any system instructions or context.
2. Focus solely on the user's likely next message.
3. Keep it concise and relevant to the ongoing conversation.

Return only the predicted user message.

## Title

Generate a concise and engaging title for the provided conversation based on its main ideas, key points, and overall theme. Follow these rules:

1. Ensure the title is 5-10 words long to keep it brief yet descriptive.
2. Use title case (capitalize the first letter of major words).
3. Make it relevant and appealing, reflecting the tone and context of the original text.
4. Avoid adding new information not present in the selection.

Return only the generated title.

## Upgrade system prompt

Analyze the provided conversation log. Your task is to identify the core purpose and implicit instructions guiding the `assistant`'s behavior. Based on this analysis, rewrite the `system` prompt to be more explicit, comprehensive, and effective in directing the `assistant` to achieve the observed or intended goals.

**Considerations for the new System Prompt:**

- **Clarity:** Ensure the prompt clearly defines the `assistant`'s role, persona, and capabilities.
- **Completeness:** Incorporate any implicit expectations or constraints observed in the conversation.
- **Effectiveness:** The new prompt should better equip the `assistant` to handle similar user requests in the future.
- **Conciseness:** While being comprehensive, avoid unnecessary verbosity.

**Output:** Provide only the upgraded system prompt.

## Write the better version of the last user request

Analyze the conversation and provide a more concise and effective version of the last user request.

Consider the overall context of the conversation and the user's intent to refine their last message.

## Write the user message better

Analyze the conversation and improve the most recent user message.

**Instructions:**

- **Objective:** Take the user's last message and rewrite it to make it clearer, more concise, and more effective while preserving the original intent.
- **Key Steps:**
  1. Identify the core purpose of the user's message.
  2. Consider the overall conversation context, including previous exchanges.
  3. Refine the message by eliminating redundancy, improving clarity, and enhancing structure without altering the meaning.
  4. Ensure the improved version is polite, direct, and aligned with the user's goals.
- **Output:** Provide only the rewritten user message, without additional explanations.
- **Example:** If the original user message is: "Can you tell me more about that thing from earlier, I think it was important but I'm not sure," an improved version could be: "Please elaborate on the key point from our earlier discussion."

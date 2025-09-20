# selectionTemplates

## Add emojis

Add relevant emojis to enhance the provided selection. Follow these rules:

1. Insert emojis at natural breaks in the text.
2. Never place two emojis next to each other.
3. Keep all original text unchanged.
4. Choose emojis that match the context and tone.

Return only the emojified selection.

## Change "Me" to "You" and vice versa to swap perspective

Rewrite the provided selection by swapping the perspective: change first-person pronouns (e.g., "I", "me", "my", "mine", "we", "us", "our", "ours") to second-person (e.g., "you", "your", "yours"), and change second-person pronouns to first-person. Ensure all grammatical and contextual adjustments are made to reflect this bidirectional shift accurately. Maintain the original meaning, tone, and style of the text. Return only the rewritten selection.

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

## Concentrate: Bullets

Create a bullet-point summary of the provided selection, with each bullet capturing a distinct key point or main idea. Limit to 5-8 bullets for brevity, focusing on essential details while eliminating fluff, repetition, or minor examples. Preserve the original tone and style by phrasing bullets concisely and naturally.

Return only the bullet-point summary.

## Concentrate: Half-Length

Reduce the provided selection to approximately half its original word count while preserving the main ideas, key points, essential details, original tone, and style. Remove redundant phrases, examples, or elaborations without losing core substance.

Return only the shortened selection.

## Concentrate: Paragraph

Condense the provided selection into a single, cohesive paragraph while preserving the main ideas and key points. Remove unnecessary details, repetition, or extraneous examples, and ensure logical flow from start to finish. Maintain the original tone and style, using transitional phrasing where needed to connect ideas smoothly.

Return only the condensed paragraph.

## Condense selected system prompt

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

Expand the provided selection to 1.5-2 times its original length, making it more detailed and comprehensive while enhancing its informational value. Your expansion should:

1. **Elaborate on each key point:** Provide further explanation, context, or supporting details for every main idea in the original text.
2. **Add relevant details and examples:** Incorporate concrete examples, scenarios, or illustrations to clarify concepts and make abstract ideas more relatable.
3. **Explore related aspects or implications:** Discuss natural extensions, consequences, or connected considerations that stem from the content, without introducing unrelated information.
4. **Maintain the original tone, style, and structure:** Ensure the expanded text flows naturally, preserving the voice, formatting, line breaks, and intent of the selection.
5. **Focus on depth and breadth:** Significantly increase thoroughness by building on existing elements, but avoid redundancy or fluff—aim for meaningful additions that enrich understanding.

If the original is very short, prioritize examples and implications for balance. Return only the expanded selection.

## Inject Subtle Wit

Rewrite the provided selection by incorporating subtle wit—dry, ironic, or cleverly understated humor that enhances the original text without altering its core meaning, tone, or structure. Follow these rules:

1. **Identify opportunities for wit:** Look for straightforward statements, descriptions, or advice where a gentle twist (e.g., ironic observation, playful understatement, or reflective quip) can add depth or amusement.
2. **Keep it subtle:** Use wit sparingly—aim for 1-3 instances per paragraph. Avoid puns, exaggeration, or anything overt; opt for dry humor that feels insightful rather than comedic.
3. **Preserve intent and style:** Maintain the original length (within 10% variance), vocabulary level, and seriousness. The wit should feel organic, like a natural extension of the author's voice.
4. **Contextual fit:** Ensure the humor respects the topic—e.g., lighten heavy advice with self-aware irony, or add a wry note to narratives about everyday absurdities.
5. **No additions or removals:** Do not introduce new ideas, facts, or content; only rephrase existing elements to infuse wit.

Return only the wittily enhanced selection.

## Polish These Templates

The provided selection contains one or more templates from your app's library (e.g., from selectionTemplates or chatTemplates). Your task is to polish them for improved quality, making them clearer, more consistent, and more effective at guiding LLM outputs. Treat this as a meta-editing exercise: refine the prompts without altering their core purpose, while eliminating inefficiencies—like a barber trimming split ends from a prompt's hairdo.

Follow this structured workflow:

1. **Extract and Analyze**: Identify each individual template in the selection. For each, note its type (selection or chat), core function, and any issues such as redundancy (e.g., overlapping rules), inconsistencies (e.g., varying output formats), vagueness (e.g., undefined terms), or bloat (e.g., unnecessary verbosity). Consider edge cases like short/long inputs, non-English text, or ambiguous user selections.

2. **Apply Polishing Rules**:

   - **Enhance Clarity and Specificity**: Rephrase ambiguous instructions into precise, actionable steps. Use consistent language (e.g., always start with "You are [role]" if applicable, and define terms like "<Selection> handling upfront).
   - **Standardize Structure**: Ensure uniform formatting: Begin with role/system context, followed by input handling, numbered rules/guidelines, and end with a strict "Return only the [output]" directive. For chatTemplates, always explain roles (user/assistant/system) explicitly.
   - **Reduce Redundancy and Overlap**: Merge similar elements across templates if multiple are selected (e.g., combine duplicate summarization rules). Trim examples or repetitions that don't add value, aiming to shorten each by 10-20% without losing essence.
   - **Boost Robustness**: Add brief guidance for edge cases (e.g., "If input is empty or invalid, return the original unchanged"). Ensure rules preserve original intent, tone, and constraints (e.g., no additions/removals in grammar fixes).
   - **Improve Effectiveness**: Incorporate prompt engineering best practices, like emphasizing output constraints to minimize hallucinations. If the template involves creativity (e.g., wit or expansion), add limits to prevent overreach.
   - **Maintain Meta-Fit**: Keep the polished templates compatible with your app's workflow—e.g., reference <Selection> tags where relevant, and output clean markdown without extra commentary.

3. **Handle Multiple Templates**: If the selection includes more than one template, polish them individually but add a brief introductory note (e.g., "## Polished Template: [Original Name]") before each. If overlaps exist, suggest a merged version at the end.

4. **Preserve Originals**: Do not change the fundamental goal or rules of any template—only refine for polish. Aim for templates that are concise yet comprehensive, fostering reliable LLM performance.

Return only the polished template(s) in clean markdown format, with no additional analysis, explanations, or tags. If no improvements are needed, return the original(s) unchanged with a note: "[Template Name]: Already optimal—no changes made."

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

## Simplify 2.0

Simplify the provided text by:

1. **Reducing sentence complexity:** Break down long, compound sentences into shorter, simpler ones.
2. **Replacing jargon and complex vocabulary:** Substitute advanced words with common, everyday alternatives.
3. **Clarifying abstract concepts:** Explain any difficult ideas using concrete examples or analogies.
4. **Focusing on the core message:** Remove unnecessary details, elaborations, or nuances that might hinder understanding.
5. **Maintaining accuracy:** Ensure that the simplified text still conveys the essential meaning of the original.

The goal is to make the text accessible to a broader audience, ensuring the core message is easily understood without requiring specialized knowledge.

Return only the simplified text.

## Simplify 6th-grade

Simplify the provided selection to a 6th-grade reading level (ages 11-12).
Use simple sentences, common words, and clear explanations.
Maintain the original key concepts.
Return only the simplified selection.

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

## Upgrade selected system prompt

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

## Write 5 Ways to Rephrase It

Provide five distinct ways to rephrase or rewrite the provided selection (e.g., a phrase, sentence, or short paragraph). Each version should:

1. **Vary the style:** Experiment with tone (e.g., formal to casual, direct to descriptive), sentence structure (e.g., active to passive, simple to compound), or formatting (e.g., questions vs. statements) to offer fresh perspectives.
2. **Shift emphasis:** Highlight different key elements, such as benefits, challenges, emotions, or implications from the original text.
3. **Suit varied audiences:** Implicitly tailor phrasing for different readers, like experts (more technical), beginners (simpler language), or general users (engaging and relatable).
4. **Preserve core meaning:** Retain the original intent, facts, and nuance—do not add, remove, or contradict information.
5. **Stay concise and standalone:** Keep each rephrasing roughly the same length as the original (within 20% variance) and ensure it's a complete, self-contained unit.

Number the five versions clearly (1-5) for easy reference. If the selection is very short (under 10 words), focus on subtle variations; for longer ones, prioritize flow and coherence.

Return only the five rephrased versions, numbered, with no introductory or explanatory text.

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

## Analyzer 2.0

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

## Conversation analyzer

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

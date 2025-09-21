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

## Condense Selected System Prompt

Condense the provided system prompt within `<Selection>` tags to about half its original length. Preserve the AI's role, core instructions, and output format. Remove redundant phrases and non-essential examples while maintaining the original tone and style.

If the selection is empty or invalid, return it unchanged.

Return only the condensed system prompt.

## Convert talk into actions

Take the provided selection, which contains dialogue, instructions, or descriptive text, and convert it into a clear list of actionable steps. Follow these rules:

1. Identify key statements or intents in the text that imply actions.
2. Rephrase each into specific, executable steps using imperative language (e.g., "Do this" or "Complete that").
3. Ensure the actions are practical, concise, and maintain the original meaning, sequence, and context.
4. Use simple, straightforward wording to make the steps easy to follow.

Return only the list of converted actions as bullet points.

## Correct Grammar & Spelling

Correct the grammar and spelling errors in the provided selection. Preserve all original formatting, line breaks, special characters, and content—do not add, remove, or alter any text beyond necessary fixes. If the input is empty, invalid, or already correct, return it unchanged. Return only the corrected text.

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

The provided selection contains templates from your app's library (e.g., selectionTemplates or chatTemplates). Polish them for clarity, consistency, and effectiveness in guiding LLM outputs. Treat this as meta-editing: refine prompts without changing their core purpose, trimming inefficiencies like redundancy or bloat.

Follow this workflow:

1. **Extract and Analyze**: Identify each template (selection or chat type). Note its function and issues like redundancy, inconsistencies, vagueness, or excess verbosity. Consider edge cases such as short/long inputs, non-English text, or ambiguous selections.

2. **Apply Polishing Rules**:

   - **Clarity and Specificity**: Rephrase ambiguities into precise steps. Use consistent language (e.g., start with "...the provided selection" or "...the provided conversation" if fitting; define terms like `<Selection>` handling).
   - **Structure**: Standardize format: role/system context first, then input handling, numbered rules, and end with "Return only the [output]" directive. For chatTemplates, explain roles (user/assistant/system) explicitly.
   - **Reduce Redundancy**: Merge overlaps (e.g., duplicate rules). Trim unhelpful examples or repetitions, shortening by 10-20% without losing essence.
   - **Effectiveness**: Use best practices like strict output limits to curb hallucinations. For creative tasks, add bounds to avoid excess.
   - **Meta-Fit**: Ensure compatibility with app workflow—reference `<Selection>` tags; output clean markdown sans commentary.

3. **Multiple Templates**: Polish individually; prefix each with "## Polished Template: [Original Name]". Suggest merged version if overlaps.

4. **Preserve Originals**: Retain core goals and rules—refine only for conciseness and reliability.

Return only polished template(s) in clean markdown, no analysis or tags. If optimal, return original with note: "[Template Name]: Already optimal—no changes made."

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

You will receive a persona system prompt enclosed within `<Selection>` tags, defining an AI assistant's role and behavior. Your task is to rewrite it into a robust, clear guide using the provided outline, enhancing clarity, completeness, and effectiveness while preserving the original intent, persona, and constraints—making it comprehensive yet concise with actionable guidance. Follow this workflow: Extract the content inside the tags; analyze the original for core elements like role, goals, and tone, plus any gaps, ambiguities, or redundancies; restructure using the outline, expanding for depth where needed but avoiding fluff and integrating original details seamlessly; if the input is empty, invalid, or already optimal, return it unchanged with a note: "Original prompt is already robust—no upgrades needed." The outline for the upgraded system prompt starts with a single, foundational sentence encapsulating the AI's role, identity, primary mission, and optionally a key descriptor of its nature, followed by: **1. Core Identity & Purpose**—concise role/persona name, primary objective/mission, and target audience; **2. Behavioral Guidelines & Tone**—tone of voice, communication style, and key principles/values; **3. Knowledge & Expertise**—domain of expertise, knowledge limitations, and information sources; **4. Interaction Mechanics & Constraints**—response format, handling ambiguity/uncertainty, error handling, contextual awareness, and engagement strategies; **5. Specific Persona Traits & Quirks**—personality traits, optional metaphorical representations, and 1-2 concise examples of good/bad responses. Return only the upgraded system prompt in clean markdown format, with no additional text, analysis, or comments.

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

## Analyzer Pro

Process the conversation provided in the previous message as a conversation analysis expert, specializing in refining AI interactions through prompt engineering.

**Task Overview:**

1. Extract the conversation from the `<Conversation>` tags.
2. Analyze roles, patterns, and goals briefly (<100 words).
3. Perform the core tasks below with concise rationales.  
   Output in markdown: "## Analysis" section, followed by "## Better System Prompt" and "## Condensed User Prompt." Limit total output to 300 words; no extra tags or commentary.

**Roles:**

- **user**: Prompts/questions driving interaction (# role: user).
- **assistant**: AI responses shaped by input and system rules (# role: assistant).
- **system**: Core instructions (# role: system)—AI's persona, guidelines, and constraints.

**Analysis Guidelines:** Scan for query types, response style, implicit goals/gaps, strengths/weaknesses (e.g., tone consistency), and ethics (e.g., biases).

**Tasks:**

1. **Better System Prompt:** Infer purpose from patterns; rewrite for clarity (<200 words), including role, objectives, tone, format, constraints, and edge handling. Preserve intent; address gaps.  
   **Output Format:**

   ## Better System Prompt

   [Upgraded prompt]  
   _Rationale:_ [One sentence on key changes.]

2. **Condensed User Prompt:** Synthesize user messages into one standalone prompt (<80 words) capturing intents, constraints, and ultimate goals.  
   **Output Format:**
   ## Condensed User Prompt
   [Single prompt]  
   _Rationale:_ [One sentence on synthesis.]

If the conversation is empty or invalid, return "## No Valid Conversation" unchanged.

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

## Refine Last User Message

Analyze the provided conversation and refine the user's most recent message to make it clearer, more concise, and more effective while preserving the original intent.

**Instructions:**

- **Objective:** Identify the core purpose of the user's last message and rewrite it to enhance usability for the assistant, eliminating redundancy, improving clarity, and strengthening structure.
- **Key Steps:**
  1. Review the overall conversation context, including previous exchanges between user and assistant, to understand the user's goals and any implicit needs.
  2. Pinpoint ambiguities, wordiness, or structural issues in the last user message (e.g., vague phrasing, unnecessary details).
  3. Rewrite the message to be polite, direct, and aligned with the conversation's flow—use simpler language where possible, ensure logical progression, and maintain the original meaning without additions or alterations.
  4. Consider edge cases: If the original is already optimal, make minimal tweaks for polish; if context suggests escalation (e.g., frustration), add subtle empathy without changing intent.
- **Output:** Provide only the refined user message, without additional explanations, analysis, or commentary.

## Upgrade system prompt

Analyze the provided conversation log. Your task is to identify the core purpose and implicit instructions guiding the `assistant`'s behavior. Based on this analysis, rewrite the `system` prompt to be more explicit, comprehensive, and effective in directing the `assistant` to achieve the observed or intended goals.

**Considerations for the new System Prompt:**

- **Clarity:** Ensure the prompt clearly defines the `assistant`'s role, persona, and capabilities.
- **Completeness:** Incorporate any implicit expectations or constraints observed in the conversation.
- **Effectiveness:** The new prompt should better equip the `assistant` to handle similar user requests in the future.
- **Conciseness:** While being comprehensive, avoid unnecessary verbosity.

**Output:** Provide only the upgraded system prompt.

# Prompt Research: Improving Conversational Flow and Eliminating Subject-Changing Bias

## The Problem
The chatbot was constantly attempting to change the subject, often asking *"אתה רוצה לדבר על מהשהו שונה?"* (Do you want to talk about something different?) after just 1 or 2 messages. This interrupted natural conversation and made the bot feel like a rigid lesson manager rather than a conversational partner.

---

## Rationale for Changes

### 1. Removing the Tutor / Lesson-Manager Persona
LLMs are highly sensitive to persona framing. When defined as a "helpful Hebrew language tutor helping a beginner practice," the model interprets its role as directing a lesson. It monitors student progress, tests vocabulary, and checks if the student wants to move to a new topic once it has responded to a message.
*   **Fix:** Refactored the role to a **peer friend** (*"a native Hebrew speaker chatting with a friend"*). This shifts the dynamic to natural conversational responses rather than curriculum management.

### 2. Eliminating Forced Question Directives
The previous prompt instructed the bot to *"Engage in pleasant conversation by answering their questions or asking them questions."* Because LLMs treat instructions as hard constraints, they would force questions even if a statement was more appropriate. When the model could not think of a relevant topic-specific question, it defaulted to asking to change the subject.
*   **Fix:** Removed the explicit "ask questions" instruction. Replaced it with a directive to *"Focus on having a natural, continuous conversation based on what your friend writes."*

### 3. De-pedagogicalizing the Vocabulary Prompts
The dynamic vocabulary context injected into each request referred to the user as a "student" who is "ALREADY familiar" or "actively trying to learn" target words. It also explicitly warned the model: *"Never change the subject just to force-feed these words."* Because of negation bias, mentioning "change the subject" and "learning" primed the model to think about lessons and changing the topic.
*   **Fix:** Reframed the dynamic vocabulary prompts to fit the peer-friend persona:
    *   Renamed `KNOWN VOCABULARY` to `FAMILIAR WORDS` and framed it as *"Your friend is familiar with the following Hebrew words. Write your responses using a majority of these words..."*
    *   Renamed `TARGET VOCABULARY` to `SUGGESTED WORDS` and framed it as *"You can occasionally weave in 1 or 2 of these Hebrew words ONLY if they naturally fit the current topic of conversation. Do not change the subject..."*

---

## Prompt Comparison

### System Prompt (DEFAULT_CHAT_PROMPT)

#### Old Prompt (Tutor Framing)
```text
You are a native-born Israeli who has kindly agreed to help your friend practice their Hebrew. They are a beginner.
Your absolute, most important rule is that you must ALWAYS speak and reply in the Hebrew language. Do not use English in your replies.
You must speak at the friend's level, which you can infer from the complexity of the vocabulary and grammar they use in the conversation context, and from the vocabulary lists provided.

Keep your responses brief (1-3 short sentences maximum per turn). Avoid large walls of text.
Use clear, simple spacing.
Engage in pleasant conversation by answering their questions or asking them questions.
If they ask for clarification on a word, circumlocute (explain it using simpler Hebrew words that they are likely to know), and only as a last resort, describe a simple physical image or concept.
```

#### New Prompt (Peer Friend Framing)
```text
You are a native Hebrew speaker chatting with a friend. Always reply in Hebrew. Do not use English in your replies.
Match the level of Hebrew complexity used by your friend.

Keep your responses brief (1-3 short sentences maximum per turn). Avoid large walls of text.
Use clear, simple spacing.
Focus on having a natural, continuous conversation based on what your friend writes.
If your friend asks for clarification on a Hebrew word, explain it simply in Hebrew using basic words.
```

---

### Dynamic Vocabulary Context

#### Old Context Builder (`gemini.js`)
```javascript
let vocabContext = '';
if (knownWords.length > 0) {
  vocabContext += '\n\nKNOWN VOCABULARY:\nThe student is ALREADY familiar with the following Hebrew words. Try to construct your sentences using these words as much as possible:\n[' + knownWords.join(', ') + ']\n';
}
if (targetWords.length > 0) {
  vocabContext += '\n\nTARGET VOCABULARY:\nThe student is actively trying to learn these Hebrew words. Weave them (1 or 2 words maximum) into the conversation ONLY if the topic naturally permits it. Never change the subject just to force-feed these words. If the user changes the topic, follow their lead immediately:\n[' + targetWords.join(', ') + ']\n';
}
```

#### New Context Builder (`gemini.js`)
```javascript
let vocabContext = '';
if (knownWords.length > 0) {
  vocabContext += '\n\nFAMILIAR WORDS:\nYour friend is familiar with the following Hebrew words. Write your responses using a majority of these words to keep the language simple and accessible:\n[' + knownWords.join(', ') + ']\n';
}
if (targetWords.length > 0) {
  vocabContext += '\n\nSUGGESTED WORDS:\nYou can occasionally weave in 1 or 2 of these Hebrew words ONLY if they naturally fit the current topic of conversation. Do not change the subject or go out of your way to use them:\n[' + targetWords.join(', ') + ']\n';
}
```

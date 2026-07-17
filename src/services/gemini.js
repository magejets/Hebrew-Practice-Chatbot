import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Validates the Gemini API key.
 * @param {string} apiKey 
 * @returns {Promise<boolean>}
 */
export async function validateApiKey(apiKey) {
  if (!apiKey) return false;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    // Minimal request to verify key
    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: { maxOutputTokens: 5 }
    });
    return true;
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
}

/**
 * Sends a message to the Gemini chat model.
 * 
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.modelName
 * @param {string} params.systemInstruction Base system instruction
 * @param {Array<string>} params.activeVocabularies Array of vocabulary lists
 * @param {Array<object>} params.history Message history in React state format
 * @param {string} params.userMessage Current message from the user
 * @returns {Promise<string>} The assistant's response text
 */
export async function sendChatMessage({
  apiKey,
  modelName = 'gemini-2.5-flash',
  systemInstruction,
  knownWords = [],
  targetWords = [],
  history = [],
  userMessage,
}) {
  if (!apiKey) {
    throw new Error('API Key is required to send messages.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Build vocabulary context string from flat de-duplicated arrays
  let vocabContext = '';
  if (knownWords.length > 0) {
    vocabContext += '\n\nKNOWN VOCABULARY:\nThe student is ALREADY familiar with the following Hebrew words. Try to construct your sentences using these words as much as possible:\n[' + knownWords.join(', ') + ']\n';
  }
  if (targetWords.length > 0) {
    vocabContext += '\n\nTARGET VOCABULARY:\nThe student is actively trying to learn these Hebrew words. Weave them (1 or 2 words maximum) into the conversation ONLY if the topic naturally permits it. Never change the subject just to force-feed these words. If the user changes the topic, follow their lead immediately:\n[' + targetWords.join(', ') + ']\n';
  }

  // Instruct the model to return a structured JSON object
  const jsonInstruction = 
    '\n\nYou MUST format your output as a JSON object matching the following structure:\n' +
    '{\n' +
    '  "text": "Your conversational reply in Hebrew (strictly RTL, simple level, short sentences).",\n' +
    '  "definitions": [\n' +
    '    { "word": "Hebrew word from your reply", "definition": "A simple explanation of that word in Hebrew (suitable for beginners, exactly 1 short sentence, no English)." }\n' +
    '  ],\n' +
    '  "userClarification": {\n' +
    '    "askedForClarification": true / false,\n' +
    '    "targetWords": ["Hebrew words from history/context the user asked to define/explain in their latest message"]\n' +
    '  }\n' +
    '}\n' +
    'Provide definitions for all unique, intermediate, or potentially new Hebrew words in your response text.\n' +
    'Determine if the user\'s latest message is asking for the meaning, translation, explanation, or definition of any Hebrew word. If so, set askedForClarification to true and extract those words in targetWords.';

  const fullSystemInstruction = systemInstruction + vocabContext + jsonInstruction;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: fullSystemInstruction,
  });

  // Convert history from App state format to Google Generative AI SDK format
  const formattedContents = [];
  
  history.forEach((msg) => {
    if (msg.text && !msg.isError && !msg.isLoading) {
      formattedContents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }
  });

  // Append current user message
  formattedContents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  // Define JSON Schema for Gemini SDK
  const jsonSchema = {
    type: "OBJECT",
    properties: {
      text: { 
        type: "STRING", 
        description: "The natural Hebrew conversational response to the user's message." 
      },
      definitions: {
        type: "ARRAY",
        description: "List of Hebrew definitions for unique words used in the response text.",
        items: {
          type: "OBJECT",
          properties: {
            word: { type: "STRING", description: "The Hebrew word/phrase from the response text." },
            definition: { type: "STRING", description: "Simple Hebrew explanation of the word." }
          },
          required: ["word", "definition"]
        }
      },
      userClarification: {
        type: "OBJECT",
        description: "Metadata classifying if the user is asking to clarify vocabulary.",
        properties: {
          askedForClarification: { 
            type: "BOOLEAN", 
            description: "True if the user's latest message is explicitly asking to explain, translate, define, or clarify a Hebrew word." 
          },
          targetWords: {
            type: "ARRAY",
            description: "The Hebrew words/phrases the user is asking about.",
            items: { type: "STRING" }
          }
        },
        required: ["askedForClarification", "targetWords"]
      }
    },
    required: ["text", "definitions", "userClarification"]
  };

  try {
    const result = await model.generateContent({
      contents: formattedContents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        responseMimeType: "application/json",
        responseSchema: jsonSchema,
      },
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Received empty response from Gemini.');
    }
    return responseText;
  } catch (error) {
    console.error('Gemini API Chat error:', error);
    throw error;
  }
}

/**
 * Fetches the simple Hebrew definition/circumlocution for a selected word.
 * 
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.modelName
 * @param {string} params.word Word to define
 * @param {string} params.definitionPrompt System instruction prompt for defining
 * @param {Array<string>} params.activeVocabularies Contextual vocabularies
 * @returns {Promise<string>} Simple Hebrew definition
 */
export async function getWordDefinition({
  apiKey,
  modelName = 'gemini-2.5-flash',
  word,
  definitionPrompt,
  knownWords = [],
  targetWords = [],
}) {
  if (!apiKey) {
    throw new Error('API Key is required.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Let's customize the definition prompt with vocabulary constraints if provided
  let contextSnippet = '';
  if (knownWords.length > 0 || targetWords.length > 0) {
    contextSnippet = '\nThe student is familiar with these Hebrew words. Try to define the word using only these or even simpler Hebrew words:\n[' + [...knownWords, ...targetWords].join(', ') + ']\n';
  }

  const systemInstruction = definitionPrompt + contextSnippet;
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction,
  });

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Word/phrase to explain: "${word}"` }],
      }],
      generationConfig: {
        temperature: 0.3, // Low temperature for more factual definitions
        maxOutputTokens: 150,
      },
    });

    const responseText = result.response.text();
    return responseText ? responseText.trim() : 'לא נמצאה הגדרה מופשטת.';
  } catch (error) {
    console.error('Gemini API Definition error:', error);
    throw error;
  }
}

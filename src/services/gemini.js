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

  // Format conversation history for Google Generative AI SDK
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

  // ==========================================
  // CALL 1: Chatbot Response Prompt
  // ==========================================
  const responseSystemInstruction = systemInstruction + vocabContext;

  const responseModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: responseSystemInstruction,
  });

  let responseText = '';
  try {
    const responseResult = await responseModel.generateContent({
      contents: formattedContents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    responseText = responseResult.response.text();
    if (!responseText) {
      throw new Error('Received empty conversational response from Gemini.');
    }
    responseText = responseText.trim();
  } catch (error) {
    console.error('Gemini API Chat Response error (Call 1):', error);
    throw error;
  }

  // ==========================================
  // CALL 2: Vocabulary Definitions & User Clarification Prompt
  // ==========================================
  const vocabSystemInstruction = 
    'You are an expert Hebrew language vocabulary assistant. Your task is to analyze the chatbot\'s Hebrew response and the user\'s latest message:\n\n' +
    '1. Provide definitions for all unique, intermediate, or potentially new Hebrew words in the chatbot response text ("word": "Hebrew word from reply", "definition": "A simple explanation of that word in Hebrew (suitable for beginners, exactly 1 short sentence, no English).", "examples": ["First simple example sentence in Hebrew using the word", "Second simple example sentence in Hebrew using the word"]).\n' +
    '2. Determine if the user\'s latest message is asking for the meaning, translation, explanation, or definition of any word. If the user asks how to say or translate an English word in Hebrew (e.g., "how to say car in Hebrew" or "איך אומרים car בעברית"), translate that English word to its standard Hebrew equivalent, set askedForClarification to true, and extract the translated Hebrew word in targetWords.\n\n' +
    'You MUST format your output as a JSON object matching the requested schema.';

  const vocabModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: vocabSystemInstruction,
  });

  const vocabContents = [
    ...formattedContents,
    {
      role: 'model',
      parts: [{ text: responseText }],
    },
    {
      role: 'user',
      parts: [{ text: 'Analyze the conversation above: generate definitions and 2 example sentences for all unique, intermediate, or potentially new Hebrew words in the chatbot\'s latest response, and determine if the user\'s latest message asked for clarification or translation on any words.' }],
    }
  ];

  const vocabJsonSchema = {
    type: "OBJECT",
    properties: {
      definitions: {
        type: "ARRAY",
        description: "List of Hebrew definitions and example sentences for unique words used in the response text.",
        items: {
          type: "OBJECT",
          properties: {
            word: { type: "STRING", description: "The Hebrew word/phrase from the response text." },
            definition: { type: "STRING", description: "Simple Hebrew explanation of the word." },
            examples: {
              type: "ARRAY",
              description: "Two simple Hebrew example sentences using the word.",
              items: { type: "STRING" }
            }
          },
          required: ["word", "definition", "examples"]
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
    required: ["definitions", "userClarification"]
  };

  let parsedVocab = {
    definitions: [],
    userClarification: { askedForClarification: false, targetWords: [] }
  };

  try {
    const vocabResult = await vocabModel.generateContent({
      contents: vocabContents,
      generationConfig: {
        temperature: 0.2, // Lower temperature for structured definitions & classification accuracy
        topP: 0.95,
        topK: 40,
        responseMimeType: "application/json",
        responseSchema: vocabJsonSchema,
      },
    });

    const vocabResponseText = vocabResult.response.text();
    if (vocabResponseText) {
      const jsonParsed = JSON.parse(vocabResponseText);
      if (Array.isArray(jsonParsed.definitions)) {
        parsedVocab.definitions = jsonParsed.definitions;
      }
      if (jsonParsed.userClarification) {
        parsedVocab.userClarification = jsonParsed.userClarification;
      }
    }
  } catch (error) {
    console.error('Gemini API Vocabulary error (Call 2):', error);
    // Non-fatal: if vocabulary call fails, chatbot response is still preserved
  }

  // Combine results into JSON string expected by App.jsx
  return JSON.stringify({
    text: responseText,
    definitions: parsedVocab.definitions,
    userClarification: parsedVocab.userClarification,
  });
}

/**
 * Fetches the simple Hebrew definition/circumlocution and example sentences for a selected word.
 * 
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.modelName
 * @param {string} params.word Word to define
 * @param {string} params.definitionPrompt System instruction prompt for defining
 * @param {Array<string>} params.knownWords
 * @param {Array<string>} params.targetWords
 * @returns {Promise<{definition: string, examples: Array<string>}>} Simple Hebrew definition & 2 example sentences
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

  let contextSnippet = '';
  if (knownWords.length > 0 || targetWords.length > 0) {
    contextSnippet = '\nThe student is familiar with these Hebrew words. Try to define the word using only these or even simpler Hebrew words:\n[' + [...knownWords, ...targetWords].join(', ') + ']\n';
  }

  const fullInstruction = definitionPrompt + contextSnippet + 
    '\n\nYou MUST format your output as a JSON object matching this schema:\n' +
    '{\n  "definition": "Simple explanation of the word in Hebrew",\n  "examples": ["First simple example sentence in Hebrew", "Second simple example sentence in Hebrew"]\n}';

  const singleDefSchema = {
    type: "OBJECT",
    properties: {
      definition: { type: "STRING", description: "Simple explanation of the word in Hebrew." },
      examples: {
        type: "ARRAY",
        description: "Two simple Hebrew example sentences using the word.",
        items: { type: "STRING" }
      }
    },
    required: ["definition", "examples"]
  };

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: fullInstruction,
  });

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Word/phrase to explain and provide 2 example sentences for: "${word}"` }],
      }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: singleDefSchema,
      },
    });

    const responseText = result.response.text();
    if (responseText) {
      const parsed = JSON.parse(responseText);
      return {
        definition: parsed.definition || 'לא נמצאה הגדרה מופשטת.',
        examples: Array.isArray(parsed.examples) ? parsed.examples : []
      };
    }
    return { definition: 'לא נמצאה הגדרה מופשטת.', examples: [] };
  } catch (error) {
    console.error('Gemini API Definition error:', error);
    throw error;
  }
}

# Hebrew Practice Chatbot
This app is a chat bot website that uses Google Gemini with carefully crafted prompts to allow the user to practice Hebrew at the level of their choice.

## Features
This app is different from chatting in Hebrew (and this repo could be forked to work with any large-resource language!), because it tracks the vocabulary that you confidently use, and the vocabulary you are unsure about. With that added context, the app crafts a prompt so that the LLM speaks to you at your level, slowly sprinkling in new vocabulary so that you can expand your mastery of the language line upon line!

## Getting a Gemini API Key

To use the chatbot, you will need a Google Gemini API key:

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **Create API key** (or select an existing project to generate a key).
4. Copy the generated API key (starts with `AIzaSy...`).

## Setup & How to Use

1. **Launch the App**:
   - **Local Development**: Run `npm run dev` in your terminal and open the local URL (typically `http://localhost:5173`).
   - **Live Demo**: Visit the [GitHub Pages Test Deployment](https://magejets.github.io/Hebrew-Practice-Chatbot/).
2. **Connect your API Key**:
   - Locate the **Gemini API Connection** section in the left sidebar.
   - Paste your API key into the **Gemini API Key** box.
   - *(Note: Your API key is stored securely in your browser's local storage (`localStorage`) and is only sent directly to Google's Gemini API endpoints.)*
3. **Start Practicing**: Type a message in Hebrew in the chat input and hit send!
import React, { useState, useEffect, useRef } from 'react';
import InteractiveText from './components/InteractiveText';
import WordDefinitionModal from './components/WordDefinitionModal';
import VocabEditorModal from './components/VocabEditorModal';
import { sendChatMessage } from './services/gemini';

// Pre-loaded high-quality vocabulary lists for beginner students
const DEFAULT_VOCABULARY_LISTS = [
  {
    id: 'greetings',
    name: 'Greetings & Basics',
    words: [
      { hebrew: 'שלום', transliteration: 'shalom', english: 'hello / peace' },
      { hebrew: 'בוקר טוב', transliteration: 'boker tov', english: 'good morning' },
      { hebrew: 'ערב טוב', transliteration: 'erev tov', english: 'good evening' },
      { hebrew: 'תודה', transliteration: 'toda', english: 'thank you' },
      { hebrew: 'בבקשה', transliteration: 'bevakasha', english: 'please / you are welcome' },
      { hebrew: 'מה נשמע', transliteration: 'ma nishma', english: 'how are you / what is heard' },
      { hebrew: 'להתראות', transliteration: 'lehitraot', english: 'goodbye / see you' },
      { hebrew: 'סליחה', transliteration: 'slicha', english: 'excuse me / sorry' },
      { hebrew: 'נכון', transliteration: 'nachon', english: 'correct / right' },
      { hebrew: 'טוב', transliteration: 'tov', english: 'good' },
    ]
  },
  {
    id: 'dining',
    name: 'Food & Dining',
    words: [
      { hebrew: 'מים', transliteration: 'mayim', english: 'water' },
      { hebrew: 'לחם', transliteration: 'lechem', english: 'bread' },
      { hebrew: 'ירקות', transliteration: 'yerakot', english: 'vegetables' },
      { hebrew: 'פירות', transliteration: 'peirot', english: 'fruits' },
      { hebrew: 'מסעדה', transliteration: 'misada', english: 'restaurant' },
      { hebrew: 'טעים', transliteration: 'taim', english: 'tasty / delicious' },
      { hebrew: 'קפה', transliteration: 'kafe', english: 'coffee' },
      { hebrew: 'אוכל', transliteration: 'ochel', english: 'food' },
      { hebrew: 'חלב', transliteration: 'chalav', english: 'milk' },
      { hebrew: 'גבינה', transliteration: 'gvina', english: 'cheese' },
    ]
  },
  {
    id: 'family',
    name: 'Family & Home',
    words: [
      { hebrew: 'אבא', transliteration: 'aba', english: 'father / dad' },
      { hebrew: 'אמא', transliteration: 'ima', english: 'mother / mom' },
      { hebrew: 'חבר', transliteration: 'chaver', english: 'friend / member' },
      { hebrew: 'ילד', transliteration: 'yeled', english: 'child / boy' },
      { hebrew: 'בית', transliteration: 'bayit', english: 'house / home' },
      { hebrew: 'משפחה', transliteration: 'mishpacha', english: 'family' },
      { hebrew: 'אח', transliteration: 'ach', english: 'brother' },
      { hebrew: 'אחות', transliteration: 'achot', english: 'sister' },
      { hebrew: 'חדר', transliteration: 'cheder', english: 'room' },
      { hebrew: 'ספר', transliteration: 'sefer', english: 'book' },
    ]
  }
];

// Initial welcome message from the assistant
const INITIAL_CHAT_HISTORY = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'שלום! מה שלומך היום? נשמח לתרגל עברית ביחד.',
    definitions: {
      'שלום': 'מילת ברכה ומפגש.',
      'שלומך': 'איך אתה מרגיש, המצב שלך.',
      'היום': 'ביום הנוכחי הזה.',
      'נשמח': 'נהיה שמחים ומאושרים.',
      'לתרגל': 'לעשות אימונים כדי ללמוד טוב יותר.',
      'עברית': 'השפה שמדברים במדינת ישראל.',
      'ביחד': 'אחד עם השני, בקבוצה ולא לבד.'
    }
  }
];

// Default Chat Prompt approved by user
const DEFAULT_CHAT_PROMPT = 
`You are a native-born Israeli who has kindly agreed to help your friend practice their Hebrew. They are a beginner.
Your absolute, most important rule is that you must ALWAYS speak and reply in the Hebrew language. Do not use English in your replies.
You must speak at the friend's level, which you can infer from the complexity of the vocabulary and grammar they use in the conversation context, and from the vocabulary lists provided.

Keep your responses brief (1-3 short sentences maximum per turn). Avoid large walls of text.
Use clear, simple spacing.
Engage in pleasant conversation by answering their questions or asking them questions.
If they ask for clarification on a word, circumlocute (explain it using simpler Hebrew words that they are likely to know), and only as a last resort, describe a simple physical image or concept.`;

// Default Word Definition Prompt approved by user
const DEFAULT_DEFINITION_PROMPT =
`Explain the meaning of the Hebrew word/phrase: "{word}"
Do not use the word "{word}" itself, or its immediate root variants, in your explanation.
Explain it using only simple, basic Hebrew words suitable for a beginner student.
Do not use English or any other language.
Keep the explanation brief (1 short sentence).`;

export default function App() {
  // State Initialization with local storage fallbacks
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('hebrew_chatbot_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelName, setModelName] = useState(() => localStorage.getItem('hebrew_chatbot_model') || 'gemini-3.1-flash-lite');
  
  const [systemPrompt, setSystemPrompt] = useState(() => 
    localStorage.getItem('hebrew_chatbot_system_prompt') || DEFAULT_CHAT_PROMPT
  );
  const [definitionPrompt, setDefinitionPrompt] = useState(() => 
    localStorage.getItem('hebrew_chatbot_def_prompt') || DEFAULT_DEFINITION_PROMPT
  );

  const [chatHistory, setChatHistory] = useState(() => {
    const savedHistory = localStorage.getItem('hebrew_chatbot_history');
    return savedHistory ? JSON.parse(savedHistory) : INITIAL_CHAT_HISTORY;
  });

  const [vocabLists, setVocabLists] = useState(() => {
    const savedLists = localStorage.getItem('hebrew_chatbot_all_vocab_lists');
    return savedLists ? JSON.parse(savedLists) : DEFAULT_VOCABULARY_LISTS;
  });

  const [activeVocabIds, setActiveVocabIds] = useState(() => {
    const savedActive = localStorage.getItem('hebrew_chatbot_active_vocab');
    return savedActive ? JSON.parse(savedActive) : ['greetings']; // default active
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedWordDef, setSelectedWordDef] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('hebrew_chatbot_theme') || 'dark');
  const [isVocabEditorOpen, setIsVocabEditorOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // Apply Theme on load and when changed
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('hebrew_chatbot_theme', theme);
  }, [theme]);

  // Persist State Changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('hebrew_chatbot_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('hebrew_chatbot_active_vocab', JSON.stringify(activeVocabIds));
  }, [activeVocabIds]);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isGenerating]);

  // Handle API Key Input
  const handleApiKeyChange = (e) => {
    const val = e.target.value.trim();
    setApiKey(val);
    localStorage.setItem('hebrew_chatbot_api_key', val);
  };

  // Toggle Vocabulary List Checkbox
  const handleToggleVocabList = (id) => {
    setActiveVocabIds((prev) => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Upload Custom Vocabulary List (JSON file support)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        
        // Validation check for array of items
        if (!Array.isArray(parsed)) {
          alert('Upload failed: JSON must be an array of lists.');
          return;
        }

        const formattedLists = parsed.map((list, idx) => {
          if (!list.name || !Array.isArray(list.words)) {
            throw new Error(`Item at index ${idx} is missing name or words list.`);
          }
          return {
            id: `custom_${Date.now()}_${idx}`,
            name: list.name,
            words: list.words.map(w => ({
              hebrew: w.hebrew || '',
              english: w.english || '',
            })).filter(w => w.hebrew)
          };
        });

        // Add custom lists to state and persist
        const updatedLists = [...vocabLists, ...formattedLists];
        setVocabLists(updatedLists);
        localStorage.setItem('hebrew_chatbot_all_vocab_lists', JSON.stringify(updatedLists));

        // Auto-activate uploaded lists
        setActiveVocabIds(prev => [...prev, ...formattedLists.map(l => l.id)]);
        alert('Vocabulary list uploaded and activated successfully!');
      } catch (err) {
        alert(`Error parsing JSON vocabulary list: ${err.message}. Format should be: [{"name": "List Name", "words": [{"hebrew": "מילה", "english": "word"}]}]`);
      }
    };
    reader.readAsText(file);
  };

  // Save changes from graphical Vocab List Editor
  const handleSaveVocabLists = (newLists) => {
    setVocabLists(newLists);
    localStorage.setItem('hebrew_chatbot_all_vocab_lists', JSON.stringify(newLists));
    
    // Ensure activeVocabIds doesn't contain deleted list IDs
    const newIds = newLists.map(l => l.id);
    setActiveVocabIds(prev => prev.filter(id => newIds.includes(id)));
  };

  // Reset vocabulary lists to original factory defaults
  const handleResetVocabDefaults = () => {
    setVocabLists(DEFAULT_VOCABULARY_LISTS);
    localStorage.removeItem('hebrew_chatbot_all_vocab_lists');
    setActiveVocabIds(['greetings']);
  };

  // Clear Chat History
  const handleClearHistory = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את כל השיחה? (Are you sure you want to clear the conversation history?)')) {
      setChatHistory(INITIAL_CHAT_HISTORY);
    }
  };

  // Reset System Prompts
  const handleResetPrompts = () => {
    if (window.confirm('Reset prompts to default?')) {
      setSystemPrompt(DEFAULT_CHAT_PROMPT);
      setDefinitionPrompt(DEFAULT_DEFINITION_PROMPT);
      localStorage.setItem('hebrew_chatbot_system_prompt', DEFAULT_CHAT_PROMPT);
      localStorage.setItem('hebrew_chatbot_def_prompt', DEFAULT_DEFINITION_PROMPT);
    }
  };

  // Send Message Flow
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (!apiKey) {
      alert('נא להזין מפתח API כדי להשתמש בצ׳אט. (Please input an API Key to use the chatbot.)');
      return;
    }

    const currentMsgText = inputMessage;
    setInputMessage('');

    // 1. Append User Message
    const userMsgId = `msg_${Date.now()}`;
    const updatedHistory = [
      ...chatHistory,
      { id: userMsgId, sender: 'user', text: currentMsgText }
    ];
    setChatHistory(updatedHistory);
    setIsGenerating(true);

    // 2. Resolve Active Vocabularies
    const activeVocabs = vocabLists.filter(list => activeVocabIds.includes(list.id));

    try {
      // 3. Send API Call (Gemini returns a JSON string in this version)
      const apiResponseString = await sendChatMessage({
        apiKey,
        modelName,
        systemInstruction: systemPrompt,
        activeVocabularies: activeVocabs,
        history: updatedHistory,
        userMessage: currentMsgText
      });

      // 4. Parse the structured JSON response
      let parsedText = '';
      let definitionsMap = {};

      try {
        const parsed = JSON.parse(apiResponseString);
        parsedText = parsed.text || '';
        if (Array.isArray(parsed.definitions)) {
          parsed.definitions.forEach(item => {
            if (item.word && item.definition) {
              definitionsMap[item.word.trim()] = item.definition;
            }
          });
        }
      } catch (jsonErr) {
        console.error('Failed to parse JSON response, falling back to raw output:', jsonErr);
        parsedText = apiResponseString;
      }

      // 5. Append Assistant Message
      setChatHistory(prev => [
        ...prev,
        { 
          id: `msg_${Date.now()}`, 
          sender: 'assistant', 
          text: parsedText,
          definitions: definitionsMap
        }
      ]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [
        ...prev,
        { 
          id: `msg_${Date.now()}_err`, 
          sender: 'assistant', 
          text: `שגיאה בהתחברות לשרת. נא לבדוק את חיבור האינטרנט ומפתח ה-API. (Error connecting. Please check your internet connection and API Key.)\nDetails: ${err.message}`,
          isError: true 
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Clickable word click handler
  const handleWordClick = (word, messageDefinitions) => {
    setSelectedWord(word);
    const cleanWord = word.trim();
    const definition = messageDefinitions ? messageDefinitions[cleanWord] : null;
    setSelectedWordDef(definition);
  };

  return (
    <div className="app-container">
      {/* Sidebar Section */}
      <aside className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Settings & Vocab</h2>
          <span style={{ fontSize: '1.5rem' }}>⚙️</span>
        </div>

        {/* API Configuration */}
        <div className="sidebar-section">
          <div className="sidebar-title">Gemini API Connection</div>
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="apiKeyInput">Gemini API Key</label>
              <button 
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 500 }}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <input 
              id="apiKeyInput"
              type={showApiKey ? "text" : "password"}
              className="input-field"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={apiKeyChange => handleApiKeyChange(apiKeyChange)}
            />
            {/* Connection test removed to protect Requests Per Minute (RPM) limits */}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="modelSelect">Gemini Model</label>
            <select 
              id="modelSelect"
              className="select-input"
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                localStorage.setItem('hebrew_chatbot_model', e.target.value);
              }}
            >
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fastest)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
            </select>
          </div>
        </div>

        {/* Vocabulary Lists */}
        <div className="sidebar-section">
          <div className="sidebar-title">Known Vocabulary</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Toggle list items so the chatbot knows which vocabulary topics you have already studied.
          </p>

          <div className="vocab-lists">
            {vocabLists.map(list => (
              <div 
                key={list.id} 
                className={`vocab-list-item`}
                onClick={() => handleToggleVocabList(list.id)}
                style={{
                  borderColor: activeVocabIds.includes(list.id) ? 'var(--accent-primary)' : 'var(--border-light)',
                  backgroundColor: activeVocabIds.includes(list.id) ? 'hsla(190, 85%, 42%, 0.05)' : 'var(--bg-primary)'
                }}
              >
                <input 
                  type="checkbox"
                  className="vocab-list-checkbox"
                  checked={activeVocabIds.includes(list.id)}
                  onChange={() => {}} // toggled on container click
                />
                <div className="vocab-list-info">
                  <span className="vocab-list-name">{list.name}</span>
                  <span className="vocab-list-count">{list.words.length} words</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button"
              className="btn-icon-text" 
              onClick={() => setIsVocabEditorOpen(true)}
              style={{ flexGrow: 1 }}
            >
              ✏️ Edit Lists
            </button>
            <label className="btn-upload" style={{ margin: 0, flexGrow: 1 }}>
              📤 Upload JSON
              <input 
                type="file" 
                accept=".json" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
              />
            </label>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Upload format: Array of list items: <br/>
            <code>{ '[{"name": "My Words", "words": [{"hebrew": "לחם", "english": "bread"}]}]' }</code>
          </p>
        </div>

        {/* Custom Instructions Customizer */}
        <div className="sidebar-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
          <div className="sidebar-title">Prompt System Configuration</div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="chatPromptText">Chat System Instruction</label>
            <textarea
              id="chatPromptText"
              className="input-field"
              style={{ fontSize: '0.8rem', minHeight: '100px', resize: 'vertical' }}
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                localStorage.setItem('hebrew_chatbot_system_prompt', e.target.value);
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="defPromptText">Definition System Instruction</label>
            <textarea
              id="defPromptText"
              className="input-field"
              style={{ fontSize: '0.8rem', minHeight: '80px', resize: 'vertical' }}
              value={definitionPrompt}
              onChange={(e) => {
                setDefinitionPrompt(e.target.value);
                localStorage.setItem('hebrew_chatbot_def_prompt', e.target.value);
              }}
            />
          </div>

          <button 
            onClick={handleResetPrompts}
            style={{ fontSize: '0.75rem', color: 'var(--accent-tertiary)', textDecoration: 'underline', alignSelf: 'flex-start' }}
          >
            Reset Prompts to Defaults
          </button>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="chat-container">
        {/* Header */}
        <header className="chat-header">
          <div className="chat-header-title">
            <span className="app-logo">🇮🇱</span>
            <h1 className="app-title-text">Hebrew Practicer</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn-icon-text" 
              onClick={handleClearHistory}
              title="Clear chat history"
              style={{ backgroundColor: 'transparent', border: '1px solid var(--border-light)' }}
            >
              🧹 Clear Chat
            </button>
            <button 
              className="theme-toggle-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div className="messages-area">
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`message-bubble-wrapper ${msg.sender}`}>
              <div 
                className={`message-bubble ${msg.sender}`}
                style={msg.isError ? { border: '1px solid var(--accent-tertiary)' } : {}}
              >
                {msg.sender === 'assistant' ? (
                  <InteractiveText text={msg.text} onWordClick={(word) => handleWordClick(word, msg.definitions)} />
                ) : (
                  <div style={{ direction: 'ltr', textAlign: 'left' }}>{msg.text}</div>
                )}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="message-bubble-wrapper assistant">
              <div className="message-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>החבר מקליד... (Friend is typing...)</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Informative Tip Banner */}
        <div style={{ padding: '0 1.5rem', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border-light)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            💡 <span>Tip: Click on any Hebrew word in the chatbot's messages above to view a definition in simplified Hebrew!</span>
          </p>
        </div>

        {/* Chat Input form */}
        <form onSubmit={handleSendMessage} className="chat-input-bar">
          <div className="chat-input-wrapper">
            <input 
              className="chat-input"
              style={{ direction: 'ltr' }} // User inputs text, can be Hebrew or English
              type="text"
              placeholder="הקלד הודעה כאן... (Type a message here...)"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <button 
            type="submit" 
            className="btn-send"
            disabled={isGenerating || !inputMessage.trim()}
            aria-label="Send Message"
          >
            ✈️
          </button>
        </form>
      </main>

      {/* Word Definition Modal Popup */}
      {selectedWord && (
        <WordDefinitionModal
          word={selectedWord}
          localDefinition={selectedWordDef}
          apiKey={apiKey}
          modelName={modelName}
          definitionPrompt={definitionPrompt}
          activeVocabularies={vocabLists.filter(list => activeVocabIds.includes(list.id))}
          onClose={() => {
            setSelectedWord(null);
            setSelectedWordDef(null);
          }}
        />
      )}

      {/* Vocabulary List Editor Modal */}
      {isVocabEditorOpen && (
        <VocabEditorModal
          vocabLists={vocabLists}
          onSave={handleSaveVocabLists}
          onResetDefaults={handleResetVocabDefaults}
          onClose={() => setIsVocabEditorOpen(false)}
        />
      )}
    </div>
  );
}

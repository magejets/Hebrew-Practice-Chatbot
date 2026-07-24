import React, { useState, useEffect, useRef } from 'react';
import InteractiveText from './components/InteractiveText';
import WordDefinitionModal from './components/WordDefinitionModal';
import VocabEditorModal from './components/VocabEditorModal';
import { sendChatMessage } from './services/gemini';

// Pre-loaded high-quality vocabulary lists for beginner students (Hebrew only strings)
const DEFAULT_VOCABULARY_LISTS = [
  {
    id: 'greetings',
    name: 'Greetings & Basics',
    type: 'demonstrated',
    words: ['שלום', 'בוקר טוב', 'ערב טוב', 'תודה', 'בבקשה', 'מה נשמע', 'להתראות', 'סליחה', 'נכון', 'טוב']
  },
  {
    id: 'dining',
    name: 'Food & Dining',
    type: 'demonstrated',
    words: ['מים', 'לחם', 'ירקות', 'פירות', 'מסעדה', 'טעים', 'קפה', 'אוכל', 'חלב', 'גבינה']
  },
  {
    id: 'family',
    name: 'Family & Home',
    type: 'demonstrated',
    words: ['אבא', 'אמא', 'חבר', 'ילד', 'בית', 'משפחה', 'אח', 'אחות', 'חדר', 'ספר']
  }
];

// Helper to strip Hebrew vowel points (niqqud) and diacritics
function stripNiqqud(word) {
  if (!word) return '';
  return word.replace(/[\u05B0-\u05C7]/g, '');
}

// Initial welcome message from the assistant
const INITIAL_CHAT_HISTORY = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'שלום! מה שלומך היום? נשמח לתרגל עברית ביחד.',
    definitions: {
      'שלום': { definition: 'מילת ברכה ומפגש.', examples: ['שלום, מה נשמע היום?', 'אמרתי שלום לחבר שלי.'] },
      'שלומך': { definition: 'איך אתה מרגיש, המצב שלך.', examples: ['מה שלומך הבוקר?', 'אני שואל לשלומך.'] },
      'היום': { definition: 'ביום הנוכחי הזה.', examples: ['היום יש מזג אוויר יפה.', 'מה אתה עושה היום?'] },
      'נשמח': { definition: 'נהיה שמחים ומאושרים.', examples: ['נשמח לראות אותך בסוף השבוע.', 'נשמח לעזור לך ללמוד.'] },
      'לתרגל': { definition: 'לעשות אימונים כדי ללמוד טוב יותר.', examples: ['חשוב לתרגל עברית כל יום.', 'אנחנו רוצים לתרגל שיחה ביחד.'] },
      'עברית': { definition: 'השפה שמדברים במדינת ישראל.', examples: ['אני לומד עברית בבית הספר.', 'עברית היא שפה עתיקה ויפה.'] },
      'ביחד': { definition: 'אחד עם השני, בקבוצה ולא לבד.', examples: ['נאכל ארוחת ערב ביחד.', 'אנחנו עובדים ביחד על הפרויקט.'] }
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
Provide 2 simple example sentences in Hebrew that use the word "{word}".
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
    let loaded = savedLists ? JSON.parse(savedLists) : DEFAULT_VOCABULARY_LISTS;

    // Normalise structure to string arrays and ensure type property exists
    loaded = loaded.map(list => ({
      ...list,
      type: list.type || (list.id === 'demonstrated' ? 'demonstrated' : 'target'),
      words: list.words.map(w => typeof w === 'object' ? (w.hebrew || '') : w).filter(w => w.trim() !== '')
    }));

    // Enforce demonstrated (known) auto-list exists
    if (!loaded.some(l => l.id === 'demonstrated')) {
      loaded.push({ id: 'demonstrated', name: 'Demonstrated Vocab', type: 'demonstrated', words: [] });
    }
    // Enforce target (learning) auto-list exists
    if (!loaded.some(l => l.id === 'target')) {
      loaded.push({ id: 'target', name: 'Target Vocab', type: 'target', words: [] });
    }
    return loaded;
  });

  const [activeVocabIds, setActiveVocabIds] = useState(() => {
    const savedActive = localStorage.getItem('hebrew_chatbot_active_vocab');
    let parsed = savedActive ? JSON.parse(savedActive) : ['greetings']; // default active
    if (!parsed.includes('demonstrated')) {
      parsed.push('demonstrated');
    }
    if (!parsed.includes('target')) {
      parsed.push('target');
    }
    return parsed;
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedWordDef, setSelectedWordDef] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('hebrew_chatbot_theme') || 'dark');
  const [isVocabEditorOpen, setIsVocabEditorOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showTip, setShowTip] = useState(() => localStorage.getItem('hebrew_chatbot_hide_word_tip') !== 'true');
  const [sectionsExpanded, setSectionsExpanded] = useState(() => {
    const hasKey = !!(localStorage.getItem('hebrew_chatbot_api_key') || '');
    return {
      connection: !hasKey,
      vocab: true,
      prompts: false
    };
  });

  const messagesEndRef = useRef(null);

  // Monitor screen size to handle responsive drawer behaviors
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const listener = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) {
        setIsSidebarOpen(false);
      }
    };
    setIsMobile(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

        const isKnownImport = window.confirm('Import these lists as "Known / Demonstrated" vocabulary?\n\n- Click OK for Known (🟢 Demonstrated)\n- Click Cancel for Learning (🎯 Target)');
        const importedType = isKnownImport ? 'demonstrated' : 'target';

        const formattedLists = parsed.map((list, idx) => {
          if (!list.name || !Array.isArray(list.words)) {
            throw new Error(`Item at index ${idx} is missing name or words list.`);
          }
          return {
            id: `custom_${Date.now()}_${idx}`,
            name: list.name,
            type: list.type || importedType,
            words: list.words.map(w => {
              const strVal = typeof w === 'object' ? (w.hebrew || '') : w;
              return stripNiqqud(strVal).trim();
            }).filter(w => w.length > 0)
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
        alert(`Error parsing JSON vocabulary list: ${err.message}. Format should be: [{"name": "List Name", "words": ["אחד", "שתיים"]}]`);
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

    // 2. Resolve active lists and compile separate pools for Known and Target words
    const activeVocabs = vocabLists.filter(list => activeVocabIds.includes(list.id));
    const knownWordsSet = new Set();
    const targetWordsSet = new Set();

    activeVocabs.forEach(list => {
      list.words.forEach(w => {
        const cleanWord = stripNiqqud(w).trim();
        if (cleanWord) {
          if (list.type === 'demonstrated') {
            knownWordsSet.add(cleanWord);
          } else if (list.type === 'target') {
            targetWordsSet.add(cleanWord);
          }
        }
      });
    });

    // Known words always override/take precedence, so remove from target pool if present in known pool
    knownWordsSet.forEach(w => targetWordsSet.delete(w));

    const flatKnownWords = Array.from(knownWordsSet);
    const flatTargetWords = Array.from(targetWordsSet);

    try {
      // 3. Send API Call with separated known/target vocabulary pools
      const apiResponseString = await sendChatMessage({
        apiKey,
        modelName,
        systemInstruction: systemPrompt,
        knownWords: flatKnownWords,
        targetWords: flatTargetWords,
        history: updatedHistory,
        userMessage: currentMsgText
      });

      // 4. Parse the structured JSON response (containing text, definitions, userClarification)
      let parsedText = '';
      let definitionsMap = {};
      let userClarification = { askedForClarification: false, targetWords: [] };

      try {
        const parsed = JSON.parse(apiResponseString);
        parsedText = parsed.text || '';
        if (Array.isArray(parsed.definitions)) {
          parsed.definitions.forEach(item => {
            if (item.word && item.definition) {
              definitionsMap[item.word.trim()] = {
                definition: item.definition,
                examples: Array.isArray(item.examples) ? item.examples : []
              };
            }
          });
        }
        if (parsed.userClarification) {
          userClarification = parsed.userClarification;
        }
      } catch (jsonErr) {
        console.error('Failed to parse JSON response, falling back to raw output:', jsonErr);
        parsedText = apiResponseString;
      }

      // 5. Update Vocabulary Lists based on User Clarification Metadata & Promotion Rules
      setVocabLists(prevLists => {
        const demListIdx = prevLists.findIndex(l => l.id === 'demonstrated');
        const tarListIdx = prevLists.findIndex(l => l.id === 'target');
        if (demListIdx === -1 || tarListIdx === -1) return prevLists;

        const demList = prevLists[demListIdx];
        const tarList = prevLists[tarListIdx];

        const knownSet = new Set(demList.words);
        const learningSet = new Set(tarList.words);
        let changed = false;

        // Parse Hebrew words user typed in their input message
        const typedWords = (currentMsgText.match(/[\u0590-\u05FF]+/g) || [])
          .map(w => stripNiqqud(w).trim())
          .filter(w => w.length > 0);

        if (userClarification.askedForClarification) {
          // Case A: User explicitly asked about vocabulary in this message.
          // Add asked-about words to Target/Learning list
          const hebrewRegex = /[\u0590-\u05FF]/;
          const targetWords = (userClarification.targetWords || [])
            .map(w => stripNiqqud(w).trim())
            .filter(w => w.length > 0 && hebrewRegex.test(w));

          targetWords.forEach(word => {
            if (!knownSet.has(word) && !learningSet.has(word)) {
              learningSet.add(word);
              changed = true;
            }
          });

          // Also add other words they typed (excluding clarification targets) to Demonstrated/Known list
          typedWords.forEach(word => {
            if (!targetWords.includes(word) && !knownSet.has(word)) {
              knownSet.add(word);
              if (learningSet.has(word)) {
                learningSet.delete(word);
              }
              changed = true;
            }
          });
        } else {
          // Case B: Regular conversational message.
          // Add typed words to Demonstrated list, applying Promotion Check:
          typedWords.forEach(word => {
            if (learningSet.has(word)) {
              // Promote target word to demonstrated!
              learningSet.delete(word);
              knownSet.add(word);
              changed = true;
            } else if (!knownSet.has(word)) {
              knownSet.add(word);
              changed = true;
            }
          });
        }

        // Global Known status overrides Target list: remove any demonstrated/known words from learningSet
        const allKnownWordsSet = new Set();
        prevLists.forEach(list => {
          if (list.type === 'demonstrated') {
            list.words.forEach(w => allKnownWordsSet.add(w));
          }
        });
        knownSet.forEach(w => allKnownWordsSet.add(w));

        allKnownWordsSet.forEach(w => {
          if (learningSet.has(w)) {
            learningSet.delete(w);
            changed = true;
          }
        });

        if (!changed) return prevLists;

        const copy = [...prevLists];
        copy[demListIdx] = { ...demList, words: Array.from(knownSet) };
        copy[tarListIdx] = { ...tarList, words: Array.from(learningSet) };

        localStorage.setItem('hebrew_chatbot_all_vocab_lists', JSON.stringify(copy));
        return copy;
      });

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
    const cleanWord = stripNiqqud(word).trim();
    const definition = messageDefinitions ? messageDefinitions[cleanWord] : null;
    setSelectedWordDef(definition);

    // Auto-dismiss the word definition tip banner on the first click and persist choice
    if (showTip) {
      setShowTip(false);
      localStorage.setItem('hebrew_chatbot_hide_word_tip', 'true');
    }

    // If word clicked to view definition, add to 'target' (Learning) list automatically
    if (cleanWord) {
      setVocabLists(prevLists => {
        const demListIdx = prevLists.findIndex(l => l.id === 'demonstrated');
        const tarListIdx = prevLists.findIndex(l => l.id === 'target');
        if (demListIdx === -1 || tarListIdx === -1) return prevLists;

        // Known status overrides target status: skip if already on a known/demonstrated list
        const isKnown = prevLists.some(list => list.type === 'demonstrated' && list.words.includes(cleanWord));
        if (isKnown) return prevLists;

        const tarList = prevLists[tarListIdx];
        if (tarList.words.includes(cleanWord)) return prevLists;

        const copy = [...prevLists];
        copy[tarListIdx] = {
          ...tarList,
          words: [...tarList.words, cleanWord]
        };

        localStorage.setItem('hebrew_chatbot_all_vocab_lists', JSON.stringify(copy));
        return copy;
      });
    }
  };

  return (
    <div className="app-container">
      {/* Drawer Backdrop for Mobile */}
      {isMobile && isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Section */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Settings & Vocab</h2>
          {isMobile && (
            <button
              className="sidebar-close-btn"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close settings menu"
              style={{ fontSize: '1.25rem', cursor: 'pointer', padding: '0.2rem' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* API Configuration */}
        <div className="sidebar-accordion">
          <button
            type="button"
            className="sidebar-accordion-header"
            onClick={() => toggleSection('connection')}
            aria-expanded={sectionsExpanded.connection}
          >
            <span className="sidebar-title">Gemini API Connection</span>
            <span className={`chevron ${sectionsExpanded.connection ? 'open' : ''}`}>▼</span>
          </button>

          <div className={`sidebar-accordion-content ${sectionsExpanded.connection ? 'open' : 'collapsed'}`}>
            <div className="sidebar-section">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="apiKeyInput">Gemini API Key</label>
                  <button
                    type="button"
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
          </div>
        </div>

        {/* Vocabulary Lists */}
        <div className="sidebar-accordion">
          <button
            type="button"
            className="sidebar-accordion-header"
            onClick={() => toggleSection('vocab')}
            aria-expanded={sectionsExpanded.vocab}
          >
            <span className="sidebar-title">Known Vocabulary</span>
            <span className={`chevron ${sectionsExpanded.vocab ? 'open' : ''}`}>▼</span>
          </button>

          <div className={`sidebar-accordion-content ${sectionsExpanded.vocab ? 'open' : 'collapsed'}`}>
            <div className="sidebar-section">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Toggle list items so the chatbot knows which vocabulary topics you have already studied.
              </p>

              {/* Group 1: Demonstrated / Known Lists */}
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                <span>Demonstrated / Known</span>
              </div>
              <div className="vocab-lists" style={{ marginBottom: '1.25rem' }}>
                {vocabLists.filter(l => l.type === 'demonstrated').map(list => (
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
                      onChange={() => { }} // toggled on container click
                    />
                    <div className="vocab-list-info">
                      <span className="vocab-list-name">{list.name}</span>
                      <span className="vocab-list-count">{list.words.length} words</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Group 2: Learning / Target Lists */}
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                <span>Learning / Target</span>
              </div>
              <div className="vocab-lists" style={{ marginBottom: '1.25rem' }}>
                {vocabLists.filter(l => l.type === 'target').map(list => (
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
                      onChange={() => { }} // toggled on container click
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
                  Edit Lists
                </button>
                <label className="btn-upload" style={{ margin: 0, flexGrow: 1 }}>
                  Upload JSON
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'left', direction: 'ltr' }}>
                Upload format: Array of list items:
                <pre style={{
                  margin: '0.4rem 0 0 0',
                  padding: '0.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                  lineHeight: '1.3',
                  whiteSpace: 'pre-wrap'
                }}>
{`[
  {
    "name": "My Words",
    "words": ["לחם", "מים"]
  }
]`}
                </pre>
              </p>
            </div>
          </div>
        </div>

        {/* Custom Instructions Customizer */}
        <div className="sidebar-accordion" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            className="sidebar-accordion-header"
            onClick={() => toggleSection('prompts')}
            aria-expanded={sectionsExpanded.prompts}
          >
            <span className="sidebar-title">Prompt System Configuration</span>
            <span className={`chevron ${sectionsExpanded.prompts ? 'open' : ''}`}>▼</span>
          </button>

          <div className={`sidebar-accordion-content ${sectionsExpanded.prompts ? 'open' : 'collapsed'}`}>
            <div className="sidebar-section" style={{ paddingTop: '0.5rem' }}>
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
                type="button"
                onClick={handleResetPrompts}
                style={{ fontSize: '0.75rem', color: 'var(--accent-tertiary)', textDecoration: 'underline', alignSelf: 'flex-start' }}
              >
                Reset Prompts to Defaults
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="chat-container" inert={isMobile && isSidebarOpen ? '' : undefined}>
        {/* Header */}
        <header className="chat-header">
          <div className="chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isMobile && (
              <button
                type="button"
                className="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle settings menu"
                aria-expanded={isSidebarOpen}
                style={{ fontSize: '1.5rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ☰
              </button>
            )}
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
              Clear Chat
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
                  <div className="hebrew-text">{msg.text}</div>
                )}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="message-bubble-wrapper assistant">
              <div className="message-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>החבר מקליד...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Informative Tip Banner */}
        {showTip && (
          <div style={{ padding: '0 1.5rem', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              💡 <span>Tip: Click on any Hebrew word in the chatbot's messages above to view a definition in simplified Hebrew!</span>
            </p>
          </div>
        )}

        {/* Chat Input form */}
        <form onSubmit={handleSendMessage} className="chat-input-bar">
          <div className="chat-input-wrapper">
            <input
              className="chat-input"
              type="text"
              placeholder="הקלד הודעה כאן..."
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="send-icon"
              aria-hidden="true"
            >
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
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
          knownWords={Array.from(
            new Set(
              vocabLists
                .filter(list => activeVocabIds.includes(list.id) && list.type === 'demonstrated')
                .flatMap(list => list.words)
            )
          )}
          targetWords={Array.from(
            new Set(
              vocabLists
                .filter(list => activeVocabIds.includes(list.id) && list.type === 'target')
                .flatMap(list => list.words)
            )
          )}
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
          defaultVocabLists={DEFAULT_VOCABULARY_LISTS}
          onSave={handleSaveVocabLists}
          onClose={() => setIsVocabEditorOpen(false)}
        />
      )}
    </div>
  );
}

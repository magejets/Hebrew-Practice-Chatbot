import React, { useState, useEffect } from 'react';
import { getWordDefinition } from '../services/gemini';

/**
 * WordDefinitionModal is a floating modal that displays a definition
 * for a Hebrew word by querying the Gemini API on demand.
 * 
 * @param {object} props
 * @param {string} props.word The clicked word
 * @param {string} props.apiKey Gemini API Key
 * @param {string} props.modelName Chosen Gemini model
 * @param {string} props.definitionPrompt Prompt template for definitions
 * @param {Array<object>} props.activeVocabularies Current active vocab lists for context
 * @param {function} props.onClose Callback to close the modal
 */
export default function WordDefinitionModal({
  word,
  localDefinition,
  apiKey,
  modelName,
  definitionPrompt,
  knownWords = [],
  targetWords = [],
  onClose,
}) {
  const [definition, setDefinition] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!word) return;

    if (localDefinition) {
      setDefinition(localDefinition);
      setIsLoading(false);
      setError('');
      return;
    }

    async function fetchDefinition() {
      setIsLoading(true);
      setError('');
      setDefinition('');

      if (!apiKey) {
        setError('נא להזין מפתח API בהגדרות כדי לראות הגדרות מילים. (Please input an API Key in the settings to view definitions.)');
        setIsLoading(false);
        return;
      }

      try {
        const result = await getWordDefinition({
          apiKey,
          modelName,
          word,
          definitionPrompt,
          knownWords,
          targetWords,
        });
        setDefinition(result);
      } catch (err) {
        console.error('Error fetching word definition:', err);
        setError('שגיאה בקבלת ההגדרה. אנא נסה שוב. (Error loading definition. Please try again.)');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDefinition();
  }, [word, localDefinition, apiKey, modelName, definitionPrompt, knownWords, targetWords]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>פירוש מילה (Word Definition)</h3>
        </div>
        <div className="modal-body">
          <div className="modal-word-title">{word}</div>
          
          <div className="modal-definition-content">
            {isLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner"></div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Loading explanation...
                </span>
              </div>
            )}
            
            {error && (
              <div className="error-text" style={{ textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                {error}
              </div>
            )}
            
            {!isLoading && !error && (
              <div style={{ width: '100%' }}>
                {definition}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

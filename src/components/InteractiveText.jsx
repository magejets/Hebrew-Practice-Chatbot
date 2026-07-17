import React from 'react';

/**
 * InteractiveText scans text, splits it by paragraphs and tokens,
 * and makes Hebrew words clickable so users can fetch definitions.
 * 
 * @param {object} props
 * @param {string} props.text The message content
 * @param {function} props.onWordClick Callback when a Hebrew word is clicked
 */
export default function InteractiveText({ text, onWordClick }) {
  if (!text) return null;

  // Split text by newlines into paragraphs
  const paragraphs = text.split('\n');

  // Regex to detect Hebrew characters
  const hebrewRegex = /[\u0590-\u05FF]/;

  return (
    <>
      {paragraphs.map((para, pIdx) => {
        if (!para.trim()) return <br key={pIdx} />;

        const isHebrewPara = hebrewRegex.test(para);

        // If paragraph has no Hebrew, render it as standard left-to-right text
        if (!isHebrewPara) {
          return (
            <p key={pIdx} style={{ direction: 'ltr', textAlign: 'left', margin: '0.4rem 0' }}>
              {para}
            </p>
          );
        }

        // Tokenize Hebrew paragraph
        // Split by spaces, preserving the spaces in the array
        const tokens = para.split(/(\s+)/);

        return (
          <p key={pIdx} className="hebrew-text" style={{ margin: '0.4rem 0' }}>
            {tokens.map((token, tIdx) => {
              // If it's whitespace, render as is
              if (/^\s+$/.test(token)) {
                return token;
              }

              // Parse token: separate word from punctuation
              // Group 1: Leading punctuation/characters (non-Hebrew)
              // Group 2: Hebrew word (includes Hebrew range plus apostrophes / gershayim/geresh: ׳ ״ ' ")
              // Group 3: Trailing punctuation/characters (non-Hebrew)
              const match = token.match(/^([^\u0590-\u05FF]*)([\u0590-\u05FF'\"״׳\-]+)?([^\u0590-\u05FF]*)$/);

              if (!match) {
                return <span key={tIdx} className="punctuation">{token}</span>;
              }

              const [, leading, word, trailing] = match;

              return (
                <span key={tIdx}>
                  {leading && <span className="punctuation">{leading}</span>}
                  {word ? (
                    <span 
                      className="clickable-word" 
                      onClick={() => onWordClick(word)}
                      title={`Click to define "${word}"`}
                    >
                      {word}
                    </span>
                  ) : null}
                  {trailing && <span className="punctuation">{trailing}</span>}
                </span>
              );
            })}
          </p>
        );
      })}
    </>
  );
}

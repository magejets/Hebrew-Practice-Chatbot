import React, { useState, useEffect } from 'react';

/**
 * VocabEditorModal provides a graphical list editor for all vocabulary lists.
 * Users can create new lists, modify list names, edit word strings (Hebrew only),
 * add blank word rows, delete rows, delete lists, and reset to system defaults.
 * 
 * @param {object} props
 * @param {Array<object>} props.vocabLists All current vocabulary lists
 * @param {function} props.onSave Callback when changes are saved
 * @param {function} props.onResetDefaults Callback to restore presets
 * @param {function} props.onClose Callback to close the modal
 */
export default function VocabEditorModal({
  vocabLists,
  onSave,
  onResetDefaults,
  onClose,
}) {
  // Local mutable copy of lists to allow editing without immediately saving to parent
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);

  // Synchronize local state with passed-in lists on mount/open
  useEffect(() => {
    if (vocabLists && vocabLists.length > 0) {
      // Deep clone lists
      const cloned = vocabLists.map(list => ({
        id: list.id,
        name: list.name,
        // Standardise words as flat string arrays (mapping objects if legacy format was stored)
        words: list.words.map(w => typeof w === 'object' ? (w.hebrew || '') : w)
      }));
      setLists(cloned);
      
      // Select first list by default if none is selected
      if (!selectedListId || !cloned.some(l => l.id === selectedListId)) {
        setSelectedListId(cloned[0].id);
      }
    } else {
      setLists([]);
      setSelectedListId(null);
    }
  }, [vocabLists]);

  // Retrieve current active list editing target
  const currentListIndex = lists.findIndex(l => l.id === selectedListId);
  const currentList = currentListIndex !== -1 ? lists[currentListIndex] : null;

  // Handle changes to list name
  const handleListNameChange = (newName) => {
    if (currentListIndex === -1) return;
    setLists(prev => {
      const copy = [...prev];
      copy[currentListIndex] = {
        ...copy[currentListIndex],
        name: newName
      };
      return copy;
    });
  };

  // Handle changes to word text
  const handleWordFieldChange = (wordIdx, value) => {
    if (currentListIndex === -1) return;
    setLists(prev => {
      const copy = [...prev];
      const updatedWords = [...copy[currentListIndex].words];
      updatedWords[wordIdx] = value;
      copy[currentListIndex] = {
        ...copy[currentListIndex],
        words: updatedWords
      };
      return copy;
    });
  };

  // Add blank word row to current list
  const handleAddWordRow = () => {
    if (currentListIndex === -1) return;
    setLists(prev => {
      const copy = [...prev];
      const updatedWords = [...copy[currentListIndex].words, ''];
      copy[currentListIndex] = {
        ...copy[currentListIndex],
        words: updatedWords
      };
      return copy;
    });
  };

  // Delete word row
  const handleDeleteWordRow = (wordIdx) => {
    if (currentListIndex === -1) return;
    setLists(prev => {
      const copy = [...prev];
      const updatedWords = copy[currentListIndex].words.filter((_, idx) => idx !== wordIdx);
      copy[currentListIndex] = {
        ...copy[currentListIndex],
        words: updatedWords
      };
      return copy;
    });
  };

  // Create a completely new list
  const handleCreateNewList = () => {
    const newListId = `list_${Date.now()}`;
    const newList = {
      id: newListId,
      name: 'New Vocabulary List',
      words: ['']
    };
    setLists(prev => [...prev, newList]);
    setSelectedListId(newListId);
  };

  // Delete the entire selected list
  const handleDeleteList = () => {
    if (currentListIndex === -1) return;
    if (window.confirm(`האם למחוק את הרשימה "${currentList.name}"? (Are you sure you want to delete this list?)`)) {
      const remaining = lists.filter(l => l.id !== selectedListId);
      setLists(remaining);
      if (remaining.length > 0) {
        setSelectedListId(remaining[0].id);
      } else {
        setSelectedListId(null);
      }
    }
  };

  // Reset to original preset lists
  const handleResetToSystem = () => {
    if (window.confirm('Reset all lists to system defaults? This will erase custom lists.')) {
      onResetDefaults();
      onClose();
    }
  };

  // Save changes back to parent
  const handleSave = () => {
    // Filter out completely empty rows and empty lists
    const cleanedLists = lists.map(list => ({
      ...list,
      words: list.words.map(w => w.trim()).filter(w => w !== '')
    })).filter(list => list.name.trim() !== '');

    onSave(cleanedLists);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content vocab-editor-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            ספריית אוצר מילים (Vocabulary Editor)
          </h3>
        </div>

        {/* Modal Split Body */}
        <div className="vocab-editor-body">
          
          {/* Left Sidebar: Lists Selector */}
          <aside className="vocab-editor-sidebar">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Select List
            </span>
            {lists.map(list => (
              <button
                key={list.id}
                className={`vocab-editor-tab ${selectedListId === list.id ? 'active' : ''}`}
                onClick={() => setSelectedListId(list.id)}
              >
                📁 {list.name}
              </button>
            ))}
            <button 
              className="btn-add-list"
              onClick={handleCreateNewList}
            >
              ➕ Create New List
            </button>
          </aside>

          {/* Right Main Panel: Edit Selected List */}
          <main className="vocab-editor-main">
            {currentList ? (
              <>
                {/* List Name Input */}
                <div className="form-group">
                  <label className="form-label" htmlFor="vocabListNameInput">List Title / Name</label>
                  <input
                    id="vocabListNameInput"
                    type="text"
                    className="input-field"
                    value={currentList.name}
                    onChange={(e) => handleListNameChange(e.target.value)}
                    placeholder="Enter list name..."
                    style={{ fontWeight: 600, fontSize: '1.1rem' }}
                  />
                </div>

                {/* Grid Word Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', padding: '0 0.75rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Hebrew Word / Phrase (עברית)</span>
                  <span style={{ width: '32px' }}></span>
                </div>

                {/* Word Rows Editor Area */}
                <div className="vocab-editor-rows-container">
                  {currentList.words.map((word, wordIdx) => (
                    <div key={wordIdx} className="vocab-editor-row">
                      <input
                        type="text"
                        className="vocab-editor-row-input hebrew"
                        placeholder="שלום"
                        value={word}
                        onChange={(e) => handleWordFieldChange(wordIdx, e.target.value)}
                      />
                      <button
                        className="btn-delete-row"
                        onClick={() => handleDeleteWordRow(wordIdx)}
                        title="Remove word"
                      >
                        &times;
                      </button>
                    </div>
                  ))}

                  {currentList.words.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No words in this list yet. Click Add Row to add words.
                    </div>
                  )}
                </div>

                {/* Add Word Button */}
                <button
                  className="btn-secondary"
                  onClick={handleAddWordRow}
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  ➕ Add Word Row
                </button>
              </>
            ) : (
              <div className="empty-state">
                No list selected. Click "Create New List" in the sidebar to get started.
              </div>
            )}
          </main>
        </div>

        {/* Modal Footer Controls */}
        <div className="vocab-editor-footer">
          {currentList ? (
            <button className="btn-danger" onClick={handleDeleteList}>
              🗑️ Delete List
            </button>
          ) : (
            <div />
          )}

          <div className="vocab-editor-actions-right">
            <button className="btn-secondary" onClick={handleResetToSystem}>
              🔄 Reset to Defaults
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import styles from './LessonViewer.module.css';
import AppLoader from './AppLoader';

// Модельные данные упражнения
const QUIZ_ITEMS = [
  { id: 'boy', pic: '👦', label: 'a boy', color: '#bbf7d0' },
  { id: 'girl', pic: '👩‍🦰', label: 'a girl', color: '#fecaca' },
  { id: 'cat', pic: '🐱', label: 'a cat', color: '#e9d5ff' },
  { id: 'dog', pic: '🐶', label: 'a dog', color: '#bfdbfe' },
];

export default function LessonViewer() {
  // --- LOADER STATE ---
  const [isLoading, setIsLoading] = useState(true);

  // 1. STATE MANAGEMENT
  // Word bank contains exactly the labels that have NOT been dropped into any pic slot
  const [wordBank, setWordBank] = useState<string[]>(['a boy', 'a girl', 'a cat', 'a dog']);
  
  // Slots: Record<PicId, WordLabel | null>
  const [slots, setSlots] = useState<Record<string, string | null>>({
    boy: null, girl: null, cat: null, dog: null
  });

  // Dual-mode input: support click-to-match for mobile devices
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  
  // Validation state
  const [hasChecked, setHasChecked] = useState(false);

  // Simulate remote loading of Lesson data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // 2. HANDLERS
  const clearSelection = () => setSelectedWord(null);

  // --- DRAG AND DROP (DESKTOP) ---
  const handleDragStart = (e: React.DragEvent, word: string) => {
    e.dataTransfer.setData('word_id', word);
    clearSelection();
  };

  const handleDropToSlot = (e: React.DragEvent, targetPicId: string) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('word_id');
    if (!word || hasChecked) return;
    moveWordToSlot(word, targetPicId);
  };

  const handleDropToBank = (e: React.DragEvent) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('word_id');
    if (!word || hasChecked) return;
    returnToBank(word);
  };

  // --- CLICK EXPERIENCES (MOBILE) ---
  const handleBankWordClick = (word: string) => {
    if (hasChecked) return;
    setSelectedWord(prev => prev === word ? null : word);
  };

  const handleSlotClick = (picId: string) => {
    if (hasChecked) return;

    const currentWordInSlot = slots[picId];

    if (selectedWord) {
      moveWordToSlot(selectedWord, picId);
    } else if (currentWordInSlot) {
      returnToBank(currentWordInSlot);
    }
  };

  // --- CORE LOGIC ---
  const moveWordToSlot = (word: string, targetPicId: string) => {
    setSlots(prevSlots => {
      const newSlots = { ...prevSlots };
      let displacedWord: string | null = null;
      
      // Remove the word from any existing slot
      for (const key in newSlots) {
        if (newSlots[key] === word) newSlots[key] = null;
      }

      // If there's already a word in the target slot, it gets displaced
      if (newSlots[targetPicId]) {
        displacedWord = newSlots[targetPicId];
      }

      // Place the new word
      newSlots[targetPicId] = word;

      // Now sync the wordBank safely
      setWordBank(bank => {
        let newBank = bank.filter(w => w !== word);
        if (displacedWord && !newBank.includes(displacedWord)) {
          newBank.push(displacedWord);
        }
        return newBank;
      });

      return newSlots;
    });

    clearSelection();
  };

  const returnToBank = (word: string) => {
    setSlots(prev => {
      const newSlots = { ...prev };
      for (const key in newSlots) {
        if (newSlots[key] === word) newSlots[key] = null;
      }
      return newSlots;
    });

    setWordBank(prev => prev.includes(word) ? prev : [...prev, word]);
    clearSelection();
  };

  const handleCheckAnswers = () => {
    setHasChecked(true);
    setSelectedWord(null);
  };

  const handleReset = () => {
    setWordBank(['a boy', 'a girl', 'a cat', 'a dog']);
    setSlots({ boy: null, girl: null, cat: null, dog: null });
    setHasChecked(false);
  };

  const allFilled = Object.values(slots).every(val => val !== null);

  // 3. RENDERERS
  return (
    <div className={styles.lessonViewer}>
      {/* GLOBAL MOUNT LOADER */}
      <AppLoader show={isLoading} />
      
      {/* Левая панель инструментов */}
      <div className={styles.leftToolbar}>
        <div className={styles.toolIcon}>👥</div>
        <div className={styles.toolIcon}>💬</div>
        <div className={styles.toolIcon}>⭐</div>
        <div className={styles.toolIcon}>⏱</div>
      </div>

      {/* Центральная панель: Упражнения / Контент */}
      <section className={styles.lessonContent}>
        <div className={styles.contentInner}>
          <h1 className={styles.lessonMainTitle}>Warm-up</h1>
          
          <div className={styles.exerciseBlock}>
            <div className={styles.excHeader}>
              <div className={styles.excTitleWrap}>
                <span className={styles.excNumber}>1.1</span>
                <h2 className={styles.excTitle}>Match the words with the pictures</h2>
              </div>
              
              {!hasChecked ? (
                <button 
                  className={styles.checkBtn} 
                  disabled={!allFilled}
                  onClick={handleCheckAnswers}
                >
                  Check Answers
                </button>
              ) : (
                <button className={styles.checkBtn} onClick={handleReset} style={{ background: '#3b82f6' }}>
                  Reset Exercise
                </button>
              )}
            </div>
            
            {/* BANK СЛОВ */}
            <div 
              className={styles.wordBank}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToBank}
            >
              {wordBank.length === 0 && <span style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto' }}>All words placed</span>}
              {wordBank.map((word) => (
                <div 
                  key={word}
                  className={`${styles.draggableWord} ${selectedWord === word ? styles.selectedWord : ''}`}
                  draggable={!hasChecked}
                  onDragStart={(e) => handleDragStart(e, word)}
                  onClick={() => handleBankWordClick(word)}
                >
                  <div className={styles.gripHandleLeft}>⋮⋮</div>
                  <div className={styles.wordText}>{word}</div>
                </div>
              ))}
            </div>

            {/* КАРТИНКИ (DROP ZONES) */}
            <div className={styles.picsGrid}>
              {QUIZ_ITEMS.map((item) => {
                const placedWord = slots[item.id];
                let validationClass = '';
                
                if (hasChecked && placedWord) {
                  validationClass = placedWord === item.label ? styles.slotCorrect : styles.slotWrong;
                }

                return (
                  <div key={item.id} className={styles.picItem}>
                    <div className={styles.picPlaceholder} style={{ background: item.color }}>
                      {item.pic}
                    </div>
                    
                    <div 
                      className={`${styles.dropZoneContainer} ${placedWord ? styles.dropZoneFilled : styles.dropZoneEmpty} ${validationClass}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropToSlot(e, item.id)}
                      onClick={() => handleSlotClick(item.id)}
                    >
                      {placedWord && <div className={styles.gripHandleLeft} style={{opacity: 0.5}}>⋮⋮</div>}
                      <div className={styles.dropZoneTarget}>
                        {placedWord || ''}
                      </div>
                      <div className={styles.gripHandleRight}>⋮⋮</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Правая панель: План (Sections) */}
      <aside className={styles.rightSidebar}>
        <div className={styles.sectionsBlock}>
          <h3 className={styles.sidebarTitle}>Разделы</h3>
          <ul className={styles.planList}>
            <li className={styles.planItem}>Lesson information</li>
            <li className={styles.planItem}>Vocabulary: Days of the week</li>
            <li className={styles.planItem}>Vocabulary: Numbers</li>
            <li className={`${styles.planItem} ${styles.planActive}`}>Listening</li>
            <li className={styles.planItem}>Grammar: to be affirmative</li>
            <li className={styles.planItem}>Say it right</li>
            <li className={styles.planItem}>Let's talk</li>
            <li className={styles.planItem}>Cool-down</li>
            <li className={styles.planItem} style={{ marginTop: '1rem', color: '#cbd5e1' }}>🏁 Результаты урока</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

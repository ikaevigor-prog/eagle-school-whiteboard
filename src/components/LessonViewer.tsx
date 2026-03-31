import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDataChannel } from '@livekit/components-react';
import styles from './LessonViewer.module.css';
import AppLoader from './AppLoader';
import AudioPlayer from './AudioPlayer';

// Модельные данные упражнения
const QUIZ_ITEMS = [
  { id: 'boy', pic: '👦', label: 'a boy', color: '#bbf7d0' },
  { id: 'girl', pic: '👩‍🦰', label: 'a girl', color: '#fecaca' },
  { id: 'cat', pic: '🐱', label: 'a cat', color: '#e9d5ff' },
  { id: 'dog', pic: '🐶', label: 'a dog', color: '#bfdbfe' },
];

export default function LessonViewer({ videoDock }: { videoDock?: React.ReactNode }) {
  const searchParams = useSearchParams();
  const role = searchParams?.get('role') || 'student';

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
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [dictInput, setDictInput] = useState('');
  const [lessonFinished, setLessonFinished] = useState(false);
  
  // Validation state
  const [hasChecked, setHasChecked] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<Record<string, number>>({});
  
  // Dictionary state
  const [dictionaryWords, setDictionaryWords] = useState<{word: string, translation: string}[]>([]);

  // Inline Exercise 
  const [listenAnswers, setListenAnswers] = useState({ q1: '', q2: '' });

  // ------------------------------------------------------------------
  // LIVEKIT REAL-TIME SYNC
  // ------------------------------------------------------------------
  const isReceivingRef = useRef(false);

  // Broadcast function to be manually called on UI actions
  const broadcastState = (overrideState?: any) => {
    if (isLoading || isReceivingRef.current) return;
    
    const stateSnapshot = overrideState || {
      slots,
      wordBank,
      listenAnswers,
      hasChecked,
      failedAttempts,
      lessonFinished,
      dictionaryWords
    };
    
    try {
      const payloadString = JSON.stringify(stateSnapshot);
      const encoder = new TextEncoder();
      send(encoder.encode(payloadString), { reliable: true });
    } catch (e) {
      console.warn("Sync channel not ready");
    }
  };

  const { send } = useDataChannel('lesson-sync', (msg) => {
    try {
      // Decode payload
      const decoder = new TextDecoder();
      const payload = decoder.decode(msg.payload);
      
      if (payload === 'REQUEST_STATE') {
        // Someone joined and asked for state. Broadcast our current state.
        broadcastState();
        return;
      }

      const data = JSON.parse(payload);
      
      // Prevent echo loop
      isReceivingRef.current = true;
      
      if (data.slots) setSlots(data.slots);
      if (data.wordBank) setWordBank(data.wordBank);
      if (data.listenAnswers) setListenAnswers(data.listenAnswers);
      if (typeof data.hasChecked === 'boolean') setHasChecked(data.hasChecked);
      if (data.failedAttempts) setFailedAttempts(data.failedAttempts);
      if (typeof data.lessonFinished === 'boolean') setLessonFinished(data.lessonFinished);
      
      // Handle Dictionary Words Sync and DB interception
      if (data.dictionaryWords) {
        if (data.dictionaryWords.length > dictionaryWords.length) {
          const newWords = data.dictionaryWords.filter((nw: any) => !dictionaryWords.find(ow => ow.word === nw.word));
          if (role === 'student') {
            newWords.forEach((nw: any) => {
              window.parent.postMessage({ type: 'SAVE_DICTIONARY_WORD', payload: nw }, '*');
            });
          }
        }
        setDictionaryWords(data.dictionaryWords);
      }
      
      // Release lock shortly after React state processes
      setTimeout(() => {
        isReceivingRef.current = false;
      }, 50);
    } catch (e) {
      console.error("Failed to parse sync message", e);
    }
  });

  // When component mounts and finishes loading, ask others for the current state!
  useEffect(() => {
    if (!isLoading) {
      try {
        const encoder = new TextEncoder();
        send(encoder.encode('REQUEST_STATE'), { reliable: true });
      } catch (e) {}
    }
  }, [isLoading, send]);

  // Broadcast ANY state change automatically (unless we are receiving it)
  // To avoid the initial empty state overwriting others, we use an initialized ref.
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return; // Skip first render after loading
    }
    
    if (!isReceivingRef.current) {
      broadcastState();
    }
  }, [slots, wordBank, listenAnswers, hasChecked, failedAttempts, lessonFinished, dictionaryWords]);
  // ------------------------------------------------------------------

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
    setSelectedWord(null);
    let allRight = true;
    
    setFailedAttempts(prev => {
      const newAttempts = { ...prev };
      QUIZ_ITEMS.forEach(q => {
        if (slots[q.id] && slots[q.id] !== q.label) {
          newAttempts[q.id] = (newAttempts[q.id] || 0) + 1;
          allRight = false;
        } else if (slots[q.id] !== q.label) {
          allRight = false; // Empty slot
        }
      });
      return newAttempts;
    });

    setHasChecked(true);
  };

  const handleReset = () => {
    setWordBank(['a boy', 'a girl', 'a cat', 'a dog']);
    setSlots({ boy: null, girl: null, cat: null, dog: null });
    setHasChecked(false);
  };

  const handleAddDictWord = () => {
    if (!dictInput.trim()) return;
    
    let w = dictInput.trim();
    let t = "";
    if (w.includes('-')) {
        const parts = w.split('-');
        w = parts[0].trim();
        t = parts.slice(1).join('-').trim();
    }
    
    if (dictionaryWords.find(dw => dw.word.toLowerCase() === w.toLowerCase())) {
        setDictInput('');
        return; // Exists
    }
    
    const newWord = { word: w, translation: t };
    setDictionaryWords(prev => [...prev, newWord]);
    setDictInput('');

    // If student adds it themselves locally, they save it.
    if (role === 'student') {
        window.parent.postMessage({ type: 'SAVE_DICTIONARY_WORD', payload: newWord }, '*');
    }
  };

  const allFilled = Object.values(slots).every(val => val !== null);

  // 3. RENDERERS
  return (
    <div className={styles.lessonViewer}>
      {/* GLOBAL MOUNT LOADER */}
      <AppLoader show={isLoading} />
      
      {/* Левая панель инструментов */}
      <div className={styles.leftToolbar}>
        <div 
          className={`${styles.toolIcon} ${activeTool === 'dict' ? styles.toolIconActive : ''}`} 
          onClick={() => setActiveTool(activeTool === 'dict' ? null : 'dict')}
        >
          📖
          {activeTool === 'dict' && (
            <div className={styles.toolPopover} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.popoverTitle}>Словарь</h3>
              <div className={styles.dictInputWrap}>
                <input 
                  type="text" 
                  placeholder="Добавить слово (word - translation)" 
                  className={styles.dictInput}
                  value={dictInput}
                  onChange={(e) => setDictInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddDictWord();
                  }}
                />
                <button className={styles.dictAddBtn} onClick={handleAddDictWord}>➔</button>
              </div>
              
              {dictionaryWords.length === 0 ? (
                <>
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                     <div style={{ fontSize: '3rem', opacity: 0.2 }}>A文</div>
                  </div>
                  <div className={styles.dictEmpty}>
                    Добавленных слов еще нет
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {dictionaryWords.map((dw, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{dw.word}</span>
                      {dw.translation && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{dw.translation}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.dictActionWrap}>
                <button className={`${styles.dictBottomBtn} ${styles.gray}`}>Все слова</button>
                <button className={`${styles.dictBottomBtn} ${styles.gray}`}>Учить слова</button>
              </div>
              <button className={styles.primaryWideBtn}>Запуск</button>
            </div>
          )}
        </div>
        <div className={styles.toolIcon}>💬</div>
        <div className={styles.toolIcon}>⭐</div>
        <div className={styles.toolIcon}>⏱</div>
      </div>

      {/* Центральная панель: Упражнения / Контент */}
      <section className={styles.lessonContent}>
        <div className={styles.contentInner}>
          {lessonFinished ? (
            <div className={styles.ratingSection} style={{ marginTop: '4rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h1 style={{ color: '#0f172a', marginBottom: '1rem', fontSize: '2rem' }}>Урок завершен!</h1>
                <p style={{ color: '#64748b' }}>Отличная работа. Вы можете пересмотреть материалы позже.</p>
              </div>
              <h3 className={styles.ratingTitle}>Оцените урок</h3>
              <p className={styles.ratingSubtitle}>Поставьте справедливую оценку, чтобы мы могли начислить баллы вашему преподавателю!</p>
              <div className={styles.starsWrapper}>
                {[1, 2, 3, 4, 5].map(star => (
                   <button key={star} className={styles.starBtn} title={`Оценить на ${star}`}>
                     ★
                   </button>
                ))}
              </div>
            </div>
          ) : (
            <>
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
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div 
                        className={`${styles.dropZoneContainer} ${placedWord ? styles.dropZoneFilled : styles.dropZoneEmpty} ${validationClass}`}
                        style={{ background: '#f8fafc', flex: 1 }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropToSlot(e, item.id)}
                        onClick={() => handleSlotClick(item.id)}
                      >
                        {placedWord && <div className={styles.gripHandleLeft} style={{opacity: 0.5}}>⋮⋮</div>}
                        <div className={styles.dropZoneTarget}>
                          {placedWord || ''}
                        </div>
                        <div className={styles.gripHandleRight} style={{opacity: 0.3}}>⋮⋮</div>
                      </div>
                      
                      {/* Feedback Indicators */}
                      <div style={{ width: '30px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {hasChecked && placedWord === item.label && (
                          <div style={{ width: '4px', height: '24px', background: '#10b981', borderRadius: '4px' }} title="Correct" />
                        )}
                        {failedAttempts[item.id] > 0 && placedWord !== item.label && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {Array.from({ length: Math.min(3, failedAttempts[item.id]) }).map((_, i) => (
                               <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} title="Incorrect attempt" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* AUDIO PLAYER & FILL IN THE GAP */}
            <div className={styles.excHeader} style={{ marginTop: '3rem' }}>
              <div className={styles.excTitleWrap}>
                <span className={styles.excNumber}>1.2</span>
                <h2 className={styles.excTitle}>Listen and write</h2>
              </div>
            </div>

            <AudioPlayer 
              src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
              script="Jay is a doctor. Dan and Jenna are students."
            />

            <div className={styles.inlineExercise}>
              <span>Jay is a</span>
              <div className={styles.inlineInputWrapper} style={{ background: listenAnswers.q1 ? 'white' : '#f8fafc' }}>
                <input 
                  type="text" 
                  className={styles.inlineInput} 
                  value={listenAnswers.q1}
                  onChange={e => setListenAnswers(prev => ({ ...prev, q1: e.target.value }))}
                />
                <div className={styles.gripHandleRight} style={{ opacity: 0.3 }}>⋮⋮</div>
              </div>
              
              <span>. Dan and Jenna are</span>
              <div className={styles.inlineInputWrapper} style={{ background: listenAnswers.q2 ? 'white' : '#f8fafc' }}>
                <input 
                  type="text" 
                  className={styles.inlineInput} 
                  value={listenAnswers.q2}
                  onChange={e => setListenAnswers(prev => ({ ...prev, q2: e.target.value }))}
                />
                <div className={styles.gripHandleRight} style={{ opacity: 0.3 }}>⋮⋮</div>
              </div>
              <span>.</span>
            </div>

          </div>
          </>
          )}
        </div>
      </section>

      {/* Правая панель: План (Sections) и Видео */}
      <aside className={styles.rightSidebar}>
        {/* VIDEO DOCK PROVIDED BY PARENT (page.tsx) */}
        {videoDock}

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
            
            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0.5rem 0' }} />
            
            {!lessonFinished && (
              <li 
                style={{ paddingLeft: '1rem', color: '#94a3b8', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }} 
                onClick={() => setLessonFinished(true)}
              >
                ⚑ Завершить урок
              </li>
            )}
            
            {lessonFinished && (
              <li className={`${styles.planItem} ${styles.planActive}`}>🏁 Результаты урока</li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

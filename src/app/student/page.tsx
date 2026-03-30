'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BookOpen, BrainCircuit, History, Settings, LogOut, 
  Sparkles, Calendar, Loader2, Library
} from 'lucide-react';
import styles from './page.module.css';

type VocabularyItem = {
  id: string;
  concept: string;
  session_id: string;
  created_at: string;
};

export default function StudentDashboard() {
  const [data, setData] = useState<{ [key: string]: VocabularyItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [flippedCards, setFlippedCards] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const fetchVocabulary = async () => {
      try {
        const { data: items, error } = await supabase
          .from('student_vocabulary')
          .select('*')
          .eq('student_id', 'guest')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by session_id
        const grouped = (items || []).reduce((acc: any, item: VocabularyItem) => {
          if (!acc[item.session_id]) acc[item.session_id] = [];
          acc[item.session_id].push(item);
          return acc;
        }, {});

        setData(grouped);
      } catch (err) {
        console.error("Failed to fetch vocabulary", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVocabulary();
  }, []);

  const toggleCard = (id: string) => {
    setFlippedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navItems = [
    { icon: <BrainCircuit size={20} />, label: 'My Flashcards', active: true },
    { icon: <History size={20} />, label: 'Lesson History', active: false },
    { icon: <Library size={20} />, label: 'Grammar Library', active: false },
  ];

  return (
    <div className={styles.container}>
      {/* Glassmorphism Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.logo}>
          <Sparkles color="#3b82f6" fill="#3b82f6" />
          Eagle School
        </div>
        
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {navItems.map((item, idx) => (
            <div key={idx} className={`${styles.navItem} ${item.active ? styles.active : ''}`}>
              {item.icon} {item.label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className={styles.navItem}><Settings size={20} /> Settings</div>
          <div className={styles.navItem} style={{ color: '#ef4444' }}><LogOut size={20} /> Sign Out</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.main}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.pageTitle}>Welcome back, Student 👋</h1>
          <p className={styles.pageSubtitle}>Here are the words and mistakes we captured during your recent live sessions.</p>

          {loading ? (
            <div className={styles.loading}>
              <Loader2 className="animate-spin" size={32} /> Syncing your brain...
            </div>
          ) : Object.keys(data).length === 0 ? (
            <div className={styles.emptyState}>
              <BookOpen className={styles.emptyStateIcon} />
              <h3>No vocabulary found</h3>
              <p style={{ marginTop: '0.5rem' }}>Complete a live lesson with your teacher to see your extracted words here!</p>
            </div>
          ) : (
            // Render Grouped Sessions
            Object.entries(data).map(([sessionId, items]) => (
              <div key={sessionId} className={styles.sessionCard}>
                <div className={styles.sessionHeader}>
                  <div className={styles.sessionTitle}>
                    <Calendar size={24} color="#a855f7" />
                    {sessionId}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                    {items.length} words
                  </div>
                </div>

                <div className={styles.wordGrid}>
                  {items.map((word) => (
                    <div 
                      key={word.id} 
                      className={`${styles.flashcard} ${flippedCards[word.id] ? styles.flipped : ''}`}
                      onClick={() => toggleCard(word.id)}
                    >
                      <div className={styles.innerCard}>
                        {/* Front: The raw extracted text from the whiteboard */}
                        <div className={styles.front}>
                          {word.concept}
                        </div>
                        {/* Back: Placeholder for AI translation or corrections */}
                        <div className={styles.back}>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                              AI Note:
                            </span>
                            To be analyzed by AI...
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

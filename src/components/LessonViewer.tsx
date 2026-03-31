'use client';

import React from 'react';
import styles from './LessonViewer.module.css';

export default function LessonViewer() {
  return (
    <div className={styles.lessonViewer}>
      {/* Левая панель инструментов (как в платформе) */}
      <div className={styles.leftToolbar}>
        <div className={styles.toolIcon}>👥</div>
        <div className={styles.toolIcon}>💬</div>
        <div className={styles.toolIcon}>⭐</div>
        <div className={styles.toolIcon}>⏱</div>
      </div>

      {/* Центральная панель: Упражнения / Контент */}
      <section className={styles.lessonContent}>
        <h1 className={styles.lessonMainTitle}>Warm-up</h1>
        
        <div className={styles.exerciseBlock}>
          <div className={styles.excHeader}>
            <span className={styles.excNumber}>1.1</span>
            <h2 className={styles.excTitle}>Match the words with the pictures</h2>
          </div>
          
          {/* Демо-элементы Drag & Drop (Слова) */}
          <div className={styles.wordBank}>
            <span className={styles.draggableWord}>a boy</span>
            <span className={styles.draggableWord}>a girl</span>
            <span className={styles.draggableWord}>a cat</span>
            <span className={styles.draggableWord}>a dog</span>
          </div>

          {/* Картинки для маппинга */}
          <div className={styles.picsGrid}>
            <div className={styles.picItem}>
              <div className={styles.picPlaceholder} style={{ background: '#fecaca' }}>👩‍🦰</div>
              <div className={styles.dropZone}>a girl</div>
            </div>
            <div className={styles.picItem}>
              <div className={styles.picPlaceholder} style={{ background: '#bbf7d0' }}>👦</div>
              <div className={styles.dropZoneEmpty}></div>
            </div>
            <div className={styles.picItem}>
              <div className={styles.picPlaceholder} style={{ background: '#bfdbfe' }}>🐶</div>
              <div className={styles.dropZone}>a dog</div>
            </div>
            <div className={styles.picItem}>
              <div className={styles.picPlaceholder} style={{ background: '#e9d5ff' }}>🐱</div>
              <div className={styles.dropZoneEmpty}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Правая панель: План (Sections) */}
      <aside className={styles.rightSidebar}>
        <div className={styles.sectionsBlock}>
          <h3 className={styles.sidebarTitle}>Sections</h3>
          <ul className={styles.planList}>
            <li className={`${styles.planItem} ${styles.planActive}`}>✓ Warm-up</li>
            <li className={styles.planItem}>Listening and Speaking</li>
            <li className={styles.planItem}>Grammar</li>
            <li className={styles.planItem}>Vocabulary</li>
            <li className={styles.planItem}>Pronunciation</li>
            <li className={styles.planItem}>Speaking</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

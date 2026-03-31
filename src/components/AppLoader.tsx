'use client';

import React from 'react';
import styles from './AppLoader.module.css';

interface AppLoaderProps {
  show: boolean;
}

export default function AppLoader({ show }: AppLoaderProps) {
  if (!show) return null;

  return (
    <div className={`${styles.appLoader} ${show ? styles.show : styles.hide}`}>
      <div className={styles.loaderLogoWrap}>
        <div className={styles.loaderOrbit}></div>
        <div className={styles.loaderLogo}>
          {/* User provided img src: "/miniapp/assets/logo.png?v=2" */}
          {/* Using a fallback approach if image not found */}
          <img 
            src="/miniapp/assets/logo.png?v=2" 
            alt="Eagle School" 
            className={styles.loaderLogoImg}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              if ((e.target as HTMLImageElement).nextElementSibling) {
                 ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.display = 'block';
              }
            }}
          />
          <div className={styles.fallbackLogo} style={{ display: 'none', fontSize: '32px' }}>🦅</div>
        </div>
      </div>
      <div className={styles.loaderTitle}>Eagle School</div>
      <div className={styles.loaderSubtitle}>Загружаем личный кабинет</div>
    </div>
  );
}

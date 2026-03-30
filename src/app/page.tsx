'use client';

import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();

  const requestPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Redirect to test board upon success
      router.push('/room/test-course-101?token=demo');
    } catch (e) {
      alert("Hardware permission denied. Please check your browser settings.");
    }
  };

  return (
    <main className={styles.container}>
      <div className={`${styles.darkGlass} ${styles.card}`}>
        <h1>Eagle School Virtual Class</h1>
        <p>Access denied. Please enter this classroom securely through your main Account dashboard.</p>
        <div className={styles.buttonGroup}>
          <a href="https://app.eagle-school.com" className={styles.button}>Return to Account</a>
          <button onClick={requestPermissions} className={styles.secondaryBtn}>Give permissions</button>
        </div>
      </div>
    </main>
  );
}

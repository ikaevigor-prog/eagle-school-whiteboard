'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './AudioPlayer.module.css';
import { Play, Pause, Volume2, VolumeX, Settings, Eye, EyeOff } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  script?: string;
}

export default function AudioPlayer({ src, script }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.playerContainer}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className={styles.controlsRow}>
        <button className={styles.playBtn} onClick={togglePlay}>
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>

        <button className={styles.volBtn} onClick={toggleMute}>
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <div className={styles.timelineWrapper}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleProgressChange}
            className={styles.timeline}
          />
        </div>

        <div className={styles.timeInfo}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {script && (
          <button 
            className={styles.toggleScriptBtn} 
            onClick={() => setShowScript(!showScript)}
            title="Показать текст"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: showScript ? '#38bdf8' : '#cbd5e1' }}
          >
            {showScript ? <EyeOff size={16} /> : <Eye size={16} />}
            <span style={{ fontWeight: 500 }}>Текст</span>
          </button>
        )}

        <button className={styles.settingsBtn} title="Настройки воспроизведения">
          <Settings size={18} />
        </button>
      </div>

      {script && (
        <div className={`${styles.scriptContent} ${showScript ? styles.scriptVisible : ''}`} style={{ marginTop: showScript ? '1rem' : 0 }}>
          {script}
        </div>
      )}
    </div>
  );
}

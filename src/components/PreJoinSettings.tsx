"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, Video, Volume2, X, CheckCircle, Smartphone } from "lucide-react";
import styles from "./PreJoinSettings.module.css";

interface Device {
  deviceId: string;
  label: string;
}

interface PreJoinSettingsProps {
  onJoin: (camera: string, mic: string, speaker: string) => void;
  onCancel: () => void;
}

export default function PreJoinSettings({ onJoin, onCancel }: PreJoinSettingsProps) {
  const [activeTab, setActiveTab] = useState<"video" | "transcription">("video");
  
  // Device lists
  const [cameras, setCameras] = useState<Device[]>([]);
  const [mics, setMics] = useState<Device[]>([]);
  const [speakers, setSpeakers] = useState<Device[]>([]);

  // Selected Device IDs
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  const [hasPermissions, setHasPermissions] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // 1. Ask for generic permission to unlock device labels
    const getPermissionsAndDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasPermissions(true);
        stream.getTracks().forEach(t => t.stop()); // Stop immediately, we just needed prompt
        
        await loadDevices();
      } catch (err) {
        console.error("User denied permission", err);
        // Might still try to load devices if they had previously granted them
        await loadDevices();
      }
    };

    getPermissionsAndDevices();

    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
      stopStream(); // cleanup
    };
  }, []);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoInputs = devices.filter((d) => d.kind === "videoinput").map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0,5)}` }));
      const audioInputs = devices.filter((d) => d.kind === "audioinput").map(d => ({ deviceId: d.deviceId, label: d.label || `Mirco ${d.deviceId.slice(0,5)}` }));
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput").map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0,5)}` }));
      
      setCameras(videoInputs);
      setMics(audioInputs);
      setSpeakers(audioOutputs);

      if (videoInputs.length && !selectedCamera) setSelectedCamera(videoInputs[0].deviceId);
      if (audioInputs.length && !selectedMic) setSelectedMic(audioInputs[0].deviceId);
      if (audioOutputs.length && !selectedSpeaker) setSelectedSpeaker(audioOutputs[0].deviceId);
    } catch (err) {
      console.error("Error enumerating devices", err);
    }
  };

  // 2. Play video preview when selected camera changes
  useEffect(() => {
    if (!selectedCamera) return;
    
    const startPreview = async () => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedCamera } },
          audio: false
        });
        currentStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Could not start video preview", err);
      }
    };
    startPreview();
    
    // Cleanup on unmount or re-run
    return () => stopStream();
  }, [selectedCamera]);

  const stopStream = () => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((track) => track.stop());
      currentStreamRef.current = null;
    }
  };

  // 3. Testing sound snippet
  const playTestSound = () => {
    if (isTesting) return;
    setIsTesting(true);
    
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // If speaker is selected, we try to route the audio element output (AudioContext setSinkId is experimental)
      // Standard HTML5 Audio fallback
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      
      // Some browsers support setting the output device directly
      if (selectedSpeaker && typeof (audio as any).setSinkId === "function") {
        (audio as any).setSinkId(selectedSpeaker).catch((e: any) => console.log('setSinkId not supported', e));
      }

      audio.play();
      audio.onended = () => setIsTesting(false);
      setTimeout(() => setIsTesting(false), 2000); // Fail-safe
    } catch (e) {
      console.error(e);
      setIsTesting(false);
    }
  };

  const handleJoin = () => {
    stopStream();
    onJoin(selectedCamera, selectedMic, selectedSpeaker);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Modal Header */}
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.closeBtn} onClick={onCancel}><X size={24} /></button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === "video" ? styles.tabActive : ""}`} 
            onClick={() => setActiveTab("video")}
          >
            <Video size={18} /> Video & audio
          </button>
          <button 
            className={`${styles.tab} ${activeTab === "transcription" ? styles.tabActive : ""}`} 
            onClick={() => setActiveTab("transcription")}
          >
            <Smartphone size={18} /> Transcription
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === "video" && (
            <div className={styles.videoTab}>
              <div className={styles.leftCol}>
                <div className={styles.videoPreviewArea}>
                  {hasPermissions ? (
                    <video ref={videoRef} autoPlay playsInline muted className={styles.videoElement} />
                  ) : (
                    <div className={styles.noCamera}>
                      <span>Allow Camera & Microphone Access</span>
                    </div>
                  )}
                </div>
                <button className={styles.testBtn} onClick={playTestSound} disabled={isTesting}>
                  Test devices
                </button>
              </div>
              
              <div className={styles.rightCol}>
                <div className={styles.formGroup}>
                  <label>Camera</label>
                  <div className={styles.selectWrapper}>
                    <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
                      {cameras.length === 0 && <option value="">No cameras found</option>}
                      {cameras.map((c) => (
                        <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Microphone</label>
                  <div className={styles.deviceRow}>
                    <div className={styles.selectWrapper} style={{ flex: 1 }}>
                      <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
                        {mics.length === 0 && <option value="">No microphones found</option>}
                        {mics.map((m) => (
                          <option key={m.deviceId} value={m.deviceId}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.levelIndicator}>
                       {/* Animated mock bars */}
                       <div className={styles.bar}></div>
                       <div className={styles.bar}></div>
                       <div className={styles.bar}></div>
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Speakers</label>
                  <div className={styles.deviceRow}>
                    <div className={styles.selectWrapper} style={{ flex: 1 }}>
                      <select value={selectedSpeaker} onChange={(e) => setSelectedSpeaker(e.target.value)}>
                        {speakers.length === 0 ? <option value="default">Default System Speakers</option> : null}
                        {speakers.map((s) => (
                          <option key={s.deviceId} value={s.deviceId}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.levelIndicator}>
                       <Volume2 size={20} color="#000" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "transcription" && (
            <div className={styles.transcriptionTab}>
              <div className={styles.transcriptionItem}>
                <CheckCircle size={24} className={styles.checkIcon} color="#000" />
                <span>Your video is never recorded, only speech is analyzed</span>
              </div>
              <div className={styles.transcriptionItem}>
                <CheckCircle size={24} className={styles.checkIcon} color="#000" />
                <span>Your data is securely processed and encrypted</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.joinBtn} onClick={handleJoin} disabled={!hasPermissions}>
            Join Classroom
          </button>
        </div>
      </div>
    </div>
  );
}

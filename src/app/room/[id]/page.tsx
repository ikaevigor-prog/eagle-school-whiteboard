'use client';

import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Rnd } from 'react-rnd';
import { Mic, Camera, ShieldAlert } from 'lucide-react';
import styles from './room.module.css';

// LiveKit Integrations
import { Track } from 'livekit-client';
import { LiveKitRoom, RoomAudioRenderer, ParticipantTile, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';

// Dynamically import Konva Whiteboard (no SSR since it uses window objects)
const CustomBoard = dynamic(() => import('@/components/Whiteboard'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Initializing Advanced Engine...</div>,
});


// Sub-component to extract Participants and render their grids dynamically
function ActiveVideoFeeds({ showTeacher, showStudent }: { showTeacher: boolean, showStudent: boolean }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  // Find exact identities based on /api/livekit issuance
  const teacherTrack = tracks.find(t => t.participant.identity === 'Teacher');
  const studentTrack = tracks.find(t => t.participant.identity !== 'Teacher');

  return (
    <>
      <RoomAudioRenderer />
      
      {showTeacher && teacherTrack && (
        <Rnd
          default={{ x: window.innerWidth - 320, y: 20, width: 300, height: 169 }}
          minWidth={150} minHeight={84} bounds="parent"
          className={styles.draggableVideo}
        >
          <ParticipantTile 
            trackRef={teacherTrack} 
            style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }} 
          />
        </Rnd>
      )}

      {showStudent && studentTrack && (
        <Rnd
          default={{ x: window.innerWidth - 320, y: 210, width: 300, height: 169 }}
          minWidth={150} minHeight={84} bounds="parent"
          className={styles.draggableVideo}
        >
          <ParticipantTile 
            trackRef={studentTrack} 
            style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }} 
          />
        </Rnd>
      )}
    </>
  );
}


export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const role = searchParams.get('role') || 'teacher';
  
  const [hasConsented, setHasConsented] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [token, setToken] = useState("");

  // Toggles for video visibility
  const [showTeacher, setShowTeacher] = useState(true);
  const [showStudent, setShowStudent] = useState(true);

  // Authenticate and grab LiveKit Protocol JWT token
  useEffect(() => {
    if (!hasConsented) return;
    
    fetch(`/api/livekit?room=${roomId}&role=${role}`)
      .then(res => res.json())
      .then(data => {
        if (data.token) setToken(data.token);
        else alert("Failed to connect to LiveKit servers! Did you add the ENV variables?");
      })
      .catch((e) => alert("Token generator unreachable. Server logs might indicate missing ENV vars."));
  }, [hasConsented, roomId, role]);


  const requestHardwareAccess = async () => {
    try {
      setPermissionError(false);
      // Pre-warm Camera hardware constraints before handing off to LiveKit
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setHasConsented(true);
    } catch (e) {
      setPermissionError(true);
    }
  };

  // Hardware Onboarding Modal (Glassmorphism overlap)
  if (!hasConsented) {
    return (
      <main className={styles.modalBackground}>
        <div className={`glass ${styles.consentCard}`}>
          <div className={styles.alertIconBlock}>
            <ShieldAlert size={48} color="#FF5722" />
          </div>

          {!permissionError ? (
            <>
              <h1 style={{ color: '#005568' }}>Classroom Recording</h1>
              <p>
                Welcome to Eagle School. For quality assurance and advanced AI post-class feedback analysis, 
                <strong> audio and video may be recorded during this session.</strong>
              </p>
              <div className={styles.permissionButtons}>
                <button className={styles.primaryBtn} onClick={requestHardwareAccess}>
                  <Mic size={18} /> Allow Hardware & Join
                </button>
                <button className={styles.secondaryBtn} onClick={() => router.push('/')}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ color: '#FF5722' }}>Access Denied</h1>
              <p>
                Eagle School requires microphone and camera access to conduct virtual classes. 
                Please grant permission in your browser settings.
              </p>
              <div className={styles.permissionButtons}>
                <button className={styles.primaryBtn} onClick={requestHardwareAccess}>
                  Try Again
                </button>
                <button className={styles.secondaryBtn} onClick={() => setHasConsented(true)}>
                  Continue without Media
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  if (!token) {
    return <div className={styles.loading}>Connecting to WebRTC Tunnel...</div>;
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <main className={styles.roomContainer}>
        <div className={styles.whiteboardArea}>
          <CustomBoard 
            role={role as 'teacher' | 'student'}
            showTeacher={showTeacher}
            showStudent={showStudent}
            onToggleTeacher={() => setShowTeacher(!showTeacher)}
            onToggleStudent={() => setShowStudent(!showStudent)}
          />
        </div>
        
        {/* Dynamic LiveKit Video Feeds directly overlaying the Whiteboard */}
        <ActiveVideoFeeds showTeacher={showTeacher} showStudent={showStudent} />

        {/* Top Right Session Controls Corner */}
        <div className={styles.bottomControls}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {role === 'teacher' && (
              <button 
                className={styles.leaveBtn} 
                style={{ background: '#005568', color: 'white', border: 'none' }}
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('role', 'student');
                  navigator.clipboard.writeText(url.toString());
                  alert('Student Link Copied! Opening in new tab for testing...');
                  window.open(url.toString(), '_blank');
                }}
              >
                Invite Student
              </button>
            )}
            <button 
              className={styles.leaveBtn} 
              style={{ background: '#0f172a', border: 'none' }}
              onClick={() => router.push('/')}
            >
              Leave Class
            </button>
          </div>
        </div>
      </main>
    </LiveKitRoom>
  );
}

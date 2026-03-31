'use client';

import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Rnd } from 'react-rnd';
import { Mic, Camera, ShieldAlert } from 'lucide-react';
import styles from './room.module.css';
import PreJoinSettings from '@/components/PreJoinSettings';
import LessonViewer from '@/components/LessonViewer';

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
          style={{ zIndex: 50 }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{
               position: 'absolute', top: 8, left: 8, zIndex: 10, background: 'rgba(0,0,0,0.6)',
               color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
               backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '6px',
               border: '1px solid rgba(255,255,255,0.1)'
            }}>
               <span style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>T</span> Teacher
            </div>
            <ParticipantTile 
              trackRef={teacherTrack} 
              style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', outline: 'none' }} 
            />
          </div>
        </Rnd>
      )}

      {showStudent && studentTrack && (
        <Rnd
          default={{ x: window.innerWidth - 320, y: 210, width: 300, height: 169 }}
          minWidth={150} minHeight={84} bounds="parent"
          className={styles.draggableVideo}
          style={{ zIndex: 50 }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{
               position: 'absolute', top: 8, left: 8, zIndex: 10, background: 'rgba(0,0,0,0.6)',
               color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
               backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '6px',
               border: '1px solid rgba(255,255,255,0.1)'
            }}>
               <span style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>S</span> Student
            </div>
            <div style={{ 
               width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', 
               outline: '3px solid #8b5cf6', outlineOffset: '-3px', boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' 
            }}>
               <ParticipantTile trackRef={studentTrack} style={{ width: '100%', height: '100%', outline: 'none' }} />
            </div>
          </div>
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
  const autoJoin = searchParams.get('autoJoin') === 'true';
  
  const [joinStep, setJoinStep] = useState<0 | 1 | 2>(autoJoin ? 2 : 0);
  const [permissionError, setPermissionError] = useState(false);
  const [token, setToken] = useState("");
  const [viewMode, setViewMode] = useState<'lesson' | 'whiteboard'>('lesson');
  
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");

  // Toggles for video visibility
  const [showTeacher, setShowTeacher] = useState(true);
  const [showStudent, setShowStudent] = useState(true);

  // Authenticate and grab LiveKit Protocol JWT token
  useEffect(() => {
    if (joinStep !== 2) return;
    
    fetch(`/api/livekit?room=${roomId}&role=${role}`)
      .then(res => res.json())
      .then(data => {
        if (data.token) setToken(data.token);
        else alert("Failed to connect to LiveKit servers! Did you add the ENV variables?");
      })
      .catch((e) => alert("Token generator unreachable. Server logs might indicate missing ENV vars."));
  }, [joinStep, roomId, role]);


  const requestHardwareAccess = async () => {
    try {
      setPermissionError(false);
      // Pre-warm Camera hardware constraints before handing off to LiveKit
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Stop the stream immediately, PreJoinSettings will request it again to render the preview
      stream.getTracks().forEach(t => t.stop());
      setJoinStep(1); // Proceed to Preview Window
    } catch (e) {
      setPermissionError(true);
    }
  };

  // Step 0: Hardware Onboarding Modal (Friendly Permission Request)
  if (joinStep === 0) {
    return (
      <main className={styles.modalBackground}>
        <div className={`glass ${styles.consentCard}`} style={{ maxWidth: '500px', padding: '40px', textAlign: 'center' }}>
          <div className={styles.alertIconBlock} style={{ background: 'rgba(249, 115, 22, 0.1)', padding: '20px', borderRadius: '50%', display: 'inline-block', marginBottom: '24px' }}>
            <Camera size={48} color="#f97316" />
          </div>

          <h1 style={{ color: '#0f172a', fontSize: '24px', marginBottom: '16px' }}>Ready to join the class?</h1>
          
          {!permissionError ? (
            <>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                Eagle School needs access to your camera and microphone to connect you with your teacher. 
                Your browser will ask for permission on the next step.
              </p>
              <div className={styles.permissionButtons} style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button className={styles.secondaryBtn} onClick={() => router.push('/')} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button className={styles.primaryBtn} onClick={requestHardwareAccess} style={{ flex: 2, background: '#f97316', color: 'white' }}>
                  <ShieldAlert size={18} /> Enable Camera & Mic
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ color: '#ef4444', fontSize: '20px', marginTop: '-10px', marginBottom: '16px' }}>Access Denied</h1>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                We couldn't access your camera or microphone. Please click the lock icon 🔒 next to the URL bar in your browser to grant permissions, then try again.
              </p>
              <div className={styles.permissionButtons} style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button className={styles.primaryBtn} onClick={requestHardwareAccess} style={{ flex: 1, background: '#0f172a' }}>
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  // Step 1: Preview Settings Window
  if (joinStep === 1) {
    return (
      <main className={styles.modalBackground}>
        <PreJoinSettings 
          onJoin={(cam, mic, speaker) => {
            setSelectedCamera(cam);
            setSelectedMic(mic);
            setJoinStep(2); // Finally enter the class
          }}
          onCancel={() => setJoinStep(0)}
        />
      </main>
    );
  }

  if (!token) {
    return <div className={styles.loading}>Connecting to WebRTC Tunnel...</div>;
  }

  return (
    <LiveKitRoom
      video={selectedCamera ? { deviceId: selectedCamera } : true}
      audio={selectedMic ? { deviceId: selectedMic } : true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <main className={styles.roomContainer}>
        {/* TOP TOGGLE */}
        <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', gap: '8px', background: 'white', padding: '6px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <button 
            onClick={() => setViewMode('lesson')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: viewMode === 'lesson' ? '#f1f5f9' : 'transparent', fontWeight: viewMode === 'lesson' ? 600 : 500, color: viewMode === 'lesson' ? '#0f172a' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px' }}
          >
            📋 Материалы (Урок)
          </button>
          <button 
            onClick={() => setViewMode('whiteboard')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: viewMode === 'whiteboard' ? '#f1f5f9' : 'transparent', fontWeight: viewMode === 'whiteboard' ? 600 : 500, color: viewMode === 'whiteboard' ? '#0f172a' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px' }}
          >
            🖍 Интерактивная доска
          </button>
        </div>

        <div className={styles.whiteboardArea} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          {viewMode === 'whiteboard' ? (
            <CustomBoard 
              role={role as 'teacher' | 'student'}
              showTeacher={showTeacher}
              showStudent={showStudent}
              onToggleTeacher={() => setShowTeacher(!showTeacher)}
              onToggleStudent={() => setShowStudent(!showStudent)}
            />
          ) : (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: '75px', background: '#f8fafc', overflow: 'hidden' }}>
              <LessonViewer />
            </div>
          )}
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

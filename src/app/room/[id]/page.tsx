'use client';

import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Rnd } from 'react-rnd';
import { Mic, Camera, ShieldAlert, PhoneCall, X } from 'lucide-react';
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

// Sub-component to render docked videos for LessonViewer
function DockedVideoFeeds() {
  const [isSwapped, setIsSwapped] = useState(false);
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  
  const teacherTrack = tracks.find(t => t.participant.identity === 'Teacher');
  const studentTrack = tracks.find(t => t.participant.identity !== 'Teacher');

  // By default, Student is Main (if present), Teacher is Sub. If swapped, Teacher is Main.
  let mainTrack = studentTrack || teacherTrack;
  let subTrack = mainTrack === studentTrack ? teacherTrack : null;

  if (isSwapped && teacherTrack && studentTrack) {
    mainTrack = teacherTrack;
    subTrack = studentTrack;
  }

  if (!teacherTrack && !studentTrack) {
    return (
      <div className="videoDockPlaceholder" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '2rem 1rem', textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
          <PhoneCall size={24} color="#10b981" />
        </div>
        <div style={{ color: '#475569', fontWeight: 500, fontSize: '0.95rem', marginBottom: '1rem' }}>В этом классе идет звонок</div>
        <button style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>Подключиться</button>
      </div>
    );
  }

  return (
    <div className="videoDockActive" style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', aspectRatio: '4/3', background: '#1e293b', position: 'relative' }}>
        {mainTrack && (
          <ParticipantTile 
            trackRef={mainTrack} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        )}
        {subTrack && (
          <div 
             onClick={() => setIsSwapped(!isSwapped)}
             style={{ 
               position: 'absolute', bottom: 12, right: 12, width: '35%', aspectRatio: '4/3', 
               borderRadius: '10px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.85)', 
               boxShadow: '0 8px 20px rgba(0,0,0,0.4)', background: '#1e293b', 
               cursor: 'pointer', transition: 'transform 0.2s', zIndex: 10 
             }}
             title="Поменять местами видео"
             onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <ParticipantTile 
              trackRef={subTrack} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} 
            />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
        <div>👥 2</div>
        <div>🎤 0</div>
      </div>
    </div>
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

  // Authenticate and grab LiveKit Protocol JWT token immediately on mount
  useEffect(() => {
    fetch(`/api/livekit?room=${roomId}&role=${role}`)
      .then(res => res.json())
      .then(data => {
        if (data.token) setToken(data.token);
        else console.warn("Failed to connect to LiveKit servers! Did you add the ENV variables?");
      })
      .catch((e) => console.warn("Token generator unreachable. Server logs might indicate missing ENV vars."));
  }, [roomId, role]);

  const requestHardwareAccess = async () => {
    try {
      setPermissionError(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(t => t.stop());
      setJoinStep(1); 
    } catch (e) {
      setPermissionError(true);
    }
  };

  if (!token) {
    return <div className={styles.loading}>Connecting to WebRTC Tunnel...</div>;
  }

  return (
    <LiveKitRoom
      video={selectedCamera ? { deviceId: selectedCamera } : true}
      audio={selectedMic ? { deviceId: selectedMic } : true}
      token={token}
      connect={joinStep === 2}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <main className={styles.roomContainer}>
        {/* OVERLAYS FOR PRE-JOIN (MODALS) */}
        {joinStep < 2 && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {joinStep === 0 && (
              <div className={`glass ${styles.consentCard}`} style={{ maxWidth: '400px', background: 'white', padding: '32px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                <div style={{ background: '#ecfdf5', width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/miniapp/assets/logo.png?v=2" alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://i.pravatar.cc/150?u=a042581f4e29026704d'; }} />
                </div>
                <h2 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>Входящий звонок</h2>
                <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '24px' }}>Anna приглашает вас к звонку в класс</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => router.push('/')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#f43f5e', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Отклонить</button>
                  <button onClick={requestHardwareAccess} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Подключиться</button>
                </div>
              </div>
            )}
            
            {joinStep === 1 && (
              <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxWidth: '600px', width: '90%' }}>
                <PreJoinSettings 
                  onJoin={(cam, mic) => {
                    setSelectedCamera(cam);
                    setSelectedMic(mic);
                    setJoinStep(2);
                  }}
                  onCancel={() => setJoinStep(0)}
                />
              </div>
            )}
          </div>
        )}
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
              <LessonViewer videoDock={<DockedVideoFeeds />} />
            </div>
          )}
        </div>
        
        {/* Dynamic LiveKit Video Feeds overlaying the Whiteboard ONLY */}
        {viewMode === 'whiteboard' && <ActiveVideoFeeds showTeacher={showTeacher} showStudent={showStudent} />}

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

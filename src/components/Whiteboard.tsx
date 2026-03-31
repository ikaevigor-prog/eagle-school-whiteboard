'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Circle, Group, Text, Image as KonvaImage } from 'react-konva';
import { Html } from 'react-konva-utils';
import {
  MousePointer2, Pen, Eraser, Square, Circle as CircleIcon,
  Video, VideoOff, Music, FileVideo, Save, BookOpen, X, Trash2, StickyNote, Play, Pause, BookmarkCheck, Type, Image as ImageIcon, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ToolType = 'select' | 'pen' | 'eraser' | 'rect' | 'circle' | 'sticky' | 'text';

type StrokeElement = { type: 'stroke'; id: string; points: number[]; color: string; width: number; tool: 'pen' | 'eraser' };
type RectElement = { type: 'rect'; id: string; x: number; y: number; width: number; height: number; fill: string };
type CircleElement = { type: 'circle'; id: string; x: number; y: number; radius: number; fill: string };
type MediaElement = {
  type: 'media'; id: string; x: number; y: number; url: string; mediaType: 'audio' | 'video';
  isPlaying?: boolean; progress?: number; playbackRate?: number;
};
type StickyElement = { type: 'sticky'; id: string; x: number; y: number; text: string; color: string };
type TextElement = { type: 'text'; id: string; x: number; y: number; text: string; color: string; fontSize: number };
type FrameElement = { type: 'frame'; id: string; x: number; y: number; width: number; height: number; title: string };
type ImageElement = { type: 'image'; id: string; x: number; y: number; width: number; height: number; url: string; };

export type BoardElement = StrokeElement | RectElement | CircleElement | MediaElement | StickyElement | TextElement | FrameElement | ImageElement;

interface CustomBoardProps {
  role?: 'teacher' | 'student';
  showTeacher: boolean;
  showStudent: boolean;
  onToggleTeacher: () => void;
  onToggleStudent: () => void;
}

interface Lesson {
  id: string;
  course: string;
  level: string;
  title: string;
  board_state: BoardElement[];
}

const ROOM_ID = 'test-course-101'; // Hardcoded for this demo

const PRESET_COLORS = [
  '#000000', '#ef4444',
  '#f97316', '#22c55e',
  '#3b82f6', '#a855f7',
  '#ec4899', '#ffffff'
];

// --- Native Image Loader Component ---
function URLImage({ element, isSelected, tool, onSelect, onDragEnd, onResize }: any) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = 'Anonymous';
    image.src = element.url;
    image.addEventListener('load', () => setImg(image));
  }, [element.url]);

  return (
    <Group x={element.x} y={element.y} draggable={tool === 'select'} onDragEnd={onDragEnd} onMouseDown={onSelect} onTap={onSelect}>
      <KonvaImage image={img || undefined} width={element.width} height={element.height} stroke={isSelected ? '#3b82f6' : 'transparent'} strokeWidth={4} cornerRadius={8} perfectDrawEnabled={false} />
      {isSelected && tool === 'select' && (
        <Circle
          x={element.width} y={element.height} radius={12} fill="#3b82f6" stroke="#ffffff" strokeWidth={3}
          draggable
          onDragMove={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(50, e.target.x());
            const newHeight = Math.max(50, e.target.y());
            onResize(newWidth, newHeight, false);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(50, e.target.x());
            const newHeight = Math.max(50, e.target.y());
            onResize(newWidth, newHeight, true);
          }}
          onMouseEnter={e => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'nwse-resize';
          }}
          onMouseLeave={e => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
      )}
    </Group>
  );
}

// --- Custom Audio Player deeply synced to Global State ---
function CustomAudioPlayer({ element, onUpdate }: { element: MediaElement, onUpdate: (updates: Partial<MediaElement>) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Local reactive states mapped from props on mount, but heavily controlled by incoming syncs
  const [isPlaying, setIsPlaying] = useState(element.isPlaying || false);
  const [progress, setProgress] = useState(element.progress || 0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(element.playbackRate || 1);

  // Bind local audio node callbacks
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setProgress(audio.currentTime);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      onUpdate({ isPlaying: false, progress: 0 }); // Signal end of track to class
    });

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    }
  }, [onUpdate]);

  // Sync incoming API payloads (The Student's reaction to Teacher's play command)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Hard Sync: Playback status
    if (element.isPlaying !== undefined && element.isPlaying !== isPlaying) {
      if (element.isPlaying) {
        audio.play().catch(e => console.error("Sync Play Blocked:", e));
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    }

    // Hard Sync: Network forced playback speed
    if (element.playbackRate && element.playbackRate !== speed) {
      audio.playbackRate = element.playbackRate;
      setSpeed(element.playbackRate);
    }

    // Hard Sync: Timeline scrubbing (Only snap if difference is > 2 seconds to avoid stutter)
    if (element.progress !== undefined && Math.abs(audio.currentTime - element.progress) > 2) {
      audio.currentTime = element.progress;
      setProgress(element.progress);
    }
  }, [element.isPlaying, element.playbackRate, element.progress]);

  // Local Actions (Triggering API Payloads)
  const togglePlay = () => {
    const newPlaying = !isPlaying;
    if (newPlaying) audioRef.current?.play().catch(() => { });
    else audioRef.current?.pause();

    setIsPlaying(newPlaying);
    onUpdate({ isPlaying: newPlaying, progress: audioRef.current?.currentTime });
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;

    if (audioRef.current) audioRef.current.currentTime = newTime;
    setProgress(newTime);
    onUpdate({ progress: newTime, isPlaying }); // Broadcast scrubbing location
  };

  const changeSpeed = (s: number) => {
    if (audioRef.current) audioRef.current.playbackRate = s;
    setSpeed(s);
    onUpdate({ playbackRate: s });
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff',
      padding: '8px 20px', borderRadius: '30px', width: '480px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)', color: '#0f172a', fontFamily: 'inherit',
      pointerEvents: 'none' // Passes generic clicks to Canvas for dragging
    }}>
      <audio ref={audioRef} src={element.url} preload="metadata" />

      <button
        onClick={togglePlay}
        style={{
          width: 38, height: 38, borderRadius: '50%', background: '#0f172a',
          border: 'none', color: 'white', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
          pointerEvents: 'auto'
        }}
      >
        {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" style={{ marginLeft: 2 }} />}
      </button>

      <div
        onClick={handleSeek}
        style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, cursor: 'pointer', position: 'relative', pointerEvents: 'auto' }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          background: '#0f172a', borderRadius: 4,
          width: `${(progress / (duration || 1)) * 100}%`
        }} />
      </div>

      <div style={{ fontSize: '13px', color: '#64748b', minWidth: 42, textAlign: 'right', fontWeight: 600 }}>
        {formatTime(progress)}
      </div>

      <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '12px' }}>
        {[0.5, 0.75, 1, 1.25].map(s => (
          <button
            key={s} onClick={() => changeSpeed(s)}
            style={{
              fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px',
              background: speed === s ? 'rgba(0,0,0,0.05)' : 'transparent',
              color: '#0f172a', border: 'none',
              cursor: 'pointer', transition: 'all 0.2s ease', pointerEvents: 'auto'
            }}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
// ----------------------------------------------

export default function Whiteboard({ role = 'teacher', showTeacher, showStudent, onToggleTeacher, onToggleStudent }: CustomBoardProps) {
  const [elements, setElements] = useState<BoardElement[]>([]);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // Selection Physics
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const [tool, setTool] = useState<ToolType>('pen');
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);

  const [penColor, setPenColor] = useState('#0f172a');
  const [penWidth, setPenWidth] = useState(4);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMediaType, setPendingMediaType] = useState<'audio' | 'video' | 'image' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // -- CRM Data States --
  const [savedLessons, setSavedLessons] = useState<Lesson[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newLessonName, setNewLessonName] = useState('');

  const fetchLessons = async () => {
    const { data, error } = await supabase.from('lessons').select('*').order('created_at', { ascending: false });
    if (!error && data) setSavedLessons(data);
  };

  useEffect(() => {
    if (isLibraryOpen) fetchLessons();
  }, [isLibraryOpen]);

  const handleSaveLesson = async () => {
    if (!newLessonName.trim()) return alert("Enter a lesson name!");
    setIsSaving(true);
    const { error } = await supabase.from('lessons').insert([{
      title: newLessonName,
      board_state: elementsRef.current
    }]);
    setIsSaving(false);
    if (!error) {
      setNewLessonName('');
      fetchLessons();
      alert("Lesson saved to CRM!");
    } else {
      alert("Error saving lesson. Check Supabase connection.");
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm("End session and extract text/vocabulary for the AI and student?")) return;

    // Extract semantics (both stickies and native text)
    const textNodes = elementsRef.current.filter((el) => el.type === 'sticky' || el.type === 'text') as (StickyElement | TextElement)[];

    if (textNodes.length === 0) {
      return alert("No text found on board to extract.");
    }

    const now = new Date();
    const lessonDateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('student_id') || 'guest';

    const payload = textNodes.filter(n => n.text.trim().length > 0).map(n => ({
      student_id: studentId,
      word: n.text,
      translation: `Lesson on ${lessonDateStr}`,
      status: 'new'
    }));

    if (payload.length > 0) {
      const { error } = await supabase.from('dictionary_words').insert(payload);
      if (!error) {
        alert(`Successfully exported ${payload.length} words to the CRM Dictionary!`);
      } else {
        alert("Error saving vocabulary. Are Supabase tables ready?");
      }
    }
  };

  useEffect(() => {
    // Check if initial empty board -> append Default Frame!
    const timer = setTimeout(() => {
      if (elementsRef.current.length === 0) {
        const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        const defaultFrame: FrameElement = {
          type: 'frame', id: 'default-frame', x: 200, y: 100,
          width: 800, height: 1131, title: `Lesson on ${today}`
        };
        updateElementsLocallyAndSync([defaultFrame]);
      }
    }, 1500); // 1.5 second initialization delay to wait for network sync

    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Real-Time Incognito Sync Logic ---
  const lastUpdateLock = useRef(0);
  const isDragging = useRef(false);

  const updateElementsLocallyAndSync = (newElements: BoardElement[]) => {
    lastUpdateLock.current = Date.now();
    setElements(newElements);
    fetch(`/api/sync?roomId=${ROOM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements: newElements })
    }).catch(err => console.error("Sync error:", err));
  };

  useEffect(() => {
    const pollSync = async () => {
      // Don't disrupt live freehand lines or actively dragging elements
      if (isDrawing.current || isDragging.current) return;

      // Optimization: Ignore incoming cloud state for 2 seconds after a local change 
      // to give the POST request time to finish and prevent "rubber-banding" glitches
      if (Date.now() - lastUpdateLock.current < 2000) return;

      try {
        const res = await fetch(`/api/sync?roomId=${ROOM_ID}&t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.elements) {
          const isDifferent = JSON.stringify(data.elements) !== JSON.stringify(elementsRef.current);
          if (isDifferent) setElements(data.elements);
        }
      } catch (e) { }
    };
    const interval = setInterval(pollSync, 1000);
    return () => clearInterval(interval);
  }, [tool]);

  // Global Hotkey Listener (e.g. 'N' for Sticky Notes, 'Delete' for removal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a sticky note textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setTool('sticky');
      }

      // Selection Deletion Mechanic!
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        // Protection: Never allow deleting the primary A4 frame
        if (selectedIdRef.current === 'default-frame') return;

        e.preventDefault();
        const newElements = elementsRef.current.filter(el => el.id !== selectedIdRef.current);
        updateElementsLocallyAndSync(newElements);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPointerPositionWithScale = (stage: any) => {
    const pos = stage.getPointerPosition();
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  };

  const handleMouseDown = (e: any) => {
    if (e.target.attrs?.id === 'html-overlay-container' || e.target.nodeType === 'HTML') return;

    // Deselect if clicking pure background canvas
    if (tool === 'select' && e.target === e.target.getStage()) {
      setSelectedId(null);
      return;
    }

    if (tool === 'select') return;
    if (e.target.parent?.attrs?.draggable && tool === 'pen') return;

    // Both teachers and students can draw now!
    isDrawing.current = true;
    const pos = getPointerPositionWithScale(e.target.getStage());
    const id = Date.now().toString();

    let newElements = [...elements];
    if (tool === 'pen' || tool === 'eraser') {
      const color = tool === 'eraser' ? '#ffffff' : penColor;
      const width = tool === 'eraser' ? 20 : penWidth;
      newElements.push({ type: 'stroke', id, points: [pos.x, pos.y], color, width, tool });
    } else if (tool === 'rect') {
      newElements.push({ type: 'rect', id, x: pos.x, y: pos.y, width: 0, height: 0, fill: penColor });
    } else if (tool === 'circle') {
      newElements.push({ type: 'circle', id, x: pos.x, y: pos.y, radius: 0, fill: penColor });
    } else if (tool === 'sticky') {
      newElements.push({ type: 'sticky', id, x: pos.x, y: pos.y, text: '', color: '#fef08a' });
      setTool('select');
      setSelectedId(id); // Auto-select newly dropped sticky notes!
      isDrawing.current = false;
    } else if (tool === 'text') {
      newElements.push({ type: 'text', id, x: pos.x, y: pos.y, text: '', color: penColor, fontSize: penWidth * 8 });
      setTool('select');
      setSelectedId(id);
      isDrawing.current = false;
    }

    if (tool === 'pen' || tool === 'eraser') {
      // For freehand strokes, only update local state to prevent API race conditions.
      // The full stroke will be synced to the DB on MouseUp.
      setElements(newElements);
    } else {
      updateElementsLocallyAndSync(newElements);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || tool === 'select' || tool === 'sticky' || tool === 'text') return;

    const stage = e.target.getStage();
    const pos = getPointerPositionWithScale(stage);
    let lastElement = { ...elements[elements.length - 1] } as any;

    if (lastElement?.type === 'stroke') {
      lastElement.points = lastElement.points.concat([pos.x, pos.y]);
    } else if (lastElement?.type === 'rect') {
      lastElement.width = pos.x - lastElement.x;
      lastElement.height = pos.y - lastElement.y;
    } else if (lastElement?.type === 'circle') {
      const dx = pos.x - lastElement.x;
      const dy = pos.y - lastElement.y;
      lastElement.radius = Math.sqrt(dx * dx + dy * dy);
    }

    const newElements = elements.slice(0, elements.length - 1);
    newElements.push(lastElement);
    setElements(newElements);
  };

  const handleMouseUp = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      updateElementsLocallyAndSync(elements);
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();

    if (e.evt.ctrlKey) {
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      if (newScale > 5 || newScale < 0.1) return;
      setScale(newScale);
      setPosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      setPosition({
        x: position.x - e.evt.deltaX,
        y: position.y - e.evt.deltaY,
      });
    }
  };

  const handleAddMedia = (mediaType: 'audio' | 'video' | 'image') => {
    setPendingMediaType(mediaType);
    if (fileInputRef.current) {
      if (mediaType === 'video') fileInputRef.current.accept = 'video/*';
      else if (mediaType === 'audio') fileInputRef.current.accept = 'audio/*';
      else fileInputRef.current.accept = 'image/*';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMediaType) return;

    setIsUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'tmp';
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { data, error } = await supabase.storage.from('lesson_materials').upload(filename, file);

      if (error) throw new Error(error.message);

      const { data: publicUrlData } = supabase.storage.from('lesson_materials').getPublicUrl(filename);
      const url = publicUrlData.publicUrl;

      const centerX = (dimensions.width / 2 - position.x) / scale - 150;
      const centerY = (dimensions.height / 2 - position.y) / scale - 150;
      const id = Date.now().toString();

      let newElements = [...elements];

      if (pendingMediaType === 'image') {
        const img = new window.Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = () => {
            const width = img.width > 800 ? 800 : img.width;
            const height = width * (img.height / img.width);
            newElements.push({ type: 'image', id, x: centerX, y: centerY, width, height, url });
            resolve(true);
          };
          img.onerror = () => {
            newElements.push({ type: 'image', id, x: centerX, y: centerY, width: 400, height: 300, url });
            resolve(true);
          }
        });
      } else {
        newElements.push({
          type: 'media' as const,
          id,
          x: centerX,
          y: centerY,
          url,
          mediaType: pendingMediaType,
          isPlaying: false,
          progress: 0,
          playbackRate: 1
        });
      }

      updateElementsLocallyAndSync(newElements);
      setSelectedId(id);
    } catch (err: any) {
      alert("Failed to upload: " + err.message + "\nAre you sure you created the 'lesson_materials' bucket in Supabase and made it PUBLIC?");
    } finally {
      e.target.value = '';
      setPendingMediaType(null);
      setIsUploading(false);
    }
  };

  if (dimensions.width === 0) return null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: 'var(--background)' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={(e) => {
          isDragging.current = false;
          lastUpdateLock.current = Date.now();
        }}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={tool === 'select'}
        ref={stageRef}
        style={{ cursor: tool === 'select' ? 'grab' : 'crosshair' }}
      >
        <Layer>
          {elements.map((el) => {
            const isSelected = selectedId === el.id;

            if (el.type === 'stroke') {
              return (
                <Line
                  key={el.id} points={el.points} stroke={el.color} strokeWidth={el.width}
                  tension={0.5} lineCap="round" lineJoin="round"
                  globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'}
                  onClick={() => { if (tool === 'select') setSelectedId(el.id); }}
                  onTap={() => { if (tool === 'select') setSelectedId(el.id); }}
                  {...isSelected ? { shadowColor: '#3b82f6', shadowBlur: 10, shadowOpacity: 1 } : {}}
                />
              );
            }
            if (el.type === 'rect') {
              return <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} fill="transparent" stroke={el.fill} strokeWidth={4} cornerRadius={4} onClick={() => { if (tool === 'select') setSelectedId(el.id); }} onTap={() => { if (tool === 'select') setSelectedId(el.id); }} {...isSelected ? { shadowColor: '#3b82f6', shadowBlur: 10, shadowOpacity: 1 } : {}} />;
            }
            if (el.type === 'circle') {
              return <Circle key={el.id} x={el.x} y={el.y} radius={el.radius} fill="transparent" stroke={el.fill} strokeWidth={4} onClick={() => { if (tool === 'select') setSelectedId(el.id); }} onTap={() => { if (tool === 'select') setSelectedId(el.id); }} {...isSelected ? { shadowColor: '#3b82f6', shadowBlur: 10, shadowOpacity: 1 } : {}} />;
            }

            // --- Draggable Sticky Note ---
            if (el.type === 'sticky') {
              return (
                <Group
                  key={el.id} x={el.x} y={el.y} draggable={tool === 'select'}
                  onMouseDown={() => { if (tool === 'select') setSelectedId(el.id); }}
                  onDragEnd={(e) => {
                    const newElements = elements.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item);
                    updateElementsLocallyAndSync(newElements);
                  }}
                >
                  <Rect width={200} height={200} fill="transparent" />
                  <Html divProps={{ style: { pointerEvents: 'none' } }} transform={true}>
                    <div style={{
                      width: 200, minHeight: 200, backgroundColor: el.color,
                      boxShadow: '2px 4px 10px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
                      borderBottomRightRadius: '24px',
                      ...(isSelected ? { outline: '4px solid #3b82f6', outlineOffset: '2px' } : {})
                    }}>
                      <div style={{ height: 24 }} />
                      <div style={{ padding: '0px 16px 16px 16px', flex: 1, display: 'flex', pointerEvents: 'auto' }}>
                        <textarea
                          value={el.text}
                          onChange={(e) => {
                            const newElements = elements.map(item => item.id === el.id ? { ...item, text: e.target.value } : item);
                            updateElementsLocallyAndSync(newElements);
                          }}
                          placeholder="Type here..."
                          style={{
                            flex: 1, width: '100%', border: 'none', background: 'transparent',
                            resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '18px',
                            color: '#334155', fontWeight: 500, lineHeight: 1.4
                          }}
                        />
                      </div>
                    </div>
                  </Html>
                </Group>
              );
            }

            // --- Draggable Media Overlays ---
            if (el.type === 'media') {
              return (
                <Group
                  key={el.id} x={el.x} y={el.y} draggable={tool === 'select'}
                  onMouseDown={() => { if (tool === 'select') setSelectedId(el.id); }}
                  onDragEnd={(e) => {
                    const newElements = elements.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item);
                    updateElementsLocallyAndSync(newElements);
                  }}
                >
                  <Rect width={el.mediaType === 'video' ? 560 : 480} height={el.mediaType === 'video' ? 315 : 60} fill="transparent" />
                  <Html divProps={{ style: { pointerEvents: 'none' } }} transform={true}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {el.mediaType === 'video' ? (
                        <div style={{
                          background: '#0f172a', padding: 0, borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', overflow: 'hidden', pointerEvents: 'auto',
                          ...(isSelected ? { outline: '4px solid #3b82f6', outlineOffset: '2px' } : {})
                        }}>
                          {el.url.startsWith('blob:') ? (
                            <video width="560" height="315" src={el.url} controls style={{ outline: 'none', display: 'block' }} />
                          ) : (
                            <iframe
                              width="560" height="315" src={el.url} title="Embedded Video" frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen style={{ display: 'block' }}
                            />
                          )}
                        </div>
                      ) : (
                        <div style={{
                          pointerEvents: 'none', borderRadius: '30px',
                          ...(isSelected ? { boxShadow: '0 0 0 3px #3b82f6, 0 10px 25px rgba(59,130,246,0.2)' } : {})
                        }}>
                          <CustomAudioPlayer
                            element={el as MediaElement}
                            onUpdate={(updates) => {
                              // Push Media Playback API status to Students instantly
                              const newElements = elements.map(item => item.id === el.id ? { ...item, ...updates } : item) as BoardElement[];
                              updateElementsLocallyAndSync(newElements);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </Html>
                </Group>
              );
            }
            // --- Native Text ---
            if (el.type === 'text') {
              return (
                <Group key={el.id} x={el.x} y={el.y} draggable={tool === 'select'}
                  onMouseDown={() => { if (tool === 'select') setSelectedId(el.id); }}
                  onDragEnd={(e) => {
                    const newElements = elements.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item);
                    updateElementsLocallyAndSync(newElements);
                  }}
                >
                  {isSelected ? (
                    <Html divProps={{ style: { pointerEvents: 'auto' } }}>
                      <textarea
                        value={el.text} autoFocus
                        onChange={(e) => {
                          const newElements = elements.map(item => item.id === el.id ? { ...item, text: e.target.value } : item);
                          updateElementsLocallyAndSync(newElements);
                        }}
                        placeholder="Type here..."
                        style={{
                          border: 'none', background: 'transparent', resize: 'none',
                          outline: '2px solid rgba(59, 130, 246, 0.5)', borderRadius: '4px',
                          fontFamily: 'inherit', fontSize: Math.max(24, el.fontSize || 24) + 'px',
                          color: el.color, fontWeight: 600, minWidth: '300px', minHeight: '100px'
                        }}
                      />
                    </Html>
                  ) : (
                    <Text
                      text={el.text || '...'}
                      fontSize={Math.max(24, el.fontSize || 24)}
                      fill={el.color}
                      fontFamily="inherit"
                      fontWeight={600}
                    />
                  )}
                </Group>
              );
            }

            // --- Expandable Lesson Frame ---
            if (el.type === 'frame') {
              return (
                <Group key={el.id} x={el.x} y={el.y} draggable={tool === 'select'}
                  onMouseDown={() => { if (tool === 'select') setSelectedId(el.id); }}
                  onDragEnd={(e) => {
                    const newElements = elements.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item);
                    updateElementsLocallyAndSync(newElements);
                  }}
                >
                  <Rect
                    width={el.width} height={el.height} fill="#ffffff"
                    cornerRadius={12} shadowBlur={20} shadowColor="rgba(0,0,0,0.1)"
                    stroke={isSelected ? '#3b82f6' : 'transparent'} strokeWidth={4}
                  />
                  <Text
                    x={24} y={-32} text={el.title} fontSize={20} fill="#64748b" fontWeight={600} fontFamily="inherit"
                  />

                  {/* Resizing Handle Bottom Right */}
                  {isSelected && tool === 'select' && (
                    <Circle
                      x={el.width} y={el.height} radius={12} fill="#3b82f6" stroke="#ffffff" strokeWidth={3}
                      draggable
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        const newWidth = Math.max(300, e.target.x());
                        const newHeight = Math.max(300, e.target.y());
                        const newElements = elements.map(item => item.id === el.id ? { ...item, width: newWidth, height: newHeight } : item);
                        setElements(newElements);
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        const newWidth = Math.max(300, e.target.x());
                        const newHeight = Math.max(300, e.target.y());
                        const newElements = elements.map(item => item.id === el.id ? { ...item, width: newWidth, height: newHeight } : item);
                        updateElementsLocallyAndSync(newElements);
                      }}
                      onMouseEnter={e => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'nwse-resize';
                      }}
                      onMouseLeave={e => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'default';
                      }}
                    />
                  )}
                </Group>
              );
            }

            // --- Uploaded Images ---
            if (el.type === 'image') {
              return (
                <URLImage
                  key={el.id} element={el} isSelected={isSelected} tool={tool}
                  onSelect={() => { if (tool === 'select') setSelectedId(el.id); }}
                  onDragEnd={(e: any) => {
                    e.cancelBubble = true;
                    const newElements = elements.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item);
                    updateElementsLocallyAndSync(newElements);
                  }}
                  onResize={(newWidth: number, newHeight: number, isFinal: boolean) => {
                    const newElements = elements.map(item => item.id === el.id ? { ...item, width: newWidth, height: newHeight } : item);
                    if (isFinal) {
                      updateElementsLocallyAndSync(newElements);
                    } else {
                      setElements(newElements);
                    }
                  }}
                />
              );
            }

            return null;
          })}
        </Layer>
      </Stage>

      {/* Unified Left Toolbar */}
      <div style={{
        position: 'absolute', top: '50%', left: 24, transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 8px',
        background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
        borderRadius: '16px', border: '1px solid var(--glass-border)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 50
      }}>
        <ToolButton icon={<MousePointer2 size={20} />} active={tool === 'select'} onClick={() => setTool('select')} title="Pan / Select (Drag Media!)" />
        <ToolButton icon={<Pen size={20} />} active={tool === 'pen'} onClick={() => setTool(tool === 'pen' ? 'select' : 'pen')} title="Pen" />
        <ToolButton icon={<Eraser size={20} />} active={tool === 'eraser'} onClick={() => setTool(tool === 'eraser' ? 'select' : 'eraser')} title="Eraser" />
        <ToolButton icon={<Square size={20} />} active={tool === 'rect'} onClick={() => setTool(tool === 'rect' ? 'select' : 'rect')} title="Square" />
        <ToolButton icon={<CircleIcon size={20} />} active={tool === 'circle'} onClick={() => setTool(tool === 'circle' ? 'select' : 'circle')} title="Circle" />
        <ToolButton icon={<Type size={20} />} active={tool === 'text'} onClick={() => setTool(tool === 'text' ? 'select' : 'text')} title="Text" />
        <ToolButton icon={<StickyNote size={20} />} active={tool === 'sticky'} onClick={() => setTool(tool === 'sticky' ? 'select' : 'sticky')} title="Sticky Note (N)" />
        <ToolButton icon={<Trash2 size={20} color="#ef4444" />} active={false} onClick={() => {
          let preservedFrame = elementsRef.current.find(e => e.id === 'default-frame');
          if (!preservedFrame) {
            const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            preservedFrame = { type: 'frame', id: 'default-frame', x: 200, y: 100, width: 800, height: 1131, title: `Lesson on ${today}` };
          }
          updateElementsLocallyAndSync([preservedFrame as BoardElement]);
        }} title="Clear Entire Board" />
        {role === 'teacher' && (
          <ToolButton icon={<BookmarkCheck size={20} color="#10b981" />} active={false} onClick={handleEndSession} title="End Class & Extract Vocabulary" />
        )}

        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.1)', margin: '4px 0' }} />

        {role === 'teacher' && (
          <>
            <ToolButton icon={<BookOpen size={20} />} active={isLibraryOpen} onClick={() => setIsLibraryOpen(!isLibraryOpen)} title="Lesson Library" />
            <ToolButton
              icon={isUploading && pendingMediaType === 'image' ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
              active={false} onClick={() => handleAddMedia('image')} title="Upload Image to Cloud"
            />
            <ToolButton
              icon={isUploading && pendingMediaType === 'audio' ? <Loader2 size={20} className="animate-spin" /> : <Music size={20} />}
              active={false} onClick={() => handleAddMedia('audio')} title="Upload Audio"
            />
            <ToolButton
              icon={isUploading && pendingMediaType === 'video' ? <Loader2 size={20} className="animate-spin" /> : <FileVideo size={20} />}
              active={false} onClick={() => handleAddMedia('video')} title="Upload Video"
            />
            <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.1)', margin: '4px 0' }} />
          </>
        )}

        <ToolButton icon={showTeacher ? <Video size={18} color="#3b82f6" /> : <VideoOff size={18} color="#64748b" />} active={showTeacher} onClick={onToggleTeacher} title="Toggle Teacher Video" />
        <ToolButton icon={showStudent ? <Video size={18} color="#8b5cf6" /> : <VideoOff size={18} color="#64748b" />} active={showStudent} onClick={onToggleStudent} title="Toggle Student Video" />
      </div>

      {['pen', 'rect', 'circle', 'text', 'sticky'].includes(tool) && (
        <div style={{
          position: 'absolute', top: '50%', left: 90, transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 6px',
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          borderRadius: '16px', border: '1px solid var(--glass-border)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 50,
          animation: 'slideIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '36px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Color</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c} onClick={() => setPenColor(c)} title={c}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', backgroundColor: c,
                    border: penColor === c ? '2px solid #000' : '1px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer', outline: 'none', transition: 'transform 0.1s',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                />
              ))}
              <div
                title="Custom Color"
                style={{
                  position: 'relative', width: 24, height: 24, borderRadius: '50%',
                  overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.2)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ width: '100%', height: '100%', background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
                <input
                  type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)}
                  style={{ opacity: 0, position: 'absolute', top: -10, left: -10, width: 40, height: 40, cursor: 'pointer' }}
                />
              </div>
            </div>

          </div>
          <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.1)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Size</span>
            {[2, 6, 12].map(w => (
              <button
                key={w} onClick={() => setPenWidth(w)} title={`${w}px`}
                style={{
                  width: 32, height: 32, borderRadius: '8px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: penWidth === w ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: 'none', cursor: 'pointer', transition: 'background 0.2s'
                }}
              >
                <div style={{ width: w, height: w, backgroundColor: penColor, borderRadius: '50%' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lesson Library Overlay */}
      {isLibraryOpen && (
        <div style={{
          position: 'absolute', top: '50%', left: 90, transform: 'translateY(-50%)',
          width: '320px', padding: '24px',
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          borderRadius: '16px', border: '1px solid var(--glass-border)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 20,
          display: 'flex', flexDirection: 'column', gap: '16px',
          animation: 'slideIn 0.2s ease-out', color: '#0f172a'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Lesson Library</h3>
            <button onClick={() => setIsLibraryOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#64748b" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text" value={newLessonName} onChange={e => setNewLessonName(e.target.value)}
              placeholder="Lesson Name..."
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <button onClick={handleSaveLesson} disabled={isSaving} style={{
              padding: '12px', borderRadius: '8px', background: isSaving ? '#94a3b8' : '#005568', color: 'white',
              border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s'
            }}>
              {isSaving ? 'Saving...' : 'Save Current Board'}
            </button>
          </div>

          <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.1)' }} />

          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedLessons.length === 0 ? (
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', textAlign: 'center' }}>
                No CRM lessons found. Check Supabase connection or save one!
              </p>
            ) : (
              savedLessons.map(lesson => (
                <div key={lesson.id} onClick={() => updateElementsLocallyAndSync(lesson.board_state)} style={{
                  padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', cursor: 'pointer',
                  border: '1px solid rgba(59, 130, 246, 0.1)', transition: 'background 0.2s'
                }}>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{lesson.title}</strong>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {lesson.board_state.length} elements
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponent for buttons
function ToolButton({ icon, active, onClick, title }: { icon: React.ReactNode, active: boolean, onClick: () => void, title?: string }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        padding: '10px', borderRadius: '10px', border: 'none',
        background: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: active ? '#2563eb' : '#64748b',
        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as any).style.background = 'rgba(0,0,0,0.05)';
        (e.currentTarget as any).style.color = '#0f172a';
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as any).style.background = 'transparent';
          (e.currentTarget as any).style.color = '#64748b';
        } else {
          (e.currentTarget as any).style.color = '#2563eb';
        }
      }}
    >
      {icon}
    </button>
  );
}

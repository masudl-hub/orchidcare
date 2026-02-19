import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { DemoInputBar } from '@/components/demo/DemoInputBar';
import { DemoArtifactStack, type ArtifactEntry, type ArtifactData } from '@/components/demo/DemoArtifactStack';
import { DemoTurnCounter } from '@/components/demo/DemoTurnCounter';
import { DemoLimitScreen } from '@/components/demo/DemoLimitScreen';
import { DemoVoiceOverlay } from '@/components/demo/DemoVoiceOverlay';

// Artifact card imports
import { IdentificationCard } from '@/components/demo/artifacts/IdentificationCard';
import { DiagnosisCard } from '@/components/demo/artifacts/DiagnosisCard';
import { CareGuideCard } from '@/components/demo/artifacts/CareGuideCard';
import { StoreListCard } from '@/components/demo/artifacts/StoreListCard';
import { VisualGuideCard } from '@/components/demo/artifacts/VisualGuideCard';
import { ChatResponse } from '@/components/demo/artifacts/ChatResponse';

const mono = 'ui-monospace, monospace';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const MAX_TEXT_TURNS = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoMode = 'text' | 'voice' | 'limit_reached' | 'error';

interface DemoMessage {
  role: 'user' | 'assistant';
  content: string;
  media?: { type: string; data: string }[];
}

interface DemoResponseArtifact {
  type: 'identification' | 'diagnosis' | 'care_guide' | 'store_list' | 'visual_guide' | 'chat';
  data: Record<string, unknown>;
}

interface DemoResponse {
  artifact: DemoResponseArtifact;
  message: string;
  pixelFormation: {
    type: 'template' | 'text';
    id?: string;
    text?: string;
  } | null;
  demoToken: string;
  turnsRemaining: {
    text: number;
    voice: number;
    images: number;
  };
  limitReached?: boolean;
  images?: {
    url: string;
    title: string;
  }[];
}

// ---------------------------------------------------------------------------
// LocalStorage keys
// ---------------------------------------------------------------------------

const LS_TOKEN = 'orchid-demo-token';
const LS_MESSAGES = 'orchid-demo-messages';
const LS_ARTIFACTS = 'orchid-demo-artifacts';
const LS_TURNS = 'orchid-demo-turns';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Responsive canvas height
// ---------------------------------------------------------------------------

function getCanvasHeightPercent(): number {
  const h = window.innerHeight;
  if (h <= 667) return 0.50;
  if (h <= 844) return 0.50;
  return 0.45;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const navigate = useNavigate();

  // State
  const [mode, setMode] = useState<DemoMode>('text');
  const [demoToken, setDemoToken] = useState<string | null>(
    () => localStorage.getItem(LS_TOKEN),
  );
  const [messages, setMessages] = useState<DemoMessage[]>(
    () => loadJson<DemoMessage[]>(LS_MESSAGES, []),
  );
  // Artifacts are re-hydrated from localStorage on mount (elements rebuilt below).
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [turnsRemaining, setTurnsRemaining] = useState<{ text: number; voice: number; images: number }>(
    () => loadJson(LS_TURNS, { text: MAX_TEXT_TURNS, voice: 3, images: 3 }),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canvasHeightPct, setCanvasHeightPct] = useState(getCanvasHeightPercent);
  const [hasSentMessage, setHasSentMessage] = useState(
    () => loadJson<DemoMessage[]>(LS_MESSAGES, []).length > 0,
  );
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('thinking');

  const artifactIdCounter = useRef(0);
  const artifactsHydrated = useRef(false);
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  // Responsive canvas sizing
  useEffect(() => {
    const handler = () => setCanvasHeightPct(getCanvasHeightPercent());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    if (demoToken) localStorage.setItem(LS_TOKEN, demoToken);
    else localStorage.removeItem(LS_TOKEN);
  }, [demoToken]);

  useEffect(() => {
    localStorage.setItem(LS_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    // Skip the first render — hydration effect will populate artifacts.
    // Writing [] on mount would wipe saved data before hydration runs.
    if (!artifactsHydrated.current) return;
    // Persist artifact data (strip non-serialisable `element` field)
    const serialisable = artifacts.map(({ id, userMessage, artifactType, artifactData, responseMessage, images }) => ({
      id, userMessage, artifactType, artifactData, responseMessage, images,
    }));
    localStorage.setItem(LS_ARTIFACTS, JSON.stringify(serialisable));
  }, [artifacts]);

  useEffect(() => {
    localStorage.setItem(LS_TURNS, JSON.stringify(turnsRemaining));
  }, [turnsRemaining]);

  // Whether to show landing text (hide once user has sent a message)
  const showLanding = !hasSentMessage;

  // -------------------------------------------------------------------
  // Render artifact element from serialisable data
  // -------------------------------------------------------------------
  const renderArtifact = useCallback(
    (type: string, data: Record<string, unknown>, message: string, images?: { url: string; title: string }[]): React.ReactNode => {
      switch (type) {
        case 'identification':
          return <IdentificationCard data={data as any} message={message} />;
        case 'diagnosis':
          return <DiagnosisCard data={data as any} message={message} onFindSupplies={(location) => sendMessageRef.current(`find treatment supplies for ${(data as any).issue || 'this issue'} near ${location}`)} />;
        case 'care_guide':
          return <CareGuideCard data={data as any} message={message} />;
        case 'store_list':
          return <StoreListCard data={data as any} message={message} />;
        case 'visual_guide':
          return <VisualGuideCard data={data as any} images={images} message={message} />;
        case 'chat':
        default:
          return <ChatResponse text={message} />;
      }
    },
    [],
  );

  // -------------------------------------------------------------------
  // Re-hydrate persisted artifacts on mount
  // -------------------------------------------------------------------
  useEffect(() => {
    const saved = loadJson<Omit<ArtifactEntry, 'element'>[]>(LS_ARTIFACTS, []);
    artifactsHydrated.current = true; // allow persistence from now on
    if (saved.length === 0) return;
    const hydrated: ArtifactEntry[] = saved.map((entry) => ({
      ...entry,
      element: renderArtifact(
        entry.artifactType,
        entry.artifactData,
        entry.responseMessage,
        entry.images,
      ),
    }));
    setArtifacts(hydrated);
    artifactIdCounter.current = hydrated.length;
  }, []); // mount-only

  // -------------------------------------------------------------------
  // Tool name → human-readable label
  // -------------------------------------------------------------------
  const toolLabel = useCallback((name: string): string => {
    switch (name) {
      case 'identify_plant': return 'identifying plant';
      case 'diagnose_plant': return 'diagnosing';
      case 'research': return 'researching';
      case 'find_stores': return 'finding stores';
      case 'generate_image': return 'generating image';
      default: return 'working';
    }
  }, []);

  // -------------------------------------------------------------------
  // API call — consumes NDJSON stream for real-time tool status
  // -------------------------------------------------------------------
  const sendMessage = useCallback(
    async (text: string, media?: { type: string; data: string }[]) => {
      if (mode === 'limit_reached') return;

      setHasSentMessage(true);
      setIsLoading(true);
      setLoadingLabel('thinking');
      setErrorMsg(null);
      setPendingUserMessage(text !== '(photo)' ? text : '(photo sent)');

      // Build user message
      const userMsg: DemoMessage = { role: 'user', content: text, media };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/demo-agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.slice(-6), // last 3 turns
            media: media ?? undefined,
            demoToken,
          }),
        });

        if (!response.ok) {
          // Non-streaming error (token/limit check returns plain JSON)
          const errData = await response.json().catch(() => ({}));
          if (errData.error === 'limit_reached') {
            setMode('limit_reached');
            setTurnsRemaining((prev) => ({ ...prev, text: 0 }));
            return;
          }
          throw new Error(errData.error || `API error ${response.status}`);
        }

        // Read NDJSON stream — tool events arrive as lines, final result is "done"
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let data: DemoResponse | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop()!; // keep incomplete last line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.event === 'tool') {
                setLoadingLabel(toolLabel(evt.name));
              } else if (evt.event === 'status') {
                setLoadingLabel(evt.label || 'thinking');
              } else if (evt.event === 'done') {
                data = evt.data as DemoResponse;
              }
            } catch {
              // ignore malformed lines
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const evt = JSON.parse(buffer);
            if (evt.event === 'done') data = evt.data as DemoResponse;
          } catch {
            // If not NDJSON, try parsing whole response as JSON (fallback)
          }
        }

        // Fallback: if no stream events, try parsing as plain JSON
        if (!data) {
          throw new Error('No response received from server');
        }

        // Check for error in streamed response
        if ((data as any).error === 'limit_reached') {
          setMode('limit_reached');
          setTurnsRemaining((prev) => ({ ...prev, text: 0 }));
          return;
        }

        // Update token
        if (data.demoToken) {
          setDemoToken(data.demoToken);
        }

        // Update turns
        if (data.turnsRemaining) {
          setTurnsRemaining(data.turnsRemaining);
        }

        // Update pixel formation
        if (data.pixelFormation) {
          const formation: Formation = {
            type: data.pixelFormation.type as Formation['type'],
            id: data.pixelFormation.id,
            text: data.pixelFormation.text,
            hold: 0, // indefinite — stay until next response
          };
          setCurrentFormation(formation);
        }

        // Add assistant message
        const assistantMsg: DemoMessage = { role: 'assistant', content: data.message };
        setMessages((prev) => [...prev, assistantMsg]);

        // Render artifact and add to stack (include serialisable data for persistence)
        const artifactType = data.artifact.type;
        const artifactData = data.artifact.data;
        const responseMessage = data.message;
        const element = renderArtifact(artifactType, artifactData, responseMessage, data.images);
        const newArtifact: ArtifactEntry = {
          id: `artifact-${++artifactIdCounter.current}`,
          element,
          userMessage: text !== '(photo)' ? text : undefined,
          artifactType,
          artifactData,
          responseMessage,
          images: data.images,
        };
        setArtifacts((prev) => [...prev, newArtifact]);
        setPendingUserMessage(null);

        // Check limit
        if (data.limitReached) {
          setMode('limit_reached');
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setErrorMsg(detail);
        setMode('error');
        setPendingUserMessage(null);
        // Remove the optimistically added user message on error
        setMessages(messages);
      } finally {
        setIsLoading(false);
        setLoadingLabel('thinking');
      }
    },
    [messages, demoToken, mode, renderArtifact, toolLabel],
  );

  // Keep ref current so renderArtifact callbacks can call sendMessage
  sendMessageRef.current = sendMessage;

  // -------------------------------------------------------------------
  // Mic click — voice mode transition
  // -------------------------------------------------------------------
  const handleMicClick = useCallback(() => {
    setMode('voice');
  }, []);

  // Voice mode return — receives updated token from overlay
  const handleVoiceEnd = useCallback((newToken: string) => {
    setDemoToken(newToken);
    setTurnsRemaining((prev) => ({
      ...prev,
      voice: Math.max(0, prev.voice - 1),
    }));
    setMode('text');
  }, []);

  // Voice error
  const handleVoiceError = useCallback((error: string) => {
    setErrorMsg(error);
    setMode('error');
  }, []);

  // Error retry
  const handleRetry = useCallback(() => {
    setMode('text');
    setErrorMsg(null);
  }, []);

  // Canvas height in px — full-size on landing, removed entirely after first send.
  const pixelCanvasHeight = Math.round(window.innerHeight * canvasHeightPct);

  // -------------------------------------------------------------------
  // Limit reached screen
  // -------------------------------------------------------------------
  if (mode === 'limit_reached') {
    return (
      <DemoLimitScreen
        voiceTurnsRemaining={turnsRemaining.voice}
        onStartVoice={() => setMode('voice')}
      />
    );
  }

  // -------------------------------------------------------------------
  // Voice mode overlay
  // -------------------------------------------------------------------
  if (mode === 'voice') {
    return (
      <DemoVoiceOverlay
        demoToken={demoToken || ''}
        voiceTurnsRemaining={turnsRemaining.voice}
        onEnd={handleVoiceEnd}
        onError={handleVoiceError}
      />
    );
  }

  // -------------------------------------------------------------------
  // Main text mode layout
  // -------------------------------------------------------------------
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="hover:text-white/80 transition-colors duration-300"
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          left: 16,
          zIndex: 30,
          fontFamily: 'ui-monospace, monospace',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.4)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
        }}
      >
        &larr; back
      </button>

      {/* Top centering spacer — centers everything before first send,
          collapses so canvas sits at top after */}
      <div
        style={{
          flexGrow: hasSentMessage ? 0 : 1,
          flexBasis: 0,
          flexShrink: 0,
          transition: 'flex-grow 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* PixelCanvas — full size on landing, removed entirely after first send
           (a small 48px canvas lives inside DemoArtifactStack instead) */}
      <AnimatePresence>
        {!hasSentMessage && (
          <motion.div
            key="landing-canvas"
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: '100%',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 'max(8px, env(safe-area-inset-top))',
            }}
          >
            <PixelCanvas
              isSpeaking={false}
              isListening={false}
              outputAudioLevel={0}
              isThinking={false}
              formation={currentFormation}
              onFormationComplete={() => {}}
              heightPx={pixelCanvasHeight}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Landing text — pinned directly below canvas, fades out on first send */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            key="landing-text"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              textAlign: 'center',
              padding: '12px 24px 32px',
              fontFamily: mono,
              fontSize: '13px',
              lineHeight: '1.7',
              color: 'rgba(255,255,255,0.5)',
              flexShrink: 0,
            }}
          >
            hi, i'm orchid.<br />
            drop a photo, ask a question,<br />
            or just start talking.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Artifact area — zero height before first send, expands after */}
      <div
        style={{
          flexGrow: hasSentMessage ? 1 : 0,
          flexBasis: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'flex-grow 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {hasSentMessage && (
          <DemoArtifactStack
            artifacts={artifacts}
            isLoading={isLoading}
            loadingLabel={loadingLabel}
            pendingUserMessage={pendingUserMessage}
            currentFormation={currentFormation}
          />
        )}
      </div>

      {/* Error banner — slides in / fades out */}
      <AnimatePresence>
        {mode === 'error' && errorMsg && (
          <motion.div
            key="error-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', flexShrink: 0 }}
          >
            <div
              style={{
                margin: '0 16px',
                padding: '10px 14px',
                border: '1px solid rgba(255,80,80,0.4)',
                fontFamily: mono,
                fontSize: '11px',
                color: 'rgba(255,80,80,0.8)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{errorMsg}</span>
              <button
                onClick={handleRetry}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,80,80,0.4)',
                  color: 'rgba(255,80,80,0.8)',
                  fontFamily: mono,
                  fontSize: '10px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  marginLeft: '12px',
                  flexShrink: 0,
                  transition: 'background-color 150ms ease-out, color 150ms ease-out',
                }}
              >
                retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <DemoInputBar
        onSend={sendMessage}
        onGoLive={handleMicClick}
        isLoading={isLoading}
        disabled={(mode as string) === 'limit_reached'}
      />

      {/* Turn counter */}
      <div
        style={{
          flexShrink: 0,
          paddingBottom: 'max(4px, env(safe-area-inset-bottom))',
          backgroundColor: '#000',
        }}
      >
        <DemoTurnCounter
          turnsRemaining={turnsRemaining.text}
          totalTurns={MAX_TEXT_TURNS}
        />
      </div>

      {/* Bottom centering spacer — heavier weight than top so input
          sits above center; collapses after first send */}
      <div
        style={{
          flexGrow: hasSentMessage ? 0 : 1.6,
          flexBasis: 0,
          flexShrink: 0,
          transition: 'flex-grow 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { DemoInputBar } from '@/components/demo/DemoInputBar';
import { DemoArtifactStack, type ArtifactEntry } from '@/components/demo/DemoArtifactStack';
import { ChatResponse } from '@/components/demo/artifacts/ChatResponse';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WifiOff } from 'lucide-react';

const mono = 'ui-monospace, monospace';

interface PwaMessage {
  role: 'user' | 'assistant';
  content: string;
  media?: { type: string; data: string }[];
}

function getCanvasHeightPercent(): number {
  const h = window.innerHeight;
  if (h <= 667) return 0.50;
  if (h <= 844) return 0.50;
  return 0.45;
}

export function PwaChat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<PwaMessage[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('thinking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [canvasHeightPct, setCanvasHeightPct] = useState(getCanvasHeightPercent);

  const artifactIdCounter = useRef(0);
  const sendMessageRef = useRef<(text: string) => void>(() => { });

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Responsive canvas sizing
  useEffect(() => {
    const handler = () => setCanvasHeightPct(getCanvasHeightPercent());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Load conversation history
  useEffect(() => {
    if (!profile) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('content, direction, created_at')
        .eq('profile_id', profile.id)
        .eq('channel', 'pwa')
        .order('created_at', { ascending: true })
        .limit(20);

      if (data && data.length > 0) {
        const historyMessages: PwaMessage[] = data.map(msg => ({
          role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        }));
        setMessages(historyMessages);
        setHasSentMessage(true);

        // Create simple chat artifacts for history
        const historyArtifacts: ArtifactEntry[] = [];
        for (let i = 0; i < data.length; i++) {
          if (data[i].direction === 'outbound') {
            const userMsg = i > 0 && data[i - 1].direction === 'inbound' ? data[i - 1].content : undefined;
            historyArtifacts.push({
              id: `history-${i}`,
              element: <ChatResponse text={data[i].content} />,
              userMessage: userMsg,
              artifactType: 'chat',
              artifactData: { text: data[i].content },
              responseMessage: data[i].content,
            });
          }
        }
        setArtifacts(historyArtifacts);
        artifactIdCounter.current = historyArtifacts.length;
      }
    };
    loadHistory();
  }, [profile]);

  // Render artifact from type
  const renderArtifact = useCallback(
    (_type: string, _data: Record<string, unknown>, message: string, images?: { url: string; title: string }[]): React.ReactNode => {
      return <ChatResponse text={message} images={images?.map(img => ({ url: img.url, title: img.title }))} />;
    },
    [],
  );

  // Tool name → label
  const toolLabel = useCallback((name: string): string => {
    switch (name) {
      case 'identify_plant': return 'identifying plant';
      case 'diagnose_plant': return 'diagnosing';
      case 'research': return 'researching';
      case 'find_stores': return 'finding stores';
      case 'verify_store_inventory': return 'checking inventory';
      case 'generate_image': return 'generating image';
      case 'generate_visual_guide': return 'drawing illustrations';
      case 'analyze_environment': return 'analyzing environment';
      case 'analyze_video': return 'analyzing video';
      case 'save_plant': return 'saving plant';
      case 'modify_plant': return 'updating plant';
      case 'create_reminder': return 'setting reminder';
      case 'deep_think': return 'reasoning';
      default: return 'working';
    }
  }, []);

  // Send message to pwa-agent
  const sendMessage = useCallback(
    async (text: string, media?: { type: string; data: string }[]) => {
      if (!isOnline) {
        setErrorMsg("You're offline. Connect to the internet to chat.");
        return;
      }

      setHasSentMessage(true);
      setIsLoading(true);
      setLoadingLabel('thinking');
      setErrorMsg(null);
      setPendingUserMessage(text !== '(photo)' ? text : '(photo sent)');

      const userMsg: PwaMessage = { role: 'user', content: text, media };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error('Not authenticated');
        }

        const body: Record<string, unknown> = { message: text };
        if (media && media.length > 0) {
          body.mediaBase64 = media[0].data;
          body.mediaMimeType = media[0].type;
        }

        // Start polling agent_operations for live tool updates
        const startedAt = new Date().toISOString();
        let pollInterval: number | ReturnType<typeof setInterval>;

        const startPolling = () => {
          pollInterval = setInterval(async () => {
            if (!profile?.id) return;
            const { data } = await supabase.from('agent_operations')
              .select('tool_name, operation_type')
              .eq('profile_id', profile.id)
              .gte('created_at', startedAt)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (data) {
              const name = data.tool_name || data.operation_type;
              if (name) {
                setLoadingLabel(toolLabel(name));
              }
            }
          }, 1500);
        };

        startPolling();

        let response: any;
        try {
          response = await supabase.functions.invoke('pwa-agent', {
            body,
          });
        } finally {
          if (pollInterval) clearInterval(pollInterval);
        }

        if (response.error) {
          throw new Error(response.error.message || 'Request failed');
        }

        // Parse NDJSON response
        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const lines = responseText.split('\n').filter((l: string) => l.trim());

        let replyData: { reply: string; mediaToSend: any[] } | null = null;

        for (const line of lines) {
          try {
            const evt = JSON.parse(line);
            if (evt.event === 'tool') {
              setLoadingLabel(toolLabel(evt.name));
            } else if (evt.event === 'status') {
              setLoadingLabel(evt.label || 'thinking');
            } else if (evt.event === 'done') {
              replyData = evt.data;
            }
          } catch {
            // If it's not NDJSON, try parsing as direct JSON
            try {
              const direct = JSON.parse(responseText);
              if (direct.reply !== undefined) {
                replyData = direct;
              } else if (direct.event === 'done') {
                replyData = direct.data;
              }
            } catch {
              // ignore
            }
          }
        }

        // Fallback: if response.data is already parsed object
        if (!replyData && response.data && typeof response.data === 'object') {
          if (response.data.reply !== undefined) {
            replyData = response.data;
          } else if (response.data.event === 'done') {
            replyData = response.data.data;
          }
        }

        if (!replyData) {
          throw new Error('No response received');
        }

        const reply = replyData.reply || '';

        // Extract images from mediaToSend
        const images = (replyData.mediaToSend || [])
          .filter((m: any) => m.url)
          .map((m: any) => ({ url: m.url, title: m.caption || '' }));

        // Add assistant message
        const assistantMsg: PwaMessage = { role: 'assistant', content: reply };
        setMessages(prev => [...prev, assistantMsg]);

        // Render with images if available
        const element = images.length > 0
          ? renderArtifact('chat', { text: reply }, reply, images)
          : renderArtifact('chat', { text: reply }, reply);

        const newArtifact: ArtifactEntry = {
          id: `artifact-${++artifactIdCounter.current}`,
          element,
          userMessage: text !== '(photo)' ? text : undefined,
          artifactType: 'chat',
          artifactData: { text: reply },
          responseMessage: reply,
        };
        setArtifacts(prev => [...prev, newArtifact]);
        setPendingUserMessage(null);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setErrorMsg(detail);
        setPendingUserMessage(null);
        // Remove optimistically added user message
        setMessages(messages);
      } finally {
        setIsLoading(false);
        setLoadingLabel('thinking');
      }
    },
    [messages, isOnline, renderArtifact, toolLabel],
  );

  sendMessageRef.current = sendMessage;

  const handleMicClick = useCallback(() => {
    // Voice not yet supported in PWA — could be added later
  }, []);

  const handleRetry = useCallback(() => {
    setErrorMsg(null);
  }, []);

  const showLanding = !hasSentMessage;
  const pixelCanvasHeight = Math.round(window.innerHeight * canvasHeightPct);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehaviorY: 'none',
      }}
    >
      {/* Offline indicator */}
      {!isOnline && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(255, 80, 80, 0.1)',
            border: '1px solid rgba(255, 80, 80, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: mono,
            fontSize: '11px',
            color: 'rgba(255, 80, 80, 0.8)',
            flexShrink: 0,
          }}
        >
          <WifiOff size={14} />
          <span>You're offline</span>
        </div>
      )}

      {/* Top spacer — centers content before first message */}
      <div
        style={{
          flexGrow: hasSentMessage ? 0 : 1,
          flexBasis: 0,
          flexShrink: 0,
          transition: 'flex-grow 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* PixelCanvas — landing only */}
      <AnimatePresence>
        {!hasSentMessage && (
          <motion.div
            key="landing-canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
              onFormationComplete={() => { }}
              heightPx={pixelCanvasHeight}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Landing text */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            key="landing-text"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
            hi{profile?.display_name ? `, ${profile.display_name}` : ''}. i'm orchid.<br />
            drop a photo, ask a question,<br />
            or just start talking.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Artifact/chat area */}
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

      {/* Error banner */}
      <AnimatePresence>
        {errorMsg && (
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
                }}
              >
                dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <motion.div
        initial={showLanding ? { opacity: 0 } : { opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: showLanding ? 0.5 : 0, ease: [0.22, 1, 0.36, 1] }}
        style={{ flexShrink: 0 }}
      >
        <DemoInputBar
          onSend={sendMessage}
          onGoLive={handleMicClick}
          isLoading={isLoading}
          disabled={!isOnline}
        />
      </motion.div>

      {/* Bottom spacer — pushes input above center on landing */}
      <div
        style={{
          flexGrow: hasSentMessage ? 0 : 1.6,
          flexBasis: 0,
          minHeight: 'max(64px, env(safe-area-inset-bottom, 64px))',
          flexShrink: 0,
          transition: 'flex-grow 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

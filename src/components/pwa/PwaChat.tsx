import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { DemoInputBar } from '@/components/demo/DemoInputBar';
import { PwaChatStack, type PwaMessage } from './PwaChatStack';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { prewarmMicPermission } from '@/hooks/call/useAudioCapture';
import { WifiOff } from 'lucide-react';

const mono = 'ui-monospace, monospace';

// PwaMessage type is imported from PwaChatStack

function getCanvasHeightPercent(): number {
  const h = window.innerHeight;
  if (h <= 667) return 0.50;
  if (h <= 844) return 0.50;
  return 0.45;
}

export function PwaChat() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<PwaMessage[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('thinking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [canvasHeightPct, setCanvasHeightPct] = useState(getCanvasHeightPercent);
  const sendMessageRef = useRef<(text: string, media?: { type: string; data: string }[], extraBody?: Record<string, unknown>) => void>(() => { });

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

  // Load conversation history — cached via React Query so navigating away/back doesn't re-fetch
  const queryClient = useQueryClient();
  const { data: historyData } = useQuery({
    queryKey: ['pwa-history', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('id, content, direction, created_at, media_urls, rating, metadata')
        .eq('profile_id', profile!.id)
        .eq('channel', 'pwa')
        .order('created_at', { ascending: true }) as { data: Array<{ id: string; content: string; direction: string; created_at: string; media_urls: string[] | null; rating: number | null; metadata: Record<string, unknown> | null }> | null };

      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000, // cached for 5 min — new messages appended locally
  });

  // Hydrate messages from DB — single source of truth, no artifacts
  const historyHydratedRef = useRef(false);
  useEffect(() => {
    if (!historyData || historyHydratedRef.current) {
      if (historyData) setIsHistoryLoaded(true);
      return;
    }
    historyHydratedRef.current = true;

    if (historyData.length > 0) {
      const historyMessages: PwaMessage[] = historyData.map(msg => ({
        id: msg.id,
        role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: msg.content,
        createdAt: msg.created_at,
        rating: msg.rating,
        mediaUrls: msg.media_urls || undefined,
        metadata: msg.metadata || undefined,
      }));
      setMessages(historyMessages);
      setHasSentMessage(true);
    }
    setIsHistoryLoaded(true);
  }, [historyData]);

  // Capture autoSendText from navigation state on mount (before any re-renders clear it)
  const autoSendTextRef = useRef<string | null>(
    (location.state as { autoSendText?: string } | null)?.autoSendText ?? null
  );

  // Handle auto-send from URL state (e.g. from PlantVitals "set ideal ranges")
  useEffect(() => {
    if (!isHistoryLoaded || !autoSendTextRef.current) return;
    const text = autoSendTextRef.current;
    autoSendTextRef.current = null; // consume it once
    // Clear location state so a browser back/forward won't re-trigger
    navigate(location.pathname, { replace: true, state: {} });
    // Defer to next tick so sendMessageRef has the latest sendMessage with loaded history
    setTimeout(() => {
      sendMessageRef.current(text);
    }, 0);
  }, [isHistoryLoaded, location.pathname, navigate]);

  // Render artifact from type
  // Tool name → label
  const toolLabel = useCallback((name: string): string => {
    switch (name) {
      // Shared tools
      case 'research': return 'researching';
      case 'analyze_url': return 'analyzing link';
      case 'save_plant': return 'saving plant';
      case 'modify_plant': return 'updating plant';
      case 'delete_plant': return 'removing plant';
      case 'create_reminder': return 'setting reminder';
      case 'delete_reminder': return 'removing reminder';
      case 'log_care_event': return 'logging care';
      case 'save_user_insight': return 'remembering';
      case 'update_notification_preferences': return 'updating notifications';
      case 'update_profile': return 'updating profile';
      case 'find_stores': return 'finding stores';
      case 'verify_store_inventory': return 'checking inventory';
      case 'get_cached_stores': return 'checking stores';
      case 'search_products': return 'searching products';
      case 'deep_think': return 'reasoning';
      case 'generate_image': return 'generating image';
      case 'compare_plant_snapshots': return 'comparing snapshots';
      case 'recall_media': return 'recalling media';
      // Sensor tools
      case 'check_plant_sensors': return 'checking sensors';
      case 'associate_reading': return 'associating reading';
      case 'set_plant_ranges': return 'setting ranges';
      case 'get_sensor_history': return 'fetching history';
      case 'compare_plant_environments': return 'comparing environments';
      case 'manage_device': return 'managing device';
      case 'dismiss_sensor_alert': return 'dismissing alert';
      // Agent-only tools
      case 'identify_plant': return 'identifying plant';
      case 'diagnose_plant': return 'diagnosing';
      case 'analyze_environment': return 'analyzing environment';
      case 'generate_visual_guide': return 'drawing illustrations';
      case 'analyze_video': return 'analyzing video';
      case 'transcribe_voice': return 'transcribing voice';
      case 'capture_plant_snapshot': return 'capturing snapshot';
      default: return 'working';
    }
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    // Optional: could add a toast here
  }, []);

  const handleResend = useCallback((text: string) => {
    // We already have a sendMessage function defined below, so we need to defer the call 
    // or just rely on the reference. We will use the reference.
    sendMessageRef.current(text);
  }, []);

  const handleRate = useCallback(async (id: string, newRating: number) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, rating: newRating } : msg
    ));

    const { error } = await supabase
      .from('conversations')
      .update({ rating: newRating })
      .eq('id', id)
      .eq('profile_id', profile?.id);

    if (error) {
      console.error('[PwaChat] failed to update rating:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === id ? { ...msg, rating: null } : msg
      ));
    }
  }, [profile?.id]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-message', {
        body: { message_id: messageId },
      });
      if (error) {
        console.error('[PwaChat] failed to delete message:', error);
        return;
      }
      // Remove message from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      // Invalidate cache so next full load reflects the deletion
      queryClient.invalidateQueries({ queryKey: ['pwa-history'] });
    } catch (err) {
      console.error('[PwaChat] delete message error:', err);
    }
  }, [queryClient]);

  // Confirmation handlers for policy-gated actions
  const handleConfirm = useCallback(async (messageId: string, action: NonNullable<PwaMessage['metadata']>['pendingAction']) => {
    if (!action) return;
    setIsLoading(true);
    setLoadingLabel('working');
    try {
      const response = await supabase.functions.invoke('pwa-agent', {
        body: {
          message: `(User confirmed: ${action.tool_name})`,
          confirmationGranted: true,
          skipInboundSave: true,
        },
      });
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const lines = responseText.split('\n').filter((l: string) => l.trim());
      let resultReply = '';
      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          if (evt.event === 'done') resultReply = evt.data?.reply || '';
        } catch { /* ignore */ }
      }
      if (!resultReply && response.data?.reply) resultReply = response.data.reply;
      // Replace the confirmation message with the result
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: resultReply || 'Done.', metadata: undefined } : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: 'Something went wrong. Please try again.', metadata: undefined } : m
      ));
    } finally {
      setIsLoading(false);
      setLoadingLabel('');
    }
  }, []);

  const handleReject = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, content: 'Action rejected.', metadata: undefined } : m
    ));
  }, []);

  // Send message to pwa-agent
  const sendMessage = useCallback(
    async (text: string, media?: { type: string; data: string }[], extraBody?: Record<string, unknown>) => {
      if (!isOnline) {
        setErrorMsg("You're offline. Connect to the internet to chat.");
        return;
      }

      setHasSentMessage(true);
      setIsLoading(true);
      setLoadingLabel('thinking');
      setErrorMsg(null);
      setPendingUserMessage(text !== '(photo)' ? text : '(photo sent)');

      const userMsg: PwaMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        media
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error('Not authenticated');
        }

        const body: Record<string, unknown> = { message: text, ...extraBody };
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

        let replyData: { reply: string; mediaToSend: any[]; structuredResults?: Record<string, any>; pendingAction?: any } | null = null;

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

        // Handle confirmation-required actions
        if (replyData.pendingAction) {
          const action = replyData.pendingAction;
          const confirmMsg: PwaMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: action.reason,
            createdAt: new Date().toISOString(),
            metadata: { pendingAction: action },
          };
          setMessages(prev => [...prev, confirmMsg]);
          setIsLoading(false);
          setLoadingLabel('');
          setPendingUserMessage(null);
          return;
        }

        const reply = replyData.reply || '';
        const images = (replyData.mediaToSend || [])
          .filter((m: any) => m.url)
          .map((m: any) => ({ url: m.url, caption: m.caption || '' }));
        const structuredResults = replyData.structuredResults || undefined;

        // Build metadata for rich content
        const metadata: PwaMessage['metadata'] = {};
        if (images.length > 0) metadata.images = images;
        if (structuredResults && (structuredResults.products?.length > 0 || structuredResults.stores?.length > 0)) {
          metadata.shopping = structuredResults;
        }

        const assistantMsg: PwaMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString(),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
        setMessages(prev => [...prev, assistantMsg]);
        setPendingUserMessage(null);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setErrorMsg(detail);
        setPendingUserMessage(null);
        // Remove optimistically added user message
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      } finally {
        setIsLoading(false);
        setLoadingLabel('thinking');
      }
    },
    [messages, isOnline, toolLabel],
  );

  sendMessageRef.current = sendMessage;

  const handleMicClick = useCallback(() => {
    prewarmMicPermission(); // fire in user-gesture context so iOS shows dialog immediately
    navigate('/call');
  }, [navigate]);

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
          <PwaChatStack
            messages={messages}
            isLoading={isLoading}
            loadingLabel={loadingLabel}
            pendingUserMessage={pendingUserMessage}
            currentFormation={currentFormation}
            onCopy={handleCopy}
            onResend={handleResend}
            onRate={handleRate}
            onDelete={handleDeleteMessage}
            onSuggestedAction={(text) => sendMessageRef.current(text)}
            onConfirm={handleConfirm}
            onReject={handleReject}
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

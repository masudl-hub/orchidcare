import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { DemoInputBar } from '@/components/demo/DemoInputBar';
import { ChatMessageStack, type ArtifactEntry } from '@/components/demo/ChatMessageStack';
import { ChatResponse } from '@/components/demo/artifacts/ChatResponse';
import { ShoppingResults } from './ShoppingResults';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { prewarmMicPermission } from '@/hooks/call/useAudioCapture';
import { WifiOff } from 'lucide-react';

const mono = 'ui-monospace, monospace';

// Resolve a media URL from storage, always generating a fresh signed URL.
// New format: "bucket:path" (e.g. "plant-photos:snapshots/abc/def/123.jpg")
// Legacy format: full Supabase signed URL (expired after 1h — extract path and refresh)
// External URLs (Telegram CDN, etc.) are returned as-is.
async function resolveMediaUrl(url: string): Promise<string> {
  if (!url) return '';

  // New bucket:path format
  if (!url.startsWith('https://') && url.includes(':')) {
    const colonIdx = url.indexOf(':');
    const bucket = url.slice(0, colonIdx);
    const path = url.slice(colonIdx + 1);
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  }

  // Legacy Supabase signed URL — extract bucket + path and regenerate
  const storageMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
  if (storageMatch) {
    const bucket = storageMatch[1];
    const path = decodeURIComponent(storageMatch[2]);
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? url;
  }

  // External URL (Telegram CDN, etc.) — return as-is
  return url;
}

interface PwaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  rating?: number | null;
  media?: { type: string; data: string }[];
  pendingAction?: { tool_name: string; args: Record<string, unknown>; reason: string; tier: string };
}

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
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('thinking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [canvasHeightPct, setCanvasHeightPct] = useState(getCanvasHeightPercent);

  const artifactIdCounter = useRef(0);
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
        .select('id, content, direction, created_at, media_urls, rating')
        .eq('profile_id', profile!.id)
        .eq('channel', 'pwa')
        .order('created_at', { ascending: true });

      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000, // cached for 5 min — new messages appended locally
  });

  // Hydrate messages + artifacts from cached query data
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
      }));
      setMessages(historyMessages);
      setHasSentMessage(true);

      // Create chat artifacts for history (async for media URL resolution)
      (async () => {
        const historyArtifacts: ArtifactEntry[] = [];
        for (let i = 0; i < historyData.length; i++) {
          if (historyData[i].direction === 'outbound') {
            const userMsg = i > 0 && historyData[i - 1].direction === 'inbound' ? historyData[i - 1].content : undefined;
            const rawUrls: string[] = historyData[i].media_urls || [];
            const images = rawUrls.length > 0
              ? (await Promise.all(rawUrls.map(async (url) => ({ url: await resolveMediaUrl(url), title: 'Image' })))).filter(img => img.url)
              : undefined;

            // Resolve user media URLs from the preceding inbound message
            let userImageUrls: string[] | undefined;
            if (i > 0 && historyData[i - 1].direction === 'inbound') {
              const userRawUrls: string[] = historyData[i - 1].media_urls || [];
              if (userRawUrls.length > 0) {
                const resolved = await Promise.all(userRawUrls.map(resolveMediaUrl));
                userImageUrls = resolved.filter(Boolean);
              }
            }

            historyArtifacts.push({
              id: historyData[i].id,
              element: <ChatResponse text={historyData[i].content} images={images} />,
              userMessage: userMsg,
              userMessageId: i > 0 && historyData[i - 1].direction === 'inbound' ? historyData[i - 1].id : undefined,
              userImageUrls,
              artifactType: 'chat',
              artifactData: { text: historyData[i].content },
              responseMessage: historyData[i].content,
              createdAt: historyData[i].created_at,
              rating: historyData[i].rating,
            });
          }
        }
        setArtifacts(historyArtifacts);
        artifactIdCounter.current = historyArtifacts.length;
      })();
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
  const renderArtifact = useCallback(
    (_type: string, _data: Record<string, unknown>, message: string, images?: { url: string; title: string }[], structuredResults?: Record<string, any>): React.ReactNode => {
      const hasShoppingResults = structuredResults && (structuredResults.products?.length > 0 || structuredResults.stores?.length > 0);
      return (
        <>
          <ChatResponse text={message} images={images?.map(img => ({ url: img.url, title: img.title }))} />
          {hasShoppingResults && (
            <ShoppingResults
              products={structuredResults.products}
              productSearchQuery={structuredResults.productSearchQuery}
              stores={structuredResults.stores}
              storeSearchQuery={structuredResults.storeSearchQuery}
              storeLocation={structuredResults.storeLocation}
            />
          )}
        </>
      );
    },
    [],
  );

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
    // Optimistic UI update
    setArtifacts(prev => prev.map(art =>
      art.id === id ? { ...art, rating: newRating } : art
    ));
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, rating: newRating } : msg
    ));

    // Persist to DB
    const { error } = await supabase
      .from('conversations')
      .update({ rating: newRating })
      .eq('id', id)
      .eq('profile_id', profile?.id); // Basic security check

    if (error) {
      console.error('[PwaChat] failed to update rating:', error);
      // Revert on failure
      setArtifacts(prev => prev.map(art =>
        art.id === id ? { ...art, rating: null } : art
      ));
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
      // Remove any artifacts associated with this message (as assistant response or user message)
      setArtifacts(prev => prev.filter(art => art.id !== messageId && art.userMessageId !== messageId));
      // Invalidate cache so next full load reflects the deletion
      queryClient.invalidateQueries({ queryKey: ['pwa-history'] });
    } catch (err) {
      console.error('[PwaChat] delete message error:', err);
    }
  }, [queryClient]);

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
          const confirmId = crypto.randomUUID();
          const confirmTime = new Date().toISOString();
          const confirmMsg: PwaMessage = {
            id: confirmId,
            role: 'assistant',
            content: action.reason,
            createdAt: confirmTime,
            pendingAction: action,
          };
          setMessages(prev => [...prev, confirmMsg]);

          // Create artifact with Allow/Reject buttons
          const confirmArtifact: ArtifactEntry = {
            id: `artifact-confirm-${confirmId}`,
            element: (
              <div>
                <ChatResponse text={action.reason} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={async () => {
                      // Direct API call with confirmation — don't create a new user message
                      setIsLoading(true);
                      setLoadingLabel('working');
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
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
                        // Replace confirmation artifact with the result
                        setMessages(prev => prev.map(m =>
                          m.id === confirmId ? { ...m, content: resultReply || 'Done.', pendingAction: undefined } : m
                        ));
                        setArtifacts(prev => prev.map(a =>
                          a.id === `artifact-confirm-${confirmId}`
                            ? { ...a, element: <ChatResponse text={resultReply || 'Done.'} />, responseMessage: resultReply }
                            : a
                        ));
                      } catch (err) {
                        setMessages(prev => prev.map(m =>
                          m.id === confirmId ? { ...m, content: 'Something went wrong. Please try again.', pendingAction: undefined } : m
                        ));
                        setArtifacts(prev => prev.map(a =>
                          a.id === `artifact-confirm-${confirmId}`
                            ? { ...a, element: <ChatResponse text="Something went wrong. Please try again." /> }
                            : a
                        ));
                      } finally {
                        setIsLoading(false);
                        setLoadingLabel('');
                        setPendingUserMessage(null);
                      }
                    }}
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '12px',
                      padding: '6px 16px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => {
                      setMessages(prev => prev.filter(m => m.id !== confirmId));
                      setArtifacts(prev => prev.filter(a => a.id !== `artifact-confirm-${confirmId}`));
                      const rejectMsg: PwaMessage = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: 'Action rejected.',
                        createdAt: new Date().toISOString(),
                      };
                      setMessages(prev => [...prev, rejectMsg]);
                    }}
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '12px',
                      padding: '6px 16px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ),
            userMessage: text !== '(photo)' ? text : undefined,
            userMessageId: userMsg.id,
            artifactType: 'chat',
            artifactData: { text: action.reason },
            responseMessage: action.reason,
            createdAt: confirmTime,
          };
          setArtifacts(prev => [...prev, confirmArtifact]);
          setIsLoading(false);
          setLoadingLabel('');
          setPendingUserMessage(null);
          return;
        }

        const reply = replyData.reply || '';

        // Extract images from mediaToSend
        const images = (replyData.mediaToSend || [])
          .filter((m: any) => m.url)
          .map((m: any) => ({ url: m.url, title: m.caption || '' }));

        // Add assistant message
        const newId = crypto.randomUUID();
        const newTime = new Date().toISOString();

        const assistantMsg: PwaMessage = {
          id: newId,
          role: 'assistant',
          content: reply,
          createdAt: newTime,
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Render with images and/or structured shopping results if available
        const structuredResults = replyData.structuredResults || undefined;

        const element = images.length > 0
          ? renderArtifact('chat', { text: reply }, reply, images, structuredResults)
          : renderArtifact('chat', { text: reply }, reply, undefined, structuredResults);

        const newArtifact: ArtifactEntry = {
          id: `artifact-${++artifactIdCounter.current}`,
          element,
          userMessage: text !== '(photo)' ? text : undefined,
          userMessageId: userMsg.id,
          userImageUrls: media && media.length > 0
            ? media.map(m => `data:${m.type};base64,${m.data}`)
            : undefined,
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
          <ChatMessageStack
            artifacts={artifacts}
            isLoading={isLoading}
            loadingLabel={loadingLabel}
            pendingUserMessage={pendingUserMessage}
            currentFormation={currentFormation}
            onCopy={handleCopy}
            onResend={handleResend}
            onRate={handleRate}
            onDelete={handleDeleteMessage}
            onSuggestedAction={(text) => sendMessageRef.current(text)}
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

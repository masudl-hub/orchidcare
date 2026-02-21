import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CallScreen } from '@/components/call/CallScreen';
import { CallErrorBoundary } from '@/components/call/CallErrorBoundary';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/ui/back-button';
import { RefreshCcw, ArrowLeft } from 'lucide-react';

function LiveCallPageInner() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const endedRef = useRef(false);

  const gemini = useGeminiLive();

  // Get Telegram WebApp SDK
  const getTelegram = useCallback(() => {
    return (window as any).Telegram?.WebApp;
  }, []);

  const getInitData = useCallback(() => {
    const tg = getTelegram();
    return tg?.initData || '';
  }, [getTelegram]);

  const handleRetry = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
  };

  const handleBack = () => {
    const tg = getTelegram();
    if (tg?.initData) {
      tg.close();
    } else {
      navigate(-1);
    }
  };

  // Initialize: create session + get token + connect
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const init = async () => {
      try {
        setError(null);
        const initData = getInitData();
        let authToken: string | null = null;

        if (!initData) {
          // Attempt Web/PWA Auth fallback
          const { data: { session } } = await supabase.auth.getSession();
          if (signal.aborted) return;
          if (session?.access_token) {
            authToken = session.access_token;
          } else {
            setError('This page is a Telegram Mini App. Open it from the /call command in @orchidcare_bot, or sign in to your Orchid account.');
            return;
          }
        }

        // Expand the Mini App
        const tg = getTelegram();
        tg?.expand?.();
        tg?.setHeaderColor?.('#000000');
        tg?.setBackgroundColor?.('#000000');

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Create session
        const createRes = await fetch(`${SUPABASE_URL}/functions/v1/call-session/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ initData: initData || undefined }),
          signal,
        });
        if (signal.aborted) return;
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create session');
        setSessionId(createData.sessionId);

        // Get ephemeral token
        const tokenRes = await fetch(`${SUPABASE_URL}/functions/v1/call-session/token`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ sessionId: createData.sessionId, initData: initData || undefined }),
          signal,
        });
        if (signal.aborted) return;
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to get token');
        if (!tokenData?.token) throw new Error('No ephemeral token received');

        // Final guard: don't connect if user already ended the call
        if (signal.aborted || endedRef.current) return;

        // Connect to Gemini Live
        gemini.connect(tokenData.token, createData.sessionId, initData || undefined, {
          onReconnectNeeded: async () => {
            try {
              const tokenRes = await fetch(`${SUPABASE_URL}/functions/v1/call-session/token`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sessionId: createData.sessionId, initData: initData || undefined }),
              });
              const tokenData2 = await tokenRes.json();
              if (!tokenRes.ok || !tokenData2?.token) return null;
              return tokenData2.token;
            } catch {
              return null;
            }
          },
        });
      } catch (err) {
        if (signal.aborted) return; // ignore errors from aborted fetches
        console.error('[LiveCall] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to start call');
      }
    };

    init();

    // Cancel in-flight fetches on unmount or when retryCount changes
    return () => controller.abort();
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    if (gemini.status !== 'connected') return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [gemini.status]);

  // End call handler — guarded against multiple calls
  const handleEndCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;

    gemini.disconnect();
    if (sessionId) {
      try {
        const initData = getInitData();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (!initData) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }

        await fetch(`${SUPABASE_URL}/functions/v1/call-session/end`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            initData: initData || undefined,
            durationSeconds: callDuration,
            transcript: gemini.transcript.current,
          }),
        });
      } catch (err) {
        console.error('[LiveCall] End session error:', err);
      }
    }
    // Close Mini App (Telegram) or navigate to chat (web/PWA)
    const tg = getTelegram();
    if (tg?.initData) {
      tg.close?.();
    } else {
      navigate('/chat');
    }
  }, [gemini.disconnect, sessionId, callDuration, getInitData, getTelegram, navigate]);

  // Permission denied — clean "ended" state with friendly message
  const isPermissionDenied = gemini.status === 'ended' && gemini.errorDetail?.includes('rejected');
  if (isPermissionDenied) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '16px',
      }}>
        <p style={{
          fontFamily: 'ui-monospace, monospace',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '14px',
          textAlign: 'center',
        }}>
          {gemini.errorDetail}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleBack}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '0',
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>
      </div>
    );
  }

  // Show error state with debug details (visible in Mini App since we can't see console)
  const showError = error || gemini.status === 'error';
  const errorMessage = error || gemini.errorDetail || 'Unknown error';

  if (showError) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '16px',
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '13px',
          textAlign: 'center',
          maxWidth: '90vw',
        }}>
          <p style={{ color: '#d91e1e', marginBottom: '12px', fontSize: '14px' }}>Connection failed</p>
          <p style={{ marginBottom: '16px', wordBreak: 'break-word' }}>{errorMessage}</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleBack}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <button
            onClick={handleRetry}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '0',
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCcw size={14} />
            Retry
          </button>
        </div>

        {/* Debug log — visible so we can diagnose Mini App issues */}
        {gemini.debugLog.length > 0 && (
          <div style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.25)',
            textAlign: 'left',
            maxWidth: '90vw',
            maxHeight: '30vh',
            overflow: 'auto',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '8px',
            borderRadius: '2px',
            wordBreak: 'break-all',
            marginTop: '12px',
          }}>
            {gemini.debugLog.map((line, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>{line}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <CallScreen
      status={gemini.status}
      isSpeaking={gemini.isSpeaking}
      isListening={gemini.isListening}
      isMuted={gemini.isMuted}
      isVideoActive={gemini.isVideoActive}
      videoStream={gemini.videoStream}
      isToolExecuting={gemini.isToolExecuting}
      executingToolName={gemini.executingToolName}
      outputAudioLevel={gemini.outputAudioLevel}
      callDuration={callDuration}
      formation={gemini.currentFormation}
      onFormationComplete={() => gemini.setCurrentFormation(null)}
      annotations={gemini.currentAnnotations}
      onAnnotationsComplete={() => gemini.setCurrentAnnotations(null)}
      facingMode={gemini.facingMode}
      onToggleMic={gemini.toggleMic}
      onToggleVideo={gemini.toggleVideo}
      onToggleFacingMode={gemini.toggleFacingMode}
      onEndCall={handleEndCall}
      onCaptureSnapshot={gemini.captureSnapshot}
      onInterrupt={gemini.interruptModel}
    />
  );
}

export default function LiveCallPage() {
  return (
    <CallErrorBoundary>
      <LiveCallPageInner />
    </CallErrorBoundary>
  );
}

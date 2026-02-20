import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CallScreen } from '@/components/call/CallScreen';
import { useGeminiLive } from '@/hooks/useGeminiLive';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const MAX_CALL_SECONDS = 120; // 2 minutes

interface DemoVoiceOverlayProps {
  demoToken: string;
  voiceTurnsRemaining: number;
  onEnd: (newDemoToken: string) => void;
  onError: (error: string) => void;
}

export function DemoVoiceOverlay({
  demoToken,
  voiceTurnsRemaining,
  onEnd,
  onError,
}: DemoVoiceOverlayProps) {
  const gemini = useGeminiLive();
  const [callDuration, setCallDuration] = useState(0);
  const newTokenRef = useRef<string>(demoToken);
  const endedRef = useRef(false);
  const autoDisconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Fetch ephemeral voice token and connect
  // -------------------------------------------------------------------------
  useEffect(() => {
    const abort = new AbortController();

    async function init() {
      try {
        console.log('[DemoVoice] Fetching voice token...');
        const res = await fetch(`${SUPABASE_URL}/functions/v1/demo-agent/voice-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demoToken }),
          signal: abort.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('[DemoVoice] Token request failed:', res.status, errData);
          throw new Error(errData.message || errData.error || `Voice token request failed (${res.status})`);
        }

        const data = await res.json();
        const ephemeralToken = data.token;
        const updatedDemoToken = data.demoToken || demoToken;
        console.log('[DemoVoice] Token received, length:', ephemeralToken?.length);

        if (!ephemeralToken) throw new Error('No ephemeral token received');

        newTokenRef.current = updatedDemoToken;

        const sessionId = crypto.randomUUID();
        console.log('[DemoVoice] Connecting to Gemini Live...');
        await gemini.connect(ephemeralToken, sessionId, '', {
          toolsUrl: `${SUPABASE_URL}/functions/v1/demo-agent/voice-tools`,
          extraAuth: { demoToken: updatedDemoToken },
        });
        console.log('[DemoVoice] connect() returned');
      } catch (err) {
        // AbortController.abort() causes an AbortError — ignore it silently
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[DemoVoice] Init error:', err);
        if (!abort.signal.aborted) {
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();

    return () => { abort.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Call duration timer
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gemini.status !== 'connected') return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [gemini.status]);

  // -------------------------------------------------------------------------
  // Auto-disconnect after 2 minutes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gemini.status !== 'connected') return;

    autoDisconnectRef.current = setTimeout(() => {
      if (!endedRef.current) {
        handleEndCall();
      }
    }, MAX_CALL_SECONDS * 1000);

    return () => {
      if (autoDisconnectRef.current) {
        clearTimeout(autoDisconnectRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gemini.status]);

  // -------------------------------------------------------------------------
  // Handle connection ending (SDK close / error)
  // -------------------------------------------------------------------------
  useEffect(() => {
    console.log(`[DemoVoice] Status: ${gemini.status}${gemini.errorDetail ? ` — ${gemini.errorDetail}` : ''}`);
    if (gemini.status === 'ended' && !endedRef.current) {
      endedRef.current = true;
      onEnd(newTokenRef.current);
    }
    if (gemini.status === 'error' && !endedRef.current) {
      console.error('[DemoVoice] Error, closing overlay:', gemini.errorDetail);
      endedRef.current = true;
      onError(gemini.errorDetail || 'Voice connection failed');
    }
  }, [gemini.status, gemini.errorDetail, onEnd, onError]);

  // -------------------------------------------------------------------------
  // End call handler
  // -------------------------------------------------------------------------
  const handleEndCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;

    if (autoDisconnectRef.current) {
      clearTimeout(autoDisconnectRef.current);
    }

    gemini.disconnect();
    onEnd(newTokenRef.current);
  }, [gemini, onEnd]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
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
        facingMode={gemini.facingMode}
        onToggleMic={gemini.toggleMic}
        onToggleVideo={gemini.toggleVideo}
        onToggleFacingMode={gemini.toggleFacingMode}
        onEndCall={handleEndCall}
      />

      {/* Voice turns remaining — demo-specific overlay */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 110,
        textAlign: 'center',
        paddingBottom: `max(16px, env(safe-area-inset-bottom))`,
        pointerEvents: 'none',
      }}>
        <p style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.05em',
          margin: 0,
        }}>
          {voiceTurnsRemaining} of 3 voice turns remaining
        </p>
      </div>
    </div>
  );
}

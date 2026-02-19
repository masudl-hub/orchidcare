import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CallScreen } from '@/components/call/CallScreen';
import { CallErrorBoundary } from '@/components/call/CallErrorBoundary';
import { useGeminiLive } from '@/hooks/useGeminiLive';

const mono = 'ui-monospace, monospace';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

const VOICES = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'] as const;

const DEFAULT_SYSTEM_PROMPT = `You are Orchid, a warm and knowledgeable plant care assistant.
You speak naturally with a friendly, encouraging tone. You help people take care of their plants.
Keep responses concise and conversational — this is a voice call, not a text chat.`;

const STORAGE_KEYS = {
  apiKey: 'orchid-dev-gemini-key',
  devSecret: 'orchid-dev-secret',
  chatId: 'orchid-dev-chat-id',
  mode: 'orchid-dev-mode',
};

type Mode = 'quick' | 'full';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '0',
  padding: '10px 12px',
  fontFamily: mono,
  fontSize: '12px',
  color: '#fff',
  outline: 'none',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DevCallPageInner() {
  // Config state
  const [mode, setMode] = useState<Mode>(() =>
    (localStorage.getItem(STORAGE_KEYS.mode) as Mode) || 'quick'
  );
  const [apiKey, setApiKey] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.apiKey) || import.meta.env.VITE_GEMINI_API_KEY || ''
  );
  const [devSecret, setDevSecret] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.devSecret) || ''
  );
  const [chatId, setChatId] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.chatId) || ''
  );
  const [voice, setVoice] = useState<string>('Aoede');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [callDuration, setCallDuration] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const endedRef = useRef(false);
  const sessionIdRef = useRef<string>('');

  const gemini = useGeminiLive();

  // Persist config
  useEffect(() => {
    if (apiKey) localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
  }, [apiKey]);
  useEffect(() => {
    if (devSecret) localStorage.setItem(STORAGE_KEYS.devSecret, devSecret);
  }, [devSecret]);
  useEffect(() => {
    if (chatId) localStorage.setItem(STORAGE_KEYS.chatId, chatId);
  }, [chatId]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.mode, mode);
  }, [mode]);

  // Timer
  useEffect(() => {
    if (gemini.status !== 'connected') return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [gemini.status]);

  // ---------------------------------------------------------------------------
  // Quick mode start — client-side token, no tools
  // ---------------------------------------------------------------------------
  const startQuick = useCallback(async () => {
    if (!apiKey.trim()) { setInitError('Enter a Gemini API key'); return; }

    const genai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const token = await genai.authTokens.create({
      config: {
        uses: 1,
        liveConnectConstraints: {
          model: GEMINI_MODEL,
          config: {
            responseModalities: ['AUDIO'] as any,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contextWindowCompression: { triggerTokens: 25600 as any, slidingWindow: { targetTokens: 12800 as any } },
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    const ephemeralToken = token.name;
    if (!ephemeralToken) throw new Error('token.name is empty');

    setInCall(true);
    gemini.connect(ephemeralToken, 'dev-session', '');
  }, [apiKey, voice, systemPrompt, gemini]);

  // ---------------------------------------------------------------------------
  // Full mode start — edge function creates session + token with full context
  // ---------------------------------------------------------------------------
  const startFull = useCallback(async () => {
    if (!devSecret.trim() || !chatId.trim()) {
      setInitError('Enter both Dev Secret and Telegram Chat ID');
      return;
    }

    // Request mic access NOW while the user gesture is still fresh.
    // getUserMedia must be called close to the click event — if we wait
    // for edge function calls, the gesture expires and the browser blocks it.
    await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });

    const devAuth = { devSecret: devSecret.trim(), telegramChatId: Number(chatId.trim()) };
    const proxyBase = `${SUPABASE_URL}/functions/v1/dev-call-proxy`;

    // 1. Create session
    const createRes = await fetch(`${proxyBase}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(devAuth),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || 'Failed to create session');
    sessionIdRef.current = createData.sessionId;

    // 2. Get token (server-side — includes full context, tools, system prompt)
    const tokenRes = await fetch(`${proxyBase}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...devAuth, sessionId: createData.sessionId }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to get token');
    if (!tokenData.token) throw new Error('No ephemeral token received');

    // 3. Connect — route tool calls through dev-call-proxy
    setInCall(true);
    gemini.connect(tokenData.token, createData.sessionId, '', {
      toolsUrl: `${proxyBase}/tools`,
      extraAuth: devAuth,
    });
  }, [devSecret, chatId, gemini]);

  // ---------------------------------------------------------------------------
  // Start handler (dispatches to mode)
  // ---------------------------------------------------------------------------
  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setInitError(null);
    setCallDuration(0);
    endedRef.current = false;

    try {
      if (mode === 'full') {
        await startFull();
      } else {
        await startQuick();
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setInitError(detail);
    } finally {
      setIsStarting(false);
    }
  }, [mode, startQuick, startFull]);

  // ---------------------------------------------------------------------------
  // End call
  // ---------------------------------------------------------------------------
  const handleEndCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    gemini.disconnect();

    // End session on server in full mode
    if (mode === 'full' && sessionIdRef.current) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/dev-call-proxy/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            devSecret: devSecret.trim(),
            telegramChatId: Number(chatId.trim()),
            sessionId: sessionIdRef.current,
            durationSeconds: callDuration,
          }),
        });
      } catch { /* best effort */ }
    }
    setInCall(false);
  }, [gemini, mode, devSecret, chatId, callDuration]);

  // ---- CALL VIEW ----
  if (inCall && gemini.status !== 'error') {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
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
          onToggleMic={gemini.toggleMic}
          onToggleVideo={gemini.toggleVideo}
          onEndCall={handleEndCall}
        />

        {/* Debug drawer — right edge */}
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          display: 'flex', flexDirection: 'row', pointerEvents: 'none',
        }}>
          <button
            onClick={() => setShowDebug(d => !d)}
            style={{
              alignSelf: 'center', pointerEvents: 'auto',
              backgroundColor: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRight: showDebug ? 'none' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0', color: 'rgba(255,255,255,0.4)',
              fontFamily: mono, fontSize: '9px', padding: '12px 4px',
              cursor: 'pointer', writingMode: 'vertical-rl', letterSpacing: '0.1em',
            }}
          >LOG</button>
          <div style={{
            width: showDebug ? '280px' : '0px', overflow: 'hidden',
            transition: 'width 200ms ease', pointerEvents: 'auto',
          }}>
            <div style={{
              width: '280px', height: '100%',
              backgroundColor: 'rgba(0,0,0,0.92)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              padding: '48px 10px 10px', fontFamily: mono, fontSize: '10px',
              color: 'rgba(255,255,255,0.4)', overflow: 'auto', wordBreak: 'break-all',
            }}>
              {gemini.debugLog.map((line, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- CONFIG VIEW ----
  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px', fontFamily: mono,
    }}>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '14px', fontFamily: mono, fontWeight: 'bold', color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            DEV CALL
          </h1>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
            local test harness — bypasses telegram
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '0' }}>
          {(['quick', 'full'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                backgroundColor: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#000' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${mode === m ? '#fff' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '0',
                padding: '10px',
                fontFamily: mono,
                fontSize: '11px',
                fontWeight: mode === m ? 'bold' : 'normal',
                cursor: 'pointer',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: 'all 100ms',
              }}
            >
              {m === 'quick' ? 'Quick (audio)' : 'Full (tools)'}
            </button>
          ))}
        </div>

        {/* Quick mode fields */}
        {mode === 'quick' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Gemini API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="AIza..." style={inputStyle} />
            </div>

            {/* Voice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Voice</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {VOICES.map(v => (
                  <button key={v} onClick={() => setVoice(v)} style={{
                    backgroundColor: voice === v ? '#fff' : 'transparent',
                    color: voice === v ? '#000' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${voice === v ? '#fff' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '0', padding: '6px 12px', fontFamily: mono,
                    fontSize: '11px', cursor: 'pointer', transition: 'all 100ms',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* System Prompt */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>System Prompt</label>
              <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                rows={4} style={{ ...inputStyle, fontSize: '11px', color: 'rgba(255,255,255,0.7)', resize: 'vertical', lineHeight: '1.5' }} />
            </div>
          </>
        )}

        {/* Full mode fields */}
        {mode === 'full' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Dev Secret</label>
              <input type="password" value={devSecret} onChange={e => setDevSecret(e.target.value)}
                placeholder="your-secret-here" style={inputStyle} />
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
                set via: supabase secrets set DEV_AUTH_SECRET=...
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Telegram Chat ID</label>
              <input type="text" value={chatId} onChange={e => setChatId(e.target.value)}
                placeholder="123456789" style={inputStyle} />
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
                your numeric Telegram user ID
              </span>
            </div>

            <div style={{
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '10px 12px',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.3)',
              lineHeight: '1.6',
            }}>
              Full mode uses your real profile, plants, and all tools.
              Token + system prompt are built server-side (same as production).
              <br />Deploy once: <span style={{ color: 'rgba(255,255,255,0.5)' }}>supabase functions deploy dev-call-proxy</span>
            </div>
          </>
        )}

        {/* Error */}
        {(initError || (inCall && gemini.status === 'error')) && (
          <div style={{ border: '1px solid rgba(217,30,30,0.5)', padding: '12px', fontSize: '11px', color: '#d91e1e', wordBreak: 'break-word' }}>
            {initError || gemini.errorDetail || 'Connection failed'}
          </div>
        )}

        {/* Debug log on error */}
        {inCall && gemini.status === 'error' && gemini.debugLog.length > 0 && (
          <div style={{ maxHeight: '30vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.35)', wordBreak: 'break-all' }}>
            {gemini.debugLog.map((line, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>{line}</div>
            ))}
          </div>
        )}

        {/* Start / Back button */}
        {inCall && gemini.status === 'error' ? (
          <button onClick={() => setInCall(false)} style={{
            backgroundColor: 'transparent', border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '0', padding: '14px', fontFamily: mono, fontSize: '12px',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>BACK TO CONFIG</button>
        ) : (
          <button onClick={handleStart} disabled={isStarting} style={{
            backgroundColor: '#fff', border: '2px solid #fff', borderRadius: '0',
            padding: '14px', fontFamily: mono, fontSize: '12px', fontWeight: 'bold',
            color: '#000', cursor: isStarting ? 'wait' : 'pointer', letterSpacing: '0.08em',
            textTransform: 'uppercase', opacity: isStarting ? 0.5 : 1, transition: 'opacity 150ms',
          }}>
            {isStarting ? 'CONNECTING...' : 'START CALL'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DevCallPage() {
  return (
    <CallErrorBoundary>
      <DevCallPageInner />
    </CallErrorBoundary>
  );
}

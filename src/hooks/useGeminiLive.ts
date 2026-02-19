import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { Session, LiveServerMessage } from '@google/genai';
import { useAudioPlayback } from './call/useAudioPlayback';
import { useAudioCapture } from './call/useAudioCapture';
import { useVideoCapture } from './call/useVideoCapture';
import type { ConnectionStatus, AnnotationSet, AnnotationMarker } from './call/types';
import type { Formation, TransitionType } from '@/lib/pixel-canvas/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Model is constrained by the ephemeral token (server-side).
// This must match the model used in call-session/token.
const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

export function useGeminiLive() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isToolExecuting, setIsToolExecuting] = useState(false);
  const [executingToolName, setExecutingToolName] = useState<string>('');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null);
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationSet | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const sessionIdRef = useRef<string>('');
  const initDataRef = useRef<string>('');
  const toolsUrlRef = useRef(`${SUPABASE_URL}/functions/v1/call-session/tools`);
  const extraAuthRef = useRef<Record<string, unknown>>({});
  const connectingRef = useRef(false);
  const connectedRef = useRef(false);
  const greetingSentRef = useRef(false);

  const playback = useAudioPlayback();
  const capture = useAudioCapture();
  const video = useVideoCapture();

  // ---------------------------------------------------------------------------
  // Debug logger — writes to both console and in-app debug log
  // ---------------------------------------------------------------------------
  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().substring(11, 23);
    const line = `${ts} ${msg}`;
    console.log(`[GeminiLive] ${msg}`);
    setDebugLog(prev => [...prev.slice(-30), line]);
  }, []);

  // ---------------------------------------------------------------------------
  // Tool call bridge — forwards tool calls to the Supabase edge function,
  // then sends responses back via the SDK session
  // ---------------------------------------------------------------------------
  const handleToolCallRef = useRef<(message: LiveServerMessage) => void>(() => {});

  useEffect(() => {
    handleToolCallRef.current = async (message: LiveServerMessage) => {
      const functionCalls = message.toolCall?.functionCalls || [];
      if (functionCalls.length === 0) return;

      // Separate client-side (show_visual) from server-side tool calls
      const clientResponses: { id: string; name: string; response: Record<string, unknown> }[] = [];
      const serverCalls: typeof functionCalls = [];

      for (const fc of functionCalls) {
        if (fc.name === 'show_visual') {
          // Handle client-side — no network round-trip
          const args = fc.args as Record<string, unknown>;
          const formation: Formation = {
            type: (args.type as Formation['type']) || 'template',
            id: args.id as string | undefined,
            text: args.text as string | undefined,
            items: args.items as string[] | undefined,
            transition: (args.transition as TransitionType) || undefined,
            duration: args.duration != null ? Number(args.duration) : undefined,
            hold: args.hold != null ? Number(args.hold) : undefined,
          };
          setCurrentFormation(formation);
          clientResponses.push({ id: fc.id!, name: fc.name!, response: { displayed: true } });
          log(`show_visual handled client-side: type=${formation.type}, id=${formation.id || 'n/a'}`);
        } else if (fc.name === 'annotate_view') {
          // Handle client-side — no network round-trip
          const aArgs = fc.args as Record<string, unknown>;
          const annotationSet: AnnotationSet = {
            markers: (aArgs.markers as AnnotationMarker[]) || [],
            hold: aArgs.hold != null ? Number(aArgs.hold) : undefined,
          };
          setCurrentAnnotations(annotationSet);
          clientResponses.push({ id: fc.id!, name: fc.name!, response: { displayed: true } });
          log(`annotate_view handled client-side: ${annotationSet.markers.length} markers`);
        } else {
          serverCalls.push(fc);
        }
      }

      // Send immediate responses for client-side tools
      if (clientResponses.length > 0 && sessionRef.current) {
        sessionRef.current.sendToolResponse({ functionResponses: clientResponses });
      }

      // Process server-side tools
      if (serverCalls.length > 0) {
        const toolNames = serverCalls.map(fc => fc.name).filter(Boolean);
        setExecutingToolName(toolNames[0] || 'working');
        setIsToolExecuting(true);

        const serverResponses = await Promise.all(
          serverCalls.map(async (fc) => {
            try {
              const res = await fetch(toolsUrlRef.current, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: sessionIdRef.current,
                  initData: initDataRef.current,
                  toolName: fc.name,
                  toolArgs: fc.args,
                  toolCallId: fc.id,
                  ...extraAuthRef.current,
                }),
              });
              const data = await res.json();
              return { id: fc.id!, name: fc.name!, response: data.result || data };
            } catch (err) {
              return { id: fc.id!, name: fc.name!, response: { error: String(err) } };
            }
          })
        );

        if (sessionRef.current) {
          sessionRef.current.sendToolResponse({ functionResponses: serverResponses });
        }
        setIsToolExecuting(false);
        setExecutingToolName('');
      }
    };
  }, [log]);

  // ---------------------------------------------------------------------------
  // Message handler ref — avoids stale closures in the onmessage callback
  // ---------------------------------------------------------------------------
  const handleMessageRef = useRef<(msg: LiveServerMessage) => void>(() => {});

  useEffect(() => {
    handleMessageRef.current = (message: LiveServerMessage) => {
      // Route audio parts to playback
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            // Decode base64 audio -> Int16 -> Float32
            const binary = atob(part.inlineData.data!);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 32768;
            }
            playback.enqueueAudio(float32);
          }
        }
      }

      // Handle interruption — user spoke while model was responding
      if (message.serverContent?.interrupted) {
        playback.flush();
      }

      // Route tool calls to bridge
      if (message.toolCall) {
        handleToolCallRef.current(message);
      }

      // Detect user speaking (VAD)
      if (message.serverContent?.inputTranscription) {
        setIsListening(true);
        setTimeout(() => setIsListening(false), 500);
      }

      // On setupComplete — send a minimal turn to trigger the model's greeting.
      // A bare { turnComplete: true } without turns causes 1007 on the 12-2025
      // model, so we include actual turns content per the documented API pattern.
      // Guard with greetingSentRef to prevent StrictMode double-greeting.
      if ((message as any).setupComplete && sessionRef.current && !greetingSentRef.current) {
        greetingSentRef.current = true;
        log('Setup complete — sending greeting trigger');
        sessionRef.current.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: '(call connected)' }] }],
          turnComplete: true,
        });
      }
    };
  }, [playback.enqueueAudio, playback.flush, log]);

  // ---------------------------------------------------------------------------
  // connect — orchestrates playback, capture, and SDK session setup
  // ---------------------------------------------------------------------------
  const connect = useCallback(async (token: string, sessionId: string, initData: string, options?: { toolsUrl?: string; extraAuth?: Record<string, unknown> }) => {
    // Re-entrancy guard
    if (connectingRef.current || sessionRef.current) {
      log('connect() skipped — already connecting or connected');
      return;
    }
    connectingRef.current = true;
    greetingSentRef.current = false;

    sessionIdRef.current = sessionId;
    initDataRef.current = initData;
    toolsUrlRef.current = options?.toolsUrl || `${SUPABASE_URL}/functions/v1/call-session/tools`;
    extraAuthRef.current = options?.extraAuth || {};
    setStatus('connecting');
    setErrorDetail('');
    log(`connect() start — token=${token.substring(0, 25)}..., sessionId=${sessionId}`);

    try {
      // 1. Start audio output (24 kHz playback context)
      log('Starting playback context (24kHz)...');
      playback.startPlayback();
      log('Playback context started');

      // 2. Start microphone capture (own 16 kHz context)
      log('Requesting microphone access (16kHz)...');
      try {
        await capture.startCapture();
        log('Microphone access GRANTED');
      } catch (micErr) {
        const detail = micErr instanceof Error ? `${micErr.name}: ${micErr.message}` : String(micErr);
        log(`Microphone access FAILED: ${detail}`);
        setErrorDetail(`Mic error: ${detail}`);
        setStatus('error');
        connectingRef.current = false;
        return;
      }

      // 3. Connect to Gemini Live via SDK (ephemeral token as apiKey)
      log('Creating GoogleGenAI client with ephemeral token...');
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });

      log(`Calling ai.live.connect() — model=${GEMINI_MODEL}`);
      const session = await ai.live.connect({
        model: GEMINI_MODEL,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {
            log('SDK: session OPENED');
          },
          onmessage: (message: LiveServerMessage) => {
            const keys = Object.keys(message).join(', ');
            // Log full message structure (strip audio binary data to keep it readable)
            try {
              const sanitized = JSON.parse(JSON.stringify(message, (k, v) => {
                if (k === 'data' && typeof v === 'string' && v.length > 100) return `<${v.length} chars>`;
                return v;
              }));
              log(`SDK msg: [${keys}] ${JSON.stringify(sanitized)}`);
            } catch {
              log(`SDK msg: [${keys}]`);
            }
            handleMessageRef.current(message);
          },
          onerror: (e: ErrorEvent) => {
            const detail = e.message || 'Unknown SDK error';
            log(`SDK ERROR: type=${e.type}, message="${detail}"`);
            setErrorDetail(detail);
            setStatus('error');
          },
          onclose: (e: CloseEvent) => {
            log(`SDK CLOSED: code=${e.code}, reason="${e.reason}", wasClean=${e.wasClean}, url=${(e.target as WebSocket)?.url || 'n/a'}`);
            sessionRef.current = null;
            if (connectedRef.current) {
              connectedRef.current = false;
              setStatus('ended');
            } else {
              setErrorDetail(`Connection closed (code=${e.code}, reason="${e.reason || 'none'}")`);
              setStatus('error');
            }
          },
        },
      });

      sessionRef.current = session;
      connectedRef.current = true;
      log('SDK session connected — READY');
      setStatus('connected');

      // Play a subtle connection chime via the output AudioContext
      try {
        const ctx = playback.audioContext;
        if (ctx) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch { /* chime is non-critical */ }

      // 4. Wire capture output -> Gemini via SDK
      // Google's example uses `media` key (not `audio`) for sendRealtimeInput
      let audioChunkCount = 0;
      capture.onAudioData.current = (base64: string) => {
        if (sessionRef.current) {
          audioChunkCount++;
          if (audioChunkCount <= 3 || audioChunkCount % 50 === 0) {
            log(`Sending audio chunk #${audioChunkCount} (${base64.length} chars)`);
          }
          sessionRef.current.sendRealtimeInput({
            media: { data: base64, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      };
      log('Audio capture wired to session');

    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      log(`Connect error: ${detail}`);
      setErrorDetail(detail);
      setStatus('error');
    } finally {
      connectingRef.current = false;
    }
  }, [log, playback.startPlayback, capture.startCapture, capture.onAudioData]);

  // ---------------------------------------------------------------------------
  // toggleVideo — starts/stops camera and wires frames to SDK session
  // ---------------------------------------------------------------------------
  const toggleVideo = useCallback(async () => {
    if (video.isActive) {
      video.onVideoFrame.current = null;
      video.stopCapture();
      log('Video stopped');
    } else {
      log('Starting video capture (rear camera)...');
      try {
        await video.startCapture();
        video.onVideoFrame.current = (base64: string) => {
          if (sessionRef.current) {
            sessionRef.current.sendRealtimeInput({
              media: { data: base64, mimeType: 'image/jpeg' },
            });
          }
        };
        log('Video capture STARTED');
      } catch (err) {
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        log(`Video capture FAILED: ${detail}`);
      }
    }
  }, [video.isActive, video.startCapture, video.stopCapture, video.onVideoFrame, log]);

  // ---------------------------------------------------------------------------
  // disconnect — tears down SDK session, video, capture, and playback
  // ---------------------------------------------------------------------------
  const disconnect = useCallback(() => {
    // Only transition to 'ended' if we actually had a live session.
    // This prevents StrictMode's unmount→remount from falsely ending
    // the overlay before the connection is even established.
    const wasConnected = connectedRef.current;
    connectedRef.current = false;

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch { /* ignore */ }
      sessionRef.current = null;
    }

    // Remove capture callbacks
    capture.onAudioData.current = null;
    video.onVideoFrame.current = null;

    // Stop mic + worklet + capture AudioContext
    capture.stopCapture();

    // Stop video capture
    video.stopCapture();

    // Stop audio output + animation
    playback.stopPlayback();

    if (wasConnected) {
      setStatus('ended');
    }
    setIsListening(false);
  }, [capture.onAudioData, capture.stopCapture, video.onVideoFrame, video.stopCapture, playback.stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    status,
    isSpeaking: playback.isSpeaking,
    isListening,
    isMuted: capture.isMuted,
    isVideoActive: video.isActive,
    videoStream: video.videoStream,
    isToolExecuting,
    executingToolName,
    outputAudioLevel: playback.outputAudioLevel,
    errorDetail,
    debugLog,
    currentFormation,
    setCurrentFormation,
    currentAnnotations,
    setCurrentAnnotations,
    connect,
    disconnect,
    toggleMic: capture.toggleMic,
    toggleVideo,
  };
}

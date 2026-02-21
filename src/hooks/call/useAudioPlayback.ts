import { useState, useRef, useCallback } from 'react';

interface UseAudioPlaybackReturn {
  isSpeaking: boolean;
  /** Synchronous ref — always current, safe to read inside callbacks/closures. */
  isSpeakingRef: React.RefObject<boolean>;
  outputAudioLevel: number;
  audioContext: AudioContext | null;
  startPlayback: () => AudioContext;
  stopPlayback: () => void;
  enqueueAudio: (pcmData: Float32Array) => void;
  /** Flush queue and stop all active sources (for interruption handling). */
  flush: () => void;
  /** MediaStream carrying agent audio — available after startPlayback(), for recording. */
  recordingStream: React.MutableRefObject<MediaStreamAudioDestinationNode | null>;
}

export function useAudioPlayback(): UseAudioPlaybackReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const isSpeakingRef = useRef(false);

  // Helper to keep ref in sync with state
  const setSpeaking = (value: boolean) => {
    isSpeakingRef.current = value;
    setIsSpeaking(value);
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Audio playback — scheduled gapless approach (like Google's example)
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  // -----------------------------------------------------------------------
  // scheduleAudio — schedules a buffer for gapless playback
  // -----------------------------------------------------------------------
  const scheduleAudio = useCallback((pcmData: Float32Array) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Ensure we don't schedule in the past
    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

    const buffer = ctx.createBuffer(1, pcmData.length, 24000);
    buffer.getChannelData(0).set(pcmData);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current || ctx.destination);

    source.addEventListener('ended', () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setSpeaking(false);
      }
    });

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    activeSourcesRef.current.add(source);
    setSpeaking(true);
  }, []);

  // -----------------------------------------------------------------------
  // flush — stop all active sources and clear queue (interruption handling)
  // -----------------------------------------------------------------------
  const flush = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setSpeaking(false);
  }, []);

  // -----------------------------------------------------------------------
  // startPlayback — creates AudioContext (24 kHz), AnalyserNode, level loop
  // -----------------------------------------------------------------------
  const startPlayback = useCallback((): AudioContext => {
    // Idempotent: reuse existing context if still alive (e.g. during reconnect)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }

    const audioContext = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = audioContext;

    // Resume AudioContext — required on iOS where it starts suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(audioContext.destination);
    analyserRef.current = analyser;

    // Create a MediaStreamDestination for recording agent audio
    const recordDest = audioContext.createMediaStreamDestination();
    analyser.connect(recordDest);
    recordDestRef.current = recordDest;

    // Start analyser animation loop for avatar visualization
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;
      setOutputAudioLevel(avg);
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return audioContext;
  }, []);

  // -----------------------------------------------------------------------
  // stopPlayback — closes AudioContext, cancels animation frame, resets
  // -----------------------------------------------------------------------
  const stopPlayback = useCallback(() => {
    flush();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    analyserRef.current = null;
    recordDestRef.current = null;
    setOutputAudioLevel(0);
  }, [flush]);

  // -----------------------------------------------------------------------
  // enqueueAudio — schedules PCM data for gapless playback
  // -----------------------------------------------------------------------
  const enqueueAudio = useCallback((pcmData: Float32Array) => {
    scheduleAudio(pcmData);
  }, [scheduleAudio]);

  return {
    isSpeaking,
    isSpeakingRef,
    outputAudioLevel,
    audioContext: audioContextRef.current,
    startPlayback,
    stopPlayback,
    enqueueAudio,
    flush,
    recordingStream: recordDestRef,
  };
}

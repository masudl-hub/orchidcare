import { useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Efficient Uint8Array to base64 (chunked to avoid stack overflow on large buffers). */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Create a blob URL for the PCM processor AudioWorklet. */
function createPCMProcessorURL(bufferSize: number): string {
  const code = `
    class PCMProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.bufferSize = ${bufferSize};
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }

      process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channel = input[0];
        for (let i = 0; i < channel.length; i++) {
          this.buffer[this.bufferIndex++] = channel[i];
          if (this.bufferIndex >= this.bufferSize) {
            this.port.postMessage(this.buffer.slice());
            this.bufferIndex = 0;
          }
        }
        return true;
      }
    }

    registerProcessor('pcm-processor', PCMProcessor);
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseAudioCaptureOptions {
  sampleRate?: number;  // default 16000
  bufferSize?: number;  // default 2048
}

interface UseAudioCaptureReturn {
  isMuted: boolean;
  toggleMic: () => void;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  /** Parent sets this ref to receive PCM audio as base64. */
  onAudioData: React.MutableRefObject<((base64: string) => void) | null>;
  /** Raw mic MediaStream — available after startCapture(), null after stopCapture(). */
  stream: React.MutableRefObject<MediaStream | null>;
}

export function useAudioCapture(options?: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const sampleRate = options?.sampleRate ?? 16000;
  const bufferSize = options?.bufferSize ?? 2048;

  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  /** Callback ref — parent hook sets this to forward audio to the session. */
  const onAudioData = useRef<((base64: string) => void) | null>(null);

  // -----------------------------------------------------------------------
  // startCapture — acquires mic, sets up AudioWorklet, wires PCM pipeline
  // Creates its own AudioContext at the target sample rate (default 16kHz)
  // so capture runs independently of the playback context (24kHz).
  // -----------------------------------------------------------------------
  const startCapture = useCallback(async () => {
    const audioContext = new AudioContext({ sampleRate });
    audioContextRef.current = audioContext;

    // iOS requires explicit resume (AudioContext starts suspended)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;

    const processorUrl = createPCMProcessorURL(bufferSize);
    blobUrlRef.current = processorUrl;
    await audioContext.audioWorklet.addModule(processorUrl);

    const audioSource = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (isMutedRef.current) return;
      if (!onAudioData.current) return;

      const float32: Float32Array = e.data;

      // Float32 -> Int16
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Int16 -> base64 (chunked, no stack overflow)
      const base64 = uint8ToBase64(new Uint8Array(int16.buffer));
      onAudioData.current(base64);
    };

    audioSource.connect(workletNode);
    // Connect worklet to destination to keep audio graph alive (required on iOS/Safari).
    // The worklet outputs silence — no audible effect.
    workletNode.connect(audioContext.destination);
  }, [sampleRate, bufferSize]);

  // -----------------------------------------------------------------------
  // stopCapture — tears down mic, worklet, blob URL
  // -----------------------------------------------------------------------
  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // toggleMic — mutes/unmutes both the ref gate and the media stream track
  // -----------------------------------------------------------------------
  const toggleMic = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      isMutedRef.current = newMuted;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => {
          t.enabled = !newMuted;
        });
      }
      return newMuted;
    });
  }, []);

  return { isMuted, toggleMic, startCapture, stopCapture, onAudioData, stream: streamRef };
}

import { useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Hook — captures video frames from the rear camera and delivers as base64 JPEG
// ---------------------------------------------------------------------------

interface UseVideoCaptureReturn {
  isActive: boolean;
  videoStream: MediaStream | null;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  /** Parent sets this ref to receive JPEG frames as base64. */
  onVideoFrame: React.MutableRefObject<((base64: string) => void) | null>;
}

export function useVideoCapture(): UseVideoCaptureReturn {
  const [isActive, setIsActive] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  /** Callback ref — parent hook sets this to forward frames to the session. */
  const onVideoFrame = useRef<((base64: string) => void) | null>(null);

  // -----------------------------------------------------------------------
  // startCapture — acquires rear camera, starts 1fps frame capture
  // -----------------------------------------------------------------------
  const startCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // prefer rear camera (user showing plant)
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    streamRef.current = stream;
    setVideoStream(stream);

    // Create offscreen video element for frame capture
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play();
    videoElRef.current = video;

    // Create offscreen canvas for JPEG encoding
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvasRef.current = canvas;

    // Capture frames at ~1fps
    intervalRef.current = setInterval(() => {
      if (!onVideoFrame.current || !videoElRef.current || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoElRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
      // Strip "data:image/jpeg;base64," prefix
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        onVideoFrame.current(base64);
      }
    }, 1000);

    setIsActive(true);
  }, []);

  // -----------------------------------------------------------------------
  // stopCapture — releases camera, cleans up
  // -----------------------------------------------------------------------
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    canvasRef.current = null;
    setVideoStream(null);
    setIsActive(false);
  }, []);

  return { isActive, videoStream, startCapture, stopCapture, onVideoFrame };
}

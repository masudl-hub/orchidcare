import { useState, useRef, useCallback, type MutableRefObject } from 'react';

// ---------------------------------------------------------------------------
// Hook — captures video frames from the rear camera and delivers as base64 JPEG
// ---------------------------------------------------------------------------

interface UseVideoCaptureReturn {
  isActive: boolean;
  videoStream: MediaStream | null;
  /** Last captured frame as a data URL (updated at 1fps, null when inactive). */
  lastFrameDataUrl: string | null;
  /** Ref version of lastFrameDataUrl — always current inside closures. */
  lastFrameDataUrlRef: MutableRefObject<string | null>;
  /** Triggers the OS camera permission prompt without starting capture. */
  requestPermission: () => Promise<void>;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  /** Parent sets this ref to receive JPEG frames as base64. */
  onVideoFrame: MutableRefObject<((base64: string) => void) | null>;
  facingMode: 'environment' | 'user';
  toggleFacingMode: () => Promise<void>;
  /**
   * Capture a single high-resolution frame from the live camera at native
   * resolution and JPEG quality 0.95. Returns a data URL, or null if the
   * camera isn't active.
   */
  captureHighResFrame: () => string | null;
}

export function useVideoCapture(): UseVideoCaptureReturn {
  const [isActive, setIsActive] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [lastFrameDataUrl, setLastFrameDataUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  /** Ref mirror of lastFrameDataUrl — always current inside closures (no stale capture). */
  const lastFrameDataUrlRef = useRef<string | null>(null);

  /** Callback ref — parent hook sets this to forward frames to the session. */
  const onVideoFrame = useRef<((base64: string) => void) | null>(null);

  // -----------------------------------------------------------------------
  // Helper — starts the 1fps capture interval with portrait crop logic
  // -----------------------------------------------------------------------
  function startInterval(canvas: HTMLCanvasElement) {
    intervalRef.current = setInterval(() => {
      // Only require the video element and canvas — NOT onVideoFrame.
      // This ensures lastFrameDataUrlRef is always populated when the
      // camera is active, even if onVideoFrame hasn't been wired yet.
      if (!videoElRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const vw = videoElRef.current.videoWidth || canvas.width;
      const vh = videoElRef.current.videoHeight || canvas.height;
      const displayAspect = window.innerWidth / window.innerHeight;
      const videoAspect = vw / vh;

      let sx = 0, sy = 0, sw = vw, sh = vh;
      if (videoAspect > displayAspect) {
        sw = Math.round(vh * displayAspect);
        sx = Math.round((vw - sw) / 2);
      } else {
        sh = Math.round(vw / displayAspect);
        sy = Math.round((vh - sh) / 2);
      }
      ctx.drawImage(videoElRef.current, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setLastFrameDataUrl(dataUrl);
      lastFrameDataUrlRef.current = dataUrl;

      // Optionally forward to the live session (Gemini realtime input)
      const base64 = dataUrl.split(',')[1];
      if (base64 && onVideoFrame.current) {
        onVideoFrame.current(base64);
      }
    }, 1000);
  }

  // -----------------------------------------------------------------------
  // captureHighResFrame — grabs a single frame at native camera resolution
  // -----------------------------------------------------------------------
  const captureHighResFrame = useCallback((): string | null => {
    const video = videoElRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  }, []);

  // -----------------------------------------------------------------------
  // requestPermission — triggers the OS camera prompt without capturing
  // -----------------------------------------------------------------------
  const requestPermission = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
  }, []);

  // -----------------------------------------------------------------------
  // startCapture — acquires camera, starts 1fps frame capture
  // -----------------------------------------------------------------------
  const startCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
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

    // Create offscreen canvas matching the actual display aspect ratio.
    // This ensures the frame sent to the LLM looks exactly like what the user sees
    // (objectFit:cover on the viewport), so annotation grid positions are accurate.
    const canvas = document.createElement('canvas');
    const displayAspect = window.innerWidth / window.innerHeight;
    if (displayAspect >= 1) {
      canvas.width = 640;
      canvas.height = Math.round(640 / displayAspect);
    } else {
      canvas.height = 640;
      canvas.width = Math.round(640 * displayAspect);
    }
    canvasRef.current = canvas;

    // Capture frames at ~1fps
    startInterval(canvas);

    setIsActive(true);
  }, [facingMode]);

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
    setLastFrameDataUrl(null);
    lastFrameDataUrlRef.current = null;
    setIsActive(false);
  }, []);

  // -----------------------------------------------------------------------
  // toggleFacingMode — switches between front and rear camera
  // -----------------------------------------------------------------------
  const toggleFacingMode = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.srcObject = null;
    }

    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch (err) {
      streamRef.current = null;
      videoElRef.current = null;
      setVideoStream(null);
      setLastFrameDataUrl(null);
      setIsActive(false);
      throw err;
    }
    streamRef.current = newStream;
    setVideoStream(newStream);

    const video = document.createElement('video');
    video.srcObject = newStream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play();
    videoElRef.current = video;

    setFacingMode(newMode);

    const canvas = canvasRef.current;
    if (!canvas) return;
    startInterval(canvas);
  }, [facingMode]);

  return { isActive, videoStream, lastFrameDataUrl, lastFrameDataUrlRef, requestPermission, startCapture, stopCapture, onVideoFrame, facingMode, toggleFacingMode, captureHighResFrame };
}

import React, { useRef, useEffect, useState } from 'react';

interface OrchidAvatarProps {
  isSpeaking: boolean;
  isListening: boolean;
  outputAudioLevel: number;
  isThinking: boolean;
}

interface Pixel {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  active: boolean;
}

export function OrchidAvatar({ isSpeaking, isListening, outputAudioLevel, isThinking }: OrchidAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  const CANVAS_SIZE = 200;
  const GRID_COLS = 25;
  const GRID_ROWS = 35;
  const PIXEL_SIZE = Math.floor(CANVAS_SIZE / GRID_COLS);

  // Load orchid image and sample into pixel grid
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_pixel_bw_light.png';
    img.onload = () => {
      // Sample the image into a boolean grid
      const offscreen = document.createElement('canvas');
      offscreen.width = GRID_COLS;
      offscreen.height = GRID_ROWS;
      const ctx = offscreen.getContext('2d')!;
      ctx.drawImage(img, 0, 0, GRID_COLS, GRID_ROWS);
      const imageData = ctx.getImageData(0, 0, GRID_COLS, GRID_ROWS);

      const pixels: Pixel[] = [];
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const i = (y * GRID_COLS + x) * 4;
          // Check if pixel is dark (part of the orchid) — we'll render it as white on black
          const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
          const active = brightness < 128; // Dark pixels in original = orchid
          if (active) {
            pixels.push({
              x: x * PIXEL_SIZE,
              y: y * PIXEL_SIZE,
              baseX: x * PIXEL_SIZE,
              baseY: y * PIXEL_SIZE,
              active: true,
            });
          }
        }
      }

      pixelsRef.current = pixels;
      setImageLoaded(true);
    };
  }, [PIXEL_SIZE]);

  // Animation loop
  useEffect(() => {
    if (!imageLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;

    const animate = () => {
      timeRef.current += 0.016; // ~60fps
      const t = timeRef.current;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Breathe animation (always active)
      const breathe = 1 + Math.sin(t * 2.1) * 0.02; // 0.98-1.02

      for (const pixel of pixelsRef.current) {
        let px = pixel.baseX;
        let py = pixel.baseY;

        // Apply breathe (scale from center)
        px = centerX + (px - centerX) * breathe;
        py = centerY + (py - centerY) * breathe;

        if (isSpeaking) {
          // Displacement based on audio level — more at top (petals), less at bottom (stem)
          const distFromCenter = Math.sqrt(
            (pixel.baseX - centerX) ** 2 + (pixel.baseY - centerY) ** 2
          );
          const normalizedDist = distFromCenter / (CANVAS_SIZE / 2);
          const displacement = outputAudioLevel * 8 * normalizedDist;

          // Direction: outward from center
          const angle = Math.atan2(pixel.baseY - centerY, pixel.baseX - centerX);
          // Add some frequency-based variation
          const freq = Math.sin(t * 8 + pixel.baseX * 0.1) * 0.5 + 0.5;
          px += Math.cos(angle) * displacement * freq;
          py += Math.sin(angle) * displacement * freq;
        }

        if (isThinking) {
          // Slow random drift
          const drift = Math.sin(t * 0.5 + pixel.baseX * 0.3 + pixel.baseY * 0.2) * 3;
          px += drift;
          py += Math.cos(t * 0.7 + pixel.baseY * 0.3) * 2;
        }

        // Update pixel position with smoothing
        pixel.x += (px - pixel.x) * 0.15;
        pixel.y += (py - pixel.y) * 0.15;

        // Draw pixel
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.round(pixel.x), Math.round(pixel.y), PIXEL_SIZE - 1, PIXEL_SIZE - 1);
      }

      // Listening glow ring
      if (isListening) {
        const glowRadius = CANVAS_SIZE * 0.45;
        const glowAlpha = 0.15 + Math.sin(t * 4) * 0.1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${glowAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [imageLoaded, isSpeaking, isListening, isThinking, outputAudioLevel, CANVAS_SIZE, PIXEL_SIZE]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{
        width: `${CANVAS_SIZE}px`,
        height: `${CANVAS_SIZE}px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}

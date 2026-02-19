// PixelCanvas — PixiJS-powered pixel grid component
// Drop-in replacement for OrchidAvatar with formation morphing support.

import React, { useRef, useEffect } from 'react';
import {
  Application,
  ParticleContainer,
  Particle,
  Texture,
  Graphics,
} from 'pixi.js';

import { GRID_COLS, GRID_ROWS, ORCHID_SRC, type Formation } from './types';
import { FormationEngine } from './FormationEngine';
import { applyAnimations, listeningGlow, type AnimationParams, type AnimationContext } from './AnimationLayer';
import { sampleImage, gridToPositions } from './GridSampler';
import { registry } from './formations/registry';

export interface PixelCanvasProps {
  isSpeaking: boolean;
  isListening: boolean;
  outputAudioLevel: number;
  isThinking: boolean;
  formation: Formation | null;
  onFormationComplete?: () => void;
  /** Override the canvas height in pixels (defaults to 80% viewport height). */
  heightPx?: number;
}

// Cell size in grid-coordinate space.
// We work in grid coords internally (0..GRID_COLS, 0..GRID_ROWS) and scale
// the PIXI stage to fill the canvas at render time.
const CELL = 1;
const GAP = 1 / 7; // 1px gap at ~7px cell size ≈ 0.14 in grid coords

export function PixelCanvas({
  isSpeaking,
  isListening,
  outputAudioLevel,
  isThinking,
  formation,
  onFormationComplete,
  heightPx,
}: PixelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const engineRef = useRef<FormationEngine | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const bgParticlesRef = useRef<Particle[]>([]);
  const glowRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);
  const destroyedRef = useRef(false);
  const initedRef = useRef(false);

  // Store mutable props in refs so the ticker can read latest values
  // without needing to re-register callbacks.
  const propsRef = useRef({ isSpeaking, isListening, outputAudioLevel, isThinking });
  propsRef.current = { isSpeaking, isListening, outputAudioLevel, isThinking };

  const onFormationCompleteRef = useRef(onFormationComplete);
  onFormationCompleteRef.current = onFormationComplete;

  // Smoothed positions (LERP) — separate from engine positions
  const smoothX = useRef<Float32Array | null>(null);
  const smoothY = useRef<Float32Array | null>(null);

  // -----------------------------------------------------------------------
  // Init PixiJS Application and load orchid
  // -----------------------------------------------------------------------
  useEffect(() => {
    // Reset refs so StrictMode re-mount can proceed
    destroyedRef.current = false;

    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    async function setup() {
      const app = new Application();

      // Compute canvas dimensions: use heightPx override or 80% viewport height, 70:98 aspect
      const canvasHeight = heightPx ?? window.innerHeight * 0.8;
      const canvasWidth = Math.round(canvasHeight * (GRID_COLS / GRID_ROWS));

      try {
        await app.init({
          width: canvasWidth,
          height: canvasHeight,
          backgroundAlpha: 0,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
      } catch (e) {
        console.error('[PixelCanvas] app.init() FAILED:', e);
        return;
      }

      if (cancelled || destroyedRef.current) {
        app.destroy(true);
        return;
      }

      // Scale the stage so grid coordinates map to canvas pixels
      const scaleX = canvasWidth / GRID_COLS;
      const scaleY = canvasHeight / GRID_ROWS;
      app.stage.scale.set(scaleX, scaleY);

      // Canvas element styling
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.imageRendering = 'pixelated';
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      el.appendChild(canvas);
      appRef.current = app;

      // Create FormationEngine
      const engine = new FormationEngine();
      engineRef.current = engine;

      // Background particle container — dim pixels at EVERY grid cell.
      // The shape emerges from this living field of pixels.
      const bgPc = new ParticleContainer({
        dynamicProperties: { position: true, color: true },
        roundPixels: true,
      });
      app.stage.addChild(bgPc);

      // Glow graphics layer (for listening ring)
      const glow = new Graphics();
      glowRef.current = glow;
      app.stage.addChild(glow);

      // Foreground particle container — active pixels that move/morph
      const pc = new ParticleContainer({
        dynamicProperties: {
          position: true,
          color: true,
        },
        roundPixels: true,
      });
      app.stage.addChild(pc);

      // Create a white square texture for particles.
      const whiteTexture = createWhiteTexture(app);

      // Fill the entire grid with dim background pixels
      const bgParticles: Particle[] = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const p = new Particle({
            texture: whiteTexture,
            x: c,
            y: r,
            scaleX: CELL - GAP,
            scaleY: CELL - GAP,
            anchorX: 0,
            anchorY: 0,
            tint: 0xffffff,
            alpha: 0.03,
          });
          bgParticles.push(p);
          bgPc.addParticle(p);
        }
      }
      bgParticlesRef.current = bgParticles;

      // Load orchid image → sample → set home positions
      try {
        const result = await sampleImage(ORCHID_SRC, GRID_COLS, GRID_ROWS);
        if (cancelled || destroyedRef.current) return;

        const positions = gridToPositions(result.grid);
        console.log(`[PixelCanvas] sampled ${positions.length} active pixels`);
        engine.setHome(positions);

        // Create foreground particles for active pixels (these move/morph)
        const count = engine.getActiveCount();
        const particles: Particle[] = [];

        // Allocate smooth position buffers
        const sx = new Float32Array(count);
        const sy = new Float32Array(count);

        for (let i = 0; i < count; i++) {
          const p = new Particle({
            texture: whiteTexture,
            x: positions[i].x,
            y: positions[i].y,
            scaleX: CELL - GAP,
            scaleY: CELL - GAP,
            anchorX: 0,
            anchorY: 0,
            tint: 0xffffff,
            alpha: 1,
          });
          particles.push(p);
          pc.addParticle(p);

          sx[i] = positions[i].x;
          sy[i] = positions[i].y;
        }

        particlesRef.current = particles;
        smoothX.current = sx;
        smoothY.current = sy;

        // Wire up idle callback for onFormationComplete
        engine.onIdle = () => {
          onFormationCompleteRef.current?.();
        };

        console.log(`[PixelCanvas] created ${particles.length} particles, starting ticker`);
        // Start animation ticker
        app.ticker.add((ticker) => {
          if (destroyedRef.current) return;
          tick(ticker.deltaMS);
        });
      } catch (err) {
        console.error('[PixelCanvas] Failed to load orchid image:', err);
      }
    }

    setup();

    return () => {
      cancelled = true;
      destroyedRef.current = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      engineRef.current = null;
      particlesRef.current = [];
      bgParticlesRef.current = [];
      smoothX.current = null;
      smoothY.current = null;
      glowRef.current = null;
      // Clear the container so re-mount doesn't stack canvases
      if (el) el.innerHTML = '';
    };
  }, []); // mount-only

  // -----------------------------------------------------------------------
  // Handle formation changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (formation === null) {
      // Return to orchid home
      if (engine.getState() !== 'idle') {
        engine.morphBack();
      }
      return;
    }

    // Resolve formation to grid positions
    let positions: { x: number; y: number }[] | null = null;

    if (formation.pixels) {
      // Direct pixel grid provided
      positions = gridToPositions(formation.pixels);
    } else if ((formation.type === 'template' || formation.type === 'pixels') && formation.id) {
      // Look up precomputed template from registry
      const entry = registry.search(formation.id);
      if (entry) {
        positions = entry.positions;
      } else {
        console.warn(`[PixelCanvas] Formation template not found: ${formation.id}`);
      }
    }
    // Text, list, svg, compound types are not yet resolved here.
    // They require BitmapFont / SVG rasterizer (Phase 3).

    if (!positions || positions.length === 0) return;

    const transition = formation.transition ?? 'morph';
    const duration = formation.duration ?? 1200;
    const hold = formation.hold != null ? formation.hold * 1000 : 8000;

    if (engine.getState() !== 'idle') {
      engine.interrupt(positions, transition, duration, hold);
    } else {
      engine.morphTo(positions, transition, duration, hold);
    }
    ensureParticleCount();
  }, [formation]);

  // -----------------------------------------------------------------------
  // Ensure we have enough Particle objects for activeCount
  // -----------------------------------------------------------------------
  function ensureParticleCount() {
    const engine = engineRef.current;
    const app = appRef.current;
    if (!engine || !app) return;

    const needed = engine.getActiveCount();
    const current = particlesRef.current.length;

    if (needed <= current) return;

    // Get the particle container (second child after glow)
    const pc = app.stage.children[1] as ParticleContainer;
    if (!pc) return;

    const whiteTexture = particlesRef.current[0]?.texture ?? Texture.WHITE;

    // Extend smooth arrays
    const oldSx = smoothX.current!;
    const oldSy = smoothY.current!;
    const newSx = new Float32Array(needed);
    const newSy = new Float32Array(needed);
    newSx.set(oldSx);
    newSy.set(oldSy);
    smoothX.current = newSx;
    smoothY.current = newSy;

    for (let i = current; i < needed; i++) {
      const p = new Particle({
        texture: whiteTexture,
        x: engine.currentX[i],
        y: engine.currentY[i],
        scaleX: CELL - GAP,
        scaleY: CELL - GAP,
        anchorX: 0,
        anchorY: 0,
        tint: 0xffffff,
        alpha: 0,
      });
      particlesRef.current.push(p);
      pc.addParticle(p);
      newSx[i] = engine.currentX[i];
      newSy[i] = engine.currentY[i];
    }
  }

  // -----------------------------------------------------------------------
  // Tick function — called every frame via PIXI.Ticker
  // -----------------------------------------------------------------------
  function tick(dtMs: number) {
    const engine = engineRef.current;
    if (!engine) return;

    const dt = dtMs; // ms
    timeRef.current += dt / 1000;
    const t = timeRef.current;

    const props = propsRef.current;
    const particles = particlesRef.current;
    const sx = smoothX.current;
    const sy = smoothY.current;
    if (!sx || !sy) return;

    // 1. Advance formation engine
    engine.update(dt);

    // Ensure particle pool matches active count after engine update
    const activeCount = engine.getActiveCount();
    if (activeCount > particles.length) {
      ensureParticleCount();
    }

    // Animation context (in grid coordinates)
    const animCtx: AnimationContext = {
      centerX: GRID_COLS / 2,
      centerY: GRID_ROWS / 2,
      canvasWidth: GRID_COLS,
      canvasHeight: GRID_ROWS,
    };

    const animParams: AnimationParams = {
      isSpeaking: props.isSpeaking,
      isListening: props.isListening,
      audioLevel: props.outputAudioLevel,
      isThinking: props.isThinking,
    };

    // 2. For each active pixel: apply animations + LERP smoothing
    for (let i = 0; i < activeCount && i < particles.length; i++) {
      // Base position from engine (grid coords)
      const baseX = engine.currentX[i];
      const baseY = engine.currentY[i];

      // Apply animation modulations (breathe, speaking, thinking)
      // Uses homeX/homeY for spatial params regardless of formation
      const animated = applyAnimations(
        baseX, baseY,
        engine.homeX[i], engine.homeY[i],
        t,
        animParams,
        animCtx,
      );

      // LERP smoothing (factor 0.15)
      sx[i] += (animated.x - sx[i]) * 0.15;
      sy[i] += (animated.y - sy[i]) * 0.15;

      // Update particle position and alpha
      const p = particles[i];
      p.x = sx[i];
      p.y = sy[i];
      p.alpha = engine.opacity[i] * 0.75;
    }

    // Hide excess particles
    for (let i = activeCount; i < particles.length; i++) {
      particles[i].alpha = 0;
    }

    // 3. Animate background pixels — subtle twinkle
    const bgParticles = bgParticlesRef.current;
    if (bgParticles.length > 0) {
      // Base opacity with per-pixel phase offset for shimmer
      // Only update a subset each frame for performance (stagger by frame)
      const frameSlot = Math.floor(t * 60) % 4;
      for (let i = frameSlot; i < bgParticles.length; i += 4) {
        const row = Math.floor(i / GRID_COLS);
        const col = i % GRID_COLS;
        const phase = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
        const shimmer = 0.025 + Math.sin(t * 0.4 + (phase - Math.floor(phase)) * 6.28) * 0.015;
        bgParticles[i].alpha = shimmer;
      }
    }

    // 4. Listening glow ring (Graphics overlay)
    const glow = glowRef.current;
    if (glow) {
      glow.clear();
      if (props.isListening) {
        const g = listeningGlow(t, animCtx.centerX, animCtx.centerY, animCtx.canvasHeight);
        glow.circle(g.cx, g.cy, g.radius);
        glow.stroke({ color: 0xffffff, alpha: g.alpha, width: 2 / ((appRef.current?.stage.scale.x ?? 1) || 1) });
      }
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Helper: create a 1-cell white square texture using Texture.WHITE
// ---------------------------------------------------------------------------
function createWhiteTexture(_app: Application): Texture {
  // Texture.WHITE is a built-in 1x1 white pixel. Since we scale via
  // scaleX/scaleY on each particle, this is sufficient.
  return Texture.WHITE;
}

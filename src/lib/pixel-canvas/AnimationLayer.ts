// AnimationLayer — per-pixel animation modulations
// Pixels should feel ALIVE — drifting, scattering, reforming.
// Each pixel moves independently using its home position as a unique seed.

export interface AnimationParams {
  isSpeaking: boolean;
  isListening: boolean;
  audioLevel: number;
  isThinking: boolean;
}

export interface AnimationContext {
  centerX: number;
  centerY: number;
  canvasWidth: number;
  canvasHeight: number;
}

// ---------------------------------------------------------------------------
// Hash-like function for per-pixel deterministic randomness
// Given a home position, returns a stable "random" value 0–1
// ---------------------------------------------------------------------------
function pixelHash(hx: number, hy: number, seed: number): number {
  const n = Math.sin(hx * 127.1 + hy * 311.7 + seed * 73.13) * 43758.5453;
  return n - Math.floor(n);
}

// ---------------------------------------------------------------------------
// BREATHE — pixels gently wander away from home and drift back
// Each pixel gets its own drift pattern (phase, frequency, amplitude)
// Creates an organic "buzzing" feel, like the orchid is alive
// ---------------------------------------------------------------------------
function breathe(
  x: number,
  y: number,
  homeX: number,
  homeY: number,
  t: number,
): { x: number; y: number } {
  // Per-pixel unique phase offsets (deterministic from home position)
  const phaseX = pixelHash(homeX, homeY, 1.0) * 6.28;
  const phaseY = pixelHash(homeX, homeY, 2.0) * 6.28;

  // Per-pixel unique frequencies (vary between 0.3–0.8 Hz)
  const freqX = 0.3 + pixelHash(homeX, homeY, 3.0) * 0.5;
  const freqY = 0.4 + pixelHash(homeX, homeY, 4.0) * 0.4;

  // Amplitude: pixels at edges drift more (up to 1.5 grid cells)
  // Center pixels barely move
  const amp = 0.4 + pixelHash(homeX, homeY, 5.0) * 1.1;

  const dx = Math.sin(t * freqX + phaseX) * amp;
  const dy = Math.cos(t * freqY + phaseY) * amp * 0.7;

  // Add a secondary slower wave for organic feel
  const dx2 = Math.sin(t * 0.17 + homeY * 0.2) * 0.3;
  const dy2 = Math.cos(t * 0.13 + homeX * 0.2) * 0.3;

  return { x: x + dx + dx2, y: y + dy + dy2 };
}

// ---------------------------------------------------------------------------
// SPEAKING — pixels scatter outward based on audio level
// Higher audio = more scatter. Outer pixels fly further.
// Each pixel gets a unique scatter direction and magnitude.
// When audio drops, pixels rush back together.
// ---------------------------------------------------------------------------
function speaking(
  x: number,
  y: number,
  homeX: number,
  homeY: number,
  t: number,
  audioLevel: number,
  centerX: number,
  centerY: number,
  canvasHeight: number,
): { x: number; y: number } {
  const dx = homeX - centerX;
  const dy = homeY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = canvasHeight / 2;
  const normalizedDist = dist / maxDist;

  // Base radial angle from center
  const baseAngle = Math.atan2(dy, dx);

  // Per-pixel angle jitter (±30 degrees) — not all pixels push in exact same direction
  const angleJitter = (pixelHash(homeX, homeY, 10.0) - 0.5) * 1.05;
  const angle = baseAngle + angleJitter;

  // Per-pixel magnitude variance (some pixels fly further than others)
  const magScale = 0.5 + pixelHash(homeX, homeY, 11.0) * 1.0;

  // Displacement scales with audio level AND distance from center
  // Outer pixels move up to 6 grid cells at full volume
  const displacement = audioLevel * 6 * normalizedDist * magScale;

  // Pulsing frequency — per-pixel phase so they don't all pulse in sync
  const pulsePhase = pixelHash(homeX, homeY, 12.0) * 6.28;
  const pulse = 0.6 + Math.sin(t * 6 + pulsePhase) * 0.4;

  return {
    x: x + Math.cos(angle) * displacement * pulse,
    y: y + Math.sin(angle) * displacement * pulse,
  };
}

// ---------------------------------------------------------------------------
// THINKING — pixels dissociate and float dreamily
// The orchid "decomposes" into a loose cloud, then reforms.
// Much more dramatic than a subtle drift.
// ---------------------------------------------------------------------------
function thinking(
  x: number,
  y: number,
  homeX: number,
  homeY: number,
  t: number,
): { x: number; y: number } {
  // Per-pixel wander parameters
  const wanderPhaseX = pixelHash(homeX, homeY, 20.0) * 6.28;
  const wanderPhaseY = pixelHash(homeX, homeY, 21.0) * 6.28;
  const wanderAmp = 1.5 + pixelHash(homeX, homeY, 22.0) * 3.5; // 1.5–5 cells

  // Slow primary wander (0.2–0.5 Hz)
  const freqX = 0.2 + pixelHash(homeX, homeY, 23.0) * 0.3;
  const freqY = 0.25 + pixelHash(homeX, homeY, 24.0) * 0.25;
  const dx1 = Math.sin(t * freqX + wanderPhaseX) * wanderAmp;
  const dy1 = Math.cos(t * freqY + wanderPhaseY) * wanderAmp * 0.8;

  // Secondary drift — slower, larger arcs
  const dx2 = Math.sin(t * 0.1 + homeX * 0.15 + homeY * 0.1) * 2;
  const dy2 = Math.cos(t * 0.08 + homeY * 0.15) * 1.5;

  // Gentle vertical float (everything drifts upward slightly, like smoke)
  const float = Math.sin(t * 0.3 + pixelHash(homeX, homeY, 25.0) * 6.28) * 1.0 - 0.3;

  return {
    x: x + dx1 + dx2,
    y: y + dy1 + dy2 + float,
  };
}

// ---------------------------------------------------------------------------
// LISTENING GLOW — pulsing ring (rendered via Graphics overlay)
// ---------------------------------------------------------------------------
export function listeningGlow(
  t: number,
  centerX: number,
  centerY: number,
  canvasHeight: number,
): { cx: number; cy: number; radius: number; alpha: number } {
  const radius = canvasHeight * 0.45;
  const alpha = 0.15 + Math.sin(t * 4) * 0.1;
  return { cx: centerX, cy: centerY, radius, alpha };
}

// ---------------------------------------------------------------------------
// COMPOSITE — apply all active animations in sequence
// ---------------------------------------------------------------------------
export function applyAnimations(
  baseX: number,
  baseY: number,
  homeX: number,
  homeY: number,
  t: number,
  params: AnimationParams,
  ctx: AnimationContext,
): { x: number; y: number } {
  // Breathe — always active (per-pixel independent wander)
  let { x, y } = breathe(baseX, baseY, homeX, homeY, t);

  // Speaking — scatter outward with audio
  if (params.isSpeaking) {
    ({ x, y } = speaking(
      x, y,
      homeX, homeY,
      t,
      params.audioLevel,
      ctx.centerX, ctx.centerY,
      ctx.canvasHeight,
    ));
  }

  // Thinking — dissociate and float
  if (params.isThinking) {
    ({ x, y } = thinking(x, y, homeX, homeY, t));
  }

  return { x, y };
}

// FormationEngine — morph orchestrator for pixel formations
// Animates pixels between formations using Bezier curves
// Ported from: src/components/landing/qr-morph-canvas.tsx

import {
  MAX_PIXELS,
  type TransitionType,
  type EngineState,
} from './types';

// Cubic ease-out: 1 - (1-t)^3
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export class FormationEngine {
  // --- State machine ---
  private state: EngineState = 'idle';
  private progress = 0;       // 0-1, morph interpolation
  private duration = 1200;    // ms
  private holdTimer = 0;      // ms remaining; 0 = indefinite
  private transition: TransitionType = 'morph';
  private homeCount = 0;      // number of home (orchid) pixels — never changes after setHome
  private activeCount = 0;    // current total including unpaired targets (may expand during morph)
  private pairedCount = 0;    // number of paired source<->target pixels
  private targetCount = 0;    // number of target pixels (may differ from pairedCount)

  // --- Typed arrays (cache-friendly, one per pixel) ---
  readonly homeX = new Float32Array(MAX_PIXELS);
  readonly homeY = new Float32Array(MAX_PIXELS);
  readonly targetX = new Float32Array(MAX_PIXELS);
  readonly targetY = new Float32Array(MAX_PIXELS);
  readonly bezierCpX = new Float32Array(MAX_PIXELS);
  readonly bezierCpY = new Float32Array(MAX_PIXELS);
  readonly startDelay = new Float32Array(MAX_PIXELS);
  readonly opacity = new Float32Array(MAX_PIXELS);
  readonly currentX = new Float32Array(MAX_PIXELS);
  readonly currentY = new Float32Array(MAX_PIXELS);

  // Flags for unpaired pixels
  // Bit 0 = paired, Bit 1 = unpaired-source (fade out), Bit 2 = unpaired-target (fade in)
  private pairFlags = new Uint8Array(MAX_PIXELS);

  // Callback when a morph-back completes (returns to idle)
  onIdle: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getState(): EngineState {
    return this.state;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Set the orchid home positions — the permanent rest state.
   * Called once when the orchid grid is loaded.
   */
  setHome(positions: { x: number; y: number }[]): void {
    this.homeCount = Math.min(positions.length, MAX_PIXELS);
    this.activeCount = this.homeCount;
    for (let i = 0; i < this.activeCount; i++) {
      this.homeX[i] = positions[i].x;
      this.homeY[i] = positions[i].y;
      this.currentX[i] = positions[i].x;
      this.currentY[i] = positions[i].y;
      this.opacity[i] = 1;
    }
    // Zero out remaining slots
    for (let i = this.activeCount; i < MAX_PIXELS; i++) {
      this.homeX[i] = 0;
      this.homeY[i] = 0;
      this.currentX[i] = 0;
      this.currentY[i] = 0;
      this.opacity[i] = 0;
    }
  }

  /**
   * Begin morphing from the current state to a target formation.
   */
  morphTo(
    targetPositions: { x: number; y: number }[],
    transition: TransitionType = 'morph',
    duration = 1200,
    hold = 8000,
  ): void {
    this.transition = transition;
    this.duration = duration;
    this.holdTimer = hold;
    this.progress = 0;
    this.state = 'morphing_to';

    this.targetCount = targetPositions.length;
    this._pair(targetPositions, transition);
  }

  /**
   * Return to the orchid home formation.
   */
  morphBack(duration?: number): void {
    if (this.state === 'idle') return;
    if (duration !== undefined) this.duration = duration;
    this.state = 'morphing_back';
    // progress stays where it is — we'll decrement toward 0
  }

  /**
   * Interrupt current morph: snap to home then start new morph.
   */
  interrupt(
    targetPositions: { x: number; y: number }[],
    transition: TransitionType = 'morph',
    duration = 1200,
    hold = 8000,
  ): void {
    // Snap everything to home, restore original home count
    this.activeCount = this.homeCount;
    for (let i = 0; i < this.activeCount; i++) {
      this.currentX[i] = this.homeX[i];
      this.currentY[i] = this.homeY[i];
      this.opacity[i] = 1;
    }
    this.progress = 0;
    this.state = 'idle';

    // Start new morph
    this.morphTo(targetPositions, transition, duration, hold);
  }

  /**
   * Advance the state machine by dt milliseconds.
   * Call once per frame.
   */
  update(dt: number): void {
    switch (this.state) {
      case 'idle':
        // Nothing to do
        break;

      case 'morphing_to':
        this.progress += dt / this.duration;
        if (this.progress >= 1) {
          this.progress = 1;
          this.state = 'holding';
        }
        this._updatePositions();
        break;

      case 'holding':
        if (this.holdTimer > 0) {
          this.holdTimer -= dt;
          if (this.holdTimer <= 0) {
            this.holdTimer = 0;
            this.morphBack();
          }
        }
        // holdTimer === 0 from the start means indefinite — stay until explicit morphBack()
        // Positions are already at progress=1, but run update for consistency
        this._updatePositions();
        break;

      case 'morphing_back':
        this.progress -= dt / this.duration;
        if (this.progress <= 0) {
          this.progress = 0;
          this.state = 'idle';
          // Restore original home pixel count (drop unpaired targets)
          this.activeCount = this.homeCount;
          // Reset all opacities to 1 for home pixels
          for (let i = 0; i < this.activeCount; i++) {
            this.opacity[i] = 1;
            this.currentX[i] = this.homeX[i];
            this.currentY[i] = this.homeY[i];
          }
          this.onIdle?.();
        } else {
          this._updatePositions();
        }
        break;
    }
  }

  /**
   * Get the current rendered position for pixel i.
   */
  getPosition(i: number): { x: number; y: number } {
    return { x: this.currentX[i], y: this.currentY[i] };
  }

  /**
   * Get the current opacity for pixel i.
   */
  getOpacity(i: number): number {
    return this.opacity[i];
  }

  // ---------------------------------------------------------------------------
  // Private: pairing and Bezier setup
  // ---------------------------------------------------------------------------

  /**
   * Pair source (home) pixels with target pixels using nearest-neighbor.
   * Ported from qr-morph-canvas.tsx lines 123-161.
   */
  private _pair(
    targetPositions: { x: number; y: number }[],
    transition: TransitionType,
  ): void {
    // Use homeCount (not activeCount) — activeCount may include leftover unpaired targets
    const srcCount = this.homeCount;
    this.activeCount = srcCount; // reset before expanding
    const dstCount = Math.min(targetPositions.length, MAX_PIXELS);

    // Store target positions
    for (let i = 0; i < dstCount; i++) {
      this.targetX[i] = targetPositions[i].x;
      this.targetY[i] = targetPositions[i].y;
    }

    // Build shuffled index array for source pixels (randomized order)
    const srcIndices: number[] = [];
    for (let i = 0; i < srcCount; i++) srcIndices.push(i);
    for (let i = srcIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = srcIndices[i];
      srcIndices[i] = srcIndices[j];
      srcIndices[j] = tmp;
    }

    // Reset pair flags
    this.pairFlags.fill(0);

    // Nearest-neighbor pairing: each source pixel finds closest unpaired target
    const usedTarget = new Uint8Array(dstCount);
    let pairCount = 0;

    // temp arrays for the pairing result: pairMap[srcIdx] = dstIdx or -1
    const pairMap = new Int32Array(srcCount).fill(-1);

    for (const si of srcIndices) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let di = 0; di < dstCount; di++) {
        if (usedTarget[di]) continue;
        const dx = this.homeX[si] - targetPositions[di].x;
        const dy = this.homeY[si] - targetPositions[di].y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = di;
        }
      }
      if (bestIdx === -1) break; // no more targets
      usedTarget[bestIdx] = 1;
      pairMap[si] = bestIdx;
      pairCount++;
    }

    this.pairedCount = pairCount;

    // Compute Bezier control points and start delays for paired pixels
    for (let si = 0; si < srcCount; si++) {
      const di = pairMap[si];
      if (di >= 0) {
        // Paired pixel
        this.pairFlags[si] = 1; // paired
        this.targetX[si] = targetPositions[di].x;
        this.targetY[si] = targetPositions[di].y;

        this._computeBezierControlPoint(si, transition);
        this._computeStartDelay(si, transition);
        this.opacity[si] = 1;
      } else {
        // Unpaired source — will fade out
        this.pairFlags[si] = 2; // unpaired-source
        this.targetX[si] = this.homeX[si]; // stay in place
        this.targetY[si] = this.homeY[si];
        this.bezierCpX[si] = this.homeX[si];
        this.bezierCpY[si] = this.homeY[si];
        this.startDelay[si] = 0;
        this.opacity[si] = 1;
      }
    }

    // Handle unpaired target pixels — they need to fade in
    // We place them in slots beyond activeCount (up to MAX_PIXELS)
    let extraIdx = srcCount;
    for (let di = 0; di < dstCount; di++) {
      if (!usedTarget[di] && extraIdx < MAX_PIXELS) {
        this.pairFlags[extraIdx] = 4; // unpaired-target
        this.homeX[extraIdx] = targetPositions[di].x; // appear at target
        this.homeY[extraIdx] = targetPositions[di].y;
        this.targetX[extraIdx] = targetPositions[di].x;
        this.targetY[extraIdx] = targetPositions[di].y;
        this.bezierCpX[extraIdx] = targetPositions[di].x;
        this.bezierCpY[extraIdx] = targetPositions[di].y;
        this.currentX[extraIdx] = targetPositions[di].x;
        this.currentY[extraIdx] = targetPositions[di].y;
        this.startDelay[extraIdx] = 0;
        this.opacity[extraIdx] = 0; // start invisible
        extraIdx++;
      }
    }
    // Track total pixel count including unpaired targets
    this.activeCount = extraIdx;
  }

  /**
   * Compute quadratic Bezier control point perpendicular to src->dst direction.
   * Ported from qr-morph-canvas.tsx lines 145-159.
   */
  private _computeBezierControlPoint(i: number, transition: TransitionType): void {
    const srcX = this.homeX[i];
    const srcY = this.homeY[i];
    const dstX = this.targetX[i];
    const dstY = this.targetY[i];

    const midX = (srcX + dstX) / 2;
    const midY = (srcY + dstY) / 2;
    const dx = dstX - srcX;
    const dy = dstY - srcY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    let perpScale: number;
    switch (transition) {
      case 'scatter':
        // Higher variance for chaotic paths
        perpScale = (Math.random() - 0.5) * len * 1.5;
        break;
      case 'ripple':
      case 'morph':
      default:
        // Standard perpendicular offset (ported from qr-morph-canvas)
        // Scale is ~4 cell widths, using distance as proxy for cell size
        perpScale = (Math.random() - 0.5) * 30;
        break;
    }

    // Perpendicular to direction vector
    this.bezierCpX[i] = midX + (-dy / len) * perpScale;
    this.bezierCpY[i] = midY + (dx / len) * perpScale;
  }

  /**
   * Compute per-particle start delay based on transition type.
   */
  private _computeStartDelay(i: number, transition: TransitionType): void {
    switch (transition) {
      case 'ripple': {
        // Delay based on distance from grid center
        // Use homeX/homeY to compute relative distance
        const cx = 35; // GRID_COLS / 2
        const cy = 49; // GRID_ROWS / 2
        const dx = this.homeX[i] - cx;
        const dy = this.homeY[i] - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        this.startDelay[i] = (dist / maxDist) * 0.4;
        break;
      }
      case 'scatter':
        // Wider stagger range for scatter
        this.startDelay[i] = Math.random() * 0.3;
        break;
      case 'dissolve':
        // Small random stagger for dissolve
        this.startDelay[i] = Math.random() * 0.15;
        break;
      case 'morph':
      default:
        // 0-20% of duration (ported from qr-morph-canvas: startDelay = random * 0.25)
        this.startDelay[i] = Math.random() * 0.2;
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: per-frame position and opacity update
  // ---------------------------------------------------------------------------

  private _updatePositions(): void {
    const globalT = this.progress;

    for (let i = 0; i < this.activeCount; i++) {
      const flags = this.pairFlags[i];

      if (flags === 1) {
        // Paired pixel — Bezier interpolation
        this._updatePairedPixel(i, globalT);
      } else if (flags === 2) {
        // Unpaired source — fade out during morph_to, fade in during morph_back
        this._updateUnpairedSource(i, globalT);
      } else if (flags === 4) {
        // Unpaired target — fade in during morph_to, fade out during morph_back
        this._updateUnpairedTarget(i, globalT);
      }
    }
  }

  private _updatePairedPixel(i: number, globalT: number): void {
    // Apply per-particle stagger
    const delay = this.startDelay[i];
    const localT = Math.max(0, (globalT - delay) / (1 - delay));
    const clamped = Math.min(localT, 1);

    let x: number, y: number;

    if (this.transition === 'dissolve') {
      // Dissolve: no position change, just opacity crossfade
      // During morph_to: stay at home, fade out, then snap to target and fade in
      const eased = easeOutCubic(clamped);
      if (eased < 0.5) {
        // First half: at home position, fading out
        x = this.homeX[i];
        y = this.homeY[i];
        this.opacity[i] = 1 - eased * 2;
      } else {
        // Second half: at target position, fading in
        x = this.targetX[i];
        y = this.targetY[i];
        this.opacity[i] = (eased - 0.5) * 2;
      }
    } else {
      // morph, scatter, ripple all use Bezier interpolation
      const eased = easeOutCubic(clamped);
      const u = 1 - eased;

      // Quadratic Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * CP + t^2 * P1
      x = u * u * this.homeX[i] + 2 * u * eased * this.bezierCpX[i] + eased * eased * this.targetX[i];
      y = u * u * this.homeY[i] + 2 * u * eased * this.bezierCpY[i] + eased * eased * this.targetY[i];
      this.opacity[i] = 1;
    }

    this.currentX[i] = x;
    this.currentY[i] = y;
  }

  private _updateUnpairedSource(i: number, globalT: number): void {
    // Unpaired source: fade out at home position during morph_to
    const eased = easeOutCubic(globalT);
    this.opacity[i] = 1 - eased;
    this.currentX[i] = this.homeX[i];
    this.currentY[i] = this.homeY[i];
  }

  private _updateUnpairedTarget(i: number, globalT: number): void {
    // Unpaired target: fade in at target position during morph_to
    const eased = easeOutCubic(globalT);
    this.opacity[i] = eased;
    this.currentX[i] = this.targetX[i];
    this.currentY[i] = this.targetY[i];
  }
}

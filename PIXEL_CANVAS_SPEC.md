# Pixel Canvas: The LLM's Visual Language

## Spec Document — Orchid Live Call Visual System

> The pixel grid is not decoration. It is the LLM's canvas — a living surface
> that morphs, speaks, draws, and displays on command.

---

## Table of Contents

0. [Visual Diagrams](#0-visual-diagrams)
1. [Vision](#1-vision)
2. [What We Have Today](#2-what-we-have-today)
3. [Phase 1: PixiJS Migration & Scaled Grid](#3-phase-1-pixijs-migration--scaled-grid)
4. [Phase 2: Formation System & Asset Pipeline](#4-phase-2-formation-system--asset-pipeline)
5. [Phase 3: Dynamic Text & SVG Rendering](#5-phase-3-dynamic-text--svg-rendering)
6. [Phase 4: Image Generation & Artifacts (Overview)](#6-phase-4-image-generation--artifacts-overview)
7. [Tool Call Protocol](#7-tool-call-protocol)
8. [Performance Budget](#8-performance-budget)
9. [Asset Catalog](#9-asset-catalog)

---

## 0. Visual Diagrams

> All diagrams use `█` = active pixel, `·` = empty cell.
> Black background, white pixels — matching the call screen aesthetic.

### 0.1 Current Grid (25×18 simplified) — Orchid Idle

This is roughly what the OrchidAvatar renders today. ~350 white pixels
forming the phalaenopsis orchid on a black screen.

```
         ┌─── 25 cols ───┐
         │               │
    ···········██·██·█··██···
    ······██·█··█·██··█·██···
    ····██·██··██·██·██·█████
    ····████·██··██·██·██·███
    ····█·██·██·█████·██··███
    ······██···██··██·██·····
    ·····█·█·····███·████····    ← petals
    ···██·██·█·██·███·██·····
    ···████··█·██·██████·····
    ····██·█··█·██·██████····
    ·····██·██·██████████····
    ······██··█████████······
    ·······██·████████·······    ← pot
    ········█·██████·········
    ·········██████··········
    ··········████···········
    ···········██············
         │               │
         └───────────────┘
              200×200 px
```

### 0.2 New Grid (50×35 simplified) — Orchid at Higher Resolution

Phase 1 scales the grid to 70×98. Same orchid, much more detail.
(Showing 70×49 here — top half — to fit on screen)

```
┌──────────────────── 50 cols ────────────────────┐
│                                                  │
····················████··████··██····████··········
··················██··██████··████··██··████·········
················████··██··████··████████··██████····
··············████████··████··████··████████··████··
··············██··████████··████████··████··████████
··············████··██████████████████··██████··████
············████████··██··████··████████··████······
··············██··██····████··████··████████········    ← flowers
··········██··████··██····████████··██████··········      (2× detail)
··········████████████··██··██··████··██············
··········██··██████████████████████████············
············████··██████████████████················
··············████··████████████████················
················████████████████····················
··················██████████████····················
····················████████························
······················████·························    ← stem
····················██··██·························
··················████····██·······················
················██████████████·····················
··············████████████████████·················
············████████████████████████···············    ← pot
··········██████████████████████████···············
··········████████████████████████·················
············██████████████████·····················
··············██████████████·······················
│                                                  │
└──────────────────────────────────────────────────┘
                    350×350 px
```

### 0.3 Morph Sequence: Orchid → Monstera

When the LLM calls `show_visual({ type: "template", id: "monstera_deliciosa" })`,
this is what happens over 1200ms:

```
  t=0ms (idle)          t=300ms              t=600ms              t=1200ms (hold)
  ORCHID                SCATTERING           CONVERGING           MONSTERA
  ┌──────────┐          ┌──────────┐         ┌──────────┐         ┌──────────┐
  │          │          │          │         │          │         │          │
  │  ·██·██· │          │ · █  █·  │         │   ██·██  │         │ ████·████│
  │ ████████ │          │  █ ██ █  │         │  █·██·██ │         │██·███·███│
  │ ██·██·██ │    ──►   │ █  · █ █ │   ──►   │ ██████·█ │   ──►   │██████████│
  │ ·██████· │  bezier  │  █ ██  · │ bezier  │ █·████·█ │  ease   │·████████·│
  │ ··████·· │  curves  │·  ███  █ │ curves  │ ·██████· │  out    │··██··██··│
  │ ···██··· │          │ █  ██ ·  │         │ ··████·· │         │··██··██··│
  │ ··████·· │          │  ██ █· █ │         │ ·██████· │         │·████████·│
  │ ·██████· │          │ █ ███ ·  │         │ ████████ │         │██████████│
  │          │          │          │         │          │         │          │
  └──────────┘          └──────────┘         └──────────┘         └──────────┘

  Each pixel traces a curved Bezier path from its orchid position
  to its nearest monstera position. Unpaired pixels fade in/out.
```

### 0.4 Speaking Animation — Audio Displacement

When Orchid is speaking, pixels push outward from center proportional to
audio level. Petals (far from center) move most. Stem/pot (center) stay stable.

```
  IDLE (audioLevel=0)           SPEAKING (audioLevel=0.7)

  ┌──────────────┐              ┌──────────────┐
  │              │              │              │
  │    ·██·██·   │              │   · ██·██ ·  │  ← petals pushed OUT
  │   ████████   │              │  ██ ████ ██  │     by 4-5px
  │   ██·██·██   │              │  ██ ·██· ██  │
  │   ·██████·   │              │   ·██████·   │  ← middle: less push
  │   ··████··   │              │   ··████··   │     (1-2px)
  │   ···██···   │              │   ···██···   │
  │   ··████··   │              │   ··████··   │  ← stem: almost none
  │   ·██████·   │              │   ·██████·   │     (0-1px)
  │              │              │              │
  └──────────────┘              └──────────────┘

  displacement = audioLevel × 8 × (distance_from_center / radius)
  direction = outward radial angle from center
  + frequency modulation for pulsing effect
```

### 0.5 Thinking Animation — Organic Drift

When the LLM is executing a tool call, pixels drift slowly.

```
  t=0s                  t=2s                  t=4s

  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │  ·██·██· │          │ · ██·██· │          │  ·██ ██· │
  │ ████████ │   ──►    │ █████ ██ │   ──►    │ ██ █████ │
  │ ··████·· │  drift   │ · ████·· │  drift   │ ··████ · │
  │ ···██··· │ ±3px x   │ ·· ██··· │ ±3px x   │ ···██ ·· │
  │ ·██████· │ ±2px y   │ ·█████·· │ ±2px y   │ ··█████· │
  └──────────┘          └──────────┘          └──────────┘

  Each pixel oscillates independently via:
    dx = sin(t×0.5 + x×0.3 + y×0.2) × 3
    dy = cos(t×0.7 + y×0.3) × 2
  Period: ~12 seconds. Creates dreamy floating effect.
```

### 0.6 Text Formation — Bitmap Font

`show_visual({ type: "text", text: "WATER ME" })`

5×7 pixel characters, 1px gap between chars, centered in 70×98 grid.
Max ~11 chars per line (11 × 6px = 66, fits in 70 cols). Text wraps and centers automatically.

```
  ┌──────────────────── 50 cols ────────────────────┐
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │          █···█·····█·██████·█████·█████           │
  │          █···█····█·····█···█·····█···█           │
  │          █·█·█···█·█···█···█·····█···█           │
  │          █·█·█··█···█··█···████··█████           │
  │          █·█·█··█████··█···█·····█·█·            │
  │          ██·██··█···█··█···█·····█··█·           │
  │          █···█··█···█··█···█████·█···█           │
  │                                                  │
  │                                                  │
  │              █···█·█████                          │
  │              ██·██·█····                          │
  │              █·█·█·█····                          │
  │              █···█·████·                          │
  │              █···█·█····                          │
  │              █···█·█····                          │
  │              █···█·█████                          │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  └──────────────────────────────────────────────────┘

  Each letter is 5×7 pixels. "WATER" on line 1, "ME" on line 2.
  Centered horizontally and vertically.
```

### 0.7 List Formation

`show_visual({ type: "list", items: ["SWANSONS", "ACE HARDWARE", "HOME DEPOT"] })`

Numbers + text, stacked vertically, ripple transition (top to bottom).

```
  ┌──────────────────── 50 cols ────────────────────┐
  │                                                  │
  │                                                  │
  │     ·███·                                        │
  │     ··█··                                        │
  │     ··█··                                        │
  │     ··█··  █████·█···█·████·█···█·█████          │
  │     ·███·  █·····█···█·█···█·██··█·█····         │
  │            █████·█·█·█·████·█·█·█·█████          │
  │            ····█·██·██·█···█·█··██·····█          │
  │            █████·█···█·█···█·█···█·█████          │
  │                                                  │
  │     ·███·                                        │
  │     █···█                                        │
  │     ····█                                        │
  │     ·███·  ████·█████·█████                      │
  │     █····  █···█·█···█·█····                     │
  │     █████  ████·█·····█████                      │
  │            █···█·█···█·█····                     │
  │            █···█·█████·█████                     │
  │                                                  │
  │     ·███·                                        │
  │     █···█                                        │
  │     ····█                                        │
  │     ·███·  █···█·█████·█···█·█████               │
  │     ····█  █···█·█···█·██·██·█····               │
  │     ·███·  █████·█···█·█·█·█·████·               │
  │            █···█·█···█·█···█·█····               │
  │            █···█·█████·█···█·█████               │
  │                                                  │
  └──────────────────────────────────────────────────┘

  Numbers rendered large (5×7). Text beside each number.
  Ripple transition: item 1 appears first, then 2, then 3.
```

### 0.8 Compound Formation — Plant + Label

`show_visual({ type: "compound", ... })` — monstera silhouette with name below.

```
  ┌──────────────────── 50 cols ────────────────────┐
  │                                                  │
  │          ┌─── plant region (top 65%) ───┐        │
  │          │                              │        │
  │              ········████·████·······            │
  │              ······██·███·███████····            │
  │              ····██████████████████··            │
  │              ···██·████·████·██████··            │
  │              ··██████████████████████            │
  │              ··██████████████████████            │
  │              ···█████·████████████··             │
  │              ····████████████████····            │
  │              ······████··████······              │
  │              ·······██····██·······              │
  │              ·······██····██·······              │
  │              ·····████████████·····              │
  │              ···████████████████···              │
  │              ···████████████████···              │
  │              ····██████████████····              │
  │          │                              │        │
  │          └──────────────────────────────┘        │
  │          ┌─── text region (bottom 25%) ─┐        │
  │          │                              │        │
  │     █···█·█████·█···█·█████·█████·█████·█████    │
  │     ██·██·█···█·██··█·█·······█···█·····█···█    │
  │     █·█·█·█···█·█·█·█·█████···█···████··█████    │
  │     █···█·█···█·█··██·····█···█···█·····█·█··    │
  │     █···█·█████·█···█·█████···█···█████·█··█·    │
  │          │                              │        │
  │          └──────────────────────────────┘        │
  │                                                  │
  └──────────────────────────────────────────────────┘

  The plant silhouette fills the top portion.
  "MONSTERA" renders in full below in bitmap font.
```

### 0.9 Tool Formation — Watering Can

`show_visual({ type: "template", id: "watering_can" })`

Landscape-oriented assets are centered in the grid. The watering can is
wider than tall, so it gets horizontal centering with vertical padding.

```
  ┌──────────────────── 50 cols ────────────────────┐
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  │           ·········███·██··█·····                 │
  │           ·······██·██████·██····                 │
  │           ·····██·██··██████·████                 │
  │           ···██·████·██████████··                 │
  │           ··████·██████████████··                 │
  │           ·████████████··████████                 │    ← spout
  │           ██████████████████████·                 │      points
  │           ·██████████████████····                 │      right
  │           ···████████████████····                 │
  │           ·····████████████······                 │
  │           ·······████████········                 │
  │           ·········████··········                 │
  │                                                  │
  │                                                  │
  │                                                  │
  │                                                  │
  └──────────────────────────────────────────────────┘

  Landscape assets are centered both horizontally and vertically.
  Aspect ratio preserved from source image.
```

### 0.10 Full Call Screen Layout (Mobile-First)

The pixel canvas dominates the screen — ~80% of viewport height.
Controls and timer sit in a single bottom bar.
The canvas is the experience.

```
  ┌──────────────────────────────────┐
  │                                  │
  │  ┌──────────────────────────┐    │
  │  │                          │    │
  │  │                          │    │
  │  │       ···██·██···        │    │
  │  │      ··████████··        │    │
  │  │      ·██·██·███··        │    │
  │  │      ·████████··         │    │
  │  │       ·██████···         │    │
  │  │        ··██·····         │    │     PixelCanvas
  │  │        ·████····         │    │     fills ~80%
  │  │       ·██████···         │    │     of viewport
  │  │       ████████··         │    │
  │  │       ████████··         │    │     70×98 grid
  │  │       ·██████···         │    │     GPU-rendered
  │  │        ████·····         │    │
  │  │                          │    │
  │  │                          │    │
  │  │                          │    │
  │  │                          │    │
  │  │                          │    │
  │  └──────────────────────────┘    │
  │                                  │
  │     orchid is speaking...        │  ← status (mono, 10px)
  │                                  │
  │  [mic] [cam] [end]  3:42 │  ← single bottom bar
  │                                  │
  └──────────────────────────────────┘

  Bottom bar: controls + timer in one row. No LIVE indicator
  (the running timer is sufficient). No top bar — every pixel
  of vertical space goes to the canvas.

  When video is active:
  ┌──────────────────────────────────┐
  │                                  │
  │         CAMERA FEED              │
  │         (full bleed              │
  │          background)             │  ← z=5
  │                                  │
  │                  ┌──────────┐    │
  │                  │PixelCnvs │    │  ← z=10, top-right
  │                  │ (0.3×)   │    │     shrinks to ~100px
  │                  └──────────┘    │
  │                                  │
  │                                  │
  │                                  │
  │                                  │
  │                                  │
  │     orchid is speaking...        │
  │                                  │
  │  [mic] [cam] [end]  3:42 │
  │                                  │
  └──────────────────────────────────┘
```

### 0.11 Morph Lifecycle — State Machine

```
                    show_visual()
          ┌─────────────────────────┐
          │                         ▼
     ┌─────────┐            ┌──────────────┐
     │  IDLE   │            │ MORPHING_TO  │
     │ (orchid │◄───────────│  (1200ms)    │
     │  home)  │  morphBack │  bezier      │
     └─────────┘            │  interpolate │
          ▲                 └──────┬───────┘
          │                        │ progress=1
          │                        ▼
     ┌─────────────┐        ┌──────────────┐
     │ MORPHING    │        │   HOLDING    │
     │ _BACK       │◄───────│  (N seconds  │
     │ (1200ms)    │ timer  │   or indef.) │
     └─────────────┘ expires└──────────────┘
                                   │
                         new show_visual()
                                   │
                                   ▼
                            ┌──────────────┐
                            │  INTERRUPT   │
                            │ snap home →  │
                            │ new morph    │
                            └──────────────┘
```

### 0.12 Data Flow — Tool Call to Pixels

```
  GEMINI LIVE API                    CLIENT (browser)
  ═══════════════                    ════════════════

  User says: "show me                     │
  my monstera"                            │
       │                                  │
       ▼                                  │
  Gemini decides to                       │
  call show_visual()                      │
       │                                  │
       ▼                                  │
  WebSocket sends:                        │
  ┌─────────────────────┐                 │
  │ toolCall: {         │                 │
  │   name: show_visual │────────────────►│
  │   args: {           │                 │ handleToolCallRef
  │     type: template  │                 │      │
  │     id: monstera_   │                 │      ▼
  │        deliciosa    │                 │ registry.search(
  │     transition:     │                 │   "monstera_deliciosa"
  │        morph        │                 │ )
  │     hold: 8         │                 │      │
  │   }                 │                 │      ▼
  │ }                   │                 │ FormationEngine
  └─────────────────────┘                 │   .morphTo(positions)
                                          │      │
  WebSocket receives:                     │      ▼
  ┌─────────────────────┐                 │ PixiJS renders
  │ toolResponse: {     │◄────────────────│ 1200ms animation
  │   displayed: true   │  (immediate)    │      │
  │ }                   │                 │      ▼
  └─────────────────────┘                 │ Hold 8 seconds
                                          │      │
  Gemini keeps talking                    │      ▼
  about the monstera                      │ morphBack()
  (audio never stopped)                   │ → returns to orchid
```

---

## 1. Vision

During a live voice call, the full screen becomes the LLM's visual canvas. The
pixel grid — currently a static orchid avatar — transforms into a dynamic
communication medium:

- User mentions their monstera → pixels reorganize into a monstera silhouette
- LLM identifies root rot → pixels form a warning icon, then morph to show
  affected root zones
- LLM finds 5 nearby stores → pixels arrange into a numbered list
- LLM explains a watering schedule → pixels spell out "Every 3 days" in
  blocky monospace text
- User asks about pruning → pixels form pruning shears, then animate a
  cutting motion

The pixel grid is always present. No modals, no overlays, no context switches.
The same particles that breathe as Orchid's idle state seamlessly morph into
whatever the LLM wants to show.

---

## 2. What We Have Today

### 2.1 OrchidAvatar (Call Screen)

**File**: `src/components/call/OrchidAvatar.tsx` (163 lines)

| Property | Value |
|----------|-------|
| Renderer | Canvas 2D (`ctx.fillRect` per pixel) |
| Grid | 25 cols × 35 rows |
| Canvas | 200×200 px |
| Pixel cell | 8×8 px (with 1px gap) |
| Active pixels | ~300–350 (sampled from orchid PNG) |
| Source image | `phalaenopsis_orchid_pixel_bw_light.png` (804×1190) |
| Color | White pixels on black background |

**Animation states:**

| State | Trigger | Effect |
|-------|---------|--------|
| Breathe | Always | Sinusoidal scale 0.98–1.02 from center, 3s period |
| Speaking | `isSpeaking + outputAudioLevel` | Radial outward push, proportional to distance from center × audio level × 8px max |
| Listening | `isListening` | Pulsing glow ring at 45% radius, alpha 0.05–0.25 |
| Thinking | `isThinking` (tool executing) | Slow sinusoidal drift, ±3px horizontal, ±2px vertical |

All animations use exponential smoothing (LERP factor 0.15) for silky transitions.

**Pixel data structure:**
```typescript
interface Pixel {
  x: number;        // Current rendered position (smoothed)
  y: number;
  baseX: number;    // Home position (from image sampling)
  baseY: number;
  active: boolean;  // Always true for loaded pixels
}
```

### 2.2 QRMorphCanvas (Landing Page)

**File**: `src/components/landing/qr-morph-canvas.tsx` (337 lines)

A proven shape-morphing engine. On desktop, clicking the orchid transforms it
into a QR code via particle animation.

**Morphing algorithm:**
1. Collect "content pixels" from source grid (orchid) and target grid (QR)
2. Randomly shuffle source pixels
3. Nearest-neighbor pairing: each source pixel finds its closest unpaired target
4. Calculate quadratic Bezier control point perpendicular to the source→target
   vector, with random scale (±2 cells)
5. Per-particle staggered start (0–250ms of 1200ms total)
6. Cubic ease-out: `1 - (1-t)³`
7. Unpaired excess: source fades out, target fades in

**Key formulas:**
```
// Bezier control point (perpendicular to direction)
cpX = midX + (-dy / len) * perpScale
cpY = midY + (dx / len) * perpScale

// Per-frame interpolation
B(t) = (1-t)²·P₀ + 2(1-t)t·C + t²·P₁
```

### 2.3 Orchid Grid Sampler

**File**: `src/lib/orchid-grid.ts` (47 lines)

Converts any PNG to a `boolean[][]` grid:
1. Load image
2. Draw onto offscreen canvas at target grid dimensions
3. Sample R channel per pixel
4. Threshold at brightness 128 → true/false

**This is the key utility we'll generalize.** Currently hardcoded to orchid and
20×30. We need it to accept any image path and any grid dimensions.

### 2.4 Asset Library

**82 plants + 37 tools = 119 unique pixel art assets**

Each asset has 4 PNG variants + 1 SVG:
- `{name}_base.png` — base/neutral
- `{name}_pixel_bw_dark.png` — pixel art, B&W, dark background
- `{name}_pixel_bw_light.png` — pixel art, B&W, light background ← **this is what we sample**
- `{name}_transparent.png` — transparent background
- `{name}.svg` — vector

**Plant assets** (`public/plant_assets_art/`): 82 species
**Tool assets** (`public/tools_art/`): 37 items

The `_pixel_bw_light.png` variants are what we'll sample into grids — dark
pixels on light background, same as the current orchid source image.

---

## 3. Phase 1: PixiJS Migration & Scaled Grid

### 3.1 Why Migrate

The current Canvas 2D approach calls `ctx.fillRect()` per pixel per frame. At
350 pixels this is fine. At 7,000 pixels with independent position animation,
Canvas 2D will:
- Consume 3–5ms per frame on mobile (25–33% of a 16ms budget)
- Compete with AudioWorklet for main thread time
- Drop frames during speaking animation (audio level changes 60×/sec)

**PixiJS v8 ParticleContainer** renders 100K+ sprites on GPU. Main thread cost
is O(n) position buffer update (~0.3ms for 7K), then a single GPU draw call.

### 3.2 New Grid Dimensions

| Property | Current | Phase 1 |
|----------|---------|---------|
| Grid | 25×35 | **70×98** |
| Total cells | 875 | **6,860** |
| Active pixels | ~350 | **~1,500–2,000** |
| Canvas | 200×200 px | **~80% of viewport height** (responsive) |
| Pixel cell | 8×8 px | **viewport-relative** (canvasHeight / 98) |

**Why 70×98?** Same 5:7 aspect ratio as the orchid image. Enough resolution to
render recognizable plant silhouettes, tool shapes, and text. Not so many that
performance becomes a concern.

**Canvas sizing (mobile-first):**
The canvas takes ~80% of the viewport height. On a typical 390×844 phone
(iPhone 14), that's ~675px tall × ~482px wide (preserving 5:7 aspect).
Each pixel cell is ~6.9px (675/98). The canvas is the dominant visual element —
no top bar, no wasted chrome. Only a single bottom row holds the
controls and timer.

```
  Viewport: 390 × 844
  ┌──────────────────┐
  │                  │   Canvas: 80% = 675px tall
  │                  │           width = 675 × (70/98) = 482px
  │                  │           centered horizontally
  │   PixelCanvas    │
  │   482 × 675      │   Pixel cell: 675 / 98 ≈ 6.9px
  │                  │
  │                  │
  │                  │
  ├──────────────────┤
  │  status text     │   ~8% = 67px
  ├──────────────────┤
  │ [controls]  3:42 │   ~12% = 101px (safe area + controls)
  └──────────────────┘
```

### 3.3 Architecture

```
┌─────────────────────────────────────┐
│  PixelCanvas (React component)       │
│  ┌─────────────────────────────────┐ │
│  │  PixiJS Application              │ │
│  │  ┌─────────────┐                │ │
│  │  │ Particle    │  GPU-rendered  │ │
│  │  │ Container   │  sprite batch  │ │
│  │  └─────────────┘                │ │
│  │  Ticker → updatePositions()     │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │  FormationEngine                 │ │
│  │  - currentFormation: Float32[]  │ │
│  │  - targetFormation: Float32[]   │ │
│  │  - morphProgress: number        │ │
│  │  - morphCurve: BezierPoints[]   │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │  AnimationLayer                  │ │
│  │  - breathe()                    │ │
│  │  - speaking(audioLevel)         │ │
│  │  - listening()                  │ │
│  │  - thinking()                   │ │
│  │  - morphing(progress)           │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3.4 New File Structure

```
src/
├── lib/
│   ├── pixel-canvas/
│   │   ├── PixelCanvas.tsx          # React wrapper for PixiJS app
│   │   ├── FormationEngine.ts       # Morph orchestrator
│   │   ├── AnimationLayer.ts        # Breathe/speak/listen/think effects
│   │   ├── GridSampler.ts           # Generalized image→grid converter
│   │   ├── BitmapFont.ts            # Monospace text→grid renderer
│   │   ├── formations/
│   │   │   ├── registry.ts          # Formation name → grid data map
│   │   │   ├── precomputed/         # Pre-sampled JSON grids (build step)
│   │   │   └── loaders.ts           # Runtime grid loading from images
│   │   └── types.ts                 # Shared types
```

### 3.5 PixelCanvas Component

**Replaces**: `OrchidAvatar.tsx`

```typescript
interface PixelCanvasProps {
  // Call state (same as OrchidAvatar)
  isSpeaking: boolean;
  isListening: boolean;
  outputAudioLevel: number;
  isThinking: boolean;

  // NEW: Formation control (driven by tool calls)
  formation: Formation | null;  // null = default orchid
  onFormationComplete?: () => void;
}

interface Formation {
  type: 'template' | 'text' | 'svg' | 'pixels';
  id?: string;           // template name (e.g. "monstera_deliciosa")
  text?: string;         // for type='text'
  svgPath?: string;      // for type='svg'
  pixels?: boolean[][];  // for type='pixels' (direct grid)
  transition?: 'morph' | 'dissolve' | 'scatter' | 'ripple';
  duration?: number;     // ms, default 1200
  hold?: number;         // ms to hold before returning to orchid, 0 = indefinite
}
```

### 3.6 Particle Data Model

Each pixel is a sprite in the ParticleContainer with these properties tracked
in parallel typed arrays (for cache-friendly iteration):

```typescript
// Flat typed arrays — one entry per active pixel
const MAX_PIXELS = 6860;

const currentX  = new Float32Array(MAX_PIXELS);  // Smoothed render position
const currentY  = new Float32Array(MAX_PIXELS);
const homeX     = new Float32Array(MAX_PIXELS);   // Orchid formation position
const homeY     = new Float32Array(MAX_PIXELS);
const targetX   = new Float32Array(MAX_PIXELS);   // Morph target position
const targetY   = new Float32Array(MAX_PIXELS);
const bezierCpX = new Float32Array(MAX_PIXELS);   // Bezier control points
const bezierCpY = new Float32Array(MAX_PIXELS);
const startDelay = new Float32Array(MAX_PIXELS);  // Per-particle morph delay
const opacity    = new Float32Array(MAX_PIXELS);   // For fade-in/out of unpaired
```

**Why typed arrays?** V8 JIT optimizes Float32Array iteration into SIMD-like
tight loops. At 6,860 entries, this is ~110KB total — fits in L1 cache on any
modern device.

### 3.7 FormationEngine

Orchestrates morphing between formations.

```typescript
class FormationEngine {
  private state: 'idle' | 'morphing_to' | 'holding' | 'morphing_back';
  private progress: number;     // 0–1
  private duration: number;     // ms
  private holdTimer: number;    // ms remaining, 0 = indefinite
  private easing: (t: number) => number;

  // Called by PixelCanvas on each tick
  update(dt: number): void {
    switch (this.state) {
      case 'morphing_to':
        this.progress += dt / this.duration;
        if (this.progress >= 1) {
          this.progress = 1;
          this.state = 'holding';
        }
        break;

      case 'holding':
        if (this.holdTimer > 0) {
          this.holdTimer -= dt;
          if (this.holdTimer <= 0) this.morphBack();
        }
        // holdTimer === 0 means indefinite — wait for explicit morphBack()
        break;

      case 'morphing_back':
        this.progress -= dt / this.duration;
        if (this.progress <= 0) {
          this.progress = 0;
          this.state = 'idle';
        }
        break;
    }
  }

  // Compute position for pixel i at current progress
  getPosition(i: number): { x: number, y: number } {
    if (this.state === 'idle') return { x: homeX[i], y: homeY[i] };

    const t = this.easing(this.progress);
    const u = 1 - t;

    // Quadratic Bezier: B(t) = (1-t)²P₀ + 2(1-t)tC + t²P₁
    const x = u * u * homeX[i] + 2 * u * t * bezierCpX[i] + t * t * targetX[i];
    const y = u * u * homeY[i] + 2 * u * t * bezierCpY[i] + t * t * targetY[i];
    return { x, y };
  }

  morphTo(formation: Formation): void { /* ... */ }
  morphBack(): void { /* ... */ }
  interrupt(newFormation: Formation): void {
    // Snap current positions to home, then start new morph
  }
}
```

### 3.8 AnimationLayer

Layered on top of FormationEngine positions. These modulations are additive —
they apply to whatever position the FormationEngine outputs.

```typescript
function applyAnimations(
  i: number,
  baseX: number,
  baseY: number,
  t: number,              // Elapsed time in seconds
  isSpeaking: boolean,
  audioLevel: number,
  isThinking: boolean,
): { x: number, y: number } {
  let px = baseX;
  let py = baseY;

  // Breathe (always, all states)
  const breathe = 1 + Math.sin(t * 2.1) * 0.02;
  px = centerX + (px - centerX) * breathe;
  py = centerY + (py - centerY) * breathe;

  // Speaking displacement (radial push)
  if (isSpeaking) {
    const dist = Math.sqrt((homeX[i] - centerX) ** 2 + (homeY[i] - centerY) ** 2);
    const norm = dist / (canvasSize / 2);
    const disp = audioLevel * 8 * norm;
    const angle = Math.atan2(homeY[i] - centerY, homeX[i] - centerX);
    const freq = Math.sin(t * 8 + homeX[i] * 0.1) * 0.5 + 0.5;
    px += Math.cos(angle) * disp * freq;
    py += Math.sin(angle) * disp * freq;
  }

  // Thinking drift
  if (isThinking) {
    px += Math.sin(t * 0.5 + homeX[i] * 0.3 + homeY[i] * 0.2) * 3;
    py += Math.cos(t * 0.7 + homeY[i] * 0.3) * 2;
  }

  return { x: px, y: py };
}
```

**Important**: Animations use `homeX[i]`/`homeY[i]` for spatial parameters
(distance from center, angle) regardless of current formation. This means the
speaking "petal pulsing" pattern stays consistent even when showing a different
formation — the displacement map is always relative to the orchid's shape.

### 3.9 Rendering Pipeline (Per Frame)

```
1. FormationEngine.update(dt)
2. For each pixel i:
   a. base = FormationEngine.getPosition(i)      // Morph interpolation
   b. animated = AnimationLayer.apply(i, base)    // Breathe/speak/think
   c. smoothed = lerp(current[i], animated, 0.15) // Exponential smoothing
   d. sprite[i].position = smoothed               // Update PixiJS sprite
   e. sprite[i].alpha = opacity[i]                // Fade for unpaired pixels
3. PixiJS renders all sprites in single GPU draw call
```

### 3.10 Migration Checklist

- [ ] Install PixiJS v8: `npm install pixi.js`
- [ ] Create `PixelCanvas.tsx` with PixiJS Application + ParticleContainer
- [ ] Port image sampling from OrchidAvatar into `GridSampler.ts`
- [ ] Implement FormationEngine with Bezier morphing (port from QRMorphCanvas)
- [ ] Implement AnimationLayer with all 4 states (port from OrchidAvatar)
- [ ] Wire `PixelCanvas` into `CallScreen.tsx` (drop-in replacement)
- [ ] Wire `PixelCanvas` into `DevCallPage.tsx`
- [ ] Verify: breathe, speaking, listening, thinking all work identically
- [ ] Verify: no audio glitches during animation (profile on mobile)
- [ ] Remove old `OrchidAvatar.tsx`

---

## 4. Phase 2: Formation System & Asset Pipeline

### 4.1 The Asset Pipeline

We have 119 pixel art assets. Each needs to be converted from PNG into a
sampled grid that the FormationEngine can morph to.

**Two approaches:**

#### A. Build-Time Pre-computation (Recommended)

A Node script runs at build time, samples every `_pixel_bw_light.png` into a
`boolean[][]` grid, and writes the results as compact JSON or binary files.

```
npm run build:formations
```

**Script**: `scripts/build-formations.ts`

```typescript
import { createCanvas, loadImage } from 'canvas';  // node-canvas
import fs from 'fs';
import path from 'path';

const GRID_COLS = 70;
const GRID_ROWS = 98;

interface FormationData {
  id: string;           // e.g. "monstera_deliciosa"
  category: 'plant' | 'tool';
  cols: number;
  rows: number;
  // Packed as 1D bitfield for compact storage
  // Each byte encodes 8 cells: bit 0 = cell 0, bit 7 = cell 7
  bits: string;         // base64-encoded Uint8Array
  pixelCount: number;   // Number of active pixels
  displayName: string;  // Human-readable: "Monstera Deliciosa"
}

async function sampleAsset(
  imagePath: string,
  id: string,
  category: 'plant' | 'tool',
): Promise<FormationData> {
  const img = await loadImage(imagePath);

  // Determine sampling dimensions preserving aspect ratio
  const aspect = img.width / img.height;
  let sampleCols: number, sampleRows: number;

  if (aspect < 1) {
    // Portrait (most plants)
    sampleRows = GRID_ROWS;
    sampleCols = Math.round(GRID_ROWS * aspect);
  } else {
    // Landscape (some tools)
    sampleCols = GRID_COLS;
    sampleRows = Math.round(GRID_COLS / aspect);
  }

  // Clamp to grid bounds
  sampleCols = Math.min(sampleCols, GRID_COLS);
  sampleRows = Math.min(sampleRows, GRID_ROWS);

  const canvas = createCanvas(sampleCols, sampleRows);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, sampleCols, sampleRows);
  const imageData = ctx.getImageData(0, 0, sampleCols, sampleRows);

  // Sample with centering offset
  const fullGrid: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(false)
  );

  const offX = Math.floor((GRID_COLS - sampleCols) / 2);
  const offY = Math.floor((GRID_ROWS - sampleRows) / 2);

  let pixelCount = 0;
  for (let r = 0; r < sampleRows; r++) {
    for (let c = 0; c < sampleCols; c++) {
      const i = (r * sampleCols + c) * 4;
      const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      const active = brightness < 128;  // Dark = content (B&W light variant)
      if (active) {
        fullGrid[offY + r][offX + c] = true;
        pixelCount++;
      }
    }
  }

  // Pack into bitfield
  const totalCells = GRID_COLS * GRID_ROWS;
  const byteCount = Math.ceil(totalCells / 8);
  const bytes = new Uint8Array(byteCount);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const flatIndex = r * GRID_COLS + c;
      if (fullGrid[r][c]) {
        bytes[Math.floor(flatIndex / 8)] |= 1 << (flatIndex % 8);
      }
    }
  }

  const bits = Buffer.from(bytes).toString('base64');

  return {
    id,
    category,
    cols: GRID_COLS,
    rows: GRID_ROWS,
    bits,
    pixelCount,
    displayName: id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
  };
}
```

**Output**: `src/lib/pixel-canvas/formations/precomputed/formations.json`

A single JSON file containing all 119+ formations. At 70×98, each formation
bitfield is ceil(6,860/8) = 858 bytes, base64 ≈ ~1.1KB per asset.
119 assets = ~131KB raw, ~30KB gzipped.

**Runtime loader:**
```typescript
// Decode bitfield back to { x, y }[] positions
function decodeFormation(data: FormationData): { x: number, y: number }[] {
  const bytes = Uint8Array.from(atob(data.bits), c => c.charCodeAt(0));
  const positions: { x: number, y: number }[] = [];

  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      const flatIndex = r * data.cols + c;
      const isActive = (bytes[Math.floor(flatIndex / 8)] >> (flatIndex % 8)) & 1;
      if (isActive) {
        positions.push({
          x: c * PIXEL_SIZE + PIXEL_SIZE / 2,
          y: r * PIXEL_SIZE + PIXEL_SIZE / 2,
        });
      }
    }
  }

  return positions;
}
```

#### B. Runtime Sampling (Fallback)

For assets not in the precomputed set, the generalized `GridSampler` can load
and sample any image at runtime (same algorithm, but runs in browser). Useful
for user-uploaded photos or dynamically generated content.

### 4.2 Formation Registry

Maps identifiers to formation data. The LLM references formations by ID.

```typescript
// formations/registry.ts
import formationsData from './precomputed/formations.json';

interface FormationEntry {
  id: string;
  category: 'plant' | 'tool' | 'icon' | 'custom';
  displayName: string;
  pixelCount: number;
  positions: { x: number, y: number }[];  // Decoded at init
}

class FormationRegistry {
  private entries = new Map<string, FormationEntry>();

  constructor() {
    // Decode all precomputed formations at app start
    for (const data of formationsData) {
      this.entries.set(data.id, {
        ...data,
        positions: decodeFormation(data),
      });
    }
  }

  get(id: string): FormationEntry | undefined {
    return this.entries.get(id);
  }

  // Fuzzy lookup — LLM might say "monstera" not "monstera_deliciosa"
  search(query: string): FormationEntry | undefined {
    const lower = query.toLowerCase().replace(/\s+/g, '_');

    // Exact match
    if (this.entries.has(lower)) return this.entries.get(lower);

    // Partial match
    for (const [id, entry] of this.entries) {
      if (id.includes(lower) || lower.includes(id)) return entry;
    }

    // Display name match
    for (const [, entry] of this.entries) {
      if (entry.displayName.toLowerCase().includes(query.toLowerCase())) {
        return entry;
      }
    }

    return undefined;
  }

  list(category?: string): FormationEntry[] {
    const all = [...this.entries.values()];
    return category ? all.filter(e => e.category === category) : all;
  }
}

export const registry = new FormationRegistry();
```

### 4.3 Morph Transition Types

| Transition | Description | Implementation |
|-----------|-------------|----------------|
| `morph` | Bezier curve paths from current to target (default) | Port from QRMorphCanvas |
| `dissolve` | Pixels fade out in place, fade in at target | Alpha tween, no position change |
| `scatter` | Explode outward, then coalesce at target | Random velocity → Bezier convergence |
| `ripple` | Wave propagation from center outward | Stagger delay based on distance from center |

**Morph (default)** — the QRMorphCanvas algorithm, adapted:

1. Collect current active positions and target active positions
2. Nearest-neighbor pairing (shuffle source first for natural randomness)
3. Bezier control points perpendicular to direction vector
4. Per-particle stagger: `startDelay = random(0, 0.2)` of duration
5. Cubic ease-out: `1 - (1-t)³`
6. Excess source pixels fade out, excess target pixels fade in

**Scatter** — for dramatic reveals:

1. Each pixel gets random outward velocity from current position
2. After 40% of duration, velocity reverses toward target
3. Bezier with high control point variance for chaotic paths
4. Coalesces at target with same ease-out

**Ripple** — for information display:

1. Calculate distance from center for each pixel pair
2. `startDelay = (dist / maxDist) * 0.4` — outer pixels morph later
3. Creates wave effect radiating outward
4. Especially good for text reveals

### 4.4 Particle Pairing Strategy

When morphing between two formations with different pixel counts:

| Scenario | Source | Target | Strategy |
|----------|--------|--------|----------|
| Equal | 1500 | 1500 | 1:1 nearest-neighbor pairing |
| More source | 1500 | 800 | 800 paired + 700 fade out at source position |
| More target | 800 | 1500 | 800 paired + 700 fade in at target position |
| Return home | Any | Orchid | Always 1:1 (orchid is the base, all pixels have home) |

The orchid formation is special: it defines the **maximum pixel pool**. Every
pixel has a "home" in the orchid. When morphing to a formation with fewer
pixels, some orchid pixels have no target — they fade out. When morphing back,
they fade back in.

### 4.5 Full Asset Inventory (119 formations)

#### Plants (82)

| ID | Display Name | Source Dir |
|----|-------------|------------|
| `african_violet_2` | African Violet | `African_violet_2/` |
| `african_violet` | African Violet | `T_African_Violet/` |
| `alocasia_amazonica` | Alocasia Amazonica | `Alocasia_amazonica/` |
| `aloe_vera` | Aloe Vera | `Aloe_Vera/` |
| `aloe_vera_2` | Aloe Vera | `Aloe_Vera_2/` |
| `aloe` | Aloe | `aloe/` |
| `soap_aloe` | Soap Aloe | `Soap_Aloe/` |
| `anthurium` | Anthurium | `Anthurium/` |
| `anthurium_2` | Anthurium | `Anthurium_2/` |
| `barrel_cactus` | Barrel Cactus | `Barrel_Cactus/` |
| `barrel_cactus_2` | Barrel Cactus | `Barrel_Cactus_2/` |
| `finger_cactus` | Finger Cactus | `Finger_Cactus/` |
| `bird_of_paradise` | Bird of Paradise | `T_Bird_of_paradise/` |
| `bird_of_paradise_2` | Bird of Paradise | `Bird_of_paradise_2/` |
| `birds_of_paradise` | Birds of Paradise | `Birds_of_paradise/` |
| `boston_fern` | Boston Fern | `Boston_Fern/` |
| `kimberly_fern` | Kimberly Fern | `Kimberly_fern/` |
| `maidenhair_fern` | Maidenhair Fern | `Maidenhair_Fern/` |
| `maidenhair_fern_2` | Maidenhair Fern | `maidenhair_fern_2/` |
| `calathea_orbifolia` | Calathea Orbifolia | `CalatheaOrbifolia/` |
| `calathea_orbifolia_2` | Calathea Orbifolia | `Calathea_orbifolia/` |
| `calathea_musaica` | Calathea Musaica | `Calathea_Musaica/` |
| `christmas_cactus` | Christmas Cactus | `Christmas_Cactus/` |
| `candelabra_cactus` | Candelabra Cactus | `candelabra_cactus/` |
| `living_stone` | Living Stone | `Living_Stone/` |
| `potted_cactus` | Potted Cactus | `Potted_Cactus/` |
| `prickly_pear` | Prickly Pear | `Prickly_pear/` |
| `prickly_pear_2` | Prickly Pear | `Prickly_Pear_2/` |
| `echeveria` | Echeveria | `Echeveria/` |
| `cattleya_orchid` | Cattleya Orchid | `cattleya_orchid_on_cork_bark/` |
| `epidendrum_radicans` | Epidendrum Radicans | `epidendrum_radicans/` |
| `jewel_orchid` | Jewel Orchid | `jewel_orchid_in_terrarium/` |
| `moth_orchid` | Moth Orchid | `moth_orchid/` |
| `orchid_in_pot` | Orchid in Pot | `orchid_in_pot/` |
| `paphiopedilum` | Paphiopedilum | `paphiopedilum_sanderianum/` |
| `phalaenopsis_orchid` | Phalaenopsis Orchid | `T_phalaenopsis_orchid/` |
| `chinese_evergreen` | Chinese Evergreen | `Chinese_Evergreen/` |
| `chinese_money_plant` | Chinese Money Plant | `Chinese_Money_Plant/` |
| `chinese_money_plant_2` | Chinese Money Plant | `Chinese_Money_Plant_2/` |
| `elephant_ear` | Elephant Ear | `Elephant_ear/` |
| `fuchsia` | Fuchsia | `Fuchsia/` |
| `geranium` | Geranium | `Geranium/` |
| `geranium_2` | Geranium | `Geranium_2/` |
| `heartleaf_philodendron` | Heartleaf Philodendron | `Heartleaf_Philodendron/` |
| `heartleaf_philodendron_2` | Heartleaf Philodendron | `Heartleaf_Philodendron_2/` |
| `hoya` | Hoya | `Hoya/` |
| `jade` | Jade | `jade/` |
| `jade_plant` | Jade Plant | `jade_plant/` |
| `lavender` | Lavender | `lavender/` |
| `monstera_adansonii` | Monstera Adansonii | `Monstera_Adansonii/` |
| `monstera_deliciosa` | Monstera Deliciosa | `Monstera_Deliciosa/` |
| `monstera_albo` | Monstera Albo | `monstera_deliciosa_albo/` |
| `monstera_in_vase` | Monstera in Vase | `monstera_deliciosa_in_vase/` |
| `monstera_siltepecana` | Monstera Siltepecana | `Monstera_Siltepecana/` |
| `monstera_albo_2` | Monstera Albo | `T_Monstera_Albo/` |
| `peace_lily` | Peace Lily | `Peace_Lily/` |
| `peace_lily_2` | Peace Lily | `Peace_Lily_2/` |
| `peperomia` | Peperomia | `Peperomia/` |
| `peperomia_argyreia` | Peperomia Argyreia | `Peperomia_argyreia/` |
| `philodendron_pink_princess` | Pink Princess | `Philodendron_Pink_Princess/` |
| `pink_princess` | Pink Princess | `Pink_Princess_Philodendron/` |
| `polka_dot_begonia` | Polka Dot Begonia | `Polka_Dot_Begonia/` |
| `rubber_plant` | Rubber Plant | `Rubber_Plant/` |
| `burgundy_rubber_tree` | Burgundy Rubber Tree | `T_Burgundy_Rubber_Tree/` |
| `variegated_rubber_plant` | Variegated Rubber Plant | `Variegated_Rubber_Plant/` |
| `snake_plant` | Snake Plant | `Snake_Plant/` |
| `snake_plant_2` | Snake Plant | `Snake_plant_2/` |
| `spider_plant` | Spider Plant | `Spider_Plant/` |
| `string_of_pearls` | String of Pearls | `String_of_Pearls/` |
| `stromanthe_triostar` | Stromanthe Triostar | `Stromanthe_triostar/` |
| `swiss_cheese_plant` | Swiss Cheese Plant | `Swiss_Cheese_Plant/` |
| `swiss_cheese_plant_2` | Swiss Cheese Plant | `Swiss_Cheese_plant_2/` |
| `fiddle_leaf_fig` | Fiddle Leaf Fig | `T_Fiddle_Leaf_Fig/` |
| `fiddle_leaf_fig_2` | Fiddle Leaf Fig | `Fiddle_Leaf_Fig_2/` |
| `wandering_jew` | Wandering Jew | `Wandering_Jew/` |
| `zz_plant` | ZZ Plant | `ZZ_plant/` |
| `zz_plant_2` | ZZ Plant | `Zz_plant_2/` |
| `zamioculcas` | Zamioculcas | `Zamioculcas_zamiifolia/` |
| `zebra_haworthia` | Zebra Haworthia | `Zebra_Haworthia/` |
| `zebra_plant` | Zebra Plant | `Zebra_Plant/` |
| `burros_tail` | Burro's Tail | `burros_tail/` |
| `succulent` | Succulent | `succulent/` |

#### Tools (37)

| ID | Display Name | Source Dir |
|----|-------------|------------|
| `atomizer` | Atomizer | `atomizer/` |
| `bag_of_soil` | Bag of Soil | `bag_of_soil/` |
| `compost_bin` | Compost Bin | `compost_bin/` |
| `composter` | Composter | `composter/` |
| `edger` | Edger | `edger/` |
| `fertilizer_bottle` | Fertilizer Bottle | `fertilizer_bottle/` |
| `flowerpots` | Flowerpots | `flowerpots/` |
| `garden_cart` | Garden Cart | `garden_cart/` |
| `garden_clogs` | Garden Clogs | `garden_clogs/` |
| `garden_trowel` | Garden Trowel | `garden_trowel/` |
| `gardening_apron` | Gardening Apron | `gardening_apron/` |
| `gardening_gloves` | Gardening Gloves | `gardening_gloves/` |
| `gardening_kneeler` | Gardening Kneeler | `gardening_kneeler/` |
| `grow_light` | Grow Light | `grow_light/` |
| `hand_trowel` | Hand Trowel | `hand_trowel/` |
| `hose_nozzle` | Hose Nozzle | `hose_nozzle/` |
| `hose_reel` | Hose Reel | `hose_reel/` |
| `loppers` | Loppers | `loppers/` |
| `plant_marker` | Plant Marker | `plant_marker/` |
| `plant_markers` | Plant Markers | `plant_markers/` |
| `plant_support` | Plant Support | `plant_support/` |
| `pot_stand` | Pot Stand | `pot_stand/` |
| `pruning_shears` | Pruning Shears | `pruning_shears/` |
| `saucer` | Saucer | `saucer/` |
| `scoop` | Scoop | `scoop/` |
| `seed_packets` | Seed Packets | `seed_packets/` |
| `seed_tray` | Seed Tray | `seed_tray/` |
| `seedling_tray` | Seedling Tray | `seedling_tray/` |
| `spray_bottle` | Spray Bottle | `spray_bottle/` |
| `spreader` | Spreader | `spreader/` |
| `sun_hat` | Sun Hat | `sun_hat/` |
| `twine` | Twine | `twine/` |
| `water_hose` | Water Hose | `water_hose/` |
| `watering_can` | Watering Can | `watering_can/` |
| `watering_can_2` | Watering Can | `watering_can_2/` |
| `wheelbarrow` | Wheelbarrow | `wheelbarrow/` |
| `wicker_basket` | Wicker Basket | `wicker_basket/` |

### 4.6 Contextual Formation Triggers

The system prompt instructs the LLM when to use formations:

```
## Visual Display Rules

You control a pixel grid that the user can see during the call.
Use the `show_visual` tool to display formations:

- When discussing a SPECIFIC PLANT the user owns or mentions:
  show_visual({ type: "template", id: "<species>" })
  Match the user's plant to the closest available formation.

- When demonstrating a CARE ACTION or recommending a tool:
  show_visual({ type: "template", id: "<tool_name>" })

- When presenting INFORMATION (store lists, schedules, tips):
  show_visual({ type: "text", text: "<short text>" })

- When GREETING or returning to neutral:
  show_visual({ type: "template", id: "phalaenopsis_orchid" })
  Or simply let the current formation expire (hold timer).

Do NOT show formations for every sentence. Use them at meaningful
moments — when visual context genuinely aids understanding.

Available formations: [injected from registry.list() at token creation]
```

---

## 5. Phase 3: Dynamic Text & SVG Rendering

### 5.1 Bitmap Font Renderer

Renders monospace text as pixel grid formations. Each character is a small
bitmap that gets placed into the 70×98 grid.

**Font design**: 5×7 pixel characters (standard bitmap font size), with 1px
gap between characters. This gives:
- **11 characters per row** (11 × 6px = 66, fits in 70 cols)
- **10 rows of text** (10 × 9px = 90, fits in 98 rows)
- Readable for short messages, numbers, labels
- No truncation — if text is longer, it wraps to next line
- If text exceeds all available rows, font scales down to 3×5 (fits more chars/row)

```typescript
// BitmapFont.ts

// 5×7 monospace bitmap font — subset of printable ASCII
// Each char is a 5-wide × 7-tall boolean grid, packed as 7 bytes (bits 0–4 used)
const CHAR_WIDTH = 5;
const CHAR_HEIGHT = 7;
const CHAR_GAP_X = 1;  // 1px between chars
const CHAR_GAP_Y = 2;  // 2px between lines

// Character bitmaps (example subset)
const FONT: Record<string, number[]> = {
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'B': [0b11110, 0b10001, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  // ... full ASCII A-Z, 0-9, punctuation
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
};

function renderText(
  text: string,
  gridCols: number,
  gridRows: number,
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: gridRows }, () =>
    Array(gridCols).fill(false)
  );

  const lines = wrapText(text.toUpperCase(), gridCols);

  // Center vertically
  const totalHeight = lines.length * (CHAR_HEIGHT + CHAR_GAP_Y) - CHAR_GAP_Y;
  let startY = Math.floor((gridRows - totalHeight) / 2);

  for (const line of lines) {
    // Center horizontally
    const lineWidth = line.length * (CHAR_WIDTH + CHAR_GAP_X) - CHAR_GAP_X;
    let startX = Math.floor((gridCols - lineWidth) / 2);

    for (const char of line) {
      const bitmap = FONT[char] || FONT[' '];
      for (let r = 0; r < CHAR_HEIGHT; r++) {
        for (let c = 0; c < CHAR_WIDTH; c++) {
          if ((bitmap[r] >> (CHAR_WIDTH - 1 - c)) & 1) {
            const gx = startX + c;
            const gy = startY + r;
            if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
              grid[gy][gx] = true;
            }
          }
        }
      }
      startX += CHAR_WIDTH + CHAR_GAP_X;
    }
    startY += CHAR_HEIGHT + CHAR_GAP_Y;
  }

  return grid;
}

function wrapText(text: string, gridCols: number): string[] {
  const maxCharsPerLine = Math.floor((gridCols + CHAR_GAP_X) / (CHAR_WIDTH + CHAR_GAP_X));
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
```

**Font source**: Use the Press Start 2P font bitmap glyphs, converted to 5×7.
This keeps the text consistent with the app's existing typography.

### 5.2 Compound Formations

A formation can combine a template (image) with text. For example:
- Monstera silhouette in the top 60% + "NEEDS WATER" text in the bottom 25%
- Watering can in the left half + "EVERY 3 DAYS" on the right

```typescript
interface CompoundFormation {
  type: 'compound';
  layers: {
    formation: Formation;
    region: { x: number, y: number, width: number, height: number }; // Normalized 0–1
  }[];
}

// Example: plant + label
{
  type: 'compound',
  layers: [
    {
      formation: { type: 'template', id: 'monstera_deliciosa' },
      region: { x: 0.1, y: 0, width: 0.8, height: 0.65 },
    },
    {
      formation: { type: 'text', text: 'MONSTERA' },
      region: { x: 0, y: 0.72, width: 1, height: 0.28 },
    },
  ],
}
```

The grid sampler scales each layer's output to fit its region, then composites
them into the final 70×98 grid.

### 5.3 SVG Path Rendering

For custom shapes the LLM might want to draw (arrows, simple diagrams, check
marks, X marks), we accept SVG path data and rasterize to the grid.

```typescript
// SVG path → boolean grid
function rasterizeSvgPath(
  pathData: string,  // e.g. "M 10 10 L 40 10 L 25 40 Z"
  gridCols: number,
  gridRows: number,
): boolean[][] {
  // Create offscreen SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${gridCols} ${gridRows}`);
  svg.setAttribute('width', String(gridCols));
  svg.setAttribute('height', String(gridRows));

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'black');
  svg.appendChild(path);

  // Serialize SVG → data URL → Image → Canvas → sample
  const svgString = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = gridCols;
      canvas.height = gridRows;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, gridCols, gridRows);
      const grid: boolean[][] = Array.from({ length: gridRows }, () =>
        Array(gridCols).fill(false)
      );

      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const i = (r * gridCols + c) * 4;
          // Alpha > 0 means the SVG path covers this pixel
          grid[r][c] = imageData.data[i + 3] > 128;
        }
      }

      resolve(grid);
    };
    img.src = url;
  });
}
```

### 5.4 Built-in Icon Formations

In addition to plant/tool assets, we pre-build a set of semantic icons:

| ID | Shape | Use Case |
|----|-------|----------|
| `icon_checkmark` | ✓ | Confirmation ("Plant saved!") |
| `icon_x` | ✗ | Error or deletion |
| `icon_warning` | ⚠ | Health alert |
| `icon_heart` | ♥ | Positive sentiment |
| `icon_droplet` | 💧 | Watering |
| `icon_sun` | ☀ | Light/sunlight |
| `icon_moon` | ☾ | Low light |
| `icon_thermometer` | 🌡 | Temperature |
| `icon_magnifier` | 🔍 | Research/search |
| `icon_map_pin` | 📍 | Store location |
| `icon_clock` | 🕐 | Reminder/schedule |
| `icon_leaf` | 🍃 | Generic plant |
| `icon_bug` | 🐛 | Pest alert |
| `icon_scissors` | ✂ | Pruning |

These are hand-drawn as 70×98 pixel grids (or SVG paths rasterized at build
time) to ensure they look intentional at the target resolution.

### 5.5 Numbered List Formation

For search results, store lists, or step-by-step instructions, the LLM can
display a numbered list:

```typescript
// Tool call
show_visual({
  type: 'list',
  items: [
    "SWANSONS",
    "ACE HARDWARE",
    "HOME DEPOT",
  ]
})
```

Rendered using a compact 3×5 font for list items (fits 12 chars/row):

```
 ┌──────────────────── 50 cols ────────────────────┐
 │                                                  │
 │                                                  │
 │   █  ███·█···█·████·█···█·███··█████·█···█·███   │
 │   █  █···█···█·█··█·██··█·█··█·█···█·██··█·█··   │
 │   █  ███·█·█·█·████·█·█·█·███··█···█·█·█·█·███  │
 │   █  ··█·██·██·█··█·█··██···█··█···█·█··██···█   │
 │   █  ███·█···█·█··█·█···█·███··█████·█···█·███   │
 │                                                  │
 │                                                  │
 │   ███                                            │
 │   ·█·  ████·█████·█████                          │
 │   ·█·  █··█·█···█·█····                          │
 │   ·█·  ████·█···█·████·                          │
 │   ███  █··█·█···█·█····                          │
 │        █··█·█████·█████                          │
 │                                                  │
 │        █···█·████·█████·█···█·█···█·████·█████   │
 │        █···█·█··█·█···█·█···█·█···█·█··█·█···█   │
 │        █████·████·█···█·█·█·█·█████·████·████·   │
 │        █···█·█··█·█···█·██·██·█···█·█··█·█···█   │
 │        █···█·█··█·█████·█···█·█···█·█··█·█████   │
 │                                                  │
 │                                                  │
 │   ███                                            │
 │   ··█  █···█·█████·█···█·█████                   │
 │   ███  █···█·█···█·██·██·█····                   │
 │   ··█  █████·█···█·█·█·█·████·                   │
 │   ███  █···█·█···█·█···█·█····                   │
 │        █···█·█████·█···█·█████                   │
 │                                                  │
 │        █████·█████·█████·█████·█████              │
 │        █···█·█·····█···█·█···█·····█              │
 │        █···█·████··█████·█···█··███·              │
 │        █···█·█·····█·····█···█·····█              │
 │        █████·█████·█·····█████·█████              │
 │                                                  │
 └──────────────────────────────────────────────────┘

  Numbers rendered large (5×7). Full store names beside each.
  Multi-word names wrap to next line within the item slot.
  Ripple transition: item 1 appears first, then 2, then 3.
```

Each number + name rendered via BitmapFont, laid out vertically with even
spacing. The ripple transition type works well here — items appear one by one
from top to bottom.

---

## 6. Phase 4: Image Generation & Artifacts (Overview)

> Detailed in a future spec. Summary here for context.

### 6.1 Image Generation Mid-Call

- **Model**: Gemini 2.5 Flash Image (separate from Live API session)
- **Trigger**: LLM issues `generate_image` tool call during voice session
- **Flow**: Edge function calls image API → saves to `generated-guides` bucket
  → returns URL → client either pixelates onto grid or shows as overlay
- **Audio**: Never interrupted (tool calls are async on the WebSocket)
- **Cost**: ~$0.04/image

### 6.2 Artifacts Storage

- **Table**: `generated_content` (already exists, JSONB `content` column)
- **New column**: `call_session_id UUID REFERENCES call_sessions(id)`
- **Bucket**: `generated-guides` (already exists, public read)
- **Types**: `visual_guide`, `treatment_plan`, `care_schedule`, `store_list`
- **Dashboard**: New Artifacts page showing all generated content per user

### 6.3 Image-to-Pixel Sampling

When the LLM generates an image, the client can sample it onto the pixel grid
using the same `GridSampler` from Phase 1. The result is a pixelated
representation of the photo — stays on brand, no modal needed.

For full-resolution viewing, a tap/click on the grid opens the actual image
in a bottom sheet overlay (controls remain accessible at top).

---

## 7. Tool Call Protocol

### 7.1 Tool Declaration (added to ephemeral token config)

```typescript
{
  name: "show_visual",
  description: "Display a visual formation on the pixel canvas during the call. Use this to show plant silhouettes, tool images, text messages, lists, or icons. The pixels will animate from their current shape to the new formation. Available formations include 82 plant species and 37 gardening tools from the asset library, plus dynamic text, lists, and icons.",
  parameters: {
    type: "OBJECT",
    properties: {
      type: {
        type: "STRING",
        description: "Formation type: 'template' for plant/tool art, 'text' for pixel text, 'list' for numbered items, 'icon' for semantic icons, 'compound' for image+text combos"
      },
      id: {
        type: "STRING",
        description: "Template ID for type='template' or 'icon'. Examples: 'monstera_deliciosa', 'watering_can', 'icon_checkmark'. Use the closest match to what you're discussing."
      },
      text: {
        type: "STRING",
        description: "Text to display for type='text'. Keep SHORT — max ~11 chars per line, ~10 lines. All caps recommended."
      },
      items: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "List items for type='list'. Max 5 items, keep each SHORT."
      },
      transition: {
        type: "STRING",
        description: "Animation style: 'morph' (smooth curves, default), 'dissolve' (fade), 'scatter' (explode+reform), 'ripple' (wave from center)"
      },
      hold: {
        type: "INTEGER",
        description: "Seconds to hold formation before returning to orchid. 0 = stay until next show_visual. Default: 8"
      },
    },
    required: ["type"],
  },
}
```

### 7.2 Client-Side Tool Handling

The `show_visual` tool is special — it's handled **client-side** in
`useGeminiLive.ts`, not routed to the edge function. The LLM's tool call
contains all the data needed to render.

```typescript
// In handleToolCallRef.current
const functionCalls = message.toolCall?.functionCalls || [];

for (const fc of functionCalls) {
  if (fc.name === 'show_visual') {
    // Handle client-side — no network round-trip
    const formation = buildFormation(fc.args);
    setCurrentFormation(formation);

    // Send immediate success response so Gemini can keep talking
    sessionRef.current?.sendToolResponse({
      functionResponses: [{
        id: fc.id!,
        name: fc.name!,
        response: { displayed: true },
      }],
    });
    continue; // Don't send to edge function
  }

  // All other tools → edge function as before
  // ...
}
```

This means visual formations have **zero latency** — no network round-trip.
The moment Gemini decides to show something, the animation starts.

### 7.3 Formation Available List

At token creation time, inject the available formation IDs into the system
prompt so the LLM knows what's available:

```typescript
const availableFormations = registry.list().map(f => f.id).join(', ');
const systemPrompt = buildVoiceSystemPrompt(...) + `\n\nAvailable visual formations: ${availableFormations}`;
```

---

## 8. Performance Budget

### 8.1 Frame Budget (16.67ms at 60fps)

| Component | Budget | Notes |
|-----------|--------|-------|
| FormationEngine.update() | 0.1ms | Simple state machine |
| Position computation (6860 pixels) | 0.5ms | Typed array iteration |
| Animation modulation | 0.2ms | sin/cos per pixel |
| LERP smoothing | 0.1ms | Single multiply per pixel |
| PixiJS sprite position upload | 0.2ms | Buffer copy to GPU |
| PixiJS GPU render | 0.5ms | Single draw call via ParticleContainer |
| **Total rendering** | **~1.4ms** | |
| Available for audio/other | **~15ms** | |

### 8.2 Concurrent Systems

| System | Thread | Impact |
|--------|--------|--------|
| Pixel animation | Main thread | ~1.4ms/frame |
| AudioWorklet (mic capture) | Audio thread | Zero main thread |
| AudioContext (playback) | Audio thread | Zero main thread |
| WebSocket (Gemini) | Network/async | Event-based, microseconds |
| Camera stream | Hardware decoded | Zero CPU |
| AnalyserNode (audio level) | Main thread | ~0.1ms/frame (FFT) |

### 8.3 Adaptive Quality

If `requestAnimationFrame` callback measures > 12ms per frame (approaching
budget), automatically:
1. Reduce LERP iterations (skip every other pixel for smoothing)
2. Drop to 30fps (double dt per tick)
3. Reduce active pixel count by disabling fade-in/out particles

---

## 9. Asset Catalog

### 9.1 Sampling Source

For each asset, we sample the `_pixel_bw_light.png` variant:

**Pattern:**
```
public/plant_assets_art/{DirName}/{filename}_pixel_bw_light.png
public/tools_art/{DirName}/{filename}_pixel_bw_light.png
```

These have dark content on light background. Sampling threshold: `brightness < 128` = active pixel.

### 9.2 Build Script Integration

```json
// package.json
{
  "scripts": {
    "build:formations": "tsx scripts/build-formations.ts",
    "prebuild": "npm run build:formations",
    "dev": "npm run build:formations && vite"
  }
}
```

The build script scans both asset directories, samples every `_pixel_bw_light.png`,
and outputs `src/lib/pixel-canvas/formations/precomputed/formations.json`.

### 9.3 Adding New Assets

To add a new formation:
1. Place the asset in `public/plant_assets_art/` or `public/tools_art/` following the naming convention
2. Run `npm run build:formations`
3. The new formation appears in the registry automatically
4. Update the system prompt's available formations list (auto-generated at token creation)

---

## Appendix A: Migration from OrchidAvatar

The new `PixelCanvas` component is a drop-in replacement. Props mapping:

| OrchidAvatar Prop | PixelCanvas Prop | Notes |
|-------------------|------------------|-------|
| `isSpeaking` | `isSpeaking` | Identical |
| `isListening` | `isListening` | Identical |
| `outputAudioLevel` | `outputAudioLevel` | Identical |
| `isThinking` | `isThinking` | Identical |
| — | `formation` | NEW: driven by tool calls |
| — | `onFormationComplete` | NEW: callback when morph finishes |

In `CallScreen.tsx`, replace:
```typescript
<OrchidAvatar
  isSpeaking={isSpeaking}
  isListening={isListening}
  outputAudioLevel={outputAudioLevel}
  isThinking={isToolExecuting}
/>
```
with:
```typescript
<PixelCanvas
  isSpeaking={isSpeaking}
  isListening={isListening}
  outputAudioLevel={outputAudioLevel}
  isThinking={isToolExecuting}
  formation={currentFormation}
  onFormationComplete={() => setCurrentFormation(null)}
/>
```

## Appendix B: Existing Code to Port (Not Rewrite)

| Current File | Port Into | What to Keep |
|-------------|-----------|--------------|
| `OrchidAvatar.tsx` animation loop | `AnimationLayer.ts` | Breathe, speak, listen, think formulas verbatim |
| `qr-morph-canvas.tsx` morphing | `FormationEngine.ts` | Bezier pairing, control points, stagger, easing |
| `orchid-grid.ts` sampling | `GridSampler.ts` | Offscreen canvas + brightness threshold |

The existing morph math and animation formulas are battle-tested. Port them
as-is into the new architecture — only the rendering backend changes (Canvas 2D
→ PixiJS).

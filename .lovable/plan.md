
# Fix: Cascade Loading on /demo Page

## Problem
The PixelCanvas appears last because it has two async initialization steps (PixiJS app init + orchid image sampling) while the intro text and input bar render instantly. This causes a jarring "pop-in" effect.

## Solution
Stagger the visibility of the three landing elements so they cascade in order, and make the canvas container reserve its space immediately (preventing layout shift):

1. **Canvas first** -- Reserve space immediately with a fixed-height container. The canvas fades in as soon as PixiJS initializes (it already does, but the text/input currently beat it).

2. **Stagger text and input** -- Delay the intro text and input bar appearance so they animate in *after* the canvas, creating a top-down cascade:
   - Canvas: appears immediately (no artificial delay, just its natural init time)
   - Intro text: delay 300ms
   - Input bar + turn counter: delay 500ms

3. **Preload the orchid image** -- Add a `<link rel="preload">` in `index.html` for the orchid PNG so it's already cached by the time the PixelCanvas component mounts. This significantly reduces the canvas init time.

## Changes

### 1. `index.html`
Add a preload link for the orchid image so the browser fetches it early:
```html
<link rel="preload" href="/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_pixel_bw_light.png" as="image" />
```

### 2. `src/pages/DemoPage.tsx`
- Add staggered animation delays to the landing elements using framer-motion's `transition.delay`:
  - Landing canvas wrapper: `delay: 0` (no change)
  - Landing text: `delay: 0.3` (appears 300ms after mount)
  - Input bar wrapper: `delay: 0.5` on an AnimatePresence/motion wrapper (appears 500ms after mount)
  - Turn counter: same 0.5s delay
- Wrap the input bar and turn counter in a motion.div with initial opacity 0 that fades in with the delay (only on the landing state, i.e., when `!hasSentMessage`)

### 3. `src/lib/pixel-canvas/PixelCanvas.tsx`
No changes needed -- the async init is the bottleneck, and preloading the image will make it faster. The canvas already renders as soon as PixiJS is ready.

## Result
The page will load as: black screen -> canvas fades in -> intro text fades in -> input area fades in, creating a smooth top-down cascade. The image preload means the canvas should appear within ~100-200ms of mount instead of ~500ms+.

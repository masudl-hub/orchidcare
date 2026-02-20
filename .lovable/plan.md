

# Fix: Landing Page Black Rectangle + Video Call Toolbar

## Issue 1: Black Rectangle Before De-pixelation

**Root cause**: In `orchid-hero.tsx` lines 85-90, a dark placeholder (`#0a0a0a`) is painted on the canvas immediately in `useEffect`, before the orchid image has loaded. This creates a visible black rectangle sitting in the layout while the image downloads. Once the image loads, the first de-pixelation frame overwrites it -- but there's a noticeable flash of black in between.

**Fix**: Instead of painting a dark fill, keep the canvas invisible (opacity 0) until the first de-pixelation frame is actually drawn. Add a state like `canvasReady` that flips to `true` right after `drawAtResolution(PIXEL_STEPS[0])` is called in the `img.onload` handler. Apply `opacity: 0` to the canvas until `canvasReady` is true. Remove the `ctx.fillStyle` / `ctx.fillRect` placeholder entirely.

### Changes to `src/components/landing/orchid-hero.tsx`:
- Add `canvasReady` state, default `false` (or `true` if `fromApp`)
- Remove lines 85-91 (the dark placeholder fill)
- In `img.onload`, after `drawAtResolution(PIXEL_STEPS[0])`, set `canvasReady = true`
- On the `<canvas>` element, add `opacity: canvasReady ? 1 : 0` so nothing shows until the first pixelated orchid frame is rendered

---

## Issue 2: Video Call Toolbar Redesign

**Current problem**: `CallControls` renders all 5 buttons (mic, end, video, flip, capture) in one row. When video is active, the extra buttons push the row past screen margins.

**Fix**: Split the controls so the bottom bar only has 3 core buttons, and flip/capture float as small buttons in the top-right when video is on.

### Changes to `src/components/call/CallControls.tsx`:
- Remove the flip camera button (lines 117-143)
- Remove the capture snapshot button (lines 146-171)
- Remove `facingMode`, `onToggleFacingMode`, `onCaptureSnapshot` from props
- Keep only: mic toggle, end call, video toggle

### Changes to `src/components/call/CallScreen.tsx`:
- Add a top-right button group (absolute positioned, `top: 16px`, `right: 16px`, `z-index: 20`) that renders only when `isVideoActive`:
  - Flip camera button (36x36px, subtle border)
  - Capture button (36x36px, subtle border)
  - Stacked vertically with 8px gap
- Position this group above/beside the pixel canvas (which already sits top-right in video mode)
- Remove `facingMode` and `onCaptureSnapshot` from the `CallControls` usage since those buttons move to the overlay
- Adjust pixel canvas top-right positioning to leave room: e.g. `top: 100px` so the small buttons sit above it

### Visual layout in video mode:

```text
+----------------------------------+
|                    [flip]         |
|                    [capture]      |
|                    [pixel canvas] |
|         [video feed]              |
|                                   |
|        "orchid is speaking..."    |
|       [mic]  [end]  [video] 00:42 |
+----------------------------------+
```



# Fix: Make De-pixelation Start Instantly

## Problem

The de-pixelation animation in `orchid-hero.tsx` cannot start until the full-resolution orchid PNG finishes downloading from the network. The entire animation is gated on `img.onload` (line 96). On cold loads or slower connections, there's a dead period where the canvas slot is blank (opacity 0) while the browser fetches the image.

## Solution

Inline a tiny base64-encoded version of the orchid (approximately 3-4px wide) directly in the source code. This lets the first blocky frame render **synchronously on mount** with zero network dependency. The full-res image loads in parallel and seamlessly takes over for the remaining steps.

## Technical Details

### Changes to `src/components/landing/orchid-hero.tsx`:

1. **Add a base64 constant** at the top of the file: a ~3x5px downsampled orchid PNG encoded as a data URI. At that resolution it's roughly 100-200 bytes of base64 text. This will be generated once from the source asset.

2. **Restructure the `useEffect`** into two parallel tracks:
   - **Immediate (synchronous on mount)**: Create an `Image` from the base64 data URI. Since data URIs load synchronously, call `drawAtResolution(PIXEL_STEPS[0])` immediately and set `canvasReady = true`. The user sees the blocky orchid shape on the very first paint.
   - **Async (network)**: Start loading the full-res PNG in parallel. When it arrives, swap `imgRef.current` to the real image and continue the de-pixelation steps from the current position.

3. **No change to `drawAtResolution`**: It already accepts any `Image` and downsamples it. Drawing a 3px source at 3px output looks identical to drawing a 180px source at 3px output -- the early blocky steps are visually indistinguishable regardless of source resolution.

4. **Timing**: Start the step timer immediately using the placeholder. The first few steps (3px, 4px, 6px, 8px) will all look nearly identical from the tiny source -- by the time the animation reaches the steps where resolution matters (~12px+), the real image will have loaded and taken over.

### Generating the placeholder

Use any image tool to resize the orchid PNG to 3px wide (maintaining aspect ratio), export as PNG, and base64-encode. Paste the result as a constant like:

```
const ORCHID_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgo...";
```

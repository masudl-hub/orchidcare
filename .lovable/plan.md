

# Fix: High-Quality Plant Snapshot Capture During Video Calls

## Problem

The snapshot system reuses the low-quality 1fps stream frame (640px, JPEG 0.7) for permanent plant snapshots. This is inadequate for plant health diagnosis and visual memory. Additionally, the frame capture is gated behind `onVideoFrame`, causing silent failures.

## Changes

### 1. Add a dedicated high-res snapshot method to `useVideoCapture.ts`

Add a new `captureHighResFrame(): string | null` method that:
- Grabs a frame directly from the live `<video>` element at its **native resolution** (not the 640px canvas)
- Creates a temporary full-resolution canvas
- Encodes as JPEG at **quality 0.95**
- Returns the base64 data URL (or null if video isn't active)

This is completely separate from the 1fps streaming interval.

### 2. Fix the `onVideoFrame` guard bug in `useVideoCapture.ts`

Change the interval guard on line 45 from:
```
if (!onVideoFrame.current || !videoElRef.current || !canvasRef.current) return;
```
to:
```
if (!videoElRef.current || !canvasRef.current) return;
```

Move the `onVideoFrame` check to only gate the callback forwarding, not the frame storage. This ensures `lastFrameDataUrlRef` is always populated when video is active.

### 3. Update `useGeminiLive.ts` to use the high-res capture

At line 151, instead of reading from `lastFrameDataUrlRef` (low-res stream frame), call the new `captureHighResFrame()` method for `capture_plant_snapshot` tool calls.

### 4. Request higher camera resolution

Change the `getUserMedia` constraints from `640×480` to `1920×1080` (ideal). The stream will still downsample to 640px for the 1fps realtime feed, but the native `<video>` element will have full resolution available for snapshots.

### 5. Fix PwaChat build error

Add `pendingAction?: any` to the `replyData` type on line 405.

## Files Changed

- `src/hooks/call/useVideoCapture.ts` — add `captureHighResFrame()`, fix guard, bump camera resolution
- `src/hooks/useGeminiLive.ts` — use high-res capture for snapshot tool calls
- `src/components/pwa/PwaChat.tsx` — fix type error (line 405)

## Outcome

- 1fps stream stays lightweight (640px, 0.7 quality) for realtime AI input
- Snapshots capture at native camera resolution (1080p+) with 0.95 quality
- No more silent failures when `onVideoFrame` isn't wired yet




# Voice Call Bug Audit — Root Causes and Fixes

## Bug 1: Video Permission Prompted Immediately on Call Start

**Root Cause**: In `useGeminiLive.ts` line 319, the `connect()` function runs `video.requestPermission()` in a `Promise.all` alongside mic and WebSocket setup. This calls `getUserMedia({ video: true })` immediately when the call starts, triggering the camera permission prompt before the user ever taps the video toggle.

**Fix**: Remove `video.requestPermission()` from the `Promise.all` in `connect()`. Camera permission should only be requested when the user taps the video toggle button, which already happens correctly in `toggleVideo()` via `video.startCapture()`.

```
// BEFORE (lines 311-323):
const [session] = await Promise.all([
  sessionPromise,
  capture.startCapture()...,
  video.requestPermission()...,  // <-- triggers video prompt immediately
]);

// AFTER:
const [session] = await Promise.all([
  sessionPromise,
  capture.startCapture()...,
  // video permission removed — requested on-demand via toggleVideo
]);
```

---

## Bug 2: No Friendly "Audio Rejected" Message

**Root Cause**: When mic access is denied, the code (line 329) sets a generic error like `Mic error: NotAllowedError: Permission denied`. There's no user-friendly "Audio access rejected. Call ended." message, and it shows the raw error on a debug-style error screen.

**Fix**: Detect `NotAllowedError` specifically in the mic error handling and show a clear, friendly message. Also set status to `'ended'` instead of `'error'` so it doesn't show the debug log panel.

---

## Bug 3: Black Screen After Video Toggle

**Root Cause**: When video starts, the `CallScreen` renders a `<video>` element and attaches the stream via a `useEffect` that depends on `[videoStream, isVideoActive]`. However, if the video stream or session gets interrupted (e.g., by a tool call or SDK message), the stream can become stale. Additionally, if `video.requestPermission()` already acquired and released a camera stream during connect, the subsequent `toggleVideo` -> `startCapture` might encounter device contention on some mobile browsers, resulting in a black feed.

**Fix**: Removing `requestPermission()` from connect (Bug 1 fix) also resolves this -- no prior stream acquisition means no device contention when the user actually toggles video.

---

## Bug 4: VAD / Interruption Sensitivity

**Root Cause**: No custom VAD config is being passed from either `LiveCallPage` or `DemoVoiceOverlay` -- so the SDK uses its defaults. The SDK's default `automaticActivityDetection` can be overly sensitive, causing Orchid to get interrupted mid-sentence by ambient noise or brief sounds. The current interruption handler (`playback.flush()`) correctly stops audio, but the SDK may be triggering it too aggressively.

**Fix**: Pass explicit VAD configuration with `END_SENSITIVITY_LOW` and a longer silence duration (e.g., 1500ms) to reduce false interruptions. This makes the system wait longer before deciding the user has finished speaking, and raises the threshold for what counts as an interruption.

---

## Files to Modify

### `src/hooks/useGeminiLive.ts`
1. Remove `video.requestPermission()` from the `Promise.all` in `connect()` (lines 311-323)
2. Add `NotAllowedError` detection for mic failure with friendly message and `'ended'` status (lines 326-335)
3. Add default VAD config (`endOfSpeechSensitivity: 'low'`, `silenceDurationMs: 1500`) when no vadConfig is provided (lines 248-265)
4. Remove `video.requestPermission` from the `connect` dependency array (line 384)

### `src/pages/LiveCallPage.tsx`
- Update the error display to handle the `'ended'` status for permission denial (show "Audio access rejected" with a close button instead of the debug error screen)

### `src/components/demo/DemoVoiceOverlay.tsx`
- No changes needed -- it already handles `'error'` and `'ended'` status transitions correctly

### `src/hooks/call/useVideoCapture.ts`
- No changes needed -- `requestPermission` function stays available but just won't be called during connect

---

## Summary of Behavior After Fix

1. User opens call -> mic permission prompt only, no video prompt
2. If mic denied -> clean "Audio access rejected. Call ended." message with close button
3. If mic approved -> call connects, Orchid speaks immediately
4. User taps video toggle -> camera permission prompt appears
5. If camera denied -> video stays off, user can tap again to retry
6. If camera approved -> video feed appears, no black screen
7. Orchid's responses are less likely to be interrupted by ambient noise


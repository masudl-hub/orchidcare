

# Airtight Walkie-Talkie Audio Gate

## Problem

Two issues cause accidental interruptions:

1. **Stale closure**: `playback.isSpeaking` on line 374 of `useGeminiLive.ts` is captured once at connect-time and never updates inside the `onAudioData` callback. The gate is always "open."
2. **Missing activity signals**: With `automaticActivityDetection.disabled: true`, the Gemini docs require the client to send `activityStart` before audio and `activityEnd` when the user stops speaking. We currently send neither -- raw media chunks arrive with no turn framing.

## Changes

### 1. Add `isSpeakingRef` to `useAudioPlayback.ts`

Add a `useRef<boolean>(false)` that stays in sync with every `setIsSpeaking` call. Expose it in the return value so `useGeminiLive` can read it synchronously.

### 2. Fix the audio gate in `useGeminiLive.ts`

Replace the stale state check:

```
// Before (broken — stale closure)
if (sessionRef.current && !playback.isSpeaking)

// After (always-current ref)
if (sessionRef.current && !playback.isSpeakingRef.current)
```

### 3. Add `activityStart` / `activityEnd` framing

Track an `isUserSpeaking` ref. When the gate allows audio through:

- On the **first chunk** after silence (or after playback ends), send `activityStart` before the media chunk
- When the model starts speaking (isSpeakingRef flips to true), send `activityEnd` to close the user's turn

This matches the documented protocol for disabled-VAD mode and gives the model clean turn boundaries.

### 4. Fix `interruptModel` stale ref

`interruptModel` (line 506) also checks `playback.isSpeaking` which has the same stale-closure risk. Update to use the ref.

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/call/useAudioPlayback.ts` | Add `isSpeakingRef` kept in sync with state; expose in return |
| `src/hooks/useGeminiLive.ts` | Use `isSpeakingRef.current` for gate; add `activityStart`/`activityEnd` signaling; fix `interruptModel` |

## What We Are NOT Doing

- **Buffering audio during agent speech**: Unnecessary complexity. The gate simply blocks mic data while the model speaks. When it finishes, the user's next utterance flows naturally as a new turn.
- **Energy-threshold VAD**: The activity framing (start/end signals) gives the model enough information. No need for client-side speech detection.

## Confidence

| Aspect | Confidence | Reason |
|--------|-----------|--------|
| Ref-based gate closes the race window | ~95% | Synchronous ref vs async React state -- well-understood pattern |
| Activity framing improves turn handling | ~85% | Docs explicitly require it for disabled-VAD mode; aligns with SDK examples |
| No buffering needed | ~90% | Clean gate + activity signals give the model clear turn boundaries |


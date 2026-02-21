

# Disable Auto-Interruption + Add Manual Interrupt Button

## What This Does

Two changes working together:

1. **Disable automatic barge-in** -- the model will no longer get cut off by background noise, bumps, or accidental sounds. It always finishes its thought.
2. **Add a manual "interrupt" button** -- appears only while the model is speaking, letting users intentionally cut in when needed.

The tradeoff: users must tap the button to interrupt. For a plant care assistant with tool-heavy flows, this is the right call -- losing a tool chain mid-execution is far worse than waiting a few seconds.

---

## Technical Changes

### 1. Disable Server-Side VAD + Client-Side Audio Gating

**File:** `src/hooks/useGeminiLive.ts`

**a) Replace VAD config (lines 252-259)** with disabled automatic activity detection:

```typescript
realtimeInputConfig: {
  automaticActivityDetection: {
    disabled: true,
  },
},
```

**b) Gate outgoing audio (lines 363-372)** -- stop sending audio chunks while the model is speaking:

```typescript
capture.onAudioData.current = (base64: string) => {
  if (sessionRef.current && !playback.isSpeaking) {
    audioChunkCount++;
    if (audioChunkCount <= 3 || audioChunkCount % 50 === 0) {
      log(`Sending audio chunk #${audioChunkCount} (${base64.length} chars)`);
    }
    sessionRef.current.sendRealtimeInput({
      media: { data: base64, mimeType: 'audio/pcm;rate=16000' },
    });
  }
};
```

**c) Neuter interruption handler (lines 180-183)** -- log-only, no flush:

```typescript
if (message.serverContent?.interrupted) {
  log('Received interrupted signal (VAD disabled -- unexpected)');
}
```

**d) Remove `vadConfig` from connect signature and refs** (lines 37, 214) -- the option no longer exists.

### 2. Add `interruptModel` Method

**File:** `src/hooks/useGeminiLive.ts`

New callback alongside `disconnect`, `toggleMic`, etc.:

```typescript
const interruptModel = useCallback(() => {
  if (!sessionRef.current || !playback.isSpeaking) return;
  log('User triggered manual interrupt');

  // 1. Silence the audio output immediately
  playback.flush();

  // 2. Send a client turn so the model stops generating and listens
  sessionRef.current.sendClientContent({
    turns: [{ role: 'user', parts: [{ text: '(user interrupted -- listening now)' }] }],
    turnComplete: true,
  });

  setIsListening(true);
}, [playback, log]);
```

Expose in the return object alongside other methods.

### 3. Add Interrupt Button to CallScreen

**File:** `src/components/call/CallScreen.tsx`

New prop `onInterrupt`. Renders a button in the top-left corner, visible only when `isSpeaking` is true:

```typescript
{isSpeaking && onInterrupt && (
  <button
    onClick={onInterrupt}
    style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: 20,
      backgroundColor: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '0',
      padding: '8px 14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '11px',
      color: 'rgba(255,255,255,0.8)',
      letterSpacing: '0.05em',
    }}
    aria-label="Interrupt"
  >
    interrupt
  </button>
)}
```

Matches the existing visual language (semi-transparent background, monospace, no border-radius) -- same as the flip-camera and snapshot buttons.

### 4. Wire Through Call Pages

**Files:** `src/pages/LiveCallPage.tsx`, `src/pages/DevCallPage.tsx`, `src/components/demo/DemoVoiceOverlay.tsx`

One-liner each: pass `onInterrupt={gemini.interruptModel}` to `CallScreen`.

### 5. Clean Up DevCallPage VAD Controls

**File:** `src/pages/DevCallPage.tsx`

Remove the now-unused state variables and UI controls:
- `vadEndSensitivity` state and buttons (lines 68, 396-410)
- `vadSilenceMs` state and slider (lines 69, 412-428)
- `vadConfig` spread in `startQuick` and `startFull` calls (lines 129-137, 182-188)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useGeminiLive.ts` | Disable server VAD, gate outgoing audio, neuter interrupt handler, add `interruptModel` method, remove `vadConfig` option |
| `src/components/call/CallScreen.tsx` | Add `onInterrupt` prop, render conditional interrupt button top-left |
| `src/pages/LiveCallPage.tsx` | Pass `onInterrupt` prop |
| `src/pages/DevCallPage.tsx` | Pass `onInterrupt` prop, remove VAD controls and state |
| `src/components/demo/DemoVoiceOverlay.tsx` | Pass `onInterrupt` prop |


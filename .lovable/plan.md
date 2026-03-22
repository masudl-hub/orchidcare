

# Fix: Photo Lost on Confirmation Retry for `capture_plant_snapshot`

## Root Cause

The logs confirm exactly what's happening:

1. User sends photo + message → orchid-agent uploads to storage (`5badcfca.../1774153265726.jpeg`) → calls `capture_plant_snapshot` → blocked by `session_consent` policy → returns `requiresConfirmation`
2. User clicks "Confirm" in PWA → PwaChat sends `confirmationGranted: true` with **no photo** (line 475: only text `"(User confirmed: capture_plant_snapshot)"`)
3. orchid-agent re-runs the full LLM loop → `uploadedPhotoPath = null` → LLM calls `capture_plant_snapshot` again → `photoUrl` is `undefined` → fails with "No image available" or the agent says "the image didn't come through"

The photo was already uploaded to storage on the first request. It's sitting there. But the confirmation retry doesn't know about it.

This is NOT about `capture_plant_snapshot` vs `modify_plant` — `capture_plant_snapshot` already updates `plants.photo_url` (lines 775-781 in tools.ts). The problem is purely that the confirmation retry drops the photo context.

## Solution: Persist the uploaded photo path in the pending action

Instead of re-running the full LLM loop on confirmation, directly re-execute the pending tool with its original args AND the photo path.

### 1. Save `uploadedPhotoPath` in the `pendingAction` response (orchid-agent)

When a tool requires confirmation (line 1967-1980), include the photo path in the response:

```typescript
pendingAction: {
  tool_name: functionName,
  args,
  reason: toolResult.reason,
  tier: toolResult.tier,
  photoPath: uploadedPhotoPath || null,  // NEW
}
```

Also save it in the `agent_operations` metadata (line 1954).

### 2. Pass the photo path back on confirmation retry (PwaChat)

When the user clicks confirm (line 474), include the stored photo path:

```typescript
body: {
  message: `(User confirmed: ${action.tool_name})`,
  confirmationGranted: true,
  skipInboundSave: true,
  pendingToolName: action.tool_name,
  pendingArgs: action.args,
  pendingPhotoPath: action.photoPath,  // NEW
}
```

### 3. Short-circuit the LLM on confirmation retry (orchid-agent)

When `confirmationGranted` is true AND `pendingToolName` + `pendingArgs` are provided, skip the LLM entirely — just execute the tool directly with the saved args and photo path. This is faster, cheaper, and eliminates the photo-loss bug.

Add this before the LLM call in orchid-agent:

```typescript
if (confirmationGranted && payload.pendingToolName && payload.pendingArgs) {
  // Direct tool execution — no need to re-prompt the LLM
  const shared = await executeSharedTool({
    supabase, profileId: profile?.id,
    apiKeys: { ... },
    sourceMessageId: inboundMessage?.id,
    photoUrl: payload.pendingPhotoPath || undefined,
    sessionId: `${profile?.id}:${channel}`,
    confirmationGranted: true,
  }, payload.pendingToolName, payload.pendingArgs);
  // ... handle result and return
}
```

### 4. Same fix for PwaChat `pendingAction` type

Ensure the `pendingAction` type includes `photoPath?: string` (already partially addressed).

## Files Changed

- `supabase/functions/orchid-agent/index.ts` — include `photoPath` in pendingAction response; add short-circuit path for confirmed tool re-execution
- `src/components/pwa/PwaChat.tsx` — pass `pendingArgs`, `pendingToolName`, and `pendingPhotoPath` on confirm click
- Deploy orchid-agent and pwa-agent

## Outcome

- Confirmation retries execute instantly (no LLM re-call)
- Photo path is preserved across the confirmation round-trip
- `capture_plant_snapshot` receives the uploaded photo and correctly saves the snapshot + updates `plants.photo_url`
- This fixes ALL tools that involve media + confirmation, not just snapshots


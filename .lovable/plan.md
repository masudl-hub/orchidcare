

# Post-Audit Cleanup — Implementation Plan

## Overview

The audit identified 7 tasks across frontend and backend. All 7 are still valid and can be tackled in Lovable. I've verified every file and line reference — they're accurate. Here's the breakdown grouped into two batches.

## Batch 1: Critical Fixes (Tasks 1-3)

These are quick, surgical fixes with no risk of side effects.

### Task 1: Fix annotation grid mismatch (5x5)
**4 files, ~15 line changes total**

The voice call annotation tool tells the AI model to use 3x3 region names (TL, MC, BR) but the client expects 5x5 names (T1, M3, B5). Every annotation lands at center. Fix by updating tool declarations and system prompt examples in:
- `supabase/functions/call-session/index.ts`
- `supabase/functions/dev-call-proxy/index.ts`
- `supabase/functions/demo-agent/index.ts`
- `supabase/functions/_shared/context.ts`

### Task 2: Fix WebSocket leak on mic failure
**1 file, 1 line added**

In `src/hooks/useGeminiLive.ts` line 316-322: when mic permission fails, the WebSocket session opened in parallel is never closed. Add `try { session.close(); } catch {}` before setting error state.

### Task 3: Redirect /plants to /dashboard/collection
**1 file, replace contents**

`src/pages/Plants.tsx` is a visible TODO stub. Replace with a simple `<Navigate to="/dashboard/collection" replace />`. Already wrapped in ProtectedRoute.

## Batch 2: Medium Priority (Tasks 4-7)

### Task 4: Fix dead "Try Demo" buttons
**2 files**

`src/pages/Proposal.tsx` and `src/pages/Index.tsx` both have `setDemoOpen(true)` onClick handlers that do nothing (the overlay component was removed). Replace with `navigate('/demo')` and remove dead `demoOpen` state.

### Task 5: Clean up console.logs
**5 files**

Wrap verbose debug logging in `if (import.meta.env.DEV)` guards across: `useSettings.ts`, `Dashboard.tsx`, `Settings.tsx`, `PixelCanvas.tsx`, `DemoVoiceOverlay.tsx`. Skip `useGeminiLive.ts` (intentionally visible for Telegram Mini App debugging).

### Task 6: Deduplicate call-session and dev-call-proxy
**3 new shared files, 2 files refactored**

Extract identical code into:
- `_shared/deepThink.ts` — `callDeepThink` function
- `_shared/voiceTools.ts` — tool declarations array (with 5x5 grid from Task 1)
- `_shared/toolExecutor.ts` — `executeTool` function

Note: `demo-agent/index.ts` also has its own `callDeepThink` copy. The audit task only covers call-session and dev-call-proxy, but we could optionally include demo-agent too.

### Task 7: Remove Twilio dead code
**2 files**

Remove all 8 `TWILIO DISABLED` blocks from `orchid-agent/index.ts` (~500 lines of dead code), simplify channel detection to just `"telegram"`, and clean up `phone_number`/`whatsapp_number` from `proactive-agent/index.ts` interface and query (confirmed at lines 24-25 and 268).

## Execution Order

Tasks 1-3 first (critical, independent of each other). Then 4-7 in any order, except Task 6 should follow Task 1 (it extracts the already-updated 5x5 tool declarations).

## What Can't Be Done Here

Everything is doable. The only consideration is Task 6 (deduplication) touches large files and needs careful testing — voice calls should be verified after deployment. All other tasks are low-risk.

## Summary

| Task | Priority | Files | Risk | Est. Lines Changed |
|------|----------|-------|------|--------------------|
| 1. Grid mismatch | Critical | 4 | Low | ~15 |
| 2. WebSocket leak | Critical | 1 | Low | ~1 |
| 3. Plants redirect | Critical | 1 | Low | ~5 |
| 4. Dead demo buttons | Medium | 2 | Low | ~10 |
| 5. Console.log cleanup | Medium | 5 | Low | ~20 |
| 6. Deduplication | Medium | 5 | Medium | ~600 (moved) |
| 7. Twilio removal | Medium | 2 | Low | ~500 (deleted) |

I'd recommend we start with Batch 1 (Tasks 1-3) in one go, then move to Batch 2.

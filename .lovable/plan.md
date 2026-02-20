

# Post-Audit Cleanup — Implementation Plan

## Status: ✅ ALL TASKS COMPLETE

All 7 tasks from the audit have been implemented and deployed.

| Task | Status | Summary |
|------|--------|---------|
| 1. Grid mismatch | ✅ Done | Updated annotate_view tool + system prompt to 5x5 grid (T1-B5) |
| 2. WebSocket leak | ✅ Done | Added `session.close()` on mic failure in useGeminiLive.ts |
| 3. Plants redirect | ✅ Done | Replaced Plants.tsx stub with `<Navigate to="/dashboard/collection" />` |
| 4. Dead demo buttons | ✅ Done | Replaced `setDemoOpen(true)` with `navigate('/demo')` in Index.tsx + Proposal.tsx |
| 5. Console.log cleanup | ✅ Done | Wrapped verbose logs in `import.meta.env.DEV` guards across 5 files |
| 6. Deduplication | ✅ Done | Extracted shared modules (`deepThink.ts`, `voiceTools.ts`, `toolExecutor.ts`); wired into call-session, dev-call-proxy, and demo-agent |
| 7. Twilio removal | ✅ Done | Removed ~500 lines of dead TWILIO code from orchid-agent, cleaned proactive-agent |

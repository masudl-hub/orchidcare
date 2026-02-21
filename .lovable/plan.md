

# Switch Default Voice to Algenib

## Current State

The voice call system already supports per-session voice selection:
- The `call_sessions` table has a `voice` column (default: `'Aoede'`)
- Both `call-session` and `dev-call-proxy` edge functions read `session.voice || "Aoede"` when requesting the Gemini ephemeral token

No profile-level voice preference exists yet, but the plumbing is there for future expansion.

## Change

Update the default voice from `Aoede` to `Algenib` in three places:

| File | Change |
|------|--------|
| `call_sessions` table | Alter column default from `'Aoede'` to `'Algenib'` (DB migration) |
| `supabase/functions/call-session/index.ts` | Change fallback from `"Aoede"` to `"Algenib"` |
| `supabase/functions/dev-call-proxy/index.ts` | Change fallback from `"Aoede"` to `"Algenib"` |

The `demo-agent` function hardcodes `"Aoede"` -- this will also be updated to `"Algenib"` for consistency.

## Future (not in this change)

When you're ready to let users pick their voice, the approach would be:
1. Add a `preferred_voice` column to `profiles`
2. Read it when creating a call session
3. Add a voice picker in settings UI

But for now, this just swaps the default to Algenib everywhere.

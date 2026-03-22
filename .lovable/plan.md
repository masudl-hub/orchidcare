

# Fix: Regenerate Types to Include `metadata` Column

## Problem

The `conversations` table has a `metadata` jsonb column in the actual database, but the auto-generated `src/integrations/supabase/types.ts` file doesn't include it. This causes TypeScript to reject `.select('... metadata ...')` queries.

## Solution

1. **Regenerate the Supabase types** — This file is auto-generated and should pick up the `metadata` column that already exists in the database. No schema migration needed.

2. **Add retry with exponential backoff to orchid-agent** — Implement `fetchWithRetry` helper wrapping orchestrator `fetch` calls with max 3 attempts, exponential backoff (1s, 2s, 4s), retrying on 502/503/429.

## Files Changed

- `src/integrations/supabase/types.ts` — regenerated (automatic)
- `supabase/functions/orchid-agent/index.ts` — add `fetchWithRetry` helper, apply to orchestrator calls
- Deploy `orchid-agent`


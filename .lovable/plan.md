

# Port Shopping Improvements to demo-agent (Simplified)

## Overview

Port the Maps Grounding fix and system prompt guidance from orchid-agent. Skip all caching machinery -- the demo's 3-turn conversation window already serves as implicit context for follow-up "show me more" queries.

## Changes (single file: `supabase/functions/demo-agent/index.ts`)

### 1. Fix Maps Grounding -- Pass GEMINI_API_KEY

`callMapsShoppingAgent` now uses the `@google/genai` SDK directly and needs a real Gemini key, not the Lovable gateway key.

- Thread `GEMINI_API_KEY` (from `Deno.env.get`) into `executeDemoTool` and `handleChat`
- In the `find_stores` handler (~line 855), pass `GEMINI_API_KEY` instead of `apiKey`
- In the voice-tools `find_stores` handler (~line 1663), same fix

### 2. Update System Prompt with Follow-up Guidance

Add to `SYSTEM_PROMPT`:

```
FOLLOW-UP STORE QUERIES:
When the user asks for "more stores," "other options," or "what else" for the same product:
- Look at your conversation history -- you already shared store results in a prior turn
- Present DIFFERENT stores you haven't mentioned yet
- Only call find_stores again if the PRODUCT or LOCATION has actually changed
```

This leverages the existing 3-turn history window. No new tools, no client-side storage, no extra payload.

### 3. No Caching, No Backfill

- No `get_cached_stores` tool (no DB, no profile)
- No coordinate backfill (no profile to update)
- No localStorage/IndexedDB integration

## Why This Is Sufficient for Demo

- Demo sessions are capped at 5 text turns -- the conversation window covers the full session
- The LLM already sees prior assistant messages containing store names, addresses, and details
- System prompt guidance is enough to steer it toward referencing prior results instead of re-searching
- Zero added complexity

## Summary

| Change | Detail |
|--------|--------|
| Thread `GEMINI_API_KEY` | Pass to `find_stores` handler in both chat and voice paths |
| System prompt | Add follow-up store query guidance |
| Skipped | `get_cached_stores` tool, coordinate backfill, client-side caching |


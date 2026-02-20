

# Cache Store Results + Backfill Coordinates

## Overview

Two changes to `supabase/functions/orchid-agent/index.ts`:
1. Fire-and-forget lat/lng backfill after `find_stores` when profile is missing coordinates
2. Cache full store results in `generated_content` (already profile-gated via RLS) and add a `get_cached_stores` tool for fast follow-ups

No database migrations needed. No changes to `research.ts`.

## Security Note

The `generated_content` table already has RLS policies that restrict access to each user's own data (`profile_id` must match `auth.uid()` via the `profiles` table). All inserts from the edge function use the service role and always set `profile_id: profile.id`, so store results are private per-user by design.

## Changes (single file)

### `supabase/functions/orchid-agent/index.ts`

**A. Backfill coordinates (non-blocking)**

After the `find_stores` tool executes successfully, check if the profile lacks `latitude`/`longitude`. If so, fire-and-forget a geocode + update:

```
if (!profile.latitude && profile.location) {
  geocodeLocation(profile.location).then(coords => {
    if (coords) {
      supabase.from("profiles").update({
        latitude: coords.lat,
        longitude: coords.lng
      }).eq("id", profile.id);
    }
  }).catch(() => {});
}
```

**B. Cache store results after find_stores**

After a successful `find_stores` call with results, insert into `generated_content`:

```
supabase.from("generated_content").insert({
  profile_id: profile.id,
  content_type: "store_search",
  content: {
    stores: toolResult.data.stores,
    searchedFor: toolResult.data.searchedFor,
    location: toolResult.data.location,
    timestamp: new Date().toISOString()
  },
  task_description: `Store search: ${args.product_query} near ${profile.location}`
}).then(() => {}).catch(() => {});
```

**C. Add `get_cached_stores` tool definition**

Add to the tools array:
- Name: `get_cached_stores`
- Parameters: `product_query` (string)
- Description: Retrieve recently cached store search results (less than 24h old) for follow-up questions

**D. Add `get_cached_stores` handler**

Query `generated_content` where:
- `profile_id = profile.id`
- `content_type = 'store_search'`
- `created_at > now() - 24 hours`
- `content->searchedFor` matches the product query (fuzzy)

Return the full cached store list so the LLM can pick different stores to highlight.

**E. Update system prompt**

Add instruction block telling the orchestrator:
- When user asks for "more stores" / "other options" / "what else" for the same product, call `get_cached_stores` first
- Only call `find_stores` again if the product or location has changed
- Present different stores from the cached list, not the same ones already shared

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/orchid-agent/index.ts` | Backfill logic, caching logic, new tool definition + handler, system prompt update |


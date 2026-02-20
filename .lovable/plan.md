

# Fix the Shopping Pipeline: Direct Gemini Maps Grounding + Location Infrastructure

## Problem

The `find_stores` pipeline calls the Lovable AI Gateway (OpenAI-compatible) with `tools: [{ type: "google_maps" }]`. The gateway does not support Gemini's Maps Grounding, so `groundingMetadata` is always empty. The model hallucinates store data, Perplexity cleanup mostly fails, and the output is unreliable.

## Solution Overview

1. Switch `callMapsShoppingAgent` to use the Gemini API directly via `@google/genai` SDK
2. Add `latitude`/`longitude` columns to the `profiles` table for persistent geocoding
3. Use a free geocoder (OpenStreetMap Nominatim) to resolve locations to coordinates -- no API key needed, fast, deterministic
4. Extract real store data from Gemini's `groundingMetadata.groundingChunks` instead of parsing hallucinated JSON

---

## Changes

### 1. Database migration: Add lat/lng columns to `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN latitude numeric,
  ADD COLUMN longitude numeric;
```

These are nullable so existing profiles are unaffected. They get populated when a user sets or updates their location (via the agent or the app).

### 2. New helper: `geocodeLocation` in `supabase/functions/_shared/research.ts`

A simple function that calls the OpenStreetMap Nominatim API (free, no key required):

```text
async function geocodeLocation(locationStr: string): Promise<{ lat: number; lng: number } | null>
  - GET https://nominatim.openstreetmap.org/search?q={locationStr}&format=json&limit=1
  - Parse lat/lon from the first result
  - Return { lat, lng } or null
  - Set User-Agent header (required by Nominatim TOS)
```

Why Nominatim over Gemini:
- 100-300ms vs 1-2s latency
- Zero cost vs token usage
- Deterministic -- no hallucination risk for coordinates
- No API key needed

### 3. Rewrite `callMapsShoppingAgent` in `supabase/functions/_shared/research.ts`

**Function signature change:**
```text
Before: (productQuery, storeType, userLocation, LOVABLE_API_KEY, PERPLEXITY_API_KEY?)
After:  (productQuery, storeType, userLocation, GEMINI_API_KEY, PERPLEXITY_API_KEY?, latLng?: {lat, lng})
```

**Core logic:**

a. **Resolve coordinates**: If `latLng` is provided (from DB), use it. Otherwise call `geocodeLocation(userLocation)`.

b. **Call Gemini directly** using the `@google/genai` SDK:
```text
import { GoogleGenAI } from "npm:@google/genai";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    tools: [{ googleMaps: {} }],
    temperature: 0.3
  }
});
```

c. **Extract grounding chunks** from `response.candidates[0].groundingMetadata.groundingChunks`. Each chunk contains:
   - `maps.title` -- verified store name
   - `maps.uri` -- Google Maps link
   - `maps.placeId` -- unique place identifier

d. **Build store list** primarily from grounding chunks (verified data), supplemented by the model's text response for reasoning and product likelihood.

e. **Skip Perplexity address verification** for grounded stores (they already have verified Maps data). Only use Perplexity for inventory verification.

### 4. Update orchestrator in `supabase/functions/orchid-agent/index.ts`

- Where `callMapsShoppingAgent` is called (~line 3127), pass `GEMINI_API_KEY` instead of `LOVABLE_API_KEY`
- Pass the user's stored `latitude`/`longitude` from their profile (already fetched during context loading)
- When the agent sets a user's location, also geocode and store lat/lng in the profile

### 5. Update types in `supabase/functions/_shared/types.ts`

Add/update fields on `StoreRecommendation`:
```text
placeId?: string      -- already exists, will now be reliably populated
mapsUri?: string      -- already exists, will now be reliably populated  
addressVerified: boolean -- true when from Maps grounding
```

No new types needed since these fields already exist in the interface.

### 6. Quality gate for final output

After extracting grounding data:
- Prioritize stores with `placeId` (verified by Maps)
- Include Maps URI so the orchestrator can share clickable navigation links in responses
- Only fall back to Perplexity address lookup for non-grounded results (rare with proper grounding)
- Sort by distance (parsed from model text or estimated from coordinates)

---

## What stays the same

- `verify_store_inventory` -- continues using Perplexity for product availability checks
- `callResearchAgent` -- continues using Perplexity for general research
- `verifyStoreAddress` -- remains as a fallback, will rarely be needed
- Orchestrator tool definitions and conversation flow -- unchanged
- All other Lovable AI Gateway usage in the project -- unchanged (only shopping moves to direct Gemini)

## File summary

| File | Change |
|------|--------|
| `profiles` table | Add `latitude` and `longitude` columns |
| `supabase/functions/_shared/research.ts` | Add `geocodeLocation`, rewrite `callMapsShoppingAgent` to use direct Gemini API |
| `supabase/functions/_shared/types.ts` | No changes needed (fields already exist) |
| `supabase/functions/orchid-agent/index.ts` | Pass `GEMINI_API_KEY` and lat/lng to shopping agent; store lat/lng on location updates |


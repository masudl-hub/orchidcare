
# Close the Prompt Gap (Refined)

## Clarification Applied
- **Text (Telegram)**: User sending a photo IS implicit consent -- auto-capture stays as-is. No changes to `orchid-agent/index.ts` auto-capture blocks.
- **Voice (video call)**: Agent must ask before capturing -- the existing `confirmed` guard in `toolExecutor.ts` already enforces this. The gap is that the system prompt doesn't tell the LLM *how* to behave.

---

## Changes

### 1. Voice System Prompt: Add VISUAL MEMORY behavior section
**File:** `supabase/functions/_shared/context.ts` (~line 608, before `## BULK OPERATIONS`)

Add a new section:

```
## VISUAL MEMORY (Plant Snapshots)
You can capture visual snapshots of plants to build a visual timeline.

CONSENT IS REQUIRED for voice captures. Never capture without asking first.

Flow:
1. After identifying, diagnosing, or saving a plant during a video call, offer:
   "Want me to save a snapshot so I can track how it changes over time?"
2. If they agree, ask them to hold the plant steady in front of the camera.
3. Once they confirm, call capture_plant_snapshot with confirmed=true and a thorough description.
4. If the plant isn't saved yet, save it first with save_plant, then capture the snapshot.

For comparisons:
- When user asks "how has my plant changed?" or "is it getting better?", call compare_plant_snapshots.
- Reference the Visual: descriptions in your context -- mention changes naturally.
  Example: "Last time I saw your Monstera, the new leaf was still unfurling -- looks like it's fully open now!"
```

### 2. Text System Prompt: Enhance snapshot tool entries
**File:** `supabase/functions/_shared/context.ts` (lines 454-455)

Replace the two tool entries with richer behavioral guidance:

```
- capture_plant_snapshot: Save a visual snapshot of a plant for its memory timeline. Auto-captured when you identify/diagnose a saved plant from a photo. For manual use: when a user sends a routine check-in photo of a saved plant, or asks you to "remember what this looks like," capture a snapshot with a detailed visual description.
- compare_plant_snapshots: Compare how a plant looks now vs. previous snapshots. Use when user asks about progress, changes, or growth history. Reference previous Visual: descriptions in your context and mention differences naturally.
```

### 3. Voice tool description: Add consent language and save-first guidance
**File:** `supabase/functions/_shared/voiceTools.ts` (line 296)

Update `capture_plant_snapshot` description to:

```
Capture a visual snapshot of a plant for the visual memory chronicle. NEVER call without explicit user consent -- always ask first ("Want me to save a snapshot?") and wait for confirmation. If the plant isn't saved yet, call save_plant first, then capture the snapshot. Provide a thorough description of what you see.
```

Also add `save_if_missing`, `species`, `nickname`, `location` as optional parameters so the agent has the option to save-and-capture in one logical flow (even though it calls save_plant separately, having the params documented helps the LLM reason about the flow).

### 4. `capturePlantSnapshot` in tools.ts: Add save-if-missing fallback
**File:** `supabase/functions/_shared/tools.ts` (lines 690-694)

When `resolvePlants` finds no match and `args.save_if_missing` is true with a `species` provided, call `savePlant` first, then proceed with the snapshot:

```typescript
if (resolution.plants.length === 0) {
  if (args.save_if_missing && args.species) {
    const saveResult = await savePlant(supabase, profileId, {
      species: args.species,
      nickname: args.nickname,
      location: args.location,
    }, existingImagePath);
    if (!saveResult.success) {
      return { success: false, error: `Couldn't save plant: ${saveResult.error}` };
    }
    plant = saveResult.plant;
  } else {
    return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}". Save it first or include species with save_if_missing: true.` };
  }
}
```

Update the function signature to accept the new optional fields: `save_if_missing?: boolean`, `species?: string`, `nickname?: string`, `location?: string`.

### 5. orchid-agent tool definition: Add save_if_missing params
**File:** `supabase/functions/orchid-agent/index.ts` (capture_plant_snapshot tool definition, ~line 805)

Add `save_if_missing`, `species`, `nickname`, `location` as optional parameters to the tool schema. Update description to note: "If the plant isn't saved yet, set save_if_missing: true and include species so it gets saved alongside the snapshot."

---

## What Stays Unchanged
- Auto-capture in `orchid-agent` for identify/diagnose (text photo = implicit consent) -- **no changes**
- Temporal context injection after auto-capture -- **no changes**
- `toolExecutor.ts` confirmation guard for voice -- **no changes** (already blocks without `confirmed: true`)
- `useGeminiLive.ts` frame injection -- **no changes**
- UI capture button -- **no changes**

## Deployments
After changes: redeploy `orchid-agent`, `call-session`, `dev-call-proxy`.

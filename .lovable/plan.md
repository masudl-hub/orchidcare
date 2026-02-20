

# Plant Visual Memory System

## The Problem

Today, when you send a photo of a plant or show one on a video call, the agent identifies it in the moment and then forgets what it looks like. The `plant_identifications` table stores species/diagnosis text but no visual data. The `plants` table has a `photo_url` but it's just a single snapshot from when the plant was saved -- and even that only works in Telegram text (not voice calls). The agent has zero ability to:

1. Recognize a plant it's seen before from a new photo
2. Compare how a plant looks now vs. weeks ago
3. Show you what your plant looked like when it had spider mites

## Architecture: Plant Snapshots

### New Table: `plant_snapshots`

Each row is a point-in-time visual record of a specific plant.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| plant_id | uuid | FK to plants (required) |
| profile_id | uuid | FK for RLS |
| image_path | text | Storage path in `plant-photos` bucket |
| description | text | AI-generated visual description (color, shape, size, health markers, distinguishing features) |
| context | text | What triggered the snapshot (identification, diagnosis, routine check, user capture) |
| source | text | `telegram_photo`, `voice_call_capture`, `manual_upload` |
| health_notes | text | Any health observations at this point in time |
| created_at | timestamptz | When the snapshot was taken |

### Why Both Image + Description

- **Image (stored in Supabase Storage as JPEG, referenced by path):** Ground truth. When the agent needs to actually "see" the plant again, it fetches the image and sends it to the vision model. This is for high-fidelity comparison.
- **Text description:** Lightweight, searchable, and always included in context. The agent can scan descriptions of all your plants without loading any images. Used for matching ("the one with the variegated leaves") and for the running chronicle.

### Why NOT base64 in the database

Storing base64 directly in the database is tempting but creates problems:
- A single 640x480 JPEG at quality 0.7 is ~50-100KB as base64. 10 snapshots per plant, 20 plants = 10-20MB of text in the database.
- Supabase Storage is purpose-built for this -- it handles signed URLs, CDN, and doesn't bloat your database.
- The base64 is generated on-demand when the agent needs to actually look at the image (via signed URL fetch + base64 encode in the edge function).

The flow is: Store JPEG in Storage --> reference path in `plant_snapshots` --> fetch + encode to base64 only when the model needs to see it.

## Implementation Tiers

### Tier 1: Telegram Text Photo Snapshots

When you send a photo in Telegram and the agent identifies or diagnoses a plant:

1. The image is already being uploaded to `plant-photos` storage (existing code)
2. **New:** After identification, the agent calls a new `capture_plant_snapshot` tool that:
   - Stores the image path
   - Asks the vision model to generate a detailed text description
   - Links to the plant_id (if known) or creates a "pending match" record
   - Saves to `plant_snapshots`

3. **New:** The system prompt includes recent snapshot descriptions for each plant in the context, so the agent knows what each plant looks like

### Tier 2: Voice Call Capture

This is the harder part. During a voice call with video:

1. **New tool: `capture_plant_snapshot`** -- added to `voiceTools.ts`
   - The agent calls this during identify/diagnose/save workflows
   - It grabs the most recent video frame (already captured at 1fps by `useVideoCapture`)
   - Requires user confirmation before storing

2. **Confirmation flow (dual-mode):**
   - **Voice:** Agent says "Want me to save a snapshot of this?" User says "yes" -> agent calls the tool with `confirmed: true`
   - **UI button:** A "Capture" button appears on the call screen when video is active. Tapping it sends the current frame to the edge function via the existing tool-call mechanism

3. **Edge function handling:**
   - Receives the base64 frame from the client
   - Uploads to `plant-photos` storage
   - Generates text description via vision model
   - Saves `plant_snapshots` row

### Tier 3: Visual Chronicle in Context

The running visual history per plant:

1. **Context injection:** `buildPlantsContext()` in `context.ts` is updated to include the latest 3 snapshot descriptions per plant inline. This gives the agent ambient awareness of what each plant looks like without loading images.

2. **Deep comparison tool:** A new `compare_plant_snapshots` tool that:
   - Fetches the actual images (via signed URLs) for 2+ snapshots
   - Sends them to the vision model side-by-side
   - Returns a detailed comparison: "The leaf discoloration from Feb 3 has improved significantly. New growth is visible on the right side."

3. **Recognition flow:** When a new photo arrives, the agent:
   - Checks the text descriptions of known plants for a likely match
   - If uncertain, fetches the most recent snapshot image for candidate plants and does a visual comparison
   - Reports: "This looks like your Monstera 'Leafy' -- compared to last month, the fenestrations are developing nicely"

### Tier 4: Storage and Retention

You said keep all snapshots forever, so:
- No automatic pruning
- Context window management: only the latest 3 descriptions per plant go into the system prompt
- Full history is queryable via the `compare_plant_snapshots` tool when needed
- Storage costs are manageable: ~100KB per snapshot image, even 1000 snapshots = ~100MB

## Build Order

**Phase 1 -- Foundation (this session):**
1. Create `plant_snapshots` table with RLS
2. Add `capture_plant_snapshot` tool to `_shared/tools.ts`
3. Wire into `orchid-agent` identify/diagnose flows (auto-capture on text photos)
4. Update `buildPlantsContext()` to include latest snapshot descriptions
5. Fix the `1bit_PvP.tsx` RTF build error

**Phase 2 -- Voice Call Capture:**
1. Add `capture_plant_snapshot` to `voiceTools.ts`
2. Add UI capture button to the call screen
3. Wire the tool in `toolExecutor.ts` to handle base64 frame upload
4. Add voice confirmation guard

**Phase 3 -- Chronicle and Comparison:**
1. Add `compare_plant_snapshots` tool
2. Add recognition logic to orchid-agent's photo processing
3. Enhance system prompt with temporal snapshot awareness

## Technical Details

### New tool: `capture_plant_snapshot`

```text
Parameters:
  - plant_identifier: string (name/nickname/species to match)
  - description: string (AI-generated visual description)
  - context: string (why: "identification", "diagnosis", "routine_check", "user_requested")
  - health_notes: string (optional health observations)
  - image_base64: string (for voice call captures -- the frame data)
  - confirmed: boolean (required for voice call captures)
```

### Context injection example

Current `buildPlantsContext` output:
```
## SAVED PLANTS
- Leafy (Monstera deliciosa) - living room
- Spike (Aloe vera) - kitchen window
```

New output:
```
## SAVED PLANTS
- Leafy (Monstera deliciosa) - living room
  Visual: Large split-leaf plant ~2ft tall, deep green, 3 fenestrated leaves, healthy new growth on right side. Terracotta pot.
  Last seen: 3 days ago | 5 snapshots total
- Spike (Aloe vera) - kitchen window  
  Visual: Medium aloe, ~8 inches, pale green with slight browning on lower leaf tips. White ceramic pot.
  Last seen: 1 week ago | 2 snapshots total
```

### Database migration

```sql
CREATE TABLE plant_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  description TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'identification',
  source TEXT NOT NULL DEFAULT 'telegram_photo',
  health_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_plant_snapshots_plant_id ON plant_snapshots(plant_id);
CREATE INDEX idx_plant_snapshots_profile_id ON plant_snapshots(profile_id);

ALTER TABLE plant_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view their own snapshots
CREATE POLICY "Users can view their plant snapshots" ON plant_snapshots
  FOR SELECT USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Service role for edge function inserts
CREATE POLICY "Service role can manage snapshots" ON plant_snapshots
  FOR ALL USING (true) WITH CHECK (true);
```

## What This Enables

Once all three phases are done, the agent will be able to:
- "Show me what my monstera looked like a month ago" (fetches snapshot, describes it)
- Receive a photo and say "That's your Fern 'Fernie' -- the brown tips from last week look much better"
- During a video call: "I can see some new growth -- want me to capture this for your plant's timeline?"
- "Your aloe has had 3 snapshots over 2 months. It's grown about 2 inches and the browning has resolved since you moved it to the brighter window"

## Fixing the Build Error

The `src/Games/1bit_PvP.tsx` file is an RTF document (Rich Text Format) that was accidentally saved as `.tsx`. It needs to be either deleted or replaced with valid TypeScript/React code. Since it appears to be a game component, we'll replace it with a minimal placeholder.


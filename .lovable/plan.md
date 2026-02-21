

# Implement `recall_media` Tool + Fix Storage Paths

## Summary

Add a new tool that lets Orchid resurface stored images (plant snapshots and generated guides) for the current user, and fix the underlying storage path issue that would prevent guide recall from working.

---

## Change 1: Fix `callImageGenerationAgent` to store raw file paths

**File:** `supabase/functions/orchid-agent/index.ts` (lines 1600-1607)

Currently, the function returns only `{ step, description, imageUrl }` where `imageUrl` is a 1-hour signed URL. When this gets saved to `generated_content`, the URL expires and the image is unretrievable.

**Fix:** Also return the raw `storagePath` (the `fileName` variable from line 1575) in each step result:

```typescript
return {
  step,
  description: messageContent || `Step ${step}`,
  imageUrl: imageUrl,
  storagePath: fileName,  // raw path for future re-signing
};
```

This requires no schema changes -- the `content` column is JSONB, so the extra field is stored automatically.

---

## Change 2: Add `recall_media` tool declaration

**File:** `supabase/functions/orchid-agent/index.ts` -- insert before the closing `];` of `functionTools` (line 884)

```typescript
{
  type: "function",
  function: {
    name: "recall_media",
    description: "Retrieve previously stored images for this user. Use to show plant snapshot history, past visual guides, or any stored media. Useful when user asks to 'show me again', 'compare photos', 'show my plant history', or references past guides.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: ["plant_snapshots", "generated_guides"],
          description: "Where to look: plant_snapshots for plant photos, generated_guides for previously created visual guides",
        },
        plant_identifier: {
          type: "string",
          description: "Plant name/nickname (required for plant_snapshots, optional for guides)",
        },
        limit: {
          type: "number",
          description: "Max images to return (default 3, max 5)",
        },
      },
      required: ["source"],
    },
  },
},
```

---

## Change 3: Add `recall_media` execution logic

**File:** `supabase/functions/orchid-agent/index.ts` -- in the tool execution `if/else` chain (after `compare_plant_snapshots`, before `generate_image`)

Security note: All queries filter by `profileId` which is resolved from the authenticated user's session or Telegram identity at the top of the handler. The service role key bypasses RLS, but the explicit `profileId` filter ensures user isolation at the application level -- matching the exact same pattern used by every other tool (`savePlant`, `capturePlantSnapshot`, etc.).

```typescript
else if (functionName === "recall_media") {
  const source = args.source;
  const limit = Math.min(args.limit || 3, 5);

  if (source === "plant_snapshots") {
    if (!args.plant_identifier) {
      toolResult = { success: false, error: "Need a plant name to look up snapshots" };
    } else {
      const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
      if (resolution.plants.length === 0) {
        toolResult = { success: false, error: `No plant found matching "${args.plant_identifier}"` };
      } else {
        const plant = resolution.plants[0];
        const { data: snapshots } = await supabase
          .from("plant_snapshots")
          .select("image_path, description, created_at, context")
          .eq("plant_id", plant.id)
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(limit);

        const images = [];
        for (const snap of (snapshots || [])) {
          if (snap.image_path) {
            const { data: signed } = await supabase.storage
              .from("plant-photos")
              .createSignedUrl(snap.image_path, 3600);
            if (signed?.signedUrl) {
              const date = new Date(snap.created_at).toLocaleDateString();
              const caption = `${date}: ${snap.description || snap.context}`;
              images.push({ url: signed.signedUrl, caption });
              mediaToSend.push({ url: signed.signedUrl, caption });
            }
          }
        }
        toolResult = {
          success: true,
          retrieved: images.length,
          plantName: plant.nickname || plant.species || plant.name
        };
      }
    }
  } else if (source === "generated_guides") {
    const { data: guides } = await supabase
      .from("generated_content")
      .select("content, task_description, created_at")
      .eq("profile_id", profileId)
      .eq("content_type", "image_guide")
      .order("created_at", { ascending: false })
      .limit(1);

    const images = [];
    for (const guide of (guides || [])) {
      const steps = guide.content?.steps || [];
      for (const step of steps.slice(0, limit)) {
        const path = step.storagePath;
        if (path) {
          const { data: signed } = await supabase.storage
            .from("generated-guides")
            .createSignedUrl(path, 3600);
          if (signed?.signedUrl) {
            const caption = step.description || `Step ${step.step}`;
            images.push({ url: signed.signedUrl, caption });
            mediaToSend.push({ url: signed.signedUrl, caption });
          }
        }
      }
    }
    toolResult = {
      success: true,
      retrieved: images.length,
      task: guides?.[0]?.task_description || "unknown"
    };
  } else {
    toolResult = { success: false, error: "Invalid source. Use 'plant_snapshots' or 'generated_guides'" };
  }
}
```

---

## Change 4: Clean up dead imports in PwaChat

**File:** `src/components/pwa/PwaChat.tsx` (lines 8-12)

Remove unused artifact component imports:
- `IdentificationCard`
- `DiagnosisCard`
- `CareGuideCard`
- `StoreListCard`
- `VisualGuideCard`

Simplify `renderArtifact` to only handle the `'chat'` path since the PWA never receives structured artifact types from `orchid-agent`.

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/orchid-agent/index.ts` | (1) Add `storagePath` to guide step results. (2) Add `recall_media` tool declaration. (3) Add execution logic. |
| `src/components/pwa/PwaChat.tsx` | Remove 5 unused imports, simplify `renderArtifact`. |

## Note on generated guides created before this fix

Guides generated before the `storagePath` fix will not have the field stored, so `recall_media` will skip those steps gracefully (the `if (path)` check handles it). Only newly generated guides will be fully recallable.

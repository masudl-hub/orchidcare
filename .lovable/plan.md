
## Fix: Images Not Appearing in PWA Chat

### Root Cause

There are **two** image generation tools in orchid-agent, and one of them silently drops its output:

1. **`generate_visual_guide`** (line 2992): Generates multi-step instructional images. After generation, it correctly pushes each image into `mediaToSend` (lines 3014-3017). This path works.

2. **`generate_image`** (line 3490): Generates a single image (e.g., "show me what you mean"). It gets an `imageUrl` back from the API and stores it in `toolResult` -- but **never adds it to `mediaToSend`**. The URL sits in the tool result, gets passed back to the LLM as context (so the LLM *thinks* it sent images), but the actual image URL is never included in the response to the client.

This is why Orchid says "I've generated a visual comparison" with no visuals -- the LLM sees the tool succeeded and references the images in its text, but the URLs are dropped before they reach the frontend.

### Fix

**File: `supabase/functions/orchid-agent/index.ts`** (lines 3490-3508)

After the `generate_image` tool gets a successful `imageUrl`, push it to `mediaToSend`:

```typescript
else if (functionName === "generate_image") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
  if (!LOVABLE_API_KEY) {
    toolResult = { success: false, error: "Image generation not configured" };
  } else {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "dall-e-3", prompt: args.prompt, n: 1, size: "1024x1024" }),
      });
      const data = await response.json();
      const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
      toolResult = imageUrl
        ? { success: true, imageUrl }
        : { success: false, error: "No image generated" };

      // ADD: Push generated image to mediaToSend so it reaches the client
      if (imageUrl) {
        mediaToSend.push({ url: imageUrl, caption: args.prompt || "" });
      }
    } catch (err) {
      toolResult = { success: false, error: String(err) };
    }
  }
}
```

That is the only change needed. The downstream pipeline (`orchid-agent` returns `mediaToSend` in its JSON response, `pwa-agent` includes it in the NDJSON "done" event, `PwaChat` renders images from `mediaToSend`) is already wired up from the previous fix.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/orchid-agent/index.ts` | Add `mediaToSend.push(...)` after successful `generate_image` |

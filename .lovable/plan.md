

# Fix Guide Timeout + Retry + Botanical Pixels Aesthetic

## Overview

Three changes across two files: fix the guide generation timeout with fire-and-forget Telegram delivery, add retry logic for flaky image generation, and update the image style to "Botanical Pixels" -- illustrated plants on white backgrounds with Press Start 2P / monospace typography and grid layouts.

## Changes

### File: `supabase/functions/orchid-agent/index.ts`

#### A. Add `sendPhotoToTelegram` helper

New function that POSTs a photo (from a signed URL or base64 upload) to the Telegram Bot API `sendPhoto` endpoint. Used to deliver images directly to the user's chat without routing back through telegram-bot.

#### B. Thread `telegramChatId` + `TELEGRAM_BOT_TOKEN` into `callImageGenerationAgent`

Accept optional `telegramChatId` and `telegramBotToken` parameters. When both are present (Telegram-originated request), each image is sent directly to Telegram as soon as it's generated and uploaded, rather than accumulating in `mediaToSend`.

#### C. Fire-and-forget for Telegram guide requests

At the call site (~line 2938), when `channel === "telegram"` and we have a `telegramChatId` from the request payload:
- Pass them to `callImageGenerationAgent`
- The function sends images directly to Telegram as each one completes
- Returns `images: []` so `mediaToSend` stays empty (images already delivered)
- The text reply goes back normally through the response chain

#### D. Retry logic in `generateStep`

Wrap the image generation fetch in a loop: max 2 attempts, 2-second backoff between them. On both failing, return null (same as today's single-failure behavior). Since steps run in parallel, this adds at most 2s to a single failing step.

```text
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    const response = await fetch(/* image gen */);
    if (response.ok) { /* process and return */ }
  } catch (err) { /* log */ }
  if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
}
return null;
```

#### E. Update image style prompts -- "Botanical Pixels"

Replace ALL style directives in `buildDetailedStepPrompt` and the `stepPrompt` template. The current "watercolor botanical, warm cream background" becomes:

```text
VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations -- NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- Think illustrated botanical field guide meets retro game UI -- beautiful plant drawings with pixel-font headers
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible -- avoid placing text over busy illustration areas
```

This applies to:
- Propagation steps (lines ~1177, 1190, 1204, 1217)
- Repotting steps (lines ~1238, 1250, 1263)
- Generic steps (lines ~1283, 1295, 1307)
- The main `stepPrompt` template (lines ~1323-1328)

### File: `supabase/functions/telegram-bot/index.ts`

#### F. Pass `telegramChatId` in `callAgent` payload

Add the user's Telegram chat ID to the payload sent to orchid-agent:

```text
payload.telegramChatId = String(chatId);
```

This requires threading `chatId` into `callAgent` as a new optional parameter, and passing it from all call sites (~lines 635, 710, 769, 816, 860, 911).

#### G. Increase timeout from 55s to 150s

Change line 219: `setTimeout(() => controller.abort(), 150000)` and update the error message on line 277-278 to reflect the new limit.

Even with fire-and-forget for guides, multi-tool flows (research + shopping) can exceed 55s. The user sees typing indicators throughout so a longer timeout has no UX cost.

## Architecture Flow (Telegram Guide)

```text
User: "how do I propagate my pothos?"
  -> telegram-bot passes telegramChatId in payload, 150s timeout
     -> orchid-agent generates 3 images in parallel
     -> Image 1 done -> upload to storage -> sendPhoto to Telegram
     -> Image 2 done -> upload to storage -> sendPhoto to Telegram  
     -> Image 3 done -> upload to storage -> sendPhoto to Telegram
     -> Returns text reply: "Here's your propagation guide!"
  <- telegram-bot sends text reply (no media -- already delivered)
```

## Summary

| Change | Detail |
|--------|--------|
| `sendPhotoToTelegram` helper | New function in orchid-agent |
| Thread `telegramChatId` | From telegram-bot payload through to `callImageGenerationAgent` |
| Fire-and-forget delivery | Images sent to Telegram as each generates; text reply returns immediately |
| Retry logic | 1 retry per step, 2s backoff |
| Image style | White background, illustrated plants, Press Start 2P headers, monospace labels, grid layout |
| Timeout | 55s to 150s in telegram-bot |

## Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/orchid-agent/index.ts` | (1) `sendPhotoToTelegram` helper. (2) Accept `telegramChatId`/`telegramBotToken` in request and thread to image gen. (3) Fire-and-forget Telegram delivery in `generateStep`. (4) Retry loop. (5) Botanical Pixels style in all step prompts. |
| `supabase/functions/telegram-bot/index.ts` | (1) Thread `chatId` into `callAgent` and pass as `telegramChatId` in payload. (2) Timeout 55s to 150s. |


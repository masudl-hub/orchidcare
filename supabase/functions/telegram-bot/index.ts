import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Bot } from "https://deno.land/x/grammy@v1.21.1/mod.ts";

// ============================================================================
// TELEGRAM BOT - Adapter between Telegram Bot API and orchid-agent
// Uses grammY for webhook handling, delegates all agent logic to orchid-agent
// ============================================================================

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const bot = new Bot(TELEGRAM_BOT_TOKEN);

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

bot.catch((err) => {
  const ctx = err.ctx;
  const errStr = err.error instanceof Error ? `${err.error.name}: ${err.error.message}` : String(err.error);
  const chatId = ctx.chat?.id || "unknown";
  console.error(`[TelegramBot] UNHANDLED ERROR — updateId=${ctx.update.update_id}, chatId=${chatId}, error=${errStr}`);
  if (err.error instanceof Error && err.error.stack) {
    console.error(`[TelegramBot] Error stack: ${err.error.stack.substring(0, 500)}`);
  }
  try {
    ctx.reply("Something went wrong on my end. Please try again in a moment.").catch(() => {});
  } catch (_) { /* ctx.reply may also fail */ }
});

// ============================================================================
// GROUP CHAT GUARD - only respond in private chats
// ============================================================================

bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== "private") return;
  await next();
});

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

async function getOrCreateProfile(chatId: number, username?: string): Promise<any> {
  const start = Date.now();
  console.log(`[TelegramBot] getOrCreateProfile: chatId=${chatId}, username=${username || "none"}`);

  // Look up existing profile by telegram_chat_id
  const { data: existing, error: lookupError } = await supabase.from("profiles").select("*").eq("telegram_chat_id", chatId).single();

  if (existing) {
    console.log(`[TelegramBot] getOrCreateProfile: FOUND existing profile_id=${existing.id}, user_id=${existing.user_id || "none"}, display_name="${existing.display_name || "none"}" (${Date.now() - start}ms)`);
    // Ensure auth user exists (backfill for profiles created before this logic)
    if (!existing.user_id) {
      console.log(`[TelegramBot] getOrCreateProfile: backfilling auth user for profile ${existing.id}`);
      const userId = await ensureAuthUser(existing.id, chatId);
      if (userId) existing.user_id = userId;
    }
    return existing;
  }

  if (lookupError && lookupError.code !== "PGRST116") {
    console.error(`[TelegramBot] getOrCreateProfile: lookup error (not just "no rows"):`, lookupError.message, lookupError.code);
  }

  // Create new profile for this Telegram user
  console.log(`[TelegramBot] getOrCreateProfile: no existing profile, creating new one for chatId=${chatId}`);
  const { data: newProfile, error } = await supabase
    .from("profiles")
    .insert({
      telegram_chat_id: chatId,
      telegram_username: username || null,
      personality: "warm",
    })
    .select()
    .single();

  if (error) {
    // Race condition: another request may have created the profile concurrently.
    // Re-fetch instead of failing.
    console.warn(`[TelegramBot] getOrCreateProfile: insert failed (${error.code}: ${error.message}), re-fetching...`);
    const { data: reFetched } = await supabase.from("profiles").select("*").eq("telegram_chat_id", chatId).single();
    if (reFetched) {
      console.log(`[TelegramBot] getOrCreateProfile: re-fetch succeeded, profile_id=${reFetched.id} (${Date.now() - start}ms)`);
      if (!reFetched.user_id) {
        const userId = await ensureAuthUser(reFetched.id, chatId);
        if (userId) reFetched.user_id = userId;
      }
      return reFetched;
    }
    console.error(`[TelegramBot] getOrCreateProfile: FAILED — insert error + re-fetch also failed (${Date.now() - start}ms)`);
    return null;
  }

  // Auto-create an auth user so this profile has full access from day 1
  await ensureAuthUser(newProfile.id, chatId);

  console.log(`[TelegramBot] getOrCreateProfile: CREATED new profile_id=${newProfile.id} + auth user for chatId=${chatId} (${Date.now() - start}ms)`);
  return newProfile;
}

async function ensureAuthUser(profileId: string, chatId: number): Promise<string | null> {
  const syntheticEmail = `tg_${chatId}@orchid.bot`;

  // Try to create auth user — if already exists, Supabase returns an error we can handle
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: syntheticEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
  });

  let userId: string | null = null;

  if (authError) {
    // User already exists — look up via generateLink which returns user info
    if (authError.message?.includes("already been registered")) {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: syntheticEmail,
      });
      if (linkData?.user?.id) {
        userId = linkData.user.id;
      } else {
        console.error("[TelegramBot] Auth user exists but can't resolve user_id for:", syntheticEmail);
        return null;
      }
    } else {
      console.error("[TelegramBot] Error creating auth user:", authError);
      return null;
    }
  } else {
    userId = authData.user.id;
  }

  // Link the profile to the auth user
  const { error: updateError } = await supabase.from("profiles").update({ user_id: userId }).eq("id", profileId);

  if (updateError) {
    console.error("[TelegramBot] Error linking profile to auth user:", updateError);
  }

  return userId;
}

// ============================================================================
// IMAGE HANDLING
// ============================================================================

async function downloadTelegramPhoto(fileId: string): Promise<{ base64: string; mimeType: string } | null> {
  const start = Date.now();
  console.log(`[TelegramBot] downloadFile: START — fileId=${fileId}`);
  try {
    // Get file path from Telegram
    const fileInfo = await bot.api.getFile(fileId);
    const filePath = fileInfo.file_path;
    if (!filePath) {
      console.error(`[TelegramBot] downloadFile: FAILED — no file_path returned (${Date.now() - start}ms)`);
      return null;
    }
    console.log(`[TelegramBot] downloadFile: got path="${filePath}", fileSize=${fileInfo.file_size || "unknown"} (${Date.now() - start}ms)`);

    // Download the file
    const fileUrl = `https://api.telegram.org/file/bot${"*".repeat(10)}/${filePath}`;
    const dlStart = Date.now();
    const response = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`);
    if (!response.ok) {
      console.error(`[TelegramBot] downloadFile: HTTP FAILED — status=${response.status} (${Date.now() - dlStart}ms)`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log(`[TelegramBot] downloadFile: downloaded ${Math.round(uint8Array.length / 1024)}KB (${Date.now() - dlStart}ms)`);

    // Convert to base64 using Deno std (safe for large buffers)
    const base64 = base64Encode(uint8Array);
    const mimeType = filePath.endsWith(".png") ? "image/png" : "image/jpeg";

    console.log(`[TelegramBot] downloadFile: COMPLETE — ${Math.round(base64.length / 1024)}KB base64, mime=${mimeType}, total=${Date.now() - start}ms`);
    return { base64, mimeType };
  } catch (error) {
    const errStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[TelegramBot] downloadFile: ERROR — ${errStr} (${Date.now() - start}ms)`);
    return null;
  }
}

// ============================================================================
// AGENT COMMUNICATION
// ============================================================================

async function callAgent(
  profileId: string,
  message: string,
  channel: string = "telegram",
  mediaBase64?: string,
  mediaMimeType?: string,
  telegramChatId?: number,
): Promise<{ reply: string; mediaToSend: Array<{ url: string; caption?: string }> }> {
  const orchidAgentUrl = `${SUPABASE_URL}/functions/v1/orchid-agent`;

  const payload: any = {
    profileId,
    message,
    channel,
  };

  if (mediaBase64 && mediaMimeType) {
    payload.mediaBase64 = mediaBase64;
    payload.mediaMimeType = mediaMimeType;
  }

  if (telegramChatId) {
    payload.telegramChatId = String(telegramChatId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);

  const startTime = Date.now();
  const msgPreview = message.length > 100 ? message.substring(0, 100) + "..." : message;
  console.log(`[TelegramBot] callAgent: START — profile=${profileId.substring(0, 8)}..., channel=${channel}, msg="${msgPreview}", hasMedia=${!!mediaBase64}, mediaMime=${mediaMimeType || "none"}, mediaSize=${mediaBase64 ? Math.round(mediaBase64.length / 1024) + "KB" : "0"}`);

  try {
    const response = await fetch(orchidAgentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "X-Internal-Agent-Call": "true",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TelegramBot] callAgent: FAILED — status=${response.status}, elapsed=${elapsed}ms, body=${errorText.substring(0, 500)}`);

      // Surface specific errors to the user
      if (response.status === 404) {
        return { reply: "Something went wrong with your profile. Try /start to reset.", mediaToSend: [] };
      }
      if (response.status === 429) {
        return { reply: "I'm getting a lot of messages right now. Give me a moment and try again.", mediaToSend: [] };
      }

      // Try to extract error message from response body
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          console.error(`[TelegramBot] callAgent: error detail: ${JSON.stringify(errorData.error).substring(0, 300)}`);
        }
      } catch {
        // Response wasn't JSON, already logged the raw text above
      }

      return { reply: "I'm having trouble right now. Please try again in a moment!", mediaToSend: [] };
    }

    const data = await response.json();
    const replyLength = data.reply?.length || 0;
    const mediaCount = data.mediaToSend?.length || 0;
    const replyPreview = (data.reply || "").substring(0, 150);
    console.log(`[TelegramBot] callAgent: SUCCESS — status=${response.status}, elapsed=${elapsed}ms, reply=${replyLength} chars, media=${mediaCount} items, preview="${replyPreview}..."`);

    return {
      reply: data.reply || "I processed your message but have nothing to say!",
      mediaToSend: data.mediaToSend || [],
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error(`[TelegramBot] callAgent: TIMEOUT — aborted after ${elapsed}ms (limit=150s)`);
      return { reply: "I'm taking longer than usual. Please try again.", mediaToSend: [] };
    }
    const errStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[TelegramBot] callAgent: ERROR — ${errStr} (${elapsed}ms)`);
    return { reply: "Something went wrong. Please try again!", mediaToSend: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// MESSAGE SPLITTING (Telegram 4096 char limit)
// ============================================================================

function splitMessage(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    const searchArea = remaining.substring(0, maxLength);
    let splitPoint = searchArea.lastIndexOf("\n\n");

    // Try sentence boundary
    if (splitPoint < maxLength * 0.3) {
      splitPoint = Math.max(searchArea.lastIndexOf(". "), searchArea.lastIndexOf("! "), searchArea.lastIndexOf("? "));
    }

    // Fallback to hard split
    if (splitPoint < maxLength * 0.3) {
      splitPoint = maxLength;
    }

    chunks.push(remaining.substring(0, splitPoint + 1).trim());
    remaining = remaining.substring(splitPoint + 1).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

// ============================================================================
// DATA MIGRATION (for profile merges)
// ============================================================================

// Tables with profile_id foreign key (all ON DELETE CASCADE)
const PROFILE_DATA_TABLES = [
  "plants",
  "conversations",
  "reminders",
  "generated_content",
  "user_insights",
  "conversation_summaries",
  "agent_permissions",
  "proactive_preferences",
  "proactive_messages",
];

async function migrateProfileData(fromProfileId: string, toProfileId: string): Promise<void> {
  for (const table of PROFILE_DATA_TABLES) {
    const { error } = await supabase.from(table).update({ profile_id: toProfileId }).eq("profile_id", fromProfileId);

    if (error) {
      // Some tables may have unique constraints that prevent migration — log and continue
      console.warn(`[TelegramBot] Could not migrate ${table}: ${error.message}`);
    }
  }
}

// ============================================================================
// LINKING CODE DETECTION
// ============================================================================

async function tryLinkAccount(
  chatId: number,
  username: string | undefined,
  code: string,
  telegramProfileId: string,
): Promise<string | null> {
  // Atomically claim the linking code (SELECT + UPDATE in one query to prevent race conditions)
  const { data: linkData } = await supabase
    .from("linking_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select()
    .single();

  if (!linkData || !linkData.user_id) return null;

  // Find the web profile that owns this linking code
  const { data: webProfile } = await supabase.from("profiles").select("*").eq("user_id", linkData.user_id).single();

  if (!webProfile) {
    console.error("[TelegramBot] No web profile found for user_id:", linkData.user_id);
    return null;
  }

  // Merge: add Telegram details to the WEB profile (web profile is the keeper)
  const { error: mergeError } = await supabase
    .from("profiles")
    .update({
      telegram_chat_id: chatId,
      telegram_username: username || null,
    })
    .eq("id", webProfile.id);

  if (mergeError) {
    console.error("[TelegramBot] Error merging Telegram into web profile:", mergeError);
    return null;
  }

  // If the Telegram-only profile is separate from the web profile, migrate data then clean up
  if (telegramProfileId !== webProfile.id) {
    // Migrate all data (plants, conversations, etc.) from Telegram profile to web profile
    await migrateProfileData(telegramProfileId, webProfile.id);

    // Get the Telegram-only profile to find its synthetic auth user
    const { data: tgProfile } = await supabase.from("profiles").select("user_id").eq("id", telegramProfileId).single();

    // Delete the synthetic auth user if it exists
    if (tgProfile?.user_id) {
      await supabase.auth.admin.deleteUser(tgProfile.user_id);
    }

    // Delete the now-empty orphaned Telegram-only profile
    await supabase.from("profiles").delete().eq("id", telegramProfileId);
  }

  // Code was already atomically marked as used in the UPDATE query above

  return "Your accounts are linked! Your web dashboard and Telegram are now connected. Send me a plant photo or ask anything.";
}

// ============================================================================
// TYPING INDICATOR — keeps "typing..." visible during long agent calls
// ============================================================================

function startTypingIndicator(chatId: number): () => void {
  console.log(`[TelegramBot] Typing indicator started - chatId: ${chatId}`);
  const interval = setInterval(async () => {
    try { await bot.api.sendChatAction(chatId, "typing"); } catch { /* ignore */ }
  }, 4000);
  return () => clearInterval(interval);
}

// ============================================================================
// BOT COMMAND HANDLERS
// ============================================================================

bot.command("start", async (ctx) => {
  const chatId = ctx.chat.id;
  const username = ctx.from?.username;
  const payload = ctx.match?.trim(); // deep link payload after /start

  console.log(`[TelegramBot] /start: chatId=${chatId}, username=${username || "none"}, payload="${payload || "none"}", from=${JSON.stringify({ id: ctx.from?.id, first_name: ctx.from?.first_name, language_code: ctx.from?.language_code })}`);
  await ctx.api.sendChatAction(chatId, "typing");

  // If deep link payload is a linking code, handle account linking FIRST
  if (payload && /^\d{6}$/.test(payload)) {
    const tgProfile = await getOrCreateProfile(chatId, username);
    if (tgProfile) {
      const linkResult = await tryLinkAccount(chatId, username, payload, tgProfile.id);
      if (linkResult) {
        await ctx.reply(linkResult);
        return;
      }
    }
    // If code didn't match or expired, fall through to normal welcome
  }

  const profile = await getOrCreateProfile(chatId, username);
  if (!profile) {
    await ctx.reply("Sorry, I couldn't set up your profile. Please try again later.");
    return;
  }

  await ctx.reply(
    "Hi there! I'm Orchid, your plant care companion.\n\n" +
      "Send me a photo of any plant and I'll identify it, diagnose problems, and help you keep it thriving.\n\n" +
      "You can also just ask me anything about plants!\n\n" +
      "Commands:\n" +
      "/help - See what I can do\n" +
      "/call - Start a live voice call with Orchid\n" +
      "/myplants - View your saved plants\n" +
      "/web - Access your web dashboard",
  );
});

bot.command("help", async (ctx) => {
  console.log(`[TelegramBot] /help: chatId=${ctx.chat.id}, username=${ctx.from?.username || "none"}`);
  await ctx.reply(
    "Here's what I can help with:\n\n" +
      "- Send a photo to identify a plant or diagnose issues\n" +
      "- Ask about watering, light, soil, or any care topic\n" +
      '- Say "save [name]" to save a plant to your collection\n' +
      "- Ask me to set reminders for watering, fertilizing, etc.\n" +
      "- Request research on specific plant topics\n" +
      "- Find local nurseries and garden stores\n\n" +
      "- Say /call to start a live voice conversation\n\n" +
      "Commands:\n" +
      "/call - Start a live voice call\n" +
      "/myplants - View your saved plants\n" +
      "/web - Access your web dashboard\n" +
      "/help - Show this message",
  );
});

bot.command("web", async (ctx) => {
  const chatId = ctx.chat.id;
  console.log(`[TelegramBot] /web: chatId=${chatId}, username=${ctx.from?.username || "none"}`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    await ctx.reply("Couldn't load your profile. Please try /start first.");
    return;
  }

  if (!profile.user_id) {
    await ctx.reply("Something went wrong setting up your account. Please try /start again.");
    return;
  }

  // Get the auth user's email to generate magic link
  const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);
  if (userError || !authUser?.user?.email) {
    console.error("[TelegramBot] Error fetching auth user:", userError);
    await ctx.reply("Couldn't generate your dashboard link. Please try again.");
    return;
  }

  // Generate magic link for instant web login
  const { data: magicLinkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
    options: {
      redirectTo: "https://orchid.masudlewis.com/dashboard",
    },
  });

  if (linkError || !magicLinkData?.properties?.action_link) {
    console.error("[TelegramBot] Error generating magic link:", linkError);
    await ctx.reply("Couldn't generate your dashboard link. Please try again.");
    return;
  }

  await ctx.reply(
    "Here's your web dashboard link (valid for 1 hour):\n\n" +
      magicLinkData.properties.action_link +
      "\n\n" +
      "Click to sign in instantly — no password needed.",
  );
});

bot.command("call", async (ctx) => {
  const chatId = ctx.chat.id;
  const start = Date.now();
  console.log(`[TelegramBot] /call: chatId=${chatId}, username=${ctx.from?.username || "none"}`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    console.error(`[TelegramBot] /call: profile resolution FAILED for chatId=${chatId}`);
    await ctx.reply("Couldn't load your profile. Try /start first.");
    return;
  }

  console.log(`[TelegramBot] /call: sending Mini App button — profile=${profile.id}, url=https://orchid.masudlewis.com/call (${Date.now() - start}ms)`);
  await ctx.reply("Starting a live call with Orchid...", {
    reply_markup: {
      inline_keyboard: [[{
        text: "\u{1F399} Join Call",
        web_app: { url: "https://orchid.masudlewis.com/call" }
      }]]
    }
  });
  console.log(`[TelegramBot] /call: reply sent (${Date.now() - start}ms)`);
});

bot.command("myplants", async (ctx) => {
  const chatId = ctx.chat.id;
  console.log(`[TelegramBot] /myplants: chatId=${chatId}, username=${ctx.from?.username || "none"}`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    await ctx.reply("Couldn't load your profile. Please try /start first.");
    return;
  }

  const { data: plants } = await supabase
    .from("plants")
    .select("name, nickname, species, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (!plants || plants.length === 0) {
    await ctx.reply(
      "You haven't saved any plants yet! Send me a photo of a plant and I can identify it, then ask me to save it.",
    );
    return;
  }

  let message = `Your plants (${plants.length}):\n\n`;
  for (const plant of plants) {
    const displayName = plant.nickname || plant.name || plant.species || "Unknown";
    const species = plant.species ? ` (${plant.species})` : "";
    message += `- ${displayName}${species}\n`;
  }

  await ctx.reply(message);
});

// ============================================================================
// MESSAGE HANDLER (text + photos)
// ============================================================================

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  const handlerStart = Date.now();
  const textPreview = text.length > 80 ? text.substring(0, 80) + "..." : text;

  console.log(`[TelegramBot] message:text: chatId=${chatId}, username=${ctx.from?.username || "none"}, length=${text.length}, text="${textPreview}"`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    console.error(`[TelegramBot] message:text: profile resolution FAILED for chatId=${chatId}`);
    await ctx.reply("I couldn't set up your profile. Please try /start first.");
    return;
  }

  // Check for 6-digit linking code
  if (/^\d{6}$/.test(text.trim())) {
    console.log(`[TelegramBot] message:text: detected 6-digit code, attempting link...`);
    const linkResult = await tryLinkAccount(chatId, ctx.from?.username, text.trim(), profile.id);
    if (linkResult) {
      console.log(`[TelegramBot] message:text: link SUCCESS (${Date.now() - handlerStart}ms)`);
      await ctx.reply(linkResult);
      return;
    }
    console.log(`[TelegramBot] message:text: link code not valid, falling through to agent`);
    // If code didn't match, fall through to agent (user might be talking about numbers)
  }

  // Call the agent with continuous typing indicator
  const stopTyping = startTypingIndicator(chatId);
  try {
    const { reply, mediaToSend } = await callAgent(profile.id, text, "telegram", undefined, undefined, chatId);

    // Send text reply (split if needed)
    const chunks = splitMessage(reply);
    console.log(`[TelegramBot] message:text: sending reply — ${chunks.length} chunks, ${reply.length} total chars`);
    for (let i = 0; i < chunks.length; i++) {
      await ctx.reply(chunks[i]);
      console.log(`[TelegramBot] message:text: chunk ${i + 1}/${chunks.length} sent (${chunks[i].length} chars)`);
    }

    // Send any generated media
    if (mediaToSend.length > 0) {
      console.log(`[TelegramBot] message:text: sending ${mediaToSend.length} media items`);
    }
    for (const media of mediaToSend) {
      try {
        await ctx.replyWithPhoto(media.url, { caption: media.caption || undefined });
        console.log(`[TelegramBot] message:text: media sent — url=${media.url.substring(0, 80)}...`);
      } catch (mediaErr) {
        const errStr = mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
        console.error(`[TelegramBot] message:text: media send FAILED — url=${media.url.substring(0, 80)}, error=${errStr}`);
      }
    }

    // NL call initiation — if user asked for a call, send Mini App button
    const CALL_INTENT = /\b(call\s*me|give\s*me\s*a\s*call|start\s*a\s*call|voice\s*call|video\s*call|let'?s\s*talk|can\s*(we|i)\s*talk|talk\s*to\s*(you|orchid)|speak\s*with|live\s*call|want\s*to\s*call|can\s*you\s*call)\b/i;
    if (CALL_INTENT.test(text)) {
      console.log(`[TelegramBot] message:text: call intent detected — appending Mini App button`);
      await ctx.reply("Tap to start a live call:", {
        reply_markup: {
          inline_keyboard: [[{
            text: "\u{1F399} Join Call",
            web_app: { url: "https://orchid.masudlewis.com/call" }
          }]]
        }
      });
    }

    console.log(`[TelegramBot] message:text: COMPLETE — chatId=${chatId}, total=${Date.now() - handlerStart}ms`);
  } finally {
    stopTyping();
  }
});

bot.on("message:photo", async (ctx) => {
  const chatId = ctx.chat.id;
  const caption = ctx.message.caption || "";
  const handlerStart = Date.now();

  const photos = ctx.message.photo;
  const largestPhoto = photos[photos.length - 1];
  console.log(`[TelegramBot] message:photo: chatId=${chatId}, username=${ctx.from?.username || "none"}, caption="${caption.substring(0, 80)}", photoSizes=${photos.length}, largest=${largestPhoto.width}x${largestPhoto.height}, fileSize=${largestPhoto.file_size || "unknown"}`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    console.error(`[TelegramBot] message:photo: profile resolution FAILED for chatId=${chatId}`);
    await ctx.reply("I couldn't set up your profile. Please try /start first.");
    return;
  }

  // Download and resize the photo
  const dlStart = Date.now();
  const photoData = await downloadTelegramPhoto(largestPhoto.file_id);
  if (!photoData) {
    console.error(`[TelegramBot] message:photo: download FAILED for file_id=${largestPhoto.file_id} (${Date.now() - dlStart}ms)`);
    await ctx.reply("I had trouble processing your photo. Could you try sending it again?");
    return;
  }
  console.log(`[TelegramBot] message:photo: downloaded — ${Math.round(photoData.base64.length / 1024)}KB base64, mime=${photoData.mimeType} (${Date.now() - dlStart}ms)`);

  // Call agent with the photo
  const message = caption || "What can you tell me about this plant?";
  const stopTyping = startTypingIndicator(chatId);
  try {
    const { reply, mediaToSend } = await callAgent(profile.id, message, "telegram", photoData.base64, photoData.mimeType, chatId);

    const chunks = splitMessage(reply);
    console.log(`[TelegramBot] message:photo: sending reply — ${chunks.length} chunks, ${reply.length} total chars`);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    if (mediaToSend.length > 0) {
      console.log(`[TelegramBot] message:photo: sending ${mediaToSend.length} media items`);
    }
    for (const media of mediaToSend) {
      try {
        await ctx.replyWithPhoto(media.url, { caption: media.caption || undefined });
      } catch (mediaErr) {
        const errStr = mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
        console.error(`[TelegramBot] message:photo: media send FAILED — ${errStr}`);
      }
    }

    console.log(`[TelegramBot] message:photo: COMPLETE — chatId=${chatId}, total=${Date.now() - handlerStart}ms`);
  } finally {
    stopTyping();
  }
});

// ============================================================================
// VIDEO HANDLER
// ============================================================================

bot.on("message:video", async (ctx) => {
  const chatId = ctx.chat.id;
  const caption = ctx.message.caption || "";
  const video = ctx.message.video;

  console.log(`[TelegramBot] message:video: chatId=${chatId}, username=${ctx.from?.username || "none"}, duration=${video.duration}s, size=${video.file_size || "unknown"}, mime=${video.mime_type || "unknown"}, caption="${caption.substring(0, 60)}"`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    await ctx.reply("I couldn't set up your profile. Please try /start first.");
    return;
  }

  // Telegram Bot API limits file downloads to 20MB
  if (video.file_size && video.file_size > 20 * 1024 * 1024) {
    await ctx.reply("That video is too large for me to process. Could you send a shorter clip (under 20MB)?");
    return;
  }

  const videoData = await downloadTelegramPhoto(video.file_id);
  if (!videoData) {
    await ctx.reply("I had trouble processing your video. Could you try sending it again?");
    return;
  }

  const message = caption || "Here's a video of my plant.";
  const stopTyping = startTypingIndicator(chatId);
  try {
    const { reply, mediaToSend } = await callAgent(profile.id, message, "telegram", videoData.base64, "video/mp4", chatId);

    const chunks = splitMessage(reply);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    if (mediaToSend.length > 0) {
      console.log(`[TelegramBot] Sending media - chatId: ${chatId}, count: ${mediaToSend.length}`);
    }
    for (const media of mediaToSend) {
      try {
        await ctx.replyWithPhoto(media.url, { caption: media.caption || undefined });
      } catch (mediaErr) {
        console.error("[TelegramBot] Error sending media:", mediaErr);
      }
    }
  } finally {
    stopTyping();
  }
});

// ============================================================================
// VOICE / AUDIO HANDLER
// ============================================================================

bot.on("message:voice", async (ctx) => {
  const chatId = ctx.chat.id;
  const voice = ctx.message.voice;

  console.log(`[TelegramBot] message:voice: chatId=${chatId}, username=${ctx.from?.username || "none"}, duration=${voice.duration}s, size=${voice.file_size || "unknown"}`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    await ctx.reply("I couldn't set up your profile. Please try /start first.");
    return;
  }

  const voiceData = await downloadTelegramPhoto(voice.file_id);
  if (!voiceData) {
    await ctx.reply("I had trouble processing your voice note. Could you try again?");
    return;
  }

  const stopTyping = startTypingIndicator(chatId);
  try {
    const { reply, mediaToSend } = await callAgent(profile.id, "Voice message from user.", "telegram", voiceData.base64, "audio/ogg", chatId);

    const chunks = splitMessage(reply);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    if (mediaToSend.length > 0) {
      console.log(`[TelegramBot] Sending media - chatId: ${chatId}, count: ${mediaToSend.length}`);
    }
    for (const media of mediaToSend) {
      try {
        await ctx.replyWithPhoto(media.url, { caption: media.caption || undefined });
      } catch (mediaErr) {
        console.error("[TelegramBot] Error sending media:", mediaErr);
      }
    }
  } finally {
    stopTyping();
  }
});

bot.on("message:audio", async (ctx) => {
  const chatId = ctx.chat.id;
  const audio = ctx.message.audio;

  console.log(`[TelegramBot] message:audio: chatId=${chatId}, username=${ctx.from?.username || "none"}, duration=${audio.duration}s, size=${audio.file_size || "unknown"}, mime=${audio.mime_type || "unknown"}`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    await ctx.reply("I couldn't set up your profile. Please try /start first.");
    return;
  }

  const audioData = await downloadTelegramPhoto(audio.file_id);
  if (!audioData) {
    await ctx.reply("I had trouble processing your audio. Could you try again?");
    return;
  }

  const mimeType = audio.mime_type || "audio/ogg";
  const stopTyping = startTypingIndicator(chatId);
  try {
    const { reply, mediaToSend } = await callAgent(profile.id, "Audio message from user.", "telegram", audioData.base64, mimeType, chatId);

    const chunks = splitMessage(reply);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    if (mediaToSend.length > 0) {
      console.log(`[TelegramBot] Sending media - chatId: ${chatId}, count: ${mediaToSend.length}`);
    }
    for (const media of mediaToSend) {
      try {
        await ctx.replyWithPhoto(media.url, { caption: media.caption || undefined });
      } catch (mediaErr) {
        console.error("[TelegramBot] Error sending media:", mediaErr);
      }
    }
  } finally {
    stopTyping();
  }
});

// ============================================================================
// DOCUMENT HANDLER
// ============================================================================

bot.on("message:document", async (ctx) => {
  const chatId = ctx.chat.id;
  const caption = ctx.message.caption || "";
  const doc = ctx.message.document;

  console.log(`[TelegramBot] message:document: chatId=${chatId}, username=${ctx.from?.username || "none"}, fileName=${doc.file_name || "unknown"}, mime=${doc.mime_type || "unknown"}, size=${doc.file_size || "unknown"}, caption="${caption.substring(0, 60)}"`);
  await ctx.api.sendChatAction(chatId, "typing");

  const profile = await getOrCreateProfile(chatId, ctx.from?.username);
  if (!profile) {
    await ctx.reply("I couldn't set up your profile. Please try /start first.");
    return;
  }

  // If the document is an image, process it like a photo
  if (doc.mime_type && doc.mime_type.startsWith("image/")) {
    const photoData = await downloadTelegramPhoto(doc.file_id);
    if (!photoData) {
      await ctx.reply("I had trouble processing your image. Could you try sending it again?");
      return;
    }

    const message = caption || "What can you tell me about this plant?";
    const stopTyping = startTypingIndicator(chatId);
    try {
      const { reply, mediaToSend } = await callAgent(profile.id, message, "telegram", photoData.base64, doc.mime_type, chatId);

      const chunks = splitMessage(reply);
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }

      if (mediaToSend.length > 0) {
        console.log(`[TelegramBot] Sending media - chatId: ${chatId}, count: ${mediaToSend.length}`);
      }
      for (const media of mediaToSend) {
        try {
          await ctx.replyWithPhoto(media.url, { caption: media.caption || undefined });
        } catch (mediaErr) {
          console.error("[TelegramBot] Error sending media:", mediaErr);
        }
      }
    } finally {
      stopTyping();
    }
    return;
  }

  // Unsupported document type
  await ctx.reply("I can process photos, videos, and voice notes — but I can't read documents yet. Try sending a photo instead!");
});

// ============================================================================
// CATCH-ALL HANDLER (unhandled message types)
// ============================================================================

bot.on("message", async (ctx) => {
  const msgKeys = Object.keys(ctx.message).filter(k => !['message_id','from','chat','date'].includes(k));
  console.log(`[TelegramBot] message:catch-all: chatId=${ctx.chat.id}, username=${ctx.from?.username || "none"}, messageKeys=[${msgKeys.join(",")}]`);
  await ctx.reply("I can handle text, photos, videos, and voice messages. Try sending one of those!");
});

// ============================================================================
// WEBHOOK HANDLER — async via EdgeRuntime.waitUntil()
//
// Returns 200 to Telegram immediately, then processes the update in the
// background. This prevents grammY's 10s webhook timeout from silently
// dropping responses on slow multi-tool flows (find_stores can take 25-30s).
//
// ctx.reply() still works because it makes its own outbound HTTP call to
// the Telegram API — it does not depend on the webhook response body.
// ============================================================================

serve(async (req: Request) => {
  const reqStart = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`[TelegramBot] CORS preflight`);
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("[TelegramBot] CRITICAL: TELEGRAM_BOT_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Bot not configured" }), { status: 500 });
    }

    const update = await req.json();

    // Detailed update logging
    const updateType = update.message ? 'message' :
                       update.callback_query ? 'callback_query' :
                       update.edited_message ? 'edited_message' :
                       'other';
    const chatId = update.message?.chat?.id ||
                   update.callback_query?.message?.chat?.id ||
                   update.edited_message?.chat?.id ||
                   'unknown';

    // Determine message subtype
    let messageSubtype = '';
    if (update.message) {
      if (update.message.text) messageSubtype = `text:"${(update.message.text as string).substring(0, 60)}"`;
      else if (update.message.photo) messageSubtype = `photo(${update.message.photo.length} sizes)`;
      else if (update.message.video) messageSubtype = `video`;
      else if (update.message.voice) messageSubtype = `voice(${update.message.voice.duration}s)`;
      else if (update.message.audio) messageSubtype = `audio`;
      else if (update.message.document) messageSubtype = `document(${update.message.document.mime_type})`;
      else if (update.message.sticker) messageSubtype = `sticker`;
      else messageSubtype = `other(keys:${Object.keys(update.message).filter(k => !['message_id','from','chat','date'].includes(k)).join(',')})`;
    }

    const fromUser = update.message?.from || update.callback_query?.from || update.edited_message?.from;
    console.log(`[TelegramBot] ▶ Webhook — updateId=${update.update_id}, type=${updateType}, subtype=${messageSubtype}, chatId=${chatId}, from=${fromUser ? `${fromUser.id}/${fromUser.username || "no-username"}` : "unknown"}`);

    // bot.init() fetches bot info (getMe) — required before handleUpdate.
    const initStart = Date.now();
    await bot.init();
    console.log(`[TelegramBot] bot.init() done (${Date.now() - initStart}ms)`);

    // Process the update in the background — edge function stays alive
    // via waitUntil until bot.handleUpdate completes (up to 400s wall clock)
    EdgeRuntime.waitUntil(
      bot.handleUpdate(update)
        .then(() => {
          console.log(`[TelegramBot] ◀ Update ${update.update_id} handled successfully (${Date.now() - reqStart}ms total)`);
        })
        .catch((error: unknown) => {
          const errStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          console.error(`[TelegramBot] ◀ Update ${update.update_id} FAILED (${Date.now() - reqStart}ms): ${errStr}`);
          if (error instanceof Error && error.stack) {
            console.error(`[TelegramBot] Stack: ${error.stack.substring(0, 800)}`);
          }
        })
    );

    // Immediately acknowledge to Telegram — prevents retry storms
    return new Response("OK", { status: 200 });
  } catch (error) {
    const errStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[TelegramBot] Webhook parse ERROR (${Date.now() - reqStart}ms): ${errStr}`);
    return new Response("OK", { status: 200 });
  }
});

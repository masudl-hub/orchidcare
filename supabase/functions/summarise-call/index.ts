import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";
import { validateInitData } from "../_shared/auth.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  sessionId: string;
  initData?: string;
  devSecret?: string;
  telegramChatId?: number;
  userAudio?: string;   // base64
  agentAudio?: string;  // base64
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  const reqStart = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const DEV_AUTH_SECRET = Deno.env.get("DEV_AUTH_SECRET");

  if (!GEMINI_API_KEY) {
    console.error("[SummariseCall] CRITICAL: GEMINI_API_KEY not set");
    return json({ error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { sessionId, initData, devSecret, telegramChatId, userAudio, agentAudio } = body;

  console.log(`[SummariseCall] sessionId=${sessionId}, hasUserAudio=${!!userAudio}, hasAgentAudio=${!!agentAudio}, userAudioLen=${userAudio?.length || 0}, agentAudioLen=${agentAudio?.length || 0}`);

  // Guard: need at least one audio track
  if (!userAudio && !agentAudio) {
    console.log("[SummariseCall] No audio provided — no-op");
    return json({ ok: true, skipped: true });
  }

  if (!sessionId) {
    return json({ error: "Missing sessionId" }, 400);
  }

  // ---------------------------------------------------------------------------
  // Auth: Telegram initData, Web/PWA bearer token, OR dev secret
  // ---------------------------------------------------------------------------
  const authStart = Date.now();
  let profileId: string | null = null;

  // 1. Try Supabase Auth (Web/PWA)
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token && token !== "undefined" && token !== "null") {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (profile) {
          profileId = profile.id;
          console.log(`[SummariseCall] Auth: Web bearer, profile_id=${profileId} (${Date.now() - authStart}ms)`);
        }
      }
    }
  }

  // 2. Try Telegram initData
  if (!profileId && initData) {
    const user = await validateInitData(initData, TELEGRAM_BOT_TOKEN);
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", user.id)
        .single();
      if (profile) {
        profileId = profile.id;
        console.log(`[SummariseCall] Auth: Telegram HMAC, profile_id=${profileId} (${Date.now() - authStart}ms)`);
      }
    }
  }

  // 3. Try dev secret
  if (!profileId && devSecret && telegramChatId && DEV_AUTH_SECRET) {
    if (devSecret === DEV_AUTH_SECRET) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", telegramChatId)
        .single();
      if (profile) {
        profileId = profile.id;
        console.log(`[SummariseCall] Auth: devSecret, profile_id=${profileId} (${Date.now() - authStart}ms)`);
      }
    }
  }

  if (!profileId) {
    console.error(`[SummariseCall] Auth FAILED (${Date.now() - authStart}ms)`);
    return json({ error: "Unauthorized" }, 401);
  }

  // ---------------------------------------------------------------------------
  // Verify session ownership
  // ---------------------------------------------------------------------------
  const { data: session, error: sessionError } = await supabase
    .from("call_sessions")
    .select("profile_id, status, summary")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    console.error(`[SummariseCall] Session not found: ${sessionId}`);
    return json({ error: "Session not found" }, 404);
  }

  if (session.profile_id !== profileId) {
    console.error(`[SummariseCall] Ownership mismatch: session=${session.profile_id}, auth=${profileId}`);
    return json({ error: "Session does not belong to this user" }, 403);
  }

  // Skip if already summarized
  if (session.summary) {
    console.log(`[SummariseCall] Session ${sessionId} already has summary — skipping`);
    return json({ ok: true, skipped: true });
  }

  // ---------------------------------------------------------------------------
  // Audio → Summary via Gemini (with retry)
  // ---------------------------------------------------------------------------
  const geminiStart = Date.now();
  console.log(`[SummariseCall] Sending audio to Gemini for summarization...`);

  try {
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const parts: Array<Record<string, unknown>> = [
      {
        text: `You are summarizing a voice call between a user and their AI plant care assistant "Orchid."

Summarize ONLY what was actually discussed. Do NOT infer, speculate, or add information that isn't in the audio. Attribute statements clearly (user said X, assistant explained Y).

If two audio tracks are provided, the first is the user's microphone and the second is the assistant's audio output.

Return JSON: {"summary": "3-5 sentence summary", "key_topics": ["topic1", "topic2"]}`,
      },
    ];

    if (userAudio) {
      parts.push({ inlineData: { mimeType: "audio/webm", data: userAudio } });
    }
    if (agentAudio) {
      parts.push({ inlineData: { mimeType: "audio/webm", data: agentAudio } });
    }

    // Retry up to 3 times with exponential backoff (2s, 4s, 8s)
    const MAX_RETRIES = 3;
    let lastError: unknown = null;
    let responseText = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await genai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts }],
        });
        responseText = result.text || "";
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const errStr = err instanceof Error ? err.message : String(err);
        console.warn(`[SummariseCall] Gemini attempt ${attempt}/${MAX_RETRIES} failed (${Date.now() - geminiStart}ms): ${errStr}`);
        if (attempt < MAX_RETRIES) {
          const backoffMs = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    console.log(`[SummariseCall] Gemini response (${Date.now() - geminiStart}ms): ${responseText.substring(0, 300)}`);

    let summaryJson: { summary: string; key_topics: string[] };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      summaryJson = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      console.warn(`[SummariseCall] JSON parse failed, using raw text`);
      summaryJson = { summary: responseText, key_topics: [] };
    }

    // ---------------------------------------------------------------------------
    // Store results
    // ---------------------------------------------------------------------------
    const storeStart = Date.now();

    // 1. Update call_sessions.summary
    const { error: updateError } = await supabase
      .from("call_sessions")
      .update({ summary: summaryJson.summary })
      .eq("id", sessionId);

    if (updateError) {
      console.error(`[SummariseCall] call_sessions update FAILED:`, updateError.message);
    } else {
      console.log(`[SummariseCall] call_sessions.summary updated`);
    }

    // 2. Insert into conversation_summaries
    const now = new Date().toISOString();
    const { error: summaryInsertError } = await supabase
      .from("conversation_summaries")
      .insert({
        profile_id: profileId,
        summary: summaryJson.summary,
        key_topics: summaryJson.key_topics,
        message_count: 1,
        start_time: now,
        end_time: now,
      });

    if (summaryInsertError) {
      console.error(`[SummariseCall] conversation_summaries insert FAILED:`, summaryInsertError.message);
    } else {
      console.log(`[SummariseCall] conversation_summaries row inserted`);
    }

    // 3. Insert a single conversation row for context loading
    const { error: convInsertError } = await supabase
      .from("conversations")
      .insert({
        profile_id: profileId,
        channel: "voice",
        direction: "outbound",
        content: summaryJson.summary,
        summarized: true,
      });

    if (convInsertError) {
      console.error(`[SummariseCall] conversations insert FAILED:`, convInsertError.message);
    } else {
      console.log(`[SummariseCall] conversations row inserted (channel=voice, summarized=true)`);
    }

    console.log(`[SummariseCall] Storage complete (${Date.now() - storeStart}ms), total=${Date.now() - reqStart}ms`);
    return json({ ok: true, summary: summaryJson.summary });
  } catch (err) {
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[SummariseCall] Gemini FAILED (${Date.now() - geminiStart}ms): ${errStr}`);

    // Record error on session
    await supabase
      .from("call_sessions")
      .update({ summary: `[summarisation failed: ${errStr}]` })
      .eq("id", sessionId);

    return json({ error: `Summarization failed: ${errStr}` }, 502);
  }
});

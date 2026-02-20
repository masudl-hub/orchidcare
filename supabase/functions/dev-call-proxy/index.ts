// Dev-only proxy for testing the live call flow without Telegram initData.
// Authenticates via DEV_AUTH_SECRET + telegramChatId instead of HMAC-signed initData.
// Routes: /create, /token, /tools, /end — mirrors call-session exactly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

import { loadHierarchicalContext, buildVoiceSystemPrompt } from "../_shared/context.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DevBody {
  devSecret: string;
  telegramChatId: number;
}

interface CreateBody extends DevBody {}

interface TokenBody extends DevBody {
  sessionId: string;
}

interface ToolsBody extends DevBody {
  sessionId: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
}

interface EndBody extends DevBody {
  sessionId: string;
  durationSeconds?: number;
}

interface Profile {
  id: string;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  display_name: string | null;
  personality: string | null;
  experience_level: string | null;
  location: string | null;
  timezone: string | null;
  notification_frequency: string | null;
  pets: string[] | null;
  primary_concerns: string[] | null;
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

function validateDevAuth(
  devSecret: string,
  expectedSecret: string,
): boolean {
  return !!devSecret && devSecret === expectedSecret;
}

async function getProfile(
  supabase: SupabaseClient,
  telegramChatId: number,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_chat_id", telegramChatId)
    .single();

  if (error || !data) {
    console.error(`[DevProxy] Profile lookup FAILED for chat_id=${telegramChatId}:`, error?.message || "no rows");
    return null;
  }
  return data as Profile;
}

import { voiceToolDeclarations } from "../_shared/voiceTools.ts";
import { executeTool } from "../_shared/toolExecutor.ts";

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCreate(supabase: SupabaseClient, body: CreateBody) {
  const profile = await getProfile(supabase, body.telegramChatId);
  if (!profile) return json({ error: "Profile not found" }, 404);

  const { data: session, error } = await supabase
    .from("call_sessions")
    .insert({ profile_id: profile.id, status: "pending" })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  console.log(`[DevProxy] /create: session=${session.id}, profile=${profile.id}`);
  return json({ sessionId: session.id, profileId: profile.id });
}

async function handleToken(
  supabase: SupabaseClient,
  body: TokenBody,
  geminiApiKey: string,
) {
  const profile = await getProfile(supabase, body.telegramChatId);
  if (!profile) return json({ error: "Profile not found" }, 404);

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from("call_sessions")
    .select("*")
    .eq("id", body.sessionId)
    .single();

  if (sessionError || !session) return json({ error: "Session not found" }, 404);
  if (session.profile_id !== profile.id) return json({ error: "Session mismatch" }, 403);

  // Load context
  const [context, plantsResult] = await Promise.all([
    loadHierarchicalContext(supabase, profile.id),
    supabase.from("plants").select("*").eq("profile_id", profile.id),
  ]);
  const plants = plantsResult.data || [];
  console.log(`[DevProxy] /token: plants=${plants.length}, insights=${context.insights?.length || 0}`);

  // Build system prompt
  const systemPrompt = buildVoiceSystemPrompt(
    profile.personality || "warm",
    context,
    plants,
    profile,
  );

  // Create ephemeral token
  const tokenStart = Date.now();
  const model = "models/gemini-2.5-flash-native-audio-preview-12-2025";
  const voice = session.voice || "Aoede";
  const toolCount = voiceToolDeclarations[0]?.functionDeclarations?.length || 0;
  console.log(`[DevProxy] /token: requesting ephemeral token — model=${model}, voice=${voice}, tools=${toolCount}, promptChars=${systemPrompt.length}`);

  try {
    const genai = new GoogleGenAI({ apiKey: geminiApiKey });
    const tokenConfig = {
      config: {
        uses: 1,
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            tools: voiceToolDeclarations,
            thinkingConfig: {
              thinkingBudget: 512,
            },
            contextWindowCompression: {
              triggerTokens: 25600,
              slidingWindow: { targetTokens: 12800 },
            },
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    };
    console.log(`[DevProxy] /token: calling genai.authTokens.create()...`);
    const token = await genai.authTokens.create(tokenConfig);
    console.log(`[DevProxy] /token: SDK returned — token.name=${token.name ? token.name.substring(0, 40) + "..." : "EMPTY"}, keys=${Object.keys(token).join(",")} (${Date.now() - tokenStart}ms)`);

    const ephemeralToken = token.name!;
    if (!ephemeralToken) {
      throw new Error("token.name is empty — full response: " + JSON.stringify(token).substring(0, 500));
    }

    // Mark active
    await supabase
      .from("call_sessions")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", body.sessionId);

    console.log(`[DevProxy] /token: SUCCESS — token=${ephemeralToken.substring(0, 30)}... (${Date.now() - tokenStart}ms)`);
    return json({ token: ephemeralToken });
  } catch (err) {
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[DevProxy] /token: FAILED (${Date.now() - tokenStart}ms): ${errStr}`);
    if (err instanceof Error && err.stack) {
      console.error(`[DevProxy] /token: stack: ${err.stack.substring(0, 500)}`);
    }
    await supabase.from("call_sessions").update({ status: "failed" }).eq("id", body.sessionId);
    return json({ error: `Token failed: ${errStr}` }, 502);
  }
}

async function handleTools(
  supabase: SupabaseClient,
  body: ToolsBody,
  perplexityApiKey?: string,
  lovableApiKey?: string,
) {
  const profile = await getProfile(supabase, body.telegramChatId);
  if (!profile) return json({ error: "Profile not found" }, 404);

  const toolStart = Date.now();
  console.log(`[DevProxy] /tools: executing ${body.toolName} — args=${JSON.stringify(body.toolArgs || {}).substring(0, 200)}`);

  const result = await executeTool(
    supabase,
    profile.id,
    body.toolName,
    body.toolArgs || {},
    perplexityApiKey,
    lovableApiKey,
  );

  console.log(`[DevProxy] /tools: ${body.toolName} complete (${Date.now() - toolStart}ms) — result keys=${Object.keys(result).join(",")}`);

  // Increment tool count
  try { await supabase.rpc("increment_tool_calls_count", { p_session_id: body.sessionId }); } catch { /* non-fatal */ }

  return json({ result });
}

async function handleEnd(supabase: SupabaseClient, body: EndBody) {
  const { data: session } = await supabase
    .from("call_sessions")
    .select("status")
    .eq("id", body.sessionId)
    .single();

  if (!session) return json({ error: "Session not found" }, 404);
  if (session.status === "ended") return json({ ok: true, alreadyEnded: true });

  await supabase
    .from("call_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      duration_seconds: body.durationSeconds ?? null,
    })
    .eq("id", body.sessionId);

  console.log(`[DevProxy] /end: session ${body.sessionId} ended`);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const DEV_AUTH_SECRET = Deno.env.get("DEV_AUTH_SECRET");
  if (!DEV_AUTH_SECRET) {
    return json({ error: "DEV_AUTH_SECRET not configured — set it via: supabase secrets set DEV_AUTH_SECRET=your-secret" }, 500);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json() as Record<string, unknown>;

    // Validate dev auth on every request
    if (!validateDevAuth(body.devSecret as string, DEV_AUTH_SECRET)) {
      return json({ error: "Invalid devSecret" }, 401);
    }
    if (!body.telegramChatId) {
      return json({ error: "Missing telegramChatId" }, 400);
    }

    const routeStart = Date.now();
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    console.log(`[DevProxy] → ${path} — chat_id=${body.telegramChatId}`);

    let response: Response;
    switch (path) {
      case "create":
        response = await handleCreate(supabase, body as unknown as CreateBody);
        break;
      case "token":
        if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
        response = await handleToken(supabase, body as unknown as TokenBody, GEMINI_API_KEY);
        break;
      case "tools":
        response = await handleTools(supabase, body as unknown as ToolsBody, PERPLEXITY_API_KEY, LOVABLE_API_KEY);
        break;
      case "end":
        response = await handleEnd(supabase, body as unknown as EndBody);
        break;
      default:
        return json({ error: "Unknown route" }, 404);
    }

    console.log(`[DevProxy] ← ${path} — ${response.status} (${Date.now() - routeStart}ms)`);
    return response;
  } catch (err) {
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[DevProxy] UNHANDLED ERROR: ${errStr}`);
    if (err instanceof Error && err.stack) {
      console.error(`[DevProxy] stack: ${err.stack.substring(0, 500)}`);
    }
    return json({ error: errStr }, 500);
  }
});

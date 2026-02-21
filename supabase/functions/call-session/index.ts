import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

import { loadHierarchicalContext, buildVoiceSystemPrompt } from "../_shared/context.ts";
import { validateInitData } from "../_shared/auth.ts";
import type { TelegramUser } from "../_shared/auth.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateBody {
  initData: string;
}

interface TokenBody {
  sessionId: string;
  initData: string;
}

interface ToolsBody {
  sessionId: string;
  initData: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
}

interface EndBody {
  sessionId: string;
  initData: string;
  durationSeconds?: number;
}

interface CallSession {
  id: string;
  profile_id: string;
  status: "pending" | "active" | "ended" | "failed";
  mode: "audio" | "video";
  voice: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  tool_calls_count: number;
  summary: string | null;
  created_at: string;
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

async function validateAuthAndGetProfile(
  supabase: SupabaseClient,
  initData: string | undefined,
  authHeader: string | null,
  botToken: string,
): Promise<{ profile: Profile; source: "telegram" | "web" } | null> {
  const authStart = Date.now();

  // 1. Try Supabase Auth (Web/PWA)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token && token !== "undefined" && token !== "null") {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        console.log(`[CallSession] Auth: Supabase Web valid, user_id=${user.id} (${Date.now() - authStart}ms)`);
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (!profileError && profile) {
          console.log(`[CallSession] Auth: resolved Web profile_id=${profile.id}`);
          return { profile, source: "web" };
        } else {
          console.error(`[CallSession] Auth: Web profile lookup FAILED for user_id=${user.id}:`, profileError?.message || "no rows found");
        }
      } else {
        console.error(`[CallSession] Auth: Supabase Web FAILED:`, authError?.message);
      }
    }
  }

  // 2. Fallback to Telegram initData
  if (initData) {
    console.log(`[CallSession] Auth: validating initData (${initData.length} chars)`);
    const user = await validateInitData(initData, botToken);
    if (!user) {
      console.error(`[CallSession] Auth: HMAC validation FAILED (${Date.now() - authStart}ms)`);
      return null;
    }
    console.log(`[CallSession] Auth: HMAC valid, telegram user_id=${user.id}, username=${user.username || "none"} (${Date.now() - authStart}ms)`);

    const dbStart = Date.now();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_chat_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(`[CallSession] Auth: profile lookup FAILED for telegram_chat_id=${user.id} (${Date.now() - dbStart}ms):`, profileError?.message || "no rows");
      return null;
    }

    console.log(`[CallSession] Auth: resolved Telegram profile_id=${profile.id} (${Date.now() - dbStart}ms)`);
    return { profile, source: "telegram" };
  }

  return null;
}

import { voiceToolDeclarations } from "../_shared/voiceTools.ts";
import { executeTool } from "../_shared/toolExecutor.ts";

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCreate(
  supabase: SupabaseClient,
  body: CreateBody,
  authHeader: string | null,
  botToken: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /create: body keys=${Object.keys(body).join(",")}, initData present=${!!body.initData}`);

  const { initData } = body;
  if (!initData && !authHeader) {
    console.error("[CallSession] /create: REJECTED — missing initData and authHeader");
    return json({ error: "Missing initData or Authorization header" }, 400);
  }

  const result = await validateAuthAndGetProfile(supabase, initData, authHeader, botToken);
  if (!result) {
    console.error(`[CallSession] /create: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid initData, token, or profile not found" }, 401);
  }

  const { profile } = result;

  const dbStart = Date.now();
  const { data: session, error } = await supabase
    .from("call_sessions")
    .insert({
      profile_id: profile.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error(`[CallSession] /create: DB insert FAILED (${Date.now() - dbStart}ms):`, error.message, error.details);
    return json({ error: error.message }, 500);
  }

  console.log(
    `[CallSession] /create: SUCCESS — session=${session.id}, profile=${profile.id}, status=pending, total=${Date.now() - routeStart}ms`,
  );

  return json({ sessionId: session.id, profileId: profile.id });
}

async function handleToken(
  supabase: SupabaseClient,
  body: TokenBody,
  authHeader: string | null,
  botToken: string,
  geminiApiKey: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /token: sessionId=${body.sessionId}, initData present=${!!body.initData}`);

  const { sessionId, initData } = body;
  if (!sessionId || (!initData && !authHeader)) {
    console.error("[CallSession] /token: REJECTED — missing sessionId, initData, or authHeader");
    return json({ error: "Missing sessionId, initData, or authHeader" }, 400);
  }

  // Validate initData and resolve profile
  const result = await validateAuthAndGetProfile(supabase, initData, authHeader, botToken);
  if (!result) {
    console.error(`[CallSession] /token: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid initData, token, or profile not found" }, 401);
  }

  const { profile } = result;

  // Verify session belongs to this user
  const sessionLookupStart = Date.now();
  const { data: sessionData, error: sessionError } = await supabase
    .from("call_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !sessionData) {
    console.error(`[CallSession] /token: session lookup FAILED for id=${sessionId} (${Date.now() - sessionLookupStart}ms):`, sessionError?.message || "no rows");
    return json({ error: "Session not found" }, 404);
  }

  const session = sessionData as CallSession;
  console.log(`[CallSession] /token: session found — status=${session.status}, mode=${session.mode}, voice=${session.voice}, profile_id=${session.profile_id} (${Date.now() - sessionLookupStart}ms)`);

  if (session.profile_id !== profile.id) {
    console.error(`[CallSession] /token: REJECTED — ownership mismatch: session.profile_id=${session.profile_id} != auth profile_id=${profile.id}`);
    return json({ error: "Session does not belong to this user" }, 403);
  }

  // Load context, plants, and profile data in parallel
  const contextStart = Date.now();
  console.log(`[CallSession] /token: loading context + plants for profile ${profile.id}...`);
  const [context, plantsResult] = await Promise.all([
    loadHierarchicalContext(supabase, profile.id),
    supabase.from("plants").select("*").eq("profile_id", profile.id),
  ]);

  const plants = plantsResult.data || [];
  console.log(`[CallSession] /token: context loaded — plants=${plants.length}, messages=${context.recentMessages?.length || 0}, summaries=${context.conversationSummaries?.length || 0}, insights=${context.insights?.length || 0} (${Date.now() - contextStart}ms)`);

  // Build voice system prompt
  const promptStart = Date.now();
  const systemPrompt = buildVoiceSystemPrompt(
    profile.personality || "warm",
    context,
    plants,
    profile,
  );
  console.log(`[CallSession] /token: voice prompt built — ${systemPrompt.length} chars (${Date.now() - promptStart}ms)`);

  // Create ephemeral token via Google GenAI SDK
  const tokenStart = Date.now();
  const model = "models/gemini-2.5-flash-native-audio-preview-12-2025";
  const voice = session.voice || "Algenib";
  const toolCount = voiceToolDeclarations[0]?.functionDeclarations?.length || 0;
  console.log(`[CallSession] /token: requesting ephemeral token — model=${model}, voice=${voice}, tools=${toolCount}, promptChars=${systemPrompt.length}`);

  let ephemeralToken: string;
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
    console.log(`[CallSession] /token: calling genai.authTokens.create()...`);
    const token = await genai.authTokens.create(tokenConfig);
    console.log(`[CallSession] /token: SDK returned — token.name=${token.name ? token.name.substring(0, 40) + "..." : "EMPTY"}, token keys=${Object.keys(token).join(",")} (${Date.now() - tokenStart}ms)`);

    ephemeralToken = token.name!;
    if (!ephemeralToken) {
      throw new Error("token.name is empty — full response: " + JSON.stringify(token).substring(0, 500));
    }
  } catch (err) {
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[CallSession] /token: ephemeral token FAILED (${Date.now() - tokenStart}ms): ${errStr}`);
    if (err instanceof Error && err.stack) {
      console.error(`[CallSession] /token: stack: ${err.stack.substring(0, 500)}`);
    }
    await supabase
      .from("call_sessions")
      .update({ status: "failed" })
      .eq("id", sessionId);
    console.log(`[CallSession] /token: session ${sessionId} status: pending→failed`);
    return json(
      { error: `Failed to get ephemeral token: ${errStr}` },
      502,
    );
  }

  // Mark session as active
  const activateStart = Date.now();
  const { error: activateError } = await supabase
    .from("call_sessions")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (activateError) {
    console.error(`[CallSession] /token: session activate FAILED (${Date.now() - activateStart}ms):`, activateError.message);
  } else {
    console.log(`[CallSession] /token: session ${sessionId} status: pending→active (${Date.now() - activateStart}ms)`);
  }

  console.log(`[CallSession] /token: SUCCESS — total=${Date.now() - routeStart}ms, token=${ephemeralToken.substring(0, 30)}...`);
  return json({ token: ephemeralToken });
}

async function handleTools(
  supabase: SupabaseClient,
  body: ToolsBody,
  authHeader: string | null,
  botToken: string,
  perplexityApiKey?: string,
  lovableApiKey?: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /tools: toolName=${body.toolName}, sessionId=${body.sessionId}, callId=${body.toolCallId}, args=${JSON.stringify(body.toolArgs || {}).substring(0, 300)}`);

  const { sessionId, initData, toolName, toolArgs, toolCallId } = body;
  if (!sessionId || (!initData && !authHeader) || !toolName) {
    console.error(`[CallSession] /tools: REJECTED — missing fields`);
    return json({ error: "Missing sessionId, auth, or toolName" }, 400);
  }

  // Validate initData and resolve profile
  const result = await validateAuthAndGetProfile(supabase, initData, authHeader, botToken);
  if (!result) {
    console.error(`[CallSession] /tools: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid auth or profile not found" }, 401);
  }

  const { profile } = result;

  // Verify session belongs to this user
  const { data: session, error: sessionError } = await supabase
    .from("call_sessions")
    .select("profile_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    console.error(`[CallSession] /tools: session lookup FAILED for id=${sessionId}:`, sessionError?.message || "no rows");
    return json({ error: "Session not found" }, 404);
  }

  if (session.profile_id !== profile.id) {
    console.error(`[CallSession] /tools: REJECTED — ownership mismatch`);
    return json({ error: "Session does not belong to this user" }, 403);
  }

  console.log(`[CallSession] /tools: session verified (status=${session.status}), executing ${toolName}...`);

  // Execute the tool
  const toolResult = await executeTool(
    supabase,
    profile.id,
    toolName,
    toolArgs || {},
    perplexityApiKey,
    lovableApiKey,
  );

  // Increment tool_calls_count atomically
  const { error: rpcError } = await supabase.rpc('increment_tool_calls_count', { p_session_id: sessionId });
  if (rpcError) {
    console.warn(`[CallSession] /tools: increment_tool_calls_count RPC failed:`, rpcError.message);
  }

  console.log(`[CallSession] /tools: SUCCESS — ${toolName} total=${Date.now() - routeStart}ms`);
  return json({ result: toolResult });
}

async function handleEnd(
  supabase: SupabaseClient,
  body: EndBody,
  authHeader: string | null,
  botToken: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /end: sessionId=${body.sessionId}, durationSeconds=${body.durationSeconds}`);

  const { sessionId, initData, durationSeconds } = body;
  if (!sessionId || (!initData && !authHeader)) {
    console.error(`[CallSession] /end: REJECTED — missing fields`);
    return json({ error: "Missing sessionId or auth token" }, 400);
  }

  // Validate auth and resolve profile
  const result = await validateAuthAndGetProfile(supabase, initData, authHeader, botToken);
  if (!result) {
    console.error(`[CallSession] /end: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid auth or profile not found" }, 401);
  }

  const { profile } = result;

  // Verify session belongs to this user
  const { data: session, error: sessionError } = await supabase
    .from("call_sessions")
    .select("profile_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    console.error(`[CallSession] /end: session lookup FAILED for id=${sessionId}:`, sessionError?.message || "no rows");
    return json({ error: "Session not found" }, 404);
  }

  console.log(`[CallSession] /end: session found — current status=${session.status}`);

  if (session.profile_id !== profile.id) {
    console.error(`[CallSession] /end: REJECTED — ownership mismatch`);
    return json({ error: "Session does not belong to this user" }, 403);
  }

  // Guard: don't end a session that's already ended
  if (session.status === "ended") {
    console.warn(`[CallSession] /end: session ${sessionId} already ended, skipping update`);
    return json({ ok: true, alreadyEnded: true });
  }

  const { error: updateError } = await supabase
    .from("call_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds ?? null,
    })
    .eq("id", sessionId);

  if (updateError) {
    console.error(`[CallSession] /end: DB update FAILED:`, updateError.message);
    return json({ error: updateError.message }, 500);
  }

  console.log(
    `[CallSession] /end: SUCCESS — session ${sessionId} status: ${session.status}→ended, duration=${durationSeconds != null ? durationSeconds : "unknown"}s, total=${Date.now() - routeStart}ms`,
  );

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  const reqStart = Date.now();

  if (req.method === "OPTIONS") {
    console.log(`[CallSession] CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.warn(`[CallSession] Rejected method: ${req.method}`);
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Log env var availability (not values)
  console.log(`[CallSession] ENV check: SUPABASE_URL=${!!SUPABASE_URL}, SERVICE_KEY=${!!SUPABASE_SERVICE_ROLE_KEY}, BOT_TOKEN=${!!TELEGRAM_BOT_TOKEN}, GEMINI_KEY=${!!GEMINI_API_KEY}, PERPLEXITY=${!!PERPLEXITY_API_KEY}, LOVABLE=${!!LOVABLE_API_KEY}`);

  if (!GEMINI_API_KEY) {
    console.error("[CallSession] CRITICAL: GEMINI_API_KEY is not set!");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Route dispatch by URL path
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  console.log(`[CallSession] ▶ ${req.method} /${path} (${url.pathname})`);

  try {
    const body: unknown = await req.json();
    console.log(`[CallSession] Request body keys: ${Object.keys(body as Record<string, unknown>).join(", ")}`);

    const authHeader = req.headers.get("Authorization");

    let response: Response;

    switch (path) {
      case "create":
        response = await handleCreate(supabase, body as CreateBody, authHeader, TELEGRAM_BOT_TOKEN);
        break;
      case "token":
        response = await handleToken(
          supabase,
          body as TokenBody,
          authHeader,
          TELEGRAM_BOT_TOKEN,
          GEMINI_API_KEY!,
        );
        break;
      case "tools":
        response = await handleTools(
          supabase,
          body as ToolsBody,
          authHeader,
          TELEGRAM_BOT_TOKEN,
          PERPLEXITY_API_KEY,
          LOVABLE_API_KEY,
        );
        break;
      case "end":
        response = await handleEnd(supabase, body as EndBody, authHeader, TELEGRAM_BOT_TOKEN);
        break;
      default:
        console.warn(`[CallSession] Unknown route: ${path}`);
        response = json({ error: "Unknown route" }, 404);
    }

    console.log(`[CallSession] ◀ /${path} → ${response.status} (${Date.now() - reqStart}ms)`);
    return response;
  } catch (error) {
    const errStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[CallSession] ◀ /${path} → UNHANDLED ERROR (${Date.now() - reqStart}ms): ${errStr}`);
    if (error instanceof Error && error.stack) {
      console.error(`[CallSession] Stack: ${error.stack.substring(0, 800)}`);
    }
    return json({ error: errStr }, 500);
  }
});

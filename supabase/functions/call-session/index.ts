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
  transcript?: { role: 'user' | 'agent'; text: string }[];
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
            // inputAudioTranscription: {},
            // outputAudioTranscription: {},
            // ↑ Disabled: causes 1008 on BidiGenerateContentConstrained (ephemeral token endpoint).
            //   Transcription events may still arrive on v1alpha without explicit config —
            //   the client-side accumulation in useGeminiLive.ts handles them if present.
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            tools: voiceToolDeclarations,
            // thinkingConfig: { thinkingBudget: 512 },
            // ↑ Disabled: not supported on BidiGenerateContentConstrained (ephemeral token endpoint) — causes 1008

            // contextWindowCompression: {
            //   triggerTokens: 25600,
            //   slidingWindow: { targetTokens: 12800 },
            // },
            // ↑ Disabled: same reason — constrained endpoint doesn't support sliding window compression
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
  lovableApiKey?: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /end: sessionId=${body.sessionId}, durationSeconds=${body.durationSeconds}, transcriptTurns=${body.transcript?.length || 0}`);

  const { sessionId, initData, durationSeconds, transcript } = body;
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

  // ---- Core update payload ----
  const updatePayload: Record<string, unknown> = {
    status: "ended",
    ended_at: new Date().toISOString(),
    duration_seconds: durationSeconds ?? null,
  };

  // ---- Process transcript (if present and non-empty) ----
  if (transcript && transcript.length > 0) {
    const userTurns = transcript.filter(t => t.role === "user").length;
    const agentTurns = transcript.filter(t => t.role === "agent").length;
    const totalChars = transcript.reduce((sum, t) => sum + t.text.length, 0);
    console.log(`[CallSession] /end: processing transcript — ${transcript.length} turns (${userTurns} user, ${agentTurns} agent), ${totalChars} chars total`);

    // 1. Insert transcript turns into conversations table
    const insertStart = Date.now();
    const now = new Date();
    const conversationRows = transcript.map((turn, i) => ({
      profile_id: profile.id,
      channel: "voice",
      direction: turn.role === "user" ? "inbound" : "outbound",
      content: turn.text,
      created_at: new Date(now.getTime() - (transcript.length - i) * 1000).toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("conversations")
      .insert(conversationRows);

    if (insertError) {
      console.error(`[CallSession] /end: conversation insert FAILED (${Date.now() - insertStart}ms):`, insertError.message, insertError.details);
    } else {
      console.log(`[CallSession] /end: inserted ${conversationRows.length} conversation rows (channel=voice) (${Date.now() - insertStart}ms)`);
    }

    // 2. Generate call summary + extract insights (in parallel, best-effort)
    if (lovableApiKey) {
      const transcriptText = transcript
        .map(t => `[${t.role === "user" ? "inbound" : "outbound"}]: ${t.text}`)
        .join("\n");
      console.log(`[CallSession] /end: starting AI processing — summary + insight extraction in parallel (transcriptText=${transcriptText.length} chars)`);

      const aiStart = Date.now();
      try {
        const [summaryResponse, insights] = await Promise.all([
          // Summary generation
          fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              thinking_config: { thinking_level: "low" },
              messages: [
                {
                  role: "system",
                  content: `You are a conversation summarizer. Create a concise summary of this plant care voice call that captures:
1. Key plants discussed
2. Issues diagnosed or questions answered
3. Actions taken (plants saved, reminders set)
4. Important user preferences revealed

Return JSON: {"summary": "2-3 sentence summary", "key_topics": ["topic1", "topic2"]}`,
                },
                { role: "user", content: transcriptText },
              ],
              max_tokens: 200,
            }),
          }),
          // Insight extraction
          (async (): Promise<Array<{ key: string; value: string }>> => {
            const insightStart = Date.now();
            try {
              const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${lovableApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  thinking_config: { thinking_level: "low" },
                  messages: [
                    {
                      role: "system",
                      content: `Extract structured user facts from this plant care conversation.

Return ONLY valid JSON with an array of insights (empty array if none found):
{
  "insights": [
    {"key": "has_pets", "value": "yes"},
    {"key": "pet_type", "value": "cat"},
    {"key": "home_lighting", "value": "mostly low light, one south-facing window"}
  ]
}

Valid keys (ONLY use these):
- has_pets: "yes" or "no"
- pet_type: specific pet (cat, dog, bird, etc.)
- home_lighting: description of light conditions
- watering_style: tendency (overwaterer, underwaterer, forgetful, consistent)
- experience_level: beginner, intermediate, experienced
- plant_preferences: types they like (tropical, succulents, flowering, etc.)
- climate_zone: if mentioned (humid, dry, seasonal, etc.)
- window_orientation: north, south, east, west facing
- child_safety: if they mention kids/child safety
- home_humidity: humid, dry, average
- problem_patterns: recurring issues (root rot, pests, etc.)

CRITICAL: Only extract facts EXPLICITLY stated by the user. Do not infer or guess.`,
                    },
                    { role: "user", content: transcriptText },
                  ],
                  max_tokens: 300,
                }),
              });
              if (!resp.ok) {
                console.error(`[CallSession] /end: insight extraction API error: ${resp.status} ${resp.statusText} (${Date.now() - insightStart}ms)`);
                return [];
              }
              const data = await resp.json();
              const content = data.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
              console.log(`[CallSession] /end: insight extraction completed — ${parsed.insights?.length || 0} insights (${Date.now() - insightStart}ms)`);
              return parsed.insights || [];
            } catch (insightErr) {
              console.error(`[CallSession] /end: insight extraction FAILED (${Date.now() - insightStart}ms):`, insightErr);
              return [];
            }
          })(),
        ]);

        console.log(`[CallSession] /end: AI processing completed (${Date.now() - aiStart}ms) — summaryOk=${summaryResponse.ok}, insights=${insights.length}`);

        // Process summary
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          const summaryContent = summaryData.choices?.[0]?.message?.content || "";
          let summaryJson: { summary: string; key_topics: string[] };
          try {
            const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
            summaryJson = JSON.parse(jsonMatch ? jsonMatch[0] : summaryContent);
          } catch {
            console.warn(`[CallSession] /end: summary JSON parse failed, using raw content (${summaryContent.length} chars)`);
            summaryJson = { summary: summaryContent, key_topics: [] };
          }

          console.log(`[CallSession] /end: summary generated — "${summaryJson.summary.substring(0, 100)}...", topics=[${summaryJson.key_topics.join(", ")}]`);
          updatePayload.summary = summaryJson.summary;

          // Also save to conversation_summaries table for context loading
          const { error: summaryInsertError } = await supabase.from("conversation_summaries").insert({
            profile_id: profile.id,
            summary: summaryJson.summary,
            key_topics: summaryJson.key_topics,
            message_count: transcript.length,
            start_time: conversationRows[0].created_at,
            end_time: conversationRows[conversationRows.length - 1].created_at,
          });

          if (summaryInsertError) {
            console.error(`[CallSession] /end: conversation_summaries insert FAILED:`, summaryInsertError.message, summaryInsertError.details);
          } else {
            console.log(`[CallSession] /end: conversation_summaries row inserted`);
          }
        } else {
          const errBody = await summaryResponse.text().catch(() => "unreadable");
          console.error(`[CallSession] /end: summary API FAILED: ${summaryResponse.status} ${summaryResponse.statusText} — ${errBody.substring(0, 300)}`);
        }

        // Process insights
        if (insights.length > 0) {
          console.log(`[CallSession] /end: saving ${insights.length} insights — [${insights.map(i => i.key).join(", ")}]`);
          let savedCount = 0;
          for (const insight of insights) {
            const { error: insightError } = await supabase.from("user_insights").upsert(
              {
                profile_id: profile.id,
                insight_key: insight.key,
                insight_value: insight.value,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "profile_id,insight_key" },
            );
            if (insightError) {
              console.error(`[CallSession] /end: insight upsert FAILED for key="${insight.key}":`, insightError.message);
            } else {
              savedCount++;
            }
          }
          console.log(`[CallSession] /end: insights saved — ${savedCount}/${insights.length} succeeded`);
        } else {
          console.log(`[CallSession] /end: no insights extracted from transcript`);
        }

        // Mark the voice conversation rows as already summarized
        // (we just generated the summary — no need for maybeCompressHistory to re-process)
        const markStart = Date.now();
        const voiceMessageIds = (await supabase
          .from("conversations")
          .select("id")
          .eq("profile_id", profile.id)
          .eq("channel", "voice")
          .order("created_at", { ascending: false })
          .limit(transcript.length)
        ).data?.map((m: any) => m.id) || [];

        if (voiceMessageIds.length > 0) {
          const { error: markError } = await supabase.from("conversations").update({ summarized: true }).in("id", voiceMessageIds);
          if (markError) {
            console.error(`[CallSession] /end: mark summarized FAILED (${Date.now() - markStart}ms):`, markError.message);
          } else {
            console.log(`[CallSession] /end: marked ${voiceMessageIds.length} voice messages as summarized (${Date.now() - markStart}ms)`);
          }
        } else {
          console.warn(`[CallSession] /end: no voice message IDs found to mark as summarized (${Date.now() - markStart}ms)`);
        }
      } catch (err) {
        const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(`[CallSession] /end: transcript processing FAILED (${Date.now() - aiStart}ms): ${errStr}`);
        if (err instanceof Error && err.stack) {
          console.error(`[CallSession] /end: stack: ${err.stack.substring(0, 500)}`);
        }
        // Non-fatal — session still ends successfully
      }
    } else {
      console.warn(`[CallSession] /end: LOVABLE_API_KEY not set — skipping summary/insight generation for ${transcript.length} transcript turns`);
    }
  } else {
    console.log(`[CallSession] /end: no transcript provided — skipping transcript processing`);
  }

  // ---- Final DB update ----
  const { error: updateError } = await supabase
    .from("call_sessions")
    .update(updatePayload)
    .eq("id", sessionId);

  if (updateError) {
    console.error(`[CallSession] /end: DB update FAILED:`, updateError.message);
    return json({ error: updateError.message }, 500);
  }

  console.log(
    `[CallSession] /end: SUCCESS — session ${sessionId} status: ${session.status}→ended, duration=${durationSeconds != null ? durationSeconds : "unknown"}s, summary=${!!updatePayload.summary}, total=${Date.now() - routeStart}ms`,
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
        response = await handleEnd(supabase, body as EndBody, authHeader, TELEGRAM_BOT_TOKEN, LOVABLE_API_KEY);
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

// Dev-only proxy for testing the live call flow without Telegram initData.
// Authenticates via DEV_AUTH_SECRET + telegramChatId instead of HMAC-signed initData.
// Routes: /create, /token, /tools, /end — mirrors call-session exactly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

import {
  savePlant,
  modifyPlant,
  deletePlant,
  createReminder,
  deleteReminder,
  logCareEvent,
  saveUserInsight,
  updateNotificationPreferences,
  updateProfile,
} from "../_shared/tools.ts";
import {
  callResearchAgent,
  callMapsShoppingAgent,
  verifyStoreInventory,
} from "../_shared/research.ts";
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

// ---------------------------------------------------------------------------
// Voice tool declarations — same as call-session
// ---------------------------------------------------------------------------

const voiceToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "research",
        description: "Search the web for current plant care information",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "save_plant",
        description: "Save a plant to the user's collection",
        parameters: {
          type: "OBJECT",
          properties: {
            species: { type: "STRING", description: "Plant species name" },
            nickname: { type: "STRING", description: "Optional nickname" },
            location: { type: "STRING", description: "Location in home" },
          },
          required: ["species"],
        },
      },
      {
        name: "modify_plant",
        description: "Update plant details. Supports bulk: 'all', 'all plants in the bedroom', etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            updates: {
              type: "OBJECT",
              properties: {
                nickname: { type: "STRING" },
                location: { type: "STRING" },
                notes: { type: "STRING" },
              },
            },
          },
          required: ["plant_identifier"],
        },
      },
      {
        name: "delete_plant",
        description: "Remove plants from collection. For bulk, confirm via voice first.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            user_confirmed: { type: "BOOLEAN", description: "True only after explicit voice confirmation" },
          },
          required: ["plant_identifier"],
        },
      },
      {
        name: "create_reminder",
        description: "Set care reminders for plants",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            reminder_type: { type: "STRING", description: "water, fertilize, repot, rotate, check, prune, mist" },
            frequency_days: { type: "INTEGER", description: "Days between reminders" },
            notes: { type: "STRING", description: "Optional notes" },
          },
          required: ["plant_identifier", "reminder_type", "frequency_days"],
        },
      },
      {
        name: "log_care_event",
        description: "Log a care activity like watering or fertilizing",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            event_type: { type: "STRING", description: "water, fertilize, repot, prune, mist, rotate, treat" },
            notes: { type: "STRING", description: "Optional notes" },
          },
          required: ["plant_identifier", "event_type"],
        },
      },
      {
        name: "save_user_insight",
        description: "Remember a fact about the user for future reference",
        parameters: {
          type: "OBJECT",
          properties: {
            insight_key: { type: "STRING", description: "Category: has_pets, pet_type, home_lighting, watering_style, experience_level, plant_goals, etc." },
            insight_value: { type: "STRING", description: "The fact to remember" },
          },
          required: ["insight_key", "insight_value"],
        },
      },
      {
        name: "update_notification_preferences",
        description: "Update proactive message preferences",
        parameters: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING", description: "care_reminders, observations, seasonal_tips, health_followups, or all" },
            action: { type: "STRING", description: "enable, disable, or set_frequency" },
            notification_frequency: { type: "STRING", description: "off, daily, weekly, realtime" },
          },
          required: ["topic", "action"],
        },
      },
      {
        name: "update_profile",
        description: "Update user profile fields like name, location, experience level",
        parameters: {
          type: "OBJECT",
          properties: {
            field: { type: "STRING", description: "display_name, location, experience_level, primary_concerns, personality, pets, timezone" },
            value: { type: "STRING", description: "The new value" },
          },
          required: ["field", "value"],
        },
      },
      {
        name: "find_stores",
        description: "Find local stores for plant supplies",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            product_query: { type: "STRING", description: "What to look for" },
            store_type: { type: "STRING", description: "nursery, garden_center, hardware_store, or any" },
          },
          required: ["product_query"],
        },
      },
      {
        name: "verify_store_inventory",
        description: "Check if a specific store carries a product",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            store_name: { type: "STRING", description: "Full store name with location" },
            product: { type: "STRING", description: "Product to check" },
            location: { type: "STRING", description: "City or ZIP" },
          },
          required: ["store_name", "product", "location"],
        },
      },
      {
        name: "deep_think",
        description: "Route a complex question to a smarter model for deeper reasoning. Use this for plant diagnosis, treatment plans, complex care questions, or anything requiring careful analysis. The response will be thorough and expert-level.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING", description: "The full question to reason about, including all relevant context from the conversation" },
            context: { type: "STRING", description: "Additional context: plant species, symptoms, environment, user history" },
          },
          required: ["question"],
        },
      },
      {
        name: "delete_reminder",
        description: "Deactivate/remove care reminders for plants. Supports bulk: 'all', 'all plants in the bedroom', etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: { type: "STRING", description: "Plant name or bulk pattern" },
            reminder_type: { type: "STRING", description: "Optional filter: water, fertilize, repot, rotate, check, prune, mist. Omit to delete all." },
          },
          required: ["plant_identifier"],
        },
      },
      {
        name: "identify_plant",
        description: "Identify a plant from your visual observation. In voice mode, describe what you see from the camera. Provide species, common names, and brief care summary.",
        parameters: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Detailed visual description of the plant: leaf shape, color, size, stems, flowers, any distinctive features" },
            context: { type: "STRING", description: "Any additional context the user shared" },
          },
          required: ["description"],
        },
      },
      {
        name: "diagnose_plant",
        description: "Diagnose plant health issues from your visual observation. Describe symptoms you see from the camera.",
        parameters: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Detailed description of symptoms: discoloration, wilting, spots, pests, etc." },
            plant_species: { type: "STRING", description: "Plant species if known" },
          },
          required: ["description"],
        },
      },
      {
        name: "analyze_environment",
        description: "Analyze the growing environment from what you can see on the camera. Assess light, space, and conditions.",
        parameters: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING", description: "Description of the environment: light levels, window proximity, space, other plants nearby" },
            plant_species: { type: "STRING", description: "Plant species being placed here, if relevant" },
          },
          required: ["description"],
        },
      },
      {
        name: "generate_visual_guide",
        description: "Generate a visual care guide or illustration for a plant topic.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING", description: "What to illustrate: repotting steps, pruning guide, pest identification, etc." },
            plant_species: { type: "STRING", description: "Plant species for context" },
          },
          required: ["topic"],
        },
      },
      {
        name: "analyze_video",
        description: "Analyze a longer observation of a plant from the camera feed. Use when you need extended observation.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            observation: { type: "STRING", description: "Summary of what you observed over time" },
            question: { type: "STRING", description: "Specific question about the observation" },
          },
          required: ["observation"],
        },
      },
      {
        name: "generate_image",
        description: "Generate an image based on a description. Use for visual guides or illustrations.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            prompt: { type: "STRING", description: "Detailed description of the image to generate" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "show_visual",
        description: "Display a visual formation on the pixel canvas during the call. Use this to show plant silhouettes, tool images, text messages, lists, or icons. The pixels will animate from their current shape to the new formation. Available formations include 82 plant species and 37 gardening tools from the asset library, plus dynamic text, lists, and icons.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", description: "Formation type: 'template' for plant/tool art, 'text' for pixel text, 'list' for numbered items" },
            id: { type: "STRING", description: "Template ID for type='template'. Examples: 'monstera_deliciosa', 'watering_can', 'phalaenopsis_orchid'. Use the closest match to what you're discussing." },
            text: { type: "STRING", description: "Text to display for type='text'. Keep SHORT — max ~11 chars per line, ~10 lines. All caps recommended." },
            items: { type: "ARRAY", items: { type: "STRING" }, description: "List items for type='list'. Max 5 items, keep each SHORT." },
            transition: { type: "STRING", description: "Animation style: 'morph' (smooth curves, default), 'dissolve' (fade), 'scatter' (explode+reform), 'ripple' (wave from center)" },
            hold: { type: "INTEGER", description: "Seconds to hold formation before returning to orchid. 0 = stay until next show_visual. Default: 8" },
          },
          required: ["type"],
        },
      },
      {
        name: "annotate_view",
        description: "Draw pixel-art annotations on the user's camera feed. Use when video is active to point out features — leaf damage, pests, good placement spots, soil issues. Places markers on a 5x5 grid.",
        parameters: {
          type: "OBJECT",
          properties: {
            markers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  region: { type: "STRING", description: "Grid region (5x5): T1 T2 T3 T4 T5 / U1 U2 U3 U4 U5 / M1 M2 M3 M4 M5 / L1 L2 L3 L4 L5 / B1 B2 B3 B4 B5" },
                  type: { type: "STRING", description: "Marker type: arrow, circle, x, or label" },
                  label: { type: "STRING", description: "Short text label (max 12 chars). Required for label type." },
                  direction: { type: "STRING", description: "For arrows only: up, down, left, right, up-left, up-right, down-left, down-right" },
                },
                required: ["region", "type"],
              },
            },
            hold: { type: "INTEGER", description: "Seconds to display. 0 = stay until next call. Default: 8" },
          },
          required: ["markers"],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Deep think — routes to Gemini 3 Flash for smarter reasoning
// ---------------------------------------------------------------------------

async function callDeepThink(
  question: string,
  context: string | undefined,
  LOVABLE_API_KEY: string,
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  console.log(`[DeepThink] Question: ${question.substring(0, 200)}`);

  try {
    const prompt = context
      ? `${question}\n\nAdditional context: ${context}`
      : question;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert botanist and plant pathologist. You reason carefully and thoroughly about plant care questions. Provide detailed, actionable advice. Be specific about symptoms, causes, and treatments. If multiple possibilities exist, list them in order of likelihood.

Keep your response concise but thorough — this will be spoken aloud in a voice call. Aim for 3-5 sentences of clear, practical advice.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 1.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DeepThink] API error: ${response.status}`, errText);
      return { success: false, error: `Deep think failed: ${response.status}` };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";
    const elapsed = Date.now() - startTime;
    console.log(`[DeepThink] Complete in ${elapsed}ms, ${answer.length} chars`);

    return { success: true, answer, model: "gemini-3-flash", latencyMs: elapsed };
  } catch (error) {
    console.error("[DeepThink] Error:", error);
    return { success: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Tool executor — same as call-session
// ---------------------------------------------------------------------------

async function executeTool(
  supabase: SupabaseClient,
  profileId: string,
  toolName: string,
  args: Record<string, unknown>,
  PERPLEXITY_API_KEY?: string,
  LOVABLE_API_KEY?: string,
): Promise<Record<string, unknown>> {
  console.log(`[DevProxy] Tool exec: ${toolName}`);

  switch (toolName) {
    case "research":
      if (!PERPLEXITY_API_KEY) return { success: false, error: "Research not configured" };
      return await callResearchAgent(args.query, PERPLEXITY_API_KEY);

    case "save_plant":
      return await savePlant(supabase, profileId, args);
    case "modify_plant":
      return await modifyPlant(supabase, profileId, args);
    case "delete_plant":
      return await deletePlant(supabase, profileId, args);
    case "create_reminder":
      return await createReminder(supabase, profileId, args);
    case "log_care_event":
      return await logCareEvent(supabase, profileId, args);
    case "save_user_insight":
      return await saveUserInsight(supabase, profileId, args);
    case "update_notification_preferences":
      return await updateNotificationPreferences(supabase, profileId, args);
    case "update_profile":
      return await updateProfile(supabase, profileId, args);

    case "find_stores": {
      if (!LOVABLE_API_KEY) return { success: false, error: "Store search not configured" };
      const { data: profile } = await supabase
        .from("profiles")
        .select("location")
        .eq("id", profileId)
        .single();
      return await callMapsShoppingAgent(
        args.product_query,
        args.store_type || "any",
        profile?.location,
        LOVABLE_API_KEY,
        PERPLEXITY_API_KEY,
      );
    }

    case "verify_store_inventory":
      if (!PERPLEXITY_API_KEY) return { success: false, error: "Verification not configured" };
      return await verifyStoreInventory(args.store_name, args.product, args.location, PERPLEXITY_API_KEY);

    case "deep_think":
      if (!LOVABLE_API_KEY) return { success: false, error: "Deep think not configured" };
      return await callDeepThink(
        args.question as string,
        args.context as string | undefined,
        LOVABLE_API_KEY,
      );

    case "delete_reminder":
      return await deleteReminder(supabase, profileId, args);

    case "identify_plant":
    case "diagnose_plant":
    case "analyze_environment": {
      if (!LOVABLE_API_KEY) return { success: false, error: "Vision analysis not configured" };
      const taskPrompts: Record<string, string> = {
        identify_plant: "You are a plant identification expert. Based on this description, identify the plant. Return JSON: { species, confidence (0-1), commonNames: [], careSummary }",
        diagnose_plant: "You are a plant pathologist. Based on this description, diagnose the issue. Return JSON: { diagnosis, severity (mild/moderate/severe), treatment, prevention }",
        analyze_environment: "You are a horticultural environment analyst. Based on this description, assess growing conditions. Return JSON: { lightLevel (low/medium/bright/direct), lightNotes, spaceAssessment, recommendations: [] }",
      };
      const prompt = (args.description as string) + (args.plant_species ? `\nPlant species: ${args.plant_species}` : "") + (args.context ? `\nContext: ${args.context}` : "");
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: taskPrompts[toolName] }, { role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || "";
      try { return { success: true, data: JSON.parse(text) }; } catch { return { success: true, data: text }; }
    }

    case "generate_visual_guide":
    case "analyze_video": {
      if (!LOVABLE_API_KEY) return { success: false, error: "Not configured" };
      const prompt = toolName === "generate_visual_guide"
        ? `Create a detailed text guide for: ${args.topic}${args.plant_species ? ` (${args.plant_species})` : ""}. Be specific and actionable.`
        : `Based on this observation: ${args.observation}\n\nQuestion: ${args.question || "What do you notice?"}\n\nProvide expert plant care analysis.`;
      return await callDeepThink(prompt, undefined, LOVABLE_API_KEY);
    }

    case "generate_image": {
      if (!LOVABLE_API_KEY) return { success: false, error: "Image generation not configured" };
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "dall-e-3", prompt: args.prompt, n: 1, size: "1024x1024" }),
      });
      const data = await resp.json();
      const imageUrl = data.data?.[0]?.url;
      return imageUrl ? { success: true, imageUrl } : { success: false, error: "No image generated" };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

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

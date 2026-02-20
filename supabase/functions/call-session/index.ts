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

async function validateAndGetProfile(
  supabase: SupabaseClient,
  initData: string,
  botToken: string,
): Promise<{ user: TelegramUser; profile: Profile } | null> {
  const authStart = Date.now();
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

  console.log(`[CallSession] Auth: resolved profile_id=${profile.id}, display_name="${profile.display_name || "none"}", location="${profile.location || "none"}" (${Date.now() - dbStart}ms)`);
  return { user, profile };
}

// ---------------------------------------------------------------------------
// Voice tool declarations (Gemini function-calling format)
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
        description:
          "Update plant details. Supports bulk: 'all', 'all plants in the bedroom', etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: {
              type: "STRING",
              description: "Plant name or bulk pattern",
            },
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
        description:
          "Remove plants from collection. For bulk, confirm via voice first.",
        parameters: {
          type: "OBJECT",
          properties: {
            plant_identifier: {
              type: "STRING",
              description: "Plant name or bulk pattern",
            },
            user_confirmed: {
              type: "BOOLEAN",
              description: "True only after explicit voice confirmation",
            },
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
            plant_identifier: {
              type: "STRING",
              description: "Plant name or bulk pattern",
            },
            reminder_type: {
              type: "STRING",
              description:
                "water, fertilize, repot, rotate, check, prune, mist",
            },
            frequency_days: {
              type: "INTEGER",
              description: "Days between reminders",
            },
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
            plant_identifier: {
              type: "STRING",
              description: "Plant name or bulk pattern",
            },
            event_type: {
              type: "STRING",
              description:
                "water, fertilize, repot, prune, mist, rotate, treat",
            },
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
            insight_key: {
              type: "STRING",
              description:
                "Category: has_pets, pet_type, home_lighting, watering_style, experience_level, plant_goals, etc.",
            },
            insight_value: {
              type: "STRING",
              description: "The fact to remember",
            },
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
            topic: {
              type: "STRING",
              description:
                "care_reminders, observations, seasonal_tips, health_followups, or all",
            },
            action: {
              type: "STRING",
              description: "enable, disable, or set_frequency",
            },
            notification_frequency: {
              type: "STRING",
              description: "off, daily, weekly, realtime",
            },
          },
          required: ["topic", "action"],
        },
      },
      {
        name: "update_profile",
        description:
          "Update user profile fields like name, location, experience level",
        parameters: {
          type: "OBJECT",
          properties: {
            field: {
              type: "STRING",
              description:
                "display_name, location, experience_level, primary_concerns, personality, pets, timezone",
            },
            value: {
              type: "STRING",
              description: "The new value",
            },
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
            product_query: {
              type: "STRING",
              description: "What to look for",
            },
            store_type: {
              type: "STRING",
              description: "nursery, garden_center, hardware_store, or any",
            },
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
            store_name: {
              type: "STRING",
              description: "Full store name with location",
            },
            product: {
              type: "STRING",
              description: "Product to check",
            },
            location: {
              type: "STRING",
              description: "City or ZIP",
            },
          },
          required: ["store_name", "product", "location"],
        },
      },
      {
        name: "show_visual",
        description:
          "Display a visual formation on the pixel canvas during the call. Use this to show plant silhouettes, tool images, text messages, lists, or icons. The pixels will animate from their current shape to the new formation. Available formations include 82 plant species and 37 gardening tools from the asset library, plus dynamic text, lists, and icons.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: {
              type: "STRING",
              description:
                "Formation type: 'template' for plant/tool art, 'text' for pixel text, 'list' for numbered items",
            },
            id: {
              type: "STRING",
              description:
                "Template ID for type='template'. Examples: 'monstera_deliciosa', 'watering_can', 'phalaenopsis_orchid'. Use the closest match to what you're discussing.",
            },
            text: {
              type: "STRING",
              description:
                "Text to display for type='text'. Keep SHORT — max ~11 chars per line, ~10 lines. All caps recommended.",
            },
            items: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "List items for type='list'. Max 5 items, keep each SHORT.",
            },
            transition: {
              type: "STRING",
              description:
                "Animation style: 'morph' (smooth curves, default), 'dissolve' (fade), 'scatter' (explode+reform), 'ripple' (wave from center)",
            },
            hold: {
              type: "INTEGER",
              description:
                "Seconds to hold formation before returning to orchid. 0 = stay until next show_visual. Default: 8",
            },
          },
          required: ["type"],
        },
      },
      {
        name: "annotate_view",
        description: "Draw pixel-art annotations on the user's camera feed. Use when video is active to point out features — leaf damage, pests, good placement spots, soil issues. Places markers on a 3x3 grid.",
        parameters: {
          type: "OBJECT",
          properties: {
            markers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  region: { type: "STRING", description: "Grid region: TL, TC, TR, ML, MC, MR, BL, BC, BR" },
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
      {
        name: "deep_think",
        description:
          "Route a complex question to a smarter model for deeper reasoning. Use this for plant diagnosis, treatment plans, complex care questions, or anything requiring careful analysis. The response will be thorough and expert-level.",
        behavior: "NON_BLOCKING",
        parameters: {
          type: "OBJECT",
          properties: {
            question: {
              type: "STRING",
              description:
                "The full question to reason about, including all relevant context from the conversation",
            },
            context: {
              type: "STRING",
              description:
                "Additional context: plant species, symptoms, environment, user history — anything relevant",
            },
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
// Tool executor
// ---------------------------------------------------------------------------

async function executeTool(
  supabase: SupabaseClient,
  profileId: string,
  toolName: string,
  args: Record<string, unknown>,
  PERPLEXITY_API_KEY?: string,
  LOVABLE_API_KEY?: string,
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  console.log(`[CallSession] Tool exec: ${toolName}, args=${JSON.stringify(args).substring(0, 500)}`);

  let result: Record<string, unknown>;

  switch (toolName) {
    case "research":
      if (!PERPLEXITY_API_KEY)
        result = { success: false, error: "Research not configured" };
      else
        result = await callResearchAgent(args.query, PERPLEXITY_API_KEY);
      break;

    case "save_plant":
      result = await savePlant(supabase, profileId, args);
      break;

    case "modify_plant":
      result = await modifyPlant(supabase, profileId, args);
      break;

    case "delete_plant":
      result = await deletePlant(supabase, profileId, args);
      break;

    case "create_reminder":
      result = await createReminder(supabase, profileId, args);
      break;

    case "log_care_event":
      result = await logCareEvent(supabase, profileId, args);
      break;

    case "save_user_insight":
      result = await saveUserInsight(supabase, profileId, args);
      break;

    case "update_notification_preferences":
      result = await updateNotificationPreferences(supabase, profileId, args);
      break;

    case "update_profile":
      result = await updateProfile(supabase, profileId, args);
      break;

    case "find_stores": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Store search not configured" };
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("location")
          .eq("id", profileId)
          .single();
        result = await callMapsShoppingAgent(
          args.product_query,
          args.store_type || "any",
          profile?.location,
          LOVABLE_API_KEY,
          PERPLEXITY_API_KEY,
        );
      }
      break;
    }

    case "verify_store_inventory":
      if (!PERPLEXITY_API_KEY) {
        result = { success: false, error: "Verification not configured" };
      } else {
        result = await verifyStoreInventory(
          args.store_name,
          args.product,
          args.location,
          PERPLEXITY_API_KEY,
        );
      }
      break;

    case "deep_think":
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Deep think not configured" };
      } else {
        result = await callDeepThink(
          args.question as string,
          args.context as string | undefined,
          LOVABLE_API_KEY,
        );
      }
      break;

    case "delete_reminder":
      result = await deleteReminder(supabase, profileId, args);
      break;

    case "identify_plant":
    case "diagnose_plant":
    case "analyze_environment": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Vision analysis not configured" };
      } else {
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
        try { result = { success: true, data: JSON.parse(text) }; } catch { result = { success: true, data: text }; }
      }
      break;
    }

    case "generate_visual_guide":
    case "analyze_video": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Not configured" };
      } else {
        const prompt = toolName === "generate_visual_guide"
          ? `Create a detailed text guide for: ${args.topic}${args.plant_species ? ` (${args.plant_species})` : ""}. Be specific and actionable.`
          : `Based on this observation: ${args.observation}\n\nQuestion: ${args.question || "What do you notice?"}\n\nProvide expert plant care analysis.`;
        result = await callDeepThink(prompt, undefined, LOVABLE_API_KEY);
      }
      break;
    }

    case "generate_image": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Image generation not configured" };
      } else {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "dall-e-3", prompt: args.prompt, n: 1, size: "1024x1024" }),
        });
        const data = await resp.json();
        const imageUrl = data.data?.[0]?.url;
        result = imageUrl ? { success: true, imageUrl } : { success: false, error: "No image generated" };
      }
      break;
    }

    default:
      result = { success: false, error: `Unknown tool: ${toolName}` };
  }

  const elapsed = Date.now() - startTime;
  const resultStr = JSON.stringify(result).substring(0, 300);
  console.log(`[CallSession] Tool ${toolName} completed in ${elapsed}ms, result=${resultStr}`);
  return result;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCreate(
  supabase: SupabaseClient,
  body: CreateBody,
  botToken: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /create: body keys=${Object.keys(body).join(",")}, initData present=${!!body.initData}`);

  const { initData } = body;
  if (!initData) {
    console.error("[CallSession] /create: REJECTED — missing initData");
    return json({ error: "Missing initData" }, 400);
  }

  const result = await validateAndGetProfile(supabase, initData, botToken);
  if (!result) {
    console.error(`[CallSession] /create: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid initData or profile not found" }, 401);
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
  botToken: string,
  geminiApiKey: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /token: sessionId=${body.sessionId}, initData present=${!!body.initData}`);

  const { sessionId, initData } = body;
  if (!sessionId || !initData) {
    console.error("[CallSession] /token: REJECTED — missing sessionId or initData");
    return json({ error: "Missing sessionId or initData" }, 400);
  }

  // Validate initData and resolve profile
  const result = await validateAndGetProfile(supabase, initData, botToken);
  if (!result) {
    console.error(`[CallSession] /token: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid initData or profile not found" }, 401);
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
  const voice = session.voice || "Aoede";
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
  botToken: string,
  perplexityApiKey?: string,
  lovableApiKey?: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /tools: toolName=${body.toolName}, sessionId=${body.sessionId}, callId=${body.toolCallId}, args=${JSON.stringify(body.toolArgs || {}).substring(0, 300)}`);

  const { sessionId, initData, toolName, toolArgs, toolCallId } = body;
  if (!sessionId || !initData || !toolName) {
    console.error(`[CallSession] /tools: REJECTED — missing fields: sessionId=${!!sessionId}, initData=${!!initData}, toolName=${!!toolName}`);
    return json({ error: "Missing sessionId, initData, or toolName" }, 400);
  }

  // Validate initData and resolve profile
  const result = await validateAndGetProfile(supabase, initData, botToken);
  if (!result) {
    console.error(`[CallSession] /tools: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid initData or profile not found" }, 401);
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
  botToken: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /end: sessionId=${body.sessionId}, durationSeconds=${body.durationSeconds}`);

  const { sessionId, initData, durationSeconds } = body;
  if (!sessionId || !initData) {
    console.error(`[CallSession] /end: REJECTED — missing fields: sessionId=${!!sessionId}, initData=${!!initData}`);
    return json({ error: "Missing sessionId or initData" }, 400);
  }

  // Validate initData and resolve profile
  const result = await validateAndGetProfile(supabase, initData, botToken);
  if (!result) {
    console.error(`[CallSession] /end: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid initData or profile not found" }, 401);
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

    let response: Response;

    switch (path) {
      case "create":
        response = await handleCreate(supabase, body as CreateBody, TELEGRAM_BOT_TOKEN);
        break;
      case "token":
        response = await handleToken(
          supabase,
          body as TokenBody,
          TELEGRAM_BOT_TOKEN,
          GEMINI_API_KEY!,
        );
        break;
      case "tools":
        response = await handleTools(
          supabase,
          body as ToolsBody,
          TELEGRAM_BOT_TOKEN,
          PERPLEXITY_API_KEY,
          LOVABLE_API_KEY,
        );
        break;
      case "end":
        response = await handleEnd(supabase, body as EndBody, TELEGRAM_BOT_TOKEN);
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

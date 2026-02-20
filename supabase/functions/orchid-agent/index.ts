import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Pure JavaScript image resizer - no WASM required
import { resize } from "https://deno.land/x/deno_image@0.0.4/mod.ts";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

// Shared modules
import { resolvePlants, savePlant, modifyPlant, deletePlant, createReminder, deleteReminder, logCareEvent, saveUserInsight, updateNotificationPreferences, updateProfile, checkAgentPermission, TOOL_CAPABILITY_MAP } from "../_shared/tools.ts";
import { callResearchAgent, callMapsShoppingAgent, verifyStoreInventory, parseDistance } from "../_shared/research.ts";
import { loadHierarchicalContext, buildEnrichedSystemPrompt, formatTimeUntil, formatTimeSince, formatTimeAgo, formatInsightKey } from "../_shared/context.ts";
import type { HierarchicalContext, PlantResolutionResult, StoreRecommendation, StoreSearchResult, StoreVerification } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// MEDIA PROCESSING CONFIGURATION
// ============================================
const MEDIA_CONFIG = {
  // Master toggle for all media resizing
  RESIZE_MEDIA: true,  // Set to false to disable all resizing
  
  // Image settings (only apply when RESIZE_MEDIA = true)
  IMAGE_MAX_DIMENSION: 1536,  // Max pixels on longest edge
  IMAGE_QUALITY: 85,          // JPEG quality (1-100) - note: deno_image outputs JPEG
  
  // Video settings
  VIDEO_MAX_SIZE_MB: 5,       // Warn if video exceeds this
};

// ============================================
// IMAGE RESIZING FOR VISION (Pure JS - no WASM)
// ============================================
interface ResizedImageResult {
  base64: string;
  mimeType: string;
  originalBytes: number;
  resizedBytes: number;
  dimensions: { width: number; height: number };
  wasResized: boolean;
}

/**
 * Helper to convert Uint8Array to base64 in chunks (avoids stack overflow)
 */
function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Resize image for vision API using pure JavaScript (deno_image)
 * Works reliably in Deno Edge Runtime without WASM
 */
async function resizeImageForVision(
  imageData: Uint8Array,
  originalMimeType: string
): Promise<ResizedImageResult> {
  const originalBytes = imageData.length;
  
  // If resizing disabled, return original as base64
  if (!MEDIA_CONFIG.RESIZE_MEDIA) {
    const base64 = uint8ArrayToBase64(imageData);
    return {
      base64,
      mimeType: originalMimeType,
      originalBytes,
      resizedBytes: originalBytes,
      dimensions: { width: 0, height: 0 },
      wasResized: false,
    };
  }
  
  try {
    const maxDim = MEDIA_CONFIG.IMAGE_MAX_DIMENSION;
    
    // Use deno_image to resize - it handles both JPG and PNG
    // It maintains aspect ratio by default and outputs JPEG
    const resizedData = await resize(imageData, {
      width: maxDim,
      height: maxDim,
      aspectRatio: true, // Maintain aspect ratio
    });
    
    const wasResized = resizedData.length < originalBytes;
    const base64 = uint8ArrayToBase64(resizedData);
    
    if (wasResized) {
      const savings = ((1 - resizedData.length / originalBytes) * 100).toFixed(1);
      console.log(`[MediaProcessing] Image optimized: ${originalBytes} -> ${resizedData.length} bytes (${savings}% reduction)`);
    } else {
      console.log(`[MediaProcessing] Image already optimal size: ${originalBytes} bytes`);
    }
    
    return {
      base64,
      mimeType: "image/jpeg", // deno_image outputs JPEG
      originalBytes,
      resizedBytes: resizedData.length,
      dimensions: { width: maxDim, height: maxDim }, // Approximate - actual size respects aspect ratio
      wasResized,
    };
  } catch (err) {
    // Fallback: return original if resize fails
    console.error("[MediaProcessing] Resize failed, using original:", err);
    const base64 = uint8ArrayToBase64(imageData);
    return {
      base64,
      mimeType: originalMimeType,
      originalBytes,
      resizedBytes: originalBytes,
      dimensions: { width: 0, height: 0 },
      wasResized: false,
    };
  }
}

// ============================================================================
// MESSAGING SANITIZATION UTILITIES
// ============================================================================

/**
 * Sanitize raw text (especially from research/Perplexity) for messaging apps.
 * Strips markdown tables, headers, citations, and excessive formatting.
 */
function sanitizeForMessaging(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // Remove citation brackets like [1], [2][3], etc.
  text = text.replace(/\[\d+\](\[\d+\])*/g, "");

  // Convert markdown headers to plain text with line breaks
  text = text.replace(/^###\s*/gm, "");
  text = text.replace(/^##\s*/gm, "");
  text = text.replace(/^#\s*/gm, "");

  // Remove markdown table syntax completely
  // First, remove separator lines (|---|---|)
  text = text.replace(/^\|[-:\s|]+\|$/gm, "");

  // Convert table rows to readable format
  text = text.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content
      .split("|")
      .map((c: string) => c.trim())
      .filter((c: string) => c);
    if (cells.length === 0) return "";
    // Skip if it looks like a header row that was already processed
    if (cells.every((c: string) => c.match(/^[-:]+$/))) return "";
    return cells.join(" - ");
  });

  // Remove bold/italic markdown (keep the text)
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // Convert bullet points to simple dashes
  text = text.replace(/^[•●]\s*/gm, "- ");

  // Clean up multiple newlines (max 2)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Clean up multiple spaces
  text = text.replace(/  +/g, " ");

  // Trim each line
  text = text
    .split("\n")
    .map((line: string) => line.trim())
    .join("\n");

  // Final trim
  text = text.trim();

  return text;
}

/**
 * Rewrite complex research output into conversational messaging format.
 * Uses a fast LLM to make it sound like a friend texting.
 */
async function rewriteResearchForMessaging(
  rawResearch: string,
  userQuery: string,
  personality: string,
  LOVABLE_API_KEY: string,
): Promise<string> {
  // First sanitize the obvious stuff
  const sanitized = sanitizeForMessaging(rawResearch);

  // If it's already short and looks conversational, just return it
  if (
    sanitized.length < 400 &&
    !sanitized.includes("|") &&
    !sanitized.includes("Retailer") &&
    !sanitized.includes("Price")
  ) {
    return sanitized;
  }

  // Use a quick LLM call to make it conversational
  try {
    console.log(`[RewriteForMessaging] Rewriting ${sanitized.length} chars of research...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        thinking_config: { thinking_level: "minimal" },
        messages: [
          {
            role: "system",
            content: `You are a ${personality || "warm"} plant expert named Orchid texting a friend.

TASK: Rewrite this research into a friendly, conversational text message.

RULES:
- NO markdown formatting (no #, **, |tables|, bullet lists)
- NO citation numbers like [1] or [2][3]
- Keep it under 250 words - be concise
- Sound like a knowledgeable friend texting, not a research paper or Wikipedia
- Focus on the most actionable/relevant info
- Use natural line breaks between topics (not bullet points)
- Light emoji usage is OK (1-2 max)
- For products: mention 1-2 best options with rough prices, not exhaustive lists
- If multiple retailers: pick the top 2-3, don't list every option`,
          },
          {
            role: "user",
            content: `User asked: "${userQuery}"\n\nResearch data to rewrite:\n${sanitized.slice(0, 2000)}`, // Limit input
          },
        ],
        max_tokens: 350,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const rewritten = data.choices?.[0]?.message?.content;
      if (rewritten && rewritten.length > 50) {
        console.log(`[RewriteForMessaging] Successfully rewrote to ${rewritten.length} chars`);
        return rewritten;
      }
    } else {
      console.error(`[RewriteForMessaging] LLM call failed: ${response.status}`);
    }
  } catch (e) {
    console.error("[RewriteForMessaging] Error:", e);
  }

  // Fallback to sanitized version
  return sanitized;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

// Agent Tools - spawn sub-LLM for complex analysis
const agentTools = [
  {
    type: "function",
    function: {
      name: "identify_plant",
      description:
        "Identify plant species from user's photo. Call this when user sends a plant image and wants to know what it is.",
      parameters: {
        type: "object",
        properties: {
          user_context: { type: "string", description: "Any additional context from user's message" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "diagnose_plant",
      description:
        "Diagnose health issues from a plant photo. Call when user mentions problems (yellow leaves, wilting, spots, pests, etc.) or asks 'what's wrong'.",
      parameters: {
        type: "object",
        properties: {
          symptoms_described: { type: "string", description: "Symptoms mentioned by user" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_environment",
      description:
        "Analyze growing environment from a photo. Call when user asks about placement, light levels, or shows their plant's location.",
      parameters: {
        type: "object",
        properties: {
          plant_species: { type: "string", description: "Species if known, for tailored advice" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research",
      description: `Search the web for current, accurate plant information. USE THIS TOOL WHEN:
- User asks about specific plant diseases, pests, or treatments
- You're less than 80% confident in your answer
- Topic involves products, brands, or availability
- Question relates to events or discoveries after January 2025
- User asks about pet toxicity (critical accuracy needed)
- Specific cultivar or hybrid questions
- User shares a URL and wants analysis, fact-checking, or product evaluation
- Verifying claims from external sources
DO NOT USE for basic care questions you're confident about.

TIP: If user shares a URL, include it in your query for context.`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query. Include any URLs the user shared for context." },
          focus: {
            type: "string",
            enum: ["general", "product", "toxicity", "article_analysis", "fact_check"],
            description: "Focus of the research to improve accuracy",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_visual_guide",
      description:
        "Generate step-by-step visual images to help user with plant care tasks. Use when user asks HOW to do something: propagation, repotting, pruning, treating pests, making soil mix, taking cuttings, etc. Creates 2-4 instructional images.",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description:
              "The plant care task to illustrate (e.g., 'propagate pothos in water', 'repot root-bound monstera', 'prune leggy philodendron')",
          },
          plant_species: {
            type: "string",
            description: "The specific plant if known",
          },
          step_count: {
            type: "number",
            description: "Number of steps to generate (2-4 recommended). Default 3.",
          },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_video",
      description:
        "Analyze a video sent by the user. Use when user sends a video showing their plant, watering routine, pest movement, growth progress, or any plant-related footage. Can reference specific timestamps.",
      parameters: {
        type: "object",
        properties: {
          analysis_focus: {
            type: "string",
            enum: ["general_assessment", "diagnose_problem", "evaluate_technique", "track_movement"],
            description:
              "What to focus on: general_assessment (overall health), diagnose_problem (find issues), evaluate_technique (critique their care method), track_movement (pest/growth tracking)",
          },
          specific_question: {
            type: "string",
            description: "Any specific question the user asked about the video",
          },
        },
        required: ["analysis_focus"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transcribe_voice",
      description:
        "Transcribe and understand a voice note sent by the user. This is automatically called when user sends an audio message, but can also be manually triggered if needed.",
      parameters: {
        type: "object",
        properties: {
          context: {
            type: "string",
            description: "Any text context accompanying the voice note",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_stores",
      description: `Find SPECIFIC local stores for plant supplies. MUST be called when user asks WHERE to buy something.

Returns: Full store names with location identifiers, exact addresses, distances from user's location.

IMPORTANT: Call this BEFORE verify_store_inventory to get specific store details.`,
      parameters: {
        type: "object",
        properties: {
          product_query: {
            type: "string",
            description: "What the user is looking for (e.g., 'rooting powder', 'orchid bark', 'neem oil')",
          },
          store_type: {
            type: "string",
            enum: ["nursery", "garden_center", "hardware_store", "any"],
            description: "Type of store to prioritize. Default: any",
          },
          max_results: {
            type: "number",
            description: "Number of stores to return (default 3)",
          },
        },
        required: ["product_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_store_inventory",
      description: `Verify if a SPECIFIC store (with location) carries a product. Call AFTER find_stores.

Returns: Stock status, confidence level, specific department/aisle, brand recommendations, and alternatives.

Use this to confirm availability before making strong recommendations.`,
      parameters: {
        type: "object",
        properties: {
          store_name: {
            type: "string",
            description:
              "FULL store name with location identifier (e.g., 'Ace Hardware - Fremont', 'Home Depot on Aurora Ave')",
          },
          product: {
            type: "string",
            description: "Product to verify availability for",
          },
          location: {
            type: "string",
            description: "City, neighborhood, or ZIP code",
          },
        },
        required: ["store_name", "product", "location"],
      },
    },
  },
];

// Function Tools - direct database operations
const functionTools = [
  {
    type: "function",
    function: {
      name: "save_plant",
      description:
        "Save a plant to user's collection for tracking. Use when user says 'save', 'add to collection', 'track', or 'remember this plant'.",
      parameters: {
        type: "object",
        properties: {
          species: { type: "string", description: "Plant species name" },
          nickname: { type: "string", description: "Optional nickname for the plant" },
          location: { type: "string", description: "Location in home if mentioned" },
          notes: { type: "string", description: "Any additional notes" },
        },
        required: ["species"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_plant",
      description: `Update plant details. Supports BULK operations:
- Single plant: "my monstera" / "Planty" / plant nickname
- All plants: "all" / "all plants" / "all my plants"
- By location: "all plants in the bedroom" / "plants in the living room"
- By type: "all succulents" / "all ferns" / "all palms"

Use for updating nickname, location, or notes.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant name/nickname, 'all', 'all plants', 'all plants in [location]', or 'all [type]'",
          },
          updates: {
            type: "object",
            properties: {
              nickname: { type: "string" },
              location: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_plant",
      description: `Remove plants from collection. Supports BULK operations:
- Single plant: "my monstera" / "Planty"
- All plants: "all plants" (DANGEROUS - requires confirmation!)
- By location: "all plants in the bedroom"
- By type: "all succulents"

CRITICAL: For bulk deletes, you MUST list what will be deleted and ask for explicit user confirmation BEFORE calling with user_confirmed=true.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant name/nickname, 'all', 'all plants in [location]', or 'all [type]'",
          },
          user_confirmed: {
            type: "boolean",
            description: "Set to true ONLY after user explicitly confirms the deletion. Required for bulk deletes.",
          },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: `Set up care reminders. Supports BULK operations:
- Single plant: "my monstera" / "Planty"
- All plants: "all" / "all plants"
- By location: "all plants in the bedroom"
- By type: "all succulents"

Use when user asks to be reminded to water, fertilize, repot, etc.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant name/nickname, 'all', 'all plants in [location]', or 'all [type]'",
          },
          reminder_type: {
            type: "string",
            enum: ["water", "fertilize", "repot", "rotate", "check", "prune", "mist"],
            description: "Type of care reminder",
          },
          frequency_days: { type: "integer", description: "Days between reminders" },
          notes: { type: "string", description: "Optional notes for the reminder" },
        },
        required: ["plant_identifier", "reminder_type", "frequency_days"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description: "Deactivate/remove care reminders. Supports bulk: 'all', 'all plants in the bedroom', etc.",
      parameters: {
        type: "object",
        properties: {
          plant_identifier: { type: "string", description: "Plant name or bulk pattern" },
          reminder_type: { type: "string", description: "Optional filter: water, fertilize, repot, rotate, check, prune, mist. Omit to delete all reminders for the plant." },
        },
        required: ["plant_identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_care_event",
      description: `Log a care activity (watering, fertilizing, etc.). Supports BULK operations:
- Single plant: "my monstera" / "Planty"
- All plants: "all" / "all plants" / "everything"
- By location: "all plants in the bedroom" / "bedroom plants"
- By type: "all succulents"

Use when user says they just watered, fertilized, repotted, etc.`,
      parameters: {
        type: "object",
        properties: {
          plant_identifier: {
            type: "string",
            description: "Plant name/nickname, 'all', 'all plants in [location]', or 'all [type]'",
          },
          event_type: {
            type: "string",
            enum: ["water", "fertilize", "repot", "prune", "mist", "rotate", "treat"],
            description: "Type of care performed",
          },
          notes: { type: "string", description: "Optional notes about the care" },
        },
        required: ["plant_identifier", "event_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_user_insight",
      description: `Save an important fact learned about the user for future reference. Use this when you learn something that will help personalize future advice, such as:
- They have pets (cats, dogs) - important for toxicity warnings
- Their home lighting conditions (bright, low light, south-facing windows)
- Their watering tendencies (overwaterer, underwaterer, forgetful)
- Experience level (beginner, experienced)
- Plant goals (collection, specific plants, aesthetic)
- Climate/environment (dry apartment, humid bathroom)
- Past problems (recurring pests, root rot history)`,
      parameters: {
        type: "object",
        properties: {
          insight_key: {
            type: "string",
            enum: [
              "has_pets",
              "pet_type",
              "home_lighting",
              "watering_style",
              "experience_level",
              "plant_goals",
              "problem_patterns",
              "home_humidity",
              "climate_zone",
              "window_orientation",
              "plant_preferences",
              "allergy_concerns",
              "child_safety",
              // Communication preferences
              "comm_pref_brevity",
              "comm_pref_tone",
              "comm_pref_humor",
              "comm_pref_emoji_usage",
              "comm_pref_formality",
              "comm_pref_detail_level",
            ],
            description: "Category of the insight",
          },
          insight_value: { type: "string", description: "The actual insight to remember" },
        },
        required: ["insight_key", "insight_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_notification_preferences",
      description: `Update user's proactive message preferences. Use when user says things like:
- "stop sending reminders" / "turn off tips" → disable that topic
- "message me weekly" / "daily updates" → set notification_frequency (updates profile)
- "don't text after 10pm" / "quiet hours" → set quiet hours
- "send me reminders again" → re-enable topic

Topics: care_reminders (watering/fertilizing), observations (check-ins about inactive plants), seasonal_tips (seasonal advice), health_followups (follow-up on diagnosed issues)`,
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["care_reminders", "observations", "seasonal_tips", "health_followups", "all"],
            description: "Which type of proactive message to update, or 'all' for all topics",
          },
          action: {
            type: "string",
            enum: ["enable", "disable", "set_frequency"],
            description: "What to do: enable/disable the topic, or set notification frequency",
          },
          notification_frequency: {
            type: "string",
            enum: ["off", "daily", "weekly", "realtime"],
            description: "How often to send messages (only for set_frequency action). Updates profile-level setting.",
          },
          quiet_hours_start: {
            type: "string",
            description: "Time to stop sending messages (HH:MM format, e.g., '22:00')",
          },
          quiet_hours_end: {
            type: "string",
            description: "Time to resume sending messages (HH:MM format, e.g., '08:00')",
          },
        },
        required: ["topic", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: `Update a core profile field for the user. Use this when the user shares personal info that affects how you help them — location, name, experience level, pets, etc. Do NOT ask for extra confirmation: if the user tells you their zip code or says "I have a cat", that IS their consent.

Examples:
- User says "I'm in 94105" → update_profile({field: "location", value: "94105"})
- User says "Call me Mia" → update_profile({field: "display_name", value: "Mia"})
- User says "I have two cats" → update_profile({field: "pets", value: "cat"})
- User says "I'm pretty new to plants" → update_profile({field: "experience_level", value: "beginner"})

After updating, immediately continue with the user's original request (e.g., after saving location, proceed to find_stores).`,
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["display_name", "location", "experience_level", "primary_concerns", "personality", "pets", "timezone"],
            description: "Which profile field to update",
          },
          value: {
            type: "string",
            description: "The new value for the field",
          },
        },
        required: ["field", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_think",
      description: "Route a complex question to a smarter model for deeper reasoning. Use for diagnosis, treatment plans, complex care questions.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The full question with all relevant context" },
          context: { type: "string", description: "Additional context: plant species, symptoms, environment" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image based on a text description. Use for visual guides, plant illustrations, or care diagrams.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed description of the image to generate" },
        },
        required: ["prompt"],
      },
    },
  },
];

// Combine all tools
const allTools = [...agentTools, ...functionTools];

// ============================================================================
// AGENT IMPLEMENTATIONS (Sub-LLM calls)
// ============================================================================

async function callVisionAgent(
  task: "identify" | "diagnose" | "environment",
  base64Image: string,
  context: string,
  LOVABLE_API_KEY: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const prompts = {
    identify: `You are a plant identification expert. Analyze this image and identify the plant.
Return ONLY valid JSON with this structure:
{
  "species": "Scientific name (Common name)",
  "confidence": 0.0-1.0,
  "commonNames": ["name1", "name2"],
  "careSummary": "Brief 2-3 sentence care overview"
}`,
    diagnose: `You are a plant pathologist. Analyze this image for health issues.
Return ONLY valid JSON with this structure:
{
  "diagnosis": "Primary issue identified",
  "severity": "mild|moderate|severe",
  "treatment": "Recommended treatment steps",
  "prevention": "How to prevent in future"
}
If the plant looks healthy, set diagnosis to "healthy" and severity to "none".`,
    environment: `You are a horticultural environment analyst. Assess the growing conditions shown.
Return ONLY valid JSON with this structure:
{
  "lightLevel": "low|medium|bright|direct",
  "lightNotes": "Observations about the lighting",
  "spaceAssessment": "Assessment of space for plant growth",
  "recommendations": ["suggestion1", "suggestion2"]
}`,
  };

  const buildFallback = (rawText: string, reason: string) => {
    const safeText = (rawText || "").trim();
    const hint =
      safeText ||
      "I couldn't get a clear read from that photo. Try sending a brighter, closer shot of the leaves (and one of the whole plant).";

    if (task === "identify") {
      return {
        success: true,
        data: {
          species: "Unknown plant",
          confidence: 0,
          commonNames: [],
          careSummary: hint,
          _fallback_reason: reason,
        },
      };
    }
    if (task === "diagnose") {
      return {
        success: true,
        data: {
          diagnosis: "Unable to determine",
          severity: "unknown",
          treatment: hint,
          prevention: "Monitor the plant closely and send a clearer close-up of the affected area.",
          _fallback_reason: reason,
        },
      };
    }
    return {
      success: true,
      data: {
        lightLevel: "unknown",
        lightNotes: hint,
        spaceAssessment: "Unable to determine from this photo.",
        recommendations: ["Try sending a photo showing the plant, the nearest window, and the light source."],
        _fallback_reason: reason,
      },
    };
  };

  const extractContent = (payload: any): string => {
    console.log(`[extractContent] Full payload keys:`, Object.keys(payload || {}));

    const choice = payload?.choices?.[0];
    const paths = [
      { name: "choice.message.content", value: choice?.message?.content },
      { name: "choice.message.text", value: choice?.message?.text },
      { name: "choice.text", value: choice?.text },
      { name: "choice.delta.content", value: choice?.delta?.content },
    ];

    const maybe = choice?.message?.content ?? choice?.message?.text ?? choice?.text ?? choice?.delta?.content ?? "";

    if (typeof maybe === "string") {
      return maybe;
    }
    if (Array.isArray(maybe)) {
      return maybe
        .map((p: any) => {
          if (typeof p === "string") return p;
          if (typeof p?.text === "string") return p.text;
          if (typeof p?.content === "string") return p.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  };

  try {
    const modelsToTry = ["google/gemini-3-pro-preview", "google/gemini-2.5-pro"];
    let data: any = null;
    let content = "";

    console.log(`[callVisionAgent] Starting ${task} analysis with image (${base64Image.length} base64 chars)`);

    for (const model of modelsToTry) {
      console.log(`[callVisionAgent] Trying model: ${model}`);

      const requestBody: any = {
        model,
        messages: [
          { role: "system", content: prompts[task] },
          {
            role: "user",
            content: [
              { type: "text", text: context || "Analyze this plant image." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        temperature: 1.0,
      };

      if (model.includes("gemini-3")) {
        requestBody.thinking_config = { thinking_level: "low" };
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[callVisionAgent] Vision model error for ${task} (${model}):`, response.status, errorText);
        continue;
      }

      const rawText = await response.text();

      try {
        data = JSON.parse(rawText);
      } catch (jsonErr) {
        console.error(`[callVisionAgent] Failed to parse response as JSON:`, jsonErr);
        continue;
      }

      if (data?.usage) {
        console.log(`[callVisionAgent] Token usage - total: ${data.usage.total_tokens}`);
      }

      content = extractContent(data);

      if ((!content || content.trim() === "") && data?.choices?.[0]?.message?.reasoning) {
        const reasoning = data.choices[0].message.reasoning;
        const speciesMatch = reasoning.match(/\*([A-Z][a-z]+ [a-z]+)\*/);
        if (speciesMatch && task === "identify") {
          content = JSON.stringify({
            species: speciesMatch[1],
            confidence: 0.7,
            commonNames: [],
            careSummary: "Based on the leaf patterns visible in the image.",
          });
        }
      }

      if (content && content.trim() !== "") {
        console.log(`[callVisionAgent] SUCCESS - Got content from ${model}`);
        break;
      }
    }

    if (!content || content.trim() === "") {
      return buildFallback("", "empty_after_retries");
    }

    let jsonStr = content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      console.log(`${task} analysis result:`, JSON.stringify(parsed));
      return { success: true, data: parsed };
    } catch (parseError) {
      console.error(`Failed to parse ${task} JSON. Raw content:`, content);
      return buildFallback(content, "parse_error");
    }
  } catch (error) {
    console.error(`Vision agent error for ${task}:`, error);
    return buildFallback("", "exception");
  }
}


// ============================================================================
// URL ANALYSIS AGENT
// ============================================================================

interface UrlAnalysis {
  url: string;
  title?: string;
  summary: string;
  keyPoints: string[];
  careInstructions?: string[];
  productEvaluation?: {
    recommended: boolean;
    pros: string[];
    cons: string[];
  };
  reliability: "high" | "medium" | "low" | "unknown";
  warnings?: string[];
}

async function callUrlAnalysisAgent(
  url: string,
  analysisType: string,
  userQuestion: string | null,
  LOVABLE_API_KEY: string,
): Promise<{ success: boolean; data?: UrlAnalysis; error?: string }> {
  try {
    console.log(`[UrlAgent] Analyzing URL: ${url} (type: ${analysisType})`);

    const prompts: Record<string, string> = {
      summarize: `Summarize this webpage. Focus on plant-related content. Extract key points, main recommendations, and any actionable advice.`,
      extract_care: `Extract all plant care instructions from this page. Create a structured summary with: watering, light, humidity, soil, fertilizing, and common issues sections.`,
      evaluate_product: `Evaluate this product for plant care. Consider: effectiveness based on ingredients/description, value, user reviews if visible, and whether you'd recommend it for plant care.`,
      fact_check: `Fact-check the plant care claims on this page. Note any outdated, incorrect, or misleading information based on current horticultural knowledge.`,
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        thinking_config: { thinking_level: "low" },
        messages: [
          {
            role: "system",
            content: `${prompts[analysisType] || prompts.summarize}

Return ONLY valid JSON with this structure:
{
  "url": "the analyzed URL",
  "title": "page title if found",
  "summary": "2-3 sentence overview",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "careInstructions": ["instruction 1", "instruction 2"] (only for extract_care),
  "productEvaluation": {"recommended": true/false, "pros": [...], "cons": [...]} (only for evaluate_product),
  "reliability": "high|medium|low|unknown",
  "warnings": ["any concerns about the information"] (optional)
}`,
          },
          {
            role: "user",
            content: userQuestion
              ? `Analyze this URL and answer: ${userQuestion}\n\nURL: ${url}`
              : `Analyze this URL: ${url}`,
          },
        ],
        tools: [
          {
            type: "url_context",
            url_context: { urls: [url] },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[UrlAgent] API error:", response.status, errorText);
      return { success: false, error: `URL analysis failed: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let analysis: UrlAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      analysis.url = url; // Ensure URL is set
    } catch {
      // Fallback structure
      analysis = {
        url,
        summary:
          content || "Unable to analyze this URL. The page may be inaccessible or have no plant-related content.",
        keyPoints: [],
        reliability: "unknown",
      };
    }

    console.log("[UrlAgent] Analysis complete:", analysis.summary?.substring(0, 100));
    return { success: true, data: analysis };
  } catch (error) {
    console.error("[UrlAgent] Error:", error);
    return { success: false, error: String(error) };
  }
}


// ============================================================================
// NEW MULTIMEDIA AGENTS
// ============================================================================

interface ImageGuideStep {
  step: number;
  description: string;
  imageUrl: string;
}

async function callImageGenerationAgent(
  supabase: any,
  profileId: string,
  task: string,
  plantSpecies: string | null,
  stepCount: number,
  LOVABLE_API_KEY: string,
  SUPABASE_URL: string,
): Promise<{ success: boolean; images?: ImageGuideStep[]; error?: string }> {
  try {
    console.log(`[ImageGenAgent] Generating ${stepCount}-step guide for: ${task} (PARALLEL)`);

    // Helper function to generate a single step
    // Build detailed, educational step prompts
    function buildDetailedStepPrompt(step: number): { prompt: string; stepTitle: string } {
      const species = plantSpecies || "the plant";

      // For propagation tasks
      if (task.toLowerCase().includes("propagat") || task.toLowerCase().includes("cutting")) {
        const propagationSteps: { [key: number]: { title: string; details: string } } = {
          1: {
            title: "GATHER & SANITIZE TOOLS",
            details: `Show: Clean sharp shears/scissors, rubbing alcohol or flame for sterilization, gloves (optional), clean water jar, rooting hormone (optional), well-draining potting mix, small pot.
            
MUST include text labels on the image:
- "STEP 1: GATHER & SANITIZE TOOLS"
- Arrow pointing to shears: "Sterilize with alcohol to prevent disease"
- Arrow pointing to gloves: "Protects hands from irritating sap"
- Show the ${species} plant clearly

Style: Watercolor botanical illustration, warm cream background, educational diagram with clear annotations.`,
          },
          2: {
            title: "MAKE THE CUT",
            details: `Show: Hands making a precise cut on ${species} stem.

MUST include text labels on the image:
- "STEP 2: MAKE THE CUT"
- Arrow showing WHERE to cut: "Cut 4-6 inches below a node at 45° angle"
- Circle/highlight the NODE: "Nodes are where roots will emerge"
- Arrow pointing to removed lower leaves: "Remove bottom 2-3 leaves"
- If applicable: "Let milky sap dry 30 min before planting"

Show the cutting clearly with visible nodes. Style: Watercolor botanical, hands performing action, educational annotations.`,
          },
          3: {
            title: "ROOT & CARE",
            details: `Show: The cutting being placed in water OR soil, with humidity cover.

MUST include text labels on the image:
- "STEP 3: ROOT & CARE"
- For water method: "Change water weekly, roots appear in 2-4 weeks"
- For soil method: "Keep soil moist but not soggy"
- Arrow pointing to humidity dome/bag: "Maintains 80%+ humidity for faster rooting"
- "Place in bright indirect light, no direct sun"
- "Pot up when roots are 2-3 inches long"

Style: Watercolor botanical illustration with care annotations.`,
          },
          4: {
            title: "TRANSPLANT",
            details: `Show: Rooted cutting being transplanted into a pot with fresh soil.

MUST include text labels on the image:
- "STEP 4: TRANSPLANT"
- "Wait for 2-3 inch roots before potting"
- Arrow to soil: "Use well-draining potting mix"
- "Keep soil consistently moist for first 2 weeks"
- "Gradually reduce humidity"

Style: Watercolor botanical illustration with educational annotations.`,
          },
        };

        const stepData = propagationSteps[step] || propagationSteps[Math.min(step, 3)];
        return { prompt: stepData.details, stepTitle: stepData.title };
      }

      // For repotting tasks
      if (task.toLowerCase().includes("repot")) {
        const repotSteps: { [key: number]: { title: string; details: string } } = {
          1: {
            title: "PREPARE MATERIALS",
            details: `Show: New pot (1-2" larger), fresh soil mix, drainage material, trowel, watering can.
            
MUST include labels:
- "STEP 1: PREPARE"
- "New pot should be 1-2 inches larger"
- "Ensure drainage holes"
- "Use appropriate soil mix for ${species}"

Style: Watercolor botanical illustration with educational labels.`,
          },
          2: {
            title: "REMOVE & INSPECT ROOTS",
            details: `Show: Plant being gently removed, root ball inspection.

MUST include labels:
- "STEP 2: REMOVE & INSPECT"
- "Gently loosen roots if root-bound"
- "Trim any dead/rotting roots"
- "Healthy roots are white/tan, firm"

Style: Watercolor botanical, show root detail with annotations.`,
          },
          3: {
            title: "REPLANT & WATER",
            details: `Show: Plant being placed in new pot, proper soil level.

MUST include labels:
- "STEP 3: REPLANT"
- "Keep same soil depth as before"
- "Firm soil gently, no air pockets"
- "Water thoroughly until draining"
- "Wait 1-2 weeks before fertilizing"

Style: Watercolor botanical with care annotations.`,
          },
        };

        const stepData = repotSteps[step] || repotSteps[Math.min(step, 3)];
        return { prompt: stepData.details, stepTitle: stepData.title };
      }

      // Generic task fallback with rich detail
      const genericSteps: { [key: number]: { title: string; details: string } } = {
        1: {
          title: "PREPARATION",
          details: `Show preparation for "${task}" with ${species}.
          
MUST include labels:
- "STEP 1: PREPARATION"
- Label all tools needed with purpose
- Show the plant's current state
- Include any safety notes

Style: Watercolor botanical illustration, educational diagram with annotations.`,
        },
        2: {
          title: "MAIN ACTION",
          details: `Show the main action for "${task}" with ${species}.
          
MUST include labels:
- "STEP 2: MAIN ACTION"  
- Show exactly what to do
- Label the "why" behind the technique
- Include timing/frequency if relevant

Style: Watercolor botanical with hands performing action, clear labels.`,
        },
        3: {
          title: "AFTERCARE",
          details: `Show aftercare for "${task}" with ${species}.

MUST include labels:
- "STEP 3: AFTERCARE"
- Recovery expectations and timeline
- Ongoing care requirements
- Signs of success to look for

Style: Watercolor botanical illustration with care annotations.`,
        },
      };

      const stepData = genericSteps[step] || genericSteps[Math.min(step, 3)];
      return { prompt: stepData.details, stepTitle: stepData.title };
    }

    async function generateStep(step: number): Promise<ImageGuideStep | null> {
      const { prompt: detailedPrompt, stepTitle } = buildDetailedStepPrompt(step);

      const stepPrompt = `Create an educational botanical illustration for:
"${task}"${plantSpecies ? ` with ${plantSpecies}` : ""}

${detailedPrompt}

CRITICAL REQUIREMENTS:
1. Include clear text labels and arrows ON the image explaining WHY each action matters
2. Use a consistent warm cream/beige background
3. Soft watercolor botanical art style
4. Make annotations legible and well-placed
5. This is step ${step} of ${stepCount} - make it clear this is part of a sequence`;

      console.log(`[ImageGenAgent] Starting parallel generation for step ${step}/${stepCount}...`);

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [{ role: "user", content: stepPrompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          console.error(`[ImageGenAgent] Step ${step} generation failed:`, response.status);
          return null;
        }

        const data = await response.json();
        const messageContent = data.choices?.[0]?.message?.content || "";
        const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageData && imageData.startsWith("data:image")) {
          // Extract base64 from data URL
          const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
          if (base64Match) {
            const imageType = base64Match[1];
            const base64Data = base64Match[2];

            // Upload to Supabase Storage
            const fileName = `${profileId}/${Date.now()}-step${step}.${imageType}`;
            const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

            const { error: uploadError } = await supabase.storage
              .from("generated-guides")
              .upload(fileName, binaryData, {
                contentType: `image/${imageType}`,
                upsert: false,
              });

            if (uploadError) {
              console.error(`[ImageGenAgent] Upload error for step ${step}:`, uploadError);
              return null;
            }

            // Generate signed URL (1 hour expiry) instead of public URL for security
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from("generated-guides")
              .createSignedUrl(fileName, 3600); // 1 hour expiry

            if (signedUrlError || !signedUrlData?.signedUrl) {
              console.error(`[ImageGenAgent] Signed URL error for step ${step}:`, signedUrlError);
              return null;
            }

            const imageUrl = signedUrlData.signedUrl;
            console.log(`[ImageGenAgent] Step ${step} uploaded with signed URL`);

            return {
              step,
              description: messageContent || `Step ${step}`,
              imageUrl: imageUrl,
            };
          }
        }

        console.log(`[ImageGenAgent] No image in response for step ${step}`);
        return null;
      } catch (stepError) {
        console.error(`[ImageGenAgent] Error generating step ${step}:`, stepError);
        return null;
      }
    }

    // Generate ALL steps in parallel - this reduces ~90s to ~30s
    const stepPromises = Array.from({ length: stepCount }, (_, i) => generateStep(i + 1));
    const results = await Promise.all(stepPromises);

    // Filter out nulls and sort by step number
    const images = results.filter((img): img is ImageGuideStep => img !== null).sort((a, b) => a.step - b.step);

    if (images.length === 0) {
      return { success: false, error: "Failed to generate any images" };
    }

    // Store in generated_content for history
    await supabase.from("generated_content").insert({
      profile_id: profileId,
      content_type: "image_guide",
      task_description: task,
      content: { steps: images, plant_species: plantSpecies },
    });

    console.log(`[ImageGenAgent] Successfully generated ${images.length}/${stepCount} step images in parallel`);
    return { success: true, images };
  } catch (error) {
    console.error("[ImageGenAgent] Error:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// PLANT PHOTO UPLOAD HELPER (best-effort)
// ============================================
async function uploadPlantPhoto(
  supabase: any,
  profileId: string,
  base64Data: string,
  mimeType: string,
): Promise<{ storagePath: string; signedUrl: string } | null> {
  try {
    const ext = mimeType.includes("png") ? "png" : "jpeg";
    const storagePath = `${profileId}/${Date.now()}.${ext}`;
    const binaryData = base64Decode(base64Data);

    const { error: uploadError } = await supabase.storage
      .from("plant-photos")
      .upload(storagePath, binaryData, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[uploadPlantPhoto] Upload error:", uploadError);
      return null;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("plant-photos")
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[uploadPlantPhoto] Signed URL error:", signedUrlError);
      // Upload succeeded but signed URL failed — return path without URL
      return { storagePath, signedUrl: "" };
    }

    console.log(`[uploadPlantPhoto] Uploaded to ${storagePath}`);
    return { storagePath, signedUrl: signedUrlData.signedUrl };
  } catch (err) {
    console.error("[uploadPlantPhoto] Unexpected error:", err);
    return null;
  }
}

interface VideoAnalysis {
  summary: string;
  timestamps: Array<{ time: string; observation: string }>;
  diagnosis?: string;
  recommendations: string[];
}

async function callVideoAgent(
  supabase: any,
  profileId: string,
  videoBase64: string,
  mimeType: string,
  analysisFocus: string,
  question: string | null,
  LOVABLE_API_KEY: string,
): Promise<{ success: boolean; data?: VideoAnalysis; error?: string }> {
  try {
    console.log(`[VideoAgent] Analyzing video (${mimeType}), focus: ${analysisFocus}`);

    const focusPrompts: Record<string, string> = {
      general_assessment: `Analyze this plant video. Note the plant's overall health, any visible issues, and environmental conditions. Reference specific timestamps (MM:SS) when describing what you observe. Assess light, soil moisture signs, and general vitality.`,
      diagnose_problem: `This video shows a plant with a potential problem. Analyze carefully, reference specific timestamps (MM:SS) where issues are visible, and provide a diagnosis with treatment recommendations. Look for yellowing, browning, wilting, pests, or disease signs.`,
      evaluate_technique: `The user is showing their plant care technique (watering, repotting, pruning, etc.). Analyze their approach, note what they're doing well at specific timestamps, and suggest improvements. Be constructive and encouraging.`,
      track_movement: `Analyze movement in this video (likely pest activity or growth tracking). Identify what's moving, where, and at what timestamps (MM:SS). Provide identification if possible and recommend action.`,
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: `${focusPrompts[analysisFocus] || focusPrompts.general_assessment}

Return ONLY valid JSON with this structure:
{
  "summary": "2-3 sentence overall assessment",
  "timestamps": [
    {"time": "0:12", "observation": "What you see at this moment"},
    {"time": "0:34", "observation": "Another observation"}
  ],
  "diagnosis": "If applicable, the main issue identified (or null)",
  "recommendations": ["Action 1", "Action 2"]
}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: question || "Analyze this plant video." },
              { type: "video_url", video_url: { url: `data:${mimeType};base64,${videoBase64}` } },
            ],
          },
        ],
        thinking_config: { thinking_level: "low" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VideoAgent] API error:", response.status, errorText);
      return { success: false, error: `Video analysis failed: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let analysis: VideoAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // Fallback structure if JSON parsing fails
      analysis = {
        summary: content,
        timestamps: [],
        recommendations: ["Please send a clearer video for better analysis."],
      };
    }

    // Store in generated_content
    await supabase.from("generated_content").insert({
      profile_id: profileId,
      content_type: "video_analysis",
      task_description: analysisFocus,
      content: analysis,
    });

    console.log("[VideoAgent] Analysis complete:", analysis.summary);
    return { success: true, data: analysis };
  } catch (error) {
    console.error("[VideoAgent] Error:", error);
    return { success: false, error: String(error) };
  }
}

interface VoiceTranscription {
  transcript: string;
  intent: string;
  key_details: string;
  follow_up_needed: string | null;
}

async function callVoiceAgent(
  supabase: any,
  profileId: string,
  audioBase64: string,
  mimeType: string,
  context: string | null,
  LOVABLE_API_KEY: string,
): Promise<{ success: boolean; data?: VoiceTranscription; error?: string }> {
  try {
    console.log(`[VoiceAgent] Transcribing audio (${mimeType}, ${audioBase64.length} base64 chars)`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: `You are transcribing and understanding a voice note about plant care. Listen carefully and extract the user's intent.

Return ONLY valid JSON with this structure:
{
  "transcript": "Exact transcription of what was said",
  "intent": "What the user wants (identify, diagnose, care_question, save_plant, reminder, general_chat, etc.)",
  "key_details": "Any plant names, symptoms, or specific details mentioned",
  "follow_up_needed": "Any clarification needed, or null if message is clear"
}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: context || "Transcribe and understand this voice note about plants." },
              { type: "input_audio", input_audio: { data: audioBase64, format: mimeType.split("/")[1] || "mp3" } },
            ],
          },
        ],
        thinking_config: { thinking_level: "low" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VoiceAgent] API error:", response.status, errorText);
      return { success: false, error: `Voice transcription failed: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let transcription: VoiceTranscription;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      transcription = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // If JSON parsing fails, treat the whole content as transcript
      transcription = {
        transcript: content,
        intent: "unknown",
        key_details: "",
        follow_up_needed: null,
      };
    }

    // Store in generated_content
    await supabase.from("generated_content").insert({
      profile_id: profileId,
      content_type: "voice_transcript",
      task_description: transcription.intent,
      content: transcription,
    });

    console.log("[VoiceAgent] Transcription complete:", transcription.transcript.substring(0, 100));
    return { success: true, data: transcription };
  } catch (error) {
    console.error("[VoiceAgent] Error:", error);
    return { success: false, error: String(error) };
  }
}


// Extract structured user insights from conversation text
async function extractInsightsFromText(
  text: string,
  LOVABLE_API_KEY: string,
): Promise<Array<{ key: string; value: string }>> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
          { role: "user", content: text },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error("[InsightExtraction] API error:", response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      const insights = parsed.insights || [];
      console.log(`[InsightExtraction] Extracted ${insights.length} insights`);
      return insights;
    } catch {
      console.error("[InsightExtraction] Failed to parse response");
      return [];
    }
  } catch (error) {
    console.error("[InsightExtraction] Error:", error);
    return [];
  }
}

async function maybeCompressHistory(supabase: any, profileId: string, LOVABLE_API_KEY: string): Promise<void> {
  try {
    const { count, error: countError } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("summarized", false);

    if (countError) {
      console.error("[ContextEngineering] Error counting messages:", countError);
      return;
    }

    console.log(`[ContextEngineering] Unsummarized message count: ${count}`);

    // Only compress if we have 10+ unsummarized messages
    if ((count || 0) < 10) {
      return;
    }

    console.log("[ContextEngineering] Triggering history compression...");

    // Get the oldest 5 unsummarized messages
    const { data: toSummarize } = await supabase
      .from("conversations")
      .select("*")
      .eq("profile_id", profileId)
      .eq("summarized", false)
      .order("created_at", { ascending: true })
      .limit(5);

    if (!toSummarize || toSummarize.length < 5) {
      return;
    }

    const messagesText = toSummarize.map((m: any) => `[${m.direction}]: ${m.content}`).join("\n");

    // Run summary generation and insight extraction in parallel
    const [summaryResponse, extractedInsights] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          thinking_config: { thinking_level: "low" },
          messages: [
            {
              role: "system",
              content: `You are a conversation summarizer. Create a concise summary of this plant care conversation that captures:
1. Key plants discussed
2. Issues diagnosed or questions answered
3. Actions taken (plants saved, reminders set)
4. Important user preferences revealed

Return JSON: {"summary": "2-3 sentence summary", "key_topics": ["topic1", "topic2"]}`,
            },
            { role: "user", content: messagesText },
          ],
          max_tokens: 200,
        }),
      }),
      extractInsightsFromText(messagesText, LOVABLE_API_KEY),
    ]);

    if (!summaryResponse.ok) {
      console.error("[ContextEngineering] Summary generation failed:", await summaryResponse.text());
      return;
    }

    const summaryData = await summaryResponse.json();
    const summaryContent = summaryData.choices[0]?.message?.content || "";

    let summaryJson: { summary: string; key_topics: string[] };
    try {
      const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
      summaryJson = JSON.parse(jsonMatch ? jsonMatch[0] : summaryContent);
    } catch {
      summaryJson = { summary: summaryContent, key_topics: [] };
    }

    console.log("[ContextEngineering] Generated summary:", summaryJson.summary);

    // Save the summary
    await supabase.from("conversation_summaries").insert({
      profile_id: profileId,
      summary: summaryJson.summary,
      key_topics: summaryJson.key_topics,
      message_count: 5,
      start_time: toSummarize[0].created_at,
      end_time: toSummarize[4].created_at,
    });

    // Save extracted insights
    if (extractedInsights.length > 0) {
      console.log(`[ContextEngineering] Saving ${extractedInsights.length} extracted insights`);
      for (const insight of extractedInsights) {
        await supabase.from("user_insights").upsert(
          {
            profile_id: profileId,
            insight_key: insight.key,
            insight_value: insight.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "profile_id,insight_key" },
        );
      }
    }

    const messageIds = toSummarize.map((m: any) => m.id);
    await supabase.from("conversations").update({ summarized: true }).in("id", messageIds);

    console.log(
      `[ContextEngineering] Successfully compressed ${messageIds.length} messages and extracted ${extractedInsights.length} insights`,
    );
  } catch (error) {
    console.error("[ContextEngineering] Compression error:", error);
  }
}


async function logAgentOperation(
  supabase: any,
  profileId: string,
  correlationId: string,
  operationType: string,
  tableName: string,
  recordId: string | null,
  toolName: string,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    await supabase.from("agent_operations").insert({
      profile_id: profileId,
      correlation_id: correlationId,
      operation_type: operationType,
      table_name: tableName,
      record_id: recordId,
      tool_name: toolName,
      metadata: metadata || null,
    });
  } catch (error) {
    // Don't fail operations due to audit logging errors
    console.error(`[Audit] Failed to log operation:`, error);
  }
}

function generateCorrelationId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// MEDIA HANDLING
// ============================================================================

interface MediaInfo {
  base64: string;
  mimeType: string;
  mediaType: "image" | "video" | "audio" | "unknown";
}

/* TWILIO DISABLED — Telegram-only for now
async function fetchTwilioMedia(mediaUrl: string, twilioAuth: string): Promise<MediaInfo | null> {
  try {
    console.log(`Fetching media from Twilio: ${mediaUrl}`);

    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${twilioAuth}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch media:", response.status);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let mediaType: "image" | "video" | "audio" | "unknown" = "unknown";
    if (contentType.startsWith("image/")) mediaType = "image";
    else if (contentType.startsWith("video/")) mediaType = "video";
    else if (contentType.startsWith("audio/") || contentType.includes("ogg")) mediaType = "audio";

    // Handle images with optional resizing
    if (mediaType === "image") {
      try {
        const result = await resizeImageForVision(uint8Array, contentType);

        if (MEDIA_CONFIG.RESIZE_MEDIA && result.wasResized) {
          const savings = ((1 - result.resizedBytes / result.originalBytes) * 100).toFixed(1);
          console.log(`[MediaProcessing] Image optimized: ${result.originalBytes} -> ${result.resizedBytes} bytes (${savings}% reduction)`);
        } else {
          console.log(`[MediaProcessing] Image processed: ${result.resizedBytes} bytes (no resize needed)`);
        }

        return {
          base64: result.base64,
          mimeType: result.mimeType,
          mediaType: "image",
        };
      } catch (err) {
        console.error("[MediaProcessing] Resize failed, using original:", err);
        // Fallback to original if resize fails
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        console.log(`Media fetched (fallback): ${contentType} (${mediaType}), ${base64.length} base64 chars`);
        return { base64, mimeType: contentType, mediaType: "image" };
      }
    }

    // Handle videos with size warning
    if (mediaType === "video") {
      const sizeInMB = arrayBuffer.byteLength / (1024 * 1024);
      if (sizeInMB > MEDIA_CONFIG.VIDEO_MAX_SIZE_MB) {
        console.warn(`[MediaProcessing] Large video: ${sizeInMB.toFixed(1)}MB (limit: ${MEDIA_CONFIG.VIDEO_MAX_SIZE_MB}MB)`);
      }
    }

    // Default handling for video, audio, and unknown types
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    console.log(`Media fetched: ${contentType} (${mediaType}), ${base64.length} base64 chars`);

    return {
      base64,
      mimeType: contentType,
      mediaType,
    };
  } catch (error) {
    console.error("Error fetching media:", error);
    return null;
  }
}
TWILIO DISABLED */

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /* TWILIO DISABLED — Telegram-only for now
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    TWILIO DISABLED */
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing backend credentials");
      return new Response("Configuration error", { status: 500, headers: corsHeaders });
    }

    if (!LOVABLE_API_KEY) {
      console.error("Missing LOVABLE_API_KEY");
      return new Response("Configuration error", { status: 500, headers: corsHeaders });
    }

    /* TWILIO DISABLED — Telegram-only for now
    const hasTwilioAuth = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN;
    TWILIO DISABLED */

    // Generate correlation ID for this request (audit trail)
    const correlationId = generateCorrelationId();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ========================================================================
    // MODE DETECTION
    // Check if this is an internal agent call (Telegram, etc.) or proactive trigger
    // ========================================================================
    const isInternalAgentCall = req.headers.get("X-Internal-Agent-Call") === "true";
    const isProactiveTrigger = req.headers.get("X-Proactive-Trigger") === "true";
    const contentType = req.headers.get("content-type") || "";

    let fromNumber: string;
    let body: string;
    let mediaUrl0: string | null = null;
    let numMedia = 0;
    let messageSid: string;
    let proactiveContext: { events: any[]; eventSummary: string } | null = null;
    let profile: any = null;
    let internalMediaInfo: { base64: string; mimeType: string } | null = null;

    if (isInternalAgentCall && !isProactiveTrigger && contentType.includes("application/json")) {
      // ====================================================================
      // INTERNAL AGENT CALL: From telegram-bot or other internal services
      // Accepts JSON in, returns JSON out, skips Twilio entirely
      // ====================================================================
      const payload = await req.json();

      console.log(`[${correlationId}] 📨 INTERNAL AGENT CALL for profile ${payload.profileId}`);

      // Get profile by ID
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", payload.profileId)
        .single();

      if (!existingProfile) {
        console.error(`[${correlationId}] Profile not found for internal agent call`);
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      profile = existingProfile;
      body = payload.message || "";
      fromNumber = `telegram:${payload.profileId}`;
      messageSid = `internal-${Date.now()}`;

      // Handle media from internal caller (base64-encoded)
      if (payload.mediaBase64 && payload.mediaMimeType) {
        internalMediaInfo = {
          base64: payload.mediaBase64,
          mimeType: payload.mediaMimeType,
        };
        numMedia = 1;
      }

      // If this is also a proactive trigger via internal call
      if (payload.proactiveMode && payload.events) {
        proactiveContext = {
          events: payload.events,
          eventSummary: payload.eventSummary || payload.events.map((e: any) => e.message_hint).join(", "),
        };
        const eventDescriptions = payload.events.map((e: any) => e.message_hint).join(", ");
        body = `[Internal: I'm thinking about my friend and want to check in. ${eventDescriptions}. Let me reach out naturally.]`;
      }

      console.log(`[${correlationId}] Internal call channel: ${payload.channel || "telegram"}, message length: ${body.length}`);
    } else if (isProactiveTrigger && contentType.includes("application/json")) {
      // ====================================================================
      // PROACTIVE MODE: Triggered by proactive-agent with event context
      // Same agent, same memory, just proactively reaching out
      // ====================================================================
      const proactivePayload = await req.json();

      console.log(`[${correlationId}] 🔔 PROACTIVE TRIGGER for profile ${proactivePayload.profileId}`);

      // Get profile by ID (already verified by proactive-agent)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", proactivePayload.profileId)
        .single();

      if (!existingProfile) {
        console.error(`[${correlationId}] Profile not found for proactive trigger`);
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      profile = existingProfile;
      fromNumber = `telegram:${proactivePayload.profileId}`;

      // Build a natural "internal thought" that Orchid will use to generate the message
      // This feels like Orchid naturally thinking of the user, not a system command
      const eventDescriptions = proactivePayload.events.map((e: any) => e.message_hint).join(", ");
      body = `[Internal: I'm thinking about my friend and want to check in. ${eventDescriptions}. Let me reach out naturally.]`;

      messageSid = `proactive-${Date.now()}`;

      proactiveContext = {
        events: proactivePayload.events,
        eventSummary: proactivePayload.eventSummary,
      };

      console.log(`[${correlationId}] Proactive context: ${eventDescriptions}`);
    } else {
      /* TWILIO DISABLED — Telegram-only for now
      // ====================================================================
      // NORMAL MODE: Incoming SMS/WhatsApp from Twilio
      // ====================================================================
      const formData = await req.formData();
      fromNumber = formData.get("From") as string;
      body = formData.get("Body") as string;
      mediaUrl0 = formData.get("MediaUrl0") as string | null;
      numMedia = parseInt((formData.get("NumMedia") as string) || "0", 10);
      messageSid = formData.get("MessageSid") as string;

      // Get or create profile
      const cleanFromNumber = fromNumber.startsWith("whatsapp:") ? fromNumber.replace("whatsapp:", "") : fromNumber;

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone_number", cleanFromNumber)
        .single();

      if (!existingProfile) {
        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({ phone_number: cleanFromNumber, personality: "warm" })
          .select()
          .single();

        if (profileError) {
          console.error("Error creating profile:", profileError);
        } else {
          profile = newProfile;
          console.log("Created new profile for:", cleanFromNumber);
        }
      } else {
        profile = existingProfile;
      }
      TWILIO DISABLED */

      // Twilio mode is disabled — return a no-op response for any non-internal requests
      console.error(`[orchid-agent] Received non-internal request (Twilio disabled). Returning empty response.`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    const isWhatsApp = fromNumber.startsWith("whatsapp:");
    const isTelegram = isInternalAgentCall && !isProactiveTrigger;
    const cleanFromNumber = isWhatsApp ? fromNumber.replace("whatsapp:", "") : fromNumber;
    const channel = isTelegram ? "telegram" : isWhatsApp ? "whatsapp" : "sms";

    console.log(
      `[${correlationId}] ${isProactiveTrigger ? "🔔 Proactive" : isInternalAgentCall ? "📨 Internal" : "Incoming"} ${channel.toUpperCase()} for ${cleanFromNumber}`,
    );
    if (numMedia > 0) console.log(`[${correlationId}] Media attached: ${mediaUrl0 || "internal base64"}`);

    /* TWILIO DISABLED — Telegram-only for now
    // ========================================================================
    // SANDBOX JOIN DETECTION (Code-in-Web flow)
    // When user joins the Twilio sandbox, generate a verification code and send it
    // They'll enter this code on the web to link their account
    // ========================================================================
    if (!isProactiveTrigger && body) {
      const isJoinMessage = body.toLowerCase().trim().startsWith("join ");

      if (isJoinMessage && !profile) {
        // New user joining sandbox - generate verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[${correlationId}] 🔗 New sandbox join - generating code ${code} for ${cleanFromNumber}`);

        // Store code with phone number (no user_id yet - will be claimed on web)
        const { error: insertError } = await supabase.from("linking_codes").insert({
          phone_number: cleanFromNumber,
          code,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

        if (insertError) {
          console.error(`[${correlationId}] Failed to create linking code:`, insertError);
        }

        // Send welcome message with code via Twilio REST API
        const welcomeMessage = `Welcome to Orchid! 🌱

Your verification code is: ${code}

Enter this code on the website to complete your account setup and unlock personalized plant care advice.

This code expires in 24 hours.`;

        try {
          const twilioWhatsAppNum = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";
          const twilioSmsNum = Deno.env.get("TWILIO_SMS_NUMBER") || "";

          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: fromNumber,
                From: isWhatsApp ? twilioWhatsAppNum : twilioSmsNum,
                Body: welcomeMessage,
              }).toString(),
            },
          );

          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            console.error(`[${correlationId}] Twilio send failed:`, errorText);
          } else {
            console.log(`[${correlationId}] ✅ Welcome code sent to ${cleanFromNumber}`);
          }
        } catch (e) {
          console.error(`[${correlationId}] Error sending welcome:`, e);
        }

        // Return empty TwiML (we already sent the response via REST API)
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }

      // If user has already joined (has profile) and sends join again, just acknowledge
      if (isJoinMessage && profile) {
        console.log(`[${correlationId}] Returning user sent join message - already has profile`);
        const alreadyLinkedTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Welcome back! 🌿 You're already connected. How can I help with your plants today?</Message>
</Response>`;
        return new Response(alreadyLinkedTwiml, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }
    TWILIO DISABLED */

    /* TWILIO DISABLED — Telegram-only for now
    // ========================================================================
    // LINKING CODE DETECTION (Legacy flow - user sends code to bot)
    // Check if the message is a linking code (e.g., "LINK 123456" or just "123456")
    // This connects a web account with a messaging identity
    //
    // TODO: When re-enabling, make linking code claim atomic. Replace the
    // SELECT + separate UPDATE pattern with a single atomic UPDATE:
    //   const { data: linkingData } = await supabase
    //     .from("linking_codes")
    //     .update({ used_at: new Date().toISOString() })
    //     .eq("code", code)
    //     .is("used_at", null)
    //     .gt("expires_at", new Date().toISOString())
    //     .select()
    //     .maybeSingle();
    // This prevents race conditions where two users claim the same code.
    // ========================================================================
    if (!isProactiveTrigger && body) {
      const linkingCodeMatch = body.trim().match(/^(?:LINK\s*)?(\d{6})$/i);

      if (linkingCodeMatch) {
        const code = linkingCodeMatch[1];
        console.log(`[${correlationId}] 🔗 Linking code detected: ${code}`);

        // Look up the linking code (both old flow with user_id and new flow with phone_number)
        const { data: linkingData, error: linkingLookupError } = await supabase
          .from("linking_codes")
          .select("*")
          .eq("code", code)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (linkingLookupError || !linkingData) {
          console.log(`[${correlationId}] Invalid or expired linking code: ${code}`);

          // Send error response via TwiML
          const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Hmm, that code doesn't seem right or may have expired. 🤔 Check the code on your setup page and try again! If you're having trouble, visit viridisml.lovable.app to get a fresh code.</Message>
</Response>`;

          return new Response(errorTwiml, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }

        // Handle legacy flow (user_id set, user sends code to bot)
        if (linkingData.user_id) {
          console.log(`[${correlationId}] Valid linking code found for user_id: ${linkingData.user_id}`);

          // Check if this phone already has a profile
          if (profile) {
            // Update existing profile with web account's user_id and preferences
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                user_id: linkingData.user_id,
                personality: linkingData.personality || profile.personality,
                location: linkingData.location || profile.location,
              })
              .eq("id", profile.id);

            if (updateError) {
              console.error(`[${correlationId}] Error updating profile:`, updateError);
            } else {
              console.log(`[${correlationId}] ✅ Linked existing profile ${profile.id} to user ${linkingData.user_id}`);
            }
          } else {
            // Create new profile linked to the web account
            const { data: newLinkedProfile, error: createError } = await supabase
              .from("profiles")
              .insert({
                phone_number: cleanFromNumber,
                user_id: linkingData.user_id,
                personality: linkingData.personality || "warm",
                location: linkingData.location,
              })
              .select()
              .single();

            if (createError) {
              console.error(`[${correlationId}] Error creating linked profile:`, createError);
            } else {
              console.log(
                `[${correlationId}] ✅ Created new linked profile ${newLinkedProfile.id} for user ${linkingData.user_id}`,
              );
              profile = newLinkedProfile;
            }
          }

          // Mark code as used
          await supabase.from("linking_codes").update({ used_at: new Date().toISOString() }).eq("id", linkingData.id);

          // Get personality name for friendly response
          const personalityNames: Record<string, string> = {
            warm: "warm and encouraging",
            expert: "detailed and scientific",
            playful: "fun and laid-back",
            philosophical: "thoughtful and mindful",
          };
          const personalityDesc = personalityNames[linkingData.personality || "warm"] || "friendly";

          // Send success response
          const successTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>🎉 You're all linked up! Your account is connected and I'll be ${personalityDesc} in our chats.

How can I help with your plants today? Send a photo or ask me anything! 🌿</Message>
</Response>`;

          return new Response(successTwiml, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }

        // Handle new Code-in-Web flow (phone_number set, user verifies on web)
        // This case shouldn't normally happen (user enters code on web, not in chat)
        // But if they do, just acknowledge
        if (linkingData.phone_number) {
          console.log(`[${correlationId}] Code ${code} is for web verification - instructing user`);
          const webVerifyTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>This code is for the website! 🖥️ Go back to your browser and enter ${code} there to complete setup.

If you need a new code, just send "join language-somebody" again.</Message>
</Response>`;
          return new Response(webVerifyTwiml, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }
      }
    }
    TWILIO DISABLED */

    // Store incoming message (skip for proactive - no actual inbound message)
    let inboundMessage: any = null;
    if (!isProactiveTrigger) {
      // Idempotency check: if this message_sid was already processed, return early
      if (messageSid) {
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("message_sid", messageSid)
          .maybeSingle();

        if (existing) {
          console.log(`[${correlationId}] Duplicate message_sid ${messageSid} — skipping`);
          if (isInternalAgentCall) {
            return new Response(JSON.stringify({ reply: "", deduplicated: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }
      }

      const { data: msgData } = await supabase
        .from("conversations")
        .insert({
          profile_id: profile?.id,
          channel,
          direction: "inbound",
          content: body,
          message_sid: messageSid,
          media_urls: numMedia > 0 && mediaUrl0 ? [mediaUrl0] : null,
        })
        .select()
        .single();
      inboundMessage = msgData;
    }

    // Load hierarchical context
    const hierarchicalContext = await loadHierarchicalContext(supabase, profile?.id);

    // Get user's plants for context
    const { data: userPlants } = await supabase
      .from("plants")
      .select("name, species, nickname, location_in_home")
      .eq("profile_id", profile?.id);

    // Build enriched conversation history with photo annotations
    const conversationHistory = hierarchicalContext.recentMessages.reverse().map((m) => {
      let content = m.content;

      if (m.media_urls && m.media_urls.length > 0) {
        const photoUrl = m.media_urls[0];
        const identification = hierarchicalContext.recentIdentifications.find((id) => id.photo_url === photoUrl);

        if (identification?.species_guess) {
          content = `[📷 Photo identified as: ${identification.species_guess}] ${content}`;
        } else if (identification?.diagnosis) {
          content = `[📷 Photo diagnosed: ${identification.diagnosis} (${identification.severity})] ${content}`;
        } else {
          content = `[📷 Photo attached] ${content}`;
        }
      }

      return {
        role: m.direction === "inbound" ? "user" : "assistant",
        content,
      };
    });

    const hasMedia = (numMedia > 0 && mediaUrl0) || (numMedia > 0 && internalMediaInfo);

    // Fetch media if present
    let mediaInfo: MediaInfo | null = null;
    if (internalMediaInfo) {
      // Media provided directly via internal agent call (base64-encoded)
      const mimeType = internalMediaInfo.mimeType;
      const mediaType = mimeType.startsWith("image/") ? "image" as const
        : mimeType.startsWith("video/") ? "video" as const
        : mimeType.startsWith("audio/") ? "audio" as const
        : "unknown" as const;
      mediaInfo = {
        base64: internalMediaInfo.base64,
        mimeType: mimeType,
        mediaType: mediaType,
      };
    }
    /* TWILIO DISABLED — Telegram-only for now
    else if (hasMedia && hasTwilioAuth) {
      const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      mediaInfo = await fetchTwilioMedia(mediaUrl0!, twilioAuth);
    }
    TWILIO DISABLED */

    // Best-effort upload of incoming plant photos to storage
    let uploadedPhotoPath: string | null = null;
    let uploadedPhotoUrl: string | null = null;
    if (mediaInfo && mediaInfo.mediaType === "image" && profile?.id) {
      try {
        const uploadResult = await uploadPlantPhoto(
          supabase,
          profile.id,
          mediaInfo.base64,
          mediaInfo.mimeType,
        );
        if (uploadResult) {
          uploadedPhotoPath = uploadResult.storagePath;
          uploadedPhotoUrl = uploadResult.signedUrl || null;
          console.log(`[${correlationId}] Photo uploaded to storage: ${uploadedPhotoPath}`);
        }
      } catch (err) {
        console.error(`[${correlationId}] Photo upload failed (non-blocking):`, err);
      }
    }

    // Auto-transcribe voice notes before main processing
    let effectiveMessage = body || "";
    let voiceTranscript: VoiceTranscription | null = null;

    // URL intent classification function
    function classifyUrlIntent(url: string, message: string): string {
      const lowerUrl = url.toLowerCase();
      const lowerMsg = message.toLowerCase();

      // Shopping/store sites
      if (
        lowerUrl.includes("homedepot") ||
        lowerUrl.includes("lowes") ||
        lowerUrl.includes("acehardware") ||
        lowerUrl.includes("amazon") ||
        lowerUrl.includes("walmart") ||
        lowerUrl.includes("target") ||
        lowerUrl.includes("nursery") ||
        lowerUrl.includes("garden")
      ) {
        return "store_verification";
      }

      // If message asks to verify/check availability
      if (
        lowerMsg.includes("verify") ||
        lowerMsg.includes("check") ||
        lowerMsg.includes("have it") ||
        lowerMsg.includes("in stock") ||
        lowerMsg.includes("available") ||
        lowerMsg.includes("carry")
      ) {
        return "store_verification";
      }

      // Product evaluation
      if (
        lowerMsg.includes("good") ||
        lowerMsg.includes("worth") ||
        lowerMsg.includes("recommend") ||
        lowerMsg.includes("review")
      ) {
        return "product_evaluation";
      }

      // Fact-checking
      if (
        lowerMsg.includes("true") ||
        lowerMsg.includes("accurate") ||
        lowerMsg.includes("fact") ||
        lowerMsg.includes("correct")
      ) {
        return "fact_check";
      }

      return "article_analysis";
    }

    // Detect URLs in message and classify intent
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const detectedUrls = body?.match(urlRegex) || [];
    if (detectedUrls.length > 0 && detectedUrls[0]) {
      const firstUrl = detectedUrls[0];
      const intent = classifyUrlIntent(firstUrl, body || "");
      console.log(`[Webhook] Detected ${detectedUrls.length} URL(s) with intent: ${intent}`, detectedUrls);

      if (intent === "store_verification") {
        effectiveMessage = `${body}\n\n[🔗 Store URL detected: ${firstUrl}] [Intent: verify inventory] Use verify_store_inventory with Perplexity to check if they carry the product.`;
      } else {
        effectiveMessage = `${body}\n\n[🔗 URL detected: ${firstUrl}] [Intent: ${intent}] Use research tool with the URL for analysis.`;
      }
    }

    if (mediaInfo?.mediaType === "audio") {
      console.log("[Webhook] Voice note detected - auto-transcribing...");
      const voiceResult = await callVoiceAgent(
        supabase,
        profile?.id,
        mediaInfo.base64,
        mediaInfo.mimeType,
        body,
        LOVABLE_API_KEY,
      );

      if (voiceResult.success && voiceResult.data) {
        voiceTranscript = voiceResult.data;
        effectiveMessage = `[🎤 Voice note]: "${voiceTranscript.transcript}"

User intent: ${voiceTranscript.intent}
Key details: ${voiceTranscript.key_details || "None specified"}
${body ? `Accompanying text: ${body}` : ""}`;
        console.log("[Webhook] Voice transcribed:", voiceTranscript.transcript.substring(0, 100));
      }
    }

    // Build the enriched system prompt
    let systemPrompt = buildEnrichedSystemPrompt(
      profile?.personality || "warm",
      hierarchicalContext,
      userPlants || [],
      profile,
    );

    // Inject proactive context if this is a proactive trigger
    if (isProactiveTrigger && proactiveContext) {
      const proactiveSection = `
## 🔔 PROACTIVE OUTREACH MODE
You are initiating contact because you've been thinking about your plant friend. This is NOT a response to a user message - YOU are reaching out proactively.

**Why you're reaching out:**
${proactiveContext.events.map((e: any) => `- ${e.message_hint}`).join("\n")}

**Guidelines for proactive messages:**
- Be warm and natural - you're checking in, not sending a notification
- Reference specific plants by name if applicable
- Ask a gentle question to invite conversation (e.g., "How's Fernie doing?" not "Your plant needs water!")
- Keep it brief (1-2 sentences max) - this is a friendly text, not a report
- Don't be pushy or guilt-trippy
- If following up on a diagnosis, show care and ask how things are progressing
- Make it feel like YOU naturally thought of them, because you did

**Example tones:**
- "Hey! 🌿 Was just thinking about your Monstera - it's probably thirsty by now. How's it looking?"
- "Quick check-in on Luna's recovery - any improvement on those yellow leaves?"
- "It's ${new Date().toLocaleString("en-US", { weekday: "long" })}! Perfect day to give your plants a little rotation. 🌱"
`;
      systemPrompt = systemPrompt + "\n" + proactiveSection;
    }

    // Build user message content
    let userContent: any;

    // For proactive mode, we give Orchid the trigger to generate an outreach message
    if (isProactiveTrigger && proactiveContext) {
      userContent = `Generate a warm, natural proactive message based on the context above. Remember: you're initiating contact, not responding. Keep it brief and conversational.`;
    } else {
      userContent = effectiveMessage || "What's this plant?";

      // For images, include the image in the message
      if (mediaInfo?.mediaType === "image") {
        userContent = [
          { type: "text", text: effectiveMessage || "What's this plant?" },
          { type: "image_url", image_url: { url: `data:${mediaInfo.mimeType};base64,${mediaInfo.base64}` } },
        ];
      }
      // For videos, add a note (the actual analysis happens via tool call)
      else if (mediaInfo?.mediaType === "video") {
        userContent = `${effectiveMessage || "Check out this video."}\n\n[📹 Video attached - use analyze_video tool to process]`;
      }
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(0, -1),
      { role: "user", content: userContent },
    ];

    // Call orchestrator
    console.log("Calling orchestrator (gemini-3-flash-preview)...");
    const orchestratorResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: allTools,
        tool_choice: "auto",
        max_tokens: 600,
      }),
    });

    let aiReply: string;
    let mediaToSend: Array<{ url: string; caption?: string }> = [];

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text();
      console.error("Orchestrator error:", orchestratorResponse.status, errorText);

      if (orchestratorResponse.status === 429) {
        aiReply = "I'm a bit overwhelmed right now! 🌿 Give me a moment and try again.";
      } else if (orchestratorResponse.status === 402) {
        aiReply = "I'm taking a quick break! Please try again later. 🌱";
      } else {
        aiReply = "I had a little hiccup! 🌱 Could you try again?";
      }
    } else {
      const orchestratorData = await orchestratorResponse.json();
      
      // Defensive check for malformed responses
      if (!orchestratorData?.choices || !Array.isArray(orchestratorData.choices) || orchestratorData.choices.length === 0) {
        console.error("[Orchestrator] Unexpected response format:", {
          hasChoices: !!orchestratorData?.choices,
          choicesType: typeof orchestratorData?.choices,
          rawPreview: JSON.stringify(orchestratorData).slice(0, 500),
          error: orchestratorData?.error,
        });
        aiReply = "I had trouble processing that. Could you try again? 🌱";
      } else {
        const message = orchestratorData.choices[0]?.message;

        console.log("Orchestrator response:", JSON.stringify(message, null, 2));

        // Extract thought signature for Gemini 3 reasoning context circulation
        // Required for strict function calling validation in Gemini 3
        const thoughtSignature = message?.thoughtSignature || message?.reasoning_details?.[0]?.data || null;

        if (thoughtSignature) {
          console.log("[ThoughtSignature] Extracted from orchestrator response");
        }

        let currentToolCalls = message?.tool_calls;
        aiReply = message?.content || "";
        let currentThoughtSignature = thoughtSignature;

      // Bounded tool loop: max 3 iterations for multi-step workflows
      const MAX_TOOL_ITERATIONS = 3;
      let toolIteration = 0;

      while (currentToolCalls && currentToolCalls.length > 0 && toolIteration < MAX_TOOL_ITERATIONS) {
        toolIteration++;
        const toolCalls = currentToolCalls;
        console.log(`[${correlationId}] Tool loop iteration ${toolIteration}/${MAX_TOOL_ITERATIONS}: Processing ${toolCalls.length} tool call(s)...`);

        const toolResults: { id: string; name: string; result: any }[] = [];

        for (const toolCall of toolCalls) {
          const functionName = toolCall.function?.name;
          let args: any = {};
          try {
            args = JSON.parse(toolCall.function?.arguments || "{}");
          } catch (parseErr) {
            console.error(
              `[${correlationId}] Failed to parse tool arguments for ${functionName}:`,
              toolCall.function?.arguments,
              parseErr,
            );
            // Skip this tool call — don't execute with empty args
            toolResults.push({
              id: toolCall.id,
              name: functionName,
              result: {
                success: false,
                error: "I had trouble processing that request. Could you try rephrasing?",
              },
            });
            continue;
          }

          console.log(`[${correlationId}] Executing tool: ${functionName}`, args);

          // Check agent permission for this tool
          const requiredCapability = TOOL_CAPABILITY_MAP[functionName];
          if (requiredCapability && profile?.id) {
            const hasPermission = await checkAgentPermission(supabase, profile.id, requiredCapability);
            if (!hasPermission) {
              console.log(`[${correlationId}] Permission denied for ${functionName} (requires: ${requiredCapability})`);
              toolResults.push({
                id: toolCall.id,
                name: functionName,
                result: {
                  success: false,
                  error: `This action requires the "${requiredCapability}" permission which is currently disabled. You can enable it at viridisml.lovable.app/settings`,
                  permissionDenied: true,
                },
              });
              continue; // Skip to next tool call
            }
          }

          let toolResult: any;

          // Agent tools
          if (functionName === "identify_plant") {
            if (mediaInfo?.mediaType === "image") {
            toolResult = await callVisionAgent(
              "identify",
              mediaInfo.base64,
              args.user_context || body,
              LOVABLE_API_KEY,
            );

            if (toolResult.success && toolResult.data) {
              const { data: identification } = await supabase
                .from("plant_identifications")
                .insert({
                  profile_id: profile?.id,
                  photo_url: uploadedPhotoPath || mediaUrl0,
                  species_guess: toolResult.data.species,
                  confidence: toolResult.data.confidence,
                  care_tips: toolResult.data.careSummary,
                })
                .select()
                .single();

              if (identification) {
                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "create",
                  "plant_identifications",
                  identification.id,
                  functionName,
                  { species: toolResult.data.species },
                );
              }
            }
            } else {
              toolResult = { success: false, error: "No photo attached. Please send a photo with your message so I can identify the plant." };
            }
          } else if (functionName === "diagnose_plant") {
            if (mediaInfo?.mediaType === "image") {
            toolResult = await callVisionAgent(
              "diagnose",
              mediaInfo.base64,
              args.symptoms_described || body,
              LOVABLE_API_KEY,
            );

            if (toolResult.success && toolResult.data) {
              // Try to link to an existing plant if user mentioned one
              let diagnosePlantId: string | null = null;
              if (args.plant_identifier || args.plant_name) {
                const plantRef = args.plant_identifier || args.plant_name;
                const { data: matchedPlants } = await supabase
                  .from("plants")
                  .select("id")
                  .eq("profile_id", profile?.id)
                  .or(`name.ilike.%${plantRef}%,nickname.ilike.%${plantRef}%,species.ilike.%${plantRef}%`)
                  .limit(1);
                if (matchedPlants && matchedPlants.length > 0) {
                  diagnosePlantId = matchedPlants[0].id;
                }
              }

              const { data: diagnosis } = await supabase
                .from("plant_identifications")
                .insert({
                  profile_id: profile?.id,
                  plant_id: diagnosePlantId,
                  photo_url: uploadedPhotoPath || mediaUrl0,
                  diagnosis: toolResult.data.diagnosis,
                  severity: toolResult.data.severity,
                  treatment: toolResult.data.treatment,
                })
                .select()
                .single();

              if (diagnosis) {
                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "create",
                  "plant_identifications",
                  diagnosis.id,
                  functionName,
                  { diagnosis: toolResult.data.diagnosis, severity: toolResult.data.severity },
                );
              }
            }
            } else {
              toolResult = { success: false, error: "No photo attached. Please send a photo with your message so I can diagnose the issue." };
            }
          } else if (functionName === "analyze_environment" && mediaInfo?.mediaType === "image") {
            toolResult = await callVisionAgent(
              "environment",
              mediaInfo.base64,
              args.plant_species || "",
              LOVABLE_API_KEY,
            );
            await logAgentOperation(
              supabase,
              profile?.id,
              correlationId,
              "read",
              "vision_analysis",
              null,
              functionName,
              { type: "environment" },
            );
          } else if (functionName === "research") {
            if (!PERPLEXITY_API_KEY) {
              toolResult = { success: false, error: "Research not configured" };
            } else {
              toolResult = await callResearchAgent(args.query, PERPLEXITY_API_KEY);
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "read",
                "external_search",
                null,
                functionName,
                { query: args.query },
              );
            }
          }
          // New multimedia tools
          else if (functionName === "generate_visual_guide") {
            toolResult = await callImageGenerationAgent(
              supabase,
              profile?.id,
              args.task,
              args.plant_species || null,
              args.step_count || 3,
              LOVABLE_API_KEY,
              SUPABASE_URL!,
            );

            // Add generated images to media queue for sending
            if (toolResult.success && toolResult.images) {
              for (const img of toolResult.images) {
                mediaToSend.push({ url: img.imageUrl, caption: img.description });
              }
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "create",
                "generated_content",
                null,
                functionName,
                { task: args.task, imageCount: toolResult.images.length },
              );
            }
          } else if (functionName === "analyze_video") {
            if (mediaInfo?.mediaType === "video") {
            toolResult = await callVideoAgent(
              supabase,
              profile?.id,
              mediaInfo.base64,
              mediaInfo.mimeType,
              args.analysis_focus,
              args.specific_question || null,
              LOVABLE_API_KEY,
            );
            } else {
              toolResult = { success: false, error: "No video attached. Please send a video with your message so I can analyze it." };
            }
          } else if (functionName === "transcribe_voice") {
            // Usually auto-triggered, but can be called manually
            if (voiceTranscript) {
              toolResult = { success: true, data: voiceTranscript };
            } else if (mediaInfo?.mediaType === "audio") {
              toolResult = await callVoiceAgent(
                supabase,
                profile?.id,
                mediaInfo.base64,
                mediaInfo.mimeType,
                args.context || null,
                LOVABLE_API_KEY,
              );
            } else {
              toolResult = { success: false, error: "No audio message to transcribe" };
            }
          }
          // Function tools (DB operations) - with audit logging
          else if (functionName === "save_plant") {
            toolResult = await savePlant(supabase, profile?.id, args, uploadedPhotoPath || mediaUrl0 || undefined);
            if (toolResult.success && toolResult.plant) {
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "create",
                "plants",
                toolResult.plant.id,
                functionName,
                { species: args.species },
              );
            }
          } else if (functionName === "modify_plant") {
            toolResult = await modifyPlant(supabase, profile?.id, args);
            if (toolResult.success) {
              if (toolResult.plants) {
                // Bulk operation
                for (const plant of toolResult.plants) {
                  await logAgentOperation(
                    supabase,
                    profile?.id,
                    correlationId,
                    "update",
                    "plants",
                    plant.id,
                    functionName,
                    { updates: args.updates, bulk: true },
                  );
                }
              } else if (toolResult.plant) {
                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "update",
                  "plants",
                  toolResult.plant.id,
                  functionName,
                  { updates: args.updates },
                );
              }
            }
          } else if (functionName === "delete_plant") {
            toolResult = await deletePlant(supabase, profile?.id, args);
            if (toolResult.success) {
              if (toolResult.deletedNames) {
                // Bulk operation
                for (const name of toolResult.deletedNames) {
                  await logAgentOperation(
                    supabase,
                    profile?.id,
                    correlationId,
                    "delete",
                    "plants",
                    null,
                    functionName,
                    { deleted: name, bulk: true },
                  );
                }
              } else {
                await logAgentOperation(supabase, profile?.id, correlationId, "delete", "plants", null, functionName, {
                  deleted: toolResult.deletedName,
                });
              }
            }
          } else if (functionName === "create_reminder") {
            toolResult = await createReminder(supabase, profile?.id, args);
            if (toolResult.success) {
              if (toolResult.reminders) {
                // Log bulk operation - each reminder individually
                for (const r of toolResult.reminders) {
                  await logAgentOperation(
                    supabase,
                    profile?.id,
                    correlationId,
                    "create",
                    "reminders",
                    r.reminder.id,
                    functionName,
                    { type: args.reminder_type, plant: r.plantName, bulk: true },
                  );
                }
              } else if (toolResult.reminder) {
                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "create",
                  "reminders",
                  toolResult.reminder.id,
                  functionName,
                  { type: args.reminder_type, plant: args.plant_identifier },
                );
              }
            } else {
              console.error(`[${correlationId}] Tool ${functionName} FAILED:`, toolResult.error);
            }
          } else if (functionName === "delete_reminder") {
            toolResult = await deleteReminder(supabase, profile?.id, args);
            if (toolResult.success) {
              const auditId = generateCorrelationId();
              await logAgentOperation(supabase, profile?.id, auditId, "delete", "reminders", null, "delete_reminder", { deletedCount: toolResult.deletedCount });
            }
          } else if (functionName === "log_care_event") {
            toolResult = await logCareEvent(supabase, profile?.id, args);
            if (toolResult.success) {
              if (toolResult.events) {
                // Bulk operation
                for (const e of toolResult.events) {
                  await logAgentOperation(
                    supabase,
                    profile?.id,
                    correlationId,
                    "create",
                    "care_events",
                    e.event.id,
                    functionName,
                    { type: args.event_type, plant: e.plantName, bulk: true },
                  );
                }
              } else if (toolResult.event) {
                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "create",
                  "care_events",
                  toolResult.event.id,
                  functionName,
                  { type: args.event_type, plant: args.plant_identifier },
                );
              }
            } else {
              console.error(`[${correlationId}] Tool ${functionName} FAILED:`, toolResult.error);
            }
          } else if (functionName === "save_user_insight") {
            toolResult = await saveUserInsight(supabase, profile?.id, args, inboundMessage?.id);
            if (toolResult.success) {
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "create",
                "user_insights",
                null,
                functionName,
                { key: args.insight_key },
              );
            }
          }
          // Maps and Store verification tools
          else if (functionName === "find_stores") {
            toolResult = await callMapsShoppingAgent(
              args.product_query,
              args.store_type || "any",
              profile?.location || null,
              LOVABLE_API_KEY,
              PERPLEXITY_API_KEY,
            );
            await logAgentOperation(
              supabase,
              profile?.id,
              correlationId,
              "read",
              "external_search",
              null,
              functionName,
              { query: args.product_query },
            );

            // AGENTIC RETRY: If no stores found, automatically trigger research fallback
            if (toolResult.success && toolResult.data?.stores?.length === 0 && PERPLEXITY_API_KEY) {
              console.log(
                `[${correlationId}] [AgenticRetry] find_stores returned 0 results, triggering online research fallback`,
              );

              const productName = args.product_query || "plant supplies";
              const researchQuery = `Where to buy ${productName} online? Best online retailers, pricing, availability, and alternatives for ${productName}. Include Amazon, specialty plant stores, and manufacturer websites.`;

              const researchResult = await callResearchAgent(researchQuery, PERPLEXITY_API_KEY);

              if (researchResult.success && researchResult.data) {
                console.log(`[${correlationId}] [AgenticRetry] Research fallback successful, sanitizing output...`);

                // SANITIZE research output for messaging BEFORE storing
                const sanitizedAlternatives = await rewriteResearchForMessaging(
                  researchResult.data,
                  `Where to buy ${productName}`,
                  profile?.personality || "warm",
                  LOVABLE_API_KEY,
                );

                toolResult.data.onlineAlternatives = sanitizedAlternatives;
                toolResult.data.callAheadAdvice = `I found some online options for you.`;

                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "read",
                  "external_search",
                  null,
                  "research_fallback",
                  { query: researchQuery, triggered_by: "empty_find_stores" },
                );
              }
            }
          } else if (functionName === "verify_store_inventory") {
            if (!PERPLEXITY_API_KEY) {
              toolResult = { success: false, error: "Store verification not configured" };
            } else {
              toolResult = await verifyStoreInventory(
                args.store_name,
                args.product,
                args.location || profile?.location || null,
                PERPLEXITY_API_KEY,
              );
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "read",
                "external_search",
                null,
                functionName,
                { store: args.store_name, product: args.product },
              );
            }
          } else if (functionName === "update_notification_preferences") {
            toolResult = await updateNotificationPreferences(supabase, profile?.id, args);
            if (toolResult.success) {
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "update",
                "proactive_preferences",
                null,
                functionName,
                { topic: args.topic, action: args.action },
              );
            }
          }
          // Profile update tool
          else if (functionName === "update_profile") {
            toolResult = await updateProfile(supabase, profile?.id, args);
            if (toolResult.success && profile) {
              // Update in-memory profile so subsequent tools (e.g. find_stores) see the new value immediately
              if (args.field === "pets" || args.field === "primary_concerns") {
                (profile as any)[args.field] = args.value.split(",").map((v: string) => v.trim().toLowerCase());
              } else {
                (profile as any)[args.field] = toolResult.updated?.value ?? args.value;
              }
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "update",
                "profiles",
                profile?.id,
                functionName,
                { field: args.field },
              );
            }
          }
          else if (functionName === "deep_think") {
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
            if (!LOVABLE_API_KEY) {
              toolResult = { success: false, error: "Deep think not configured" };
            } else {
              try {
                const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: "google/gemini-3-flash-preview",
                    messages: [
                      { role: "system", content: "You are an expert botanist and plant pathologist. Provide detailed, actionable advice. Be specific about symptoms, causes, and treatments." },
                      { role: "user", content: args.context ? `${args.question}\n\nContext: ${args.context}` : args.question },
                    ],
                    temperature: 1.0,
                  }),
                });
                const data = await response.json();
                toolResult = { success: true, answer: data.choices?.[0]?.message?.content || "" };
              } catch (err) {
                toolResult = { success: false, error: String(err) };
              }
            }
          }
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
                toolResult = imageUrl ? { success: true, imageUrl } : { success: false, error: "No image generated" };
              } catch (err) {
                toolResult = { success: false, error: String(err) };
              }
            }
          }
          else {
            toolResult = { success: false, error: `Unknown tool: ${functionName}` };
          }

          toolResults.push({
            id: toolCall.id,
            name: functionName,
            result: toolResult,
          });
        }

        // Synthesize fallback reply from tool results
        const synthesizeReplyFromToolResults = (): string => {
          let reply = "";
          for (const tr of toolResults) {
            if (!tr.result?.success) {
              // Handle special cases for failed tools
              if (tr.name === "find_stores" && tr.result?.promptForLocation) {
                reply =
                  "🗺️ I'd love to find stores near you! Could you share your city or ZIP code so I can recommend the best local nurseries and garden centers?";
              }
              continue;
            }
            if (tr.name === "identify_plant" && tr.result.data) {
              reply = `🌿 I identified this as ${tr.result.data.species}! ${tr.result.data.careSummary}`;
            } else if (tr.name === "diagnose_plant" && tr.result.data) {
              reply = `🔍 Diagnosis: ${tr.result.data.diagnosis} (${tr.result.data.severity})\n\nTreatment: ${tr.result.data.treatment}`;
            } else if (tr.name === "find_stores" && tr.result.data) {
              // Handle both empty and populated store results
              if (tr.result.data.stores?.length > 0) {
                const stores = tr.result.data.stores;
                reply = `🏪 Stores for ${tr.result.data.searchedFor} near ${tr.result.data.location}:\n\n`;
                stores.slice(0, 5).forEach((s: any, i: number) => {
                  reply += `${i + 1}. ${s.fullName || s.name} (${s.type})`;
                  if (s.distance) reply += ` - ${s.distance}`;
                  if (s.driveTime) reply += `, ${s.driveTime}`;
                  reply += `\n`;
                  if (s.address && s.addressVerified) {
                    reply += `📍 ${s.address}\n`;
                  } else if (s.neighborhood) {
                    reply += `📍 ${s.neighborhood}\n`;
                  }
                  if (s.phone) reply += `📞 ${s.phone}\n`;
                  if (s.reasoning) reply += `${s.reasoning}\n`;
                  if (s.productNotes) reply += `💡 ${s.productNotes}\n`;
                  reply += `\n`;
                });
              } else {
                // Empty stores - provide helpful fallback (sanitized for messaging)
                const product = tr.result.data.searchedFor || "that item";
                const location = tr.result.data.location || "your area";
                reply = `🔍 I searched for ${product} near ${location} but couldn't find specific local stores carrying it.\n\n`;

                // Check if we have online alternatives from research fallback (already sanitized)
                if (tr.result.data.onlineAlternatives) {
                  reply += `Here's what I found online:\n\n${tr.result.data.onlineAlternatives}`;
                } else {
                  reply += `Here's what I'd suggest:\n\n`;
                  reply += `Check Amazon or the manufacturer's website. You could also call local nurseries or hydroponics stores to ask - they sometimes carry specialty items that don't show up in searches.\n\n`;
                  reply += `Want me to search for online options? 🌐`;
                }
              }
            } else if (tr.name === "verify_store_inventory" && tr.result.data) {
              const v = tr.result.data;
              reply += `\n✅ ${v.storeName}: ${v.availability === "likely_in_stock" ? "Likely in stock" : v.availability === "call_ahead" ? "Call ahead to confirm" : "May not have it"}`;
              if (v.department) reply += ` (${v.department})`;
              if (v.brands?.length) reply += `\nBrands: ${v.brands.join(", ")}`;
              if (v.notes) reply += `\n${v.notes}`;
            } else if (tr.name === "save_plant" && tr.result.plant) {
              reply = `✅ Saved ${tr.result.plant.nickname || tr.result.plant.species} to your collection!`;
            } else if (tr.name === "modify_plant") {
              if (tr.result.success) {
                if (tr.result.plantsCount) {
                  // Bulk update
                  const filterDesc = tr.result.filter?.value ? ` in the ${tr.result.filter.value}` : "";
                  reply = `✅ Updated ${tr.result.plantsCount} plants${filterDesc}!`;
                } else if (tr.result.plant) {
                  // Single update
                  reply = `✅ Updated ${tr.result.plant.nickname || tr.result.plant.species}!`;
                }
              } else {
                reply = `⚠️ Couldn't update: ${tr.result.error}`;
              }
            } else if (tr.name === "delete_plant") {
              if (tr.result.requiresConfirmation) {
                // Needs user confirmation
                const filterDesc =
                  tr.result.filter?.type === "location"
                    ? ` in the ${tr.result.filter.value}`
                    : tr.result.filter?.type === "species"
                      ? ` (${tr.result.filter.value})`
                      : "";
                reply = `⚠️ This will delete ${tr.result.plantsToDelete} plants${filterDesc}: ${tr.result.plantNames}.\n\nAre you sure you want to delete them all?`;
              } else if (tr.result.success) {
                if (tr.result.deletedCount) {
                  // Bulk delete completed
                  const filterDesc = tr.result.filter?.value ? ` from the ${tr.result.filter.value}` : "";
                  reply = `🗑️ Deleted ${tr.result.deletedCount} plants${filterDesc}.`;
                } else if (tr.result.deletedName) {
                  // Single delete
                  reply = `🗑️ Removed ${tr.result.deletedName} from your collection.`;
                }
              } else {
                reply = `⚠️ Couldn't delete: ${tr.result.error}`;
              }
            } else if (tr.name === "create_reminder") {
              if (tr.result.success) {
                if (tr.result.plantsCount) {
                  // Bulk reminder created
                  const filterDesc = tr.result.filter?.value ? ` in the ${tr.result.filter.value}` : "";
                  reply = `⏰ Done! I've set a ${tr.result.reminders[0].reminder.reminder_type} reminder for ${tr.result.plantsCount} plants${filterDesc} - I'll check in every ${tr.result.reminders[0].reminder.frequency_days} days.`;
                } else if (tr.result.reminder) {
                  // Single reminder
                  reply = `⏰ I'll remind you to ${tr.result.reminder.reminder_type} your ${tr.result.plantName} every ${tr.result.reminder.frequency_days} days!`;
                }
              } else {
                // Handle error explicitly - don't let LLM hallucinate success
                reply = `⚠️ Couldn't create that reminder: ${tr.result.error}`;
              }
            } else if (tr.name === "log_care_event") {
              if (tr.result.success) {
                if (tr.result.eventsCount) {
                  // Bulk care event
                  const filterDesc = tr.result.filter?.value ? ` in the ${tr.result.filter.value}` : "";
                  const eventEmoji =
                    tr.result.events?.[0]?.event?.event_type === "water"
                      ? "💧"
                      : tr.result.events?.[0]?.event?.event_type === "fertilize"
                        ? "🌱"
                        : tr.result.events?.[0]?.event?.event_type === "prune"
                          ? "✂️"
                          : "✅";
                  reply = `${eventEmoji} Logged ${tr.result.events?.[0]?.event?.event_type || "care"} for ${tr.result.eventsCount} plants${filterDesc}!`;
                } else if (tr.result.event) {
                  // Single care event
                  const eventEmoji =
                    tr.result.event.event_type === "water"
                      ? "💧"
                      : tr.result.event.event_type === "fertilize"
                        ? "🌱"
                        : tr.result.event.event_type === "prune"
                          ? "✂️"
                          : "✅";
                  reply = `${eventEmoji} Logged ${tr.result.event.event_type} for ${tr.result.plantName}!`;
                }
              } else {
                reply = `⚠️ Couldn't log that care event: ${tr.result.error}`;
              }
            } else if (tr.name === "generate_visual_guide" && tr.result.images?.length) {
              reply = `📚 I've created a ${tr.result.images.length}-step visual guide for you! Check out the images below.`;
            } else if (tr.name === "analyze_video" && tr.result.data) {
              const va = tr.result.data;
              reply = `📹 Video Analysis:\n${va.summary}`;
              if (va.diagnosis) reply += `\n\nIssue found: ${va.diagnosis}`;
              if (va.recommendations?.length)
                reply += `\n\nRecommendations:\n${va.recommendations.map((r: string) => `- ${r}`).join("\n")}`;
            } else if (tr.name === "research" && tr.result.data) {
              // ALWAYS sanitize research output for messaging
              reply = sanitizeForMessaging(tr.result.data);
            } else if (tr.name === "save_user_insight" && tr.result.success) {
              // Don't add anything to reply for insight saves - they're silent
            } else if (tr.name === "update_notification_preferences" && tr.result.success) {
              const topics = tr.result.updated?.join(", ") || "preferences";
              reply = `✅ Updated your ${topics} notification settings!`;
            } else if (tr.name === "update_profile" && tr.result.success) {
              const field = tr.result.updated?.field || "profile";
              const value = tr.result.updated?.value || "";
              if (field === "display_name") {
                reply = `✅ Got it! I'll call you ${value} from now on. 🌿`;
              } else if (field === "location") {
                reply = `✅ Updated your location to ${value}. This helps me give you better seasonal advice!`;
              } else if (field === "experience_level") {
                reply = `✅ Noted - you're at the ${value} level. I'll adjust my advice accordingly!`;
              } else {
                reply = `✅ Updated your ${field}!`;
              }
            }
          }
          return reply;
        };

        // Append assistant message (with tool calls) and tool results to conversation
        const toolMessages = toolResults.map((tr) => ({
          role: "tool" as const,
          tool_call_id: tr.id,
          content: JSON.stringify(tr.result),
        }));

        aiMessages.push(
          {
            role: "assistant",
            content: aiReply || null,
            tool_calls: toolCalls,
            ...(currentThoughtSignature && { thoughtSignature: currentThoughtSignature }),
          } as any,
          ...toolMessages,
        );

        // Call orchestrator again with tool results
        const isLastIteration = toolIteration >= MAX_TOOL_ITERATIONS;
        console.log(`Calling orchestrator with tool results (iteration ${toolIteration})...`);

        const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: aiMessages,
            // Allow more tool calls unless we've hit the limit
            ...(isLastIteration ? {} : { tools: allTools, tool_choice: "auto" }),
            max_tokens: 500,
          }),
        });

        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json();
          const followUpMessage = followUpData.choices?.[0]?.message;
          aiReply = followUpMessage?.content || aiReply;
          currentToolCalls = followUpMessage?.tool_calls || null;
          currentThoughtSignature = followUpMessage?.thoughtSignature || followUpMessage?.reasoning_details?.[0]?.data || null;

          if (currentToolCalls && currentToolCalls.length > 0) {
            console.log(`[${correlationId}] Follow-up response has ${currentToolCalls.length} more tool call(s) — will loop`);
          } else {
            console.log(`[${correlationId}] Follow-up response is final text (iteration ${toolIteration})`);
          }

          if ((!aiReply || aiReply.trim() === "") && !currentToolCalls) {
            console.error("Follow-up response was empty; using tool-result fallback formatter");
            const fallbackReply = synthesizeReplyFromToolResults();
            if (fallbackReply) aiReply = fallbackReply;
          }
        } else {
          console.error("Follow-up response error:", await followUpResponse.text());
          const fallbackReply = synthesizeReplyFromToolResults();
          if (fallbackReply) aiReply = fallbackReply;
          break; // Exit loop on error
        }
      } // end tool loop

      if (!aiReply) {
        aiReply = "I'm here to help with your plants! Send me a photo or ask me anything. 🌿";
      }
      } // Close defensive check else block
    }

    console.log("Orchid Reply:", aiReply);

    // Store outgoing message
    await supabase.from("conversations").insert({
      profile_id: profile?.id,
      channel,
      direction: "outbound",
      content: aiReply,
    });

    // Trigger background compression check
    maybeCompressHistory(supabase, profile?.id, LOVABLE_API_KEY).catch((err) => {
      console.error("[ContextEngineering] Background compression error:", err);
    });

    // Smart message chunking for long responses (Telegram 4096 char limit)
    const MAX_CHUNK_SIZE = 1500; // Leave buffer for emoji/formatting

    const smartChunkMessage = (text: string): string[] => {
      if (text.length <= MAX_CHUNK_SIZE) return [text];

      const chunks: string[] = [];
      let remaining = text;

      while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK_SIZE) {
          chunks.push(remaining.trim());
          break;
        }

        // Find the best split point within the limit
        const searchArea = remaining.substring(0, MAX_CHUNK_SIZE);

        // Priority 1: Split between numbered list items (e.g., "1. Store" to "2. Store")
        const listItemMatch = searchArea.match(/.*\n\n(?=\d+\.\s\*\*)/s);
        if (listItemMatch) {
          chunks.push(listItemMatch[0].trim());
          remaining = remaining.substring(listItemMatch[0].length).trim();
          continue;
        }

        // Priority 2: Split at double newlines (paragraph breaks)
        const doubleNewline = searchArea.lastIndexOf("\n\n");
        if (doubleNewline > MAX_CHUNK_SIZE * 0.3) {
          chunks.push(remaining.substring(0, doubleNewline).trim());
          remaining = remaining.substring(doubleNewline + 2).trim();
          continue;
        }

        // Priority 3: Split at single newline
        const singleNewline = searchArea.lastIndexOf("\n");
        if (singleNewline > MAX_CHUNK_SIZE * 0.3) {
          chunks.push(remaining.substring(0, singleNewline).trim());
          remaining = remaining.substring(singleNewline + 1).trim();
          continue;
        }

        // Priority 4: Split at sentence end (. or ! or ?)
        const sentenceEnd = Math.max(
          searchArea.lastIndexOf(". "),
          searchArea.lastIndexOf("! "),
          searchArea.lastIndexOf("? "),
        );
        if (sentenceEnd > MAX_CHUNK_SIZE * 0.3) {
          chunks.push(remaining.substring(0, sentenceEnd + 1).trim());
          remaining = remaining.substring(sentenceEnd + 2).trim();
          continue;
        }

        // Fallback: Hard split at limit
        chunks.push(remaining.substring(0, MAX_CHUNK_SIZE).trim());
        remaining = remaining.substring(MAX_CHUNK_SIZE).trim();
      }

      return chunks.filter((c) => c.length > 0);
    };

    // ========================================================================
    // INTERNAL AGENT CALL RESPONSE: Return JSON instead of sending via Twilio
    // ========================================================================
    if (isInternalAgentCall) {
      console.log(`[${correlationId}] Returning internal JSON response (${aiReply.length} chars, ${mediaToSend.length} media)`);
      return new Response(JSON.stringify({
        reply: aiReply,
        mediaToSend: mediaToSend,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* TWILIO DISABLED — Telegram-only for now
    // Send reply via Twilio API
    if (hasTwilioAuth) {
      const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";
      const TWILIO_SMS_NUMBER = Deno.env.get("TWILIO_SMS_NUMBER");

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const fromTwilio = isWhatsApp ? TWILIO_WHATSAPP_NUMBER : TWILIO_SMS_NUMBER || "";

      // Chunk the message for conversational delivery
      const messageChunks = smartChunkMessage(aiReply);
      console.log(`[MessageChunking] Splitting into ${messageChunks.length} chunk(s)`);

      // Send each chunk sequentially
      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i];
        console.log(`[MessageChunking] Sending chunk ${i + 1}/${messageChunks.length} (${chunk.length} chars)`);

        const twilioBody = new URLSearchParams({
          To: fromNumber,
          From: fromTwilio,
          Body: chunk,
        });

        try {
          const twilioResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: twilioBody.toString(),
          });

          if (twilioResponse.ok) {
            const twilioData = await twilioResponse.json();
            console.log(`Twilio chunk ${i + 1} sent:`, twilioData.sid);
          } else {
            const twilioError = await twilioResponse.text();
            console.error("Twilio send error:", twilioResponse.status, twilioError);
          }

          // Small delay between chunks for natural conversation feel
          if (i < messageChunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (twilioErr) {
          console.error("Error sending via Twilio:", twilioErr);
        }
      }

      // Send generated images if any (WhatsApp supports media messages)
      if (mediaToSend.length > 0 && isWhatsApp) {
        console.log(`Sending ${mediaToSend.length} generated images...`);

        for (const media of mediaToSend) {
          try {
            const mediaBody = new URLSearchParams({
              To: fromNumber,
              From: fromTwilio,
              Body: media.caption || "",
              MediaUrl: media.url,
            });

            const mediaResponse = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                Authorization: `Basic ${twilioAuth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: mediaBody.toString(),
            });

            if (mediaResponse.ok) {
              console.log("Media sent successfully");
            } else {
              console.error("Media send error:", await mediaResponse.text());
            }
          } catch (mediaErr) {
            console.error("Error sending media:", mediaErr);
          }
        }
      }
    }
    TWILIO DISABLED */

    // Return empty TwiML (we're using the API to send)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
      },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";
import {
  callResearchAgent,
  callMapsShoppingAgent,
  verifyStoreInventory,
} from "../_shared/research.ts";
import { callDeepThink } from "../_shared/deepThink.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TEXT_TURNS = 5;
const MAX_VOICE_TURNS = 3;
const MAX_IMAGES = 3;
const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours
const MAX_TOOL_ITERATIONS = 3;
const MAX_HISTORY_TURNS = 3; // Only process last 3 turns (6 messages)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoTokenPayload {
  sid: string; // Session UUID
  txt: number; // Text turns used
  vox: number; // Voice turns used
  img: number; // Images generated
  ts: number; // Created timestamp (epoch seconds)
}

interface DemoMessage {
  role: "user" | "assistant";
  content: string;
}

interface DemoChatRequest {
  messages: DemoMessage[];
  media?: { type: string; data: string }[];
  demoToken?: string | null;
  // Legacy field from identify-feature.tsx MockChat
  exchangeCount?: number;
}

interface VoiceTokenRequest {
  demoToken: string;
}

// ---------------------------------------------------------------------------
// HMAC Token System (Web Crypto API)
// ---------------------------------------------------------------------------

async function getHmacKey(
  secret: string,
  usage: "sign" | "verify",
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function signToken(
  payload: DemoTokenPayload,
  secret: string,
): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json);
  const encoder = new TextEncoder();
  const key = await getHmacKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(b64));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${b64}.${sigHex}`;
}

async function verifyToken(
  token: string,
  secret: string,
): Promise<DemoTokenPayload | null> {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const b64 = token.substring(0, dotIdx);
  const sig = token.substring(dotIdx + 1);
  if (!b64 || !sig) return null;

  const encoder = new TextEncoder();
  const key = await getHmacKey(secret, "verify");

  // Convert hex sig to bytes
  const sigMatch = sig.match(/.{2}/g);
  if (!sigMatch) return null;
  const sigBytes = new Uint8Array(sigMatch.map((h) => parseInt(h, 16)));

  // Constant-time comparison via crypto.subtle.verify
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(b64),
  );
  if (!isValid) return null;

  try {
    const payload: DemoTokenPayload = JSON.parse(atob(b64));

    // Check session age (24h expiry)
    if (Date.now() / 1000 - payload.ts > SESSION_MAX_AGE_SECONDS) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Parse LLM content as JSON with fallback strategies */
function parseLLMJson(content: string): {
  artifact: { type: string; data: Record<string, unknown> };
  message: string;
  pixelFormation: { type: string; id?: string; text?: string } | null;
} {
  // Strategy 1: direct JSON.parse
  try {
    const parsed = JSON.parse(content);
    return {
      artifact: parsed.artifact || {
        type: "chat",
        data: { text: parsed.message || content },
      },
      message: parsed.message || "",
      pixelFormation: parsed.pixelFormation || null,
    };
  } catch {
    // Strategy 2: regex extract JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          artifact: parsed.artifact || {
            type: "chat",
            data: { text: parsed.message || content },
          },
          message: parsed.message || "",
          pixelFormation: parsed.pixelFormation || null,
        };
      } catch {
        // fall through
      }
    }

    // Strategy 3: plain text fallback
    return {
      artifact: { type: "chat", data: { text: content } },
      message: content,
      pixelFormation: null,
    };
  }
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Orchid, an expert botanist and plant care companion.

PERSONALITY: Warm, knowledgeable, conversational. You speak like a
plant-loving friend who happens to have a botany degree. Concise —
this is a chat, not an essay. 1-2 emoji max per message.

RESPONSE FORMAT: You MUST return valid JSON with this structure:
{
  "artifact": {
    "type": "identification" | "diagnosis" | "care_guide" |
            "store_list" | "visual_guide" | "chat",
    "data": { ... type-specific structured data }
  },
  "message": "natural language response (2-3 sentences max)",
  "pixelFormation": {
    "type": "template" | "text",
    "id": "species_name or tool_name",
    "text": "SHORT TEXT"
  } | null
}

ARTIFACT TYPES:

"identification" → when user sends a photo to identify:
  data: { species, commonName, confidence, family, origin,
          care: { light, water, humidity, toxic } }

"diagnosis" → when user describes/shows a problem:
  data: { issue, severity, symptoms: [], treatment: [],
          prevention }

"care_guide" → when user asks about care:
  data: { topic, plant, schedule: { season: frequency },
          howTo, troubleshooting: [] }

"store_list" → when find_stores returns results:
  data: { product, stores: [{ name, address, distance, note }] }

"visual_guide" → when a generated image would help:
  data: { title, steps: [{ instruction, imagePrompt }] }
  (imagePrompt is what will be sent to the image generation model)

"chat" → for conversational responses that don't need a card:
  data: { text }

PIXEL FORMATION: For each response, suggest what the pixel canvas
should show. Use template IDs from the asset library (plant species
or tool names in snake_case). For short text, use type: "text".

RULES:
- Always choose the most specific artifact type that fits
- Don't return "chat" if a structured artifact would be better
- Keep "message" brief — the artifact carries the detail
- For photos: always return "identification" or "diagnosis"
- For "how do I...": return "care_guide" or "visual_guide"
- For "where can I buy...": ask for their zip code or city first (never ask for street address or anything more specific). Only call find_stores after you have their location. Return "store_list" once you have results.
- When the user asks where to buy something, ask for their zip code or city first (never ask for street address or anything more specific). Only call find_stores after you have their location.

FOLLOW-UP STORE QUERIES:
When the user asks for "more stores," "other options," or "what else" for the same product:
- Look at your conversation history — you already shared store results in a prior turn
- Present DIFFERENT stores you haven't mentioned yet
- Only call find_stores again if the PRODUCT or LOCATION has actually changed`;

// ---------------------------------------------------------------------------
// Voice System Prompt
// ---------------------------------------------------------------------------

const DEMO_VOICE_SYSTEM_PROMPT = `You are Orchid, an expert botanist and plant care companion. You speak warmly and conversationally, like a plant-loving friend who happens to have a botany degree.

When the conversation first starts, greet the user briefly — say hi and ask how you can help with their plants. Keep it to one sentence.

Keep responses to 3-5 sentences. Be concise — this is a voice conversation.

You can help with:
- Plant identification (describe what you see)
- Diagnosing plant problems
- Care advice and tips
- General plant questions

This is a demo with a 2-minute time limit. If the conversation has been going for a while, naturally mention: "we're running low on time — feel free to type a question to keep going, or message me on Telegram for unlimited chats!"

You have tools available:
- research: Search for plant care information
- identify_plant: Identify plants from camera (describe what you see)
- diagnose_plant: Diagnose plant issues from camera
- analyze_environment: Analyze growing conditions from camera
- find_stores: Find local plant supply stores
- verify_store_inventory: Check if a store carries a product
- deep_think: Get expert analysis for complex questions
- show_visual: Display plant/tool silhouettes on the pixel canvas (always type='template', 1-2 per response)
- annotate_view: Mark up the camera feed on a 10×10 grid (rows A-J, cols 1-10)
- generate_image: Generate botanical illustrations

Always acknowledge before using a tool ("Let me look that up..." / "One sec...").

Be warm, be helpful, be brief.`;

// ---------------------------------------------------------------------------
// Tool Declarations
// ---------------------------------------------------------------------------

const demoTools = [
  {
    type: "function",
    function: {
      name: "identify_plant",
      description: "Identify plant species from the user's photo",
      parameters: {
        type: "object",
        properties: {
          context: {
            type: "string",
            description: "Additional context from the user about the plant",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "diagnose_plant",
      description: "Diagnose health issues from the user's photo",
      parameters: {
        type: "object",
        properties: {
          symptoms: {
            type: "string",
            description: "Symptoms described by the user",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research",
      description: "Search the web for plant care information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query about plant care",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_stores",
      description:
        "Find local stores selling plant supplies. IMPORTANT: Only call this AFTER the user has provided their zip code or city.",
      parameters: {
        type: "object",
        properties: {
          product: {
            type: "string",
            description: "What product to search for",
          },
          location: {
            type: "string",
            description:
              "User's zip code or city (REQUIRED — ask user first if not provided)",
          },
        },
        required: ["product", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an educational botanical illustration. Use when a visual guide would help the user understand a concept.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "What to illustrate",
          },
          title: {
            type: "string",
            description: "Title for the guide",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_environment",
      description:
        "Analyze growing environment from a photo. Assess light, space, and conditions.",
      parameters: {
        type: "object",
        properties: {
          plant_species: {
            type: "string",
            description: "Plant species for context",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_store_inventory",
      description: "Check if a specific store carries a product",
      parameters: {
        type: "object",
        properties: {
          store_name: {
            type: "string",
            description: "Full store name with location",
          },
          product: {
            type: "string",
            description: "Product to check",
          },
          location: {
            type: "string",
            description: "City or ZIP",
          },
        },
        required: ["store_name", "product", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_think",
      description:
        "Route a complex question to a smarter model for deeper reasoning. Use for diagnosis, treatment plans, complex care questions.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The full question with all relevant context",
          },
          context: {
            type: "string",
            description: "Additional context",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_visual_guide",
      description:
        "Generate a detailed text-based visual care guide for a plant topic.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "What to illustrate: repotting, pruning, pest ID, etc.",
          },
          plant_species: {
            type: "string",
            description: "Plant species for context",
          },
        },
        required: ["topic"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

async function callVisionAgent(
  task: "identify" | "diagnose" | "environment",
  base64Image: string,
  context: string,
  apiKey: string,
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const prompts: Record<string, string> = {
    identify: `You are a plant identification expert. Analyze this image and identify the plant.
Return ONLY valid JSON with this structure:
{
  "species": "Scientific name",
  "commonName": "Common name",
  "confidence": 0.0-1.0,
  "family": "Plant family",
  "origin": "Geographic origin",
  "care": {
    "light": "light requirements",
    "water": "watering needs",
    "humidity": "humidity preference",
    "toxic": true/false
  },
  "notes": "Brief observation about this specific specimen"
}`,
    diagnose: `You are a plant pathologist. Analyze this image for health issues.
Return ONLY valid JSON with this structure:
{
  "issue": "Primary issue identified",
  "severity": "mild|moderate|severe",
  "symptoms": ["list", "of", "visible", "symptoms"],
  "treatment": ["step 1", "step 2", "step 3"],
  "prevention": "How to prevent this in the future"
}
If the plant looks healthy, set issue to "healthy" and severity to "none".`,
    environment: `You are a horticultural environment analyst. Analyze this image of a growing environment.
Return ONLY valid JSON with this structure:
{
  "lightLevel": "low|medium|bright|direct",
  "lightNotes": "description of light conditions",
  "spaceAssessment": "description of available space",
  "humidity": "estimated humidity level",
  "temperature": "estimated temperature conditions",
  "recommendations": ["actionable recommendation 1", "recommendation 2"],
  "suitablePlants": ["plant species that would thrive here"]
}`,
  };

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: prompts[task] },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: context || "Analyze this plant image.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 1.0,
          thinking_config: { thinking_level: "low" },
        }),
      },
    );

    if (!response.ok) {
      console.error(`[DemoAgent] Vision error: ${response.status}`);
      return { success: false, error: "Vision analysis failed" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to extract JSON
    let jsonStr = content.trim();
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return { success: true, data: parsed };
    } catch {
      return { success: true, data: { raw: content } };
    }
  } catch (error) {
    console.error("[DemoAgent] Vision agent error:", error);
    return { success: false, error: String(error) };
  }
}

async function generateImage(
  prompt: string,
  title: string,
  apiKey: string,
): Promise<{
  success: boolean;
  url?: string;
  title?: string;
  error?: string;
}> {
  const stylePrompt = `Create a botanical illustration for: "${title}"

${prompt}

MANDATORY STYLE:
- Pure black background (#000000), no exceptions
- White and light gray line art only
- All text labels in monospace pixel font style (IMPORTANT: "monospace" is a font rendering instruction — do NOT write the word "monospace" as visible text anywhere in the image)
- Clean, minimal, educational
- No colored backgrounds, no gradients
- Annotations in white text with thin white arrows
- Consistent with a brutalist, monochrome aesthetic`;

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: stylePrompt }],
          modalities: ["image", "text"],
          temperature: 1.0,
          thinking_config: { thinking_level: "low" },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[DemoAgent] Image gen error:", response.status, errText);
      return {
        success: false,
        error: `Image generation failed: ${response.status}`,
      };
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // Extract base64 image from response
    // Lovable gateway returns images in message.images array
    const imageData =
      message?.images?.[0]?.image_url?.url ||
      message?.content?.find?.((p: any) => p.type === "image_url")?.image_url
        ?.url;

    if (imageData) {
      return { success: true, url: imageData, title };
    }

    // Fallback: check if content has inline base64
    if (
      typeof message?.content === "string" &&
      message.content.includes("data:image")
    ) {
      const b64Match = message.content.match(
        /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/,
      );
      if (b64Match) {
        return { success: true, url: b64Match[0], title };
      }
    }

    console.error(
      "[DemoAgent] No image in response:",
      JSON.stringify(message).substring(0, 500),
    );
    return { success: false, error: "No image generated" };
  } catch (error) {
    console.error("[DemoAgent] Image gen error:", error);
    return { success: false, error: String(error) };
  }
}

// callDeepThink is now imported from ../_shared/deepThink.ts

async function executeDemoTool(
  toolName: string,
  args: Record<string, unknown>,
  media: { type: string; data: string }[] | undefined,
  apiKey: string,
  perplexityKey: string | undefined,
  payload: DemoTokenPayload,
  geminiApiKey?: string,
): Promise<{
  result: string;
  images?: { url: string; title: string }[];
  imgUsed?: boolean;
}> {
  console.log(`[DemoAgent] Executing tool: ${toolName}`, Object.keys(args));

  switch (toolName) {
    case "identify_plant": {
      if (!media?.length) {
        return {
          result: JSON.stringify({
            error: "No image provided. Please send a photo of your plant.",
          }),
        };
      }
      const visionResult = await callVisionAgent(
        "identify",
        media[0].data,
        (args.context as string) || "",
        apiKey,
      );
      return {
        result: JSON.stringify(
          visionResult.data || { error: visionResult.error },
        ),
      };
    }

    case "diagnose_plant": {
      if (!media?.length) {
        return {
          result: JSON.stringify({
            error:
              "No image provided. Please send a photo of the affected area.",
          }),
        };
      }
      const visionResult = await callVisionAgent(
        "diagnose",
        media[0].data,
        (args.symptoms as string) || "",
        apiKey,
      );
      return {
        result: JSON.stringify(
          visionResult.data || { error: visionResult.error },
        ),
      };
    }

    case "research": {
      const query = args.query as string;
      // Try Perplexity first, fallback to Gemini
      if (perplexityKey) {
        const researchResult = await callResearchAgent(query, perplexityKey);
        if (researchResult.success) {
          return {
            result: JSON.stringify({
              content: researchResult.data,
              citations: researchResult.citations || [],
            }),
          };
        }
      }
      // Fallback: use Gemini via Lovable gateway
      try {
        const response = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a plant care research assistant. Provide concise, accurate information. Keep responses under 150 words.",
                },
                { role: "user", content: query },
              ],
              temperature: 1.0,
              thinking_config: { thinking_level: "low" },
            }),
          },
        );
        if (!response.ok) {
          return { result: JSON.stringify({ error: "Research failed" }) };
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return { result: JSON.stringify({ content }) };
      } catch (error) {
        return { result: JSON.stringify({ error: String(error) }) };
      }
    }

    case "find_stores": {
      const product = args.product as string;
      const location = args.location as string | undefined;

      if (!location) {
        return {
          result: JSON.stringify({
            promptForLocation: true,
            message:
              "I need a location to search. Ask the user for their zip code or city.",
          }),
        };
      }

      const storeResult = await callMapsShoppingAgent(
        product,
        "any",
        location,
        geminiApiKey || apiKey,
        perplexityKey,
      );

      if (storeResult.promptForLocation) {
        return {
          result: JSON.stringify({
            promptForLocation: true,
            message:
              "I need a location to search. Ask the user for their zip code or city.",
          }),
        };
      }

      return {
        result: JSON.stringify(
          storeResult.data || { error: storeResult.error },
        ),
      };
    }

    case "generate_image": {
      // Check image limit
      if (payload.img >= MAX_IMAGES) {
        return {
          result: JSON.stringify({
            error: "Image generation limit reached for this demo session.",
          }),
        };
      }

      const imageResult = await generateImage(
        args.prompt as string,
        (args.title as string) || "Botanical Guide",
        apiKey,
      );

      if (imageResult.success && imageResult.url) {
        return {
          result: JSON.stringify({
            success: true,
            title: imageResult.title,
            imageGenerated: true,
          }),
          images: [
            {
              url: imageResult.url,
              title: imageResult.title || "Botanical Guide",
            },
          ],
          imgUsed: true,
        };
      }

      return {
        result: JSON.stringify({
          error: imageResult.error || "Image generation failed",
        }),
      };
    }

    case "analyze_environment": {
      if (!media?.length) {
        return {
          result: JSON.stringify({
            error:
              "No image provided. Please send a photo of the environment.",
          }),
        };
      }
      const envResult = await callVisionAgent(
        "environment",
        media[0].data,
        (args.plant_species as string) || "",
        apiKey,
      );
      return {
        result: JSON.stringify(
          envResult.data || { error: envResult.error },
        ),
      };
    }

    case "verify_store_inventory": {
      if (!perplexityKey) {
        return {
          result: JSON.stringify({
            error: "Store verification not configured",
          }),
        };
      }
      const storeResult = await verifyStoreInventory(
        args.store_name as string,
        args.product as string,
        (args.location as string) || null,
        perplexityKey,
      );
      return {
        result: JSON.stringify(
          storeResult.data || { error: storeResult.error },
        ),
      };
    }

    case "deep_think": {
      const dtResult = await callDeepThink(
        args.question as string,
        args.context as string | undefined,
        apiKey,
      );
      return { result: JSON.stringify(dtResult) };
    }

    case "generate_visual_guide": {
      const guideResult = await callDeepThink(
        `Create a detailed care guide for: ${args.topic as string}${args.plant_species ? ` (${args.plant_species})` : ""}. Be specific and actionable.`,
        undefined,
        apiKey,
      );
      return { result: JSON.stringify(guideResult) };
    }

    default:
      return {
        result: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
      };
  }
}

// ---------------------------------------------------------------------------
// Route: POST /demo-agent/chat (also handles legacy requests with no sub-path)
// ---------------------------------------------------------------------------

async function handleChat(
  req: Request,
  LOVABLE_API_KEY: string,
  DEMO_HMAC_SECRET: string,
  PERPLEXITY_API_KEY: string | undefined,
  GEMINI_API_KEY?: string,
): Promise<Response> {
  const body: DemoChatRequest = await req.json();
  const { messages, media, demoToken } = body;

  // 1. Validate or create HMAC token
  let payload: DemoTokenPayload;
  if (demoToken) {
    const verified = await verifyToken(demoToken, DEMO_HMAC_SECRET);
    if (!verified) {
      return jsonResponse(
        {
          error: "invalid_token",
          message:
            "Session expired or invalid. Please start a new conversation.",
          // Legacy compat: include content for old callers
          content:
            "Session expired or invalid. Please start a new conversation.",
        },
        401,
      );
    }
    payload = verified;
  } else {
    // New session
    payload = {
      sid: crypto.randomUUID(),
      txt: 0,
      vox: 0,
      img: 0,
      ts: Math.floor(Date.now() / 1000),
    };
  }

  // 2. Check turn limits
  if (payload.txt >= MAX_TEXT_TURNS) {
    const token = await signToken(payload, DEMO_HMAC_SECRET);
    return jsonResponse({
      error: "limit_reached",
      message:
        "You've used all your demo turns! Message me on Telegram for unlimited chats.",
      content:
        "You've used all your demo turns! Message me on Telegram @orchidcare_bot for unlimited chats.",
      signupUrl: "https://t.me/orchidcare_bot?start=demo",
      demoToken: token,
      turnsRemaining: {
        text: MAX_TEXT_TURNS - payload.txt,
        voice: MAX_VOICE_TURNS - payload.vox,
        images: MAX_IMAGES - payload.img,
      },
      limitReached: true,
    });
  }

  console.log(
    `[DemoAgent] Chat: sid=${payload.sid.substring(0, 8)}, txt=${payload.txt}/${MAX_TEXT_TURNS}, msgs=${messages.length}`,
  );

  // 3. Build LLM messages — only last N turns
  const trimmedMessages = messages.slice(-(MAX_HISTORY_TURNS * 2));
  const aiMessages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

  for (let i = 0; i < trimmedMessages.length; i++) {
    const msg = trimmedMessages[i];
    const isLastUserMsg =
      msg.role === "user" && i === trimmedMessages.length - 1;

    if (isLastUserMsg && media?.length) {
      // Last user message with media attached
      aiMessages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: msg.content || "What can you tell me about this plant?",
          },
          ...media.map((m) => ({
            type: "image_url",
            image_url: { url: `data:${m.type};base64,${m.data}` },
          })),
        ],
      });
    } else {
      aiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // 4. Stream response — emit tool status events as they happen, then final result
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      let finalContent: string | null = null;
      let generatedImages: { url: string; title: string }[] = [];
      let imgIncrement = 0;

      try {
        emit({ event: "status", label: "thinking" });
        console.log("[DemoAgent] Calling LLM (initial)...");
        const t0 = Date.now();

        const response = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: aiMessages,
              tools: demoTools,
              tool_choice: "auto",
              response_format: { type: "json_object" },
              thinking_config: { thinking_level: "low" },
              temperature: 1.0,
            }),
          },
        );

        console.log(`[DemoAgent] LLM initial response: ${response.status} (${Date.now() - t0}ms)`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[DemoAgent] LLM error:", response.status, errorText);
          const token = await signToken(payload, DEMO_HMAC_SECRET);
          emit({
            event: "done",
            data: {
              artifact: {
                type: "chat",
                data: { text: "Something went wrong. Please try again." },
              },
              message: "Something went wrong. Please try again.",
              content: "Something went wrong. Please try again.",
              pixelFormation: null,
              demoToken: token,
              turnsRemaining: {
                text: MAX_TEXT_TURNS - payload.txt,
                voice: MAX_VOICE_TURNS - payload.vox,
                images: MAX_IMAGES - payload.img,
              },
            },
          });
          controller.close();
          return;
        }

        let data = await response.json();
        let message = data.choices?.[0]?.message;

        // 5. Handle tool calls (max iterations)
        let iteration = 0;
        while (
          message?.tool_calls?.length &&
          iteration < MAX_TOOL_ITERATIONS
        ) {
          iteration++;
          console.log(
            `[DemoAgent] Tool iteration ${iteration}: ${message.tool_calls.map((tc: any) => tc.function.name).join(", ")}`,
          );

          // Execute each tool call
          const toolResults: any[] = [];
          for (const toolCall of message.tool_calls) {
            const fnName = toolCall.function.name;

            // Stream tool name to client
            emit({ event: "tool", name: fnName });
            console.log(`[DemoAgent] Executing tool: ${fnName}`);
            const toolT0 = Date.now();

            let args: Record<string, unknown>;
            try {
              args =
                typeof toolCall.function.arguments === "string"
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function.arguments || {};
            } catch {
              args = {};
            }

            const toolOutput = await executeDemoTool(
              fnName,
              args,
              media,
              LOVABLE_API_KEY,
              PERPLEXITY_API_KEY,
              payload,
              GEMINI_API_KEY,
            );
            console.log(`[DemoAgent] Tool ${fnName} done (${Date.now() - toolT0}ms)`);

            if (toolOutput.images) {
              generatedImages.push(...toolOutput.images);
            }
            if (toolOutput.imgUsed) {
              imgIncrement++;
            }

            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              content: toolOutput.result,
            });
          }

          // Preserve raw tool_calls array (includes thought_signature in extra_content)
          aiMessages.push(
            {
              role: "assistant",
              content: message.content || null,
              tool_calls: message.tool_calls,
            },
            ...toolResults,
          );

          // Signal that we're back to thinking while LLM processes results
          emit({ event: "status", label: "thinking" });
          console.log(`[DemoAgent] Calling LLM follow-up (iteration ${iteration})...`);
          const followT0 = Date.now();

          // Follow-up call with tool results
          const followUpResponse = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: aiMessages,
                tools: demoTools,
                tool_choice: "auto",
                response_format: { type: "json_object" },
                thinking_config: { thinking_level: "low" },
                temperature: 1.0,
              }),
            },
          );

          console.log(`[DemoAgent] LLM follow-up response: ${followUpResponse.status} (${Date.now() - followT0}ms)`);

          if (!followUpResponse.ok) {
            console.error(
              "[DemoAgent] Follow-up LLM error:",
              followUpResponse.status,
            );
            const token = await signToken(payload, DEMO_HMAC_SECRET);
            emit({
              event: "done",
              data: {
                artifact: {
                  type: "chat",
                  data: {
                    text: "Something went wrong processing that. Please try again.",
                  },
                },
                message:
                  "Something went wrong processing that. Please try again.",
                content:
                  "Something went wrong processing that. Please try again.",
                pixelFormation: null,
                demoToken: token,
                turnsRemaining: {
                  text: MAX_TEXT_TURNS - payload.txt,
                  voice: MAX_VOICE_TURNS - payload.vox,
                  images: MAX_IMAGES - payload.img,
                },
              },
            });
            controller.close();
            return;
          }

          data = await followUpResponse.json();
          message = data.choices?.[0]?.message;
        }

        finalContent =
          message?.content ||
          "I'm here to help with your plants! Send me a photo or ask me anything.";
      } catch (error) {
        console.error("[DemoAgent] Error during LLM calls:", error);
        const token = await signToken(payload, DEMO_HMAC_SECRET);
        emit({
          event: "done",
          data: {
            artifact: {
              type: "chat",
              data: { text: "Something went wrong. Please try again." },
            },
            message: "Something went wrong. Please try again.",
            content: "Something went wrong. Please try again.",
            pixelFormation: null,
            demoToken: token,
            turnsRemaining: {
              text: MAX_TEXT_TURNS - payload.txt,
              voice: MAX_VOICE_TURNS - payload.vox,
              images: MAX_IMAGES - payload.img,
            },
          },
        });
        controller.close();
        return;
      }

      // 6. Parse structured response
      const parsed = parseLLMJson(finalContent);

      // 7. Increment turn count and sign new token
      payload.txt += 1;
      payload.img += imgIncrement;
      const isLastTurn = payload.txt >= MAX_TEXT_TURNS;
      const newToken = await signToken(payload, DEMO_HMAC_SECRET);

      // 8. Build final response
      const responseData: Record<string, unknown> = {
        artifact: parsed.artifact,
        message: parsed.message,
        content: parsed.message,
        pixelFormation: parsed.pixelFormation,
        demoToken: newToken,
        turnsRemaining: {
          text: MAX_TEXT_TURNS - payload.txt,
          voice: MAX_VOICE_TURNS - payload.vox,
          images: MAX_IMAGES - payload.img,
        },
      };

      if (isLastTurn) responseData.limitReached = true;
      if (generatedImages.length > 0) responseData.images = generatedImages;

      console.log(
        `[DemoAgent] Response: artifact=${(parsed.artifact as any).type}, txt=${payload.txt}/${MAX_TEXT_TURNS}, imgs=${generatedImages.length}`,
      );

      emit({ event: "done", data: responseData });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

// ---------------------------------------------------------------------------
// Route: POST /demo-agent/voice-token
// ---------------------------------------------------------------------------

async function handleVoiceToken(
  req: Request,
  DEMO_HMAC_SECRET: string,
  GEMINI_API_KEY: string,
): Promise<Response> {
  const body: VoiceTokenRequest = await req.json();

  // 1. Validate HMAC token — or create fresh session if none provided
  let payload: DemoTokenPayload;
  if (body.demoToken) {
    const verified = await verifyToken(body.demoToken, DEMO_HMAC_SECRET);
    if (!verified) {
      return jsonResponse(
        {
          error: "invalid_token",
          message:
            "Session expired or invalid. Please start a new conversation.",
        },
        401,
      );
    }
    payload = verified;
  } else {
    // New session — allow voice without prior text conversation
    payload = {
      sid: crypto.randomUUID(),
      txt: 0,
      vox: 0,
      img: 0,
      ts: Math.floor(Date.now() / 1000),
    };
  }

  // 2. Check voice turn limit
  if (payload.vox >= MAX_VOICE_TURNS) {
    const token = await signToken(payload, DEMO_HMAC_SECRET);
    return jsonResponse({
      error: "limit_reached",
      message:
        "You've used all your demo voice turns! Message me on Telegram for unlimited calls.",
      signupUrl: "https://t.me/orchidcare_bot?start=demo",
      demoToken: token,
      turnsRemaining: {
        text: MAX_TEXT_TURNS - payload.txt,
        voice: MAX_VOICE_TURNS - payload.vox,
        images: MAX_IMAGES - payload.img,
      },
      limitReached: true,
    });
  }

  // 3. Increment vox count
  payload.vox += 1;

  // 4. Mint ephemeral Gemini Live token
  try {
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const token = await genai.authTokens.create({
      config: {
        uses: 1,
        liveConnectConstraints: {
          model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Algenib" },
              },
            },
            systemInstruction: {
              parts: [{ text: DEMO_VOICE_SYSTEM_PROMPT }],
            },
            thinkingConfig: { thinkingBudget: 512 },
            tools: [{
              functionDeclarations: [
                {
                  name: "research",
                  description: "Search the web for plant care information",
                  behavior: "NON_BLOCKING",
                  parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Search query" } }, required: ["query"] },
                },
                {
                  name: "identify_plant",
                  description: "Identify a plant from your visual observation. Describe what you see.",
                  parameters: { type: "OBJECT", properties: { description: { type: "STRING", description: "Visual description of the plant" }, context: { type: "STRING", description: "Additional context" } }, required: ["description"] },
                },
                {
                  name: "diagnose_plant",
                  description: "Diagnose plant health from your visual observation.",
                  parameters: { type: "OBJECT", properties: { description: { type: "STRING", description: "Description of symptoms" }, plant_species: { type: "STRING", description: "Species if known" } }, required: ["description"] },
                },
                {
                  name: "analyze_environment",
                  description: "Analyze growing environment from what you see on camera.",
                  parameters: { type: "OBJECT", properties: { description: { type: "STRING", description: "Environment description" }, plant_species: { type: "STRING", description: "Plant for context" } }, required: ["description"] },
                },
                {
                  name: "find_stores",
                  description: "Find local stores for plant supplies",
                  behavior: "NON_BLOCKING",
                  parameters: { type: "OBJECT", properties: { product_query: { type: "STRING", description: "What to look for" }, store_type: { type: "STRING", description: "nursery, garden_center, hardware_store, or any" } }, required: ["product_query"] },
                },
                {
                  name: "verify_store_inventory",
                  description: "Check if a store carries a product",
                  behavior: "NON_BLOCKING",
                  parameters: { type: "OBJECT", properties: { store_name: { type: "STRING", description: "Store name" }, product: { type: "STRING", description: "Product" }, location: { type: "STRING", description: "City or ZIP" } }, required: ["store_name", "product", "location"] },
                },
                {
                  name: "deep_think",
                  description: "Route complex questions to a smarter model for expert reasoning.",
                  behavior: "NON_BLOCKING",
                  parameters: { type: "OBJECT", properties: { question: { type: "STRING", description: "Full question with context" }, context: { type: "STRING", description: "Additional context" } }, required: ["question"] },
                },
                {
                  name: "show_visual",
                  description: "Display a plant or tool silhouette on the pixel canvas. Always use type='template' with an id from the asset library. Animations queue — keep to 1-2 per response.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING", description: "Always use 'template'" },
                      id: { type: "STRING", description: "Template ID. E.g. 'monstera_deliciosa', 'watering_can', 'pruning_shears'" },
                      transition: { type: "STRING", description: "Animation: 'morph', 'dissolve', 'scatter', 'ripple'" },
                      hold: { type: "INTEGER", description: "Seconds to hold. 0 = stay. Default: 8" },
                    },
                    required: ["type"],
                  },
                },
                {
                  name: "annotate_view",
                  description: "Draw pixel-art annotations on the user's camera feed. Use when video is active to point out features — leaf damage, pests, placement spots, soil issues. Places markers on a 10×10 grid. Pass empty markers array to dismiss.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      markers: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            region: { type: "STRING", description: "Grid region (10×10): rows A (top) to J (bottom), cols 1 (left) to 10 (right). E.g. A1 (top-left), E5 (center), J10 (bottom-right)" },
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
                  name: "generate_image",
                  description: "Generate an image from a description.",
                  behavior: "NON_BLOCKING",
                  parameters: { type: "OBJECT", properties: { prompt: { type: "STRING", description: "Image description" } }, required: ["prompt"] },
                },
                {
                  name: "generate_visual_guide",
                  description: "Generate a detailed care guide for a plant topic. Returns text that can be shown as an overlay.",
                  behavior: "NON_BLOCKING",
                  parameters: { type: "OBJECT", properties: { topic: { type: "STRING", description: "What to cover: repotting, pruning, pest ID, etc." }, plant_species: { type: "STRING", description: "Plant species for context" } }, required: ["topic"] },
                },
              ],
            }],
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    const ephemeralToken = token.name;
    if (!ephemeralToken) {
      throw new Error("token.name is empty");
    }

    // 5. Sign updated token
    const newDemoToken = await signToken(payload, DEMO_HMAC_SECRET);

    console.log(
      `[DemoAgent] Voice token minted: sid=${payload.sid.substring(0, 8)}, vox=${payload.vox}/${MAX_VOICE_TURNS}`,
    );

    return jsonResponse({
      token: ephemeralToken,
      demoToken: newDemoToken,
      turnsRemaining: {
        text: MAX_TEXT_TURNS - payload.txt,
        voice: MAX_VOICE_TURNS - payload.vox,
        images: MAX_IMAGES - payload.img,
      },
    });
  } catch (error) {
    console.error("[DemoAgent] Voice token error:", error);
    // Don't consume a turn on error — revert vox increment
    payload.vox -= 1;
    const token = await signToken(payload, DEMO_HMAC_SECRET);
    return jsonResponse(
      {
        error: "voice_token_failed",
        message: "Failed to start voice call. Please try again.",
        demoToken: token,
        turnsRemaining: {
          text: MAX_TEXT_TURNS - payload.txt,
          voice: MAX_VOICE_TURNS - payload.vox,
          images: MAX_IMAGES - payload.img,
        },
      },
      502,
    );
  }
}

// ---------------------------------------------------------------------------
// Route: POST /demo-agent/voice-tools
// ---------------------------------------------------------------------------

async function handleVoiceTools(
  req: Request,
  DEMO_HMAC_SECRET: string,
  LOVABLE_API_KEY: string,
  PERPLEXITY_API_KEY: string | undefined,
  GEMINI_API_KEY?: string,
): Promise<Response> {
  const body = await req.json();
  const { toolName, toolArgs, demoToken } = body;

  // Verify demo token
  if (demoToken) {
    const payload = await verifyToken(demoToken, DEMO_HMAC_SECRET);
    if (!payload) {
      return jsonResponse({ error: "invalid_token" }, 401);
    }
  }

  const args = toolArgs || {};

  console.log(`[DemoAgent] Voice tool: ${toolName}`);

  let result: Record<string, unknown>;

  switch (toolName) {
    case "research": {
      if (!PERPLEXITY_API_KEY) {
        result = { success: false, error: "Research not configured" };
        break;
      }
      result = await callResearchAgent(args.query, PERPLEXITY_API_KEY);
      break;
    }

    case "identify_plant":
    case "diagnose_plant":
    case "analyze_environment": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Not configured" };
        break;
      }
      const taskPrompts: Record<string, string> = {
        identify_plant:
          "You are a plant identification expert. Based on this description, identify the plant. Return JSON: { species, confidence, commonNames: [], careSummary }",
        diagnose_plant:
          "You are a plant pathologist. Based on this description, diagnose the issue. Return JSON: { diagnosis, severity, treatment, prevention }",
        analyze_environment:
          "You are a horticultural environment analyst. Based on this description, assess conditions. Return JSON: { lightLevel, lightNotes, spaceAssessment, recommendations: [] }",
      };
      const prompt =
        (args.description || "") +
        (args.plant_species ? `\nSpecies: ${args.plant_species}` : "") +
        (args.context ? `\nContext: ${args.context}` : "");
      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: taskPrompts[toolName] },
              { role: "user", content: prompt },
            ],
          }),
        },
      );
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || "";
      try {
        result = { success: true, data: JSON.parse(text) };
      } catch {
        result = { success: true, data: text };
      }
      break;
    }

    case "find_stores": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Not configured" };
        break;
      }
      result = await callMapsShoppingAgent(
        args.product_query,
        args.store_type || "any",
        null,
        GEMINI_API_KEY || LOVABLE_API_KEY,
        PERPLEXITY_API_KEY,
      );
      break;
    }

    case "verify_store_inventory": {
      if (!PERPLEXITY_API_KEY) {
        result = { success: false, error: "Not configured" };
        break;
      }
      result = await verifyStoreInventory(
        args.store_name,
        args.product,
        args.location,
        PERPLEXITY_API_KEY,
      );
      break;
    }

    case "deep_think": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Not configured" };
        break;
      }
      result = await callDeepThink(
        args.question,
        args.context,
        LOVABLE_API_KEY,
      );
      break;
    }

    case "generate_image": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Not configured" };
        break;
      }
      const styledPrompt = `${args.prompt}\n\nVISUAL STYLE — "Botanical Pixels":\n- Clean WHITE background for maximum legibility\n- Illustrated botanical plants and foliage (detailed, lush, naturalistic — NOT pixel art for the plants themselves)\n- Typography: "Press Start 2P" style pixel font for headers, monospace for labels\n- Layout: grid-based, structured information design with clear visual hierarchy\n- Annotations: thin dark lines, small monospace labels, well-placed arrows\n- Color palette: rich botanical greens and earth tones, black text, subtle gray grid lines\n- NO watercolor washes, NO cream/beige backgrounds\n- Keep all text highly legible — avoid placing text over busy illustration areas\n- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`;
      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            modalities: ["image", "text"],
            messages: [{ role: "user", content: styledPrompt }],
          }),
        },
      );
      const data = await resp.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      result = imageUrl
        ? { success: true, imageUrl }
        : { success: false, error: "No image generated" };
      break;
    }

    case "generate_visual_guide": {
      if (!LOVABLE_API_KEY) {
        result = { success: false, error: "Not configured" };
        break;
      }
      result = await callDeepThink(
        `Create a detailed care guide for: ${args.topic}${args.plant_species ? ` (${args.plant_species})` : ""}. Be specific and actionable.`,
        undefined,
        LOVABLE_API_KEY,
      );
      break;
    }

    default:
      result = { success: false, error: `Unknown tool: ${toolName}` };
  }

  return jsonResponse({ result });
}

// ---------------------------------------------------------------------------
// Main Server
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const DEMO_HMAC_SECRET = Deno.env.get("DEMO_HMAC_SECRET");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

  if (!LOVABLE_API_KEY) {
    return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);
  }
  if (!DEMO_HMAC_SECRET) {
    return jsonResponse({ error: "DEMO_HMAC_SECRET not configured" }, 500);
  }

  // Path-based routing
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    switch (path) {
      case "chat":
        return await handleChat(
          req,
          LOVABLE_API_KEY,
          DEMO_HMAC_SECRET,
          PERPLEXITY_API_KEY,
          GEMINI_API_KEY,
        );

      case "voice-token":
        if (!GEMINI_API_KEY) {
          return jsonResponse(
            { error: "GEMINI_API_KEY not configured" },
            500,
          );
        }
        return await handleVoiceToken(req, DEMO_HMAC_SECRET, GEMINI_API_KEY);

      case "voice-tools":
        return await handleVoiceTools(
          req,
          DEMO_HMAC_SECRET,
          LOVABLE_API_KEY,
          PERPLEXITY_API_KEY,
          GEMINI_API_KEY,
        );

      default:
        // Backward compat: no sub-path → treat as chat
        // This handles the legacy identify-feature.tsx MockChat calls
        return await handleChat(
          req,
          LOVABLE_API_KEY,
          DEMO_HMAC_SECRET,
          PERPLEXITY_API_KEY,
          GEMINI_API_KEY,
        );
    }
  } catch (error) {
    console.error("[DemoAgent] Unhandled error:", error);
    return jsonResponse(
      {
        error: "internal_error",
        message: "Something went wrong. Please try again.",
        content: "Something went wrong. Please try again.",
      },
      500,
    );
  }
});

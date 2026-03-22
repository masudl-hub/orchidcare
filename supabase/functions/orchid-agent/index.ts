import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

// Shared modules
import { resolvePlants, capturePlantSnapshot } from "../_shared/tools.ts";
import { callResearchAgent, callMapsShoppingAgent, geocodeLocation } from "../_shared/research.ts";
import { loadHierarchicalContext, buildEnrichedSystemPrompt } from "../_shared/context.ts";
import { allAgentToolsOpenAI } from "../_shared/toolDefinitions.ts";
import { executeSharedTool } from "../_shared/toolRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Combine all tools
const allTools = allAgentToolsOpenAI;

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
    diagnose: `You are a plant pathologist. Analyze this image for health issues. Also identify the species.
Return ONLY valid JSON with this structure:
{
  "species": "Scientific name (Common name)",
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
    const modelsToTry = ["google/gemini-3.1-pro-preview", "google/gemini-3-flash-preview"];
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
// MULTIMEDIA AGENTS
// ============================================================================

interface ImageGuideStep {
  step: number;
  description: string;
  imageUrl: string;
  storagePath?: string;
}

/**
 * Send a photo directly to a Telegram chat via Bot API.
 * Used for fire-and-forget delivery during guide generation.
 */
async function sendPhotoToTelegram(
  chatId: string,
  imageBase64: string,
  imageType: string,
  caption: string,
  botToken: string,
): Promise<boolean> {
  try {
    const binaryData = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([binaryData], { type: `image/${imageType}` });

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("photo", blob, `guide-step.${imageType}`);
    if (caption) formData.append("caption", caption);

    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[sendPhotoToTelegram] Failed: ${resp.status} — ${errText.substring(0, 200)}`);
      return false;
    }
    console.log(`[sendPhotoToTelegram] Sent photo to chat ${chatId}`);
    return true;
  } catch (err) {
    console.error(`[sendPhotoToTelegram] Error:`, err);
    return false;
  }
}

async function callImageGenerationAgent(
  supabase: any,
  profileId: string,
  task: string,
  plantSpecies: string | null,
  stepCount: number,
  LOVABLE_API_KEY: string,
  telegramChatId?: string,
  telegramBotToken?: string,
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

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- Think illustrated botanical field guide meets retro game UI — beautiful plant drawings with pixel-font headers
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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

Show the cutting clearly with visible nodes.

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
          },
          2: {
            title: "REMOVE & INSPECT ROOTS",
            details: `Show: Plant being gently removed, root ball inspection.

MUST include labels:
- "STEP 2: REMOVE & INSPECT"
- "Gently loosen roots if root-bound"
- "Trim any dead/rotting roots"
- "Healthy roots are white/tan, firm"

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
        },
        2: {
          title: "MAIN ACTION",
          details: `Show the main action for "${task}" with ${species}.
          
MUST include labels:
- "STEP 2: MAIN ACTION"  
- Show exactly what to do
- Label the "why" behind the technique
- Include timing/frequency if relevant

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
        },
        3: {
          title: "AFTERCARE",
          details: `Show aftercare for "${task}" with ${species}.

MUST include labels:
- "STEP 3: AFTERCARE"
- Recovery expectations and timeline
- Ongoing care requirements
- Signs of success to look for

VISUAL STYLE — "Botanical Pixels":
- Clean WHITE background for maximum legibility
- Illustrated botanical plants and foliage (detailed, lush, naturalistic illustrations — NOT pixel art for the plants themselves)
- Typography: "Press Start 2P" style pixel font for step titles/headers, monospace for labels and annotations
- Layout: grid-based, structured information design with clear visual hierarchy
- Annotations: use thin dark lines and small monospace labels, well-placed arrows
- Color palette: rich botanical greens and earth tones for plants, black text, subtle gray grid lines
- NO watercolor washes, NO cream/beige backgrounds
- Keep all text highly legible — avoid placing text over busy illustration areas
- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`,
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
2. VISUAL STYLE — "Botanical Pixels": Clean WHITE background, illustrated botanical plants (detailed, lush, naturalistic — NOT pixel art for plants), "Press Start 2P" style pixel font for headers, monospace for labels, grid-based layout, thin dark annotation lines, rich botanical greens and earth tones, NO watercolor washes, NO cream/beige backgrounds
3. Make annotations legible and well-placed — avoid placing text over busy illustration areas
4. This is step ${step} of ${stepCount} - make it clear this is part of a sequence
5. FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Never write "Press Start 2P", "monospace", or any font/style name as literal visible text in the image — these are font rendering directives, not content to display`;

      console.log(`[ImageGenAgent] Starting parallel generation for step ${step}/${stepCount}...`);

      // Retry loop: max 2 attempts with 2s backoff
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image-preview",
              messages: [{ role: "user", content: stepPrompt }],
              modalities: ["image", "text"],
            }),
          });

          if (!response.ok) {
            console.warn(`[ImageGenAgent] Step ${step} attempt ${attempt} failed: ${response.status}`);
            if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
            return null;
          }

          const data = await response.json();
          const messageContent = data.choices?.[0]?.message?.content || "";
          const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (imageData && imageData.startsWith("data:image")) {
            const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
            if (base64Match) {
              const imageType = base64Match[1];
              const base64Data = base64Match[2];

              // If Telegram delivery is enabled, send directly BEFORE storage upload
              if (telegramChatId && telegramBotToken) {
                const caption = `Step ${step}: ${stepTitle}\n${messageContent || ""}`.substring(0, 1024);
                await sendPhotoToTelegram(telegramChatId, base64Data, imageType, caption, telegramBotToken);
              }

              // Upload to Supabase Storage (non-blocking relative to Telegram delivery)
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
                // Image was already sent to Telegram if applicable, so not a total failure
                return null;
              }

              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from("generated-guides")
                .createSignedUrl(fileName, 3600);

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
                storagePath: fileName,
              };
            }
          }

          console.warn(`[ImageGenAgent] No image in response for step ${step}, attempt ${attempt}`);
          if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
          return null;
        } catch (stepError) {
          console.warn(`[ImageGenAgent] Step ${step} attempt ${attempt} error:`, stepError);
          if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
          return null;
        }
      }
      return null;
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
    await supabase.from("generated_content").insert([{
      profile_id: profileId,
      content_type: "image_guide",
      task_description: task,
      content: { steps: images, plant_species: plantSpecies },
    }]);

    console.log(`[ImageGenAgent] Successfully generated ${images.length}/${stepCount} step images in parallel`);

    // If images were already sent directly to Telegram, return empty images array
    // so mediaToSend stays empty (images already delivered)
    if (telegramChatId && telegramBotToken) {
      return { success: true, images: [] };
    }
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
        model: "google/gemini-3.1-pro-preview",
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
    await supabase.from("generated_content").insert([{
      profile_id: profileId,
      content_type: "video_analysis",
      task_description: analysisFocus,
      content: analysis,
    }]);

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
        model: "google/gemini-3.1-pro-preview",
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
    await supabase.from("generated_content").insert([{
      profile_id: profileId,
      content_type: "voice_transcript",
      task_description: transcription.intent,
      content: transcription,
    }]);

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

    console.log("[ContextEngineering] Generated summary:", summaryJson.summary?.substring(0, 100) ?? '(empty)');

    // Save the summary
    const messageIds = toSummarize.map((m: any) => m.id);
    await supabase.from("conversation_summaries").insert([{
      profile_id: profileId,
      summary: summaryJson.summary,
      key_topics: summaryJson.key_topics,
      message_count: 5,
      start_time: toSummarize[0].created_at,
      end_time: toSummarize[4].created_at,
      source_message_ids: messageIds,
    }]);

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
    await supabase.from("agent_operations").insert([{
      profile_id: profileId,
      correlation_id: correlationId,
      operation_type: operationType,
      table_name: tableName,
      record_id: recordId,
      tool_name: toolName,
      metadata: metadata || null,
    }]);
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


// ============================================================================
// VISUAL DESCRIPTION GENERATOR (for plant snapshot memory)
// ============================================================================

async function generateVisualDescription(
  base64Image: string,
  species: string,
  context: "identification" | "diagnosis" | "routine_check" | "user_requested",
  LOVABLE_API_KEY: string,
): Promise<string> {
  try {
    const contextPrompts: Record<string, string> = {
      identification: `Describe this ${species} plant in detail for future visual recognition. Include: size, color, leaf shape/count, distinguishing features, pot type, and overall health appearance. Be specific enough that someone could match this plant from a different photo later. 2-3 sentences max.`,
      diagnosis: `Describe the current visual state of this ${species} plant, focusing on health indicators. Note: leaf color, any discoloration/spots/wilting, growth patterns, and overall vitality. Be specific about problem areas. 2-3 sentences max.`,
      routine_check: `Describe the current state of this ${species} plant for a growth timeline. Note size, new growth, leaf count, color, and any changes that would be notable over time. 2-3 sentences max.`,
      user_requested: `Provide a detailed visual description of this ${species} plant. Include size, shape, color, leaf characteristics, pot, and any notable features. 2-3 sentences max.`,
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: contextPrompts[context] || contextPrompts.identification },
          {
            role: "user",
            content: [
              { type: "text", text: `Describe this ${species} plant for visual memory.` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error(`[generateVisualDescription] Failed: ${response.status}`);
      return "";
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[generateVisualDescription] Generated ${description.length} char description`);
    return description;
  } catch (error) {
    console.error("[generateVisualDescription] Error:", error);
    return "";
  }
}



// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {


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

    let body: string;
    let numMedia = 0;
    let messageSid: string;
    let proactiveContext: { events: any[]; eventSummary: string } | null = null;
    let requestChannel = "telegram";
    let profile: any = null;
    let internalMediaInfo: { base64: string; mimeType: string } | null = null;
    let confirmationGranted = false;
    let skipInboundSave = false;

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
      messageSid = crypto.randomUUID();

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

      requestChannel = payload.channel || "telegram";
      confirmationGranted = !!payload.confirmationGranted;
      skipInboundSave = !!payload.skipInboundSave;
      console.log(`[${correlationId}] Internal call channel: ${requestChannel}, message length: ${body.length}${confirmationGranted ? ', confirmationGranted=true' : ''}${skipInboundSave ? ', skipInboundSave=true' : ''}`);
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

      // Build a natural "internal thought" that Orchid will use to generate the message
      // This feels like Orchid naturally thinking of the user, not a system command
      const eventDescriptions = proactivePayload.events.map((e: any) => e.message_hint).join(", ");
      body = `[Internal: I'm thinking about my friend and want to check in. ${eventDescriptions}. Let me reach out naturally.]`;

      messageSid = crypto.randomUUID();

      proactiveContext = {
        events: proactivePayload.events,
        eventSummary: proactivePayload.eventSummary,
      };

      console.log(`[${correlationId}] Proactive context: ${eventDescriptions}`);
    } else {
      // Only internal agent calls and proactive triggers are supported
      console.error(`[orchid-agent] Received unsupported request type. Returning error.`);
      return new Response(JSON.stringify({ error: "Unsupported request type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channel = requestChannel;

    console.log(
      `[${correlationId}] ${isProactiveTrigger ? "🔔 Proactive" : "📨 Internal"} TELEGRAM for profile ${profile?.id}`,
    );
    if (numMedia > 0) console.log(`[${correlationId}] Media attached: internal base64`);




    // Store incoming message (skip for proactive and confirmation re-executions)
    let inboundMessage: any = null;
    if (!isProactiveTrigger && !skipInboundSave) {
      // Idempotency check: if this message_sid was already processed, return early
      if (messageSid) {
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("message_sid", messageSid)
          .maybeSingle();

        if (existing) {
          console.log(`[${correlationId}] Duplicate message_sid ${messageSid} — skipping`);
          return new Response(JSON.stringify({ reply: "", deduplicated: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: msgData } = await supabase
        .from("conversations")
        .insert([{
          profile_id: profile?.id,
          channel,
          direction: "inbound",
          content: body,
          message_sid: messageSid,
          media_urls: null,
        }])
        .select()
        .single();
      inboundMessage = msgData;
    }

    // Load hierarchical context
    const hierarchicalContext = await loadHierarchicalContext(supabase, profile?.id);

    // Get user's plants for context
    const { data: userPlants } = await supabase
      .from("plants")
      .select("id, name, species, nickname, location_in_home")
      .eq("profile_id", profile?.id);

    // Get latest 3 snapshots per plant for visual context
    const plantIds = (userPlants || []).map((p: any) => p.id);
    let plantSnapshots: any[] = [];
    if (plantIds.length > 0) {
      const { data: snaps } = await supabase
        .from("plant_snapshots")
        .select("id, plant_id, description, health_notes, context, created_at")
        .eq("profile_id", profile?.id)
        .in("plant_id", plantIds)
        .order("created_at", { ascending: false })
        .limit(plantIds.length * 3); // ~3 per plant
      plantSnapshots = snaps || [];
    }

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



    // Best-effort upload of incoming plant photos to storage
    let uploadedPhotoPath: string | null = null;
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
      plantSnapshots,
      channel,
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
    // Storage paths for DB persistence (format: "bucket:path" or full URL for external).
    // These are resolved to fresh signed URLs on load, avoiding 1-hour expiry issues.
    let mediaPathsForDB: string[] = [];
    const toolsUsed: string[] = [];
    const allToolResults: { id: string; name: string; result: any }[] = [];

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

        console.log("Orchestrator response:", JSON.stringify(message, null, 2).substring(0, 200));

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
        // toolsUsed is declared at handler scope (line 2683)

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
            toolsUsed.push(functionName);

            // Policy enforcement is handled inside executeSharedTool via policyEnforcer.
            // If a tool requires confirmation, the result will contain requiresConfirmation: true
            // and the client/bot will show a confirmation UI.

            // Pre-log the operation so UI can show "thinking..." -> "researching..." instantly
            await logAgentOperation(
              supabase,
              profile?.id,
              correlationId,
              "started",
              functionName, // using tool name as table_name for these temporary events
              null,
              functionName,
              { status: "running", args }
            );

            let toolResult: any;

            // Try shared dispatch first (handles ~20 common DB/API tools)
            const shared = await executeSharedTool(
              {
                supabase,
                profileId: profile?.id,
                apiKeys: {
                  PERPLEXITY: PERPLEXITY_API_KEY,
                  LOVABLE: LOVABLE_API_KEY,
                  GEMINI: Deno.env.get("GEMINI_API_KEY") || undefined,
                  SERPAPI: Deno.env.get("SERPAPI_KEY") || undefined,
                },
                sourceMessageId: inboundMessage?.id,
                photoUrl: uploadedPhotoPath || undefined,
                // Use profile+channel as stable session ID (not per-request correlationId)
                // so session_consent persists across messages within a conversation
                sessionId: `${profile?.id}:${channel}`,
                confirmationGranted,
              },
              functionName,
              args,
            );
            if (shared.handled) {
              toolResult = shared.result;

              // Policy gate: if confirmation is required, save state and return
              if (toolResult?.requiresConfirmation) {
                console.log(`[${correlationId}] Tool ${functionName} requires confirmation (${toolResult.tier})`);

                // Mark the "started" operation as awaiting confirmation (not orphaned)
                await logAgentOperation(
                  supabase, profile?.id, correlationId,
                  "awaiting_confirmation", functionName, null, functionName,
                  { status: "awaiting_confirmation", tier: toolResult.tier, args },
                );

                // Save outbound message so it appears in conversation history on refresh
                const confirmReply = toolResult.reason || `"${functionName}" requires your confirmation.`;
                await supabase.from("conversations").insert([{
                  profile_id: profile?.id,
                  channel,
                  direction: "outbound",
                  content: confirmReply,
                  message_sid: `confirm-${correlationId}`,
                }]); // best-effort

                return new Response(JSON.stringify({
                  reply: confirmReply,
                  requiresConfirmation: true,
                  pendingAction: {
                    tool_name: functionName,
                    args,
                    reason: toolResult.reason,
                    tier: toolResult.tier,
                  },
                  mediaToSend: [],
                  toolsUsed,
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }

              // Special post-processing: sync in-memory profile for subsequent tools
              if (functionName === "update_profile" && toolResult?.success && profile) {
                if (args.field === "pets" || args.field === "primary_concerns") {
                  (profile as any)[args.field] = (args.value as string).split(",").map((v: string) => v.trim().toLowerCase());
                } else {
                  (profile as any)[args.field] = toolResult.updated?.value ?? args.value;
                }
              }
            }

            // Path-specific agent tools (vision, media, complex orchestration)
            else if (functionName === "identify_plant") {
              if (mediaInfo?.mediaType === "image") {
                toolResult = await callVisionAgent(
                  "identify",
                  mediaInfo.base64,
                  args.user_context || body,
                  LOVABLE_API_KEY,
                );

                if (toolResult.success && toolResult.data) {
                  // Enrich tool result with explicit confidence string for orchestrator reasoning
                  toolResult.data.confidenceFormatted = `${((toolResult.data.confidence ?? 0) * 100).toFixed(0)}%`;

                  const { data: identification } = await supabase
                    .from("plant_identifications")
                    .insert({
                      profile_id: profile?.id,
                      photo_url: uploadedPhotoPath,
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

                  // Auto-capture plant snapshot for visual memory
                  // Try to match to an existing saved plant
                  if (uploadedPhotoPath) {
                    const species = toolResult.data.species || "Unknown";
                    // Find ALL matching plants — exact species first, then fuzzy
                    const { data: exactMatch } = await supabase
                      .from("plants")
                      .select("id, name, nickname, species, location_in_home")
                      .eq("profile_id", profile?.id)
                      .ilike("species", species);
                    const matchedPlants = (exactMatch && exactMatch.length > 0)
                      ? exactMatch
                      : await supabase
                          .from("plants")
                          .select("id, name, nickname, species, location_in_home")
                          .eq("profile_id", profile?.id)
                          .or(`name.ilike.%${species}%,species.ilike.%${species}%`)
                          .then(({ data }: { data: any }) => data);

                    if (matchedPlants && matchedPlants.length > 0) {
                      const plant = matchedPlants[0]; // use first for snapshot

                      // Surface ALL matches so the LLM can reason about which one
                      toolResult.data._possible_matches = matchedPlants.map((p: any) => ({
                        id: p.id,
                        name: p.nickname || p.name,
                        species: p.species,
                        location: p.location_in_home,
                      }));
                      if (matchedPlants.length === 1) {
                        toolResult.data._possible_matches_hint = `The user has "${plant.nickname || plant.name}" (${plant.species}) in their collection${plant.location_in_home ? ` — ${plant.location_in_home}` : ""}. This photo is likely of that plant. Reference it by ID (${plant.id}) in follow-up tool calls.`;
                      } else {
                        toolResult.data._possible_matches_hint = `The user has ${matchedPlants.length} plants matching "${species}": ${matchedPlants.map((p: any) => `"${p.nickname || p.name}"${p.location_in_home ? ` (${p.location_in_home})` : ""}`).join(", ")}. Compare the photo with the visual descriptions in your context to determine which one, or ask the user.`;
                      }

                      // Generate a visual description via a quick LLM call
                      const descResult = await generateVisualDescription(
                        mediaInfo.base64,
                        species,
                        "identification",
                        LOVABLE_API_KEY,
                      );

                      // Check for previous snapshots before capturing (temporal awareness)
                      const { data: prevSnaps } = await supabase
                        .from("plant_snapshots")
                        .select("description, health_notes, created_at")
                        .eq("plant_id", plant.id)
                        .order("created_at", { ascending: false })
                        .limit(1);

                      await capturePlantSnapshot(
                        supabase,
                        profile?.id,
                        {
                          plant_identifier: plant.nickname || plant.name,
                          description: descResult || `${species} - identified from photo`,
                          context: "identification",
                          source: "telegram_photo",
                        },
                        uploadedPhotoPath,
                        inboundMessage?.id,
                      );
                      console.log(`[VisualMemory] Auto-captured snapshot for ${plant.nickname || plant.name}`);

                      // Inject temporal context so the agent can mention changes
                      if (prevSnaps && prevSnaps.length > 0) {
                        const prev = prevSnaps[0];
                        const daysSince = Math.round((Date.now() - new Date(prev.created_at).getTime()) / (1000 * 60 * 60 * 24));
                        toolResult.data._temporal_context = {
                          previousDescription: prev.description,
                          previousHealthNotes: prev.health_notes,
                          daysSinceLastSnapshot: daysSince,
                          plantName: plant.nickname || plant.name,
                          hint: `You last saw this plant ${daysSince} day(s) ago. Previous description: "${prev.description}". Compare with what you see now and mention any notable changes.`,
                        };
                      }
                    }
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
                  // Try to link to an existing plant — first by user-provided name, then by diagnosed species
                  let diagnosePlantId: string | null = null;
                  let diagnosePlantMatch: any = null;
                  if (args.plant_identifier || args.plant_name) {
                    const plantRef = args.plant_identifier || args.plant_name;
                    const { data: matchedPlants } = await supabase
                      .from("plants")
                      .select("id, name, nickname, species")
                      .eq("profile_id", profile?.id)
                      .or(`name.ilike.%${plantRef}%,nickname.ilike.%${plantRef}%,species.ilike.%${plantRef}%`)
                      .limit(1);
                    if (matchedPlants && matchedPlants.length > 0) {
                      diagnosePlantId = matchedPlants[0].id;
                      diagnosePlantMatch = matchedPlants[0];
                    }
                  }
                  // Fallback: match by species from the diagnosis result
                  if (!diagnosePlantId && toolResult.data.species) {
                    const species = toolResult.data.species;
                    const { data: speciesMatch } = await supabase
                      .from("plants")
                      .select("id, name, nickname, species, location_in_home")
                      .eq("profile_id", profile?.id)
                      .ilike("species", species);
                    if (speciesMatch && speciesMatch.length > 0) {
                      diagnosePlantId = speciesMatch[0].id;
                      diagnosePlantMatch = speciesMatch[0];
                    }
                  }
                  // Surface all matches so the LLM can reason about which plant
                  if (diagnosePlantMatch) {
                    if (toolResult.data.species && !args.plant_identifier) {
                      // If matched by species (not explicit user ref), check for siblings
                      const { data: siblings } = await supabase
                        .from("plants")
                        .select("id, name, nickname, species, location_in_home")
                        .eq("profile_id", profile?.id)
                        .ilike("species", toolResult.data.species);
                      if (siblings && siblings.length > 1) {
                        // Replace single match with full list
                        toolResult.data._possible_matches = siblings.map((p: any) => ({
                          id: p.id, name: p.nickname || p.name, species: p.species, location: p.location_in_home,
                        }));
                        toolResult.data._possible_matches_hint = `The user has ${siblings.length} plants matching "${toolResult.data.species}". Compare with visual descriptions in your context or ask the user which one.`;
                      }
                    }
                    if (!toolResult.data._possible_matches) {
                      toolResult.data._possible_matches = [{
                        id: diagnosePlantMatch.id,
                        name: diagnosePlantMatch.nickname || diagnosePlantMatch.name,
                        species: diagnosePlantMatch.species,
                        location: diagnosePlantMatch.location_in_home,
                      }];
                      toolResult.data._possible_matches_hint = `This diagnosis likely applies to the user's "${diagnosePlantMatch.nickname || diagnosePlantMatch.name}" (ID: ${diagnosePlantMatch.id}).`;
                    }
                  }

                  const { data: diagnosis } = await supabase
                    .from("plant_identifications")
                    .insert({
                      profile_id: profile?.id,
                      plant_id: diagnosePlantId,
                      photo_url: uploadedPhotoPath,
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

                  // Auto-capture snapshot for diagnosis visual memory
                  if ((uploadedPhotoPath) && diagnosePlantId) {
                    const diagPlant = await supabase
                      .from("plants")
                      .select("name, nickname, species")
                      .eq("id", diagnosePlantId)
                      .single();

                    if (diagPlant.data) {
                      const descResult = await generateVisualDescription(
                        mediaInfo.base64,
                        diagPlant.data.species || diagPlant.data.name,
                        "diagnosis",
                        LOVABLE_API_KEY,
                      );

                      // Check for previous snapshots (temporal awareness)
                      const { data: prevSnaps } = await supabase
                        .from("plant_snapshots")
                        .select("description, health_notes, created_at")
                        .eq("plant_id", diagnosePlantId)
                        .order("created_at", { ascending: false })
                        .limit(1);

                      await capturePlantSnapshot(
                        supabase,
                        profile?.id,
                        {
                          plant_identifier: diagPlant.data.nickname || diagPlant.data.name,
                          description: descResult || `Diagnosis photo - ${toolResult.data.diagnosis}`,
                          context: "diagnosis",
                          source: "telegram_photo",
                          health_notes: `${toolResult.data.diagnosis} (${toolResult.data.severity}). Treatment: ${toolResult.data.treatment || "none"}`,
                        },
                        uploadedPhotoPath,
                        inboundMessage?.id,
                      );
                      console.log(`[VisualMemory] Auto-captured diagnosis snapshot for ${diagPlant.data.nickname || diagPlant.data.name}`);

                      // Inject temporal context for the agent
                      if (prevSnaps && prevSnaps.length > 0) {
                        const prev = prevSnaps[0];
                        const daysSince = Math.round((Date.now() - new Date(prev.created_at).getTime()) / (1000 * 60 * 60 * 24));
                        toolResult.data._temporal_context = {
                          previousDescription: prev.description,
                          previousHealthNotes: prev.health_notes,
                          daysSinceLastSnapshot: daysSince,
                          plantName: diagPlant.data.nickname || diagPlant.data.name,
                          hint: `You last saw this plant ${daysSince} day(s) ago. Previous: "${prev.description}"${prev.health_notes ? ` Health then: "${prev.health_notes}"` : ""}. Compare with current diagnosis and mention whether the plant has improved, worsened, or changed.`,
                        };
                      }
                    }
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
            } else if (functionName === "analyze_environment") {
              toolResult = { success: false, error: "No photo attached. Please send a photo of the environment so I can assess the growing conditions." };
            } else if (functionName === "generate_visual_guide") {
              // Thread telegramChatId for fire-and-forget delivery
              const telegramChatId = (channel === "telegram" && profile?.telegram_chat_id)
                ? String(profile.telegram_chat_id)
                : undefined;
              const telegramBotToken = telegramChatId
                ? Deno.env.get("TELEGRAM_BOT_TOKEN") || undefined
                : undefined;

              toolResult = await callImageGenerationAgent(
                supabase,
                profile?.id,
                args.task,
                args.plant_species || null,
                args.step_count || 3,
                LOVABLE_API_KEY,
                telegramChatId,
                telegramBotToken,
              );

              // Add generated images to media queue for sending
              if (toolResult.success && toolResult.images) {
                for (const img of toolResult.images) {
                  mediaToSend.push({ url: img.imageUrl, caption: img.description });
                  mediaPathsForDB.push(`generated-guides:${img.storagePath}`);
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
            // capture_plant_snapshot is now handled by toolRouter (shared path)
            } else if (functionName === "recall_media") {
              const source = args.source;
              const limit = Math.min(args.limit || 3, 5);

              if (source === "plant_snapshots") {
                if (!args.plant_identifier) {
                  toolResult = { success: false, error: "Need a plant name to look up snapshots" };
                } else {
                  const resolution = await resolvePlants(supabase, profile?.id, args.plant_identifier);
                  if (resolution.plants.length === 0) {
                    toolResult = { success: false, error: `No plant found matching "${args.plant_identifier}"` };
                  } else {
                    const plant = resolution.plants[0];
                    const { data: snapshots } = await supabase
                      .from("plant_snapshots")
                      .select("image_path, description, created_at, context")
                      .eq("plant_id", plant.id)
                      .eq("profile_id", profile?.id)
                      .order("created_at", { ascending: false })
                      .limit(limit);

                    const images: { url: string; caption: string }[] = [];
                    for (const snap of (snapshots || [])) {
                      if (snap.image_path) {
                        const { data: signed } = await supabase.storage
                          .from("plant-photos")
                          .createSignedUrl(snap.image_path, 3600);
                        if (signed?.signedUrl) {
                          const date = new Date(snap.created_at).toLocaleDateString();
                          const caption = `${date}: ${snap.description || snap.context}`;
                          images.push({ url: signed.signedUrl, caption });
                          mediaToSend.push({ url: signed.signedUrl, caption });
                          mediaPathsForDB.push(`plant-photos:${snap.image_path}`);
                        }
                      }
                    }
                    toolResult = {
                      success: true,
                      retrieved: images.length,
                      plantName: plant.nickname || plant.species || plant.name,
                    };
                    await logAgentOperation(
                      supabase,
                      profile?.id,
                      correlationId,
                      "read",
                      "plant_snapshots",
                      null,
                      functionName,
                      { plant: toolResult.plantName, retrieved: images.length },
                    );
                  }
                }
              } else if (source === "generated_guides") {
                const { data: guides } = await supabase
                  .from("generated_content")
                  .select("content, task_description, created_at")
                  .eq("profile_id", profile?.id)
                  .eq("content_type", "image_guide")
                  .order("created_at", { ascending: false })
                  .limit(1);

                const images: { url: string; caption: string }[] = [];
                for (const guide of (guides || [])) {
                  const steps = (guide.content as any)?.steps || [];
                  for (const step of steps.slice(0, limit)) {
                    const path = step.storagePath;
                    if (path) {
                      const { data: signed } = await supabase.storage
                        .from("generated-guides")
                        .createSignedUrl(path, 3600);
                      if (signed?.signedUrl) {
                        const caption = step.description || `Step ${step.step}`;
                        images.push({ url: signed.signedUrl, caption });
                        mediaToSend.push({ url: signed.signedUrl, caption });
                        mediaPathsForDB.push(`generated-guides:${path}`);
                      }
                    }
                  }
                }
                toolResult = {
                  success: true,
                  retrieved: images.length,
                  task: guides?.[0]?.task_description || "unknown",
                };
                await logAgentOperation(
                  supabase,
                  profile?.id,
                  correlationId,
                  "read",
                  "generated_content",
                  null,
                  functionName,
                  { retrieved: images.length },
                );
              } else {
                toolResult = { success: false, error: "Invalid source. Use 'plant_snapshots' or 'generated_guides'" };
              }
            }
            // Maps and Store verification tools
            else if (functionName === "find_stores") {
              const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
              const profileLatLng = (profile?.latitude && profile?.longitude)
                ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
                : undefined;
              toolResult = await callMapsShoppingAgent(
                args.product_query,
                args.store_type || "any",
                profile?.location || null,
                GEMINI_API_KEY,
                PERPLEXITY_API_KEY,
                profileLatLng,
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

              // NON-BLOCKING: Backfill lat/lng if profile is missing coordinates
              if (!profile?.latitude && profile?.location && profile?.id) {
                geocodeLocation(profile.location).then(coords => {
                  if (coords) {
                    supabase.from("profiles").update({
                      latitude: coords.lat,
                      longitude: coords.lng
                    }).eq("id", profile.id).then(() => {
                      console.log(`[${correlationId}] Backfilled coordinates for profile ${profile.id}`);
                    });
                  }
                }).catch(() => { });
              }

              // NON-BLOCKING: Cache store results in generated_content for follow-up queries
              if (toolResult.success && toolResult.data?.stores?.length > 0 && profile?.id) {
                supabase.from("generated_content").insert({
                  profile_id: profile.id,
                  content_type: "store_search",
                  content: {
                    stores: toolResult.data.stores,
                    searchedFor: toolResult.data.searchedFor,
                    location: toolResult.data.location,
                    timestamp: new Date().toISOString()
                  },
                  task_description: `Store search: ${args.product_query} near ${profile.location}`
                }).then(() => {
                  console.log(`[${correlationId}] Cached ${toolResult.data.stores.length} store results`);
                }).catch(() => { });
              }

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
            } else if (functionName === "get_cached_stores") {
              // Retrieve cached store search results from generated_content
              const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
              const { data: cachedResults } = await supabase
                .from("generated_content")
                .select("content, created_at, task_description")
                .eq("profile_id", profile?.id)
                .eq("content_type", "store_search")
                .gte("created_at", twentyFourHoursAgo)
                .order("created_at", { ascending: false })
                .limit(5);

              if (cachedResults && cachedResults.length > 0) {
                // Find the best match by checking if searchedFor overlaps with the query
                const queryLower = (args.product_query || "").toLowerCase();
                const bestMatch = cachedResults.find((r: any) =>
                  (r.content?.searchedFor || "").toLowerCase().includes(queryLower) ||
                  queryLower.includes((r.content?.searchedFor || "").toLowerCase())
                ) || cachedResults[0];

                const stores = bestMatch.content?.stores || [];
                console.log(`[${correlationId}] get_cached_stores: found ${stores.length} cached stores for "${args.product_query}"`);
                toolResult = {
                  success: true,
                  data: {
                    stores,
                    searchedFor: bestMatch.content?.searchedFor,
                    location: bestMatch.content?.location,
                    cachedAt: bestMatch.created_at,
                    totalStoresAvailable: stores.length,
                  },
                };
              } else {
                console.log(`[${correlationId}] get_cached_stores: no cached results, suggest calling find_stores`);
                toolResult = {
                  success: true,
                  data: {
                    stores: [],
                    message: "No recent store search results cached. Use find_stores to search for stores.",
                  },
                };
              }
              await logAgentOperation(
                supabase,
                profile?.id,
                correlationId,
                "read",
                "generated_content",
                null,
                functionName,
                { query: args.product_query },
              );
            } else if (functionName === "generate_image") {
              const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
              if (!LOVABLE_API_KEY) {
                toolResult = { success: false, error: "Image generation not configured" };
              } else {
                try {
                  const imageCount = Math.max(1, Math.min(6, Math.round(args.count ?? 1)));
                  const styledPrompt = `${args.prompt}\n\nVISUAL STYLE — "Botanical Pixels":\n- Clean WHITE background for maximum legibility\n- Illustrated botanical plants and foliage (detailed, lush, naturalistic — NOT pixel art for the plants themselves)\n- Typography: "Press Start 2P" style pixel font for headers, monospace for labels\n- Layout: grid-based, structured information design with clear visual hierarchy\n- Annotations: thin dark lines, small monospace labels, well-placed arrows\n- Color palette: rich botanical greens and earth tones, black text, subtle gray grid lines\n- NO watercolor washes, NO cream/beige backgrounds\n- Keep all text highly legible — avoid placing text over busy illustration areas\n- CRITICAL — FONT NAMES ARE RENDERING INSTRUCTIONS ONLY: Do NOT write "Press Start 2P", "monospace", or any font/style name as visible text in the image; these directives tell you which fonts to USE, not text to display`;

                  const imageUrls: string[] = [];
                  for (let i = 0; i < imageCount; i++) {
                    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        model: "google/gemini-3.1-flash-image-preview",
                        modalities: ["image", "text"],
                        messages: [{ role: "user", content: styledPrompt }],
                      }),
                    });
                    const data = await response.json();
                    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                    if (imageUrl) {
                      imageUrls.push(imageUrl);
                      mediaToSend.push({ url: imageUrl, caption: args.prompt || "" });
                      mediaPathsForDB.push(imageUrl);
                    }
                  }

                  toolResult = imageUrls.length > 0
                    ? { success: true, imageUrl: imageUrls[0], imageUrls, count: imageUrls.length }
                    : { success: false, error: "No image generated" };
                } catch (err) {
                  toolResult = { success: false, error: String(err) };
                }
              }
            }
            // ── IoT Sensor Tool Handlers ──────────────────────────────────────
            
            else {
              toolResult = { success: false, error: `Unknown tool: ${functionName}` };
            }

            toolResults.push({
              id: toolCall.id,
              name: functionName,
              result: toolResult,
            });
            allToolResults.push({
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
                const confidence = tr.result.data.confidence ?? 0;
                const species = tr.result.data.species;
                const careSummary = tr.result.data.careSummary;
                if (confidence >= 0.8) {
                  reply = `🌿 I identified this as ${species}! ${careSummary}`;
                } else if (confidence >= 0.5) {
                  reply = `🌿 This looks like it could be ${species}, but I'm not fully confident (confidence: ${(confidence * 100).toFixed(0)}%). Let me research this further to confirm.`;
                } else {
                  reply = `🌿 I'm having trouble identifying this plant with certainty. My best guess is ${species} but I'd recommend we verify. Can you send a clearer photo of the leaves, or I can research this?`;
                }
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

    // Collect structured data from tool results for rich card rendering
    const structuredResults: Record<string, any> = {};
    for (const tr of allToolResults) {
      if (tr.name === "search_products" && tr.result?.success && tr.result?.data?.products?.length > 0) {
        structuredResults.products = tr.result.data.products;
        structuredResults.productSearchQuery = tr.result.data.searchedFor;
      }
      if (tr.name === "find_stores" && tr.result?.success && tr.result?.data?.stores?.length > 0) {
        structuredResults.stores = tr.result.data.stores;
        structuredResults.storeSearchQuery = tr.result.data.searchedFor;
        structuredResults.storeLocation = tr.result.data.location;
      }
    }

    console.log("Orchid Reply:", aiReply);

    // Store outgoing message
    await supabase.from("conversations").insert({
      profile_id: profile?.id,
      channel,
      direction: "outbound",
      content: aiReply,
      // Store storage paths (bucket:path) so they can be re-signed on reload.
      // Falls back to raw signed URLs for any legacy/external images not in our storage.
      media_urls: mediaPathsForDB.length > 0 ? mediaPathsForDB : (mediaToSend.length > 0 ? mediaToSend.map(m => m.url) : null),
    });

    // Trigger background compression check
    maybeCompressHistory(supabase, profile?.id, LOVABLE_API_KEY).catch((err) => {
      console.error("[ContextEngineering] Background compression error:", err);
    });

    // ========================================================================
    // RETURN JSON RESPONSE
    // ========================================================================
    console.log(`[${correlationId}] Returning JSON response (${aiReply.length} chars, ${mediaToSend.length} media)`);
    return new Response(JSON.stringify({
      reply: aiReply,
      mediaToSend: mediaToSend,
      toolsUsed: toolsUsed,
      structuredResults: Object.keys(structuredResults).length > 0 ? structuredResults : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return new Response(JSON.stringify({
      error: "Internal agent error",
      detail: String(error).substring(0, 200),
      reply: "I had a little hiccup! Could you try again? 🌱",
      mediaToSend: [],
      toolsUsed: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Shared tool executor for voice call sessions.
// Used by call-session and dev-call-proxy.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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
} from "./tools.ts";
import {
  callResearchAgent,
  callMapsShoppingAgent,
  verifyStoreInventory,
} from "./research.ts";
import { callDeepThink } from "./deepThink.ts";

export async function executeTool(
  supabase: SupabaseClient,
  profileId: string,
  toolName: string,
  args: Record<string, unknown>,
  PERPLEXITY_API_KEY?: string,
  LOVABLE_API_KEY?: string,
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  console.log(`[ToolExecutor] ${toolName}, args=${JSON.stringify(args).substring(0, 500)}`);

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
        const prompt = (args.description as string) +
          (args.plant_species ? `\nPlant species: ${args.plant_species}` : "") +
          (args.context ? `\nContext: ${args.context}` : "");
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
  console.log(`[ToolExecutor] ${toolName} complete (${elapsed}ms)`);
  return result;
}

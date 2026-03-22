// Shared tool dispatch — single source of truth for the ~20 tools that are
// identical across agent (Telegram/PWA) and voice (call-session) paths.
//
// Returns { handled: true, result } for known shared tools.
// Returns { handled: false } for path-specific tools (vision, image gen, etc.)
// that the caller must handle.
//
// Callers add their own orchestration concerns:
//   - orchid-agent: audit logging, media handling, agentic retries
//   - voiceToolHandler: lean stateless execution for voice calls

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
  comparePlantSnapshots,
  checkPlantSensors,
  associateReading,
  setPlantRanges,
  getSensorHistory,
  comparePlantEnvironments,
  manageDevice,
  dismissSensorAlert,
} from "./tools.ts";
import { callResearchAgent, verifyStoreInventory, searchProducts, analyzeUrl } from "./research.ts";
import { callDeepThink } from "./tools.ts";
import { enforcePolicy } from "./policyEnforcer.ts";
import { TOOL_POLICIES } from "./toolDefinitions.ts";

export interface ToolContext {
  supabase: any;
  profileId: string;
  apiKeys: {
    PERPLEXITY?: string;
    LOVABLE?: string;
    GEMINI?: string;
    SERPAPI?: string;
  };
  sourceMessageId?: string;
  /** Optional media URL for save_plant photo attachment. */
  photoUrl?: string;
  /** "interactive" (chat/call), "heartbeat", or "proactive". Defaults to "interactive". */
  executionPath?: "interactive" | "heartbeat" | "proactive";
  /** Session/correlation ID for session_consent tracking. */
  sessionId?: string;
  /** True if the client already showed a confirmation UI and user approved. */
  confirmationGranted?: boolean;
}

interface DispatchResult {
  handled: boolean;
  result?: Record<string, unknown>;
}

export async function executeSharedTool(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<DispatchResult> {
  const { supabase, profileId, apiKeys, sourceMessageId, photoUrl } = ctx;

  // ── Policy enforcement for write-path tools ────────────────────────────
  if (TOOL_POLICIES[toolName]) {
    let decision: Awaited<ReturnType<typeof enforcePolicy>>;
    try {
      decision = await enforcePolicy(
        supabase,
        profileId,
        toolName,
        ctx.executionPath || "interactive",
        ctx.sessionId,
        ctx.confirmationGranted,
      );
    } catch (err) {
      // If policy enforcement completely fails, fail-closed for destructive tools
      const defaults = TOOL_POLICIES[toolName];
      const isDestructive = defaults?.riskLevel === "destructive";
      console.error(`[ToolRouter] Policy enforcement failed for ${toolName}:`, err);
      if (isDestructive) {
        return handled({
          success: false,
          requiresConfirmation: true,
          tier: "always_confirm",
          tool_name: toolName,
          pendingArgs: args,
          reason: `"${toolName}" requires confirmation (policy check unavailable)`,
        });
      }
      // Non-destructive: proceed (fail-open for safe tools)
      decision = { allowed: true, tier: "auto" };
    }

    if (!decision.allowed) {
      return handled({
        success: false,
        requiresConfirmation: decision.requiresConfirmation || false,
        tier: decision.tier,
        tool_name: toolName,
        pendingArgs: args,
        reason: decision.reason || "Action not permitted",
      });
    }
  }

  switch (toolName) {
    // ── DB / Plant Management ────────────────────────────────────────────
    case "save_plant":
      return handled(await savePlant(supabase, profileId, args as any, photoUrl));

    case "modify_plant":
      return handled(await modifyPlant(supabase, profileId, args as any));

    case "delete_plant":
      return handled(await deletePlant(supabase, profileId, args as any));

    case "create_reminder":
      return handled(await createReminder(supabase, profileId, args as any, sourceMessageId));

    case "delete_reminder":
      return handled(await deleteReminder(supabase, profileId, args as any));

    case "log_care_event":
      return handled(await logCareEvent(supabase, profileId, args as any, sourceMessageId));

    case "save_user_insight":
      return handled(await saveUserInsight(supabase, profileId, args as any, sourceMessageId));

    case "update_notification_preferences":
      return handled(await updateNotificationPreferences(supabase, profileId, args as any));

    case "update_profile":
      return handled(await updateProfile(supabase, profileId, args as any));

    case "compare_plant_snapshots":
      return handled(
        await comparePlantSnapshots(
          supabase,
          profileId,
          args.plant_identifier as string,
          (args.comparison_type as string) || "latest",
          apiKeys.LOVABLE,
        ),
      );

    // ── Research / Shopping ───────────────────────────────────────────────
    case "research":
      if (!apiKeys.PERPLEXITY) return handled({ success: false, error: "Research not configured" });
      return handled(await callResearchAgent(args.query, apiKeys.PERPLEXITY));

    case "analyze_url":
      if (!apiKeys.LOVABLE) return handled({ success: false, error: "URL analysis not configured" });
      return handled(
        await analyzeUrl(
          args.url as string,
          (args.analysis_type as string) || "summarize",
          (args.question as string) || null,
          apiKeys.LOVABLE,
        ),
      );

    case "verify_store_inventory":
      if (!apiKeys.PERPLEXITY) return handled({ success: false, error: "Verification not configured" });
      return handled(await verifyStoreInventory(args.store_name, args.product, args.location, apiKeys.PERPLEXITY));

    case "search_products": {
      const serpKey = apiKeys.SERPAPI || Deno.env.get("SERPAPI_KEY");
      if (!serpKey) return handled({ success: false, error: "Product search not configured" });
      return handled(await searchProducts(args.query as string, serpKey, (args.max_results as number) || 5));
    }

    // ── Deep Think ───────────────────────────────────────────────────────
    case "deep_think":
      if (!apiKeys.LOVABLE) return handled({ success: false, error: "Deep think not configured" });
      return handled(await callDeepThink(args.question as string, args.context as string | undefined, apiKeys.LOVABLE));

    // ── IoT Sensors ──────────────────────────────────────────────────────
    case "check_plant_sensors":
      return handled(await checkPlantSensors(supabase, profileId, args as any));

    case "associate_reading":
      return handled(await associateReading(supabase, profileId, args as any));

    case "set_plant_ranges":
      return handled(await setPlantRanges(supabase, profileId, args as any, sourceMessageId));

    case "get_sensor_history":
      return handled(await getSensorHistory(supabase, profileId, args as any));

    case "compare_plant_environments":
      return handled(await comparePlantEnvironments(supabase, profileId, args as any));

    case "manage_device":
      return handled(await manageDevice(supabase, profileId, args as any));

    case "dismiss_sensor_alert":
      return handled(await dismissSensorAlert(supabase, profileId, args as any));

    // ── Not a shared tool — caller handles ───────────────────────────────
    default:
      return { handled: false };
  }
}

function handled(result: Record<string, unknown>): DispatchResult {
  return { handled: true, result };
}

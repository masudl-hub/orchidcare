// Action policy enforcement — architectural gate between tool proposal and execution.
// Replaces the broken "confirmed" / "user_confirmed" anti-pattern where the LLM
// self-authorized its own actions.
//
// Three tiers:
//   auto            → execute immediately (read-only + cotidian writes)
//   session_consent → first occurrence per session requires user confirmation,
//                     then auto-approved for 30 minutes
//   always_confirm  → every invocation requires user confirmation
//
// FAIL-CLOSED: On any error (missing table, query failure), destructive tools
// (always_confirm) require confirmation. Non-destructive tools fall back to auto.
//
// Enforcement points:
//   - toolRouter.ts calls enforcePolicy() before every write-path tool
//   - Voice: client shows ToolConfirmationCard for tier 2/3
//   - PWA: inline ConfirmationBubble
//   - Telegram: inline keyboard buttons

import { TOOL_POLICIES } from "./toolDefinitions.ts";
import type { ActionTier } from "./toolDefinitions.ts";

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  /** True when user must confirm before execution (tier 2 or 3). */
  requiresConfirmation?: boolean;
  tier: ActionTier;
  /** True if session consent was already granted (tier 2 auto-approved). */
  sessionConsentActive?: boolean;
}

/**
 * Check whether a tool call is permitted under the user's policy.
 *
 * @param executionPath - "interactive" (chat/call), "heartbeat", or "proactive"
 * @param sessionId - correlation ID or call session ID (for session_consent tracking)
 * @param confirmationGranted - true if the client already showed a confirmation UI
 *                              and the user approved (bypasses the gate this invocation)
 */
export async function enforcePolicy(
  supabase: any,
  profileId: string,
  toolName: string,
  executionPath: "interactive" | "heartbeat" | "proactive",
  sessionId?: string,
  confirmationGranted?: boolean,
): Promise<PolicyDecision> {
  // Canonical defaults — always available even if DB is down
  const defaults = TOOL_POLICIES[toolName];
  const defaultTier: ActionTier = defaults?.defaultTier ?? "auto";
  const defaultHeartbeat: boolean = defaults?.defaultHeartbeatAllowed ?? false;

  let tier: ActionTier = defaultTier;
  let heartbeatAllowed: boolean = defaultHeartbeat;

  // 1. Try to look up user's policy for this tool
  try {
    const { data: policy, error } = await supabase
      .from("tool_policies")
      .select("interactive_tier, heartbeat_allowed")
      .eq("profile_id", profileId)
      .eq("tool_name", toolName)
      .maybeSingle();

    if (!error && policy) {
      tier = policy.interactive_tier;
      heartbeatAllowed = policy.heartbeat_allowed;
    }
    // If error (e.g., table doesn't exist), we fall through to defaults.
    // Logged but not thrown — fail-closed for destructive, fail-open for safe.
    if (error) {
      console.error(`[PolicyEnforcer] DB error for ${toolName}: ${error.message}. Using defaults (tier=${defaultTier}).`);
    }
  } catch (err) {
    console.error(`[PolicyEnforcer] Exception querying policy for ${toolName}:`, err);
    // Fall through to defaults
  }

  // 2. Heartbeat / proactive path — binary allow/deny based on heartbeat_allowed
  if (executionPath === "heartbeat" || executionPath === "proactive") {
    if (!heartbeatAllowed) {
      return { allowed: false, tier, reason: `Not permitted for autonomous actions (${toolName})` };
    }
    return { allowed: true, tier };
  }

  // 3. Interactive path
  if (tier === "auto") {
    return { allowed: true, tier };
  }

  // If the client already confirmed (e.g., user tapped Allow on the confirmation card)
  if (confirmationGranted) {
    // For session_consent, record the consent so subsequent calls auto-approve
    if (tier === "session_consent" && sessionId) {
      try {
        await supabase.from("session_consents").upsert(
          { profile_id: profileId, tool_name: toolName, session_id: sessionId },
          { onConflict: "profile_id,tool_name,session_id" },
        );
      } catch (err) {
        console.error(`[PolicyEnforcer] Failed to record session consent:`, err);
        // Non-fatal — consent was already granted by the user
      }
    }
    return { allowed: true, tier, sessionConsentActive: tier === "session_consent" };
  }

  // Session consent — check for existing valid consent
  if (tier === "session_consent" && sessionId) {
    try {
      const { data: consent } = await supabase
        .from("session_consents")
        .select("id")
        .eq("profile_id", profileId)
        .eq("tool_name", toolName)
        .eq("session_id", sessionId)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (consent) {
        return { allowed: true, tier, sessionConsentActive: true };
      }
    } catch (err) {
      console.error(`[PolicyEnforcer] Failed to check session consent:`, err);
      // Fail-closed: if we can't verify consent, require it
    }
  }

  // Tier 2 or 3 without consent → requires confirmation
  return {
    allowed: false,
    requiresConfirmation: true,
    tier,
    reason: tier === "always_confirm"
      ? `"${toolName}" always requires your confirmation`
      : `"${toolName}" requires confirmation (first time this session)`,
  };
}

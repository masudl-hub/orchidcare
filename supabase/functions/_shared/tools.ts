// Shared database tool implementations
// Pure functions: (supabase, profileId, args) → result

import type { PlantResolutionResult } from "./types.ts";

// Map tool names to required capabilities
// NOTE: Only tools with DESTRUCTIVE or AUTONOMOUS actions need permission checks
// Core agentic features (identify, diagnose, research) are always allowed
export const TOOL_CAPABILITY_MAP: Record<string, string> = {
  // Destructive actions - require explicit permission
  delete_plant: "delete_plants",
  // Autonomous actions - require explicit permission
  create_reminder: "create_reminders",
  delete_reminder: "create_reminders", // Uses same permission as create
  // Notification preferences
  update_notification_preferences: "create_reminders", // Uses same permission as reminders
  // Profile updates - no capability needed, but has confirmation guard
  // 'update_profile': handled separately with user_confirmed check
};

// ============================================================================
// SHARED PLANT RESOLUTION UTILITY (Used by all bulk-capable tools)
// ============================================================================

/**
 * Centralized plant lookup supporting:
 * - Single plant: "my monstera", "Planty"
 * - All plants: "all", "all plants", "all my plants"
 * - By location: "all plants in the bedroom", "plants in the living room"
 * - By type/species: "all succulents", "all ferns", "all palms"
 */
export async function resolvePlants(supabase: any, profileId: string, identifier: string): Promise<PlantResolutionResult> {
  const lower = identifier.toLowerCase().trim();

  // Pattern: "all plants" or just "all"
  if (lower === "all" || lower === "all plants" || lower === "all my plants" || lower === "everything") {
    const { data } = await supabase.from("plants").select("*").eq("profile_id", profileId);
    console.log(`[resolvePlants] Matched ALL plants: ${data?.length || 0} found`);
    return { plants: data || [], isBulk: true, filter: { type: "all" } };
  }

  // Pattern: "all plants in [location]" or "plants in the [location]" or "[location] plants"
  const locationMatch = lower.match(/(?:all )?(?:plants? )?in (?:the |my )?(.+)/);
  const locationMatch2 = lower.match(/^(.+?) plants?$/);
  const locationValue = locationMatch?.[1]?.trim() || locationMatch2?.[1]?.trim();

  if (locationValue && !["all", "my"].includes(locationValue)) {
    const { data } = await supabase
      .from("plants")
      .select("*")
      .eq("profile_id", profileId)
      .ilike("location_in_home", `%${locationValue}%`);
    console.log(`[resolvePlants] Matched LOCATION "${locationValue}": ${data?.length || 0} found`);
    return { plants: data || [], isBulk: true, filter: { type: "location", value: locationValue } };
  }

  // Pattern: "all [species type]" (e.g., "all succulents", "all ferns", "all palms")
  const speciesMatch = lower.match(/^all (.+?)s?$/);
  if (speciesMatch && !speciesMatch[1].includes("plant") && !speciesMatch[1].includes("my")) {
    const speciesType = speciesMatch[1].trim();
    const { data } = await supabase
      .from("plants")
      .select("*")
      .eq("profile_id", profileId)
      .or(`species.ilike.%${speciesType}%,name.ilike.%${speciesType}%`);
    console.log(`[resolvePlants] Matched SPECIES "${speciesType}": ${data?.length || 0} found`);
    return { plants: data || [], isBulk: true, filter: { type: "species", value: speciesType } };
  }

  // Default: Single plant fuzzy lookup
  const { data } = await supabase
    .from("plants")
    .select("*")
    .eq("profile_id", profileId)
    .or(`name.ilike.%${identifier}%,nickname.ilike.%${identifier}%,species.ilike.%${identifier}%`)
    .limit(1);

  console.log(`[resolvePlants] Single plant lookup "${identifier}": ${data?.length || 0} found`);
  return { plants: data || [], isBulk: false };
}

export async function savePlant(
  supabase: any,
  profileId: string,
  args: { species: string; nickname?: string; location?: string; notes?: string },
  photoUrl?: string,
): Promise<{ success: boolean; plant?: any; error?: string }> {
  try {
    const { data: plant, error } = await supabase
      .from("plants")
      .insert({
        profile_id: profileId,
        name: args.species,
        species: args.species,
        nickname: args.nickname || null,
        location_in_home: args.location || null,
        notes: args.notes || null,
        photo_url: photoUrl || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving plant:", error);
      return { success: false, error: error.message };
    }

    console.log("Saved plant:", plant.id);
    return { success: true, plant };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function modifyPlant(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; updates?: { nickname?: string; location?: string; notes?: string } },
): Promise<{
  success: boolean;
  plant?: any;
  plants?: any[];
  plantsCount?: number;
  filter?: { type: string; value?: string };
  error?: string;
}> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      const filterDesc = resolution.filter?.value ? ` in ${resolution.filter.value}` : "";
      return { success: false, error: `Couldn't find any plants matching "${args.plant_identifier}"${filterDesc}` };
    }

    const updateData: any = {};
    if (args.updates?.nickname) updateData.nickname = args.updates.nickname;
    if (args.updates?.location) updateData.location_in_home = args.updates.location;
    if (args.updates?.notes) updateData.notes = args.updates.notes;

    if (resolution.isBulk) {
      // Bulk update
      const updated: any[] = [];
      for (const plant of resolution.plants) {
        const { data, error } = await supabase.from("plants").update(updateData).eq("id", plant.id).select().single();
        if (!error && data) updated.push(data);
      }
      console.log(`[modifyPlant] Bulk updated ${updated.length} plants`);
      return {
        success: true,
        plants: updated,
        plantsCount: updated.length,
        filter: resolution.filter,
      };
    }

    // Single plant update
    const { data: plant, error } = await supabase
      .from("plants")
      .update(updateData)
      .eq("id", resolution.plants[0].id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    console.log("Modified plant:", plant.id);
    return { success: true, plant };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deletePlant(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; user_confirmed?: boolean },
): Promise<{
  success: boolean;
  deletedName?: string;
  deletedCount?: number;
  deletedNames?: string[];
  filter?: { type: string; value?: string };
  requiresConfirmation?: boolean;
  plantsToDelete?: number;
  plantNames?: string;
  error?: string;
}> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      const filterDesc = resolution.filter?.value ? ` in ${resolution.filter.value}` : "";
      return { success: false, error: `Couldn't find any plants matching "${args.plant_identifier}"${filterDesc}` };
    }

    // Require explicit confirmation for bulk deletes
    if (resolution.isBulk && !args.user_confirmed) {
      const plantNames = resolution.plants.map((p) => p.nickname || p.species || p.name).join(", ");
      const filterDesc =
        resolution.filter?.type === "location"
          ? ` in the ${resolution.filter.value}`
          : resolution.filter?.type === "species"
            ? ` (${resolution.filter.value})`
            : "";
      console.log(`[deletePlant] Bulk delete requires confirmation for ${resolution.plants.length} plants`);
      return {
        success: false,
        requiresConfirmation: true,
        plantsToDelete: resolution.plants.length,
        plantNames,
        filter: resolution.filter,
        error: `This will delete ${resolution.plants.length} plants${filterDesc}: ${plantNames}. Please confirm.`,
      };
    }

    if (resolution.isBulk) {
      // Bulk delete (confirmed)
      const deletedNames: string[] = [];
      for (const plant of resolution.plants) {
        const { error } = await supabase.from("plants").delete().eq("id", plant.id);
        if (!error) {
          deletedNames.push(plant.nickname || plant.species || plant.name);
        }
      }
      console.log(`[deletePlant] Bulk deleted ${deletedNames.length} plants`);
      return {
        success: true,
        deletedCount: deletedNames.length,
        deletedNames,
        filter: resolution.filter,
      };
    }

    // Single plant delete
    const { error } = await supabase.from("plants").delete().eq("id", resolution.plants[0].id);

    if (error) {
      return { success: false, error: error.message };
    }

    console.log("Deleted plant:", resolution.plants[0].id);
    return { success: true, deletedName: resolution.plants[0].nickname || resolution.plants[0].species };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function createReminder(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; reminder_type: string; frequency_days: number; notes?: string },
): Promise<{
  success: boolean;
  reminder?: any;
  reminders?: any[];
  plantName?: string;
  plantsCount?: number;
  filter?: { type: string; value?: string };
  error?: string;
}> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      const filterDesc = resolution.filter?.value ? ` in ${resolution.filter.value}` : "";
      return {
        success: false,
        error: resolution.isBulk
          ? `You don't have any plants${filterDesc} in your collection yet`
          : `Couldn't find a plant matching "${args.plant_identifier}"`,
      };
    }

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + args.frequency_days);

    // Create reminders for all matched plants
    const createdReminders: { reminder: any; plantName: string }[] = [];
    for (const plant of resolution.plants) {
      const { data: reminder, error } = await supabase
        .from("reminders")
        .insert({
          profile_id: profileId,
          plant_id: plant.id,
          reminder_type: args.reminder_type,
          frequency_days: args.frequency_days,
          next_due: nextDue.toISOString(),
          notes: args.notes || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create reminder for plant ${plant.id}:`, error);
        continue;
      }
      createdReminders.push({ reminder, plantName: plant.nickname || plant.species || plant.name });
    }

    if (createdReminders.length === 0) {
      return { success: false, error: "Failed to create any reminders" };
    }

    console.log(`Created ${createdReminders.length} reminder(s) for ${args.reminder_type}`);

    if (resolution.isBulk) {
      return {
        success: true,
        reminders: createdReminders,
        plantsCount: createdReminders.length,
        filter: resolution.filter,
      };
    } else {
      return {
        success: true,
        reminder: createdReminders[0].reminder,
        plantName: createdReminders[0].plantName,
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deleteReminder(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; reminder_type?: string },
): Promise<{
  success: boolean;
  deletedCount?: number;
  plantName?: string;
  plantsCount?: number;
  filter?: { type: string; value?: string };
  error?: string;
}> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      const filterDesc = resolution.filter?.value ? ` in ${resolution.filter.value}` : "";
      return {
        success: false,
        error: resolution.isBulk
          ? `You don't have any plants${filterDesc} in your collection yet`
          : `Couldn't find a plant matching "${args.plant_identifier}"`,
      };
    }

    const plantIds = resolution.plants.map((p: any) => p.id);

    let query = supabase
      .from("reminders")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .in("plant_id", plantIds);

    if (args.reminder_type) {
      query = query.eq("reminder_type", args.reminder_type);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error("Failed to deactivate reminders:", error);
      return { success: false, error: error.message };
    }

    const count = data?.length || 0;
    console.log(`Deactivated ${count} reminder(s)`);

    if (count === 0) {
      const typeDesc = args.reminder_type ? ` ${args.reminder_type}` : "";
      return {
        success: false,
        error: resolution.isBulk
          ? `No active${typeDesc} reminders found for those plants`
          : `No active${typeDesc} reminders found for "${args.plant_identifier}"`,
      };
    }

    if (resolution.isBulk) {
      return {
        success: true,
        deletedCount: count,
        plantsCount: resolution.plants.length,
        filter: resolution.filter,
      };
    } else {
      return {
        success: true,
        deletedCount: count,
        plantName: resolution.plants[0].nickname || resolution.plants[0].species || resolution.plants[0].name,
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function logCareEvent(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; event_type: string; notes?: string },
): Promise<{
  success: boolean;
  event?: any;
  events?: any[];
  plantName?: string;
  eventsCount?: number;
  filter?: { type: string; value?: string };
  error?: string;
}> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      const filterDesc = resolution.filter?.value ? ` in ${resolution.filter.value}` : "";
      return {
        success: false,
        error: resolution.isBulk
          ? `You don't have any plants${filterDesc} in your collection yet`
          : `Couldn't find a plant matching "${args.plant_identifier}"`,
      };
    }

    // Log care events for all matched plants
    const loggedEvents: { event: any; plantName: string }[] = [];
    for (const plant of resolution.plants) {
      const { data: event, error } = await supabase
        .from("care_events")
        .insert({
          plant_id: plant.id,
          event_type: args.event_type,
          notes: args.notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to log care event for plant ${plant.id}:`, error);
        continue;
      }
      loggedEvents.push({ event, plantName: plant.nickname || plant.species || plant.name });
    }

    if (loggedEvents.length === 0) {
      return { success: false, error: "Failed to log any care events" };
    }

    console.log(`Logged ${loggedEvents.length} ${args.event_type} event(s)`);

    if (resolution.isBulk) {
      return {
        success: true,
        events: loggedEvents,
        eventsCount: loggedEvents.length,
        filter: resolution.filter,
      };
    } else {
      return {
        success: true,
        event: loggedEvents[0].event,
        plantName: loggedEvents[0].plantName,
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function saveUserInsight(
  supabase: any,
  profileId: string,
  args: { insight_key: string; insight_value: string },
  sourceMessageId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[ContextEngineering] Saving insight: ${args.insight_key} = ${args.insight_value}`);

    const { error } = await supabase.from("user_insights").upsert(
      {
        profile_id: profileId,
        insight_key: args.insight_key,
        insight_value: args.insight_value,
        source_message_id: sourceMessageId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,insight_key" },
    );

    if (error) {
      console.error("[ContextEngineering] Error saving insight:", error);
      return { success: false, error: error.message };
    }

    console.log(`[ContextEngineering] Insight saved successfully`);
    return { success: true };
  } catch (error) {
    console.error("[ContextEngineering] Insight save error:", error);
    return { success: false, error: String(error) };
  }
}

export async function updateNotificationPreferences(
  supabase: any,
  profileId: string,
  args: {
    topic: string;
    action: string;
    notification_frequency?: string;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
  },
): Promise<{ success: boolean; updated?: string[]; error?: string }> {
  try {
    const topics =
      args.topic === "all" ? ["care_reminders", "observations", "seasonal_tips", "health_followups"] : [args.topic];

    // Handle notification_frequency - this updates the profile, not proactive_preferences
    if (args.action === "set_frequency" && args.notification_frequency) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          notification_frequency: args.notification_frequency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);

      if (profileError) {
        console.error("[NotificationPrefs] Profile update error:", profileError);
        return { success: false, error: profileError.message };
      }

      return { success: true, updated: ["notification_frequency"] };
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (args.action === "enable") {
      updates.enabled = true;
    } else if (args.action === "disable") {
      updates.enabled = false;
    }

    // Handle quiet hours
    if (args.quiet_hours_start) {
      updates.quiet_hours_start = args.quiet_hours_start;
    }
    if (args.quiet_hours_end) {
      updates.quiet_hours_end = args.quiet_hours_end;
    }

    const { error } = await supabase
      .from("proactive_preferences")
      .update(updates)
      .eq("profile_id", profileId)
      .in("topic", topics);

    if (error) {
      console.error("[NotificationPrefs] Update error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[NotificationPrefs] Updated ${topics.join(", ")}: ${args.action}`);
    return { success: true, updated: topics };
  } catch (error) {
    console.error("[NotificationPrefs] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function updateProfile(
  supabase: any,
  profileId: string,
  args: { field: string; value: string },
): Promise<{
  success: boolean;
  updated?: { field: string; value: string };
  error?: string;
}> {
  try {
    console.log(`[ProfileUpdate] Updating ${args.field} to: ${args.value}`);

    // Build the update object based on field
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    switch (args.field) {
      case "display_name":
        updateData.display_name = args.value;
        break;
      case "location": {
        updateData.location = args.value;
        // Geocode the new location and store lat/lng for future use
        try {
          const { geocodeLocation } = await import("./research.ts");
          const coords = await geocodeLocation(args.value);
          if (coords) {
            updateData.latitude = coords.lat;
            updateData.longitude = coords.lng;
            console.log(`[updateProfile] Geocoded "${args.value}" -> ${coords.lat}, ${coords.lng}`);
          }
        } catch (e) {
          console.warn("[updateProfile] Geocoding failed, storing location without coordinates:", e);
        }
        break;
      }
      case "experience_level": {
        const validLevels = ["beginner", "intermediate", "expert"];
        const normalizedLevel = args.value.toLowerCase();
        if (validLevels.includes(normalizedLevel)) {
          updateData.experience_level = normalizedLevel;
        } else if (normalizedLevel.includes("new") || normalizedLevel.includes("start")) {
          updateData.experience_level = "beginner";
        } else if (normalizedLevel.includes("some") || normalizedLevel.includes("bit")) {
          updateData.experience_level = "intermediate";
        } else if (normalizedLevel.includes("pro") || normalizedLevel.includes("expert") || normalizedLevel.includes("experienced")) {
          updateData.experience_level = "expert";
        } else {
          updateData.experience_level = "beginner";
        }
        break;
      }
      case "primary_concerns": {
        const concerns = args.value.split(",").map((c: string) => c.trim().toLowerCase());
        updateData.primary_concerns = concerns;
        break;
      }
      case "personality": {
        const validPersonalities = ["warm", "expert", "playful", "philosophical"];
        const normalized = args.value.toLowerCase();
        updateData.personality = validPersonalities.includes(normalized) ? normalized : "warm";
        break;
      }
      case "pets": {
        // Parse pet types into array (e.g. "cat, dog" → ["cat", "dog"])
        const pets = args.value.split(",").map((p: string) => p.trim().toLowerCase());
        updateData.pets = pets;
        break;
      }
      case "timezone":
        updateData.timezone = args.value;
        break;
      default:
        return { success: false, error: `Unknown profile field: ${args.field}` };
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", profileId);

    if (error) {
      console.error("[ProfileUpdate] Update error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[ProfileUpdate] Successfully updated ${args.field}`);
    return { success: true, updated: { field: args.field, value: args.value } };
  } catch (error) {
    console.error("[ProfileUpdate] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function checkAgentPermission(supabase: any, profileId: string, capability: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("agent_permissions")
      .select("enabled")
      .eq("profile_id", profileId)
      .eq("capability", capability)
      .maybeSingle();

    if (error) {
      console.error(`[Permissions] Error checking ${capability}:`, error);
      return true; // Default to allowing if error (fail open for phone-first users)
    }

    // If no permission record exists (legacy user), allow by default
    if (!data) {
      return true;
    }

    return data.enabled;
  } catch (error) {
    console.error(`[Permissions] Exception checking ${capability}:`, error);
    return true; // Fail open
  }
}

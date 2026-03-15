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
      // Normalize to valid values only
      const VALID_FREQUENCIES = ['off', 'daily', 'weekly', 'realtime'];
      const normalized = args.notification_frequency.toLowerCase().trim();
      if (!VALID_FREQUENCIES.includes(normalized)) {
        console.warn(`[NotificationPrefs] Rejected invalid frequency: "${args.notification_frequency}"`);
        return { success: false, error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(', ')}` };
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          notification_frequency: normalized,
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

export async function capturePlantSnapshot(
  supabase: any,
  profileId: string,
  args: {
    plant_identifier: string;
    description: string;
    context?: string;
    health_notes?: string;
    image_base64?: string;
    source?: string;
    save_if_missing?: boolean;
    species?: string;
    nickname?: string;
    location?: string;
  },
  existingImagePath?: string,
): Promise<{
  success: boolean;
  snapshot?: any;
  plantName?: string;
  error?: string;
}> {
  try {
    // Resolve the plant
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
    let plant: any;

    if (resolution.plants.length === 0) {
      // If caller provided species info, save the plant first
      if (args.save_if_missing && args.species) {
        const saveResult = await savePlant(supabase, profileId, {
          species: args.species,
          nickname: args.nickname,
          location: args.location,
        }, existingImagePath);
        if (!saveResult.success) {
          return { success: false, error: `Couldn't save plant: ${saveResult.error}` };
        }
        plant = saveResult.plant;
        console.log(`[capturePlantSnapshot] Auto-saved plant "${plant.name}" before capturing snapshot`);
      } else {
        return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}". Save it first or include species with save_if_missing: true.` };
      }
    } else {
      plant = resolution.plants[0];
    }
    let imagePath = existingImagePath || "";

    // If base64 image provided (voice call capture), upload to storage
    if (args.image_base64 && !existingImagePath) {
      const fileName = `snapshots/${profileId}/${plant.id}/${Date.now()}.jpg`;
      const binaryData = Uint8Array.from(atob(args.image_base64), (c) => c.charCodeAt(0));
      
      const { error: uploadError } = await supabase.storage
        .from("plant-photos")
        .upload(fileName, binaryData, { contentType: "image/jpeg", upsert: false });

      if (uploadError) {
        console.error("[capturePlantSnapshot] Upload error:", uploadError);
        return { success: false, error: `Failed to upload snapshot: ${uploadError.message}` };
      }
      imagePath = fileName;
      console.log(`[capturePlantSnapshot] Uploaded snapshot to: ${fileName}`);
    }

    if (!imagePath) {
      return { success: false, error: "No image available for snapshot" };
    }

    // Save the snapshot record
    const { data: snapshot, error } = await supabase
      .from("plant_snapshots")
      .insert({
        plant_id: plant.id,
        profile_id: profileId,
        image_path: imagePath,
        description: args.description,
        context: args.context || "identification",
        source: args.source || "telegram_photo",
        health_notes: args.health_notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[capturePlantSnapshot] Insert error:", error);
      return { success: false, error: error.message };
    }

    const plantName = plant.nickname || plant.species || plant.name;
    console.log(`[capturePlantSnapshot] Saved snapshot for ${plantName}: ${snapshot.id}`);
    return { success: true, snapshot, plantName };
  } catch (error) {
    console.error("[capturePlantSnapshot] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function comparePlantSnapshots(
  supabase: any,
  profileId: string,
  plantIdentifier: string,
  comparisonType: string,
  LOVABLE_API_KEY?: string,
): Promise<Record<string, unknown>> {
  try {
    const resolution = await resolvePlants(supabase, profileId, plantIdentifier);
    if (resolution.plants.length === 0) {
      return { success: false, error: `Couldn't find a plant matching "${plantIdentifier}"` };
    }

    const plant = resolution.plants[0];
    const plantName = plant.nickname || plant.species || plant.name;

    // Fetch all snapshots for this plant, ordered by date
    const { data: snapshots, error } = await supabase
      .from("plant_snapshots")
      .select("*")
      .eq("plant_id", plant.id)
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!snapshots || snapshots.length === 0) {
      return { success: false, error: `No snapshots found for ${plantName}. Take some photos first!` };
    }

    if (snapshots.length === 1) {
      const s = snapshots[0];
      return {
        success: true,
        plantName,
        snapshotCount: 1,
        summary: `Only one snapshot exists for ${plantName} (${s.context}, ${new Date(s.created_at).toLocaleDateString()}): ${s.description}${s.health_notes ? ` Health: ${s.health_notes}` : ""}`,
      };
    }

    // Build timeline for LLM comparison
    const timeline = snapshots.map((s: any, i: number) => {
      const date = new Date(s.created_at).toLocaleDateString();
      return `Snapshot ${i + 1} (${date}, ${s.context}): ${s.description}${s.health_notes ? ` | Health: ${s.health_notes}` : ""}`;
    }).join("\n");

    if (!LOVABLE_API_KEY) {
      // Return raw timeline without AI summary
      return { success: true, plantName, snapshotCount: snapshots.length, timeline };
    }

    // Use AI to generate a meaningful comparison
    const prompt = comparisonType === "latest"
      ? `Compare the two most recent snapshots of this ${plant.species || "plant"} called "${plantName}":\n\n${timeline}\n\nFocus on changes between the last two entries. What improved? What got worse? Any new growth? Be specific and concise (3-4 sentences for voice).`
      : `Summarize the visual timeline of this ${plant.species || "plant"} called "${plantName}":\n\n${timeline}\n\nDescribe the overall trajectory: growth, health changes, any recurring issues. Be concise (4-5 sentences for voice).`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert botanist comparing plant photos over time. Provide clear, specific observations about changes. This will be spoken aloud." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    const data = await resp.json();
    const comparison = data.choices?.[0]?.message?.content || "Unable to generate comparison.";

    return {
      success: true,
      plantName,
      snapshotCount: snapshots.length,
      firstSnapshot: new Date(snapshots[0].created_at).toLocaleDateString(),
      latestSnapshot: new Date(snapshots[snapshots.length - 1].created_at).toLocaleDateString(),
      comparison,
    };
  } catch (error) {
    console.error("[comparePlantSnapshots] Exception:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// SENSOR TOOLS
// ============================================================================

export async function checkPlantSensors(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string },
): Promise<Record<string, unknown>> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      return { success: false, error: `Couldn't find any plants matching "${args.plant_identifier}"` };
    }

    const plantIds = resolution.plants.map((p: any) => p.id);

    // Fetch latest sensor readings and active ranges in parallel
    const [readingsResult, rangesResult] = await Promise.all([
      supabase
        .from("sensor_readings")
        .select("plant_id, soil_moisture, temperature, humidity, light_lux, battery_pct, created_at")
        .in("plant_id", plantIds)
        .order("created_at", { ascending: false })
        .limit(plantIds.length * 3),
      supabase
        .from("sensor_ranges")
        .select("*")
        .in("plant_id", plantIds)
        .eq("is_active", true),
    ]);

    if (readingsResult.error) {
      console.error("[checkPlantSensors] Query error:", readingsResult.error);
      return { success: false, error: readingsResult.error.message };
    }

    // Dedupe to latest reading per plant
    const latestByPlant: Record<string, any> = {};
    for (const r of readingsResult.data || []) {
      if (!latestByPlant[r.plant_id]) latestByPlant[r.plant_id] = r;
    }

    // Index ranges by plant
    const rangesByPlant: Record<string, any> = {};
    for (const r of rangesResult.data || []) {
      rangesByPlant[r.plant_id] = r;
    }

    // Helper: assess a metric value against plant-specific or default ranges
    function assessMetric(
      value: number | null,
      metric: string,
      ranges: any,
      unit: string,
    ): any {
      if (value == null) return null;

      // Get plant-specific range or fall back to defaults
      const prefix = metric; // e.g., "soil_moisture"
      const min = ranges?.[`${prefix}_min`];
      const idealMin = ranges?.[`${prefix}_ideal_min`];
      const idealMax = ranges?.[`${prefix}_ideal_max`];
      const max = ranges?.[`${prefix}_max`];
      const hasRanges = min != null || idealMin != null;

      let status: string;
      let note: string;

      if (hasRanges) {
        if (min != null && value < min) {
          status = "critical";
          note = `Below danger threshold of ${min}${unit}`;
        } else if (max != null && value > max) {
          status = "critical";
          note = `Above danger threshold of ${max}${unit}`;
        } else if (idealMin != null && value < idealMin) {
          status = "warning";
          note = `Below ideal range (${idealMin}-${idealMax}${unit})`;
        } else if (idealMax != null && value > idealMax) {
          status = "warning";
          note = `Above ideal range (${idealMin}-${idealMax}${unit})`;
        } else {
          status = "ok";
          note = `In ideal range (${idealMin}-${idealMax}${unit})`;
        }
      } else {
        // Default generic thresholds
        const defaults: Record<string, any> = {
          soil_moisture: { critLow: 20, warnLow: 35, warnHigh: 75 },
          temperature: { critLow: 10, warnLow: 15, warnHigh: 30, critHigh: 35 },
          humidity: { warnLow: 30, warnHigh: 70 },
          light_lux: { low: 50, med: 500, bright: 10000 },
        };
        const d = defaults[metric];
        if (metric === "light_lux") {
          status = value < d.low ? "low" : value < d.med ? "medium" : value <= d.bright ? "bright" : "direct";
          note = status === "low" ? "Very low light" : status === "medium" ? "Low to medium light" : status === "bright" ? "Bright indirect" : "Direct sunlight";
        } else {
          status = (d.critLow != null && value < d.critLow) || (d.critHigh != null && value > d.critHigh) ? "critical" :
                   (d.warnLow != null && value < d.warnLow) || (d.warnHigh != null && value > d.warnHigh) ? "warning" : "ok";
          note = status === "critical" ? "Outside safe range" : status === "warning" ? "Outside ideal range" : "Good";
        }
      }

      return {
        value,
        unit,
        status,
        note,
        range: hasRanges ? { min, ideal_min: idealMin, ideal_max: idealMax, max } : null,
      };
    }

    // Build results
    const results = resolution.plants.map((plant: any) => {
      const reading = latestByPlant[plant.id];
      const ranges = rangesByPlant[plant.id];
      const plantName = plant.nickname || plant.species || plant.name;

      if (!reading) {
        return { plant: plantName, plant_id: plant.id, has_sensor: false, has_ranges: !!ranges };
      }

      const now = Date.now();
      const readingAge = now - new Date(reading.created_at).getTime();
      const minutesAgo = Math.round(readingAge / 60000);

      return {
        plant: plantName,
        plant_id: plant.id,
        has_sensor: true,
        has_ranges: !!ranges,
        soil_moisture: assessMetric(reading.soil_moisture, "soil_moisture", ranges, "%"),
        temperature: assessMetric(reading.temperature, "temperature", ranges, "°C"),
        humidity: assessMetric(reading.humidity, "humidity", ranges, "%"),
        light_lux: assessMetric(reading.light_lux, "light_lux", ranges, " lux"),
        battery_pct: reading.battery_pct,
        last_reading: minutesAgo < 60 ? `${minutesAgo}m ago` :
                      minutesAgo < 1440 ? `${Math.round(minutesAgo / 60)}h ago` :
                      `${Math.round(minutesAgo / 1440)}d ago`,
        stale: readingAge > 30 * 60 * 1000,
      };
    });

    const plantsWithSensors = results.filter((r: any) => r.has_sensor);

    return {
      success: true,
      readings: results,
      summary: plantsWithSensors.length === 0
        ? `No sensor readings found for ${resolution.isBulk ? "those plants" : `"${args.plant_identifier}"`}`
        : `Found readings for ${plantsWithSensors.length} plant${plantsWithSensors.length !== 1 ? "s" : ""}`,
    };
  } catch (error) {
    console.error("[checkPlantSensors] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function associateReading(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string },
): Promise<Record<string, unknown>> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);

    if (resolution.plants.length === 0) {
      return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}"` };
    }

    if (resolution.isBulk) {
      return { success: false, error: "Please specify a single plant for pulse-check association, not a bulk pattern" };
    }

    const plant = resolution.plants[0];
    const plantName = plant.nickname || plant.species || plant.name;

    // Find the most recent unassociated reading for this user
    const { data: reading, error: readError } = await supabase
      .from("sensor_readings")
      .select("id, soil_moisture, temperature, humidity, light_lux, battery_pct, created_at")
      .eq("profile_id", profileId)
      .is("plant_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (readError || !reading) {
      return { success: false, error: "No unassociated sensor reading found. Make sure your device has sent a reading first." };
    }

    // Check staleness (>5 minutes old)
    const ageMs = Date.now() - new Date(reading.created_at).getTime();
    const ageMinutes = Math.round(ageMs / 60000);
    const stale = ageMs > 5 * 60 * 1000;

    // Associate the reading with the plant
    const { error: updateError } = await supabase
      .from("sensor_readings")
      .update({ plant_id: plant.id })
      .eq("id", reading.id);

    if (updateError) {
      console.error("[associateReading] Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`[associateReading] Associated reading ${reading.id} with plant ${plantName} (${plant.id})`);

    return {
      success: true,
      plant: plantName,
      plant_id: plant.id,
      reading_id: reading.id,
      soil_moisture: reading.soil_moisture,
      temperature: reading.temperature,
      humidity: reading.humidity,
      light_lux: reading.light_lux,
      battery_pct: reading.battery_pct,
      age: `${ageMinutes}m ago`,
      stale_warning: stale ? `This reading is ${ageMinutes} minutes old — it may not reflect current conditions` : null,
    };
  } catch (error) {
    console.error("[associateReading] Exception:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// SENSOR TOOLS — RANGES, HISTORY, DEVICE MANAGEMENT, ALERTS
// ============================================================================

export async function setPlantRanges(
  supabase: any,
  profileId: string,
  args: {
    plant_identifier: string;
    ranges: {
      soil_moisture?: { min: number; ideal_min: number; ideal_max: number; max: number };
      temperature?: { min: number; ideal_min: number; ideal_max: number; max: number };
      humidity?: { min: number; ideal_min: number; ideal_max: number; max: number };
      light_lux?: { min: number; ideal_min: number; ideal_max: number; max: number };
    };
    reasoning?: string;
  },
): Promise<Record<string, unknown>> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
    if (resolution.plants.length === 0) {
      return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}"` };
    }

    const plant = resolution.plants[0];
    const plantName = plant.nickname || plant.species || plant.name;
    const r = args.ranges;

    // Deactivate any existing active ranges for this plant
    await supabase
      .from("sensor_ranges")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("plant_id", plant.id)
      .eq("is_active", true);

    // Insert new active range
    const { data: range, error } = await supabase
      .from("sensor_ranges")
      .insert({
        plant_id: plant.id,
        profile_id: profileId,
        soil_moisture_min: r.soil_moisture?.min,
        soil_moisture_ideal_min: r.soil_moisture?.ideal_min,
        soil_moisture_ideal_max: r.soil_moisture?.ideal_max,
        soil_moisture_max: r.soil_moisture?.max,
        temperature_min: r.temperature?.min,
        temperature_ideal_min: r.temperature?.ideal_min,
        temperature_ideal_max: r.temperature?.ideal_max,
        temperature_max: r.temperature?.max,
        humidity_min: r.humidity?.min,
        humidity_ideal_min: r.humidity?.ideal_min,
        humidity_ideal_max: r.humidity?.ideal_max,
        humidity_max: r.humidity?.max,
        light_lux_min: r.light_lux?.min,
        light_lux_ideal_min: r.light_lux?.ideal_min,
        light_lux_ideal_max: r.light_lux?.ideal_max,
        light_lux_max: r.light_lux?.max,
        reasoning: args.reasoning || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[setPlantRanges] Insert error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[setPlantRanges] Set ranges for ${plantName}: ${range.id}`);
    return { success: true, plant: plantName, range_id: range.id, reasoning: args.reasoning };
  } catch (error) {
    console.error("[setPlantRanges] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function getSensorHistory(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; metric: string; period: string },
): Promise<Record<string, unknown>> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
    if (resolution.plants.length === 0) {
      return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}"` };
    }

    const plant = resolution.plants[0];
    const plantName = plant.nickname || plant.species || plant.name;

    // Determine time window
    const periodMs: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const windowMs = periodMs[args.period] || periodMs["24h"];
    const since = new Date(Date.now() - windowMs).toISOString();

    // Determine which columns to select
    const metrics = args.metric === "all"
      ? ["soil_moisture", "temperature", "humidity", "light_lux"]
      : [args.metric];

    const selectCols = ["created_at", ...metrics].join(", ");

    const { data: readings, error } = await supabase
      .from("sensor_readings")
      .select(selectCols)
      .eq("plant_id", plant.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getSensorHistory] Query error:", error);
      return { success: false, error: error.message };
    }

    if (!readings || readings.length === 0) {
      return { success: true, plant: plantName, period: args.period, readings: [], summary: "No readings in this period" };
    }

    // Compute summary stats per metric
    const summary: Record<string, any> = {};
    for (const metric of metrics) {
      const values = readings.map((r: any) => r[metric]).filter((v: any) => v != null);
      if (values.length > 0) {
        summary[metric] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 10) / 10,
          latest: values[values.length - 1],
          count: values.length,
        };
      }
    }

    console.log(`[getSensorHistory] ${plantName}: ${readings.length} readings over ${args.period}`);
    return {
      success: true,
      plant: plantName,
      period: args.period,
      reading_count: readings.length,
      summary,
      readings: readings.length > 50
        ? readings.filter((_: any, i: number) => i % Math.ceil(readings.length / 50) === 0)
        : readings,
    };
  } catch (error) {
    console.error("[getSensorHistory] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function comparePlantEnvironments(
  supabase: any,
  profileId: string,
  args: { plant_identifiers: string; metric: string },
): Promise<Record<string, unknown>> {
  try {
    // Resolve plants — support "all" or comma-separated names
    const identifiers = args.plant_identifiers === "all"
      ? ["all"]
      : args.plant_identifiers.split(",").map((s: string) => s.trim());

    const allPlants: any[] = [];
    for (const id of identifiers) {
      const resolution = await resolvePlants(supabase, profileId, id);
      allPlants.push(...resolution.plants);
    }

    if (allPlants.length === 0) {
      return { success: false, error: "No plants found matching those identifiers" };
    }

    // Dedupe by plant id
    const uniquePlants = Object.values(
      Object.fromEntries(allPlants.map((p: any) => [p.id, p]))
    ) as any[];

    const plantIds = uniquePlants.map((p: any) => p.id);

    // Fetch latest reading per plant
    const { data: readings, error } = await supabase
      .from("sensor_readings")
      .select("plant_id, soil_moisture, temperature, humidity, light_lux, created_at")
      .in("plant_id", plantIds)
      .order("created_at", { ascending: false })
      .limit(plantIds.length * 3);

    if (error) {
      console.error("[comparePlantEnvironments] Query error:", error);
      return { success: false, error: error.message };
    }

    // Latest per plant
    const latestByPlant: Record<string, any> = {};
    for (const r of readings || []) {
      if (!latestByPlant[r.plant_id]) latestByPlant[r.plant_id] = r;
    }

    // Build comparison sorted by the requested metric
    const comparison = uniquePlants
      .map((plant: any) => {
        const reading = latestByPlant[plant.id];
        const plantName = plant.nickname || plant.species || plant.name;
        if (!reading) return { plant: plantName, value: null, no_data: true };
        return {
          plant: plantName,
          value: reading[args.metric],
          all_readings: {
            soil_moisture: reading.soil_moisture,
            temperature: reading.temperature,
            humidity: reading.humidity,
            light_lux: reading.light_lux,
          },
          last_reading: reading.created_at,
        };
      })
      .sort((a: any, b: any) => {
        if (a.value == null) return 1;
        if (b.value == null) return -1;
        return b.value - a.value;
      });

    console.log(`[comparePlantEnvironments] Compared ${comparison.length} plants on ${args.metric}`);
    return {
      success: true,
      metric: args.metric,
      plants_compared: comparison.length,
      comparison,
    };
  } catch (error) {
    console.error("[comparePlantEnvironments] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function manageDevice(
  supabase: any,
  profileId: string,
  args: {
    action: string;
    device_name?: string;
    device_id?: string;
    plant_identifier?: string;
    new_name?: string;
  },
): Promise<Record<string, unknown>> {
  try {
    // Resolve device by name or id
    let device: any = null;
    if (args.device_id) {
      const { data } = await supabase
        .from("devices")
        .select("id, name, plant_id, status, last_seen_at, plants(name, nickname, species)")
        .eq("id", args.device_id)
        .eq("profile_id", profileId)
        .single();
      device = data;
    } else if (args.device_name) {
      const { data } = await supabase
        .from("devices")
        .select("id, name, plant_id, status, last_seen_at, plants(name, nickname, species)")
        .eq("profile_id", profileId)
        .ilike("name", `%${args.device_name}%`)
        .limit(1)
        .single();
      device = data;
    }

    if (args.action === "status") {
      // List all devices if none specified
      if (!device) {
        const { data: devices } = await supabase
          .from("devices")
          .select("id, name, plant_id, status, last_seen_at, plants(name, nickname, species)")
          .eq("profile_id", profileId)
          .eq("status", "active");
        return {
          success: true,
          devices: (devices || []).map((d: any) => ({
            name: d.name,
            status: d.status,
            plant: d.plants ? (d.plants.nickname || d.plants.species || d.plants.name) : "unassigned",
            last_seen: d.last_seen_at,
          })),
        };
      }
      return {
        success: true,
        device: {
          name: device.name,
          status: device.status,
          plant: device.plants ? (device.plants.nickname || device.plants.species || device.plants.name) : "unassigned",
          last_seen: device.last_seen_at,
        },
      };
    }

    if (args.action === "provision") {
      // Generate an 8-char token with unambiguous alphanumeric chars
      const chars = "abcdefghjkmnpqrstuvwxyz23456789";
      const randomBytes = new Uint8Array(8);
      crypto.getRandomValues(randomBytes);
      const suffix = Array.from(randomBytes).map((b) => chars[b % chars.length]).join("");
      const plainToken = `odev_${suffix}`;

      // SHA-256 hash for storage
      const hashData = new TextEncoder().encode(plainToken);
      const hashBuf = await crypto.subtle.digest("SHA-256", hashData);
      const tokenHash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Resolve plant if provided
      let plantId: string | null = null;
      let plantName: string | null = null;
      if (args.plant_identifier) {
        const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
        if (resolution.plants.length > 0) {
          const plant = resolution.plants[0];
          plantId = plant.id;
          plantName = plant.nickname || plant.species || plant.name;
        }
      }

      const deviceName = args.new_name || "New Sensor";
      const { error } = await supabase.from("devices").insert({
        profile_id: profileId,
        plant_id: plantId,
        device_token_hash: tokenHash,
        device_token_prefix: plainToken.substring(0, 12),
        name: deviceName,
        status: "active",
      });
      if (error) return { success: false, error: error.message };

      console.log(`[manageDevice] Provisioned new device "${deviceName}" for profile ${profileId}`);
      return {
        success: true,
        action: "provisioned",
        token: plainToken,
        device_name: deviceName,
        plant_name: plantName,
        note: "Save this token — it won't be shown again. Paste it into your sensor firmware as DEVICE_TOKEN.",
      };
    }

    if (!device) {
      return { success: false, error: "Device not found. Specify device_name or device_id." };
    }

    switch (args.action) {
      case "assign": {
        if (!args.plant_identifier) {
          return { success: false, error: "plant_identifier required for assign action" };
        }
        const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
        if (resolution.plants.length === 0) {
          return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}"` };
        }
        const plant = resolution.plants[0];
        const { error } = await supabase
          .from("devices")
          .update({ plant_id: plant.id })
          .eq("id", device.id);
        if (error) return { success: false, error: error.message };
        const plantName = plant.nickname || plant.species || plant.name;
        console.log(`[manageDevice] Assigned ${device.name} to ${plantName}`);
        return { success: true, action: "assigned", device: device.name, plant: plantName };
      }

      case "unassign": {
        const { error } = await supabase
          .from("devices")
          .update({ plant_id: null })
          .eq("id", device.id);
        if (error) return { success: false, error: error.message };
        console.log(`[manageDevice] Unassigned ${device.name}`);
        return { success: true, action: "unassigned", device: device.name };
      }

      case "rename": {
        if (!args.new_name) return { success: false, error: "new_name required for rename action" };
        const { error } = await supabase
          .from("devices")
          .update({ name: args.new_name })
          .eq("id", device.id);
        if (error) return { success: false, error: error.message };
        console.log(`[manageDevice] Renamed ${device.name} → ${args.new_name}`);
        return { success: true, action: "renamed", old_name: device.name, new_name: args.new_name };
      }

      case "identify": {
        const { error } = await supabase
          .from("device_commands")
          .insert({
            device_id: device.id,
            command: "identify",
            status: "pending",
          });
        if (error) return { success: false, error: error.message };
        console.log(`[manageDevice] Sent identify command to ${device.name}`);
        return { success: true, action: "identify_sent", device: device.name, note: "The device LED will blink within 30 seconds" };
      }

      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  } catch (error) {
    console.error("[manageDevice] Exception:", error);
    return { success: false, error: String(error) };
  }
}

export async function dismissSensorAlert(
  supabase: any,
  profileId: string,
  args: { plant_identifier: string; alert_type: string; reason?: string },
): Promise<Record<string, unknown>> {
  try {
    const resolution = await resolvePlants(supabase, profileId, args.plant_identifier);
    if (resolution.plants.length === 0) {
      return { success: false, error: `Couldn't find a plant matching "${args.plant_identifier}"` };
    }

    const plant = resolution.plants[0];
    const plantName = plant.nickname || plant.species || plant.name;

    const { data, error } = await supabase
      .from("sensor_alerts")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
        dismissed_reason: args.reason || "User acknowledged",
      })
      .eq("plant_id", plant.id)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .ilike("alert_type", `%${args.alert_type}%`)
      .select("id");

    if (error) {
      console.error("[dismissSensorAlert] Error:", error);
      return { success: false, error: error.message };
    }

    const count = data?.length || 0;
    console.log(`[dismissSensorAlert] Dismissed ${count} alert(s) for ${plantName}`);
    return {
      success: true,
      plant: plantName,
      dismissed_count: count,
      reason: args.reason || "User acknowledged",
    };
  } catch (error) {
    console.error("[dismissSensorAlert] Exception:", error);
    return { success: false, error: String(error) };
  }
}

// Helper: evaluate sensor reading against ranges and create/resolve alerts
export async function evaluateSensorAlerts(
  supabase: any,
  profileId: string,
  plantId: string,
  deviceId: string,
  readingId: string,
  reading: { soil_moisture?: number; temperature?: number; humidity?: number; light_lux?: number },
): Promise<void> {
  try {
    // Fetch active ranges for this plant
    const { data: ranges } = await supabase
      .from("sensor_ranges")
      .select("*")
      .eq("plant_id", plantId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!ranges) return; // No ranges set, skip alert evaluation

    // Fetch plant name for alert messages
    const { data: plant } = await supabase
      .from("plants")
      .select("name, nickname, species")
      .eq("id", plantId)
      .single();
    const plantName = plant?.nickname || plant?.species || plant?.name || "Plant";

    // Check each metric against its range
    const checks: {
      metric: string;
      value: number | undefined | null;
      min: number | null;
      idealMin: number | null;
      idealMax: number | null;
      max: number | null;
    }[] = [
      {
        metric: "soil_moisture",
        value: reading.soil_moisture,
        min: ranges.soil_moisture_min,
        idealMin: ranges.soil_moisture_ideal_min,
        idealMax: ranges.soil_moisture_ideal_max,
        max: ranges.soil_moisture_max,
      },
      {
        metric: "temperature",
        value: reading.temperature,
        min: ranges.temperature_min,
        idealMin: ranges.temperature_ideal_min,
        idealMax: ranges.temperature_ideal_max,
        max: ranges.temperature_max,
      },
      {
        metric: "humidity",
        value: reading.humidity,
        min: ranges.humidity_min,
        idealMin: ranges.humidity_ideal_min,
        idealMax: ranges.humidity_ideal_max,
        max: ranges.humidity_max,
      },
      {
        metric: "light_lux",
        value: reading.light_lux,
        min: ranges.light_lux_min,
        idealMin: ranges.light_lux_ideal_min,
        idealMax: ranges.light_lux_ideal_max,
        max: ranges.light_lux_max,
      },
    ];

    for (const check of checks) {
      if (check.value == null) continue;

      let alertType: string | null = null;
      let severity: string = "warning";
      let message = "";

      if (check.min != null && check.value < check.min) {
        alertType = `danger_${check.metric === "soil_moisture" ? "dry" : check.metric === "temperature" ? "cold" : "low"}`;
        severity = "critical";
        message = `${plantName} ${check.metric.replace("_", " ")} at ${check.value}, below danger threshold of ${check.min}`;
      } else if (check.max != null && check.value > check.max) {
        alertType = `danger_${check.metric === "soil_moisture" ? "wet" : check.metric === "temperature" ? "hot" : "high"}`;
        severity = "critical";
        message = `${plantName} ${check.metric.replace("_", " ")} at ${check.value}, above danger threshold of ${check.max}`;
      } else if (check.idealMin != null && check.value < check.idealMin) {
        alertType = `warning_${check.metric === "soil_moisture" ? "dry" : check.metric === "temperature" ? "cold" : "low"}`;
        severity = "warning";
        message = `${plantName} ${check.metric.replace("_", " ")} at ${check.value}, below ideal range of ${check.idealMin}-${check.idealMax}`;
      } else if (check.idealMax != null && check.value > check.idealMax) {
        alertType = `warning_${check.metric === "soil_moisture" ? "wet" : check.metric === "temperature" ? "hot" : "high"}`;
        severity = "warning";
        message = `${plantName} ${check.metric.replace("_", " ")} at ${check.value}, above ideal range of ${check.idealMin}-${check.idealMax}`;
      }

      if (alertType) {
        // Check if there's already an active alert of this type
        const { data: existing } = await supabase
          .from("sensor_alerts")
          .select("id")
          .eq("plant_id", plantId)
          .eq("alert_type", alertType)
          .eq("status", "active")
          .limit(1);

        if (!existing || existing.length === 0) {
          // Create new alert
          await supabase.from("sensor_alerts").insert({
            plant_id: plantId,
            profile_id: profileId,
            device_id: deviceId,
            reading_id: readingId,
            alert_type: alertType,
            severity,
            metric: check.metric,
            current_value: check.value,
            threshold_value: severity === "critical"
              ? (check.value < (check.min ?? 0) ? check.min : check.max)
              : (check.value < (check.idealMin ?? 0) ? check.idealMin : check.idealMax),
            message,
            status: "active",
          });
          console.log(`[evaluateSensorAlerts] Created alert: ${alertType} for ${plantName}`);
        }
      } else {
        // Value is in ideal range — resolve any active alerts for this metric
        const { data: activeAlerts } = await supabase
          .from("sensor_alerts")
          .select("id")
          .eq("plant_id", plantId)
          .eq("metric", check.metric)
          .eq("status", "active");

        for (const alert of activeAlerts || []) {
          await supabase
            .from("sensor_alerts")
            .update({ status: "resolved", resolved_at: new Date().toISOString() })
            .eq("id", alert.id);
          console.log(`[evaluateSensorAlerts] Resolved alert ${alert.id} for ${plantName} (${check.metric} back in range)`);
        }
      }
    }
  } catch (error) {
    console.error("[evaluateSensorAlerts] Exception:", error);
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
      return true;
    }

    if (!data) {
      return true;
    }

    return data.enabled;
  } catch (error) {
    console.error(`[Permissions] Exception checking ${capability}:`, error);
    return true;
  }
}

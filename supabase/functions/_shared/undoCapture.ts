// Undo capture — snapshots the current state of a record before mutation.
// Stored in agent_operations.previous_state, enabling user-facing undo.

/**
 * Fetch the current state of record(s) before a mutation.
 * Returns null for insert operations (undo = delete the new record).
 *
 * For delete_plant, also captures associated reminders and care_events
 * so a cascading undo can restore everything.
 */
export async function capturePreviousState(
  supabase: any,
  tableName: string,
  recordIds: string | string[],
  options?: { includeCascade?: boolean },
): Promise<Record<string, unknown> | null> {
  const ids = Array.isArray(recordIds) ? recordIds : [recordIds];
  if (ids.length === 0) return null;

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .in("id", ids);

  if (error || !data || data.length === 0) return null;

  const state: Record<string, unknown> = {
    table: tableName,
    rows: data,
  };

  // For plant deletions, capture cascading data that will be lost
  if (options?.includeCascade && tableName === "plants") {
    const plantIds = data.map((r: any) => r.id);

    const [reminders, careEvents, snapshots, sensorRanges] = await Promise.all([
      supabase.from("reminders").select("*").in("plant_id", plantIds).then((r: any) => r.data || []),
      supabase.from("care_events").select("*").in("plant_id", plantIds).then((r: any) => r.data || []),
      supabase.from("plant_snapshots").select("*").in("plant_id", plantIds).then((r: any) => r.data || []),
      supabase.from("sensor_ranges").select("*").in("plant_id", plantIds).then((r: any) => r.data || []),
    ]);

    state.cascade = { reminders, careEvents, snapshots, sensorRanges };
  }

  return state;
}

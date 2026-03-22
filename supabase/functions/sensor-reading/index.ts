// Edge function for IoT sensor readings.
// Two routes:
//   POST /sensor-reading         — device token auth (ESP32, etc.)
//   POST /sensor-reading/simulate — Supabase/Telegram auth (demo fallback)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateInitData } from "../_shared/auth.ts";
import { evaluateSensorAlerts } from "../_shared/tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashToken(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// VALIDATION
// ============================================================================

interface SensorPayload {
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
  light_lux?: number;
  battery_pct?: number;
  metadata?: Record<string, unknown>;
}

function validatePayload(body: any): { valid: true; data: SensorPayload } | { valid: false; error: string } {
  const { soil_moisture, temperature, humidity, light_lux, battery_pct, metadata } = body;

  // At least one sensor value must be present
  if (
    soil_moisture == null &&
    temperature == null &&
    humidity == null &&
    light_lux == null
  ) {
    return { valid: false, error: "At least one sensor value required (soil_moisture, temperature, humidity, light_lux)" };
  }

  // Range checks
  const checks: [string, number | undefined | null, number, number][] = [
    ["soil_moisture", soil_moisture, 0, 100],
    ["temperature", temperature, -40, 80],
    ["humidity", humidity, 0, 100],
    ["light_lux", light_lux, 0, 200000],
    ["battery_pct", battery_pct, 0, 100],
  ];

  for (const [name, val, min, max] of checks) {
    if (val != null) {
      if (typeof val !== "number" || isNaN(val)) {
        return { valid: false, error: `${name} must be a number` };
      }
      if (val < min || val > max) {
        return { valid: false, error: `${name} must be between ${min} and ${max}` };
      }
    }
  }

  return {
    valid: true,
    data: { soil_moisture, temperature, humidity, light_lux, battery_pct, metadata },
  };
}

// ============================================================================
// DEVICE AUTH ROUTE: POST /sensor-reading
// ============================================================================

async function handleDeviceReading(req: Request) {
  // Accept device token from x-device-token header (preferred, avoids gateway JWT check)
  // or from Authorization header (legacy/direct calls)
  let token = req.headers.get("x-device-token") ?? "";
  if (!token) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }
  }

  if (!token || !token.startsWith("odev_")) {
    return json({ error: "Missing or invalid device token. Use x-device-token header with odev_ prefixed token." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate device
  const tokenHash = await hashToken(token);
  const { data: device, error: authError } = await supabase
    .from("devices")
    .select("id, profile_id, plant_id, status")
    .eq("device_token_hash", tokenHash)
    .eq("status", "active")
    .single();

  if (authError || !device) {
    console.warn("[SensorReading] Invalid or revoked device token");
    return json({ error: "Invalid or revoked device token" }, 403);
  }

  // Rate limit: max 4 readings per minute per device
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("sensor_readings")
    .select("*", { count: "exact", head: true })
    .eq("device_id", device.id)
    .gte("created_at", oneMinuteAgo);

  if ((count ?? 0) >= 4) {
    console.warn(`[SensorReading] Rate limit exceeded for device ${device.id}`);
    return json(
      { error: "Rate limit exceeded", limit_per_minute: 4, retry_after_seconds: 15 },
      429,
    );
  }

  // Validate payload
  const body = await req.json();
  const validation = validatePayload(body);
  if (!validation.valid) {
    return json({ error: validation.error }, 400);
  }

  const { data: payload } = validation;

  // Insert reading
  const { data: reading, error: insertError } = await supabase
    .from("sensor_readings")
    .insert([{
      device_id: device.id,
      plant_id: device.plant_id,
      profile_id: device.profile_id,
      soil_moisture: payload.soil_moisture,
      temperature: payload.temperature,
      humidity: payload.humidity,
      light_lux: payload.light_lux,
      battery_pct: payload.battery_pct,
      reading_metadata: payload.metadata || null,
    }])
    .select("id, plant_id")
    .single();

  if (insertError) {
    console.error("[SensorReading] Insert error:", insertError);
    return json({ error: "Failed to store reading" }, 500);
  }

  // Update last_seen_at (fire-and-forget)
  supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id)
    .then();

  // Delta detection: auto-log care events when significant changes occur
  let careEvent: string | null = null;
  const meta = payload.metadata as Record<string, unknown> | null;
  if (meta?.trigger === "delta" && reading.plant_id) {
    const soilDelta = meta.soil_delta as number | undefined;
    if (soilDelta != null && soilDelta > 0 && soilDelta >= 15) {
      // Soil moisture jumped up significantly → watering detected
      careEvent = "water";
      supabase
        .from("care_events")
        .insert([{
          plant_id: reading.plant_id,
          event_type: "water",
          notes: `Auto-detected by sensor: soil moisture increased by ${soilDelta}%`,
        }])
        .then(({ error }) => {
          if (error) console.error("[SensorReading] Failed to log care event:", error);
          else console.log(`[SensorReading] Auto-logged watering event for plant ${reading.plant_id}`);
        });

      // Advance water reminders for this plant (fire-and-forget)
      supabase
        .from("reminders")
        .select("id, frequency_days")
        .eq("plant_id", reading.plant_id)
        .eq("reminder_type", "water")
        .eq("is_active", true)
        .then(({ data: reminders }) => {
          for (const r of reminders || []) {
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + r.frequency_days);
            supabase
              .from("reminders")
              .update({ next_due: nextDue.toISOString(), updated_at: new Date().toISOString() })
              .eq("id", r.id)
              .then();
          }
          if (reminders?.length) {
            console.log(`[SensorReading] Advanced ${reminders.length} water reminder(s) for plant ${reading.plant_id}`);
          }
        });
    }
  }

  // Evaluate sensor alerts against plant-specific ranges (fire-and-forget)
  if (reading.plant_id) {
    evaluateSensorAlerts(
      supabase,
      device.profile_id,
      reading.plant_id,
      device.id,
      reading.id,
      {
        soil_moisture: payload.soil_moisture,
        temperature: payload.temperature,
        humidity: payload.humidity,
        light_lux: payload.light_lux,
      },
    ).catch((err) => console.error("[SensorReading] Alert evaluation failed:", err));
  }

  // Check for pending device commands to return in response
  let commands: { type: string; payload?: unknown }[] = [];
  try {
    // Expire old commands first
    await supabase
      .from("device_commands")
      .update({ status: "expired" })
      .eq("device_id", device.id)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    // Fetch pending commands
    const { data: pendingCmds } = await supabase
      .from("device_commands")
      .select("id, command, payload")
      .eq("device_id", device.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (pendingCmds?.length) {
      commands = pendingCmds.map((c: any) => ({ type: c.command, payload: c.payload }));
      // Mark as acknowledged (fire-and-forget)
      const cmdIds = pendingCmds.map((c: any) => c.id);
      supabase
        .from("device_commands")
        .update({ status: "acknowledged" })
        .in("id", cmdIds)
        .then();
      console.log(`[SensorReading] Returning ${commands.length} command(s) to device ${device.id}`);
    }
  } catch (cmdErr) {
    console.error("[SensorReading] Command fetch error:", cmdErr);
  }

  console.log(`[SensorReading] Device ${device.id} → reading ${reading.id} (plant: ${reading.plant_id || "unassociated"})${careEvent ? ` [auto: ${careEvent}]` : ""}`);

  return json({
    success: true,
    reading_id: reading.id,
    plant_id: reading.plant_id,
    care_event: careEvent,
    commands: commands.length > 0 ? commands : undefined,
  });
}

// ============================================================================
// SIMULATE ROUTE: POST /sensor-reading/simulate
// ============================================================================

async function handleSimulate(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Dual auth: Supabase JWT or Telegram initData
  let profileId: string | null = null;

  const authHeader = req.headers.get("Authorization");
  const body = await req.json();

  // Try Supabase Auth
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    // Skip if it looks like a device token
    if (!token.startsWith("odev_")) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (profile) profileId = profile.id;
      }
    }
  }

  // Try Telegram auth
  if (!profileId && body.initData) {
    const tgUser = await validateInitData(body.initData, botToken);
    if (tgUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", String(tgUser.id))
        .single();
      if (profile) profileId = profile.id;
    }
  }

  if (!profileId) {
    return json({ error: "Authentication required" }, 401);
  }

  // Find or create a demo device for this profile
  let { data: device } = await supabase
    .from("devices")
    .select("id, plant_id")
    .eq("profile_id", profileId)
    .eq("name", "Demo Sensor")
    .eq("status", "active")
    .single();

  if (!device) {
    // Create a demo device with a random token
    const demoToken = `odev_demo_${crypto.randomUUID()}`;
    const demoHash = await hashToken(demoToken);
    const { data: newDevice, error: createError } = await supabase
      .from("devices")
      .insert([{
        profile_id: profileId,
        device_token_hash: demoHash,
        device_token_prefix: demoToken.substring(0, 8),
        name: "Demo Sensor",
        status: "active",
      }])
      .select("id, plant_id")
      .single();

    if (createError) {
      console.error("[SensorReading] Failed to create demo device:", createError);
      return json({ error: "Failed to create demo device" }, 500);
    }
    device = newDevice;
  }

  // Resolve plant_id if plant_identifier provided
  let plantId = device!.plant_id;
  if (body.plant_identifier) {
    const { data: plants } = await supabase
      .from("plants")
      .select("id, name, nickname, species")
      .eq("profile_id", profileId);

    if (plants?.length) {
      const identifier = (body.plant_identifier as string).toLowerCase();
      const match = plants.find(
        (p: any) =>
          p.name?.toLowerCase().includes(identifier) ||
          p.nickname?.toLowerCase().includes(identifier) ||
          p.species?.toLowerCase().includes(identifier),
      );
      if (match) plantId = match.id;
    }
  }

  // Generate realistic random values
  const reading = {
    device_id: device!.id,
    plant_id: plantId,
    profile_id: profileId,
    soil_moisture: Math.round(25 + Math.random() * 40),       // 25-65%
    temperature: Math.round((18 + Math.random() * 8) * 10) / 10, // 18.0-26.0°C
    humidity: Math.round(40 + Math.random() * 25),             // 40-65%
    light_lux: Math.round(100 + Math.random() * 1900),        // 100-2000 lux
    reading_metadata: { simulated: true },
  };

  const { data: inserted, error: insertError } = await supabase
    .from("sensor_readings")
    .insert(reading)
    .select("id, plant_id")
    .single();

  if (insertError) {
    console.error("[SensorReading] Simulate insert error:", insertError);
    return json({ error: "Failed to store simulated reading" }, 500);
  }

  // Update last_seen_at
  supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device!.id)
    .then();

  console.log(`[SensorReading] Simulated reading ${inserted.id} for profile ${profileId}`);

  return json({
    success: true,
    reading_id: inserted.id,
    plant_id: inserted.plant_id,
    simulated: true,
    values: {
      soil_moisture: reading.soil_moisture,
      temperature: reading.temperature,
      humidity: reading.humidity,
      light_lux: reading.light_lux,
    },
  });
}

// ============================================================================
// ROUTER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (path === "simulate") {
      return await handleSimulate(req);
    }

    return await handleDeviceReading(req);
  } catch (error) {
    console.error("[SensorReading] Unhandled error:", error);
    return json({ error: "Internal server error", details: String(error) }, 500);
  }
});

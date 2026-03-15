#!/usr/bin/env -S deno run --allow-net --allow-env

// Creates a device token and registers it in the devices table.
// Usage:
//   deno run --allow-net --allow-env scripts/create-device-token.ts \
//     --profile-id <uuid> [--plant-id <uuid>] [--name "My Sensor"]
//
// Environment variables:
//   SUPABASE_URL            — your project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (NOT anon key)
//
// Or set them inline:
//   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... deno run ...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const args = Deno.args;
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const profileId = getArg("--profile-id");
const plantId = getArg("--plant-id") || null;
const deviceName = getArg("--name") || "Orchid Sensor";

if (!profileId) {
  console.error("Usage: create-device-token.ts --profile-id <uuid> [--plant-id <uuid>] [--name 'My Sensor']");
  Deno.exit(1);
}

// ---------------------------------------------------------------------------
// Generate token
// ---------------------------------------------------------------------------
const randomBytes = new Uint8Array(32);
crypto.getRandomValues(randomBytes);
const tokenBody = btoa(String.fromCharCode(...randomBytes))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");
const plainToken = `odev_${tokenBody}`;
const prefix = plainToken.substring(0, 8);

// Hash it
const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plainToken));
const tokenHash = Array.from(new Uint8Array(hashBuf))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

// ---------------------------------------------------------------------------
// Insert into database
// ---------------------------------------------------------------------------
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from("devices")
  .insert({
    profile_id: profileId,
    plant_id: plantId,
    device_token_hash: tokenHash,
    device_token_prefix: prefix,
    name: deviceName,
    status: "active",
  })
  .select("id")
  .single();

if (error) {
  console.error("Failed to create device:", error.message);
  Deno.exit(1);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
console.log("\n=== Device Created ===");
console.log(`Device ID:    ${data.id}`);
console.log(`Name:         ${deviceName}`);
console.log(`Profile ID:   ${profileId}`);
console.log(`Plant ID:     ${plantId || "(none — pulse-check mode)"}`);
console.log(`Token prefix: ${prefix}...`);
console.log("");
console.log("=== YOUR DEVICE TOKEN (copy this to ESP32 config) ===");
console.log(plainToken);
console.log("");
console.log("This token is shown ONCE and never stored in plaintext.");
console.log("If lost, revoke this device and create a new one.");

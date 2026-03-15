# IoT Sensor Feature — Complete Implementation Plan

## Context
Orchid is an AI plant care companion. We've built a working ESP32 sensor (soil moisture, temp, humidity) that posts readings to Supabase. Now we're building the full product experience: smart ranges, alerts, roaming sensors, device management, historical data, and a pixel-art EKG frontend widget. This plan covers every phase from database to firmware to frontend.

---

## Phase 1: Database Migration
**Goal:** All new tables + columns in one migration. Foundation for everything else.

### New Tables

**`sensor_ranges`** — LLM-determined ideal ranges per plant, versioned with reasoning
```sql
- id UUID PK
- plant_id UUID FK → plants (CASCADE)
- profile_id UUID FK → profiles (CASCADE)
- soil_moisture_min, soil_moisture_ideal_min, soil_moisture_ideal_max, soil_moisture_max (NUMERIC)
- temperature_min, temperature_ideal_min, temperature_ideal_max, temperature_max (NUMERIC)
- humidity_min, humidity_ideal_min, humidity_ideal_max, humidity_max (NUMERIC)
- light_lux_min, light_lux_ideal_min, light_lux_ideal_max, light_lux_max (NUMERIC)
- reasoning TEXT — why the LLM chose these ranges
- is_active BOOLEAN DEFAULT true
- created_at, updated_at
```
- Index: `(plant_id, is_active)`
- Only one active row per plant at a time

**`sensor_alerts`** — Alert lifecycle: active → dismissed/resolved
```sql
- id UUID PK
- plant_id UUID FK → plants (CASCADE)
- profile_id UUID FK → profiles (CASCADE)
- device_id UUID FK → devices (SET NULL)
- reading_id UUID FK → sensor_readings (SET NULL)
- alert_type TEXT — 'danger_dry', 'danger_wet', 'danger_cold', 'danger_hot', 'trend_drying', 'device_offline', 'battery_low'
- severity TEXT DEFAULT 'warning' — 'info', 'warning', 'critical'
- metric TEXT — 'soil_moisture', 'temperature', 'humidity', 'light_lux'
- current_value NUMERIC
- threshold_value NUMERIC
- message TEXT — human-readable description
- status TEXT DEFAULT 'active' — 'active', 'dismissed', 'resolved', 'expired'
- dismissed_at TIMESTAMPTZ
- dismissed_reason TEXT
- resolved_at TIMESTAMPTZ
- created_at
```
- Index: `(profile_id, status) WHERE status = 'active'`
- Index: `(plant_id, created_at DESC)`

**`device_assignments`** — Audit trail for sensor roaming
```sql
- id UUID PK
- device_id UUID FK → devices (CASCADE)
- plant_id UUID FK → plants (SET NULL)
- profile_id UUID FK → profiles (CASCADE)
- assigned_at TIMESTAMPTZ DEFAULT NOW()
- unassigned_at TIMESTAMPTZ
- source TEXT DEFAULT 'user' — 'user', 'voice', 'auto'
```
- Index: `(device_id, assigned_at DESC)`
- Populated by trigger on devices.plant_id changes

**`device_commands`** — Pending commands for ESP32 (identify, read_now)
```sql
- id UUID PK
- device_id UUID FK → devices (CASCADE)
- command TEXT — 'identify', 'read_now', 'set_interval'
- payload JSONB
- status TEXT DEFAULT 'pending' — 'pending', 'acknowledged', 'completed', 'expired'
- created_at
- expires_at DEFAULT NOW() + INTERVAL '5 minutes'
```
- Index: `(device_id, status) WHERE status = 'pending'`

### Trigger
```sql
-- Log device assignment changes
CREATE FUNCTION log_device_assignment() ...
  -- On UPDATE of devices.plant_id:
  -- 1. Close previous assignment (set unassigned_at = NOW())
  -- 2. Insert new assignment row if new plant_id is not null
```

### RLS
- All tables: service_role full access
- Authenticated users: own data only (profile_id check)
- sensor_alerts: users can SELECT and UPDATE (for dismissals) their own

### Files
- Create: `supabase/migrations/20260315_sensor_ranges_alerts.sql`

### Verify
- Apply migration, check tables in Supabase dashboard
- Insert test range, verify is_active constraint
- Insert test alert, verify status transitions

---

## Phase 2: LLM Tools — Ranges and Device Management
**Goal:** Orchid can set ranges, manage devices, and dismiss alerts via conversation.

### New Tool: `set_plant_ranges`
- Params: `plant_identifier`, `ranges` (object with four values per metric), `reasoning`
- Implementation: resolve plant, deactivate any existing active range, insert new range row
- The LLM calls this when identifying a new plant, when the user asks, or when suggesting seasonal adjustments
- File: `tools.ts`

### New Tool: `manage_device`
- Params: `action` ('assign', 'unassign', 'rename', 'identify', 'status'), `device_name`, `plant_identifier`, `new_name`
- `assign`: updates devices.plant_id (trigger logs assignment)
- `unassign`: sets devices.plant_id to null
- `rename`: updates devices.name
- `identify`: inserts a 'identify' command into device_commands
- `status`: returns device info + last_seen_at + current plant
- File: `tools.ts`

### New Tool: `dismiss_sensor_alert`
- Params: `plant_identifier`, `alert_type`, `reason`
- Finds active alert matching plant + type, sets status='dismissed' with reason
- File: `tools.ts`

### New Tool: `get_sensor_history`
- Params: `plant_identifier`, `metric` ('soil_moisture'|'temperature'|'humidity'|'light_lux'|'all'), `period` ('24h'|'7d'|'30d')
- Queries raw sensor_readings for the period, returns time-bucketed data
- Returns: array of {timestamp, value} + min/max/avg summary
- File: `tools.ts`

### New Tool: `compare_plant_environments`
- Params: `plant_identifiers` (array or 'all'), `metric`
- Returns latest reading per plant for the given metric, sorted
- File: `tools.ts`

### Update: `check_plant_sensors`
- After resolving plants, also fetch active sensor_ranges for each plant
- Status assessment uses plant-specific ranges instead of hardcoded thresholds
- Falls back to hardcoded thresholds if no ranges set
- Include range values in response so LLM can say "42% which is in the sweet spot for your monstera (30-65%)"

### Voice + Text Tool Declarations
- Add all new tools to `voiceTools.ts`
- Add all switch cases to `toolExecutor.ts`

### Files
- Modify: `tools.ts`, `toolExecutor.ts`, `voiceTools.ts`

### Verify
- Call each tool via voice/text conversation
- Set ranges for a plant, verify stored in DB
- Assign device via voice, verify assignment logged
- Dismiss an alert, verify status change

---

## Phase 3: Alert Engine + Context Enrichment
**Goal:** Readings automatically create/resolve alerts. System prompts include range awareness and trends.

### Alert Evaluation Function
- New function in `tools.ts`: `evaluateSensorAlerts(supabase, profileId, plantId, reading, ranges)`
- Called by the sensor-reading edge function after every successful insert
- Logic:
  1. Fetch active ranges for this plant
  2. For each metric, check if value is outside min/max (danger) or outside ideal range (warning)
  3. If danger/warning and no active alert of that type exists → create alert
  4. If value is back in ideal range and active alert exists → resolve it
  5. Never create duplicate active alerts for same plant+type

### Sensor-Reading Edge Function Updates
- After inserting reading: call evaluateSensorAlerts
- After auto-detecting watering: also advance water reminders (update next_due)
- Return pending device_commands in the 200 response body
- File: `sensor-reading/index.ts`

### Context Enrichment
- `loadHierarchicalContext()`: add query for active sensor_alerts
- `HierarchicalContext` type: add `activeSensorAlerts: any[]`
- `buildPlantsContext()`: enhance sensor line to include:
  - Range status: "moisture 42% [OK: 30-65]"
  - Trend direction computed from last 3 readings: "(stable)" / "(rising)" / "(dropping)"
  - Staleness: if last_seen_at > 30min, show "OFFLINE (last reading Xh ago)"
- Both system prompts: add sensor reconciliation guidance (user says X, sensor says Y)
- File: `context.ts`, `types.ts`

### Proactive Agent Integration
- New event type: `sensor_alert` — when critical alert is active > 30min
- New event type: `device_offline` — when device.last_seen_at > 3x send interval
- File: `proactive-agent/index.ts`

### Files
- Modify: `sensor-reading/index.ts`, `context.ts`, `types.ts`, `proactive-agent/index.ts`
- Modify: `tools.ts` (add evaluateSensorAlerts)

### Verify
- Insert a reading outside danger range → alert created
- Insert a reading back in range → alert resolved
- Load context for a conversation → see range status and trend in prompt
- Check proactive agent picks up critical alerts

---

## Phase 4: Frontend — Vitals Widget
**Goal:** EKG-style pixel-art sensor display on the plant detail page.

### New Hook: `useSensorData(plantId)`
- Queries: latest reading, active ranges, active alerts, historical readings (24h)
- Returns: `{ latest, ranges, alerts, history, isLoading, isStale, isOffline }`
- Stale = last reading > 30min ago
- Offline = last reading > 24h ago
- Uses TanStack Query with 60s refetch interval

### New Component: `PlantVitals`
- Placed in PlantDetail between plant info and reminders
- Styling: thin 1px border (`rgba(255,255,255,0.06)`), monospace values, Press Start 2P header
- Three horizontal metric rows: soil moisture, temperature, humidity
- Each row shows:
  - Metric icon + label (monospace, 9px, dim)
  - Current value (monospace, 18px, bright)
  - Mini sparkline (last 24h, ~100px wide, stepped/pixelated rendering)
  - Range bar showing where the current value sits: green=ideal, yellow=warning, red=danger zones
  - Status word: "healthy" / "watch" / "danger" / "offline"
- Pixel aesthetic: use CSS `image-rendering: pixelated` on canvas elements, stepped line rendering

### Widget States
- **Healthy**: green accents, calm sparkline
- **Warning**: amber accent on the specific metric, subtle pulse
- **Critical**: red accent, gentle pulse (not aggressive — this is a plant)
- **No data**: empty bars, "no sensor" text, "Take a reading" button
- **Stale**: last known values but desaturated, "OFFLINE Xh" label
- **No ranges**: raw values shown, hint "Ask Orchid to set ranges"

### Alert Banner
- If active alerts exist, show a dismissible banner above the vitals:
  "Soil moisture at 12% — below danger threshold. Water soon?"
- Dismiss button calls the sensor-reading simulate endpoint or logs a user_insight

### "Take a Reading" Flow (roaming)
- Button visible when plant has no recent sensor data
- Tapping opens a bottom sheet: "Move your sensor to [plant name] and tap Ready"
- On "Ready": sets a flag, waits for next reading from any unassociated device
- On reading received: associates it, vitals widget populates, confirmation shown

### Files
- Create: `src/hooks/useSensorData.ts`
- Create: `src/components/plants/PlantVitals.tsx`
- Modify: `src/components/plants/PlantDetail.tsx` (add PlantVitals section)

### Verify
- Plant with sensor data: vitals widget shows live values + sparkline
- Plant without sensor: shows empty state with "Take a reading" button
- Plant with alert: banner appears above vitals
- Stale data: grayed out with offline label

---

## Phase 5: Frontend — Collection Grid + Device Management
**Goal:** Sensor indicators on plant cards. Device management in settings.

### Collection Grid Sensor Indicators
- Modify `CollectionView.tsx`
- Each plant card gets a tiny dot in the corner of the thumbnail:
  - Green pulsing: all readings in ideal range
  - Amber: one or more warnings
  - Red: one or more critical/danger
  - Gray with slash: assigned but offline
  - No dot: no sensor assigned
- Need to batch-fetch latest readings + ranges for all plants (single query)
- File: `src/components/plants/CollectionView.tsx`

### Device Management in Settings
- New section in ProfileView / Settings: "Sensors"
- Lists all registered devices: name, status, last seen, current plant assignment
- Actions per device: rename, assign to plant, unassign, identify (blink LED), revoke
- "Identify" sends a command via the manage_device tool (POST to edge function)
- File: `src/components/profile/DeviceManagement.tsx`

### Files
- Create: `src/components/profile/DeviceManagement.tsx`
- Modify: `src/components/plants/CollectionView.tsx`
- Modify: profile/settings page to include DeviceManagement

### Verify
- Collection grid shows colored dots for sensor-equipped plants
- Settings shows all devices with correct status
- "Identify" button triggers LED blink on the physical device
- Assign/unassign works and device_assignments table logs it

---

## Phase 6: Firmware — Response Commands + LED
**Goal:** ESP32 reads commands from server response, blinks LED on identify, takes immediate reading on request.

### Parse Response Commands
- After successful POST, parse JSON response for `commands` array
- Handle `identify`: blink onboard LED (GPIO 2) for 10 seconds
- Handle `read_now`: immediately take a fresh reading and POST it
- Handle `set_interval`: update the local send interval variable

### Edge Function: Return Commands
- In sensor-reading/index.ts, after inserting reading:
  - Query device_commands for pending commands for this device
  - Include in response: `{ success: true, ..., commands: [{type: "identify"}, ...] }`
  - Mark returned commands as 'acknowledged'

### LED Identification
```cpp
#define LED_PIN 2  // ESP32 onboard LED
void blinkIdentify() {
  for (int i = 0; i < 20; i++) {  // 10 seconds of blinking
    digitalWrite(LED_PIN, HIGH);
    delay(250);
    digitalWrite(LED_PIN, LOW);
    delay(250);
  }
}
```

### Files
- Modify: `firmware/orchid-sensor/orchid-sensor.ino`
- Modify: `supabase/functions/sensor-reading/index.ts`

### Verify
- Send "identify" command from app, LED blinks within 30s
- Send "read_now" command, fresh reading appears in DB within 30s
- Commands expire after 5 minutes if not picked up

---

## Phase 7: Historical Charts + Comparison View
**Goal:** Tap a metric on the vitals widget to see full history. Compare plants.

### Historical Chart Component
- Triggered by tapping a metric row in PlantVitals
- Expands to full-width chart with 24h / 7d / 30d toggle
- Line chart with stepped/pixelated rendering (pixel art aesthetic)
- Background bands showing ideal range (green), warning (yellow), danger (red)
- Watering events from care_events shown as vertical dashed lines
- Uses Recharts with custom pixel-art theme matching dark mode
- File: `src/components/plants/SensorHistoryChart.tsx`

### Comparison View
- Accessible from collection grid: "Compare" button
- Select 2-5 plants + a metric
- Overlaid sparklines on same chart, each plant a different color
- Also accessible via voice: "compare moisture across all my plants"
- File: `src/components/plants/SensorComparison.tsx`

### Data Retention (deferred until needed)
- When raw readings exceed 7 days, consider adding:
  - sensor_reading_aggregates table (hourly/daily rollups)
  - Nightly cron to aggregate and prune
  - get_sensor_history tool queries aggregates for 7d/30d
- For now: query raw readings directly (< 1000 rows per plant for 7 days, fine for Postgres)

### Files
- Create: `src/components/plants/SensorHistoryChart.tsx`
- Create: `src/components/plants/SensorComparison.tsx`
- Modify: PlantVitals to open history on tap

### Verify
- Tap moisture row → full chart with range bands
- Toggle 24h/7d/30d → chart updates
- Watering events visible as markers
- Compare view shows multiple plants overlaid

---

## Phase 8: Plant Identification → Auto-Range Flow
**Goal:** When Orchid identifies a new plant, it automatically suggests and sets sensor ranges.

### Flow
1. User adds plant (via save_plant tool or photo identification)
2. Orchid has species info + user's location + environment insights
3. Orchid proactively says: "I've set up ideal sensor ranges for your [species] based on its needs and your environment."
4. Orchid calls `set_plant_ranges` with species-appropriate defaults + reasoning
5. If user has a sensor assigned, vitals widget immediately shows range zones

### System Prompt Addition
- In the AVAILABLE TOOLS section, add guidance:
  "When saving a new plant, also call set_plant_ranges with species-appropriate values. Consider the user's location, season, and environment insights."

### Files
- Modify: `context.ts` (both system prompts — add guidance about auto-ranging)

### Verify
- Identify a new plant via photo → ranges auto-set
- Check sensor_ranges table has a row with reasoning
- Vitals widget shows range zones immediately

---

## Implementation Notes

### Execution Order
Phase 1 → 2 → 3 → 4 → 5/6 (parallel) → 7 → 8

Phases 1-3 are backend, can be built and verified with curl/voice before any frontend.
Phase 4 is the hero feature for the demo.
Phases 5-8 are polish.

### Critical Files (all phases)
- `supabase/functions/_shared/tools.ts` — all tool implementations
- `supabase/functions/_shared/toolExecutor.ts` — tool dispatch
- `supabase/functions/_shared/voiceTools.ts` — Gemini function declarations
- `supabase/functions/_shared/context.ts` — system prompt + context loading
- `supabase/functions/_shared/types.ts` — HierarchicalContext type
- `supabase/functions/sensor-reading/index.ts` — edge function (alerts, commands, reminders)
- `supabase/functions/proactive-agent/index.ts` — proactive events
- `src/components/plants/PlantDetail.tsx` — main frontend surface
- `src/components/plants/CollectionView.tsx` — grid indicators
- `firmware/orchid-sensor/orchid-sensor.ino` — ESP32 firmware

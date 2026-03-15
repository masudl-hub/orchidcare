

# Deploy IoT Sensor Infrastructure

Two things need to happen — no code changes required, just deployment operations.

## 1. Run the IoT migration
Apply `supabase/migrations/20260313_iot_sensor_devices.sql` which creates:
- `devices` table (token-based auth for ESP32 hardware)
- `sensor_readings` table (time-series sensor data)
- RLS policies, indexes, and triggers

## 2. Deploy the `sensor-reading` edge function
Already configured in `config.toml` with `verify_jwt = false` (devices authenticate via bearer token, not JWT). Two routes:
- `POST /sensor-reading` — real device readings (token auth)
- `POST /sensor-reading/simulate` — demo/test readings (Supabase or Telegram auth)

## 3. Smoke test
Call the simulate endpoint to verify the full stack works end-to-end.

---

No file edits needed — this is purely deploy + verify.


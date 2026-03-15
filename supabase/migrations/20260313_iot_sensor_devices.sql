-- ============================================================================
-- IoT Sensor Devices & Readings
-- Enables ESP32 (or any HTTP-capable device) to POST sensor data to Orchid.
-- Two modes: always-on (device bound to plant) and pulse-check (handheld).
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

CREATE TABLE public.devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  device_token_hash TEXT NOT NULL UNIQUE,
  device_token_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Sensor',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sensor_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  soil_moisture NUMERIC,
  temperature NUMERIC,
  humidity NUMERIC,
  light_lux NUMERIC,
  battery_pct NUMERIC,
  reading_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions use this path)
CREATE POLICY "Service role can manage devices"
  ON public.devices FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sensor readings"
  ON public.sensor_readings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can manage their own devices
CREATE POLICY "Users can manage their own devices"
  ON public.devices FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Users can read their own sensor readings (INSERT via service_role only)
CREATE POLICY "Users can view their sensor readings"
  ON public.sensor_readings FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_devices_token_hash ON public.devices(device_token_hash);
CREATE INDEX idx_devices_profile ON public.devices(profile_id);
CREATE INDEX idx_sensor_readings_plant_time ON public.sensor_readings(plant_id, created_at DESC);
CREATE INDEX idx_sensor_readings_device_time ON public.sensor_readings(device_id, created_at DESC);
CREATE INDEX idx_sensor_readings_profile_time ON public.sensor_readings(profile_id, created_at DESC);

-- ============================================================================
-- 4. TRIGGERS (reuse existing update_updated_at_column function)
-- ============================================================================

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

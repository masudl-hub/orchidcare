-- ============================================================================
-- Sensor Ranges, Alerts, Device Assignments, Device Commands
-- Extends the IoT sensor system with smart ranges, alert lifecycle,
-- roaming sensor audit trail, and device command queue.
-- ============================================================================

-- ============================================================================
-- 1. SENSOR RANGES — LLM-determined ideal ranges per plant
-- ============================================================================

CREATE TABLE public.sensor_ranges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Four-value ranges: min (danger) → ideal_min → ideal_max → max (danger)
  soil_moisture_min NUMERIC,
  soil_moisture_ideal_min NUMERIC,
  soil_moisture_ideal_max NUMERIC,
  soil_moisture_max NUMERIC,

  temperature_min NUMERIC,
  temperature_ideal_min NUMERIC,
  temperature_ideal_max NUMERIC,
  temperature_max NUMERIC,

  humidity_min NUMERIC,
  humidity_ideal_min NUMERIC,
  humidity_ideal_max NUMERIC,
  humidity_max NUMERIC,

  light_lux_min NUMERIC,
  light_lux_ideal_min NUMERIC,
  light_lux_ideal_max NUMERIC,
  light_lux_max NUMERIC,

  reasoning TEXT,                          -- LLM's explanation for these ranges
  is_active BOOLEAN NOT NULL DEFAULT true, -- only one active row per plant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensor_ranges_plant_active ON public.sensor_ranges(plant_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- 2. SENSOR ALERTS — Alert lifecycle: active → dismissed/resolved
-- ============================================================================

CREATE TABLE public.sensor_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  reading_id UUID REFERENCES public.sensor_readings(id) ON DELETE SET NULL,

  alert_type TEXT NOT NULL,         -- 'danger_dry','danger_wet','danger_cold','danger_hot','warning_dry','warning_wet','warning_cold','warning_hot','device_offline','battery_low'
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  metric TEXT,                      -- 'soil_moisture','temperature','humidity','light_lux'
  current_value NUMERIC,
  threshold_value NUMERIC,
  message TEXT NOT NULL,            -- human-readable: "Monstera soil at 12%, below danger threshold of 15%"

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved', 'expired')),
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensor_alerts_profile_active ON public.sensor_alerts(profile_id, status)
  WHERE status = 'active';
CREATE INDEX idx_sensor_alerts_plant ON public.sensor_alerts(plant_id, created_at DESC);

-- ============================================================================
-- 3. DEVICE ASSIGNMENTS — Audit trail for sensor roaming
-- ============================================================================

CREATE TABLE public.device_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'voice', 'auto'))
);

CREATE INDEX idx_device_assignments_device ON public.device_assignments(device_id, assigned_at DESC);

-- ============================================================================
-- 4. DEVICE COMMANDS — Pending commands for ESP32 (identify, read_now, etc.)
-- ============================================================================

CREATE TABLE public.device_commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  command TEXT NOT NULL CHECK (command IN ('identify', 'read_now', 'set_interval')),
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_device_commands_pending ON public.device_commands(device_id, status)
  WHERE status = 'pending';

-- ============================================================================
-- 5. ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.sensor_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role can manage sensor ranges"
  ON public.sensor_ranges FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage sensor alerts"
  ON public.sensor_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage device assignments"
  ON public.device_assignments FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage device commands"
  ON public.device_commands FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can read/manage their own data
CREATE POLICY "Users can manage their sensor ranges"
  ON public.sensor_ranges FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their sensor alerts"
  ON public.sensor_alerts FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their device assignments"
  ON public.device_assignments FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their device commands"
  ON public.device_commands FOR SELECT TO authenticated
  USING (device_id IN (
    SELECT id FROM devices WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Auto-update updated_at on sensor_ranges
CREATE TRIGGER update_sensor_ranges_updated_at
  BEFORE UPDATE ON public.sensor_ranges FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Log device assignment changes when devices.plant_id is updated
CREATE OR REPLACE FUNCTION public.log_device_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Close previous assignment if plant_id changed
  IF OLD.plant_id IS DISTINCT FROM NEW.plant_id THEN
    -- End the old assignment
    IF OLD.plant_id IS NOT NULL THEN
      UPDATE public.device_assignments
        SET unassigned_at = NOW()
        WHERE device_id = NEW.id
          AND plant_id = OLD.plant_id
          AND unassigned_at IS NULL;
    END IF;

    -- Start a new assignment
    IF NEW.plant_id IS NOT NULL THEN
      INSERT INTO public.device_assignments (device_id, plant_id, profile_id, source)
        VALUES (NEW.id, NEW.plant_id, NEW.profile_id, 'auto');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_device_assignment
  AFTER UPDATE OF plant_id ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_device_assignment();

-- Auto-expire old device commands (can be called by cron or checked at query time)
CREATE OR REPLACE FUNCTION public.expire_device_commands()
RETURNS void AS $$
BEGIN
  UPDATE public.device_commands
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

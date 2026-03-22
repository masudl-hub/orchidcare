-- Tool-level action policies: replaces the old agent_permissions system with
-- per-tool tiers (auto / session_consent / always_confirm) and heartbeat opt-in.
-- Single source of truth for defaults is toolDefinitions.ts TOOL_POLICIES map.

-- ─── Enum ────────────────────────────────────────────────────────────────────

CREATE TYPE public.action_tier AS ENUM ('auto', 'session_consent', 'always_confirm');

-- ─── Tool Policies ───────────────────────────────────────────────────────────

CREATE TABLE public.tool_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  interactive_tier public.action_tier NOT NULL DEFAULT 'auto',
  heartbeat_allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, tool_name)
);

CREATE INDEX idx_tool_policies_profile ON public.tool_policies(profile_id);

ALTER TABLE public.tool_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.tool_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_select_own" ON public.tool_policies
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "users_update_own" ON public.tool_policies
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- ─── Session Consents (Tier 2 tracking) ──────────────────────────────────────

CREATE TABLE public.session_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  UNIQUE(profile_id, tool_name, session_id)
);

CREATE INDEX idx_session_consents_lookup
  ON public.session_consents(profile_id, tool_name, expires_at);

ALTER TABLE public.session_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.session_consents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Extend agent_operations for undo ────────────────────────────────────────

ALTER TABLE public.agent_operations
  ADD COLUMN IF NOT EXISTS previous_state JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS undone_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS execution_path TEXT DEFAULT NULL;

-- ─── Seed trigger: populate tool_policies for new profiles ───────────────────
-- Defaults match TOOL_POLICIES in toolDefinitions.ts.

CREATE OR REPLACE FUNCTION public.create_default_tool_policies()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tool_policies (profile_id, tool_name, interactive_tier, heartbeat_allowed) VALUES
    -- Plant Management
    (NEW.id, 'save_plant',         'auto', false),
    (NEW.id, 'modify_plant',       'auto', true),
    (NEW.id, 'delete_plant',       'always_confirm', false),
    -- Care Tracking
    (NEW.id, 'log_care_event',     'auto', true),
    (NEW.id, 'create_reminder',    'auto', true),
    (NEW.id, 'delete_reminder',    'auto', true),
    -- Sensors & Devices
    (NEW.id, 'associate_reading',  'auto', false),
    (NEW.id, 'set_plant_ranges',   'auto', true),
    (NEW.id, 'dismiss_sensor_alert', 'auto', true),
    (NEW.id, 'manage_device',      'session_consent', false),
    -- Media & Snapshots
    (NEW.id, 'capture_plant_snapshot', 'session_consent', false),
    (NEW.id, 'generate_image',     'auto', true),
    -- Profile & Preferences
    (NEW.id, 'update_profile',     'session_consent', false),
    (NEW.id, 'update_notification_preferences', 'session_consent', false),
    (NEW.id, 'save_user_insight',  'auto', true)
  ON CONFLICT (profile_id, tool_name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to profiles table (runs after insert)
DROP TRIGGER IF EXISTS trigger_create_default_tool_policies ON public.profiles;
CREATE TRIGGER trigger_create_default_tool_policies
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_tool_policies();

-- ─── Backfill: seed policies for existing profiles ───────────────────────────

INSERT INTO public.tool_policies (profile_id, tool_name, interactive_tier, heartbeat_allowed)
SELECT p.id, t.tool_name, t.interactive_tier::public.action_tier, t.heartbeat_allowed
FROM public.profiles p
CROSS JOIN (VALUES
  ('save_plant',         'auto', false),
  ('modify_plant',       'auto', true),
  ('delete_plant',       'always_confirm', false),
  ('log_care_event',     'auto', true),
  ('create_reminder',    'auto', true),
  ('delete_reminder',    'auto', true),
  ('associate_reading',  'auto', false),
  ('set_plant_ranges',   'auto', true),
  ('dismiss_sensor_alert', 'auto', true),
  ('manage_device',      'session_consent', false),
  ('capture_plant_snapshot', 'session_consent', false),
  ('generate_image',     'auto', true),
  ('update_profile',     'session_consent', false),
  ('update_notification_preferences', 'session_consent', false),
  ('save_user_insight',  'auto', true)
) AS t(tool_name, interactive_tier, heartbeat_allowed)
ON CONFLICT (profile_id, tool_name) DO NOTHING;

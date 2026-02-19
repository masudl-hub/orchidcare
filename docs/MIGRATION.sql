-- ============================================================================
-- Orchid Database Migration Script
-- Generated: 2026-02-19
-- Source: Direct introspection of live database
--
-- This script recreates the entire Orchid schema from scratch.
-- Run in a fresh Supabase project's SQL editor.
--
-- ORDER:
--   1. Enums
--   2. Tables (FK-dependency order)
--   3. RLS enable + policies
--   4. Indexes
--   5. Functions
--   6. Triggers (currently unattached in live DB — included here for completeness)
--   7. Storage buckets
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.agent_capability AS ENUM (
  'read_plants',
  'manage_plants',
  'read_reminders',
  'manage_reminders',
  'read_conversations',
  'shopping_search',
  'research_web',
  'generate_content',
  'delete_plants',
  'delete_notes',
  'delete_insights',
  'send_reminders',
  'send_insights',
  'create_reminders'
);

CREATE TYPE public.app_role AS ENUM ('user', 'premium', 'admin');

CREATE TYPE public.doctor_personality AS ENUM ('warm', 'expert', 'philosophical', 'playful');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- profiles (depends on auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text,
  whatsapp_number text,
  personality public.doctor_personality DEFAULT 'warm'::doctor_personality,
  location text,
  timezone text DEFAULT 'America/New_York'::text,
  notification_frequency text DEFAULT 'daily'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  display_name text,
  experience_level text DEFAULT 'beginner'::text,
  primary_concerns text[],
  pets text[] DEFAULT '{}'::text[],
  telegram_chat_id bigint,
  telegram_username text
);

-- plants (depends on profiles)
CREATE TABLE public.plants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text,
  nickname text,
  location_in_home text,
  photo_url text,
  acquired_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- care_events (depends on plants)
CREATE TABLE public.care_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- conversations (depends on profiles)
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel text NOT NULL,
  message_sid text,
  direction text NOT NULL,
  content text NOT NULL,
  media_urls text[],
  created_at timestamptz DEFAULT now(),
  summarized boolean DEFAULT false
);

-- conversation_summaries (depends on profiles)
CREATE TABLE public.conversation_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  summary text NOT NULL,
  message_count integer,
  start_time timestamptz,
  end_time timestamptz,
  key_topics text[],
  created_at timestamptz DEFAULT now()
);

-- user_insights (depends on profiles, conversations)
CREATE TABLE public.user_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_key text NOT NULL,
  insight_value text NOT NULL,
  confidence numeric DEFAULT 0.8,
  source_message_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- plant_identifications (depends on profiles, plants)
CREATE TABLE public.plant_identifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id uuid REFERENCES plants(id) ON DELETE SET NULL,
  photo_url text,
  species_guess text,
  confidence numeric,
  care_tips text,
  created_at timestamptz DEFAULT now(),
  diagnosis text,
  severity text,
  treatment text,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE
);

-- reminders (depends on profiles, plants)
CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plant_id uuid REFERENCES plants(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  frequency_days integer,
  next_due timestamptz NOT NULL,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- proactive_messages (depends on profiles)
CREATE TABLE public.proactive_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  trigger_data jsonb,
  message_content text NOT NULL,
  channel text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  response_received boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- proactive_preferences (depends on profiles)
CREATE TABLE public.proactive_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start time DEFAULT '22:00:00'::time,
  quiet_hours_end time DEFAULT '08:00:00'::time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- agent_permissions (depends on profiles)
CREATE TABLE public.agent_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capability public.agent_capability NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- agent_operations (depends on profiles)
CREATE TABLE public.agent_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),  -- NO CASCADE (preserve audit log)
  operation_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  tool_name text,
  correlation_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- generated_content (depends on profiles, conversations)
CREATE TABLE public.generated_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  task_description text,
  content jsonb NOT NULL,
  source_message_id uuid REFERENCES conversations(id),  -- NO CASCADE
  created_at timestamptz DEFAULT now()
);

-- linking_codes (depends on auth.users)
CREATE TABLE public.linking_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  personality text,
  location text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + '24:00:00'::interval),
  used_at timestamptz,
  phone_number text
);

-- call_sessions (depends on profiles)
CREATE TABLE public.call_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'::text,
  mode text NOT NULL DEFAULT 'audio'::text,
  voice text DEFAULT 'Aoede'::text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  tool_calls_count integer DEFAULT 0,
  summary text,
  created_at timestamptz DEFAULT now()
);

-- user_roles (depends on auth.users)
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_identifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linking_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- ---- profiles ----
CREATE POLICY "Deny anonymous access to profiles" ON public.profiles
  FOR SELECT TO anon USING (false);

CREATE POLICY "Service role can access profiles" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---- plants ----
CREATE POLICY "Service role can manage plants" ON public.plants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own plants" ON public.plants
  FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own plants" ON public.plants
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- care_events ----
CREATE POLICY "Service role can manage care events" ON public.care_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their plant care events" ON public.care_events
  FOR ALL USING (plant_id IN (SELECT p.id FROM plants p JOIN profiles pr ON p.profile_id = pr.id WHERE pr.user_id = auth.uid()));

CREATE POLICY "Users can view their plant care events" ON public.care_events
  FOR SELECT USING (plant_id IN (SELECT p.id FROM plants p JOIN profiles pr ON p.profile_id = pr.id WHERE pr.user_id = auth.uid()));

-- ---- conversations ----
CREATE POLICY "Service role can manage conversations" ON public.conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their conversations" ON public.conversations
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- conversation_summaries ----
CREATE POLICY "Service role can manage conversation summaries" ON public.conversation_summaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own summaries" ON public.conversation_summaries
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their summaries" ON public.conversation_summaries
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their summaries" ON public.conversation_summaries
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their summaries" ON public.conversation_summaries
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- user_insights ----
CREATE POLICY "Service role can manage user insights" ON public.user_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own insights" ON public.user_insights
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their insights" ON public.user_insights
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their insights" ON public.user_insights
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their insights" ON public.user_insights
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- plant_identifications ----
CREATE POLICY "Service role can manage identifications" ON public.plant_identifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their identifications" ON public.plant_identifications
  FOR SELECT TO authenticated
  USING (
    (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR
    (plant_id IN (SELECT p.id FROM plants p JOIN profiles pr ON p.profile_id = pr.id WHERE pr.user_id = auth.uid()))
  );

-- ---- reminders ----
CREATE POLICY "Service role can manage reminders" ON public.reminders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their reminders" ON public.reminders
  FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their reminders" ON public.reminders
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- proactive_messages ----
CREATE POLICY "Service role can manage proactive messages" ON public.proactive_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own proactive messages" ON public.proactive_messages
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their proactive messages" ON public.proactive_messages
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their proactive messages" ON public.proactive_messages
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their proactive messages" ON public.proactive_messages
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- proactive_preferences ----
CREATE POLICY "Service role can manage preferences" ON public.proactive_preferences
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own preferences" ON public.proactive_preferences
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their preferences" ON public.proactive_preferences
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own preferences" ON public.proactive_preferences
  FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their preferences" ON public.proactive_preferences
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- agent_permissions (NO service_role policy in live DB) ----
CREATE POLICY "Users can view their agent permissions" ON public.agent_permissions
  FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their permissions" ON public.agent_permissions
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their agent permissions" ON public.agent_permissions
  FOR UPDATE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their permissions" ON public.agent_permissions
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- agent_operations ----
CREATE POLICY "Service can insert agent operations" ON public.agent_operations
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Users can view their agent operations" ON public.agent_operations
  FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- generated_content ----
CREATE POLICY "Service role can manage generated content" ON public.generated_content
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their generated content" ON public.generated_content
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their generated content" ON public.generated_content
  FOR INSERT TO authenticated WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their generated content" ON public.generated_content
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their generated content" ON public.generated_content
  FOR DELETE TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ---- linking_codes ----
CREATE POLICY "Service role can manage linking codes" ON public.linking_codes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert own codes" ON public.linking_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own codes" ON public.linking_codes
  FOR SELECT USING (auth.uid() = user_id);

-- ---- call_sessions (NO policies in live DB — security gap) ----
-- WARNING: call_sessions has RLS enabled but NO policies.
-- Add policies here if client-side access is needed:
--
-- CREATE POLICY "Users can view their call sessions" ON public.call_sessions
--   FOR SELECT TO authenticated
--   USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
--
-- CREATE POLICY "Service role can manage call sessions" ON public.call_sessions
--   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---- user_roles ----
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 5. INDEXES (non-PK)
-- ============================================================================

-- agent_operations
CREATE INDEX idx_agent_ops_correlation ON public.agent_operations USING btree (correlation_id);
CREATE INDEX idx_agent_ops_profile ON public.agent_operations USING btree (profile_id, created_at DESC);

-- agent_permissions
ALTER TABLE public.agent_permissions ADD CONSTRAINT agent_permissions_profile_id_capability_key UNIQUE (profile_id, capability);

-- call_sessions
CREATE INDEX idx_call_sessions_profile ON public.call_sessions USING btree (profile_id, created_at DESC);

-- care_events
CREATE INDEX idx_care_events_created ON public.care_events USING btree (created_at DESC);
CREATE INDEX idx_care_events_plant ON public.care_events USING btree (plant_id);

-- conversations
CREATE INDEX idx_conversations_created ON public.conversations USING btree (created_at DESC);
CREATE INDEX idx_conversations_profile ON public.conversations USING btree (profile_id);
CREATE INDEX idx_conversations_profile_created ON public.conversations USING btree (profile_id, created_at DESC);

-- linking_codes
CREATE INDEX idx_linking_codes_code ON public.linking_codes USING btree (code);
CREATE INDEX idx_linking_codes_phone ON public.linking_codes USING btree (phone_number);
CREATE INDEX idx_linking_codes_user_id ON public.linking_codes USING btree (user_id);
ALTER TABLE public.linking_codes ADD CONSTRAINT linking_codes_code_key UNIQUE (code);

-- plant_identifications
CREATE INDEX idx_plant_identifications_created ON public.plant_identifications USING btree (created_at DESC);
CREATE INDEX idx_plant_identifications_plant ON public.plant_identifications USING btree (plant_id) WHERE (plant_id IS NOT NULL);
CREATE INDEX idx_plant_identifications_profile ON public.plant_identifications USING btree (profile_id) WHERE (profile_id IS NOT NULL);

-- plants
CREATE INDEX idx_plants_profile ON public.plants USING btree (profile_id);

-- proactive_messages
CREATE INDEX idx_proactive_messages_profile_sent ON public.proactive_messages USING btree (profile_id, sent_at DESC);

-- proactive_preferences
ALTER TABLE public.proactive_preferences ADD CONSTRAINT proactive_preferences_profile_id_topic_key UNIQUE (profile_id, topic);

-- profiles
CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone_number);
CREATE INDEX idx_profiles_telegram_chat_id ON public.profiles USING btree (telegram_chat_id);
CREATE UNIQUE INDEX idx_profiles_telegram_chat_id_unique ON public.profiles USING btree (telegram_chat_id) WHERE (telegram_chat_id IS NOT NULL);
CREATE INDEX idx_profiles_whatsapp ON public.profiles USING btree (whatsapp_number);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_number_key UNIQUE (phone_number);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_telegram_chat_id_key UNIQUE (telegram_chat_id);

-- reminders
CREATE INDEX idx_reminders_next_due_active ON public.reminders USING btree (next_due) WHERE (is_active = true);
CREATE INDEX idx_reminders_profile_active ON public.reminders USING btree (profile_id) WHERE (is_active = true);

-- user_insights
ALTER TABLE public.user_insights ADD CONSTRAINT user_insights_profile_id_insight_key_key UNIQUE (profile_id, insight_key);

-- user_roles
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- ============================================================================
-- 6. DATABASE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_by_phone(_phone text)
RETURNS TABLE(id uuid, user_id uuid, phone_number text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, user_id, phone_number FROM public.profiles WHERE phone_number = _phone LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_agent_capability(_profile_id uuid, _capability agent_capability)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_permissions
    WHERE profile_id = _profile_id
      AND capability = _capability
      AND enabled = true
  )
$$;

CREATE OR REPLACE FUNCTION public.increment_tool_calls_count(p_session_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE call_sessions
  SET tool_calls_count = tool_calls_count + 1
  WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_agent_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.agent_permissions (profile_id, capability)
  VALUES 
    (NEW.id, 'delete_plants'),
    (NEW.id, 'delete_notes'),
    (NEW.id, 'delete_insights'),
    (NEW.id, 'send_reminders'),
    (NEW.id, 'send_insights'),
    (NEW.id, 'create_reminders');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_proactive_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.proactive_preferences (profile_id, topic)
  VALUES 
    (NEW.id, 'care_reminders'),
    (NEW.id, 'observations'),
    (NEW.id, 'seasonal_tips'),
    (NEW.id, 'health_followups');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. TRIGGERS
--
-- WARNING: These triggers are NOT attached in the current live database.
-- They existed previously but were dropped/lost. Uncomment to reattach.
-- The auth.users trigger requires running via Supabase dashboard SQL editor
-- with elevated privileges.
-- ============================================================================

-- Auto-assign 'user' role on signup
-- NOTE: This trigger is on auth.users and requires superuser/dashboard access
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.assign_default_user_role();

-- Auto-create default agent permissions on profile creation
-- CREATE TRIGGER on_profile_created_permissions
--   AFTER INSERT ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION public.create_default_agent_permissions();

-- Auto-create default proactive preferences on profile creation
-- CREATE TRIGGER on_profile_created_preferences
--   AFTER INSERT ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION public.create_default_proactive_preferences();

-- Auto-update updated_at timestamp
-- CREATE TRIGGER update_profiles_updated_at
--   BEFORE UPDATE ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER update_plants_updated_at
--   BEFORE UPDATE ON public.plants
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER update_reminders_updated_at
--   BEFORE UPDATE ON public.reminders
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER update_user_insights_updated_at
--   BEFORE UPDATE ON public.user_insights
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('generated-guides', 'generated-guides', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('plant-photos', 'plant-photos', false);

-- Add storage policies as needed for your application.
-- Example:
-- CREATE POLICY "Users can upload plant photos" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'plant-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

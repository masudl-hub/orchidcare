
-- ============================================================================
-- Orchid Database Migration - Tables first, then functions
-- ============================================================================

-- 1. ENUMS
CREATE TYPE public.agent_capability AS ENUM (
  'read_plants', 'manage_plants', 'read_reminders', 'manage_reminders',
  'read_conversations', 'shopping_search', 'research_web', 'generate_content',
  'delete_plants', 'delete_notes', 'delete_insights', 'send_reminders',
  'send_insights', 'create_reminders'
);

CREATE TYPE public.app_role AS ENUM ('user', 'premium', 'admin');
CREATE TYPE public.doctor_personality AS ENUM ('warm', 'expert', 'philosophical', 'playful');

-- 2. TABLES (in FK-dependency order)
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text,
  whatsapp_number text,
  personality public.doctor_personality DEFAULT 'warm',
  location text,
  timezone text DEFAULT 'America/New_York',
  notification_frequency text DEFAULT 'daily',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  display_name text,
  experience_level text DEFAULT 'beginner',
  primary_concerns text[],
  pets text[] DEFAULT '{}',
  telegram_chat_id bigint,
  telegram_username text
);

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

CREATE TABLE public.care_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE public.proactive_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start time DEFAULT '22:00:00',
  quiet_hours_end time DEFAULT '08:00:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capability public.agent_capability NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.agent_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  operation_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  tool_name text,
  correlation_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.generated_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  task_description text,
  content jsonb NOT NULL,
  source_message_id uuid REFERENCES conversations(id),
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE public.call_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  mode text NOT NULL DEFAULT 'audio',
  voice text DEFAULT 'Aoede',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  tool_calls_count integer DEFAULT 0,
  summary text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. FUNCTIONS (after tables exist)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_agent_capability(_profile_id uuid, _capability agent_capability)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.agent_permissions WHERE profile_id = _profile_id AND capability = _capability AND enabled = true)
$$;

CREATE OR REPLACE FUNCTION public.get_profile_by_phone(_phone text)
RETURNS TABLE(id uuid, user_id uuid, phone_number text) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, user_id, phone_number FROM public.profiles WHERE phone_number = _phone LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.increment_tool_calls_count(p_session_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE call_sessions SET tool_calls_count = tool_calls_count + 1 WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_agent_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.agent_permissions (profile_id, capability) VALUES 
    (NEW.id, 'delete_plants'), (NEW.id, 'delete_notes'), (NEW.id, 'delete_insights'),
    (NEW.id, 'send_reminders'), (NEW.id, 'send_insights'), (NEW.id, 'create_reminders');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_proactive_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.proactive_preferences (profile_id, topic) VALUES 
    (NEW.id, 'care_reminders'), (NEW.id, 'observations'), (NEW.id, 'seasonal_tips'), (NEW.id, 'health_followups');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. RLS
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

-- 5. RLS POLICIES
CREATE POLICY "Deny anonymous access to profiles" ON public.profiles FOR SELECT TO anon USING (false);
CREATE POLICY "Service role can access profiles" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage plants" ON public.plants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their own plants" ON public.plants FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage care events" ON public.care_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their plant care events" ON public.care_events FOR ALL TO authenticated USING (plant_id IN (SELECT p.id FROM plants p JOIN profiles pr ON p.profile_id = pr.id WHERE pr.user_id = auth.uid()));

CREATE POLICY "Service role can manage conversations" ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their conversations" ON public.conversations FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage conversation summaries" ON public.conversation_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their summaries" ON public.conversation_summaries FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage user insights" ON public.user_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their insights" ON public.user_insights FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage identifications" ON public.plant_identifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view their identifications" ON public.plant_identifications FOR SELECT TO authenticated USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR plant_id IN (SELECT p.id FROM plants p JOIN profiles pr ON p.profile_id = pr.id WHERE pr.user_id = auth.uid())
);

CREATE POLICY "Service role can manage reminders" ON public.reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their reminders" ON public.reminders FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage proactive messages" ON public.proactive_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their proactive messages" ON public.proactive_messages FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage preferences" ON public.proactive_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their preferences" ON public.proactive_preferences FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their agent permissions" ON public.agent_permissions FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service can insert agent operations" ON public.agent_operations FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can view their agent operations" ON public.agent_operations FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage generated content" ON public.generated_content FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their generated content" ON public.generated_content FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage linking codes" ON public.linking_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert own codes" ON public.linking_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own codes" ON public.linking_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage call sessions" ON public.call_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view their call sessions" ON public.call_sessions FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 6. INDEXES
CREATE INDEX idx_agent_ops_correlation ON public.agent_operations USING btree (correlation_id);
CREATE INDEX idx_agent_ops_profile ON public.agent_operations USING btree (profile_id, created_at DESC);
ALTER TABLE public.agent_permissions ADD CONSTRAINT agent_permissions_profile_id_capability_key UNIQUE (profile_id, capability);
CREATE INDEX idx_call_sessions_profile ON public.call_sessions USING btree (profile_id, created_at DESC);
CREATE INDEX idx_care_events_created ON public.care_events USING btree (created_at DESC);
CREATE INDEX idx_care_events_plant ON public.care_events USING btree (plant_id);
CREATE INDEX idx_conversations_created ON public.conversations USING btree (created_at DESC);
CREATE INDEX idx_conversations_profile ON public.conversations USING btree (profile_id);
CREATE INDEX idx_conversations_profile_created ON public.conversations USING btree (profile_id, created_at DESC);
CREATE INDEX idx_linking_codes_code ON public.linking_codes USING btree (code);
CREATE INDEX idx_linking_codes_phone ON public.linking_codes USING btree (phone_number);
CREATE INDEX idx_linking_codes_user_id ON public.linking_codes USING btree (user_id);
ALTER TABLE public.linking_codes ADD CONSTRAINT linking_codes_code_key UNIQUE (code);
CREATE INDEX idx_plant_identifications_created ON public.plant_identifications USING btree (created_at DESC);
CREATE INDEX idx_plant_identifications_plant ON public.plant_identifications USING btree (plant_id) WHERE (plant_id IS NOT NULL);
CREATE INDEX idx_plant_identifications_profile ON public.plant_identifications USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_plants_profile ON public.plants USING btree (profile_id);
CREATE INDEX idx_proactive_messages_profile_sent ON public.proactive_messages USING btree (profile_id, sent_at DESC);
ALTER TABLE public.proactive_preferences ADD CONSTRAINT proactive_preferences_profile_id_topic_key UNIQUE (profile_id, topic);
CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone_number);
CREATE INDEX idx_profiles_telegram_chat_id ON public.profiles USING btree (telegram_chat_id);
CREATE UNIQUE INDEX idx_profiles_telegram_chat_id_unique ON public.profiles USING btree (telegram_chat_id) WHERE (telegram_chat_id IS NOT NULL);
CREATE INDEX idx_profiles_whatsapp ON public.profiles USING btree (whatsapp_number);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_number_key UNIQUE (phone_number);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_telegram_chat_id_key UNIQUE (telegram_chat_id);
CREATE INDEX idx_reminders_next_due_active ON public.reminders USING btree (next_due) WHERE (is_active = true);
CREATE INDEX idx_reminders_profile_active ON public.reminders USING btree (profile_id) WHERE (is_active = true);
ALTER TABLE public.user_insights ADD CONSTRAINT user_insights_profile_id_insight_key_key UNIQUE (profile_id, insight_key);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- 7. TRIGGERS
CREATE TRIGGER on_profile_created_permissions
  AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_agent_permissions();

CREATE TRIGGER on_profile_created_preferences
  AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_proactive_preferences();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plants_updated_at
  BEFORE UPDATE ON public.plants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_insights_updated_at
  BEFORE UPDATE ON public.user_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-guides', 'generated-guides', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('plant-photos', 'plant-photos', false);

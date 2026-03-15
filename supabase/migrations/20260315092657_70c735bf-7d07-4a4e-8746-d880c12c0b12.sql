
-- Outbound message audit: single source of truth for every Telegram send
CREATE TABLE public.outbound_message_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source_function text NOT NULL,
  source_mode text NOT NULL CHECK (source_mode IN ('telegram_reply', 'proactive', 'media_followup', 'other')),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  telegram_chat_id bigint,
  correlation_id text,
  message_preview text,
  message_hash text,
  telegram_message_id bigint,
  delivery_status text NOT NULL DEFAULT 'attempted' CHECK (delivery_status IN ('attempted', 'delivered', 'failed', 'skipped')),
  error_code text,
  error_detail text,
  trigger_payload jsonb
);

CREATE INDEX idx_outbound_audit_profile ON public.outbound_message_audit(profile_id);
CREATE INDEX idx_outbound_audit_created ON public.outbound_message_audit(created_at DESC);
CREATE INDEX idx_outbound_audit_source ON public.outbound_message_audit(source_mode);
CREATE INDEX idx_outbound_audit_correlation ON public.outbound_message_audit(correlation_id);

-- Proactive run audit: tracks each proactive-agent invocation
CREATE TABLE public.proactive_run_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_started_at timestamptz NOT NULL,
  run_ended_at timestamptz,
  trigger_source text,
  profiles_scanned int NOT NULL DEFAULT 0,
  events_found int NOT NULL DEFAULT 0,
  messages_delivered int NOT NULL DEFAULT 0,
  messages_skipped int NOT NULL DEFAULT 0,
  skip_reasons jsonb,
  duration_ms int,
  error text
);

CREATE INDEX idx_proactive_run_created ON public.proactive_run_audit(created_at DESC);

-- RLS: user-readable by own profile_id; write by service role only
ALTER TABLE public.outbound_message_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_run_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage outbound audit"
  ON public.outbound_message_audit FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their outbound audit"
  ON public.outbound_message_audit FOR SELECT
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage run audit"
  ON public.proactive_run_audit FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view run audit"
  ON public.proactive_run_audit FOR SELECT
  TO authenticated
  USING (true);

-- Add proactive_enabled kill switch to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS proactive_enabled boolean NOT NULL DEFAULT true;

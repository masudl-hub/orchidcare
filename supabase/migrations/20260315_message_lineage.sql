-- ============================================================================
-- Message Lineage — trace agent side effects back to the source message
-- Adds source_message_id to tables that are created as a result of
-- agent tool calls during conversations, enabling "delete message and
-- everything it spawned" functionality.
-- ============================================================================

-- care_events: created by log_care_event tool
ALTER TABLE public.care_events
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- reminders: created by create_reminder / modify_reminder tools
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- sensor_ranges: created by set_plant_ranges tool
ALTER TABLE public.sensor_ranges
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- conversation_summaries: track which messages were compressed into this summary
-- Using an array of UUIDs rather than a junction table for simplicity
ALTER TABLE public.conversation_summaries
  ADD COLUMN IF NOT EXISTS source_message_ids UUID[] DEFAULT '{}';

-- agent_operations: already has correlation_id but add direct FK for stronger lineage
ALTER TABLE public.agent_operations
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- plant_snapshots: created by capture_plant_snapshot tool
ALTER TABLE public.plant_snapshots
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- plant_identifications: created during plant identification flows
ALTER TABLE public.plant_identifications
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- ============================================================================
-- Indexes for lineage queries ("find everything spawned by message X")
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_care_events_source_msg ON public.care_events(source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_source_msg ON public.reminders(source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sensor_ranges_source_msg ON public.sensor_ranges(source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_ops_source_msg ON public.agent_operations(source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plant_snapshots_source_msg ON public.plant_snapshots(source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plant_identifications_source_msg ON public.plant_identifications(source_message_id) WHERE source_message_id IS NOT NULL;

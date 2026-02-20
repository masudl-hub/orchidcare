CREATE TABLE public.plant_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  description TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'identification',
  source TEXT NOT NULL DEFAULT 'telegram_photo',
  health_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plant_snapshots_plant_id ON public.plant_snapshots(plant_id);
CREATE INDEX idx_plant_snapshots_profile_id ON public.plant_snapshots(profile_id);
CREATE INDEX idx_plant_snapshots_created_at ON public.plant_snapshots(created_at DESC);

ALTER TABLE public.plant_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view their own snapshots
CREATE POLICY "Users can view their plant snapshots" ON public.plant_snapshots
  FOR SELECT USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Service role can manage all snapshots (edge functions)
CREATE POLICY "Service role can manage snapshots" ON public.plant_snapshots
  FOR ALL USING (true) WITH CHECK (true);
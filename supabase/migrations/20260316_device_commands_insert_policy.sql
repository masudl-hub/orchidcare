-- Allow authenticated users to insert commands for their own devices
CREATE POLICY "Users can send commands to their devices"
  ON public.device_commands FOR INSERT TO authenticated
  WITH CHECK (device_id IN (
    SELECT id FROM devices WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Migration to allow user account deletion without breaking agent_operations audit trail
-- By making profile_id nullable and setting it to ON DELETE SET NULL, 
-- when auth.users is deleted, the cascade will delete the profile, 
-- and agent_operations will simply keep the operation log but clear the profile_id.

ALTER TABLE public.agent_operations ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.agent_operations DROP CONSTRAINT IF EXISTS agent_operations_profile_id_fkey;

ALTER TABLE public.agent_operations
  ADD CONSTRAINT agent_operations_profile_id_fkey 
  FOREIGN KEY (profile_id) 
  REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

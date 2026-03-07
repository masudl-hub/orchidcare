
-- Fix agent_operations FK: change from NO ACTION to CASCADE
ALTER TABLE public.agent_operations DROP CONSTRAINT agent_operations_profile_id_fkey;
ALTER TABLE public.agent_operations
  ADD CONSTRAINT agent_operations_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also fix generated_content source_message_id FK (currently NO ACTION)
ALTER TABLE public.generated_content DROP CONSTRAINT generated_content_source_message_id_fkey;
ALTER TABLE public.generated_content
  ADD CONSTRAINT generated_content_source_message_id_fkey
  FOREIGN KEY (source_message_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

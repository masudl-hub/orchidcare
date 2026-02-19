
-- Fix function search path for increment_tool_calls_count
CREATE OR REPLACE FUNCTION public.increment_tool_calls_count(p_session_id uuid)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $$
  UPDATE call_sessions SET tool_calls_count = tool_calls_count + 1 WHERE id = p_session_id;
$$;

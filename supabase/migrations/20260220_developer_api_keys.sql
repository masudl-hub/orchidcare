-- ============================================================================
-- Developer API Keys: Rewrite with hashing support
-- ============================================================================
-- Drop old table if it exists (from previous migration)
DROP TABLE IF EXISTS public.developer_api_keys CASCADE;

CREATE TABLE public.developer_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Security: we NEVER store the plaintext key
    key_hash TEXT NOT NULL UNIQUE,               -- SHA-256 hash of the full key (used for auth lookups)
    key_prefix TEXT NOT NULL,                     -- First 8 chars for display: "orch_a1b2..."
    
    name TEXT NOT NULL DEFAULT 'Default',         -- Human label e.g. "Production Bot"
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    
    -- Usage tracking
    total_calls INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 7,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Fast lookups by hash (the auth path)
CREATE INDEX idx_developer_api_keys_hash ON public.developer_api_keys(key_hash);
-- Lookup all keys for a developer
CREATE INDEX idx_developer_api_keys_profile ON public.developer_api_keys(profile_id);

-- Enable RLS
ALTER TABLE public.developer_api_keys ENABLE ROW LEVEL SECURITY;

-- Developers can view their own keys
CREATE POLICY "Developers can view own keys"
    ON public.developer_api_keys FOR SELECT
    USING (auth.uid() = profile_id);

-- Developers can create keys for themselves
CREATE POLICY "Developers can create keys"
    ON public.developer_api_keys FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

-- Developers can update their own keys (revoke, rename)
CREATE POLICY "Developers can update own keys"
    ON public.developer_api_keys FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Developers can delete their own keys
CREATE POLICY "Developers can delete own keys"
    ON public.developer_api_keys FOR DELETE
    USING (auth.uid() = profile_id);


-- ============================================================================
-- API Usage Log: Every call tracked for observability + rate limiting
-- ============================================================================
CREATE TABLE public.api_usage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES public.developer_api_keys(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    end_user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Critical index: rate limiting queries recent calls by key
CREATE INDEX idx_api_usage_log_key_time ON public.api_usage_log(api_key_id, created_at DESC);
-- Developer's own logs lookup
CREATE INDEX idx_api_usage_log_profile ON public.api_usage_log(profile_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- Developers can view their own usage logs
CREATE POLICY "Developers can view own usage logs"
    ON public.api_usage_log FOR SELECT
    USING (auth.uid() = profile_id);

-- No INSERT/UPDATE/DELETE policies for regular users
-- Only the service role (edge function) can insert logs

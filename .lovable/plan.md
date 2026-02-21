

# Fix: pwa-agent 401 Unauthorized

## Problem
The `pwa-agent` edge function is returning 401 at the gateway level. The function code never executes (68ms response, zero function logs). This means the Lovable Cloud gateway is rejecting the request before it reaches your code.

Your `supabase/config.toml` already has `verify_jwt = false`, which should prevent this -- but the config may not have synced with the last deployment.

## Root Causes (two possible)

### 1. Config not synced after deployment
The `verify_jwt = false` setting may not have been picked up. Solution: redeploy `pwa-agent`.

### 2. Race condition: function called before auth session is restored
If `PwaChat` mounts and immediately calls `pwa-agent` before the Supabase client restores the session from localStorage, the request goes out without a Bearer token, causing a 401. This is the more likely cause since the function was already deployed with `verify_jwt = false`.

## Fix

### 1. Redeploy `pwa-agent`
Force a fresh deployment to ensure the `verify_jwt = false` config is synced.

### 2. Guard `pwa-agent` calls against missing auth session
In `src/components/pwa/PwaChat.tsx`, before calling `supabase.functions.invoke('pwa-agent', ...)`, verify that a session exists:

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  throw new Error('Not authenticated');
}
```

This prevents the race condition where the function is called before the JWT is available.

## Scope
- **File**: `src/components/pwa/PwaChat.tsx` (add session guard in `sendMessage`)
- **Deployment**: Redeploy `pwa-agent`

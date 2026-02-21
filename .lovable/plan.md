

## Fix: Developer API Key Foreign Key and RLS Violation

### Problem
The code in `DeveloperDashboard.tsx` uses `user.id` (which is `auth.uid()`) directly as `profile_id` when querying and inserting into `developer_api_keys`. But `profile_id` references `profiles.id`, which is a **different UUID** from `profiles.user_id`. The RLS policies are already correct -- they check ownership via `profiles.user_id = auth.uid()` -- but the wrong value is being passed.

### Solution
No database changes needed. Only update `DeveloperDashboard.tsx`:

### Technical Details

**File: `src/components/developers/DeveloperDashboard.tsx`**

1. Add a `profileId` state variable to store the actual `profiles.id`.

2. At the start of `fetchData`, look up the profile:
   ```typescript
   const { data: profile } = await supabase
     .from("profiles")
     .select("id")
     .eq("user_id", user.id)
     .single();
   if (!profile) { setLoading(false); return; }
   setProfileId(profile.id);
   ```

3. Replace `user.id` with `profile.id` in two places:
   - **Line 134**: `.eq("profile_id", user.id)` changes to `.eq("profile_id", profile.id)`
   - **Line 198**: `profile_id: user.id` changes to `profile_id: profileId` (using the stored state)

4. Update `handleGenerate` to use the stored `profileId` state instead of `user.id`.

This is a single-file fix with no database migration required.

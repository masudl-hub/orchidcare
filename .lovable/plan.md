

## Fix: Developer API Key Foreign Key Violation

### Problem
The `DeveloperDashboard` component uses `user.id` (the auth user ID) directly as `profile_id` when inserting into `developer_api_keys`. However, the `profiles` table has its own `id` column (a separate UUID) that differs from `user_id`. The foreign key `developer_api_keys_profile_id_fkey` references `profiles.id`, not `profiles.user_id`.

For example, a user might have:
- `auth.uid()` = `511860c0-...`
- `profiles.id` = `0312d930-...`

The code currently passes `511860c0-...` as `profile_id`, which doesn't exist in `profiles.id`.

### Solution
Update `DeveloperDashboard.tsx` to first look up the user's `profiles.id` from their `user_id`, then use that profile ID for all queries.

### Technical Details

**File: `src/components/developers/DeveloperDashboard.tsx`**

1. In `fetchData`, add a query to get the profile record first:
   ```typescript
   const { data: profile } = await supabase
     .from("profiles")
     .select("id")
     .eq("user_id", user.id)
     .single();
   if (!profile) return;
   ```

2. Store the `profileId` in component state or a ref.

3. Replace all instances of `user.id` used as `profile_id` with `profile.id` -- this affects:
   - The `developer_api_keys` SELECT query (line 134)
   - The `developer_api_keys` INSERT in `handleGenerate` (line 198)

4. Remove `as any` type casts where possible now that the types are properly generated.


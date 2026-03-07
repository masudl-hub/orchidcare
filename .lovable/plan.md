

# RLS Security Audit — CIA Assessment

## Current State Summary

Reviewed all 16 tables against Confidentiality, Integrity, and Availability.

---

## Confidentiality — Grade: A-

All SELECT policies correctly scope data to the owning user via `profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())` or equivalent joins.

**Remaining concern:**
- `developer_api_keys`: The `key_hash` column is returned in SELECT results. While the hash alone isn't reversible, defense-in-depth says hide it. A database view excluding `key_hash` would be ideal.

---

## Integrity — Grade: B+

**Fixed since last audit:**
- Previous `agent_operations` INSERT `WITH CHECK (true)` issue was flagged.

**Still open — critical:**
1. **`agent_operations` INSERT policy is still `WITH CHECK (true)`** — any authenticated user can insert rows with *any* `profile_id`. This is a spoofing vector. Should be:
   ```sql
   WITH CHECK (profile_id IN (
     SELECT id FROM profiles WHERE user_id = auth.uid()
   ))
   ```

2. **`call_sessions` service-role ALL policy uses `WITH CHECK (true)`** — this is fine for service-role context, but the table also lacks an authenticated-user INSERT policy. If the frontend ever inserts directly, it would fail (availability issue) or if a permissive policy is added later without ownership checks, it becomes an integrity issue. Low risk currently.

3. **No foreign key constraints on `profile_id`** across most tables (`agent_operations`, `care_events`, `plants`, `reminders`, etc.). While RLS handles access control, missing FKs mean orphaned rows can accumulate if profiles are deleted without cascading. The `delete-account` edge function only cleans `plant-photos` storage — it doesn't explicitly clean other tables.

---

## Availability — Grade: A-

**Good:**
- Users have full CRUD (`ALL`) on their own data for: `plants`, `reminders`, `care_events`, `conversations`, `agent_permissions`, `proactive_preferences`, `proactive_messages`, `user_insights`, `generated_content`, `conversation_summaries`, `developer_api_keys`.
- `linking_codes`: Users can INSERT and SELECT their own codes.

**Gaps:**
- `plant_identifications`: Users can only SELECT, not DELETE or UPDATE. Users cannot remove misidentifications.
- `plant_snapshots`: Users can only SELECT, not DELETE. Users cannot remove unwanted snapshots.
- `api_usage_log`: Read-only for users — correct, no action needed.
- `agent_operations`: Read-only for users — correct, no action needed.

---

## Priority Fixes

| # | Table | Issue | CIA | Severity |
|---|-------|-------|-----|----------|
| 1 | `agent_operations` | INSERT allows any `profile_id` | Integrity | **High** |
| 2 | `plant_identifications` | No user DELETE policy | Availability | Medium |
| 3 | `plant_snapshots` | No user DELETE policy | Availability | Medium |
| 4 | `developer_api_keys` | `key_hash` exposed in SELECT | Confidentiality | Low |
| 5 | Multiple tables | No FK on `profile_id` — orphan risk on account deletion | Availability | Low |

---

## Overall: B+ → aiming for A

The single high-severity item is the `agent_operations` INSERT policy. Fixing that plus adding DELETE on identifications/snapshots would bring this to a solid A-.


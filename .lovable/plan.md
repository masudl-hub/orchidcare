

# Fix: Surface Pet Info in Agent System Prompts

## Problem
Your profile stores `pets: ["cat"]`, but the system prompt builder (`buildUserIdentitySection` in `context.ts`) never reads the `pets` field. The agents (voice calls, text chat, orchid-agent) don't know you have a pet, so they can't factor in toxicity warnings or pet-safe recommendations.

Additionally, no `user_insights` rows exist for `has_pets`/`pet_type`, which is the secondary path for surfacing this info.

## Fix

### 1. Update `buildUserIdentitySection` in `supabase/functions/_shared/context.ts`

Add `profile.pets` to the user identity section so it appears in the system prompt for all agents (voice, text, orchid-agent):

```
## ABOUT THIS USER
Name: eml
Experience Level: Beginner - ...
Pets: cat - ALWAYS consider pet toxicity. Flag any plant or product that could be harmful.
```

This single change fixes it everywhere since both `buildEnrichedSystemPrompt` (text/orchid-agent) and `buildVoiceSystemPrompt` (voice calls) call the same `buildUserIdentitySection` function.

### 2. Backfill `user_insights` for existing profiles with pets

Insert `has_pets` and `pet_type` insight rows for your profile so the "USER FACTS" section also reflects this. This is a one-time data fix via a database migration.

## Technical Details

**File: `supabase/functions/_shared/context.ts`** (line ~134-152)

In `buildUserIdentitySection`, after the `primary_concerns` line, add:

```typescript
const userPets = profile?.pets || [];
// ...
return `## ABOUT THIS USER
${userName ? `Name: ${userName} ...` : "Name: Not provided"}
Experience Level: ${experienceLevelGuide[userExperience] || ...}
${userConcerns.length > 0 ? `Primary Interests: ...` : ""}
${userPets.length > 0 ? `Pets in home: ${userPets.join(", ")} - ALWAYS consider pet toxicity when recommending plants or products. Proactively flag anything potentially harmful to ${userPets.join("/")}s.` : ""}`;
```

**Database migration**: Insert missing insight rows:

```sql
INSERT INTO user_insights (profile_id, insight_key, insight_value)
VALUES
  ('62dca5ae-a71e-403f-b805-0d17c017a7cb', 'has_pets', 'yes'),
  ('62dca5ae-a71e-403f-b805-0d17c017a7cb', 'pet_type', 'cat')
ON CONFLICT DO NOTHING;
```

**Redeploy**: `call-session`, `orchid-agent`, `pwa-agent`, and `demo-agent` (all consumers of the shared context).

## Scope of Impact
- Voice calls (call-session) -- fixed
- Text chat (orchid-agent) -- fixed  
- PWA agent (pwa-agent) -- fixed
- Demo agent (demo-agent) -- fixed

All four use `buildUserIdentitySection` from the shared `context.ts`.


Goal: fully trace and control unsolicited Telegram outreach so we can prove exactly where the 11:00 messages come from and stop/restrict them immediately.

What I found (after digging through edge functions + DB)
- The only code paths that can proactively send Telegram text are:
  1) `proactive-agent` (direct Telegram `sendMessage`)
  2) `telegram-bot` (only after inbound Telegram webhook updates)
  3) `orchid-agent` can generate content for proactive mode but does not itself push text to Telegram.
- `proactive-agent` currently has observability gaps:
  - No durable run-level audit table (only ephemeral logs)
  - It logs to `proactive_messages` only on “delivered=true”, but doesn’t capture failed attempts/details robustly
  - No persistent correlation ID across proactive-agent → orchid-agent → Telegram API
- Current data confirms identity split:
  - `Masud` profile: `0312d930...` with Telegram linked
  - Separate profile `62dca5ae...` has parlor palm (spider mite context) but no Telegram link
- `proactive-agent` frequency logic only enforces limits for `daily` and `weekly`; any other value bypasses guardrails (important bug vector).
- There is currently no “single source of truth” table proving each outbound Telegram send with source/function/profile/chat at send time.

Implementation plan
1) Add durable outbound observability (backend migration + RLS)
- Create `outbound_message_audit` table with:
  - `id`, `created_at`, `source_function`, `source_mode` (`telegram_reply|proactive|media_followup|other`)
  - `profile_id`, `telegram_chat_id`, `correlation_id`
  - `message_preview`, `message_hash`, `telegram_message_id`
  - `delivery_status` (`attempted|delivered|failed|skipped`)
  - `error_code`, `error_detail`, `trigger_payload` (jsonb)
- Create `proactive_run_audit` table:
  - run start/end, profiles scanned, events found, delivered count, skip reasons histogram
- RLS: user-readable by own `profile_id`; write by service role only.

2) Instrument every Telegram send path
- `proactive-agent`:
  - Log every attempt + result to `outbound_message_audit` (including failures/skips)
  - Log each run to `proactive_run_audit`
  - Persist correlation ID and pass into orchid-agent headers/body
- `telegram-bot`:
  - Log outbound replies to `outbound_message_audit` so user-initiated vs proactive is provable
- `orchid-agent`:
  - Include correlation ID in internal JSON response metadata and conversation rows for traceability.

3) Fix proactive control bugs (root-cause hardening)
- Normalize `notification_frequency` to strict enum on write (`off|daily|weekly|realtime`) in `_shared/tools.ts`.
- In `proactive-agent`, enforce behavior for all values:
  - `off` => hard skip
  - `daily`/`weekly` => existing rate-limit checks
  - `realtime` => bounded by per-topic dedupe cooldown (not unlimited spam)
  - unknown values => safe default skip + audit warning.
- Add event fingerprint dedupe:
  - hash of `profile_id + event_type + plant/reminder/diagnosis identifiers + day_bucket`
  - suppress repeat proactive sends for same event within configurable window.

4) Add explicit user kill switch
- Add profile-level hard stop flag (`proactive_paused_until` or `proactive_enabled=false`) checked before any proactive evaluation.
- Surface this in both:
  - Telegram command handling (“pause reminders”, “resume reminders”)
  - Web settings UI (single clear toggle + topic toggles + quiet hours + frequency).

5) Add forensic/debug tooling in app
- New “Notification Activity” view (or debug panel) showing:
  - timestamp, source function, plant/topic context, delivery status, message preview
  - quick filters for “proactive only” and “failed only”
- This removes dependence on short-lived runtime logs.

6) Validation plan (end-to-end)
- Simulate due reminder and verify:
  - `proactive_run_audit` row created
  - `outbound_message_audit` row created with `source_mode=proactive`
  - conversation row linkage + correlation ID present
- Send normal Telegram user message and verify:
  - `source_mode=telegram_reply` (not proactive)
- Set frequency to `off` and verify zero proactive sends.
- Set malformed frequency value and verify safe skip + audit warning (no send).

Technical details
```text
Current send architecture:
Telegram inbound webhook -> telegram-bot -> orchid-agent -> reply to Telegram
Scheduled proactive path -> proactive-agent -> orchid-agent -> proactive-agent -> Telegram API

Problem today:
No durable unified audit across both paths, and partial frequency guard logic.

Target:
Both paths write to one immutable outbound audit stream + run audit + correlation IDs.
```

Expected outcome
- We will be able to answer, with evidence, for any 11:00 message:
  - which function sent it
  - which profile context generated it
  - why it was sent (trigger payload)
  - whether settings should have blocked it
- And you’ll have a hard stop + reliable controls so this cannot continue silently.

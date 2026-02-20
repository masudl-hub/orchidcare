

# Telegram /start Revamp + /profile Command

## Overview

Revamp the first-touch `/start` experience to be warmer, on-brand, and collect lightweight profile info via inline buttons. Add a `/profile` command that lets users update their profile settings at any time. Phased to ship the highest-value piece first.

---

## Phase 1: Revamped /start with Inline Questions (highest value)

Replace the current plain text welcome message with a branded intro + 5 sequential inline-button questions, all optional with a "Skip" button.

### How it works

When a new user hits `/start`:

1. **Welcome message** (richer, branded):
   ```
   Hey! I'm Orchid -- your plant care companion.

   Send me a photo of any plant and I'll identify it, diagnose problems, and help you keep it thriving. You can also just talk to me about anything plant-related.

   Let me get to know you a bit first. Everything below is optional -- you can always update later with /profile.
   ```

2. **Question 1** -- "What should I call you?" with inline buttons:
   - Uses the user's Telegram `first_name` as a suggestion: `[Use "{first_name}"] [Skip]`
   - If they tap the name, it saves `display_name`. If skip, move on.

3. **Question 2** -- "How should I talk to you?" (personality):
   - `[Warm] [Playful] [Expert] [Philosophical]`
   - `[Skip]`

4. **Question 3** -- "How experienced are you with plants?"
   - `[Beginner] [Intermediate] [Expert]`
   - `[Skip]`

5. **Question 4** -- "Do you have any pets? (for plant toxicity awareness)"
   - `[Dog] [Cat] [Bird] [Fish] [Rabbit]` (multi-select, toggleable)
   - `[Done] [Skip]`

6. **Question 5** -- "Where are you located? (for seasonal tips)"
   - This one can't be inline buttons -- it requires text input
   - Send: "Drop your city, zip code, or country and I'll tailor seasonal advice. Or tap Skip."
   - `[Skip]`
   - If they type text (not a command), save it as `location`

7. **Wrap-up message**:
   ```
   You're all set! Here's what I can do:

   - Send a photo to identify or diagnose a plant
   - Ask me anything about plant care
   - /call -- start a live voice conversation
   - /myplants -- view your saved plants
   - /profile -- update your preferences anytime
   ```

### Technical approach

**State machine using callback queries:**
- Each question sends an inline keyboard with callback data like `onboard:personality:warm`, `onboard:experience:beginner`, `onboard:pets:dog`, `onboard:skip:personality`
- A `bot.on("callback_query:data")` handler parses the prefix, updates the profile in the DB, then sends the next question
- For pets (multi-select), the handler toggles the selection and edits the current message's keyboard to show selected state (checkmarks), with a `[Done]` button to proceed
- For location (text input), set a temporary "awaiting location" state. The simplest approach: store `onboarding_step` in a lightweight in-memory Map keyed by chatId. When the text handler sees a user in "awaiting location" state, it saves the location and sends the wrap-up. The Map is per-invocation so it won't persist across cold starts -- but the onboarding flow happens within one session, so this is fine. As a fallback, if the state is lost, the text just goes to the agent normally.
- For returning users who hit `/start` again, skip the onboarding and show a shorter welcome + commands list

**Files changed:**
- `supabase/functions/telegram-bot/index.ts`:
  - Rewrite `/start` handler to detect new vs returning user (check if `display_name` or `personality` has been explicitly set, or add a `onboarded` flag)
  - Add `bot.on("callback_query:data")` handler for `onboard:*` callbacks
  - Add onboarding state Map for the location text-input step
  - Modify `bot.on("message:text")` to check onboarding state before routing to agent
  - Add `/profile` command handler
  - Update `/help` to include `/profile`

**Database:** No schema changes needed. All fields (`display_name`, `personality`, `experience_level`, `pets`, `location`) already exist on the `profiles` table.

---

## Phase 2: /profile Command (inline settings)

The `/profile` command shows the user's current settings as a formatted message with inline buttons to change each one. This is the "come back to it later" path.

### How it works

User sends `/profile`. Bot replies with:

```
Your Profile

Name: Alex
Personality: Warm
Experience: Beginner
Pets: Dog, Cat
Location: Brooklyn, NY
Notifications: Daily
```

With inline buttons:
```
[Change Name] [Change Personality]
[Change Experience] [Change Pets]
[Change Location] [Change Notifications]
```

Each button triggers the same inline-button flow from Phase 1 for that specific field, then returns to the profile view.

### Why not a Mini App?

A Mini App (web view) would give us the full Settings UI from the dashboard, but it requires:
- A new edge function for JWT exchange (`/auth/telegram-exchange` per ORCHID_DECISIONS.md)
- initData HMAC validation
- Custom JWT signing
- Testing across platforms

That's a Phase 3 effort. The inline-button approach in Phase 2 covers 90% of the need with zero new infrastructure. The Mini App can be added later as a "power-up" for users who want the full dashboard experience.

---

## Phase 3 (Future): Mini App for Full Settings

Not in scope for this implementation, but documented for later:
- Build the JWT exchange edge function
- Wrap the Settings page as a Telegram Mini App
- `/profile` would offer both: inline buttons for quick changes + a "Full Settings" button that opens the Mini App

---

## Implementation Sequence

1. Add the `bot.on("callback_query:data")` handler with `onboard:*` routing
2. Add the onboarding state Map + location text intercept in `message:text`
3. Rewrite `/start` to detect new user and begin the question flow
4. Add `/profile` command with current-settings display + change buttons
5. Update `/help` to list `/profile`
6. Deploy `telegram-bot`

---

## Technical Details

### Callback data format
- `onboard:name:use` -- use Telegram first_name
- `onboard:personality:warm|playful|expert|philosophical`
- `onboard:experience:beginner|intermediate|expert`
- `onboard:pets:dog|cat|bird|fish|rabbit` (toggle)
- `onboard:pets:done` -- finish pet selection
- `onboard:skip:name|personality|experience|pets|location`
- `profile:edit:name|personality|experience|pets|location|notifications`

### Inline keyboard for pets (multi-select with state)

When user taps a pet, the handler:
1. Reads current `pets` array from DB
2. Toggles the tapped pet
3. Saves to DB
4. Edits the message's inline keyboard to show checkmarks on selected pets
5. `[Done]` advances to next question

### New vs returning user detection

Check `profile.display_name` or a simple heuristic: if the profile was created in the last 60 seconds (comparing `created_at` to now), treat as new user and run onboarding. Otherwise show the returning-user welcome. This avoids adding a new DB column.




# Privacy Policy Page (`/privacy`)

## Overview

Create a new `/privacy` route styled identically to a section in the `/proposal` page -- black background, monospace typography, white-on-black aesthetic with the scroll-snap sections, figure annotations, and reveal animations.

The content will be an honest, code-reflective privacy policy based on what the codebase actually collects and uses.

---

## What the Code Actually Does (data audit)

Based on the database schema and edge functions:

**Data collected:**
- Profile info: display name, experience level, personality preference, pets, location, timezone, phone/WhatsApp number, Telegram chat ID and username
- Plant data: names, species, nicknames, photos, location in home, care events, diagnoses, reminders
- Conversations: message content, channel (iMessage/WhatsApp/Telegram/web), timestamps, conversation summaries
- User insights: learned preferences extracted by the AI from conversations
- Plant photos: stored in `plant-photos` storage bucket
- Proactive message history and preference controls

**Third-party services used:**
- Google Gemini (AI processing -- identification, diagnosis, conversation)
- Perplexity Sonar (research agent -- store finding, care research)
- Twilio (SMS/WhatsApp messaging)
- Telegram Bot API
- Supabase (database, auth, storage)

**What is NOT done:**
- No analytics/tracking scripts (no Google Analytics, no telemetry)
- No ad networks
- No data selling or sharing beyond the services above
- No cookies beyond auth session

---

## Page Structure

The page will be a standalone page matching the Proposal aesthetic:

1. **Section 1: Hero** -- "Trust & Privacy" title with decrypt animation
2. **Section 2: What We Collect** -- Grid of data categories with brief descriptions
3. **Section 3: How We Use It** -- Explanation of AI processing, memory, proactive care
4. **Section 4: Third-Party Services** -- Honest list of services and why each is used
5. **Section 5: What We Don't Do** -- The "no tracking, no ads, no selling" section
6. **Section 6: Your Controls** -- Profile settings, data deletion, notification preferences
7. **Section 7: Contact** -- How to reach out

Each section uses the same `min-h-screen`, `scrollSnapAlign: "start"`, `FigureAnnotation`, `useInView`, `revealStyle`, `useDecryptText`, and monospace styling from the Proposal page.

---

## Technical Details

### Files to create:
- `src/pages/Privacy.tsx` -- The full privacy page, reusing the same hooks and patterns from Proposal (useInView, revealStyle, useDecryptText, FigureAnnotation, GrainOverlay, mono/pressStart constants)

### Files to modify:
- `src/App.tsx` -- Add `/privacy` route (public, no auth guard)

### Shared utilities:
Rather than importing from Proposal (which is a 2500-line monolith), the Privacy page will define its own copies of the small utility hooks (useInView, revealStyle, useDecryptText) since they're lightweight (~50 lines total). It will share the same visual constants (mono font, pressStart font, border colors, text opacities).

### Styling approach:
- Full black background (`bg-black`)
- Monospace typography throughout (`ui-monospace, monospace`)
- Section headers in Press Start 2P with decrypt animation
- Content in mono at 14-15px with `rgba(255,255,255,0.5-0.7)` coloring
- Bordered cards with `1px solid rgba(255,255,255,0.08)` for data category grids
- Scroll snap sections with figure annotations (FIG P.1, P.2, etc.)
- Grain overlay for texture
- Back button to return to landing page


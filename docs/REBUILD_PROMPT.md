# Orchid — Full Rebuild Prompt

> Paste this into a fresh Lovable workspace to recreate the project. Follow the numbered steps in order.

---

## Step 0: Project Identity

This is **Orchid** — an AI-powered plant care companion. The AI agent is named **Viridis**. It provides plant identification, health diagnosis, care reminders, and conversational plant advice across web, SMS/WhatsApp (Twilio), and Telegram channels, plus a real-time voice mode via Gemini Live.

**Published URL:** orchidml.lovable.app

---

## Step 1: Enable Lovable Cloud

Before anything else, enable Lovable Cloud on the project. This gives you the database, auth, edge functions, and secrets management.

---

## Step 2: Run the Database Migration

Go to Cloud → Database → Run SQL and execute the contents of `docs/MIGRATION.sql` (included in the codebase). This creates:

- 3 enums: `agent_capability` (14 values), `app_role`, `doctor_personality`
- 16 tables with full RLS policies (FK-dependency order)
- 29 indexes (including partial indexes)
- 8 database functions
- 2 storage buckets: `plant-photos`, `generated-guides`

**IMPORTANT:** After running the migration, also uncomment and run the triggers section (Section 7 of MIGRATION.sql). The `auth.users` trigger requires elevated privileges — run it via the Cloud SQL editor separately.

---

## Step 3: Configure Secrets

Add these 8 manual secrets (see `docs/SECRETS.md` for details):

1. `GEMINI_API_KEY` — Google AI Studio
2. `TWILIO_ACCOUNT_SID` — Twilio Console
3. `TWILIO_AUTH_TOKEN` — Twilio Console
4. `TWILIO_PHONE_NUMBER` — Twilio Console (e.g. `+1234567890`)
5. `TELEGRAM_BOT_TOKEN` — @BotFather on Telegram
6. `PERPLEXITY_API_KEY` — Perplexity API (or use Lovable connector)
7. `DEV_AUTH_SECRET` — Self-generated secure random string
8. `DEMO_HMAC_SECRET` — Self-generated secure random string

Also add:
- `Perplexity_Research` — Perplexity research config
- `LOVABLE_API_KEY` — Lovable platform API

The 5 `SUPABASE_*` secrets are auto-configured.

---

## Step 4: Tech Stack & Dependencies

**Core:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui

**Key dependencies to install:**
```
@fontsource/instrument-serif
@google/genai
@hookform/resolvers
@tanstack/react-query
class-variance-authority
clsx
cmdk
date-fns
embla-carousel-react
framer-motion
input-otp
jspdf
lenis
lucide-react
next-themes
pixi.js
qrcode-generator
react-day-picker
react-hook-form
react-markdown
react-resizable-panels
react-router-dom
recharts
sonner
tailwind-merge
tailwindcss-animate
vaul
zod
@supabase/supabase-js
```

---

## Step 5: Design System

### Aesthetic Direction
- **Tone:** Premium botanical, organic warmth meets modern editorial
- **Typography:** Instrument Serif (display/hero), Inter (body)
- **Palette:** Forest greens + botanical cream + golden accents
- **Themes:** "Botanical Cream" (light default), "Emerald Night" (dark)

### CSS Tokens (index.css)
The design system uses HSL CSS variables:
- `--primary`: 152 55% 28% (forest green)
- `--background`: 45 30% 97% (botanical cream)
- `--accent`: 42 70% 85% (golden warmth)
- `--hero-bg`: 150 20% 6% (dark landing page)
- `--hero-fg`: 45 25% 95%
- `--demo-bubble-user` / `--demo-bubble-agent` for chat UI

Dark theme uses `--primary`: 158 65% 42% (vibrant emerald).

Custom utilities: `.glass`, `.glass-dark`, `.gradient-mesh`, `.text-gradient`, `.text-hero`, `.text-display`, `.text-title`, `.phone-mockup`, `.phone-screen`

Custom animations: `float`, `pulse-glow`, `shimmer`, `fade-up`, `scale-fade-in`

### Tailwind Config
Extended with: `hero.bg`, `hero.fg`, `demo.user`, `demo.agent` color tokens. Custom border-radius up to `4xl`. Custom easing: `out-expo`, `in-out-expo`.

---

## Step 6: Application Architecture

### Routes (App.tsx)
```
/                   → OrchidPage (premium scrollytelling landing page)
/login              → LoginPage
/begin              → BeginPage (signup flow)
/signup             → redirects to /begin
/onboarding         → Onboarding (protected)
/dashboard          → Dashboard (protected, with sub-routes: /collection, /profile, /activity)
/settings           → Settings (protected)
/plants             → Plants (protected)
/proposal           → Proposal (public)
/call               → LiveCallPage (voice mode)
/dev/call           → DevCallPage (dev voice mode)
/demo               → DemoPage (interactive demo)
/get-demo           → DemoPage (alias)
```

Auth uses `AuthContext` with Supabase auth. Protected routes redirect to `/login`.

### Frontend Components Structure

```
src/components/
├── landing/           # Scrollytelling landing page sections
│   ├── Hero.tsx, orchid-hero.tsx
│   ├── Nav.tsx
│   ├── ChatDemo.tsx
│   ├── FeatureBento.tsx
│   ├── identify-feature.tsx, diagnosis-feature.tsx
│   ├── guides-feature.tsx, memory-feature.tsx
│   ├── shopping-feature.tsx, proactive-feature.tsx
│   ├── live-feature.tsx, cta-feature.tsx
│   ├── plant-carousel.tsx
│   ├── qr-orchid.tsx, qr-morph-canvas.tsx
│   ├── BotanicalLeaf.tsx, BrutalistPatterns.tsx
│   ├── MemoryOrb.tsx, SwarmLoader.tsx
│   ├── LoadingScreen.tsx, start-page.tsx
│   └── telegram-fallback.tsx
├── demo/              # Interactive demo chat
│   ├── DemoInputBar.tsx, DemoTurnCounter.tsx
│   ├── DemoLimitScreen.tsx, DemoVoiceOverlay.tsx
│   ├── DemoArtifactStack.tsx
│   └── artifacts/     # Rich card renderers
│       ├── IdentificationCard.tsx, DiagnosisCard.tsx
│       ├── CareGuideCard.tsx, VisualGuideCard.tsx
│       ├── StoreListCard.tsx, ChatResponse.tsx
│       └── index.ts
├── call/              # Real-time voice UI
│   ├── CallScreen.tsx, CallControls.tsx
│   ├── OrchidAvatar.tsx, AnnotationOverlay.tsx
│   └── CallErrorBoundary.tsx
├── dashboard/         # User dashboard
│   ├── Dashboard.tsx
│   └── SystemProtocols.tsx
├── plants/            # Plant collection
│   └── PlantDetail.tsx
├── figma/
│   └── ImageWithFallback.tsx
├── ui/                # shadcn/ui components
├── ConnectTelegram.tsx, CreateAccount.tsx
├── LinkPhone.tsx, Login.tsx
├── NavLink.tsx, OnboardingComplete.tsx
├── ProfileConfig.tsx, SmoothScroll.tsx
└── BrutalistTooltip.tsx
```

### Hooks
```
src/hooks/
├── call/              # Voice mode hooks
│   ├── types.ts
│   ├── useAudioCapture.ts
│   ├── useAudioPlayback.ts
│   └── useVideoCapture.ts
├── useGeminiLive.ts   # Gemini Live API WebSocket
├── usePlants.ts       # Plant CRUD
├── useSettings.ts     # User settings
├── useInsights.ts     # User insights
├── useActivity.ts     # Activity feed
├── use-mobile.tsx     # Responsive detection
└── use-toast.ts       # Toast notifications
```

### Pages
```
src/pages/
├── OrchidPage.tsx     # Landing page (scrollytelling entry point)
├── DemoPage.tsx       # Interactive agent demo
├── LoginPage.tsx      # Auth login
├── BeginPage.tsx      # Signup flow
├── Auth.tsx           # Auth utilities
├── Onboarding.tsx     # New user onboarding
├── Dashboard.tsx      # Main dashboard
├── Settings.tsx       # User settings
├── Plants.tsx         # Plant collection
├── LiveCallPage.tsx   # Production voice calls
├── DevCallPage.tsx    # Dev voice calls
├── Proposal.tsx       # Product proposal
├── Explorations.tsx   # Explorations
├── PixelGarden.tsx    # Pixel garden experiment
└── NotFound.tsx       # 404
```

---

## Step 7: Backend — Edge Functions

6 edge functions in `supabase/functions/`:

### Shared Module (`_shared/`)
- `auth.ts` — Authentication helpers, profile lookup
- `context.ts` — Context building (plants, reminders, insights, conversation history)
- `research.ts` — Perplexity web research integration
- `tools.ts` — Tool definitions and execution (plant CRUD, reminders, identification, shopping, content generation, navigate_to_signup)
- `types.ts` — Shared TypeScript types

### orchid-agent (`orchid-agent/index.ts`)
The **central orchestrator**. Handles all authenticated user interactions via any channel. Uses a hierarchical agent architecture:
- `gemini-3-flash-preview` as orchestrator for chat routing
- `gemini-3-pro-preview` as specialist for complex vision tasks
- Personality-driven system prompts based on user's selected `doctor_personality` (warm/expert/philosophical/playful)
- Supports `X-Proactive-Trigger` header for proactive outreach mode
- Full tool suite: plant management, reminders, identification, diagnosis, research, content generation

### demo-agent (`demo-agent/index.ts`)
**Stateless** version of orchid-agent for the landing page interactive demo. Includes all intelligence tools (vision, research) but **disables database writes**. Used by `DemoChat.tsx`. Tracks exchanges via localStorage + fingerprinting, prompts for signup after 3 turns via `navigate_to_signup` tool.

### proactive-agent (`proactive-agent/index.ts`)
Automated outreach via cron. Checks for due reminders and health follow-ups, then calls orchid-agent with `X-Proactive-Trigger` header to generate natural-sounding check-in messages.

### telegram-bot (`telegram-bot/index.ts`)
Telegram Bot API webhook handler. Receives messages, routes them through orchid-agent, sends responses back. Handles photo attachments for plant identification.

### call-session (`call-session/index.ts`)
Manages real-time voice session lifecycle (create, update status, end). Used by the Gemini Live voice mode.

### dev-call-proxy (`dev-call-proxy/index.ts`)
Development proxy for voice call testing.

---

## Step 8: Key Architectural Patterns

1. **Agentic-First Philosophy:** The web UI is largely read-only. All active plant management (bulk updates, care logging, deletions) happens via natural conversation with Viridis through any channel.

2. **Profile-Based Data Model:** All user data is keyed to `profiles.id` (not `auth.users.id`). Profiles link to auth users via `user_id`. This enables multi-channel identity (same profile across web, SMS, Telegram).

3. **Multi-Channel Identity:** Users can link phone numbers (Twilio SMS/WhatsApp) and Telegram accounts to their profile via `linking_codes`.

4. **Agent Permissions:** Granular per-user capability toggles in `agent_permissions` table. 6 opt-in destructive capabilities: `delete_plants`, `delete_notes`, `delete_insights`, `send_reminders`, `send_insights`, `create_reminders`.

5. **Conversation Memory:** Full conversation history stored in `conversations` table. Periodic summarization via `conversation_summaries`. User insights extracted to `user_insights` for long-term memory.

6. **Proactive Outreach:** `proactive_preferences` controls per-topic opt-in (care_reminders, observations, seasonal_tips, health_followups) with quiet hours.

7. **RLS Pattern:** All tables use `profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())` pattern. Service role has full access for edge functions. Anonymous access is explicitly denied on profiles.

8. **Build Isolation:** `tsconfig.app.json` only includes `src/` to prevent Deno imports in edge functions from breaking the Vite build.

---

## Step 9: Post-Setup Checklist

- [ ] Cloud enabled
- [ ] Migration SQL executed
- [ ] Triggers attached (especially `on_auth_user_created` for auto role assignment)
- [ ] All 8 manual secrets configured
- [ ] Perplexity connector linked (or manual API key)
- [ ] Edge functions deployed (auto-deploys on save)
- [ ] Telegram webhook URL set to `https://<project-ref>.supabase.co/functions/v1/telegram-bot`
- [ ] Twilio webhook URL set to orchid-agent endpoint
- [ ] Test signup → onboarding → dashboard flow
- [ ] Test demo chat on landing page
- [ ] Verify voice mode connects (requires Gemini API key)

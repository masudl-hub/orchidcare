# Orchid — Technical Documentation Outline

> **Purpose:** This document is a proposed outline for the full technical report on Orchid.  
> Each section includes a summary of what it will cover and a mini-structure of its subsections.  
> It follows the course-project report template and is organised both by feature and by technical implementation.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Problem & Motivation](#2-business-problem--motivation)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [AI Agent Architecture — Viridis](#4-ai-agent-architecture--viridis)
5. [Messaging Channel Integrations](#5-messaging-channel-integrations)
6. [Real-Time Voice Call System](#6-real-time-voice-call-system)
7. [Data Layer & Database Models](#7-data-layer--database-models)
8. [Web Application (Frontend)](#8-web-application-frontend)
9. [Authentication & Security](#9-authentication--security)
10. [Memory & Context Engineering](#10-memory--context-engineering)
11. [Results & Evaluation](#11-results--evaluation)
12. [Limitations & Future Work](#12-limitations--future-work)
13. [Ethical Considerations & References](#13-ethical-considerations--references)

---

## 1. Executive Summary

### Summary

A one-page snapshot of the entire project, written last so it accurately reflects all findings. It covers the problem, solution, key design decisions, and headline results in a form that can be read independently.

### Mini-Structure

```
1.1  What Orchid is — one-sentence description
1.2  The problem it solves and who benefits
1.3  The solution approach (multi-channel AI agent + voice)
1.4  Technology choices at a glance (Gemini, Supabase, Twilio, Telegram, React/Vite)
1.5  Key results and metrics
1.6  Primary limitations and where the prototype cuts corners
1.7  Demo video link
```

---

## 2. Business Problem & Motivation

### Summary

This section establishes the real-world pain point that motivated Orchid. It explains why plant care is difficult for the average person, what the current status quo looks like (scattered advice, app fatigue, high abandonment), and why a conversational, multi-channel AI agent is a promising solution. It also identifies the primary and secondary beneficiaries.

### Mini-Structure

```
2.1  Problem statement
       – ~67 % of houseplant owners report losing at least one plant per year to avoidable causes
       – Existing solutions: Google searches, Reddit, dedicated apps (all passive)
       – Root causes: low engagement, wrong timing, lack of personalisation
2.2  The opportunity
       – Conversational AI lowers the effort floor
       – SMS/WhatsApp/Telegram meet users on channels they already use daily
       – Voice adds a hands-free, ambient care-check mode
2.3  Target users and personas
       – Primary: beginner-to-intermediate hobbyist plant owners
       – Secondary: enthusiasts with large collections who need systematic reminders
2.4  Market context
       – Houseplant market size and growth (post-2020 boom)
       – Comparison with existing competitors (Greg, Planta, Vera)
2.5  Why AI now
       – LLM maturity, multimodal vision, real-time audio APIs (Gemini 2.5 Flash)
       – Cost-feasibility of serverless edge inference
```

---

## 3. System Architecture Overview

### Summary

A high-level view of how all components fit together: the React PWA frontend, Supabase backend (database + auth + edge functions + storage), three messaging channels, and the Gemini AI layer. This section provides the mental model an engineer needs before diving into individual components. It includes both an ASCII block diagram and a Mermaid flowchart.

### Mini-Structure

```
3.1  Component inventory
       | Layer         | Technology                              |
       |---------------|-----------------------------------------|
       | Frontend PWA  | React 18, Vite, TypeScript, Tailwind    |
       | Backend BaaS  | Supabase (PostgreSQL, Auth, Storage)    |
       | Edge Functions| Deno (Supabase Edge Runtime)            |
       | AI inference  | Google Gemini (gemini-2.5-flash, Live)  |
       | SMS/WhatsApp  | Twilio                                  |
       | Telegram      | Bot API (grammY library)                |
       | Web research  | Perplexity API                          |
       | Geocoding     | OpenStreetMap Nominatim                 |

3.2  ASCII system diagram

       ┌──────────────┐    HTTPS     ┌───────────────────────────────────────┐
       │  React PWA   │◄────────────►│           Supabase Cloud              │
       │  (Vite/TS)   │              │  ┌─────────┐  ┌──────────────────┐   │
       └──────────────┘              │  │ PostSQL │  │  Supabase Auth   │   │
              ▲                      │  │  (RLS)  │  │  (JWT / OAuth)   │   │
              │ WebSocket            │  └────┬────┘  └──────────────────┘   │
       ┌──────┴──────┐               │       │  ┌──────────────────────────┐ │
       │ Gemini Live │               │       │  │    Edge Functions (Deno) │ │
       │   API       │               │       │  │  orchid-agent            │ │
       └─────────────┘               │       │  │  telegram-bot            │ │
                                     │       │  │  call-session            │ │
       ┌──────────────┐    webhook   │       │  │  proactive-agent         │ │
       │    Twilio    │◄────────────►│       │  │  demo-agent              │ │
       │ SMS/WhatsApp │              │       │  │  summarise-call          │ │
       └──────────────┘              │       │  └──────────────────────────┘ │
                                     │       │                               │
       ┌──────────────┐    webhook   │  ┌────▼──────────────────────────┐   │
       │  Telegram    │◄────────────►│  │      Storage Buckets          │   │
       │  Bot API     │              │  │  plant-photos, generated-guides│   │
       └──────────────┘              │  └───────────────────────────────┘   │
                                     └───────────────────────────────────────┘

3.3  Mermaid data-flow diagram

       ```mermaid
       flowchart TD
           User([User])
           PWA[React PWA]
           TG[Telegram Bot]
           TW[Twilio SMS/WA]
           OA[orchid-agent]
           CS[call-session]
           PA[proactive-agent]
           GL[Gemini Live API]
           GF[Gemini Flash API]
           DB[(Supabase PostgreSQL)]
           ST[(Supabase Storage)]
           PX[Perplexity Research]

           User -->|Web / PWA chat| PWA
           User -->|Telegram messages| TG
           User -->|SMS / WhatsApp| TW
           User -->|Voice call| GL

           PWA -->|REST + Realtime| DB
           PWA -->|invoke| OA
           PWA -->|invoke| CS

           TG -->|invoke| OA
           TW -->|invoke| OA

           OA -->|generate response| GF
           OA -->|research query| PX
           OA -->|read/write| DB
           OA -->|store photos| ST

           CS -->|stream audio token| GL
           CS -->|tool calls| OA
           CS -->|read/write| DB

           PA -->|trigger| OA
           PA -->|read| DB
       ```

3.4  Request lifecycle walkthrough — from user message to AI reply
3.5  Deployment topology
       – Lovable Cloud (Supabase hosted, Vercel-style SPA deployment)
       – No self-managed infrastructure
3.6  Key design constraints that shaped architecture choices
```

---

## 4. AI Agent Architecture — Viridis

### Summary

The core intellectual contribution of Orchid is the `orchid-agent` Supabase Edge Function. This section documents Viridis — the AI persona — and the full agent loop: how a user message arrives, how hierarchical context is assembled, how the Gemini Flash model is prompted, and how tool calls are executed. It covers every tool the agent can invoke, the capability permission model, and how media (images, video) is preprocessed before vision inference. This section is sufficient for an engineer to rebuild the agent from scratch.

### Mini-Structure

```
4.1  Agent identity and persona
       – Name: Viridis; personality is configurable (warm / expert / philosophical / playful)
       – Personality is stored per-user in profiles.personality
       – System prompt construction: buildEnrichedSystemPrompt() in _shared/context.ts

4.2  Model used
       – Model: gemini-2.5-flash-preview (text/vision, multi-turn)
       – Accessed via @google/genai SDK
       – Tool-use (function calling) enabled
       – Image preprocessing: deno_image resize to ≤1536px longest edge, JPEG 85 quality

4.3  Mermaid: agent request loop

       ```mermaid
       sequenceDiagram
           participant Channel as Channel<br/>(Telegram/SMS/Web)
           participant OA as orchid-agent<br/>(Edge Function)
           participant DB as Supabase DB
           participant GM as Gemini Flash
           participant PX as Perplexity

           Channel->>OA: POST {profileId, message, media[]}
           OA->>DB: loadHierarchicalContext(profileId)
           DB-->>OA: {plants, reminders, insights, summaries, messages}
           OA->>GM: generateContent(systemPrompt + context + userMessage + media)
           GM-->>OA: response (text | toolCall)
           alt Tool call
               OA->>DB: execute tool (CRUD plants, reminders, etc.)
               OA->>PX: research_web tool (if needed)
               OA->>GM: sendToolResult(functionResponse)
               GM-->>OA: final text response
           end
           OA->>DB: save outbound conversation record
           OA-->>Channel: reply text (+ optional guide PDF)
       ```

4.4  Tool inventory (16 tools)

       | Tool Name                          | Required Capability   | Description                             |
       |------------------------------------|-----------------------|-----------------------------------------|
       | identify_plant                     | (always allowed)      | Vision-based species ID from photo      |
       | diagnose_plant                     | (always allowed)      | Health diagnosis from photo             |
       | capture_plant_snapshot             | manage_plants         | Save a before/after photo to DB         |
       | compare_plant_snapshots            | read_plants           | Diff two snapshots for health change    |
       | resolve_plants                     | read_plants           | Fuzzy plant lookup by name/location     |
       | save_plant                         | manage_plants         | Create or update plant record           |
       | modify_plant                       | manage_plants         | Update individual plant fields          |
       | delete_plant                       | delete_plants         | Remove plant from collection            |
       | create_reminder                    | create_reminders      | Schedule watering / fertilising         |
       | delete_reminder                    | create_reminders      | Remove a reminder                       |
       | log_care_event                     | manage_plants         | Record watering, pruning, etc.          |
       | save_user_insight                  | (always allowed)      | Store semantic user preference          |
       | update_notification_preferences   | create_reminders      | Change reminder frequency               |
       | update_profile                     | (confirmation guard)  | Update display_name, location, etc.     |
       | research_web                       | research_web          | Perplexity search for care advice       |
       | shopping_search                    | shopping_search       | Find local stores via Maps grounding    |

4.5  Capability permission system
       – `agent_permissions` table: 14 `agent_capability` enum values per user
       – Default: new users get a safe subset (read, identify, diagnose, log)
       – Agent calls checkAgentPermission() before any destructive/autonomous action
       – If denied: agent explains it needs permission, user grants via Settings

4.6  Media processing pipeline
       – Incoming Twilio media: fetched, resized, base64-encoded
       – Telegram photos: downloaded via Bot API getFile
       – deno_image (pure JS, no WASM): resize + JPEG conversion
       – VIDEO_MAX_SIZE_MB = 5 MB hard limit with warning

4.7  Guide generation (PDF)
       – `generate_content` tool creates Markdown care guides
       – jsPDF converts to PDF and uploads to `generated-guides` storage bucket
       – Signed URL returned in reply

4.8  Deep Think mode
       – _shared/deepThink.ts wraps Gemini with an extended reasoning pass
       – Used for complex multi-step queries (species research, pest ID)

4.9  System prompt template overview
       – Sections: identity → current date/time → user profile → plant roster
         → active reminders → recent insights → conversation history
```

---

## 5. Messaging Channel Integrations

### Summary

Orchid reaches users across three channels: SMS, WhatsApp (both via Twilio), and Telegram. This section documents the webhook architecture for each channel, how messages are normalised into the shared `conversations` table, and the Telegram-first onboarding flow using inline buttons. It also covers the Telegram Mini App architecture for profile configuration.

### Mini-Structure

```
5.1  Channel overview

       | Channel    | Protocol    | Edge Function      | Library      |
       |------------|-------------|-------------------|--------------|
       | SMS        | Twilio webhook | orchid-agent    | Twilio REST  |
       | WhatsApp   | Twilio webhook | orchid-agent    | Twilio REST  |
       | Telegram   | Bot API webhook | telegram-bot  | grammY 1.21  |

5.2  Twilio webhook flow (SMS and WhatsApp)
       – POST to /orchid-agent from Twilio on inbound message
       – Signature verification via X-Twilio-Signature header (HMAC-SHA1)
       – Media URLs extracted from MediaUrl0…MediaUrlN fields
       – Profile lookup by phone_number or whatsapp_number
       – Auto-provision new profile if not found (SMS onboarding path)
       – TwiML reply (text) sent back in HTTP response

5.3  Telegram Bot webhook flow
       – grammY handles update routing (text, photo, video, callback_query)
       – Inline button onboarding (4 steps: name → personality → experience → pets)
       – onboardingState Map tracks in-session onboarding progress
       – /start command creates synthetic auth.users record:
           tg_{chatId}@orchid.bot → enables web dashboard login later
       – After onboarding: all messages delegated to orchid-agent via internal fetch

5.4  Telegram onboarding state machine

       ```mermaid
       stateDiagram-v2
           [*] --> WaitName : /start received
           WaitName --> WaitPersonality : name confirmed / skipped
           WaitPersonality --> WaitExperience : personality selected
           WaitExperience --> WaitPets : experience selected
           WaitPets --> Done : pets confirmed
           Done --> [*] : profile saved, first message sent
       ```

5.5  Telegram Mini App (profile configuration)
       – Triggered by /config or "Configure Profile" inline button
       – WebView URL served from React PWA (separate /app route)
       – Auth: initData (HMAC-SHA256 signed by Telegram with bot token)
       – Edge function validates initData → maps telegram_chat_id → Supabase user
       – Custom JWT signed with SUPABASE_JWT_SECRET returned to Mini App
       – Mini App uses JWT for RLS-enforced Supabase calls

5.6  QR code / pixel-morph desktop onboarding
       – OrchidPage (landing) detects desktop viewport
       – Orchid pixel grid animates into QR code encoding Telegram deep link
       – QR rendered in qr-morph-canvas.tsx using qrcode-generator library
       – Mobile: click opens t.me/orchidcare_bot?start=web directly

5.7  Conversation data model
       – All messages (inbound + outbound) saved to conversations table
       – channel: 'sms' | 'whatsapp' | 'telegram'
       – direction: 'inbound' | 'outbound'
       – summarized flag triggers hierarchical compression batch
```

---

## 6. Real-Time Voice Call System

### Summary

The voice system allows users to speak with Viridis using their device microphone, receiving synthesised audio responses in real time. This section documents the `call-session` edge function (ephemeral token issuance, session lifecycle management), the `useGeminiLive` React hook (WebSocket session, audio capture/playback pipeline, tool call bridge), the Pixel Canvas visual display that renders AI-driven formations during calls, and the post-call summarisation function.

### Mini-Structure

```
6.1  Feature overview
       – Real-time bidirectional audio: user speaks → Gemini synthesises audio reply
       – Visual: Pixel Canvas (PixiJS) renders animated plant formations driven by AI
       – Tool calls during voice: agent can look up plants, log care, etc., mid-conversation
       – Post-call: transcript and summary saved to call_sessions table

6.2  Model used for voice
       – Model: models/gemini-2.5-flash-native-audio-preview-12-2025
       – Accessed via @google/genai SDK LiveSession (WebSocket)
       – Bidirectional audio modality (PCM 16-bit, 24kHz)
       – Tool use enabled (same tool set as text agent)

6.3  call-session edge function (4 endpoints)
       – POST /create  → validates auth, creates call_sessions record, returns sessionId
       – POST /token   → validates sessionId, calls Gemini ephemeral token API, returns token
       – POST /tools   → receives tool calls from client, executes via shared tools.ts
       – POST /end     → saves duration, triggers summarise-call function

6.4  Auth for voice calls
       – Supports both Supabase JWT (web) and Telegram initData (Mini App)
       – validateAuthAndGetProfile() tries JWT first, then initData

6.5  Client-side audio pipeline (useGeminiLive hook)

       ```
       Microphone (getUserMedia)
            │
            ▼
       AudioWorklet (capture)         PCM chunks
            │─────────────────────────────────►  Gemini Live WebSocket
            │
       AudioContext (playback)    ◄──────────  Audio chunks from Gemini
       ```

       Sub-hooks:
       – useAudioCapture:  ScriptProcessor / AudioWorklet, 16-bit PCM → base64
       – useAudioPlayback: AudioContext, queued chunk decode + smooth playback
       – useVideoCapture:  canvas snapshot → base64 JPEG at configurable fps
       – useCallRecorder:  MediaRecorder API recording of the full call audio

6.6  Tool call bridge
       – Gemini fires toolCall events mid-stream
       – show_visual: handled client-side (no network round-trip) → Formation queue
       – All other tools: forwarded to call-session/tools endpoint via fetch
       – Response sent back to Gemini session via sendToolResponse()

6.7  Pixel Canvas visual system (PixiJS)
       – Renders on a full-screen canvas (PixelCanvas.tsx)
       – Formation types: 'template' (named plant formations), 'text', 'list', 'clear'
       – Transition types: 'fade', 'dissolve', 'cascade', 'scatter'
       – LLM can trigger show_visual tool to display information visually mid-call
       – Formation queue ensures sequential display without race conditions

6.8  Post-call summarisation
       – summarise-call edge function invoked by /end endpoint
       – Generates structured summary using Gemini Flash
       – Summary and transcript saved to call_sessions table
       – Agent operations logged in agent_operations table

6.9  Connection state machine

       ```mermaid
       stateDiagram-v2
           idle --> connecting : connect() called
           connecting --> active : session established
           active --> reconnecting : connection dropped (auto-retry ×3)
           reconnecting --> active : token refreshed, reconnected
           reconnecting --> error : max retries exceeded
           active --> ended : disconnect() called
           ended --> idle : reset
       ```
```

---

## 7. Data Layer & Database Models

### Summary

Orchid's entire persistence layer lives in PostgreSQL via Supabase. This section documents all 16 tables, 3 custom enums, storage buckets, database functions, triggers, and the Row Level Security (RLS) policy pattern. It covers the entity-relationship structure, the hierarchical memory model, and the agent permissions / proactive preferences subsystem. All models are traced to the features they support.

### Mini-Structure

```
7.1  Database overview
       – PostgreSQL 15 on Supabase (Lovable Cloud region)
       – 16 tables, 3 enums, 29 indexes, 8 functions, 2 storage buckets
       – All tables have RLS enabled; service_role bypasses RLS for edge functions
       – Two storage buckets: plant-photos (user uploads), generated-guides (AI PDFs)

7.2  Custom enums

       agent_capability (14 values)
       ├── read_plants, manage_plants, delete_plants
       ├── read_reminders, manage_reminders, create_reminders, send_reminders
       ├── read_conversations
       ├── shopping_search, research_web, generate_content
       ├── delete_notes, delete_insights
       └── send_insights

       app_role: user | premium | admin
       doctor_personality: warm | expert | philosophical | playful

7.3  Core user models

       profiles — Central user record
       ├── id, user_id (FK → auth.users)
       ├── phone_number, whatsapp_number, telegram_chat_id, telegram_username
       ├── personality (doctor_personality), experience_level
       ├── location, timezone, notification_frequency
       ├── display_name, primary_concerns[], pets[]
       └── created_at, updated_at

       user_roles — RBAC overlay (user/premium/admin)

7.4  Plant collection models

       plants
       ├── id, profile_id (FK → profiles)
       ├── name, species, nickname, location_in_home
       ├── photo_url (storage path or https URL)
       ├── acquired_date, notes
       └── created_at, updated_at

       plant_identifications — Vision AI result cache
       ├── plant_id (FK → plants)
       ├── identified_species, confidence, raw_response
       └── photo_url, created_at

       plant_snapshots — Before/after photo comparisons
       ├── plant_id, profile_id
       ├── snapshot_type: 'before' | 'after' | 'current'
       ├── photo_url, notes, health_score
       └── created_at

       care_events — Audit log of care actions
       ├── plant_id (FK → plants)
       ├── event_type: watered | fertilized | repotted | pruned | treated | photo
       ├── notes, photo_url
       └── created_at

       reminders — Scheduled care tasks
       ├── plant_id (FK → plants), profile_id
       ├── reminder_type, frequency_days, next_due
       ├── is_active, custom_message
       └── created_at, updated_at

7.5  Conversation and memory models

       conversations — Full message log
       ├── profile_id, channel: sms|whatsapp|telegram
       ├── direction: inbound|outbound
       ├── content, media_urls[], message_sid (Twilio SID)
       ├── summarized (bool) — true after processed into summary
       └── created_at

       conversation_summaries — Hierarchical compression layer
       ├── profile_id, summary_text
       ├── message_count, covered_from, covered_to
       └── created_at

       user_insights — Extracted semantic facts about the user
       ├── profile_id, insight_key, insight_value
       ├── confidence (0.0–1.0)
       └── created_at

7.6  Voice call models

       call_sessions — Voice call lifecycle record
       ├── profile_id, status: pending|active|ended|failed
       ├── mode: audio|video, voice
       ├── started_at, ended_at, duration_seconds
       ├── tool_calls_count, summary
       └── created_at

       conversation_ratings — Post-conversation quality signal
       ├── profile_id, conversation_id (nullable), call_session_id (nullable)
       ├── rating (1–5), feedback_text
       └── created_at

7.7  Agent autonomy models

       agent_permissions — Per-user capability grants
       ├── profile_id, capability (agent_capability enum)
       ├── granted (bool)
       └── created_at, updated_at

       agent_operations — Audit trail of all autonomous actions
       ├── profile_id, operation_type, operation_data (jsonb)
       ├── status, result (jsonb)
       └── created_at

       proactive_preferences — When / how agent can reach out
       ├── profile_id, channel
       ├── quiet_hours_start, quiet_hours_end
       ├── care_reminders_enabled, observations_enabled
       ├── seasonal_tips_enabled, health_followups_enabled
       └── created_at, updated_at

       proactive_messages — Dedup log for proactive sends
       ├── profile_id, channel, message_type, message_preview
       └── sent_at

7.8  Developer API model

       api_keys — Third-party developer access
       ├── profile_id, key_hash (sha256), key_prefix
       ├── name, description, is_active
       ├── last_used_at, request_count
       └── created_at

7.9  Linking codes (Telegram ↔ Web bridge)

       linking_codes — Short-lived OTP for account linking
       ├── user_id (FK → auth.users), code (6-digit)
       ├── expires_at, used_at
       └── created_at

7.10 Mermaid ER diagram (simplified)

       ```mermaid
       erDiagram
           profiles ||--o{ plants : "has"
           profiles ||--o{ conversations : "has"
           profiles ||--o{ conversation_summaries : "has"
           profiles ||--o{ user_insights : "has"
           profiles ||--o{ reminders : "has"
           profiles ||--o{ call_sessions : "has"
           profiles ||--o{ agent_permissions : "has"
           profiles ||--o{ proactive_preferences : "has"
           profiles ||--o{ proactive_messages : "has"
           profiles ||--o{ agent_operations : "has"
           profiles ||--o{ api_keys : "has"
           plants ||--o{ care_events : "logs"
           plants ||--o{ reminders : "schedules"
           plants ||--o{ plant_identifications : "has"
           plants ||--o{ plant_snapshots : "has"
       ```

7.11 RLS policy patterns
       – Authenticated users: USING (auth.uid() = user_id) or via profile_id join
       – Service role: USING (true) on all tables — used by all edge functions
       – anon: DENY on sensitive tables (profiles, conversations)
       – Storage: authenticated + service_role SELECT/INSERT on respective buckets

7.12 Key database functions
       – handle_new_user() — trigger on auth.users INSERT: creates profiles row
       – update_updated_at_column() — trigger for updated_at maintenance
       – Custom search functions for plant lookup (ILIKE + full-text)

7.13 Photo URL resolution pattern
       – photo_url stores either a storage path (relative) or a full https:// URL
       – resolvePhotoUrl() in usePlants.ts: createSignedUrl() for storage paths (1h TTL)
       – This pattern avoids exposing permanent public URLs
```

---

## 8. Web Application (Frontend)

### Summary

The frontend is a React 18 / Vite / TypeScript single-page application with a Tailwind CSS design system and shadcn/ui components. This section covers the routing structure, the core feature pages (landing, onboarding, PWA chat, dashboard, settings, live call, demo), the design system (botanical brutalism aesthetic), the PWA configuration, and the state management approach (TanStack Query + AuthContext).

### Mini-Structure

```
8.1  Tech stack
       – React 18, Vite, TypeScript (strict), React Router v6
       – Tailwind CSS (JIT), shadcn/ui (Radix primitives), Framer Motion
       – TanStack Query v5 (server state), React Context (auth)
       – PixiJS 8 (Pixel Canvas), Lenis (smooth scroll)
       – @google/genai (Gemini Live client-side SDK)

8.2  Application routing map

       Route                    Component            Auth
       /                        OrchidPage           public
       /login                   LoginPage            public
       /onboarding              Onboarding           protected
       /chat                    ChatPage             protected
       /dashboard/*             Dashboard            protected
         /dashboard/collection  CollectionView       protected
         /dashboard/activity    ActivityView         protected
         /dashboard/profile     ProfileView          protected
       /settings                Settings             protected
       /plants                  Plants               protected
       /call                    LiveCallPage         public*
       /demo                    DemoPage             public
       /app                     AppPage              public (Telegram Mini App)
       /developer               DeveloperPlatform    protected
       /privacy                 Privacy              public

       * Call auth handled inside the component via call-session/create

8.3  Landing page (OrchidPage / Index)
       – Loading screen: Progress bar → expand animation → hero reveal
       – Pixel orchid art (SVG/canvas) → QR code morph on desktop
       – FeatureBento: 6 feature cards (identify, diagnose, reminders, memory,
         voice, shopping)
       – Nav: demo link, login link

8.4  PWA Chat (ChatPage + PwaChat)
       – Full-screen chat UI rendered with react-markdown
       – Invokes orchid-agent edge function via supabase.functions.invoke()
       – Camera input: file chooser or device camera for plant photos
       – Renders AI-generated guides as PDF download buttons
       – BottomNav for mobile navigation between chat / dashboard / settings
       – PwaOnboarding: inline onboarding if profile not yet created

8.5  Dashboard (multi-view)
       – DashboardShell: tab navigation + mobile responsive shell
       – CollectionView: PlantCard grid, add/edit plant modal
         – usePlants() hook: fetches plants + next reminder, resolves signed photo URLs
       – PlantDetail: full plant page with care event timeline, photo gallery,
         reminders list, plant identification history
       – ActivityView: chronological activity feed (care events + conversations)
         – useAllCareEvents(), useConversations(), useAgentOperations()
       – ProfileView: profile info, user insights list, agent permission toggles
         – useUserInsights() + useDeleteInsight()
         – useAgentPermissions() + permission mutation hooks

8.6  Settings page
       – Four collapsible sections: Notifications, Proactive Agent, Agent Permissions,
         Danger Zone
       – useProactivePreferences() + mutation hooks
       – useAgentPermissions() for granular capability toggles
       – Delete account flow: calls delete-account edge function

8.7  Live Call page (LiveCallPage)
       – Full-screen PixelCanvas (PixiJS) as visual backdrop
       – useGeminiLive() hook manages WebSocket, audio, tools
       – Connect / mute / disconnect controls
       – Debug log overlay (development mode)
       – Transcript display post-call

8.8  Demo page (DemoPage)
       – HMAC-signed demo token (no auth required, rate-limited)
       – Calls demo-agent edge function (subset of orchid-agent capabilities)
       – Generative UI: AI can emit "artifacts" (plant cards, care guides, image gen)
       – Same PixelCanvas visual as live call

8.9  Design system — Botanical Brutalism
       – Typography: Instrument Serif (display), Inter (body), Press Start 2P (UI chrome)
       – Palette: forest green (#2d5016), botanical cream (#faf8f4), warm black (#0a0a0a)
       – Hard box shadows (4–8 px offset, black), 2 px solid black borders
       – Etched botanical illustrations (SVG patterns) as background textures
       – BrutalistTooltip: custom tooltip with monospace uppercase labels

8.10 State management
       – TanStack Query: staleTime = 45 min for plants (avoid re-fetches during session)
       – AuthContext: profile, user, loading — wraps the full tree
       – Query invalidation on mutations (create/update/delete plant, etc.)
       – No global state library (Redux/Zustand) — intentionally kept simple

8.11 PWA configuration
       – vite-plugin-pwa (Workbox): offline shell caching
       – Web App Manifest: standalone display, theme-color = black
       – iOS meta tags: apple-mobile-web-app-capable, status-bar-style
       – Service worker handles asset caching and background sync
```

---

## 9. Authentication & Security

### Summary

Orchid has four distinct authentication paths, each appropriate for its channel. This section documents every path, how they converge on Supabase RLS, the synthetic user model for Telegram-only users, and the known security architecture decisions (and where the prototype cuts corners). It is written at a level where a security engineer can evaluate the threat model.

### Mini-Structure

```
9.1  Authentication paths summary

       | Path               | Mechanism                          | RLS enforcement          |
       |--------------------|------------------------------------|--------------------------|
       | Web / PWA          | Supabase JWT (email/password, OAuth)| Database RLS             |
       | Telegram Bot       | service_role key (bypasses RLS)    | App-code WHERE clauses   |
       | Telegram Mini App  | initData HMAC + custom JWT exchange| Database RLS             |
       | Voice Call (Web)   | Bearer JWT forwarded to edge fn    | Database RLS             |
       | Voice Call (Mini)  | initData HMAC in POST body         | Database RLS             |

9.2  Web authentication flow
       – Supabase Auth: email/password + Google OAuth
       – Session stored in localStorage by @supabase/supabase-js
       – AuthContext: useAuth() exposes { user, profile, loading, signIn, signOut }
       – ProtectedRoute HOC: redirects to /login if !user

9.3  Telegram Bot authentication
       – Edge function uses SUPABASE_SERVICE_ROLE_KEY (bypasses all RLS)
       – Data isolation: application-code WHERE profile_id = resolvedProfileId
       – Synthetic user creation on /start: INSERT INTO auth.users + profiles
           email = tg_{chatId}@orchid.bot, password = random UUID
           telegram_chat_id stored in profiles for lookup

9.4  Telegram Mini App auth (initData exchange)
       – Client sends Telegram-signed initData to validateInitData() in _shared/auth.ts
       – Server validates HMAC-SHA256: data-check-string signed with
           HMAC_SHA256(key=HMAC_SHA256("WebAppData", botToken), data=checkString)
       – On success: look up profile by telegram_chat_id, sign custom JWT
       – JWT signed with SUPABASE_JWT_SECRET (HS256)
       – Returned to Mini App for use with Supabase client

9.5  Demo authentication
       – demo-agent uses HMAC-signed demo tokens (DEMO_HMAC_SECRET)
       – Token encodes: sessionId, expiresAt, requestCount
       – Rate limited: max N messages per token, max N tokens per IP per hour
       – No real user data accessible from demo path

9.6  Developer API keys
       – api_keys table stores SHA-256 hash (never plaintext key)
       – key_prefix stored for display (first 8 chars)
       – Validated by DeveloperPlatform edge function
       – pwa-agent function: third-party integration path

9.7  RLS policy design
       – Standard pattern: USING (auth.uid() = user_id) for direct user tables
       – Join pattern for owned resources:
           USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
       – service_role: USING (true) + WITH CHECK (true) on all tables
       – anon: DENY on all sensitive tables

9.8  Known security limitations (prototype-level)
       – proactive_preferences: missing TO service_role scoping (any auth user can read all)
       – linking_codes: USING (true) — any authenticated user can read all codes
       – No rate limiting on Twilio webhook (SMS flooding risk)
       – No rate limiting on linking code attempts (brute-force risk)
       – Bot token not validated on every Telegram webhook (no X-Telegram-Bot-Api-Secret-Token check)

9.9  Secrets inventory
       GEMINI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
       TELEGRAM_BOT_TOKEN, PERPLEXITY_API_KEY, DEV_AUTH_SECRET, DEMO_HMAC_SECRET
       + 5 auto-configured SUPABASE_* secrets
```

---

## 10. Memory & Context Engineering

### Summary

A key technical differentiator of Orchid is its hierarchical memory system, which allows the agent to maintain continuity across many conversations without blowing the context window. This section documents the full context assembly pipeline: how recent messages, compressed summaries, extracted user insights, plant roster, and active reminders are assembled into the system prompt before each call to Gemini. It also covers how new summaries are generated and how insights are extracted.

### Mini-Structure

```
10.1 The problem: LLM context window vs. long-term relationships
       – Gemini Flash context window ≈ 1M tokens, but sending raw history is expensive
       – Solution: hierarchical compression — recent N messages + rolling summary + insights

10.2 HierarchicalContext type (from _shared/types.ts)

       interface HierarchicalContext {
         recentMessages:         conversations[]        // last 20 messages
         summaries:              conversation_summaries[] // all summaries
         userInsights:           user_insights[]        // extracted facts
         recentIdentifications:  plant_identifications[] // last 5 IDs
         activeReminders:        reminders[]            // all active
       }

10.3 loadHierarchicalContext() — assembly pipeline

       ```
       Step 1: Fetch last 20 conversations from conversations table
               ORDER BY created_at DESC LIMIT 20

       Step 2: Fetch all conversation_summaries for profileId
               (covers all conversations before the recent window)

       Step 3: Fetch all user_insights (insight_key → insight_value pairs)

       Step 4: Fetch last 5 plant_identifications (for quick vision context)

       Step 5: Fetch all active reminders (is_active = true, next_due ≥ now)

       Step 6: Assemble into HierarchicalContext object
       ```

10.4 buildEnrichedSystemPrompt() — prompt assembly

       Sections injected into every system prompt:
       1.  Identity block (Viridis persona + personality)
       2.  Current date/time + user timezone
       3.  User profile (name, experience_level, location, pets, concerns)
       4.  Plant roster (name, species, nickname, location, last care event)
       5.  Active reminders (plant, type, next due in human-readable format)
       6.  User insights (insight_key: insight_value pairs)
       7.  Conversation summaries (compressed history)
       8.  Recent messages (verbatim last 20)
       9.  Recent plant identifications (species + confidence)
       10. Tool capability list (what the agent is allowed to do today)

10.5 buildVoiceSystemPrompt() — voice variant
       – Same pipeline but pruned for latency:
         – Shorter identity block
         – Reminders capped at 3
         – Recent messages capped at 10

10.6 Conversation compression (summarise flow)
       – After N new messages: summarise-call edge function (or on-demand)
       – Calls Gemini Flash: "Summarise these N conversations for a plant care AI agent"
       – Saves result to conversation_summaries
       – Sets summarized = true on included conversation rows
       – Old summaries are NOT deleted — cumulative history preserved

10.7 User insight extraction
       – saveUserInsight() tool: agent proactively calls this when it learns something new
         e.g. "user_location: Seattle, WA", "watering_habit: tends to underwater"
       – Stored with confidence score (0.0–1.0)
       – Injected into every subsequent system prompt
       – User can view and delete insights from ProfileView

10.8 Time formatting utilities
       – formatTimeUntil(): "due tomorrow", "in 3 days", "overdue by 1 day"
       – formatTimeSince(): "2 hours ago", "yesterday", "3 weeks ago"
       – formatTimeAgo(): compact "2h ago", "3d ago"
       – All used to make reminders/history human-readable in the prompt
```

---

## 11. Results & Evaluation

### Summary

This section defines success criteria, presents a benchmarking rubric, and documents test cases covering the primary user journeys — plant identification, care advice, proactive reminders, and voice interaction. It includes both quantitative metrics (response time, accuracy on known species) and qualitative evaluation (care advice quality, conversation naturalness). Edge cases and observed failures are discussed honestly.

### Mini-Structure

```
11.1 Success criteria (defined up front)

       | Dimension              | Target                          | Measurement method         |
       |------------------------|---------------------------------|----------------------------|
       | Plant identification   | ≥85 % species accuracy          | Manual test set (20 plants)|
       | Care advice relevance  | ≥4/5 user rating                | LLM-as-judge rubric        |
       | Response latency (text)| ≤3 s p95                        | Function logs              |
       | Response latency (voice)| ≤1.5 s first audio chunk       | Client timing              |
       | Reminder delivery rate | ≥99 % (Telegram)                | proactive_messages log     |
       | Onboarding completion  | ≥70 % (Telegram)                | profiles created / /start  |

11.2 Benchmarking rubric (LLM-as-judge)

       Dimension        | 1 (Poor)               | 3 (Adequate)             | 5 (Excellent)
       -----------------+------------------------+--------------------------+---------------------------
       Species accuracy | Wrong family           | Correct genus, wrong sp. | Correct species + cultivar
       Care advice      | Generic / wrong species| Correct but vague        | Specific, actionable, cited
       Personality fit  | Robotic / off-tone     | Mostly on-tone           | Indistinguishable from human
       Memory recall    | Ignores prior context  | References some context  | Seamlessly incorporates all

11.3 Test cases

       TC-1: Plant identification (Monstera deliciosa, known species)
         Input:  Photo of a Monstera with visible fenestrations
         Expected: Correct species, watering/light care, pet toxicity warning
         Observed: [documented in full report]

       TC-2: Disease diagnosis (yellowing leaves, overwatering)
         Input:  Photo + "my plant's leaves are turning yellow"
         Expected: Diagnosis of overwatering, soil-check recommendation
         Observed: [documented in full report]

       TC-3: Proactive reminder (watering due in 1 day)
         Input:  Scheduled cron trigger on proactive-agent
         Expected: Telegram message referencing specific plant, timing
         Observed: [documented in full report]

       TC-4: Edge case — ambiguous species photo (low light, partial view)
         Input:  Blurry photo of an unrecognised cultivar
         Expected: Agent expresses uncertainty, asks for clearer photo
         Observed: [documented in full report]

       TC-5: Voice — multi-turn plant care conversation
         Input:  "How often should I water my peace lily?"
                 (follow-up) "It's in a north-facing window"
         Expected: Agent uses second message to refine advice, references user location
         Observed: [documented in full report]

11.4 Failure analysis
       – Over-confident species identification on ambiguous images
       – Tool call latency adds 200–800 ms per tool (visible in voice mode)
       – Hierarchical context occasionally drops very old insights when summaries chain
       – proactive-agent: timezone edge cases around midnight DST transitions

11.5 Reproducibility
       – All test inputs and model outputs to be archived in /docs/benchmarks/
       – Benchmark re-run instructions: provide same image + transcript to demo page
```

---

## 12. Limitations & Future Work

### Summary

A candid account of where the prototype cuts corners and what would need to change for a production-quality system. This section is explicitly useful for an engineering team doing the handoff, as it tells them which parts of the codebase are fragile, under-tested, or architecturally simplistic.

### Mini-Structure

```
12.1 Current limitations

       Scalability
       ├── orchid-agent is a monolithic edge function (~1200 lines); as tools grow
       │   it will hit the 150 MB memory cap of Supabase Edge Runtime
       ├── proactive-agent uses a single cron job; at scale needs fan-out workers
       └── No message queue: high SMS volume will create webhook timeouts

       Reliability
       ├── onboardingState in telegram-bot is in-memory (lost on cold start)
       ├── Audio playback queue in useGeminiLive can drift if chunks arrive late
       └── Reconnect logic caps at 3 attempts; persistent network issues require
           manual refresh

       Data quality
       ├── user_insights are not deduplicated — agent may store conflicting entries
       │   (e.g., location updated twice with different values)
       ├── Conversation summaries accumulate unbounded; no pruning strategy
       └── plant_identifications stores raw Gemini response as text (no schema)

       Security (prototype compromises)
       ├── proactive_preferences and proactive_messages lack TO service_role scoping
       ├── linking_codes USING (true) — any auth user can read all linking codes
       ├── No Telegram webhook secret verification
       └── No rate limiting on SMS webhook or linking codes

       UX / product
       ├── No push notifications to PWA (only Telegram / SMS)
       ├── No plant sharing between users
       └── Dashboard is read-only for most data (edits still go through chat)

12.2 Production engineering priorities (in order)

       P0  Fix the three RLS policy bugs (security)
       P0  Add Telegram webhook secret verification
       P1  Deduplicate user_insights with UPSERT on (profile_id, insight_key)
       P1  Add rate limiting on all public webhook endpoints
       P2  Split orchid-agent into tool modules (import map pattern)
       P2  Migrate onboarding state to a temporary database table
       P3  Add push notification service (Web Push API)
       P3  Implement conversation summary pruning (keep last N summaries)

12.3 Feature roadmap (what's been intentionally deferred)
       – Multi-user household (shared plant collection)
       – iOS/Android native apps (React Native port)
       – Plant marketplace integrations (Etsy, local nursery APIs)
       – AR plant health overlay (camera + bounding box)
       – Symptom progression tracking with time-series charts
```

---

## 13. Ethical Considerations & References

### Summary

This final section addresses the ethical dimensions of deploying an AI plant care assistant, including data privacy, potential bias in plant identification (geography/species distribution in training data), the risk of over-reliance on AI advice for expensive or rare plants, and responsible disclosure of the prototype's known inaccuracies. It closes with full references and project links.

### Mini-Structure

```
13.1 Privacy and data handling
       – Personal data collected: phone number, location (city/ZIP), pet types,
         plant names, photos of plants, full conversation history
       – All data stored in Supabase (EU/US region selectable on Lovable Cloud)
       – No third-party analytics or advertising SDK
       – Users can delete their account and all associated data (delete-account
         edge function: cascades DELETE to all tables via FK ON DELETE CASCADE)
       – Photos stored in Supabase Storage; signed URL pattern limits public exposure
       – AI conversation data is sent to Google (Gemini) and Perplexity — disclosed
         in privacy policy (/privacy route)

13.2 AI advice risk
       – Plant care advice can cause real harm (e.g., wrong fertiliser dose, toxicity
         misinformation for pets)
       – Current mitigation: agent always includes uncertainty language; pet toxicity
         warnings are surface-level (not veterinary advice)
       – Production recommendation: partner with a licensed horticulturalist to
         verify advice templates; add "consult a professional" CTA for medical/vet topics

13.3 Bias in plant identification
       – Gemini's vision model is trained on internet-distributed plant images
       – Bias risk: common houseplants (Pothos, Monstera) identified with higher
         accuracy than rare cultivars or plants common to non-Western regions
       – No mitigation implemented in prototype; accuracy disclosure needed at launch

13.4 Autonomous agent risk
       – Agent can delete plants, delete notes, delete insights if permissions granted
       – Mitigation: capability permission model (default OFF for destructive actions)
       – Confirmation guard on profile updates (user_confirmed: true required)
       – Production recommendation: add an undo queue (soft deletes with 24h restore)

13.5 Misuse vectors
       – Telegram bot could be abused to store non-plant data in the conversations table
       – Mitigation: content is not human-reviewed; only user can see their own data (RLS)
       – Demo page rate limiting prevents LLM resource abuse

13.6 References
       – Google Gemini API documentation: https://ai.google.dev/docs
       – Supabase documentation: https://supabase.com/docs
       – Twilio Messaging API: https://www.twilio.com/docs/messaging
       – Telegram Bot API: https://core.telegram.org/bots/api
       – grammY framework: https://grammy.dev
       – Perplexity API: https://docs.perplexity.ai
       – React 18 + Vite: https://vitejs.dev
       – shadcn/ui: https://ui.shadcn.com
       – PixiJS: https://pixijs.com
       – TanStack Query: https://tanstack.com/query

13.7 Project links
       – Live application: https://orchidml.lovable.app
       – GitHub repository: [insert link]
       – Demo walkthrough video: [insert link]

13.8 AI disclosure
       – This documentation outline was created with the assistance of GitHub Copilot,
         which was used to structure and articulate technical details after thorough
         manual code review. All technical facts were verified against the live source
         code before inclusion.
```

---

*End of outline. This document covers 13 sections reviewing Orchid by feature (§4–§6, §8, §10), by technical implementation layer (§3, §7, §9), and dedicates a full section to each model used (§4.2 — Gemini Flash text/vision, §6.2 — Gemini Live native audio, §10 — context engineering that shapes how each model is prompted).*

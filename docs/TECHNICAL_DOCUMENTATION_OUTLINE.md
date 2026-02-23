# Orchid — Technical Documentation Outline

> **Purpose:** This is a proposed outline for the comprehensive technical report on Orchid.
> Each of the 13 sections below includes (1) a summary of what it will cover and (2) a
> mini-structure listing its subsections. All facts are drawn from direct inspection of the
> source code and database schema.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Problem & Motivation](#2-business-problem--motivation)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [AI Agent: Orchid](#4-ai-agent-orchid)
5. [Telegram Channel Integration](#5-telegram-channel-integration)
6. [Real-Time Voice Call System](#6-real-time-voice-call-system)
7. [Progressive Web App (PWA)](#7-progressive-web-app-pwa)
8. [Data Layer & Database Models](#8-data-layer--database-models)
9. [Authentication & Security](#9-authentication--security)
10. [Memory & Context Engineering](#10-memory--context-engineering)
11. [Developer Platform & REST API](#11-developer-platform--rest-api)
12. [Results & Evaluation](#12-results--evaluation)
13. [Limitations, Future Work & Ethics](#13-limitations-future-work--ethics)

---

## 1. Executive Summary

### Summary

A concise, standalone overview of the entire project written last. It describes the problem, the
solution Orchid provides, the key technology choices, headline results, and where the prototype
cuts corners. A reader should be able to understand the full project from this section alone.

### Mini-Structure

```
1.1  What Orchid is — one-sentence description
       AI-powered plant care assistant accessible through Telegram and a PWA,
       with real-time voice capability via Gemini Live API.

1.2  The problem it solves and who benefits
       Plant owners lose plants to preventable care mistakes; existing tools are passive
       and require context-switching. Orchid meets users where they already are.

1.3  Solution approach at a glance
       - Text chat via Telegram and PWA (/app route)
       - Real-time voice call via Gemini Live native audio
       - Proactive reminders triggered by a scheduled proactive-agent
       - AI back-end: Gemini 3 Flash (text/vision) + Gemini Live (voice)
         + Perplexity Sonar (research) + Gemini 3 Pro Image (image generation)

1.4  Technology stack summary
       | Layer            | Technology                                          |
       |------------------|-----------------------------------------------------|
       | Frontend (PWA)   | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
       | Backend (BaaS)   | Supabase (PostgreSQL, Auth, Storage, Edge Functions)|
       | AI inference     | Gemini 3 Flash via Lovable AI Gateway               |
       | AI voice         | Gemini 2.5 Flash Native Audio (Gemini Live API)     |
       | Research         | Perplexity Sonar API                                |
       | Messaging        | Telegram Bot API (grammY)                           |
       | Runtime          | Deno (Supabase Edge Functions)                      |

1.5  Key results and evaluation metrics (forward reference to §12)

1.6  Primary known limitations (forward reference to §13)

1.7  Demo video link
```

---

## 2. Business Problem & Motivation

### Summary

Establishes the real-world pain point driving Orchid. Describes why plant care fails for most
people (information anxiety, wrong timing, lack of personalisation), what the current status quo
looks like, and why a conversational AI agent accessible over Telegram is a promising approach.
Also identifies primary users and compares Orchid's positioning to existing alternatives.

### Mini-Structure

```
2.1  Problem statement
       - Most houseplant owners rely on ad-hoc Google searches or static care apps
       - Generic schedules ignore individual plants, environments, and habits
       - High friction in dedicated apps leads to abandonment
       - Information exists but is hard to access in the moment of need

2.2  The opportunity
       - Conversational AI reduces effort to a single message
       - Telegram has ~900 M monthly users; zero install friction for existing users
       - A PWA fills the gap for users who prefer a traditional app interface
       - Multimodal AI (photo identification, voice, image generation) enables
         experiences that static apps cannot replicate

2.3  Target users and personas
       - Primary: beginner and intermediate houseplant owners
       - Secondary: serious collectors who need systematic, contextual reminders

2.4  Competitive landscape
       - Greg, Planta, Vera: app-based, manual logging, no conversational layer
       - ChatGPT / Claude directly: no plant memory, no proactive behaviour,
         no voice call mode with visual formations
       - Orchid's differentiation: persistent memory + proactive reach-out +
         real-time voice + image generation + developer API

2.5  Why AI now
       - Gemini 3 Flash: multimodal (text + vision + tool calling) in one model call
       - Gemini 2.5 Flash Native Audio: sub-second real-time bidirectional audio
       - Perplexity Sonar: live web search for post-training-cutoff plant care info
       - Supabase Edge Functions: zero-cold-start serverless Deno runtime
       - Lovable Cloud: database + auth + storage + deployment in one hosted platform
```

---

## 3. System Architecture Overview

### Summary

High-level view of how all components fit together. Covers the two user-facing surfaces
(Telegram and PWA/web), the ten Supabase edge functions that form the back-end logic tier,
the PostgreSQL database, Supabase Storage, and the three external AI/API services. Includes
both an ASCII block diagram and a Mermaid data-flow diagram.

### Mini-Structure

```
3.1  Component inventory

       | Component          | Technology / Service                              |
       |--------------------|---------------------------------------------------|
       | PWA / web frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui   |
       | Telegram bot       | grammY 1.21, Telegram Bot API                     |
       | Edge functions     | Deno, Supabase Edge Runtime                       |
       | Database           | PostgreSQL 15 (Supabase)                          |
       | Auth               | Supabase Auth (email/password, Google OAuth)      |
       | Storage            | Supabase Storage (plant-photos, generated-guides) |
       | Text/vision AI     | Gemini 3 Flash via Lovable AI Gateway             |
       | Voice AI           | Gemini 2.5 Flash Native Audio (Gemini Live)       |
       | Research           | Perplexity Sonar API                              |
       | Geocoding          | OpenStreetMap Nominatim                           |

3.2  ASCII block diagram

       ┌──────────────────────────────────┐
       │         User Devices             │
       └──────┬───────────┬──────────────┘
              │           │
       ┌──────▼───┐  ┌────▼──────────────────────────────────────────┐
       │ Telegram │  │                React PWA (/app)                │
       │ Bot API  │  │  Auth → Onboarding → Chat (/chat, /dashboard)  │
       └──────┬───┘  │  Live Call (/call)   Demo (/demo)              │
              │      └────┬──────────────────────────────────────────┘
              │           │  Supabase JS Client (REST + Realtime)
              │           │  supabase.functions.invoke()
              │      ┌────▼──────────────────────────────────────────┐
              │      │         Supabase Platform                      │
              │      │  ┌─────────────┐  ┌──────────────────────┐   │
              │      │  │ PostgreSQL   │  │   Supabase Auth       │   │
              │      │  │  (RLS)       │  │  (JWT / OAuth)        │   │
              │      │  └─────────────┘  └──────────────────────┘   │
              │      │  ┌─────────────────────────────────────────┐  │
              └──────┼─►│  Edge Functions (Deno)                  │  │
                     │  │  telegram-bot   orchid-agent             │  │
                     │  │  pwa-agent      demo-agent               │  │
                     │  │  call-session   proactive-agent          │  │
                     │  │  summarise-call delete-account           │  │
                     │  │  dev-call-proxy api (REST API)           │  │
                     │  └──────────────┬──────────────────────────┘  │
                     │                 │                              │
                     │  ┌──────────────▼──────────────────────────┐  │
                     │  │  Storage Buckets                         │  │
                     │  │  plant-photos   generated-guides         │  │
                     │  └─────────────────────────────────────────┘  │
                     └───────────────────────────────────────────────┘
                                        │
                         ┌──────────────▼──────────────────────────┐
                         │  External AI / API Services              │
                         │  Lovable AI Gateway (Gemini 3 Flash,     │
                         │    Gemini 3 Pro Image)                   │
                         │  Gemini Live API (@google/genai SDK)     │
                         │  Perplexity Sonar API                    │
                         │  OpenStreetMap Nominatim (geocoding)     │
                         └─────────────────────────────────────────┘

3.3  Mermaid data-flow diagram

       ```mermaid
       flowchart TD
           User([User])
           TG[Telegram]
           PWA[React PWA]
           TB[telegram-bot\nedge fn]
           OA[orchid-agent\nedge fn]
           PA[pwa-agent\nedge fn]
           DA[demo-agent\nedge fn]
           CS[call-session\nedge fn]
           PRA[proactive-agent\nedge fn]
           GL[Gemini Live API]
           LAG[Lovable AI Gateway\nGemini 3 Flash / 3 Pro Image]
           PX[Perplexity Sonar]
           DB[(Supabase PostgreSQL)]
           ST[(Supabase Storage)]

           User -->|Telegram messages| TG
           User -->|Web / PWA| PWA
           User -->|Voice call WebSocket| GL

           TG -->|Bot API webhook| TB
           TB -->|Internal JSON POST| OA

           PWA -->|supabase.functions.invoke| PA
           PWA -->|demo| DA
           PWA -->|call session| CS

           OA -->|model calls| LAG
           OA -->|research_web tool| PX
           OA -->|CRUD| DB
           OA -->|store photos| ST

           PA -->|model calls| LAG
           PA -->|CRUD| DB

           DA -->|model calls| LAG
           DA -->|research| PX

           CS -->|ephemeral token| GL
           CS -->|tool calls → OA| OA

           PRA -->|trigger| OA
           PRA -->|read| DB
       ```

3.4  Request lifecycle — from Telegram message to reply
3.5  Request lifecycle — from PWA chat message to reply
3.6  Deployment topology (Lovable Cloud: Supabase-hosted, Vercel-style SPA)
3.7  Key architectural constraints that shaped design decisions
```

---

## 4. AI Agent: Orchid

### Summary

The core intellectual contribution of the project. The agent is named **Orchid** (defined in
`_shared/context.ts` as `ORCHID_CORE`). This section documents the full agent loop inside the
`orchid-agent` edge function: how a message arrives, how hierarchical context is assembled, how
the Gemini 3 Flash model is called via the Lovable AI Gateway, how tool calls are executed, and
how the final reply is returned. It also covers the complete tool inventory, the capability
permission model, and the media preprocessing pipeline. Sufficient for a rebuilding engineer to
recreate the agent from scratch.

### Mini-Structure

```
4.1  Agent identity and persona
       - Name: Orchid (every edge function refers to it as Orchid, not Viridis)
       - Defined in ORCHID_CORE constant in _shared/context.ts
       - Personality is user-configurable: warm | expert | philosophical | playful
       - Stored in profiles.personality; injected via toneModifiers into system prompt
       - Core belief system: "memory is care", "friend who happens to know plants"

4.2  Models and inference gateway

       | Purpose                 | Model                                    | API endpoint                         |
       |-------------------------|------------------------------------------|--------------------------------------|
       | Text orchestration      | google/gemini-3-flash-preview            | Lovable AI Gateway (OpenAI-compat.)  |
       | Vision: identify/diagnose| google/gemini-3-pro-preview (primary)   | Lovable AI Gateway                   |
       |                         | google/gemini-2.5-pro (fallback)         | Lovable AI Gateway                   |
       | Image generation        | google/gemini-3-pro-image-preview        | Lovable AI Gateway                   |
       | Deep reasoning          | google/gemini-3-flash-preview (DeepThink)| Lovable AI Gateway                   |
       | Voice call              | gemini-2.5-flash-native-audio-preview-12-2025 | Gemini Live API (@google/genai SDK) |
       | Call summarisation      | gemini-3-flash-preview                   | @google/genai SDK direct             |
       | Research                | Perplexity Sonar                         | api.perplexity.ai                    |

       Note: Text orchestration (Gemini 3 Flash) and vision inference (Gemini 3 Pro)
       are separate model calls. The orchestrator decides which tool to invoke; the vision
       model is called inside callVisionAgent() when identify_plant / diagnose_plant /
       analyze_environment tools fire.

       All non-voice model calls route through:
       https://ai.gateway.lovable.dev/v1/chat/completions
       Authenticated with LOVABLE_API_KEY.

4.3  Mermaid: orchid-agent request loop

       ```mermaid
       sequenceDiagram
           participant Caller as Caller\n(telegram-bot / pwa-agent)
           participant OA as orchid-agent
           participant DB as Supabase DB
           participant CTX as _shared/context
           participant LAG as Lovable AI Gateway\n(Gemini 3 Flash)
           participant PX as Perplexity Sonar

           Caller->>OA: POST {profileId, message, mediaBase64?}
           OA->>DB: loadHierarchicalContext(profileId)
           DB-->>OA: {plants, reminders, insights, summaries, messages}
           OA->>CTX: buildEnrichedSystemPrompt(profile, context, channel)
           CTX-->>OA: system prompt string
           OA->>LAG: POST /v1/chat/completions (model + tools + messages)
           LAG-->>OA: response (text | toolCalls)
           loop Max 3 tool iterations
               alt Tool call
                   OA->>DB: CRUD (save_plant, log_care_event, etc.)
                   OA->>PX: research (research_web / find_stores)
                   OA->>LAG: POST with tool results → next response
                   LAG-->>OA: next response
               end
           end
           OA->>DB: INSERT outbound conversation record
           OA-->>Caller: {reply, artifacts, media[]}
       ```

4.4  Tool inventory (24 tools in orchid-agent)

       | Tool Name                        | Required Capability  | Description                           |
       |----------------------------------|----------------------|---------------------------------------|
       | identify_plant                   | (always allowed)     | Vision species ID from photo          |
       | diagnose_plant                   | (always allowed)     | Health diagnosis from photo           |
       | analyze_environment              | (always allowed)     | Analyze light/conditions from photo   |
       | generate_visual_guide            | generate_content     | Step-by-step illustrated care guide   |
       | analyze_video                    | (always allowed)     | Process video file                    |
       | transcribe_voice                 | (always allowed)     | Transcribe audio file                 |
       | save_plant                       | manage_plants        | Create plant record                   |
       | modify_plant                     | manage_plants        | Update plant fields (bulk supported)  |
       | delete_plant                     | delete_plants        | Remove plant (bulk + confirmation)    |
       | create_reminder                  | create_reminders     | Schedule care reminder                |
       | delete_reminder                  | create_reminders     | Remove reminder                       |
       | log_care_event                   | manage_plants        | Record watering, pruning, etc.        |
       | save_user_insight                | (always allowed)     | Persist learned fact about user       |
       | capture_plant_snapshot           | manage_plants        | Save visual snapshot for timeline     |
       | compare_plant_snapshots          | read_plants          | Diff two snapshots for change         |
       | recall_media                     | read_plants          | Retrieve previous plant photos        |
       | find_stores                      | shopping_search      | Find local plant supply stores        |
       | verify_store_inventory           | shopping_search      | Confirm product at specific store     |
       | get_cached_stores                | shopping_search      | Return previously found stores        |
       | update_notification_preferences  | create_reminders     | Change reminder frequency/quiet hrs   |
       | update_profile                   | (confirmation guard) | Update display_name, location, etc.   |
       | research                         | research_web         | Web research via Perplexity Sonar     |
       | deep_think                       | (always allowed)     | Route to extended reasoning pass      |
       | generate_image                   | generate_content     | Generate botanical-style image        |

4.5  Capability permission system
       - 14 values of agent_capability enum stored in agent_permissions table
       - Default safe set granted on new profile creation
       - checkAgentPermission() consulted before any destructive/autonomous tool
       - If denied: agent explains constraint and how to enable at /settings

4.6  Media preprocessing pipeline (orchid-agent)
       - Telegram photos: downloaded via Bot API getFile → base64-encoded by telegram-bot
       - Base64 payload passed in payload.mediaBase64 + payload.mediaMimeType
       - Image resizing: deno_image (pure JS, no WASM)
             – Max dimension: 1536 px on longest edge
             – Output: JPEG at 85 quality
             – RESIZE_MEDIA toggle (currently true)
       - Videos: size-checked (warn >5 MB), passed as base64 for analyze_video tool
       - External URLs forwarded as image_url content blocks to the vision model

4.7  Image generation (generate_image tool)
       - Model: google/gemini-3-pro-image-preview via Lovable AI Gateway
       - Styled prompt: "Botanical Pixels" aesthetic injected automatically
         (white background, botanical illustrations, Press Start 2P typography)
       - Generated image URL added to mediaToSend queue and saved to conversations

4.8  Guide generation (generate_visual_guide tool)
       - Step-by-step illustrated guide rendered as Markdown + images
       - Uploaded to generated-guides storage bucket
       - Signed URL (1 h TTL) returned in reply

4.9  Deep Think mode (_shared/deepThink.ts)
       - Wraps Gemini 3 Flash with an extended reasoning pass
       - Used for complex plant diagnosis and treatment planning
       - Triggered by deep_think tool call from orchestrator

4.10 Bulk operations
       - modify_plant, delete_plant, create_reminder, log_care_event all support:
           "all" / "all plants" / "all plants in [location]" / "all [species]"
       - Implemented in resolvePlants() in _shared/tools.ts
       - Destructive bulk (delete_plant) requires two-step: confirm:false → confirm:true

4.11 System prompt structure (buildEnrichedSystemPrompt in _shared/context.ts)
       1. ORCHID_CORE identity + tone modifier
       2. Current date/time + timezone
       3. User profile (name, experience, pets, concerns)
       4. Plants roster (name, species, location, last care, snapshot)
       5. Active reminders (plant, type, next due in human-readable format)
       6. Previous conversation summaries
       7. Last 5 recent messages
       8. User insights (key/value pairs)
       9. Recent plant identifications (last 24h)
       10. Response formatting rules (Telegram: no markdown / PWA: markdown OK)
       11. Available tools list with usage guidance
```

---

## 5. Telegram Channel Integration

### Summary

Telegram is the primary messaging channel for Orchid. This section documents the
`telegram-bot` edge function (grammY webhook handler), the four-step inline-button
onboarding flow, how messages are delegated to `orchid-agent` via an internal JSON
POST, the linking codes system that connects an existing web account to a Telegram
chat ID, and the bot commands available to users.

### Mini-Structure

```
5.1  Channel overview
       - Primary user-facing channel: Telegram Bot API
       - Library: grammY 1.21 (npm:grammy@1.21.1)
       - Edge function: supabase/functions/telegram-bot/index.ts
       - Bot handle: @orchidcare_bot
       - Deep link: https://t.me/orchidcare_bot?start=web

5.2  Telegram bot webhook flow

       ```mermaid
       sequenceDiagram
           participant TG as Telegram Bot API
           participant TB as telegram-bot\nedge fn
           participant OA as orchid-agent\nedge fn
           participant DB as Supabase DB

           TG->>TB: POST update (message / callback_query / photo)
           TB->>DB: SELECT profile WHERE telegram_chat_id = chatId
           alt New user (no profile)
               TB->>DB: INSERT auth.users (tg_{chatId}@orchid.bot)
               TB->>DB: INSERT profiles (telegram_chat_id, personality defaults)
               TB-->>TG: Send onboarding inline buttons
           else Existing user, onboarding not complete
               TB-->>TG: Continue onboarding inline flow
           else Existing user
               TB->>OA: POST {profileId, message, mediaBase64?, channel: "telegram"}
               OA-->>TB: {reply, media[]}
               TB-->>TG: Send reply (text + photos)
           end
       ```

5.3  Onboarding state machine
       - In-memory onboardingState Map<chatId, {step, pets[]}>
       - 4-step inline button flow:

       ```mermaid
       stateDiagram-v2
           [*] --> WaitName : /start received (auto name question shown)
           WaitName --> WaitPersonality : name confirmed or skipped
           WaitPersonality --> WaitExperience : personality selected
           WaitExperience --> WaitPets : experience selected
           WaitPets --> Done : pets confirmed or skipped
           Done --> [*] : profile saved, Orchid sends greeting
       ```

       - Personality options: ☀️ Warm / 🎪 Playful / 🔬 Expert / 🌿 Philosophical
       - Experience options: 🌱 Beginner / 🪴 Intermediate / 🌳 Expert
       - Pets (multi-select): Dog / Cat / Bird / Fish / Rabbit

5.4  Synthetic user record
       - On /start: auth.users row created for Telegram user:
           email = tg_{chatId}@orchid.bot (never known to user)
           password = random UUID (never used directly)
       - Enables web dashboard login later via magic link

5.5  Delegating messages to orchid-agent
       - After onboarding: every incoming message forwarded via internal HTTP POST
       - Request headers: X-Internal-Agent-Call: true
       - Payload: { profileId, message, mediaBase64?, mediaMimeType?, channel: "telegram" }
       - Response: { reply: string, media: [{url, caption}][] }
       - telegram-bot then calls bot.api.sendMessage() / sendPhoto() with the reply

5.6  Account linking (Telegram ↔ web)
       - User in Settings generates a 6-digit linking_codes record
       - They DM the code to @orchidcare_bot
       - Bot matches code → sets profiles.telegram_chat_id = chatId
       - Code expires (expires_at) and is marked used_at once consumed

5.7  Proactive messages
       - proactive-agent reads proactive_preferences for each profile
       - Triggers orchid-agent with X-Proactive-Trigger: true header
       - orchid-agent generates a natural outreach message using reminder/event context
       - Sent via Telegram Bot API sendMessage to telegram_chat_id
       - Delivery logged in proactive_messages for deduplication
```

---

## 6. Real-Time Voice Call System

### Summary

Users can speak with Orchid in real time via a full-duplex audio WebSocket powered by the
Gemini Live API. This section documents the `call-session` edge function (session creation,
ephemeral token issuance, tool call proxying, session end), the `useGeminiLive` React hook
(audio capture, playback, video capture, recorder sub-hooks), the Pixel Canvas visual system
(PixiJS formations driven by show_visual tool calls), and the `summarise-call` edge function.

### Mini-Structure

```
6.1  Feature overview
       - Bidirectional real-time audio: user speaks, Orchid responds in synthesised voice
       - Visual layer: PixiJS Pixel Canvas renders formations triggered by agent tool calls
       - Tool calls during voice: full orchid-agent tool set available mid-conversation
       - Post-call: transcript and AI summary saved; shown to user after call ends

6.2  Models for voice

       | Purpose               | Model                                           |
       |-----------------------|-------------------------------------------------|
       | Live bidirectional    | models/gemini-2.5-flash-native-audio-preview-12-2025 |
       | Call summarisation    | gemini-3-flash-preview (via Gemini SDK)         |

6.3  call-session edge function (4 endpoints)
       - POST /create  — auth (JWT or initData), create call_sessions row, return sessionId
       - POST /token   — validate sessionId, call Gemini.live.connect() ephemeral token,
                         inject voice system prompt, return {token, expiresAt}
       - POST /tools   — receive tool call from client, execute via _shared/toolExecutor.ts,
                         return {result}
       - POST /end     — save durationSeconds + transcript, trigger summarise-call, update
                         call_sessions.status = "ended"

6.4  Auth for voice calls
       - Supports Supabase JWT (web/PWA) and Telegram initData (Mini App / direct)
       - validateAuthAndGetProfile() in call-session tries JWT first, then initData
       - dev-call-proxy: dev-only alternative that uses DEV_AUTH_SECRET + telegramChatId

6.5  Client-side audio pipeline (useGeminiLive React hook)

       ```
       Microphone (getUserMedia)
              │
              ▼
       useAudioCapture          PCM 16-bit chunks → base64
       (ScriptProcessor/         ──────────────────────────► Gemini Live WebSocket
       AudioWorklet)
                                 ◄────────────────────────── Audio chunks from Gemini
       useAudioPlayback
       (AudioContext queue)
              │
              ▼
       Speakers
       ```

       Sub-hooks (src/hooks/call/):
       – useAudioCapture:  captures mic, converts to 16-bit PCM, sends via SDK session
       – useAudioPlayback: AudioContext, chunk queue, smooth sequential playback
       – useVideoCapture:  canvas snapshot → base64 JPEG at configurable fps
       – useCallRecorder:  MediaRecorder API, records full call audio for summarise-call

6.6  Tool call bridge in useGeminiLive
       - Gemini fires toolCall events mid-stream
       - show_visual: handled 100 % client-side (no HTTP round-trip)
           → Formation queued in formationQueueRef → set on PixelCanvas
       - annotate_view: handled client-side → AnnotationSet on PixelCanvas
       - All other tools: POSTed to call-session/tools endpoint
           → Response sent back via session.sendToolResponse()

6.7  Pixel Canvas visual system (PixiJS)
       - PixelCanvas.tsx (src/lib/pixel-canvas/): full-screen PixiJS canvas
       - Formation types: 'template' (named plant sprite), 'text', 'list', 'clear'
       - Transition types: 'fade', 'dissolve', 'cascade', 'scatter'
       - Formation queue: sequential playback prevents race conditions when agent
         fires show_visual multiple times in quick succession

6.8  Voice system prompt (buildVoiceSystemPrompt in _shared/context.ts)
       - Derived from the same ORCHID_CORE + tone modifiers as text
       - Additional instruction: "You are Orchid, on a live voice call. Greet the user
         warmly. Keep responses under 3 sentences unless user asks for detail."
       - Reminders capped at 10, recent messages capped to last 5 (latency)
       - Available tools injected from _shared/voiceTools.ts

6.9  Post-call summarisation (summarise-call edge function)
       - Receives userAudio (base64) + agentAudio (base64) + audioMimeType
       - Calls Gemini 2.5 Flash Native Audio: "summarise this voice call between
         a user and their AI plant care assistant Orchid"
       - Summary saved to call_sessions.summary
       - Transcript saved via call-session /end endpoint

6.10 Connection state machine

       ```mermaid
       stateDiagram-v2
           idle --> connecting : connect() called
           connecting --> active : session established + greeting sent
           active --> reconnecting : connection dropped (auto-retry ×3)
           reconnecting --> active : new ephemeral token + reconnected
           reconnecting --> error : max retries exceeded
           active --> ended : disconnect() called
           ended --> idle : reset state
       ```
```

---

## 7. Progressive Web App (PWA)

### Summary

The PWA (`/app` route, served by `AppPage.tsx`) is the web-based surface for Orchid. It
provides email/password and Google OAuth sign-in, a web-native onboarding flow, the full
chat interface (powered by `pwa-agent`), a multi-tab dashboard (collection, activity, profile),
settings, and a live call page. This section documents every route, the key components, the
`pwa-agent` edge function, the design system, and the PWA installation configuration.

### Mini-Structure

```
7.1  Tech stack (frontend)
       - React 18, Vite, TypeScript (strict mode)
       - React Router v6 (client-side routing)
       - Tailwind CSS (JIT), shadcn/ui (Radix UI primitives)
       - Framer Motion (animations), PixiJS 8 (Pixel Canvas)
       - TanStack Query v5 (server state management)
       - @supabase/supabase-js (Auth + DB + Storage + Edge Functions)
       - @google/genai (Gemini Live client-side SDK)
       - jsPDF (PDF generation for care guides)
       - Lenis (smooth scroll)

7.2  Route map

       Route                      Component              Auth guard
       /                          OrchidPage             public
       /login                     LoginPage              public (redirect if authed)
       /onboarding                Onboarding             protected
       /app                       AppPage                public (auth handled inline)
       /chat                      ChatPage               protected
       /dashboard/collection      Dashboard → Collection protected
       /dashboard/activity        Dashboard → Activity   protected
       /dashboard/profile         Dashboard → Profile    protected
       /settings                  Settings               protected
       /plants                    Plants (→ /dashboard/collection)  protected
       /call                      LiveCallPage           public* (Telegram or Supabase JWT)
       /dev/call                  DevCallPage            public* (DEV_AUTH_SECRET)
       /demo                      DemoPage               public (HMAC demo token)
       /developer                 DeveloperPlatform      protected
       /developer/docs            DeveloperPlatform      protected
       /privacy                   Privacy                public
       /proposal                  Proposal               public

       * Auth handled inside component via call-session/create

7.3  /app route — PWA entry point (AppPage.tsx)
       - State machine: loading → auth (PwaAuth) → onboarding (PwaOnboarding) → chat (PwaChat)
       - PwaAuth: email/password sign-up / sign-in, Google OAuth, Apple sign-in
       - PwaOnboarding: personality / experience / concerns / pets form (no Telegram needed)
       - PwaChat: full chat UI with artifact cards + PixelCanvas + voice prewarming
       - InstallPrompt: "Add to Home Screen" prompt on iOS/Android

7.4  PwaChat and pwa-agent
       - Calls supabase.functions.invoke('pwa-agent', {body})
       - Channel stored as 'pwa' in conversations table
       - pwa-agent: authenticates via Supabase JWT, looks up profile by user_id,
         then delegates to orchid-agent with X-Internal-Agent-Call: true
       - Conversation history loaded from DB on mount (last 50 pwa-channel messages)
       - Artifact rendering: IdentificationCard, DiagnosisCard, CareGuideCard,
         StoreListCard, VisualGuideCard, ChatResponse

7.5  Dashboard (DashboardShell + 3 views)
       - DashboardShell: tab navigation, grain texture, mobile BottomNav
       - CollectionView: plant card grid, add/edit plant modal
             – usePlants() hook: fetches plants + upcoming reminders
             – Photo URL resolution: createSignedUrl() for storage paths (1h TTL)
       - PlantDetail: care event timeline, photo gallery, reminders, identification history
       - ActivityView: chronological feed (care events + pwa/telegram conversations
                       + agent operations) via useAllCareEvents() + useConversations()
       - ProfileView: user insights list + delete; agent permission toggles;
                       Telegram connection card (linking_codes flow)

7.6  Settings page
       - 4 collapsible sections: Notifications / Proactive Agent / Agent Permissions / Danger Zone
       - Notification settings → proactive_preferences table
       - Agent permissions → agent_permissions table (14 capability toggles)
       - Delete account → calls delete-account edge function (cascade delete all user data)

7.7  Demo page (/demo)
       - Unauthenticated; HMAC-signed demo tokens (DEMO_HMAC_SECRET)
       - Calls demo-agent edge function
       - Token payload: {sid, txt, vox, img, ts} — rate-limited (5 text, 3 voice, 3 images)
       - Generative UI artifacts: IdentificationCard, DiagnosisCard, CareGuideCard, etc.
       - PixelCanvas + DemoVoiceOverlay for voice demo

7.8  Landing page (OrchidPage + OrchidHero)
       - De-pixelation animation: orchid image rendered in progressively higher resolution
       - Mobile: tap → Telegram deep link (t.me/orchidcare_bot?start=web)
                 or "Add to Home Screen" if PWA-installable
       - StartPage slide-up (after tap): QROrchid component shows QR code for Telegram
         link (desktop), feature walkthrough sections (IdentifyFeature, DiagnosisFeature,
         MemoryFeature, ProactiveFeature, ShoppingFeature, GuidesFeature, LiveFeature, CTAFeature)
       - QROrchid: pixel orchid grid morphs into QR code encoding the Telegram deep link
         (QRMorphCanvas using qrcode-generator library + orchid-grid bitmap)

7.9  Design system — "Botanical Pixels"
       - Typography: Instrument Serif (display), Inter (body), Press Start 2P (UI chrome)
       - Palette: deep forest green, botanical cream (#faf8f4), warm black (#0a0a0a)
       - Hard shadows (4–8 px offset, black), 2 px solid black borders
       - Etched botanical SVG illustrations as background textures (BrutalistPatterns.tsx)
       - ScrambleText / DecryptText: block density character animations (█ ▓ ▒ ░ → letter)
       - BrutalistTooltip: monospace uppercase label overlays

7.10 State management approach
       - TanStack Query staleTime = 45 min for plants (avoids re-fetches during session)
       - AuthContext (React Context): user, session, profile, loading, signIn/Out, CRUD
       - Query invalidation on all mutations
       - No global state library (Redux/Zustand) — intentionally minimal

7.11 PWA configuration
       - vite-plugin-pwa (Workbox): offline shell caching
       - Web App Manifest: standalone display, theme-color = black
       - iOS meta tags: apple-mobile-web-app-capable, status-bar-style
       - AddToHomeGuide: step-by-step iOS/Android install instructions overlay
       - usePwaInstall hook: detects Chrome/Safari, installable state, iOS browser type
```

---

## 8. Data Layer & Database Models

### Summary

All persistent data lives in PostgreSQL on Supabase. This section documents every table,
enum, storage bucket, database function, and RLS policy pattern. It traces each model to
the feature it supports and provides an entity-relationship diagram. All information verified
against `src/integrations/supabase/types.ts` (the auto-generated type file).

### Mini-Structure

```
8.1  Database overview
       - PostgreSQL 15 via Supabase (Lovable Cloud)
       - 19 tables (verified against src/integrations/supabase/types.ts)
       - 3 custom enums
       - 2 storage buckets
       - RLS enabled on all tables
       - Service role bypasses RLS (used by all edge functions)

8.2  Custom enums

       agent_capability (14 values)
       ├── read_plants, manage_plants, delete_plants
       ├── read_reminders, manage_reminders, create_reminders, send_reminders
       ├── read_conversations
       ├── shopping_search, research_web, generate_content
       ├── delete_notes, delete_insights
       └── send_insights

       app_role: user | premium | admin
       doctor_personality: warm | expert | philosophical | playful

8.3  Core user model

       profiles  (central user record)
       ├── id, user_id (FK → auth.users, ON DELETE CASCADE)
       ├── phone_number (text, nullable, unique)
       ├── whatsapp_number (text, nullable)     ← field exists; integration not live
       ├── telegram_chat_id (bigint, nullable, unique)
       ├── telegram_username (text, nullable)
       ├── display_name, location, timezone (default: America/New_York)
       ├── notification_frequency: off | daily | weekly | realtime
       ├── personality (doctor_personality, default: warm)
       ├── experience_level: beginner | intermediate | expert
       ├── primary_concerns (text[]), pets (text[], default: '{}')
       └── created_at, updated_at

       user_roles  (RBAC layer)
       ├── user_id (FK → auth.users), role (app_role)

8.4  Plant collection models

       plants
       ├── id, profile_id (FK → profiles, ON DELETE CASCADE)
       ├── name (text, NOT NULL), species, nickname, location_in_home
       ├── photo_url (storage path "bucket:path" or full URL), notes, acquired_date
       └── created_at, updated_at

       plant_identifications  (vision AI result cache)
       ├── id, plant_id (FK → plants), profile_id (FK → profiles)
       ├── species_guess, confidence, diagnosis, care_tips
       ├── severity, treatment, photo_url
       └── created_at

       plant_snapshots  (before/after health timeline)
       ├── id, plant_id (FK → plants), profile_id (FK → profiles)
       ├── snapshot_type: before | after | current
       ├── photo_url, notes, health_score, visual_description
       └── created_at

       care_events  (care action audit log)
       ├── id, plant_id (FK → plants)
       ├── event_type: watered | fertilized | repotted | pruned | treated | photo
       ├── notes, photo_url
       └── created_at

       reminders  (scheduled care tasks)
       ├── id, plant_id (FK → plants), profile_id (FK → profiles)
       ├── reminder_type, frequency_days (int), next_due (timestamptz)
       ├── is_active (bool), custom_message, notes
       └── created_at, updated_at

8.5  Conversation and memory models

       conversations  (full message log)
       ├── id, profile_id (FK → profiles)
       ├── channel: sms | whatsapp | telegram | pwa
       ├── direction: inbound | outbound
       ├── content (text), media_urls (text[]), message_sid
       ├── summarized (bool, default false)
       └── created_at

       conversation_summaries  (hierarchical compression)
       ├── id, profile_id (FK → profiles)
       ├── summary (text), key_topics (text[])
       ├── message_count, start_time, end_time
       └── created_at

       user_insights  (extracted semantic facts)
       ├── id, profile_id (FK → profiles)
       ├── insight_key (text), insight_value (text)
       ├── confidence (float 0.0–1.0)
       └── created_at

       conversations  (full message log — includes rating column for feedback)
       ├── id, profile_id (FK → profiles)
       ├── channel: sms | whatsapp | telegram | pwa | voice
       ├── direction: inbound | outbound
       ├── content (text), media_urls (text[]), message_sid
       ├── rating (integer: 1 = thumbs up, -1 = thumbs down, null = unrated)
       ├── summarized (bool, default false)
       └── created_at

       NOTE: There is NO separate conversation_ratings table. Message rating
       (thumbs up/down in the PWA chat UI) is stored directly on the conversations
       row via the rating column. Rating values: 1 (helpful) or -1 (not helpful).

8.6  Voice call models

       call_sessions
       ├── id, profile_id (FK → profiles)
       ├── status: pending | active | ended | failed
       ├── mode: audio | video, voice (text)
       ├── started_at, ended_at, duration_seconds
       ├── tool_calls_count, summary (text)
       └── created_at

8.7  Agent autonomy models

       agent_permissions  (per-user capability grants)
       ├── id, profile_id (FK → profiles)
       ├── capability (agent_capability enum)
       ├── enabled (bool, nullable)
       └── created_at, updated_at

       agent_operations  (audit trail of autonomous actions)
       ├── id, profile_id (FK → profiles)
       ├── operation_type (text), table_name (text), record_id (text)
       ├── tool_name (text), correlation_id (text)
       ├── metadata (jsonb)
       └── created_at

       proactive_preferences  (per-topic on/off toggle per user)
       ├── id, profile_id (FK → profiles)
       ├── topic (text: care_reminders | observations | seasonal_tips | health_followups)
       ├── enabled (bool)
       ├── quiet_hours_start (time, nullable), quiet_hours_end (time, nullable)
       └── created_at, updated_at
       NOTE: One row per topic per profile (not separate boolean columns).

       proactive_messages  (dedup log for proactive sends)
       ├── id, profile_id (FK → profiles)
       ├── channel (text), trigger_type (text)
       ├── trigger_data (jsonb), message_content (text)
       ├── response_received (bool, nullable) — ⚠️ vestigial: never set by proactive-agent
       └── sent_at, created_at

8.8  Developer API models

       developer_api_keys
       ├── id, profile_id (FK → profiles)
       ├── key_hash (SHA-256, stored instead of plaintext key)
       ├── key_prefix (first 8 chars, for display)
       ├── name, description, status (active | revoked)
       ├── rate_limit_per_minute
       └── created_at

       api_usage_log
       ├── id, api_key_id (FK → developer_api_keys)
       ├── profile_id, end_user_id
       ├── status, error_message, latency_ms
       └── created_at

8.9  Other models

       linking_codes  (Telegram ↔ web account bridge)
       ├── id, user_id (FK → auth.users)
       ├── code (6-digit text), expires_at, used_at
       └── created_at

       generated_content  (guide artifacts from generate_visual_guide)
       ├── id, profile_id (FK → profiles)
       ├── content (jsonb), content_type, task_description
       ├── source_message_id (FK → conversations, nullable)
       └── created_at

8.10 Mermaid ER diagram (simplified)

       ```mermaid
       erDiagram
           profiles ||--o{ plants : "owns"
           profiles ||--o{ conversations : "has"
           profiles ||--o{ conversation_summaries : "has"
           profiles ||--o{ user_insights : "has"
           profiles ||--o{ reminders : "has"
           profiles ||--o{ call_sessions : "has"
           profiles ||--o{ agent_permissions : "has"
           profiles ||--o{ agent_operations : "has"
           profiles ||--o{ proactive_preferences : "has"
           profiles ||--o{ proactive_messages : "has"
           profiles ||--o{ developer_api_keys : "has"
           profiles ||--o{ generated_content : "has"
           plants ||--o{ care_events : "logs"
           plants ||--o{ reminders : "schedules"
           plants ||--o{ plant_identifications : "has"
           plants ||--o{ plant_snapshots : "has"
           developer_api_keys ||--o{ api_usage_log : "logs"
       ```

8.11 RLS policy patterns
       - Authenticated users (web):
           USING (auth.uid() = user_id)  — for profiles, user_roles
           USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) — for owned resources
       - Service role: USING (true) + WITH CHECK (true) — all tables (used by edge functions)
       - anon: DENY (false) on sensitive tables (profiles, conversations)
       - Storage: authenticated + service_role on plant-photos; service_role only on generated-guides

8.12 Photo URL resolution pattern
       - Storage paths stored as "bucket:path" (e.g. "plant-photos:profiles/uuid/photo.jpg")
       - resolvePhotoUrl() / resolveMediaUrl() generate createSignedUrl() (1 h TTL) on load
       - Avoids permanent public exposure; signed URLs regenerated on each page load

8.13 Key database functions (from types.ts)
       - get_profile_by_phone(phone_number) → profiles row
       - has_agent_capability(profile_id, capability) → bool
       - has_role(user_id, role) → bool
       - increment_tool_calls_count(session_id) → void
```

---

## 9. Authentication & Security

### Summary

Orchid has three distinct authentication paths, converging on Supabase RLS for data isolation.
This section documents each path, the synthetic user model for Telegram-first users, the
developer API key scheme, the demo HMAC token system, and the known security limitations
of the current prototype — which are important for a production engineering handoff.

### Mini-Structure

```
9.1  Authentication paths

       | Path                  | Mechanism                              | Data isolation             |
       |-----------------------|----------------------------------------|----------------------------|
       | Web / PWA             | Supabase JWT (email / Google OAuth)    | Database RLS               |
       | Telegram bot          | service_role key (bypasses RLS)        | App-code WHERE clauses     |
       | Voice call (web)      | Supabase JWT forwarded to call-session | Database RLS               |
       | Voice call (Telegram) | Telegram initData HMAC-SHA256          | Database RLS               |
       | Developer REST API    | SHA-256 hashed API key (orch_ prefix)  | App-code WHERE clauses     |
       | Demo page             | HMAC-signed stateless token            | No real user data          |

9.2  Web / PWA authentication
       - Supabase Auth: email/password sign-up/-in, Google OAuth, Apple sign-in
       - Session stored in localStorage by @supabase/supabase-js
       - AuthContext: exposes { user, session, profile, loading, signIn, signOut, ... }
       - ProtectedRoute HOC: redirects to /login if !user
       - Post-auth: user redirected to returnTo URL or /chat

9.3  Telegram bot authentication
       - telegram-bot edge function uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
       - Data isolation: application-layer WHERE profile_id = resolvedProfileId in every query
       - New user: synthetic auth.users row created on first /start:
           email = tg_{chatId}@orchid.bot, password = random UUID (never used)
       - telegram_chat_id stored on profiles for all subsequent lookups

9.4  Voice call authentication (Telegram initData)
       - validateInitData() in _shared/auth.ts validates HMAC-SHA256:
           key = HMAC_SHA256("WebAppData", TELEGRAM_BOT_TOKEN)
           check = HMAC_SHA256(key, data_check_string)
       - On success: profile looked up by telegram_chat_id
       - JWT fallback: if no initData, tries Supabase session JWT

9.5  Developer API key scheme (api edge function)
       - Keys generated client-side with crypto.randomBytes (orch_ prefix)
       - SHA-256 hash stored in developer_api_keys.key_hash (never plaintext)
       - key_prefix (first 8 chars) stored for display in dashboard
       - Each request: hash incoming key, lookup by hash, check status = "active"
       - Rate limiting: api_usage_log checked for requests in last 60 s

9.6  Demo authentication (demo-agent)
       - DEMO_HMAC_SECRET used to sign/verify stateless demo tokens
       - Token payload: {sid, txt, vox, img, ts} — base64 + HMAC hex signature
       - Limits: 5 text turns, 3 voice turns, 3 images per token (24 h max age)
       - No real user data accessible from demo path

9.7  Known security limitations (prototype-level — must fix before production)
       P0 — proactive_preferences and proactive_messages: service policies missing
            TO service_role scoping; any authenticated user can read all rows
       P0 — linking_codes: USING (true) allows any authenticated user to read all codes;
            scoping to USING (auth.uid() = user_id) required
       P1 — No Telegram webhook secret verification
            (X-Telegram-Bot-Api-Secret-Token header not checked)
       P1 — No rate limiting on Telegram webhook (message flooding risk)
       P2 — No rate limiting on linking code attempts (brute-force code enumeration)
```

---

## 10. Memory & Context Engineering

### Summary

Orchid's memory system allows the agent to maintain continuity across many conversations without
sending unbounded history to the model. This section documents the hierarchical context assembly
pipeline in `_shared/context.ts`: how recent messages, compressed summaries, extracted insights,
the plant roster, and active reminders are combined into a single system prompt before every model
call. It also covers the insight extraction mechanism and the time-formatting utilities that make
reminders human-readable in the prompt.

### Mini-Structure

```
10.1 The problem
       - Sending raw full conversation history to Gemini is expensive and eventually hits limits
       - Users expect the agent to remember things said weeks ago
       - Solution: tiered memory — recent verbatim + rolling summary + extracted insights

10.2 HierarchicalContext data structure

       interface HierarchicalContext {
         recentMessages:         last 5 conversations rows (content, direction, created_at)
         summaries:              last 3 conversation_summaries (summary, key_topics, end_time)
         userInsights:           all user_insights for profileId
         recentIdentifications:  last 5 plant_identifications (last 24 h only)
         activeReminders:        all active reminders (is_active=true, joined with plants)
       }

10.3 loadHierarchicalContext() — data assembly (parallel fetches)

       Step 1: conversations LIMIT 5 ORDER BY created_at DESC
       Step 2: conversation_summaries LIMIT 3 ORDER BY end_time DESC
       Step 3: user_insights (all, no limit)
       Step 4: plant_identifications in last 24h, LIMIT 5
       Step 5: reminders WHERE is_active=true JOIN plants LIMIT 10

       All 5 queries execute in parallel via Promise.all([...])

10.4 buildEnrichedSystemPrompt() — injection order

       1.  ORCHID_CORE + toneModifier (from doctor_personality)
       2.  Current date/time + user timezone
       3.  User profile block (name, experience, pets, concerns)
       4.  Communication style overrides (comm_pref_* user_insights)
       5.  Plant roster (name, species, location, last event, snapshot description)
       6.  Active reminders (human-readable: "due tomorrow", "overdue by 2 days")
       7.  Previous conversation summaries (compressed history)
       8.  Recent messages (last 5, verbatim)
       9.  User facts/insights (insight_key → insight_value pairs)
       10. Recent plant identifications (last 24 h)
       11. Response formatting rules (channel-specific: Telegram vs. PWA)
       12. Available tools + usage instructions

10.5 buildVoiceSystemPrompt() — pruned variant for voice calls
       - Same pipeline but: reminders capped at 10, messages capped at 5
       - Adds "You are Orchid, on a live voice call. Keep responses under 3 sentences."
       - Tools injected from _shared/voiceTools.ts (not orchid-agent's inline list)

10.6 Conversation compression
       - After a session ends: summarise-call can also compress text turns (future)
       - No automatic text compression implemented yet — summaries are manually triggered
         or created post-call; old summaries accumulate (no pruning)

10.7 User insight extraction
       - save_user_insight tool: agent proactively calls this when it learns something
         e.g. {insight_key: "home_lighting", insight_value: "north-facing, low light"}
       - Insight keys mapped to human-readable labels in formatInsightKey()
       - Standard keys: has_pets, pet_type, home_lighting, watering_style,
         experience_level, plant_goals, problem_patterns, home_humidity, climate_zone,
         window_orientation, plant_preferences, allergy_concerns, child_safety
       - comm_pref_* keys: brevity, tone, humor, emoji_usage, formality, detail_level
       - No deduplication: conflicting entries can accumulate (known limitation)

10.8 Time-formatting helpers (_shared/context.ts)
       - formatTimeUntil(target, now): "due today" | "due tomorrow" | "in N days"
                                       | "overdue by N days"
       - formatTimeSince(past, now):   "N minutes ago" | "yesterday" | "N weeks ago"
       - formatTimeAgo(date):          compact "Nm ago" | "Nh ago" | "Nd ago"
       - formatInsightKey(key):        maps DB key names to human labels
```

---

## 11. Developer Platform & REST API

### Summary

Orchid exposes a REST API for third-party developers, managed through the
`/developer` dashboard. This section documents the API key lifecycle (generation,
hashing, revocation), the `api` edge function (authentication, rate limiting,
request routing), and the `DeveloperPlatform` frontend page.

### Mini-Structure

```
11.1 Developer platform overview
       - Route: /developer (protected, requires Supabase Auth)
       - Component: DeveloperPlatform.tsx + DeveloperDashboard.tsx
       - API keys prefixed with orch_ for format validation
       - Keys stored as SHA-256 hash in developer_api_keys table (never plaintext)

11.2 API key lifecycle
       - Generate: client generates random key, computes SHA-256 hash, stores both
                   (only hash and prefix go to DB; full key shown once then discarded)
       - List: DeveloperDashboard reads developer_api_keys for current user (key_prefix only)
       - Revoke: UPDATE developer_api_keys SET status = 'revoked'

11.3 api edge function (supabase/functions/api/index.ts)
       - Authenticates: strips "Bearer " prefix, hashes key, looks up hash in DB
       - Rate limiting: queries api_usage_log for requests in last 60 s
       - Routes incoming requests to appropriate internal services
       - Logs each call to api_usage_log (api_key_id, profile_id, latency_ms, status)

11.4 Known state
       - The REST API is in early/prototype state
       - No public API documentation generated yet
       - Rate limit per-minute is configurable per key (rate_limit_per_minute column)
```

---

## 12. Results & Evaluation

### Summary

Defines success criteria, a benchmarking rubric, and documents representative test cases
for the primary user journeys. Includes both quantitative metrics (response time, species
accuracy) and qualitative dimensions (advice relevance, personality fit, memory recall).
Documents observed failures and edge cases honestly — these are the most useful parts for
a rebuilding engineering team.

### Mini-Structure

```
12.1 Success criteria (defined up front)

       | Dimension                  | Target                       | Measurement method              |
       |----------------------------|------------------------------|---------------------------------|
       | Plant identification       | ≥85 % correct species        | Manual test set (20 plants)     |
       | Care advice relevance      | ≥4/5 judge score             | LLM-as-judge rubric             |
       | Response latency (text)    | ≤3 s p95                     | Edge function logs              |
       | Response latency (voice)   | ≤1.5 s first audio chunk     | Client-side timing              |
       | Proactive delivery         | ≥99 % to Telegram            | proactive_messages log          |
       | Tool call success rate     | ≥95 %                        | agent_operations.status log     |

12.2 LLM-as-judge rubric

       Dimension        | 1 (Poor)              | 3 (Adequate)                | 5 (Excellent)
       -----------------+-----------------------+-----------------------------+---------------------------
       Species accuracy | Wrong plant family    | Correct genus, wrong sp.    | Correct species + cultivar
       Care advice      | Generic, no context   | Correct but vague           | Specific, actionable, cites user's plant history
       Personality fit  | Robotic, off-tone     | Mostly on-tone              | Indistinguishable from chosen personality
       Memory recall    | Ignores prior context | References some history     | Seamlessly uses plant history, insights, reminders

12.3 Test cases

       TC-1: Plant identification (Monstera deliciosa)
         Input:  Photo of a Monstera with visible fenestrations
         Expected: Correct species, light and water care, pet toxicity warning
         Edge case variant: low-light photo of an unusual cultivar

       TC-2: Proactive reminder (watering overdue by 1 day)
         Input:  Cron trigger on proactive-agent for a profile with 1 overdue reminder
         Expected: Telegram message referencing specific plant name and care type

       TC-3: Bulk care event logging
         Input:  "I just watered all my plants"
         Expected: log_care_event tool fires with plant_identifier: "all",
                   agent confirms how many plants were updated

       TC-4: Voice call — multi-turn plant advice
         Input:  "How often should I water my peace lily?"
                 (follow-up) "It's in a north-facing window"
         Expected: Agent refines advice based on second turn; uses user name if known

       TC-5: Ambiguous photo (blurry, partial view)
         Input:  Low-quality photo of an unrecognised succulent
         Expected: Agent expresses uncertainty, asks for clearer photo or
                   more details rather than inventing a species

12.4 Failure modes observed during development
       - Over-confident species identification on ambiguous/unusual cultivars
       - Tool call latency (200–800 ms per tool) perceptible during voice calls
       - onboardingState (in-memory Map) lost on Deno cold start during multi-step onboarding
       - Duplicate user_insights entries when agent learns the same fact twice
       - Conversation summaries accumulate without any pruning (unbounded growth)

12.5 Reproducibility
       - Benchmark inputs and outputs archived in /docs/benchmarks/ (planned)
       - Demo page can be used to re-run text test cases against live demo-agent
```

---

## 13. Limitations, Future Work & Ethics

### Summary

A candid account of where the prototype cuts corners, what needs to change for production,
and the ethical dimensions of deploying a conversational AI assistant. This section is
written specifically for the benefit of a future engineering team doing the handoff.

### Mini-Structure

```
13.1 Current technical limitations

       Scalability
       ├── orchid-agent is a single monolithic edge function (~4000 lines); adding tools
       │   increases cold-start time and complexity
       ├── proactive-agent uses a sequential per-profile loop; at scale needs fan-out workers
       ├── No message queue: concurrent high-volume Telegram updates could cause timeouts
       └── conversation_summaries grow unbounded (no TTL or pruning strategy)

       Reliability
       ├── onboardingState in telegram-bot is in-memory → lost on every Deno cold start;
       │   multi-step onboarding can break for users who take >30 s between steps
       ├── Audio playback queue in useGeminiLive can drift if chunks arrive out of order
       └── Reconnect logic caps at 3 attempts; network instability requires manual refresh

       Data quality
       ├── user_insights has no deduplication; conflicting values can accumulate
       │   (e.g., location set twice with different values)
       └── plant_identifications.species_guess is free text with no schema

       Channels not yet live
       └── profiles.phone_number, whatsapp_number columns exist and are referenced
           in Privacy page, Proposal page, and Onboarding code comments, but
           SMS / WhatsApp integration via Twilio is NOT implemented in any edge function.
           orchid-agent explicitly rejects non-internal requests and returns empty TwiML.

13.2 Production engineering priorities (ordered)

       P0  Fix RLS gaps: proactive_preferences + proactive_messages + linking_codes
       P0  Add Telegram webhook secret verification (X-Telegram-Bot-Api-Secret-Token)
       P1  Move onboardingState to a temporary DB table (e.g. telegram_sessions)
       P1  Deduplicate user_insights: UPSERT ON CONFLICT (profile_id, insight_key)
       P1  Add rate limiting on Telegram webhook (IP / per-chat limits)
       P2  Split orchid-agent into modular tool files using Deno import maps
       P2  Implement conversation summary pruning (keep last N summaries per profile)
       P3  Add Web Push API for native push notifications to PWA
       P3  Implement SMS/WhatsApp via Twilio if messaging channel expansion is planned

13.3 Feature roadmap (deferred by design for prototype)
       - Multi-user household (shared plant collection with per-user permissions)
       - iOS/Android native apps (React Native port)
       - Full SMS/WhatsApp channel activation via Twilio
       - Plant marketplace integrations (local nursery store APIs)
       - Time-series health charts (track health_score over time via plant_snapshots)
       - AR plant health overlay (camera + bounding box via phone camera)

13.4 Ethical considerations

       Privacy
       - Data collected: display name, location (city/ZIP), pet types, plant names,
         conversation history, plant photos, voice call audio
       - All data in Supabase PostgreSQL; users can delete everything via Settings
         (delete-account edge function cascades DELETE through all tables and storage)
       - Conversation content forwarded to Google (Gemini) and Perplexity for inference
         — disclosed in Privacy Policy (/privacy route)
       - No third-party analytics SDK included in the frontend

       AI advice risk
       - Plant care advice can cause real harm (wrong fertiliser, toxicity misinformation)
       - Current mitigation: agent always uses uncertainty language; pet toxicity warnings
         are surface-level (not veterinary advice)
       - Production recommendation: partner with a licensed horticulturalist to review
         care templates; add "consult a professional" CTA for veterinary or medical queries

       Bias in plant identification
       - Gemini 3's vision model reflects internet-distributed plant image biases
       - Common houseplants (Pothos, Monstera) identified more reliably than rare cultivars
         or plants common to non-Western regions
       - No mitigation in prototype; accuracy disclosure should appear at product launch

       Autonomous agent actions
       - Agent can delete plants, notes, and insights if user-granted permissions allow
       - Mitigation: 14-capability permission model; destructive bulk operations require
         explicit 2-step confirmation; capability defaults are conservative

       Misuse
       - Telegram bot endpoint is internet-accessible; no rate limiting or content moderation
       - All stored data is user-isolated by RLS (Telegram path: by application-code WHERE)
       - Demo page rate-limited (5 text turns / 3 voice / 3 images per 24 h token)

13.5 References
       - Google Gemini API documentation: https://ai.google.dev/docs
       - Supabase documentation: https://supabase.com/docs
       - Telegram Bot API: https://core.telegram.org/bots/api
       - grammY framework: https://grammy.dev
       - Perplexity API: https://docs.perplexity.ai
       - React 18 + Vite: https://vitejs.dev
       - shadcn/ui: https://ui.shadcn.com
       - PixiJS: https://pixijs.com
       - TanStack Query: https://tanstack.com/query
       - deno_image (pure JS image resize): https://deno.land/x/deno_image

13.6 Project links
       - Live application: https://orchidml.lovable.app (Telegram) / /app (PWA)
       - GitHub repository: [insert link]
       - Demo page: [base URL]/demo
       - Demo walkthrough video: [insert link]

13.7 AI disclosure
       - This documentation outline was produced with the assistance of GitHub Copilot,
         used to structure and articulate technical details after thorough direct inspection
         of the source code. All technical facts were verified against the live source files
         before inclusion.
```

---

*End of outline. 13 sections covering Orchid by feature (§4–§7, §10–§11), by technical
implementation layer (§3, §8, §9), and with explicit model documentation in each section
where AI inference occurs (§4.2, §6.2, §10.7).*

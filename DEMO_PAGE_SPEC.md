# Demo Page: Generative UI Experience

## Spec Document — `/get-demo` Interactive Demo

> The demo is the product, compressed. Same intelligence, same beauty,
> same pixel canvas — just time-limited. No signup, no friction,
> straight into the magic.

---

## Table of Contents

0. [Visual Diagrams](#0-visual-diagrams)
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [HMAC Token System](#3-hmac-token-system)
4. [Demo Agent (Edge Function)](#4-demo-agent-edge-function)
5. [Artifact System (Generative UI)](#5-artifact-system-generative-ui)
6. [Image Generation](#6-image-generation)
7. [Live Voice Demo](#7-live-voice-demo)
8. [Frontend Components](#8-frontend-components)
9. [Rate Limiting](#9-rate-limiting)
10. [Implementation Tasks](#10-implementation-tasks)

---

## 0. Visual Diagrams

### 0.1 Landing State — First Impression

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │                                          │
  │           ┌────────────────────┐         │
  │           │                    │         │
  │           │    PixelCanvas     │         │
  │           │    (orchid,        │         │  ← 40% viewport
  │           │     breathing,     │         │     smaller than call
  │           │     full pixel     │         │     screen (not 80%)
  │           │     field)         │         │
  │           │                    │         │
  │           └────────────────────┘         │
  │                                          │
  │        hi, i'm orchid.                   │
  │        drop a photo, ask a question,     │  ← mono, dim white
  │        or just start talking.            │
  │                                          │
  │                                          │
  │                                          │
  │                                          │
  │                                          │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  │ what's wrong with my monstera?   │    │  ← sticky input bar
  │  │                           📷  🎤 │    │    text + photo + mic
  │  └──────────────────────────────────┘    │
  │         5 of 5 turns remaining           │  ← subtle, mono, dim
  └──────────────────────────────────────────┘
```

### 0.2 Identification Artifact

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │     ┌────────────────────────┐           │
  │     │   pixel canvas morphs  │           │
  │     │   to monstera          │           │  ← canvas shows
  │     │   silhouette           │           │     the identified
  │     └────────────────────────┘           │     species
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │                                    │  │
  │  │  MONSTERA DELICIOSA                │  │  ← artifact card
  │  │  Swiss Cheese Plant                │  │     (slides up)
  │  │                                    │  │
  │  │  confidence ████████████░░ 94%     │  │
  │  │                                    │  │
  │  │  family      Araceae               │  │
  │  │  origin      Central America       │  │  ← key-value pairs
  │  │  light       bright indirect       │  │     monospace
  │  │  water       when top 2" dry       │  │     Press Start 2P
  │  │  humidity    60%+                  │  │     on black
  │  │  toxic       yes (pets) ⚠          │  │
  │  │                                    │  │
  │  │  your monstera looks healthy!      │  │  ← LLM prose
  │  │  the fenestrations are developing  │  │     (natural voice)
  │  │  nicely. keep it up.               │  │
  │  │                                    │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  │ how often should I water it?     │    │
  │  └──────────────────────────────────┘    │
  │         4 of 5 turns remaining           │
  └──────────────────────────────────────────┘
```

### 0.3 Diagnosis Artifact

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │     ┌────────────────────────┐           │
  │     │   pixel canvas shows   │           │
  │     │   "ROOT ROT" as pixel  │           │
  │     │   text formation       │           │
  │     └────────────────────────┘           │
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │                                    │  │
  │  │  ⚠ ROOT ROT                       │  │  ← severity colors
  │  │  severity: MODERATE                │  │     via border accent
  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
  │  │                                    │  │
  │  │  SYMPTOMS                          │  │
  │  │  · yellowing lower leaves          │  │
  │  │  · mushy stem base                 │  │
  │  │  · dark brown roots                │  │
  │  │                                    │  │
  │  │  TREATMENT                         │  │
  │  │  1. remove from pot immediately    │  │
  │  │  2. trim all black/mushy roots     │  │
  │  │  3. let roots dry 24 hours         │  │
  │  │  4. repot in fresh, well-draining  │  │
  │  │     mix                            │  │
  │  │  5. water sparingly for 2 weeks    │  │
  │  │                                    │  │
  │  │  ┌────────────────────────────┐    │  │
  │  │  │ find treatment supplies →  │    │  │  ← action button
  │  │  └────────────────────────────┘    │  │
  │  │                                    │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  └──────────────────────────────────┘    │
  └──────────────────────────────────────────┘
```

### 0.4 Visual Guide Artifact (with generated image)

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │     ┌────────────────────────┐           │
  │     │   canvas: watering_can │           │
  │     │   pixel formation      │           │
  │     └────────────────────────┘           │
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │                                    │  │
  │  │  WATERING GUIDE                    │  │
  │  │  Monstera Deliciosa                │  │
  │  │                                    │  │
  │  │  ┌────────────────────────────┐    │  │
  │  │  │                            │    │  │
  │  │  │   [generated image]        │    │  │  ← Imagen 4 Fast
  │  │  │   jet black bg             │    │  │     $0.02/image
  │  │  │   white line art           │    │  │     seamless on
  │  │  │   mono text labels         │    │  │     black bg
  │  │  │                            │    │  │
  │  │  └────────────────────────────┘    │  │
  │  │                                    │  │
  │  │  SCHEDULE                          │  │
  │  │  summer    every 5-7 days          │  │
  │  │  winter    every 10-14 days        │  │
  │  │  spring    every 7-10 days         │  │
  │  │                                    │  │
  │  │  stick your finger 2 inches into   │  │
  │  │  the soil. if it's dry, water      │  │
  │  │  thoroughly until it drains.       │  │
  │  │                                    │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  └──────────────────────────────────┘    │
  └──────────────────────────────────────────┘
```

### 0.5 Store List Artifact

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │     ┌────────────────────────┐           │
  │     │   pixel canvas shows   │           │
  │     │   list formation       │           │
  │     │   "1 2 3" as pixels    │           │
  │     └────────────────────────┘           │
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │                                    │  │
  │  │  STORES NEAR YOU                   │  │
  │  │  insecticidal soap                 │  │
  │  │                                    │  │
  │  │  ┌──────────────────────────────┐  │  │
  │  │  │ 1  SWANSONS NURSERY         │  │  │
  │  │  │    9701 15th Ave NW          │  │  │
  │  │  │    2.1 mi · likely in stock  │  │  │
  │  │  └──────────────────────────────┘  │  │
  │  │                                    │  │
  │  │  ┌──────────────────────────────┐  │  │
  │  │  │ 2  ACE HARDWARE              │  │  │
  │  │  │    600 N 34th St             │  │  │
  │  │  │    1.5 mi · garden section   │  │  │
  │  │  └──────────────────────────────┘  │  │
  │  │                                    │  │
  │  │  ┌──────────────────────────────┐  │  │
  │  │  │ 3  HOME DEPOT SODO          │  │  │
  │  │  │    2701 Utah Ave S           │  │  │
  │  │  │    4.8 mi · call ahead       │  │  │
  │  │  └──────────────────────────────┘  │  │
  │  │                                    │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  └──────────────────────────────────────────┘
```

### 0.6 Chat Response (Short → Pixel Text)

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │     ┌────────────────────────┐           │
  │     │                        │           │
  │     │    █···█·█████·████    │           │  ← pixel canvas
  │     │    █···█·█·····█··█    │           │     renders short
  │     │    █████·████··████    │           │     text AS PIXELS
  │     │    █···█·█·····█··█    │           │     (≤30 chars)
  │     │    █···█·█████·████    │           │
  │     │                        │           │
  │     │      "HAPPY"           │           │
  │     │                        │           │
  │     └────────────────────────┘           │
  │                                          │
  │  your monstera looks really healthy!     │  ← mono text below
  │  the aerial roots are a great sign.      │     for longer prose
  │                                          │
  └──────────────────────────────────────────┘
```

### 0.7 Live Call Mode

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │                                    │  │
  │  │                                    │  │
  │  │         PixelCanvas               │  │
  │  │         (full 80% viewport,       │  │  ← same as /dev/call
  │  │          orchid breathing,         │  │     identical UX
  │  │          morphs to formations)     │  │
  │  │                                    │  │
  │  │                                    │  │
  │  │                                    │  │
  │  │                                    │  │
  │  │                                    │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │       orchid is speaking...              │
  │                                          │
  │    [🎤 mute]  [📷 cam]  [✕ end]  0:42   │
  │                                          │
  │       2 of 3 voice turns remaining       │
  │                                          │
  └──────────────────────────────────────────┘
```

### 0.8 Limit Reached — Signup Nudge

```
  ┌──────────────────────────────────────────┐
  │                                          │
  │                                          │
  │           ┌────────────────────┐         │
  │           │                    │         │
  │           │    orchid pixel    │         │
  │           │    canvas morphs   │         │  ← QRMorphCanvas!
  │           │    into QR code    │         │     reuse existing
  │           │    for Telegram    │         │     morph engine
  │           │                    │         │
  │           └────────────────────┘         │
  │                                          │
  │      you've used your free turns.        │
  │                                          │
  │      want to keep going?                 │
  │      message me on telegram —            │
  │      i'll remember your plants,          │
  │      send care reminders, and            │  ← mono, warm
  │      we can chat anytime.                │
  │                                          │
  │      ┌──────────────────────────────┐    │
  │      │   open @orchidcare_bot  →    │    │  ← CTA button
  │      └──────────────────────────────┘    │
  │                                          │
  │      or scan the QR code above           │
  │                                          │
  └──────────────────────────────────────────┘
```

### 0.9 Data Flow

```
  CLIENT (browser)                    SERVER (edge functions)
  ═══════════════                     ══════════════════════

  User opens /demo
       │
       ▼
  Page renders:
  - PixelCanvas (orchid, breathing)
  - Input bar (text + photo + mic)
  - No auth needed
       │
  User types: "what's this plant?"
  + attaches photo
       │
       ▼
  POST /demo-agent
  {
    messages: [...],
    media: [{ type: "image/jpeg",
              data: "base64..." }],
    demoToken: null (first request)    ──────►  1. No token → new session
  }                                             2. Generate sessionId (UUID)
                                                3. turnsUsed = 1
                                                4. HMAC sign:
                                                   sig = HMAC-SHA256(
                                                     payload,
                                                     DEMO_HMAC_SECRET
                                                   )
                                                5. Call Gemini 3 Flash
                                                   - Orchestrator decides tool
                                                   - identify_plant → vision
                                                   - temp 1.0
                                                   - thoughtSignature handling
                                                6. Return structured artifact
       ◄──────────────────────────────────────
  {
    artifact: {
      type: "identification",
      data: {
        species: "Monstera deliciosa",
        commonName: "Swiss Cheese Plant",
        confidence: 0.94,
        family: "Araceae",
        origin: "Central America",
        care: {
          light: "bright indirect",
          water: "when top 2\" dry",
          humidity: "60%+",
          toxic: true
        }
      }
    },
    message: "your monstera looks healthy!...",
    pixelFormation: {
      type: "template",
      id: "monstera_deliciosa"
    },
    demoToken: "eyJzZXNz...signature"
  }
       │
       ▼
  1. Store demoToken in state
  2. PixelCanvas morphs to monstera
  3. Render IdentificationArtifact
  4. Update turn counter (4 remaining)
```

### 0.10 HMAC Token Flow

```
  TOKEN STRUCTURE
  ═══════════════

  Base64(JSON payload) + "." + HMAC-SHA256 signature

  Payload:
  {
    sid: "uuid-session-id",
    txt: 3,              ← text turns used
    vox: 1,              ← voice turns used
    img: 1,              ← images generated
    ts: 1708234567       ← created timestamp
  }

  Encoding: base64url(payload) + "." + hex(hmac_sha256(payload, secret))
  Example:  "eyJzaWQiOiIxMjM0..."  +  "."  +  "a1b2c3d4e5..."


  FLOW
  ════

  Request 1 (no token):
    Client: { demoToken: null }
    Server: creates sid, txt=1, signs → returns token

  Request 2:
    Client: { demoToken: "eyJ...sig" }
    Server: verify sig, check txt<5, process, txt=2, re-sign

  Request 5:
    Client: { demoToken: "eyJ...sig" }
    Server: verify sig, txt=5 → ACCEPT (last turn)
    Response includes: limitReached: true

  Request 6:
    Client: { demoToken: "eyJ...sig" }
    Server: verify sig, txt=5 already → REJECT
    { error: "limit_reached", signupUrl: "https://t.me/orchidcare_bot" }


  TAMPER RESISTANCE
  ═════════════════

  If client modifies payload:  sig won't match → 401
  If client replays old token: txt only goes up → stale
  If client clears storage:   new session, fresh 5 turns
    (acceptable — they lose conversation history)
```

---

## 1. Overview

**Route**: `/demo` (linked from `/get-demo` in landing hero)
**Auth**: None required
**Limits**: 5 text turns + 3 voice turns + 3 generated images per session
**Model**: Gemini 3 Flash Preview (temp 1.0, thinking_level: low)
**Image gen**: Imagen 4 Fast via Vertex AI ($0.02/image) OR `gemini-2.5-flash-image` via Lovable gateway ($0.039/image) — depends on gateway availability
**Style**: Black background, monospace/Press Start 2P, same aesthetic as full app

The demo is NOT a lesser experience. Same intelligence, same pixel canvas,
same artifact quality. Just time-limited.

---

## 2. Architecture

```
  ┌─────────────────────────────────────────────┐
  │  /demo page (React)                          │
  │                                              │
  │  PixelCanvas (40% viewport, breathing)       │
  │  ArtifactStack (scrollable response area)    │
  │  InputBar (text + photo + mic)               │
  │  TurnCounter (X of 5 remaining)              │
  │                                              │
  │  State:                                      │
  │  - demoToken (HMAC signed, in React state)   │
  │  - artifacts[] (rendered responses)           │
  │  - currentFormation (pixel canvas target)     │
  │  - isVoiceMode (live call active)             │
  └──────────────────┬──────────────────────────┘
                     │
                     │ POST /demo-agent
                     │ { messages, media?, demoToken }
                     ▼
  ┌─────────────────────────────────────────────┐
  │  demo-agent (Supabase edge function)         │
  │                                              │
  │  1. Validate/create HMAC token               │
  │  2. Check turn limits                        │
  │  3. Call Gemini 3 Flash orchestrator          │
  │     - Tools: identify, diagnose, research,   │
  │       find_stores, generate_guide             │
  │     - temp 1.0, thinking_level: low          │
  │     - response_format: json_object           │
  │  4. Execute tool calls                       │
  │  5. Return structured artifact + new token   │
  └─────────────────────────────────────────────┘
```

---

## 3. HMAC Token System

### Token Structure

```typescript
interface DemoTokenPayload {
  sid: string;    // Session UUID
  txt: number;    // Text turns used
  vox: number;    // Voice turns used
  img: number;    // Images generated
  ts: number;     // Created timestamp (epoch seconds)
}
```

### Server-Side Implementation

```typescript
const DEMO_HMAC_SECRET = Deno.env.get("DEMO_HMAC_SECRET")!;
const MAX_TEXT_TURNS = 5;
const MAX_VOICE_TURNS = 3;
const MAX_IMAGES = 3;
const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours

async function signToken(payload: DemoTokenPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(DEMO_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(b64));
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${b64}.${sigHex}`;
}

async function verifyToken(token: string): Promise<DemoTokenPayload | null> {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(DEMO_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  // Constant-time comparison via crypto.subtle.verify
  const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(b64));
  if (!isValid) return null;  // Tampered

  const payload: DemoTokenPayload = JSON.parse(atob(b64));

  // Check session age (24h expiry)
  if (Date.now() / 1000 - payload.ts > SESSION_MAX_AGE_SECONDS) return null;

  return payload;
}
```

### Limits

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Text turns | 5 | `payload.txt < MAX_TEXT_TURNS` |
| Voice turns | 3 | `payload.vox < MAX_VOICE_TURNS` |
| Generated images | 3 | `payload.img < MAX_IMAGES` |
| Session age | 24 hours | `Date.now()/1000 - payload.ts < 86400` |

---

## 4. Demo Agent (Edge Function)

### Rewrite of `supabase/functions/demo-agent/index.ts`

The current demo agent is basic. The rewrite:
- Adds HMAC token validation
- Returns structured artifacts (not just text)
- Uses `response_format: { type: "json_object" }` for reliable parsing
- Handles Gemini 3 Flash thought signatures correctly
- Adds image generation via separate model
- Temp 1.0 on all Gemini 3 calls

### System Prompt

```
You are Orchid, an expert botanist and plant care companion.

PERSONALITY: Warm, knowledgeable, conversational. You speak like a
plant-loving friend who happens to have a botany degree. Concise —
this is a chat, not an essay. 1-2 emoji max per message.

RESPONSE FORMAT: You MUST return valid JSON with this structure:
{
  "artifact": {
    "type": "identification" | "diagnosis" | "care_guide" |
            "store_list" | "visual_guide" | "chat",
    "data": { ... type-specific structured data }
  },
  "message": "natural language response (2-3 sentences max)",
  "pixelFormation": {
    "type": "template" | "text",
    "id": "species_name or tool_name",
    "text": "SHORT TEXT"
  } | null
}

ARTIFACT TYPES:

"identification" → when user sends a photo to identify:
  data: { species, commonName, confidence, family, origin,
          care: { light, water, humidity, toxic } }

"diagnosis" → when user describes/shows a problem:
  data: { issue, severity, symptoms: [], treatment: [],
          prevention }

"care_guide" → when user asks about care:
  data: { topic, plant, schedule: { season: frequency },
          howTo, troubleshooting: [] }

"store_list" → when user asks where to buy:
  data: { product, stores: [{ name, address, distance, note }] }

"visual_guide" → when a generated image would help:
  data: { title, steps: [{ instruction, imagePrompt }] }
  (imagePrompt is what will be sent to the image generation model)

"chat" → for conversational responses that don't need a card:
  data: { text }

PIXEL FORMATION: For each response, suggest what the pixel canvas
should show. Use template IDs from the asset library (plant species
or tool names). For short text, use type: "text".

RULES:
- Always choose the most specific artifact type that fits
- Don't return "chat" if a structured artifact would be better
- Keep "message" brief — the artifact carries the detail
- For photos: always return "identification" or "diagnosis"
- For "how do I...": return "care_guide" or "visual_guide"
- For "where can I buy...": return "store_list"
```

### Tool Declarations

```typescript
const demoTools = [
  {
    type: "function",
    function: {
      name: "identify_plant",
      description: "Identify plant species from the user's photo",
      parameters: {
        type: "object",
        properties: {
          context: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "diagnose_plant",
      description: "Diagnose health issues from the user's photo",
      parameters: {
        type: "object",
        properties: {
          symptoms: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research",
      description: "Search the web for plant care information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_stores",
      description: "Find local stores selling plant supplies",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string" },
          location: { type: "string" },
        },
        required: ["product"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an educational botanical illustration",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "What to illustrate" },
          title: { type: "string", description: "Title for the guide" },
        },
        required: ["prompt"],
      },
    },
  },
];
```

### Orchestrator Call

```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: aiMessages,
    tools: demoTools,
    tool_choice: "auto",
    response_format: { type: "json_object" },
    thinking_config: { thinking_level: "low" },
    temperature: 1.0,
  }),
});

const data = await response.json();
const message = data.choices?.[0]?.message;

// Extract thought signature for Gemini 3 function calling validation
// Preserve raw tool_calls array (includes extra_content.google.thought_signature)
const toolCalls = message?.tool_calls || null;
```

### Tool Result Flow

When tool calls are present, execute them and send results back:

```typescript
// Execute tool
const toolResult = await executeDemoTool(toolName, toolArgs, ...);

// Build follow-up messages — preserve raw tool_calls for thought signatures
aiMessages.push(
  {
    role: "assistant",
    content: message.content || null,
    tool_calls: toolCalls,  // Raw array with extra_content intact
  },
  {
    role: "tool",
    tool_call_id: toolCall.id,
    content: JSON.stringify(toolResult),
  },
);

// Call orchestrator again with tool results
const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: aiMessages,
    response_format: { type: "json_object" },
    thinking_config: { thinking_level: "low" },
    temperature: 1.0,
  }),
});
```

### Response Format to Client

```typescript
interface DemoResponse {
  artifact: {
    type: 'identification' | 'diagnosis' | 'care_guide' |
          'store_list' | 'visual_guide' | 'chat';
    data: Record<string, unknown>;
  };
  message: string;
  pixelFormation: {
    type: 'template' | 'text';
    id?: string;
    text?: string;
  } | null;
  demoToken: string;           // Updated HMAC token
  turnsRemaining: {
    text: number;
    voice: number;
    images: number;
  };
  limitReached?: boolean;      // True when this was the last turn
  images?: {                   // Present when generate_image was called
    url: string;               // Public URL of generated image
    title: string;
  }[];
}
```

---

## 5. Artifact System (Generative UI)

### Artifact Components

Each artifact type maps to a React component:

| Artifact Type | Component | Pixel Formation |
|---------------|-----------|-----------------|
| `identification` | `<IdentificationCard>` | template: species ID |
| `diagnosis` | `<DiagnosisCard>` | text: issue name |
| `care_guide` | `<CareGuideCard>` | template: related tool |
| `store_list` | `<StoreListCard>` | list formation |
| `visual_guide` | `<VisualGuideCard>` | template: related tool |
| `chat` | `<ChatResponse>` | text (if short) or orchid |

### Styling Rules (All Artifacts)

```css
/* All artifact cards */
background: #000;
border: 1px solid rgba(255, 255, 255, 0.1);
font-family: ui-monospace, monospace;
color: rgba(255, 255, 255, 0.85);

/* Headings */
font-family: 'Press Start 2P', monospace;
font-size: 11px;
text-transform: uppercase;
letter-spacing: 0.08em;
color: #fff;

/* Body text */
font-family: ui-monospace, monospace;
font-size: 12px;
line-height: 1.6;
color: rgba(255, 255, 255, 0.7);

/* Key-value pairs */
display: grid;
grid-template-columns: auto 1fr;
gap: 4px 16px;
font-size: 11px;

/* Severity colors (border-left accent only) */
mild: rgba(255, 255, 255, 0.3)
moderate: rgba(255, 200, 50, 0.6)
severe: rgba(255, 80, 80, 0.6)
```

### Animation

Artifacts slide up from the bottom via framer-motion:
```typescript
<motion.div
  initial={{ y: 40, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
>
```

Previous artifacts scroll up and dim (opacity 0.4) as new ones appear.

---

## 6. Image Generation

### Model Decision

**Primary**: Try `gemini-2.5-flash-image` via Lovable gateway (already works for the project)
**Fallback**: If not available, use Vertex AI `imagen-4.0-fast-generate-001` directly

Check: the orchid-agent already uses `google/gemini-3-pro-image-preview` via the gateway
with `modalities: ["image", "text"]`. The same pattern should work with `gemini-2.5-flash-image`.

### Request Format (via Lovable gateway)

```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-image-preview",  // Cheaper than 3-pro-image
    messages: [{ role: "user", content: imagePrompt }],
    modalities: ["image", "text"],
  }),
});

// Response: choices[0].message.images[0].image_url.url = "data:image/png;base64,..."
```

### Style Prompt Template

```
Create a botanical illustration for: "{title}"

{specific_instruction}

MANDATORY STYLE:
- Pure black background (#000000), no exceptions
- White and light gray line art only
- All text labels in monospace pixel font style
- Clean, minimal, educational
- No colored backgrounds, no gradients
- Annotations in white text with thin white arrows
- Consistent with a brutalist, monochrome aesthetic
```

### Storage

Images are stored in `generated-guides` Supabase bucket (already exists, public read).
URL is returned to the client for display in the artifact card.

---

## 7. Live Voice Demo

### Quick Mode Only

The demo uses Quick mode (client-side ephemeral token, no edge function session).
No tools during voice — pure audio conversation.

### Turn Tracking

Each call connection = 1 voice turn (regardless of duration).
The HMAC token's `vox` field is incremented client-side before starting
(optimistic) and verified server-side on next text request.

### Duration Limit

Max 2 minutes per voice turn. Auto-disconnect with a friendly message:
"that was fun! type a question to keep going, or message me on telegram
for unlimited calls."

### Implementation

Reuse the existing `useGeminiLive` hook and `PixelCanvas` component.
The demo page switches between text mode and voice mode.

---

## 8. Frontend Components

### File Structure

```
src/
├── pages/
│   └── DemoPage.tsx              # Main demo page
├── components/
│   └── demo/
│       ├── DemoInputBar.tsx      # Text + photo + mic input
│       ├── DemoArtifactStack.tsx  # Scrollable response area
│       ├── DemoTurnCounter.tsx    # "4 of 5 turns remaining"
│       ├── DemoLimitScreen.tsx    # Signup nudge + QR morph
│       ├── artifacts/
│       │   ├── IdentificationCard.tsx
│       │   ├── DiagnosisCard.tsx
│       │   ├── CareGuideCard.tsx
│       │   ├── StoreListCard.tsx
│       │   ├── VisualGuideCard.tsx
│       │   └── ChatResponse.tsx
│       └── DemoVoiceOverlay.tsx  # Full-screen voice call mode
```

### DemoPage.tsx — State Machine

```typescript
type DemoMode = 'text' | 'voice' | 'limit_reached';

interface DemoState {
  mode: DemoMode;
  demoToken: string | null;
  artifacts: Artifact[];
  currentFormation: Formation | null;
  isLoading: boolean;
  turnsRemaining: { text: number; voice: number; images: number };
}
```

### DemoInputBar.tsx

```
  ┌──────────────────────────────────────────┐
  │ what's wrong with my monstera?     📷 🎤 │
  └──────────────────────────────────────────┘

  - Text input: submit on Enter
  - 📷 button: opens file picker or camera
  - 🎤 button: switches to voice mode (DemoVoiceOverlay)
  - Disabled state while loading (shows pulsing dots)
  - Disabled when limit reached
```

### Artifact Rendering Decision

```typescript
function renderArtifact(response: DemoResponse): JSX.Element {
  // 1. Always update pixel canvas
  if (response.pixelFormation) {
    setCurrentFormation(response.pixelFormation);
  }

  // 2. Render appropriate artifact component
  switch (response.artifact.type) {
    case 'identification':
      return <IdentificationCard data={response.artifact.data} message={response.message} />;
    case 'diagnosis':
      return <DiagnosisCard data={response.artifact.data} message={response.message} />;
    case 'care_guide':
      return <CareGuideCard data={response.artifact.data} message={response.message} />;
    case 'store_list':
      return <StoreListCard data={response.artifact.data} message={response.message} />;
    case 'visual_guide':
      return <VisualGuideCard data={response.artifact.data} images={response.images} message={response.message} />;
    case 'chat':
      return <ChatResponse text={response.message} />;
  }
}
```

---

## 9. Rate Limiting

### IP-Based Backstop

Even with HMAC tokens, someone could script new sessions. Add IP-based
rate limiting as a backstop.

**Option A: Lightweight table**

```sql
CREATE TABLE demo_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  sessions_today INTEGER DEFAULT 0,
  last_reset DATE DEFAULT CURRENT_DATE
);

-- On each new session:
-- If last_reset < today → reset sessions_today = 0
-- If sessions_today >= 10 → reject
-- Else → sessions_today += 1
```

**Option B: Edge function header check (no table)**

Use a simple in-memory approach with Deno's `Deno.env` or just trust
the HMAC token approach. The HMAC token prevents turn count tampering;
clearing localStorage to get a new session is acceptable (they lose
conversation context).

**Recommended**: Option B for now. The HMAC token is the primary defense.
IP rate limiting can be added later if abuse is observed.

---

## 10. Implementation Tasks

### Task 1: Create DemoPage route and shell

**Files:**
- Create `src/pages/DemoPage.tsx` — page shell with state machine
- Modify `src/App.tsx` — add `/demo` route
- Modify `src/components/landing/orchid-hero.tsx` — wire `/get-demo` click

**Details:**
- DemoPage renders PixelCanvas (40% viewport), ArtifactStack, InputBar, TurnCounter
- State: mode (text/voice/limit_reached), artifacts[], demoToken, turnsRemaining
- PixelCanvas reuses existing component with `formation` prop
- Sticky input bar at bottom with text, photo, and mic buttons
- Full black background, monospace typography

### Task 2: Rewrite demo-agent edge function

**Files:**
- Rewrite `supabase/functions/demo-agent/index.ts`

**Details:**
- HMAC token creation/validation (using Web Crypto API)
- Environment variable: `DEMO_HMAC_SECRET`
- Orchestrator: Gemini 3 Flash (`google/gemini-3-flash-preview`), temp 1.0
- `response_format: { type: "json_object" }` for structured artifacts
- Tool execution: identify (vision), diagnose (vision), research (Perplexity), find_stores (Maps), generate_image
- Thought signature handling: preserve raw `tool_calls` array from response
- Tool loop: max 3 iterations
- Return structured `DemoResponse` with artifact, message, pixelFormation, token
- Turn counting: increment `txt` on text requests, `vox` on voice token requests
- Limit enforcement: reject when turns exhausted

### Task 3: Create artifact components

**Files:**
- Create `src/components/demo/artifacts/IdentificationCard.tsx`
- Create `src/components/demo/artifacts/DiagnosisCard.tsx`
- Create `src/components/demo/artifacts/CareGuideCard.tsx`
- Create `src/components/demo/artifacts/StoreListCard.tsx`
- Create `src/components/demo/artifacts/VisualGuideCard.tsx`
- Create `src/components/demo/artifacts/ChatResponse.tsx`

**Details:**
- All components: black bg, mono font, Press Start 2P for headings
- Inline styles (not Tailwind) to match existing call screen patterns
- IdentificationCard: species name, confidence bar, key-value grid, prose
- DiagnosisCard: severity badge with left-border color, symptoms list, treatment steps, action button
- CareGuideCard: schedule table (season → frequency), how-to text, troubleshooting list
- StoreListCard: numbered store cards with name, address, distance, note
- VisualGuideCard: title, generated image(s) (seamless on black), step text
- ChatResponse: just mono text, or pixel text on canvas if ≤30 chars
- All animate in via framer-motion (slide up from bottom)

### Task 4: Create DemoInputBar and supporting UI

**Files:**
- Create `src/components/demo/DemoInputBar.tsx`
- Create `src/components/demo/DemoArtifactStack.tsx`
- Create `src/components/demo/DemoTurnCounter.tsx`

**Details:**
- DemoInputBar: text input + photo button (file picker) + mic button
  - Submit on Enter, disabled while loading
  - Photo: opens camera/file picker, converts to base64
  - Mic: transitions to voice mode
  - Styling: same input style as DevCallPage config screen
- DemoArtifactStack: scrollable container, latest artifact on top
  - Previous artifacts dim to 0.4 opacity
  - framer-motion AnimatePresence for enter/exit
- DemoTurnCounter: "4 of 5 turns remaining" in small mono text
  - Subtle, not prominent — just informational
  - Changes color as turns decrease (white → yellow → red at 1)

### Task 5: Create DemoLimitScreen and voice overlay

**Files:**
- Create `src/components/demo/DemoLimitScreen.tsx`
- Create `src/components/demo/DemoVoiceOverlay.tsx`

**Details:**
- DemoLimitScreen: shown when all turns exhausted
  - PixelCanvas morphs orchid → QR code (reuse QRMorphCanvas engine)
  - "you've used your free turns" message
  - CTA button: "open @orchidcare_bot →"
  - "or scan the QR code above" text
  - Deep link: `https://t.me/orchidcare_bot?start=demo`
- DemoVoiceOverlay: full-screen voice call overlay
  - Identical to CallScreen but with turn counter overlay
  - Uses useGeminiLive hook in Quick mode (client-side token)
  - Auto-disconnect after 2 minutes
  - On end: return to text mode, increment `vox` in token

### Task 6: Add image generation to demo-agent

**Files:**
- Modify `supabase/functions/demo-agent/index.ts` (add generate_image handler)

**Details:**
- Image gen model: try `google/gemini-2.5-flash-image-preview` via Lovable gateway
  - If not available, fall back to Vertex AI `imagen-4.0-fast-generate-001`
- Style prompt: jet black bg, white line art, mono labels, no color
- Save to `generated-guides` bucket, return public URL
- Increment `img` count in token
- Check `img < MAX_IMAGES` before generating

### Task 7: Wire everything together and test

**Files:**
- Update DemoPage.tsx — full request/response flow
- Verify artifact rendering with real API responses
- Test turn limits (5 text, 3 voice, 3 images)
- Test HMAC token tamper resistance
- Test photo upload → identification flow
- Test voice mode → auto-disconnect
- Test limit reached → QR morph signup nudge

### Task 8: Review all implementation

**Files:**
- Read every new file
- Verify types consistency
- Verify HMAC implementation security
- Verify no memory leaks in PixelCanvas integration
- Run `npm run build` for compile check
- Run `npx tsc --noEmit` for type check
- Test on mobile viewport (390×844)

---

## Appendix A: Gemini 3 Flash API Notes

### Temperature

**Must be 1.0.** Lower temperatures cause infinite reasoning loops and
degraded performance. This is a known Gemini 3 constraint.

### Thought Signatures

Required for function calling. The signature lives in:
```
response.choices[0].message.tool_calls[i].extra_content.google.thought_signature
```

When sending the assistant message back for follow-up calls, preserve the
entire `tool_calls` array as-is (including `extra_content`). Do NOT extract
the signature separately.

### Structured Output

`response_format: { type: "json_object" }` works through the OpenAI-compatible
gateway. The model returns valid JSON when this is set.

### Known Bugs

- Parallel tool calls may have inconsistent thought signatures (first call
  gets a signature, subsequent calls may not). Workaround: limit to
  sequential single tool calls, or fall back to Gemini 2.5 Flash.
- Streaming responses have missing `tool_calls[].index` field.

## Appendix B: Imagen 4 Fast Notes

### Availability

- Vertex AI: `imagen-4.0-fast-generate-001` (native predict endpoint)
- Together AI: available
- OpenRouter: not confirmed
- Lovable gateway: not confirmed — use `gemini-2.5-flash-image-preview` instead

### Pricing

- Imagen 4 Fast: $0.02/image
- Gemini 2.5 Flash Image: $0.039/image
- Gemini 3 Pro Image: $0.24/image (4K)

For the demo, either Imagen 4 Fast or Gemini 2.5 Flash Image works.
Prefer whatever is available through the Lovable gateway to keep the
auth pattern consistent.

---

## Appendix C: Review Fixes (Post-Debate)

Issues from the critical review, with resolutions:

### Fixed in Spec

1. **`signToken`/`verifyToken` now `async`** — return `Promise<string>` and
   `Promise<DemoTokenPayload | null>`. [Section 3]
2. **HMAC comparison uses `crypto.subtle.verify()`** — constant-time, no
   timing attack. [Section 3]
3. **Session expiry (24h) implemented** — `verifyToken` checks `ts` field. [Section 3]
4. **`thinking_config: { thinking_level: "low" }` added to all code samples** —
   orchestrator call AND follow-up call. [Section 4]
5. **DemoChatOverlay archived** — renamed to `.ARCHIVED.tsx`, all imports
   commented out, comment added explaining replacement. [External change]

### Implementation Requirements (Addressed in Tasks)

6. **Error state in DemoPage state machine** — add `error` state.
   ```typescript
   type DemoMode = 'text' | 'voice' | 'limit_reached' | 'error';
   ```
   On API failure: show error toast, allow retry. Don't consume a turn.

7. **JSON parse fallback** — wrap `JSON.parse` of LLM content in try/catch.
   Fall back to regex extraction (`/\{[\s\S]*\}/`), then to `{ type: "chat", data: { text: rawContent } }`.

8. **Photo compression before base64** — client-side resize to max 1536px
   longest edge, 80% JPEG quality (matching orchid-agent's pattern).
   ```typescript
   // In DemoInputBar before sending
   const compressed = await compressImage(file, 1536, 0.8);
   const base64 = await toBase64(compressed);
   ```

9. **Conversation history limit** — only send last 3 turns (6 messages) to
   the edge function. Drop older messages and images to keep payload under 2MB.

10. **Responsive canvas size**:
    ```
    Small screens (≤667px):  30% viewport height
    Medium screens (≤844px): 35% viewport height
    Large screens (>844px):  40% viewport height
    ```

11. **Loading state** — set `isThinking={true}` on PixelCanvas while API
    request is in flight. Pixels drift/dissociate during loading.

12. **Safe area handling** — input bar uses `padding-bottom: env(safe-area-inset-bottom)`.

13. **Photo capture attribute** — `<input type="file" accept="image/*" capture="environment">`.

14. **Voice disconnect spoken** — before auto-disconnect at 2 min, Orchid says
    "that was fun! you can type a question to keep going." via `sendClientContent`.

15. **Rate limiting** — implement IP-hash based session caps (max 10 sessions/day/IP).
    Use `demo_rate_limits` table per Option A in Section 9.

16. **Artifact scroll direction** — newest at bottom (chat-style), auto-scroll down.
    Previous artifacts remain visible above, dimmed to 0.4. This matches natural
    reading order with bottom-anchored input.

17. **Voice model personality note** — voice demo uses `gemini-2.5-flash-native-audio`
    (different model from text's `gemini-3-flash`). The system prompt for both should
    be identical to minimize personality drift. Accept that voice model is slightly
    less capable — this is a Live API constraint.

18. **`find_stores` in demo mode** — use the Maps shopping agent via Lovable gateway
    (same as orchid-agent). Requires user location — prompt for it if not provided.
    Falls back to generic suggestions if Maps fails.

### Accepted Risks

19. **Voice turn tracking is client-side only** — acceptable for a demo site
    with limited traffic. Not worth the complexity of a voice token endpoint.
20. **Clearing localStorage gives fresh turns** — acceptable (user loses history).
21. **CORS `*`** — standard for Supabase edge functions, mitigated by rate limiting.

# Orchid — Technical Diagrams Collection

This document contains a collection of Mermaid and ASCII diagrams illustrating critical architectural flows, data models, and user journeys within the Orchid application.

## 1. User Journey (Entry to First Value)

This diagram illustrates the multiple entry points into the Orchid ecosystem and the path a user takes to reach their "first value" — typically a successful plant identification, diagnosis, or care advice.

```mermaid
stateDiagram-v2
    state "Landing Page" as Landing
    state "Telegram Bot" as Telegram
    state "PWA / Web App" as PWA

    [*] --> Landing
    [*] --> Telegram
    [*] --> PWA

    state Landing {
        [*] --> Hero
        Hero --> Demo_Flow: Click "Try Demo"
        Hero --> Auth_Flow: Click "Login" / "Begin"

        state Demo_Flow {
            [*] --> DemoPage
            DemoPage --> First_Interaction: Upload Photo / Ask Q
            First_Interaction --> First_Value: Receive ID/Diagnosis
            First_Value --> Call_To_Action: "Save your progress"
        }
    }

    state Telegram {
        [*] --> Start_Command: /start
        Start_Command --> Onboarding_Questions: Name, Exp, Pets
        Onboarding_Questions --> Profile_Created
        Profile_Created --> TG_Menu: "How can I help?"
        TG_Menu --> TG_Interaction: Send Photo / Text
        TG_Interaction --> First_Value
    }

    state PWA {
        [*] --> Check_Session
        Check_Session --> Login_Page: No Session
        Check_Session --> Dashboard: Valid Session

        state Login_Page {
            [*] --> Magic_Link_Request
            Magic_Link_Request --> Email_Sent
            Email_Sent --> Auth_Confirmed: Click Link
        }

        Auth_Confirmed --> New_User_Check
        New_User_Check --> Onboarding_Flow: New Profile
        New_User_Check --> Dashboard: Existing Profile

        Onboarding_Flow --> Dashboard

        state Dashboard {
            [*] --> Home_Tab
            Home_Tab --> PWA_Interaction: Click "Identify" / "Ask"
            PWA_Interaction --> First_Value
        }
    }

    First_Value --> Retention_Loop: Save Plant / Set Reminder
```

## 2. Data Flow Architecture

This high-level diagram shows how data moves between the client interfaces, the Supabase backend (Edge Functions + Database), and the external AI services.

```mermaid
flowchart TD
    subgraph Clients ["Client Layer"]
        TG[Telegram Bot]
        PWA[PWA / Web App]
        Voice[Voice Call UI]
        Dev[External Developer]
    end

    subgraph Edge ["Supabase Edge Layer"]
        TB_Fn[telegram-bot]
        PA_Fn[pwa-agent]
        CS_Fn[call-session]
        API_Fn[api (REST)]
        OA_Fn[orchid-agent (Core Logic)]
    end

    subgraph Data ["Data Layer (PostgreSQL)"]
        Profiles[(profiles)]
        Plants[(plants)]
        History[(conversations)]
        Memory[(user_insights)]
        Vector[(plant_identifications)]
    end

    subgraph AI ["AI Services Layer"]
        Gateway[Lovable AI Gateway]
        Gemini[Google Gemini 3 Flash/Pro]
        Live[Gemini Live API (WebSocket)]
        Sonar[Perplexity Sonar]
    end

    %% Client -> Edge
    TG -->|Webhook| TB_Fn
    PWA -->|HTTPS| PA_Fn
    Dev -->|HTTPS + Key| API_Fn
    Voice -->|WebSocket| Live
    Voice -->|HTTPS| CS_Fn

    %% Edge -> Core
    TB_Fn -->|Internal Call| OA_Fn
    PA_Fn -->|Internal Call| OA_Fn
    API_Fn -->|Internal Call| OA_Fn
    CS_Fn -->|Tool Execution| OA_Fn

    %% Core -> Data
    OA_Fn -->|Read Context| Profiles & Plants & History & Memory & Vector
    OA_Fn -->|Write| History & Memory & Plants

    %% Core -> AI
    OA_Fn -->|Chat Completion| Gateway
    Gateway --> Gemini
    OA_Fn -->|Research| Sonar

    %% Live Voice Special Path
    Live <-->|Audio Stream| Voice
    Live -->|Tool Call| CS_Fn
```

## 3. Semantic & Visual Memory Architecture

### 3.1 Hierarchical Memory Layers (ASCII)

Orchid uses a tiered memory system to balance context window usage with long-term recall.

```ascii
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1: Immediate Context (last 5 messages)                         │
│  conversations ← most recent 5 rows, DESC order                     │
│  "What did you just say?"                                           │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 2: Compressed History (last 3 summaries)                       │
│  conversation_summaries ← up to 3, ordered by end_time DESC         │
│  "What did we talk about last week?"                                │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 3: Semantic Facts (User Insights)                              │
│  user_insights ← all rows for profileId                             │
│  "I have a cat", "I live in a dry climate", "I prefer brief answers"│
├─────────────────────────────────────────────────────────────────────┤
│  TIER 4: Visual Memory (Recent Identifications)                      │
│  plant_identifications ← last 5, created within 24h                 │
│  "This is the Monstera I showed you earlier today"                  │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 5: Care Schedule (Active Reminders)                            │
│  reminders ← active only, ordered by next_due ASC, limit 10         │
│  "What do I need to water today?"                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Memory Retrieval Sequence

This sequence details how the `orchid-agent` rebuilds context for every turn.

```mermaid
sequenceDiagram
    participant Agent as orchid-agent
    participant DB as PostgreSQL
    participant LLM as Gemini 3

    Note over Agent: Request received (Message M)

    rect rgb(240, 248, 255)
        Note right of Agent: Parallel Context Loading (loadHierarchicalContext)
        par Fetch Recent Chat
            Agent->>DB: SELECT conversations (Limit 5)
        and Fetch Summaries
            Agent->>DB: SELECT conversation_summaries (Limit 3)
        and Fetch User Insights
            Agent->>DB: SELECT user_insights (All)
        and Fetch Visual Memory
            Agent->>DB: SELECT plant_identifications (Last 24h)
        and Fetch Reminders
            Agent->>DB: SELECT reminders (Active, Limit 10)
        end

        DB-->>Agent: Returns 5 datasets
    end

    Agent->>Agent: buildEnrichedSystemPrompt()<br/>(Combine Core Persona + User Facts + History + Context)

    Agent->>LLM: Chat Completion (System Prompt + Message M)
    LLM-->>Agent: Response (with Tool Calls if needed)

    opt Tool Execution (e.g., Save Insight)
        Agent->>DB: INSERT user_insights
        Agent->>LLM: Tool Result
        LLM-->>Agent: Final Response
    end

    Agent->>DB: INSERT conversations (Store Interaction)
```

## 4. Live Call Architecture

### 4.1 Audio/Video Pipeline (ASCII)

The live call system bypasses the standard HTTP request/response cycle, establishing a direct WebSocket connection between the client browser and Google's Gemini Live API, with the Supabase Edge Function acting only as an authenticator and tool execution proxy.

```ascii
[ User Environment ]                   [ Supabase Edge ]                [ Google Cloud ]

   Microphone                                                          Gemini Live API
       │                                                                  (Server)
       ▼                                                                     ▲
[ Web Audio API ]                                                            │
(16kHz PCM Node) ──────────────────► [ WebSocket ] ──────────────────────► [ Model ]
       │                             (Client Side)                           │
       │                                   ▲                                 │
       │                                   │                                 │
   [ Speaker ] ◄───────────────────────────┘                                 │
(24kHz PCM Player)                                                           │
                                                                             │
   [ Camera ]                                                                │
       │                                                                     │
       ▼                                                                     │
 [ Video Element ] ──► [ Canvas ] ──► [ Base64 JPEG ] ───────────────────────┘
                                           ▲
                                           │
                                    (Tool Execution)
                                           │
                                           ▼
                                    [ call-session ] ◄───► [ Database ]
                                    (Edge Function)
```

### 4.2 Call Lifecycle Sequence

```mermaid
sequenceDiagram
    participant Client as Browser (useGeminiLive hook)
    participant CS as call-session (Edge Fn)
    participant GL as Gemini Live WebSocket
    participant OA as orchid-agent
    participant SC as summarise-call

    Client->>CS: POST /create (JWT)
    CS-->>Client: { sessionId }
    Client->>CS: POST /token (JWT + sessionId)
    CS->>CS: loadHierarchicalContext()<br/>buildVoiceSystemPrompt()
    CS->>GL: genai.authTokens.create() [10s timeout]
    GL-->>CS: ephemeralToken
    CS->>CS: UPDATE call_sessions SET status=active
    CS-->>Client: { token }
    Client->>GL: WebSocket connect (ephemeral token)
    loop Audio stream
        Client->>GL: PCM audio chunks
        GL-->>Client: Audio response + tool_calls
        Client->>CS: POST /tools (tool call dispatch)
        CS->>OA: Tool execution
        OA-->>CS: Tool result
        CS-->>Client: Tool result
        Client->>GL: Tool result
    end
    Client->>CS: POST /end (transcript + duration)
    CS->>CS: INSERT conversations (channel=voice)
    CS->>CS: generateSummary + extractInsights (parallel)
    Client->>SC: POST /summarise-call (audio blobs)
    SC->>GL: Gemini audio → summary (3 retries)
    SC->>CS: UPDATE call_sessions.summary
    SC->>CS: INSERT conversation_summaries
```

## 5. REST API Flow

This diagram illustrates how third-party developers interact with the Orchid platform via the public REST API.

```mermaid
sequenceDiagram
    participant Dev as Developer Client
    participant API as api (Edge Fn)
    participant DB as PostgreSQL
    participant Agent as orchid-agent

    Dev->>API: POST /api (Authorization: Bearer orch_...)

    Note over API: 1. Authentication
    API->>API: hashApiKey(orch_...)
    API->>DB: SELECT developer_api_keys WHERE hash = ?
    alt Invalid Key
        DB-->>API: null
        API-->>Dev: 401 Unauthorized
    end

    Note over API: 2. Rate Limiting
    API->>DB: SELECT COUNT(*) FROM api_usage_log (Last 1 min)
    alt Over Limit
        DB-->>API: > limit
        API-->>Dev: 429 Too Many Requests
    end

    Note over API: 3. Proxy to Agent
    API->>Agent: POST /orchid-agent (Internal Call)
    Agent->>DB: Load Context & Execute Tools
    Agent-->>API: Response JSON

    Note over API: 4. Logging
    API->>DB: INSERT api_usage_log (status=success, latency=ms)
    API->>DB: UPDATE developer_api_keys (total_calls + 1)

    API-->>Dev: 200 OK { success: true, data: ... }
```

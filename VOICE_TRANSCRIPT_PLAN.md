# Voice Call Transcript Capture — Implementation Plan

## Implementation Status: COMPLETE (with post-deploy fixes)

All phases implemented and pushed. Two post-deploy bugs found and fixed:

### Bug 1: 1008 disconnect from token config
- `inputAudioTranscription`/`outputAudioTranscription` in the ephemeral token causes 1008 on BidiGenerateContentConstrained — same pattern as `thinkingConfig` and `contextWindowCompression`
- **Fix (commit db3ceaf):** Commented out transcription config from token, moved it to client-side `ai.live.connect()` config in `useGeminiLive.ts:280-290` with `as any` cast (types may not include it yet)
- Transcription events were flowing BEFORE the 1008, confirming the feature works — the constrained endpoint just rejects the config eventually

### Bug 2: Transcript wiped on reconnect → transcriptTurns=0
- When 1008 triggered reconnect, `connect()` reset `transcriptRef.current = []`, wiping all accumulated transcript
- Server logs showed `transcriptTurns=0` and `no transcript provided — skipping transcript processing`
- **Fix (commit db3ceaf):** Only reset transcript on fresh connections (`reconnectAttemptsRef.current === 0`), flush buffered utterances from crashed connection before clearing buffers

### Current state of code after fixes:
- **Token config** (`call-session/index.ts`): transcription fields COMMENTED OUT with explanation
- **Client config** (`useGeminiLive.ts`): transcription fields in `ai.live.connect()` config
- **Reconnect** (`useGeminiLive.ts`): preserves transcript across reconnects, flushes buffers on reconnect
- **Still needs testing:** whether client-side config actually produces transcription events without the token config

### Commits:
1. `62b0fd5` — Main implementation (all 5 phases)
2. `db3ceaf` — Fix 1008 + reconnect transcript wipe

---

## Validation Status (original plan review — line numbers now outdated after edits)

Every line number, code reference, and assumption was verified against the codebase before implementation.

| Claim | Verified? | Notes |
|---|---|---|
| Token config at line 279 | YES | `responseModalities: ["AUDIO"]` is at line 279 inside `liveConnectConstraints.config` |
| Refs should go after line 38 | YES | Plan originally said "after line 36" — corrected to after line 38 (`attemptReconnectRef`) |
| inputTranscription handler at lines 190–194 | YES | Exact match: `if (message.serverContent?.inputTranscription)` |
| connect() reset point at line 224 | YES | `greetingSentRef.current = false;` is at line 224 |
| disconnect() at line 530 | YES | `const disconnect = useCallback(() => {` is at line 530 |
| Public API return at line 583 | YES | `return {` is at line 583 |
| LiveCallPage `/end` fetch at lines 163–170 | YES | Exact match with `sessionId`, `initData`, `durationSeconds` |
| DevCallPage `/end` fetch at lines 208–216 | YES | Uses `dev-call-proxy/end`, not `call-session/end` |
| EndBody type at line 31 | YES | `interface EndBody { sessionId: string; initData: string; durationSeconds?: number; }` |
| handleEnd signature at line 409 | YES | `async function handleEnd(supabase, body, authHeader, botToken)` — no `lovableApiKey` param yet |
| Switch case at line 550 | YES | `case "end": response = await handleEnd(supabase, body as EndBody, authHeader, TELEGRAM_BOT_TOKEN);` |
| `conversations.channel` is plain text | YES | Migration line 63: `channel text NOT NULL` — no constraint |
| `call_sessions.summary` column exists | YES | Types file line 154: `summary: string \| null` |
| `dev-call-proxy` has separate handleEnd | YES | Line 246: own implementation, not a proxy to call-session |
| `loadHierarchicalContext` loads last 5 messages (no `summarized` filter) | YES | Lines 81–86: no `.eq("summarized", false)` — loads most recent 5 regardless |
| `maybeCompressHistory` only counts `summarized = false` | YES | Line 2000: `.eq("summarized", false)` — marking voice rows summarized prevents double-processing |

## Problem

Voice calls are black boxes. When a call ends, only `status`, `duration_seconds`, and `tool_calls_count` are saved. The actual conversation — everything said by the user and the agent — is lost. This means:

- No call summaries (the `call_sessions.summary` column exists but is always NULL)
- No insights extracted from voice conversations
- No messages inserted into the `conversations` table (so voice history never appears in future context)
- Call N has zero connection to Call N+1

## Solution

Enable Gemini Live API's built-in audio transcription, accumulate transcript fragments client-side, send the full transcript to the server on call end, then run the same summarize + extract-insights pipeline that text conversations already use.

---

## Phase 1: Enable Transcription in Ephemeral Token Config

**Risk: None.** Adding these fields is purely additive — transcription events ride alongside existing audio. If something goes wrong, the fields can be removed and audio still works.

### File: `supabase/functions/call-session/index.ts`

**Line 279** — inside `liveConnectConstraints.config`, add two fields after `responseModalities`:

```diff
 config: {
   responseModalities: ["AUDIO"],
+  inputAudioTranscription: {},
+  outputAudioTranscription: {},
   speechConfig: {
```

**Full context (lines 276–297):**
```typescript
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},      // NEW
            outputAudioTranscription: {},     // NEW
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            tools: voiceToolDeclarations,
            // thinkingConfig: { thinkingBudget: 512 },
            // ↑ Disabled: not supported on BidiGenerateContentConstrained
          },
        },
```

**Key detail:** The JS SDK (`@google/genai`) requires **camelCase** — `inputAudioTranscription`, not `input_audio_transcription`. Mixing casing silently fails (audio works, zero transcription events).

---

## Phase 2: Accumulate Transcript Fragments Client-Side

### File: `src/hooks/useGeminiLive.ts`

Transcription arrives as **streamed fragments** (e.g. `"Ca"`, `"n I"`, `"pl"`), not complete sentences. We accumulate them into a ref so they survive re-renders and are available at disconnect time.

#### 2a. Add transcript ref (after line 38)

**After line 38** (the `attemptReconnectRef` line), add:

```diff
  const attemptReconnectRef = useRef<() => void>(() => { });   // line 38
+ const transcriptRef = useRef<{ role: 'user' | 'agent'; text: string }[]>([]);
+ const currentUserUtterance = useRef('');
+ const currentAgentUtterance = useRef('');
```

#### 2b. Handle transcription events in message handler (replace lines 190–194)

**Current code (lines 190–194):**
```typescript
      // Detect user speaking (VAD)
      if (message.serverContent?.inputTranscription) {
        setIsListening(true);
        setTimeout(() => setIsListening(false), 500);
      }
```

**Replace with:**
```typescript
      // Accumulate user speech transcript
      if ((message.serverContent as any)?.inputTranscription) {
        setIsListening(true);
        setTimeout(() => setIsListening(false), 500);
        const text = (message.serverContent as any).inputTranscription.text;
        if (text) {
          currentUserUtterance.current += text;
        }
      }

      // Accumulate agent speech transcript
      if ((message.serverContent as any)?.outputTranscription) {
        const text = (message.serverContent as any).outputTranscription.text;
        if (text) {
          currentAgentUtterance.current += text;
        }
      }

      // On turn complete, flush accumulated utterances into the transcript log
      if (message.serverContent?.turnComplete) {
        if (currentUserUtterance.current.trim()) {
          transcriptRef.current.push({ role: 'user', text: currentUserUtterance.current.trim() });
          currentUserUtterance.current = '';
        }
        if (currentAgentUtterance.current.trim()) {
          transcriptRef.current.push({ role: 'agent', text: currentAgentUtterance.current.trim() });
          currentAgentUtterance.current = '';
        }
      }
```

**Why `(message.serverContent as any)`?** The `@google/genai` TypeScript types may not include `inputTranscription.text` / `outputTranscription` yet (it's a preview feature). The `as any` is scoped tightly and won't affect other code.

**Why flush on `turnComplete`?** Transcription fragments arrive out of order relative to audio. `turnComplete` is the signal that a model turn finished — a natural boundary to flush accumulated text into the transcript log. If `turnComplete` never fires for a given utterance (edge case), the text stays in the buffer and gets flushed at next turn or at disconnect (Phase 2c).

#### 2c. Reset transcript on connect, flush on disconnect

**In the `connect` function (line ~224)**, after `greetingSentRef.current = false;`:

```diff
    greetingSentRef.current = false;
+   transcriptRef.current = [];
+   currentUserUtterance.current = '';
+   currentAgentUtterance.current = '';
```

**In the `disconnect` function (line ~530)**, before teardown, flush any remaining buffered text:

```diff
  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
+   // Flush any remaining buffered utterances
+   if (currentUserUtterance.current.trim()) {
+     transcriptRef.current.push({ role: 'user', text: currentUserUtterance.current.trim() });
+     currentUserUtterance.current = '';
+   }
+   if (currentAgentUtterance.current.trim()) {
+     transcriptRef.current.push({ role: 'agent', text: currentAgentUtterance.current.trim() });
+     currentAgentUtterance.current = '';
+   }
    // Cancel any pending reconnect
```

#### 2d. Expose transcript in the public API (line ~583)

```diff
  return {
    status,
    isSpeaking: playback.isSpeaking,
    isListening,
+   transcript: transcriptRef,
    isMuted: capture.isMuted,
```

---

## Phase 3: Send Transcript to Server on Call End

### File: `src/pages/LiveCallPage.tsx`

**Lines 163–170** — the `/end` fetch call. Add transcript to the body:

```diff
        await fetch(`${SUPABASE_URL}/functions/v1/call-session/end`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            initData: initData || undefined,
            durationSeconds: callDuration,
+           transcript: gemini.transcript.current,
          }),
        });
```

### File: `src/pages/DevCallPage.tsx`

**Lines 208–216** — same change for the dev call page:

```diff
        await fetch(`${SUPABASE_URL}/functions/v1/dev-call-proxy/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            devSecret: devSecret.trim(),
            telegramChatId: Number(chatId.trim()),
            sessionId: sessionIdRef.current,
            durationSeconds: callDuration,
+           transcript: gemini.transcript.current,
          }),
        });
```

---

## Phase 4: Server-Side — Process Transcript on Call End

### File: `supabase/functions/call-session/index.ts`

#### 4a. Update EndBody type (line 31)

```diff
 interface EndBody {
   sessionId: string;
   initData: string;
   durationSeconds?: number;
+  transcript?: { role: 'user' | 'agent'; text: string }[];
 }
```

#### 4b. Rewrite `handleEnd` (lines 409–477)

Replace the current `handleEnd` with a version that:
1. Stores the raw transcript as conversations entries
2. Generates a call summary
3. Extracts insights
4. Updates the call_sessions.summary column

```typescript
async function handleEnd(
  supabase: SupabaseClient,
  body: EndBody,
  authHeader: string | null,
  botToken: string,
  lovableApiKey?: string,
) {
  const routeStart = Date.now();
  console.log(`[CallSession] /end: sessionId=${body.sessionId}, durationSeconds=${body.durationSeconds}, transcriptTurns=${body.transcript?.length || 0}`);

  const { sessionId, initData, durationSeconds, transcript } = body;
  if (!sessionId || (!initData && !authHeader)) {
    console.error(`[CallSession] /end: REJECTED — missing fields`);
    return json({ error: "Missing sessionId or auth token" }, 400);
  }

  // Validate auth and resolve profile
  const result = await validateAuthAndGetProfile(supabase, initData, authHeader, botToken);
  if (!result) {
    console.error(`[CallSession] /end: REJECTED — auth failed (${Date.now() - routeStart}ms)`);
    return json({ error: "Invalid auth or profile not found" }, 401);
  }

  const { profile } = result;

  // Verify session belongs to this user
  const { data: session, error: sessionError } = await supabase
    .from("call_sessions")
    .select("profile_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    console.error(`[CallSession] /end: session lookup FAILED for id=${sessionId}:`, sessionError?.message || "no rows");
    return json({ error: "Session not found" }, 404);
  }

  console.log(`[CallSession] /end: session found — current status=${session.status}`);

  if (session.profile_id !== profile.id) {
    console.error(`[CallSession] /end: REJECTED — ownership mismatch`);
    return json({ error: "Session does not belong to this user" }, 403);
  }

  // Guard: don't end a session that's already ended
  if (session.status === "ended") {
    console.warn(`[CallSession] /end: session ${sessionId} already ended, skipping update`);
    return json({ ok: true, alreadyEnded: true });
  }

  // ---- Core update: mark session as ended ----
  const updatePayload: Record<string, unknown> = {
    status: "ended",
    ended_at: new Date().toISOString(),
    duration_seconds: durationSeconds ?? null,
  };

  // ---- Process transcript (if present and non-empty) ----
  if (transcript && transcript.length > 0) {
    console.log(`[CallSession] /end: processing ${transcript.length} transcript turns`);

    // 1. Insert transcript turns into conversations table
    const now = new Date();
    const conversationRows = transcript.map((turn, i) => ({
      profile_id: profile.id,
      channel: "voice",
      direction: turn.role === "user" ? "inbound" : "outbound",
      content: turn.text,
      created_at: new Date(now.getTime() - (transcript.length - i) * 1000).toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("conversations")
      .insert(conversationRows);

    if (insertError) {
      console.error(`[CallSession] /end: conversation insert FAILED:`, insertError.message);
    } else {
      console.log(`[CallSession] /end: inserted ${conversationRows.length} conversation rows (channel=voice)`);
    }

    // 2. Generate call summary + extract insights (in parallel, best-effort)
    if (lovableApiKey) {
      const transcriptText = transcript
        .map(t => `[${t.role === "user" ? "inbound" : "outbound"}]: ${t.text}`)
        .join("\n");

      try {
        const [summaryResponse, insights] = await Promise.all([
          // Summary generation
          fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              thinking_config: { thinking_level: "low" },
              messages: [
                {
                  role: "system",
                  content: `You are a conversation summarizer. Create a concise summary of this plant care voice call that captures:
1. Key plants discussed
2. Issues diagnosed or questions answered
3. Actions taken (plants saved, reminders set)
4. Important user preferences revealed

Return JSON: {"summary": "2-3 sentence summary", "key_topics": ["topic1", "topic2"]}`,
                },
                { role: "user", content: transcriptText },
              ],
              max_tokens: 200,
            }),
          }),
          // Insight extraction (reuse the same pattern from orchid-agent)
          (async () => {
            try {
              const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${lovableApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  thinking_config: { thinking_level: "low" },
                  messages: [
                    {
                      role: "system",
                      content: `Extract structured user facts from this plant care conversation.

Return ONLY valid JSON with an array of insights (empty array if none found):
{
  "insights": [
    {"key": "has_pets", "value": "yes"},
    {"key": "pet_type", "value": "cat"},
    {"key": "home_lighting", "value": "mostly low light, one south-facing window"}
  ]
}

Valid keys (ONLY use these):
- has_pets: "yes" or "no"
- pet_type: specific pet (cat, dog, bird, etc.)
- home_lighting: description of light conditions
- watering_style: tendency (overwaterer, underwaterer, forgetful, consistent)
- experience_level: beginner, intermediate, experienced
- plant_preferences: types they like (tropical, succulents, flowering, etc.)
- climate_zone: if mentioned (humid, dry, seasonal, etc.)
- window_orientation: north, south, east, west facing
- child_safety: if they mention kids/child safety
- home_humidity: humid, dry, average
- problem_patterns: recurring issues (root rot, pests, etc.)

CRITICAL: Only extract facts EXPLICITLY stated by the user. Do not infer or guess.`,
                    },
                    { role: "user", content: transcriptText },
                  ],
                  max_tokens: 300,
                }),
              });
              if (!resp.ok) return [];
              const data = await resp.json();
              const content = data.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
              return parsed.insights || [];
            } catch {
              return [];
            }
          })(),
        ]);

        // Process summary
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          const summaryContent = summaryData.choices?.[0]?.message?.content || "";
          let summaryJson: { summary: string; key_topics: string[] };
          try {
            const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
            summaryJson = JSON.parse(jsonMatch ? jsonMatch[0] : summaryContent);
          } catch {
            summaryJson = { summary: summaryContent, key_topics: [] };
          }

          console.log(`[CallSession] /end: generated summary: "${summaryJson.summary.substring(0, 80)}..."`);
          updatePayload.summary = summaryJson.summary;

          // Also save to conversation_summaries table for context loading
          await supabase.from("conversation_summaries").insert({
            profile_id: profile.id,
            summary: summaryJson.summary,
            key_topics: summaryJson.key_topics,
            message_count: transcript.length,
            start_time: conversationRows[0].created_at,
            end_time: conversationRows[conversationRows.length - 1].created_at,
          });
        }

        // Process insights
        if (insights.length > 0) {
          console.log(`[CallSession] /end: extracted ${insights.length} insights`);
          for (const insight of insights) {
            await supabase.from("user_insights").upsert(
              {
                profile_id: profile.id,
                insight_key: insight.key,
                insight_value: insight.value,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "profile_id,insight_key" },
            );
          }
        }

        // Mark the voice conversation rows as already summarized
        // (we just generated the summary — no need for maybeCompressHistory to re-process)
        const voiceMessageIds = (await supabase
          .from("conversations")
          .select("id")
          .eq("profile_id", profile.id)
          .eq("channel", "voice")
          .order("created_at", { ascending: false })
          .limit(transcript.length)
        ).data?.map((m: any) => m.id) || [];

        if (voiceMessageIds.length > 0) {
          await supabase.from("conversations").update({ summarized: true }).in("id", voiceMessageIds);
        }
      } catch (err) {
        console.error(`[CallSession] /end: transcript processing error:`, err);
        // Non-fatal — session still ends successfully
      }
    }
  }

  // ---- Final DB update ----
  const { error: updateError } = await supabase
    .from("call_sessions")
    .update(updatePayload)
    .eq("id", sessionId);

  if (updateError) {
    console.error(`[CallSession] /end: DB update FAILED:`, updateError.message);
    return json({ error: updateError.message }, 500);
  }

  console.log(
    `[CallSession] /end: SUCCESS — session ${sessionId} status: ${session.status}→ended, duration=${durationSeconds != null ? durationSeconds : "unknown"}s, summary=${!!updatePayload.summary}, total=${Date.now() - routeStart}ms`,
  );

  return json({ ok: true });
}
```

#### 4c. Pass `lovableApiKey` to `handleEnd` (line 550)

```diff
      case "end":
-       response = await handleEnd(supabase, body as EndBody, authHeader, TELEGRAM_BOT_TOKEN);
+       response = await handleEnd(supabase, body as EndBody, authHeader, TELEGRAM_BOT_TOKEN, LOVABLE_API_KEY);
        break;
```

---

## Phase 5: Wire Up Dev Call Proxy

**VALIDATED:** `dev-call-proxy/index.ts` has its **own separate** `handleEnd` (line 246–267) — it does NOT proxy to `call-session/end`. It's a standalone implementation that directly updates `call_sessions`.

### File: `supabase/functions/dev-call-proxy/index.ts`

#### 5a. Update EndBody type (line 34)

```diff
 interface EndBody extends DevBody {
   sessionId: string;
   durationSeconds?: number;
+  transcript?: { role: 'user' | 'agent'; text: string }[];
 }
```

#### 5b. Update handleEnd (line 246)

The dev proxy's `handleEnd` is simpler (no auth validation, no profile lookup). We need to add transcript forwarding. The simplest approach: forward the transcript to the production `call-session/end` endpoint internally, or duplicate the transcript processing logic.

**Recommended:** Since this is dev-only, just forward the `transcript` field through. The minimal change is to store the transcript text as the summary directly (skip the AI summarization for dev):

```diff
  await supabase
    .from("call_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      duration_seconds: body.durationSeconds ?? null,
+     summary: body.transcript?.length
+       ? body.transcript.map(t => `[${t.role}]: ${t.text}`).join('\n').substring(0, 2000)
+       : null,
    })
    .eq("id", body.sessionId);
```

This is lower priority — the production path is `LiveCallPage.tsx` → `call-session/end`.

---

## Phase 6: Verify the `conversations` Table Accepts `channel = "voice"`

**VALIDATED:** The `channel` column is plain `text NOT NULL` (migration line 63: `channel text NOT NULL`). No CHECK constraint, no enum. Inserting `"voice"` will work with zero migration needed.

---

## Summary of All Changes

| # | File | What changes | Lines |
|---|------|-------------|-------|
| 1 | `supabase/functions/call-session/index.ts` | Add `inputAudioTranscription: {}` and `outputAudioTranscription: {}` to token config | 279 |
| 2 | `src/hooks/useGeminiLive.ts` | Add transcript refs (3 new refs) | after 38 |
| 3 | `src/hooks/useGeminiLive.ts` | Replace inputTranscription handler + add outputTranscription + turnComplete flushing | 190–194 |
| 4 | `src/hooks/useGeminiLive.ts` | Reset transcript on connect | 224 |
| 5 | `src/hooks/useGeminiLive.ts` | Flush remaining buffer on disconnect | 530 |
| 6 | `src/hooks/useGeminiLive.ts` | Expose `transcript` ref in return object | 583 |
| 7 | `src/pages/LiveCallPage.tsx` | Send `transcript` in `/end` request body | 166–170 |
| 8 | `src/pages/DevCallPage.tsx` | Send `transcript` in `/end` request body | 211–216 |
| 9 | `supabase/functions/call-session/index.ts` | Update `EndBody` type to include `transcript` | 31 |
| 10 | `supabase/functions/call-session/index.ts` | Rewrite `handleEnd` to process transcript: insert conversations, generate summary, extract insights | 409–477 |
| 11 | `supabase/functions/call-session/index.ts` | Pass `LOVABLE_API_KEY` to `handleEnd` | 550 |
| 12 | `supabase/functions/dev-call-proxy/index.ts` | Update `EndBody` type + store raw transcript as summary | 34, 246–267 |
| ~~ | ~~Migration~~ | ~~Not needed~~ — `channel` is plain `text`, no constraint | ~~n/a~~ |

## Known Limitations & Risks

1. **Preview API** — The Gemini Live API transcription is not GA. It works but is in preview.
2. **Fragment quality** — Long speech (30-60s+) can cause delayed/missing transcription events. Most voice calls are conversational (short turns), so this is low risk.
3. **No ordering guarantee** — Transcription events arrive independently from audio. We use `turnComplete` as a flush boundary, which handles this well for logging purposes.
4. **Type safety** — `inputTranscription.text` and `outputTranscription` may not be in the `@google/genai` TypeScript types yet. We use targeted `as any` casts in two places: client-side connect config (`useGeminiLive.ts`) and message handler.
5. **Payload size** — A 10-minute call might produce ~2000 words of transcript. At ~10KB, this is well within HTTP body limits.
6. **Best-effort** — If transcript processing fails on the server, the call still ends successfully. Summary/insights are non-blocking.
7. **Constrained endpoint limitation (DISCOVERED POST-DEPLOY)** — `inputAudioTranscription`/`outputAudioTranscription` in the ephemeral token config causes 1008 disconnect on `BidiGenerateContentConstrained`. Config must live in client-side `ai.live.connect()` only. Same pattern as `thinkingConfig` and `contextWindowCompression`.
8. **Reconnect wipes state (FIXED POST-DEPLOY)** — Original `connect()` always reset `transcriptRef.current = []`. Fixed: only reset on fresh connections (`reconnectAttemptsRef.current === 0`), flush buffers from crashed connection before clearing.
9. **Needs verification** — Whether client-side transcription config (without token config) actually produces transcription events. If not, an alternative approach may be needed (e.g., post-call Whisper transcription of recorded audio).

## Data Flow After Implementation

```
Voice Call (Gemini Live)
  ├── Audio stream (existing, unchanged)
  ├── inputTranscription events → accumulate user speech
  └── outputTranscription events → accumulate agent speech
                │
                ▼ (on call end)
          Client sends to /end:
          { sessionId, durationSeconds, transcript: [{role, text}, ...] }
                │
                ▼
          handleEnd() runs:
          ├── 1. Insert transcript rows into conversations (channel="voice")
          ├── 2. Generate summary → call_sessions.summary + conversation_summaries
          ├── 3. Extract insights → user_insights
          └── 4. Mark voice messages as summarized=true
                │
                ▼
          Next conversation (text OR voice) loads via loadHierarchicalContext():
          ├── conversation_summaries includes voice call summaries
          ├── user_insights includes voice-extracted facts
          └── Voice calls are NO LONGER black boxes
```

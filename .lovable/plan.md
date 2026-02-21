

# Fix: Handler Scoping + Error Response Architecture in orchid-agent

## Root Cause Analysis

This is not a simple "move a variable" problem. There are two architectural flaws working together:

### Flaw 1: orchid-agent's catch block is Telegram-only

The top-level `catch` block (line 3988-3995) **always** returns TwiML XML with HTTP 200 -- because it was originally designed for Twilio/Telegram webhooks, where you must return valid XML even on failure.

But now orchid-agent serves **three callers**: Telegram, pwa-agent, and proactive-agent. When an internal JSON caller triggers an error, the catch block still returns XML with a 200 status.

### Flaw 2: Response-level variables declared inside nested blocks

`toolsUsed` is declared at line 2727, deep inside:

```text
if (orchestratorResponse.ok)          // line 2695
  else (choices exist)                // line 2707
    const toolsUsed = []              // line 2727
```

But it's consumed at line 3972 at the handler's top level. When the orchestrator returns an error (429, 402, etc.) or malformed data, `toolsUsed` is never declared, so line 3972 throws `ReferenceError`.

### The crash chain

```text
1. User sends message via PWA
2. pwa-agent forwards to orchid-agent (X-Internal-Agent-Call: true)
3. orchid-agent processes, hits line 3972: toolsUsed is not defined
4. ReferenceError thrown, caught by catch block (line 3988)
5. catch block returns XML with HTTP 200 (Telegram pattern)
6. pwa-agent sees HTTP 200, skips error check (line 132)
7. pwa-agent calls .json() on XML body -> SyntaxError: "<?xml vers..."
8. pwa-agent's own catch returns 500 to frontend
```

The pwa-agent's `!agentResponse.ok` check at line 132 is correct -- but useless here because orchid-agent returns 200 with XML on crash.

---

## Fix 1: Mode-aware error handling in orchid-agent's catch block

**File:** `supabase/functions/orchid-agent/index.ts` (lines 3988-3995)

The catch block must check whether this is an internal agent call and return the appropriate format:

```typescript
} catch (error) {
  console.error("Webhook error:", error);

  // Determine if this was an internal agent call by checking the request header
  // (isInternalAgentCall is declared earlier in the try block and may not be in scope here,
  // so we re-check the original request header)
  const wasInternalCall = req.headers.get("X-Internal-Agent-Call") === "true";

  if (wasInternalCall) {
    return new Response(JSON.stringify({
      error: "Internal agent error",
      detail: String(error).substring(0, 200),
      reply: "I had a little hiccup! Could you try again? 🌱",
      mediaToSend: [],
      toolsUsed: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml",
    },
  });
}
```

This ensures internal callers always get JSON errors with proper HTTP status codes, while Telegram callers still get valid TwiML.

---

## Fix 2: Hoist `toolsUsed` to handler scope

**File:** `supabase/functions/orchid-agent/index.ts`

Move `toolsUsed` declaration from line 2727 (inside nested else block) to line 2682, alongside `aiReply` and `mediaToSend` -- the other response-level variables:

```typescript
let aiReply: string;
let mediaToSend: Array<{ url: string; caption?: string }> = [];
const toolsUsed: string[] = [];   // <-- moved here from line 2727
```

Remove the declaration at line 2727. The `.push(functionName)` calls inside the tool loop continue to work because they reference the same array.

This follows the same pattern as `aiReply` and `mediaToSend`, which are already declared at this scope level.

---

## Fix 3: Content-type validation in pwa-agent

**File:** `supabase/functions/pwa-agent/index.ts` (lines 132-147)

Even with Fix 1, pwa-agent should defend against unexpected response formats from any upstream service:

```typescript
if (!agentResponse.ok) {
  const errorText = await agentResponse.text();
  console.error(`[pwa-agent] orchid-agent error: ${agentResponse.status} ${errorText.substring(0, 500)}`);
  return new Response(JSON.stringify({ error: "Agent error", detail: errorText.substring(0, 200) }), {
    status: agentResponse.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Validate content-type before parsing -- orchid-agent's catch block
// may return XML on crash (Telegram legacy), or Deno runtime may return HTML
const responseContentType = agentResponse.headers.get("content-type") || "";
if (!responseContentType.includes("application/json")) {
  const rawBody = await agentResponse.text();
  console.error(`[pwa-agent] orchid-agent returned non-JSON (${responseContentType}): ${rawBody.substring(0, 300)}`);
  return new Response(JSON.stringify({
    error: "Unexpected response format from agent",
    detail: `Got ${responseContentType} instead of JSON`,
  }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const agentResult = await agentResponse.json();
```

---

## Why this is architectural, not a patch

| Aspect | Patch approach | This approach |
|--------|---------------|---------------|
| `toolsUsed` scoping | Move variable up | Move variable up (same, because this IS the correct fix) |
| Catch block | Leave as-is | Make mode-aware: JSON for internal callers, XML for Telegram |
| pwa-agent parsing | Wrap in try/catch | Validate content-type before parsing (fail fast with clear error) |
| Future callers | Would hit same XML-on-crash bug | All internal callers automatically get JSON errors |

The variable hoisting is simple because it's the right thing to do. The real architectural work is making the error boundaries mode-aware so the system degrades gracefully regardless of which caller path triggered the failure.

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/orchid-agent/index.ts` | (1) Hoist `toolsUsed` to handler scope at line 2682. (2) Make catch block mode-aware for internal vs Telegram callers. |
| `supabase/functions/pwa-agent/index.ts` | Add content-type validation before `.json()` parsing. |


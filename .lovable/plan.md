

# Fix: `payload is not defined` in Proactive Trigger Path

## Root Cause

Line 2337 of `orchid-agent/index.ts` references `payload`, but that variable is only declared inside the `isInternalAgentCall` block (line 2245). When the proactive trigger path runs instead (line 2289), the variable used is `proactivePayload` -- so `payload` doesn't exist and throws a `ReferenceError`.

## Fix

**File: `supabase/functions/orchid-agent/index.ts`**, line 2337

Change:
```typescript
const channel = (isInternalAgentCall && payload?.channel) || "telegram";
```

To:
```typescript
let channel = "telegram";
if (isInternalAgentCall) {
  try { channel = payload?.channel || "telegram"; } catch (_) { /* payload not in scope */ }
}
```

Or more cleanly: declare a `let requestChannel = "telegram"` at the top of the handler, set it to `payload.channel` inside the `isInternalAgentCall` block (line 2288, where `payload` is in scope), and use `requestChannel` at line 2337 instead. This avoids referencing a block-scoped variable outside its block entirely.

### Cleaner approach (recommended)

1. Add `let requestChannel = "telegram";` near the top of the handler (around line 2230 with the other `let` declarations)
2. Inside the `isInternalAgentCall` block, after line 2288, add: `requestChannel = payload.channel || "telegram";`
3. Replace line 2337 with: `const channel = requestChannel;`

One file, three small line changes.


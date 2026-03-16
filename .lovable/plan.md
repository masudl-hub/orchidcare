

## The Exact Problem

The LLM is **not misremembering** the name. It's doing exactly what you'd expect — it reads its context, sees `"Fiddle Leaf Fig (Ficus lyrata)"`, and passes that whole string to the tool. The bug is that **the resolver searches each database column individually** using `ILIKE`, and no single column contains the composite display string. The context format and the resolver format are mismatched.

This is a **serialization/deserialization mismatch** — the context serializes plant data one way, but the tool deserializer expects a different format.

## Production-Grade Approaches

There are really three strategies used at scale:

### 1. Structured IDs (what I proposed — and what most tool-calling systems do)
Give the LLM a deterministic handle. The context shows `[id:abc123] Fiddle Leaf Fig`, the LLM passes `abc123` to tools, the resolver does `.eq("id", "abc123")`. Zero ambiguity. This is what OpenAI's Assistants API, Google's ADK, and most agentic frameworks do — tools operate on IDs, not natural language names.

**Tradeoff:** Slightly less natural in voice conversations (the LLM still speaks names to the user, but internally routes by ID).

### 2. Enum-style constrained outputs
Instead of free-text `plant_identifier`, define the tool parameter as an enum populated with the exact plant names from context. The LLM can only pick from the list. Gemini and OpenAI both support dynamic enums.

**Tradeoff:** Requires rebuilding tool declarations per-request (you already build context per-request, so this is feasible). Doesn't scale to 430,000 plants — enum lists have token limits.

### 3. Server-side smart resolver (what you have now, but broken)
The resolver tries to fuzzy-match whatever string the LLM sends. To work reliably, it would need to: split on parentheses, try each fragment, score across all columns, handle synonyms.

**Tradeoff:** Complex, fragile, always playing catch-up with however the LLM decides to phrase things. Not production-grade for critical operations like delete.

## Recommendation

**Use approach #1 (Structured IDs)** for all mutating operations (delete, modify, move sensor, create reminder). It's the only approach that is:
- Deterministic (no matching logic can fail)
- Scalable (works with 430,000 plants — the LLM sees the list, picks the ID)
- Simple (3 lines of code change)

For the 430,000 plant scenario: the LLM wouldn't see all 430,000 in context (that's too many tokens). You'd paginate or filter the context list. But whatever subset it sees, each entry has an ID, and operations on those entries are guaranteed to resolve.

## Implementation (same as before, but now you see why)

1. **context.ts line 279**: Add the plant UUID to the display string
2. **tools.ts line 70-76**: Check if identifier is a UUID first → direct `.eq("id", id)` lookup
3. **voiceTools.ts**: Update `plant_identifier` descriptions to say "use the plant ID from context"

Three files, ~15 lines changed total. The fuzzy resolver stays as fallback for conversational use ("water all my bedroom plants") but all single-plant mutations route by ID.


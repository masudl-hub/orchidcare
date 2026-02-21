

# PWA Chat Experience -- Implementation Plan

## User Story

1. User opens Orchid on their phone (the landing page `/` or `/start`)
2. They see an "Install Orchid" / "Add to Home Screen" prompt
3. Tapping it pins the app; it opens to `/app`
4. They create an account (Google or email/password) or switch to login
5. Profile onboarding questions (reusing the existing ProfileConfig design)
6. Chat UI loads -- they're ready to use Orchid

## Architecture

The orchid-agent already supports internal JSON calls via `X-Internal-Agent-Call: true` header. It accepts `{ profileId, message, channel, mediaBase64?, mediaMimeType? }` and returns `{ reply, mediaToSend }`. A new `pwa-agent` edge function will authenticate users via their Supabase JWT, resolve their profile, and forward to orchid-agent -- same pattern as the telegram-bot.

```text
PWA Chat UI  -->  pwa-agent (JWT + profile)  -->  orchid-agent
                                                    |
                  same tools, same memory, same AI  |
```

## What Gets Built

### New Files

**`supabase/functions/pwa-agent/index.ts`**
- POST endpoint accepting `{ message, mediaBase64?, mediaMimeType? }`
- Validates JWT from `Authorization` header via `supabase.auth.getUser(token)`
- Looks up profile by `user_id`; returns 401/404 if missing
- Forwards to orchid-agent with `X-Internal-Agent-Call: true`, `channel: "pwa"`
- Streams NDJSON tool-status events back to the client (wrapping orchid-agent's response), matching demo-agent's streaming pattern so the chat UI can show "identifying plant..." etc.
- No HMAC, no turn limits -- authenticated users get full access

**`src/pages/AppPage.tsx`**
- The `/app` route -- PWA entry point
- Three states:
  - **Not authenticated**: renders auth UI (new dedicated components below)
  - **Authenticated, no profile**: renders profile onboarding
  - **Authenticated + profile**: renders PwaChat
- Detects standalone mode (`window.matchMedia('(display-mode: standalone)')`) to hide "back to website" links

**`src/components/pwa/PwaAuth.tsx`**
- Dedicated auth screen for the PWA context (not reusing LoginPage/BeginPage since those have Telegram references and different navigation flows)
- Uses the same visual language: black bg, white borders, monospace, pixel art character swaps
- Two tabs/modes: "Create Account" and "Login"
- Google OAuth button (uses `lovable.auth.signInWithOAuth("google", ...)`)
- Email + password form
- No Telegram hints, no "/web" references
- Shares the same `useAuth()` context and `signUp`/`signIn` functions

**`src/components/pwa/PwaOnboarding.tsx`**
- Simplified version of ProfileConfig: display name, experience level, personality, notification frequency
- Same icon-based selection UI (reuses the same design patterns)
- On submit, calls `createProfile()` from AuthContext
- Transitions to chat on completion

**`src/components/pwa/PwaChat.tsx`**
- Adapted from DemoPage's chat architecture but connected to real auth
- Calls `supabase.functions.invoke('pwa-agent', ...)` with the user's session token
- Reads NDJSON stream for tool status updates (same pattern as DemoPage)
- No turn counter, no HMAC tokens, no DemoLimitScreen
- Shows conversation history (loads recent messages from `conversations` table filtered to `channel = "pwa"` on mount)
- Reuses DemoInputBar for text + photo input (camera capture already built in)
- Reuses ChatResponse component for rendering replies
- Offline indicator when `navigator.onLine` is false

**`src/components/pwa/InstallPrompt.tsx`**
- Listens for `beforeinstallprompt` event (Chrome/Android)
- On iOS: detects Safari + non-standalone, shows "Tap Share > Add to Home Screen"
- Renders a subtle banner/button

### Edited Files

**`src/App.tsx`**
- Add route: `<Route path="/app" element={<AppPage />} />`

**`public/manifest.json`**
- Change `start_url` from `/` to `/app`

**`index.html`**
- Update viewport meta: add `maximum-scale=1, user-scalable=0` to prevent iOS input zoom in the PWA
- Add `/~oauth` awareness (already handled by Lovable Cloud)

**`public/sw.js`**
- Add network-only handling for `/~oauth` and auth callback paths so OAuth redirects never serve cached content

### Mobile UX Polish (applied to `/app` layout)

- `overscroll-behavior-y: none` on the app wrapper to prevent pull-to-refresh bounce
- Only the chat message list scrolls (`overflow-y: auto; -webkit-overflow-scrolling: touch`)
- Bottom input uses `padding-bottom: env(safe-area-inset-bottom)` (already in DemoInputBar)
- Camera capture on photo input (already in DemoInputBar)

## Account Linking (Telegram vs PWA)

For now, Telegram and PWA profiles are separate. A Telegram user who also creates a PWA account gets a separate profile. Future enhancement: if someone signs up on the PWA with the same email linked to their Telegram account, we could offer to merge profiles. Not in scope for this iteration.

## What Does NOT Change

- Landing page (`/`), `/demo`, `/begin`, `/login`, `/start` -- all stay as-is
- Telegram bot -- completely untouched
- orchid-agent edge function -- no modifications needed
- Database schema -- no new tables; existing `conversations`, `profiles`, `plants` all work
- Auth system -- already fully implemented

## Sequence

1. Create `pwa-agent` edge function and deploy
2. Create `InstallPrompt` component
3. Create `PwaAuth` component (signup + login in one view)
4. Create `PwaOnboarding` component
5. Create `PwaChat` component
6. Create `AppPage` orchestrator
7. Update `App.tsx` with new route
8. Update `manifest.json`, `index.html`, `sw.js`
9. Test end-to-end: install prompt -> auth -> onboarding -> chat


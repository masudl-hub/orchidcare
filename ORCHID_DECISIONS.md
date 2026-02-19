# Orchid: Architecture Decisions & Research Summary

## Onboarding Flow Decision (Feb 2026)

### Decision: Telegram-First, No Web Signup Gate

**Landing page orchid pixel art = tap/click target → Telegram deep link**

#### Mobile Flow
1. Tap orchid → `t.me/orchidcare_bot?start=web`
2. Telegram opens, bot asks 3 inline-button questions (~30 sec):
   - "What should I call you?" (text)
   - "How experienced are you?" [Beginner] [Intermediate] [Expert]
   - "How should I talk?" [Friendly] [Scientific] [Brief]
3. User is chatting immediately
4. Pets, location, concerns → discovered naturally through conversation
5. Full profile config available later as Telegram Mini App ("power-up", not gate)

#### Mobile Fallback (no Telegram installed)
- `t.me/` link natively shows "Get Telegram" page
- We add timeout detection (~2 sec): if app didn't open, show fallback UI with "Get Telegram" + "Sign up on web instead"

#### Desktop Flow
- Detect desktop (screen width / pointer type)
- Click orchid → **pixel art animates/morphs into a QR code** encoding `t.me/orchidcare_bot?start=web`
- Both orchid and QR are B&W pixel grids — animation is a pixel shuffle/morph
- User scans with phone camera → opens Telegram

### Why Telegram-First
- 38% drop off at screen one of onboarding; 43% abandon at identity verification
- Progressive profile collection (in-conversation) converts 3x better than upfront forms
- Security is identical: bot uses service_role (bypasses RLS) either way; data isolation is application-code-enforced via WHERE clauses regardless of entry point
- Synthetic auth user (`tg_{chatId}@orchid.bot`) enables web access later via `/web` magic link

---

## Telegram Mini App for Profile Config

### Architecture
```
User taps "Configure Profile" button in bot
  → Mini App opens (bottom sheet → expandable full screen)
  → Reads Telegram initData (cryptographically signed with bot token)
  → POSTs initData to Supabase Edge Function
  → Edge Function validates (HMAC-SHA256), maps telegram_id → Supabase user
  → Signs custom JWT (HS256 with SUPABASE_JWT_SECRET)
  → Returns access_token
  → Mini App uses JWT for all Supabase calls (RLS works normally)
  → User configures profile → saves → haptic feedback → close
  → Bot confirms: "Profile updated!"
```

### Mini App Capabilities
- Full HTML/CSS/JS WebView — can use our React + Tailwind + Press Start 2P aesthetic
- `@telegram-apps/telegram-ui` React library: inputs, selects, chips, switches, radio groups
- Native features: HapticFeedback, MainButton, BackButton, theme integration
- Auth: initData contains user.id with HMAC-SHA256 signature — cryptographic proof of identity
- Cross-platform: iOS, Android, desktop. No offline support needed for config forms.

### JWT Exchange Edge Function (to build)
- Endpoint: `/auth/telegram-exchange`
- Validates initData with bot token
- Looks up user by telegram_chat_id → gets Supabase user_id
- Signs JWT with `{ sub: userId, aud: 'authenticated', role: 'authenticated' }`
- Returns token for Mini App's Supabase client

---

## Critical Security Fixes Needed

### 1. proactive_preferences & proactive_messages policies
**Bug:** Missing `TO service_role` — any authenticated user can read ALL users' data
**Fix:** Add `TO service_role` to both service policies

### 2. linking_codes SELECT policy
**Bug:** `USING (true)` lets any authenticated user read ALL linking codes (account takeover risk)
**Fix:** Scope to `USING (auth.uid() = user_id)` or remove if web frontend doesn't query codes

### 3. Recommended: Telegram webhook secret verification
### 4. Recommended: Rate limiting on linking code attempts

---

## Auth Architecture Summary

| Path | Auth Mechanism | Data Isolation |
|------|---------------|----------------|
| Telegram bot | service_role key (bypasses RLS) | Application code WHERE clauses |
| Web dashboard | Real JWT via Supabase Auth | Database-enforced RLS |
| Mini App | Custom JWT from initData exchange | Database-enforced RLS |
| /web magic link | Supabase magic link → real JWT | Database-enforced RLS |

Synthetic auth user `tg_{chatId}@orchid.bot`: created on first /start, enables magic link + web RLS. Password is random UUID (never known to user).

---

## Current UI State (what's been built/changed this session)

### Files Modified
- `src/App.tsx` — "/" now renders OrchidPage (was Index), removed /orchid route
- `src/pages/OrchidPage.tsx` — fade/slide transitions for /start and /login clicks
- `src/components/landing/orchid-hero.tsx` — FOUC fix (inline styles for opacity), wheel scroll lock (passive:false addEventListener), onLoginClick prop
- `src/components/landing/start-page.tsx` — split GuidesFeature/LiveFeature into separate snap sections
- `src/components/landing/live-feature.tsx` — removed autoPlay (programmatic play on visibility), removed loop
- `src/pages/Settings.tsx` — TelegramConnectionCard component
- `src/components/ConnectTelegram.tsx` — onboarding step (linking code + deep link + polling)
- `src/pages/Onboarding.tsx` — added connectTelegram step
- `src/components/CreateAccount.tsx` — Telegram /web hint
- `supabase/functions/telegram-bot/index.ts` — ensureAuthUser, /start deep link handling, /web command, tryLinkAccount fix, photo download fix (base64Encode), migrateProfileData

### Commits Pushed
1. `028116f` — feat: add Telegram auth, account linking, and Connect Telegram onboarding
2. `38dd675` — fix: photo download stack overflow — use Deno std base64, drop deno_image resize
3. `e8d41b8` — feat: make OrchidPage the default landing page
4. Uncommitted: UI race condition fixes (hero FOUC, scroll snap, video autoplay, wheel lock, slide transitions)

### Pending Work
- [ ] Orchid pixel art → QR code morph animation (desktop)
- [ ] Mobile deep link with no-Telegram fallback
- [ ] Device detection (mobile vs desktop) for tap behavior
- [ ] Telegram Mini App for profile config (new edge function + Mini App build)
- [ ] Security fixes (proactive_preferences, linking_codes policies)
- [ ] Register /web with BotFather
- [ ] Deploy updated telegram-bot edge function
- [ ] Commit current UI fixes

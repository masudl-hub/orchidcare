

# Unified Web Auth Flow -- Skip Telegram, Land in Chat

## What changes

Currently, the web auth flow is: Sign up --> Profile config --> Connect Telegram --> /dashboard.
The new flow is: Sign up or Log in --> Profile config (new users only) --> PwaChat.

All three channels (in-browser, PWA, Telegram) converge on the same chat experience. Telegram linking is removed from the web onboarding -- users who want Telegram will tap "Open in Telegram" from the start page.

## Current state

```text
/login  --> LoginPage.tsx  (Login.tsx component)  --> /dashboard
/begin  --> BeginPage.tsx  (CreateAccount.tsx)     --> /onboarding --> ProfileConfig --> ConnectTelegram --> /dashboard
/app    --> AppPage.tsx    (PwaAuth --> PwaOnboarding --> PwaChat)
```

## New state

```text
/login  --> Consolidated auth page (login/signup toggle, same as /app) --> PwaChat
/begin  --> Redirect to /login
/app    --> Same as today (PwaAuth --> PwaOnboarding --> PwaChat)
/onboarding --> ProfileConfig --> PwaChat (no Telegram step)
/dashboard  --> Still accessible but no longer the default post-auth landing
```

---

## Detailed changes

### 1. Consolidate /login and /begin into a single auth page

**File: `src/pages/LoginPage.tsx`** -- Rewrite to use the same lifecycle as `AppPage.tsx`:
- Not authenticated: show `PwaAuth` (has login/signup toggle built in)
- Authenticated, no profile: show `PwaOnboarding`
- Authenticated, with profile: show `PwaChat`

This replaces the separate `Login.tsx` and `CreateAccount.tsx` component usage. The `PwaAuth` component already has a login/signup toggle, social auth (Google/Apple), and matching aesthetic.

The loading animation overlay currently in LoginPage can be removed since PwaAuth handles the transition internally via AuthContext state changes.

### 2. Redirect /begin to /login

**File: `src/App.tsx`** -- Change the `/begin` route from rendering `BeginPage` to `<Navigate to="/login" replace />`.

The `/signup` redirect already points to `/begin`, so update it to point to `/login` as well.

### 3. Update Onboarding to skip Telegram and land in chat

**File: `src/pages/Onboarding.tsx`** -- Two changes:
- Remove the `connectTelegram` step entirely. After profile config completes, go straight to the `complete` step.
- Change `handleOnboardingComplete` to navigate to `/login` instead of `/dashboard` (which will detect the profile and show PwaChat).

Alternatively, navigate to `/app` -- but since `/login` is now the consolidated page, either works. Using `/login` keeps the URL cleaner for browser users.

### 4. Update post-auth redirects across the app

Several pages redirect authenticated users to `/dashboard`. These need to point to `/login` (or `/app`) instead so users land in chat:

- **`src/pages/Auth.tsx`** (lines 34, 53): Change `/dashboard` to `/login`
- **`src/pages/LoginPage.tsx`**: Handled by rewrite (step 1)
- **`src/pages/BeginPage.tsx`**: No longer used (step 2)

### 5. Update the hero nav links

**File: `src/components/landing/orchid-hero.tsx`** -- The `/login` and menu links should still point to `/login`. The "Continue on web" option in the tap-to-start sheet (`qr-orchid.tsx`) currently navigates to `/begin` -- update it to navigate to `/login`.

**File: `src/components/landing/qr-orchid.tsx`** -- Change the "Continue on web" `navigate('/begin')` to `navigate('/login')`.

### 6. Clean up unused pages

**Files to remove from routes (but keep files for now):**
- `BeginPage.tsx` -- no longer routed
- `Auth.tsx` -- check if still routed (it's not in App.tsx routes, so already unused)

---

## Technical summary

| File | Action |
|------|--------|
| `src/pages/LoginPage.tsx` | Rewrite to use PwaAuth/PwaOnboarding/PwaChat lifecycle (same as AppPage) |
| `src/App.tsx` | Change `/begin` and `/signup` routes to redirect to `/login`; remove BeginPage import |
| `src/pages/Onboarding.tsx` | Remove `connectTelegram` step; navigate to `/login` on complete |
| `src/components/landing/qr-orchid.tsx` | Change "Continue on web" from `/begin` to `/login` |
| `src/components/landing/orchid-hero.tsx` | Verify nav links point to `/login` (already should) |

### What stays the same
- `/app` route and AppPage behavior -- identical, untouched
- PwaAuth, PwaOnboarding, PwaChat components -- reused as-is
- Dashboard route -- still accessible via direct URL or navigation from chat
- Telegram bot flow -- completely independent, users discover it from start page
- Login.tsx and CreateAccount.tsx components -- kept in codebase but no longer used by main routes


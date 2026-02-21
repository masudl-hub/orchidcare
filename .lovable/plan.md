

# PWA Install Flow & Mobile Tap-to-Start Overhaul

## Audit Findings

### Why "Add to Home Screen" isn't appearing:
1. **Service worker is fine** -- `public/sw.js` exists, registers on load, handles `/~oauth` correctly
2. **Manifest is fine** -- has `name`, `short_name`, `start_url`, `display: standalone`, icons at 192 and 512
3. **The `InstallPrompt` component exists** but it only renders at the bottom of the `/app` auth screen (inside `AppPage.tsx`). It's never shown on the homepage or start page
4. **On iOS Safari**, there is no `beforeinstallprompt` event -- the only way to install is via Share > Add to Home Screen. The current code shows a hint for this, but only on `/app`
5. **On Chrome/Android**, the `beforeinstallprompt` event fires but the `InstallPrompt` component captures it only if the user is on `/app`

### Current "tap to start" behavior on mobile:
- On touch devices, tapping the orchid in the start page immediately opens `t.me/orchidcare_bot` via deep link
- No option to install PWA or choose between Telegram/web
- QR morph is desktop-only (correct)

---

## Plan

### 1. Create a shared PWA install hook

Extract the `beforeinstallprompt` capture logic from `InstallPrompt.tsx` into a reusable hook: `src/hooks/use-pwa-install.ts`

This hook will:
- Listen for `beforeinstallprompt` globally and store the deferred prompt
- Detect iOS Safari for the manual hint
- Detect if already installed as standalone
- Expose `canInstall`, `isIos`, `isStandalone`, and `triggerInstall()` function
- Be usable from any component (start page, login page, orchid hero)

### 2. Redesign mobile "tap to start" in QROrchid

Currently on mobile tap: immediately opens Telegram deep link.

New behavior on mobile tap: show a small action sheet / modal with two options:
- **"Open in Telegram"** -- opens the deep link (current behavior)
- **"Add to Home Screen"** -- if Chrome/Android, triggers the native install prompt via `triggerInstall()`. If iOS, shows the Share hint
- **"Continue on web"** -- navigates to `/begin` (sign up flow)

On desktop: keep the existing QR morph behavior unchanged.

**File:** `src/components/landing/qr-orchid.tsx`
- Import `usePwaInstall` hook
- Replace the direct `window.location.href = DEEP_LINK` with showing a choice modal
- Create a simple inline action sheet component (styled to match the dark monospace aesthetic)

### 3. Wire mobile login to surface PWA install

On the orchid hero page, when a mobile user taps "Login" or "welcome back":
- Navigate to `/login` as usual (this already works)
- But also show the install prompt on the login page

**File:** `src/pages/LoginPage.tsx` (or `src/components/Login.tsx`)
- Add `InstallPrompt` at the bottom of the login page, similar to how it's on `/app`
- Use the shared `usePwaInstall` hook

### 4. Update `InstallPrompt` to use the shared hook

Refactor `src/components/pwa/InstallPrompt.tsx` to use `usePwaInstall` instead of duplicating the logic. This keeps it DRY.

### 5. Show install prompt on the homepage too

Add the `InstallPrompt` banner to the orchid hero page on mobile so users see it when they first land.

**File:** `src/components/landing/orchid-hero.tsx` or `src/pages/OrchidPage.tsx`
- Render `InstallPrompt` fixed at the bottom on mobile only

---

## Technical Details

### New file: `src/hooks/use-pwa-install.ts`
```typescript
// Returns: { canInstall, isIos, isStandalone, triggerInstall }
// canInstall = true when beforeinstallprompt was captured (Chrome/Android)
// isIos = true on iOS Safari (manual Add to Home Screen)
// triggerInstall() calls deferredPrompt.prompt()
```

### Files to modify:
1. `src/hooks/use-pwa-install.ts` -- New shared hook
2. `src/components/landing/qr-orchid.tsx` -- Mobile tap shows choice modal instead of auto-opening Telegram
3. `src/components/pwa/InstallPrompt.tsx` -- Refactor to use shared hook
4. `src/pages/LoginPage.tsx` -- Add InstallPrompt at bottom
5. `src/pages/OrchidPage.tsx` -- Add InstallPrompt at bottom on mobile

### Approach:
- Desktop behavior is completely unchanged (QR morph, no install prompts)
- All new UI follows the existing monospace/dark aesthetic
- The choice modal on mobile is minimal: dark background, white mono text, two/three tappable options

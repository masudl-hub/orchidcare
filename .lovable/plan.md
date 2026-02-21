

# Mobile Hero Fixes -- Round 3

## Issues Identified (verified via mobile screenshot)

1. **Tagline invisible**: "plant care made easy" has `color: 'white'` on a white background -- completely invisible
2. **Page scrolls**: Hero uses `min-h-screen` allowing overflow; the fixed `InstallPrompt` at bottom adds extra space
3. **Touch scroll not blocked**: The `touchmove` event is not prevented, so swiping the carousel also scrolls the page
4. **No "/add-to-home" option in navigation menu**: The user wants a visible menu item alongside /start, /get-demo, /login
5. **"Tap to start" action sheet missing "Add to Home Screen"**: The `canInstall || isIos` guard in `qr-orchid.tsx` hides the option in most browsers -- it should always be shown
6. **InstallPrompt banner at bottom is ugly/redundant**: White text on white page, and the `/add-to-home` menu item replaces its purpose

Note: The back button is already hidden on mobile (`hidden md:block` in `back-button.tsx`). No change needed there.

---

## Changes

### 1. Fix tagline color (`orchid-hero.tsx`, line 453)

Change `color: 'white'` to `color: 'rgba(0,0,0,0.35)'` -- a subtle muted black that's visible on white and matches the monospace aesthetic.

### 2. Lock hero to viewport (`orchid-hero.tsx`, line 268)

Change `min-h-screen` to `h-screen` and ensure `overflow-hidden` is applied. This prevents any page scroll on the hero.

### 3. Block touch scroll during swipe (`orchid-hero.tsx`, lines 192-221)

Add a `touchmove` listener with `e.preventDefault()` to stop the browser from scrolling the page while the user is swiping the carousel. The touch handlers currently use `passive: true` for `touchstart` -- we need to add a non-passive `touchmove` handler that prevents default scrolling.

### 4. Add "/add-to-home" to navigation menu (`orchid-hero.tsx`, lines 433-447)

Add a fourth menu link:
```
/add-to-home
```

- Import `usePwaInstall` hook
- On tap: if `canInstall`, call `triggerInstall()`; if iOS, show a brief inline hint; otherwise show a generic browser instruction
- Only show on mobile (use `md:hidden` class)
- Styled identically to `/start`, `/get-demo`, `/login`

### 5. Always show "Add to Home Screen" in tap-to-start sheet (`qr-orchid.tsx`, line 217)

Remove the `(canInstall || isIos) && !isStandalone` guard. Always render the button on mobile. When tapped:
- Chrome/Android with `canInstall`: triggers native install prompt
- iOS: shows the share hint text
- Other browsers: shows a brief instruction about using browser menu

### 6. Remove fixed InstallPrompt banner (`OrchidPage.tsx`, lines 65-68)

Delete the `<div className="md:hidden">` wrapper with `<InstallPrompt />` since the `/add-to-home` menu item replaces this functionality and looks much better.

---

## Technical Details

### Files to modify:
1. **`src/components/landing/orchid-hero.tsx`**
   - Line 268: `min-h-screen` to `h-screen`
   - Lines 192-221: Add `touchmove` with `preventDefault` (non-passive)
   - Line 453: Change tagline color to `rgba(0,0,0,0.35)`
   - Lines 433-447: Add `/add-to-home` link with `usePwaInstall` hook
   - Import `usePwaInstall` at top

2. **`src/components/landing/qr-orchid.tsx`**
   - Line 217: Remove `(canInstall || isIos) && !isStandalone` guard; always show "Add to Home Screen" button
   - Add fallback text for unsupported browsers

3. **`src/pages/OrchidPage.tsx`**
   - Lines 65-68: Remove fixed InstallPrompt div
   - Remove `InstallPrompt` import

### No changes needed:
- `back-button.tsx` -- already hidden on mobile via `hidden md:block`
- Desktop behavior -- all changes scoped with mobile-only classes or touch detection

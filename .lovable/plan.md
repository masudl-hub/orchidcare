

# Browser-Specific "Add to Home Screen" Visual Guide

## Problem

The current install hint is a generic one-liner ("tap share button, scroll down..."). It doesn't detect which browser the user is in, and provides no visual guidance. From your screenshots, the actual flows are quite different between Safari and Chrome on iOS, and users need step-by-step hand-holding.

## Browser Detection

Enhance `use-pwa-install.ts` to expose granular browser info instead of just `isIos`:

- **iOS Safari**: `navigator.userAgent` contains "Safari" but NOT "CriOS" or "FxiOS"
- **iOS Chrome**: `navigator.userAgent` contains "CriOS"
- **iOS Firefox**: `navigator.userAgent` contains "FxiOS"

Return a new `iosBrowser` field: `'safari' | 'chrome' | 'other' | null`

## The Visual Guide Component

Create a new `src/components/pwa/AddToHomeGuide.tsx` -- a full-screen overlay with a multi-step walkthrough. Monospace aesthetic, dark background, matching the project style.

### Structure: Step-by-step carousel

The guide advances through steps with a "next" button. Each step shows:
- A step number (1, 2, 3)
- A short instruction in monospace
- A **drawn/CSS illustration** of the browser UI element they need to tap (not screenshots -- pure CSS recreations matching your app's pixel/monospace aesthetic)
- An animated arrow/pulse pointing to where the button is on screen

### iOS Safari Flow (3 steps)

Based on your screenshots:

**Step 1**: "tap the share button"
- CSS illustration of the iOS Safari share icon (the square-with-up-arrow) positioned at bottom-center of screen
- An animated arrow pointing down toward where it sits in the Safari toolbar
- Show a simplified Safari bottom bar with the share icon highlighted

**Step 2**: "scroll down and tap 'more'"
- CSS illustration of the share sheet with the three-dot "More" circle icon highlighted
- Shows the share sheet row with Copy, Add to Bookmarks, Add to Reading List, More -- with More pulsing

**Step 3**: "tap 'add to home screen'"
- CSS illustration of the "Add to Home Screen" row item with the plus-in-square icon
- Clean, simple representation of the menu list

### iOS Chrome Flow (3 steps)

Based on your screenshots:

**Step 1**: "tap the share icon"
- CSS illustration of the Chrome address bar with the share icon (square-with-up-arrow) in the top-right
- Arrow pointing to top-right corner

**Step 2**: "tap 'more'"
- CSS illustration showing the share sheet with the three-dot "More" circle at bottom-right
- The More icon is highlighted/pulsing

**Step 3**: "tap 'add to home screen'"
- Same as Safari step 3 -- the "Add to Home Screen" row with the plus icon

### Design Language

All illustrations use:
- Monospace font (`ui-monospace`)
- White on near-black (`rgba(10,10,10,0.97)`)
- Thin borders (`1px solid rgba(255,255,255,0.15)`)
- CSS-drawn icons (no images) -- simple geometric shapes for share icon, dots, plus-square
- Subtle pulse animation on the element they need to tap
- Step counter: `1/3`, `2/3`, `3/3` in muted text

### Controls

- "next" button advances steps (styled like existing "got it" button)
- On final step, button says "got it"
- Tap backdrop to dismiss at any time
- Small "x" in top-right corner

## Integration Points

### 1. `src/hooks/use-pwa-install.ts`

Add `iosBrowser` detection:

```text
return { canInstall, isIos, iosBrowser, isStandalone, triggerInstall }
```

Where `iosBrowser` is `'safari' | 'chrome' | 'other' | null`.

### 2. `src/components/landing/orchid-hero.tsx`

Replace the current `showIosHint` overlay (lines 493-546) with the new `<AddToHomeGuide>` component. Pass `iosBrowser` to it so it picks the right flow.

### 3. `src/components/landing/qr-orchid.tsx`

When tapping "Add to Home Screen" in the action sheet and `canInstall` is false, show the same `<AddToHomeGuide>` instead of just displaying text on the button.

## Files

| File | Action |
|------|--------|
| `src/hooks/use-pwa-install.ts` | Add `iosBrowser` detection (`'safari' \| 'chrome' \| 'other' \| null`) |
| `src/components/pwa/AddToHomeGuide.tsx` | New file -- multi-step visual walkthrough component |
| `src/components/landing/orchid-hero.tsx` | Replace inline hint overlay with `<AddToHomeGuide>` |
| `src/components/landing/qr-orchid.tsx` | Wire up guide for action sheet's "Add to Home Screen" button |


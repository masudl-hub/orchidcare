

# Mobile Responsiveness Plan

## Problem
The landing page is completely broken on mobile (as shown in the screenshot). The "ORCHID" text at 160px font size overflows the viewport, and the plant carousel is clipped. The layout was designed for desktop only.

## Scope
Fix mobile responsiveness across the main user-facing pages **without changing the desktop experience at all**. This means using responsive breakpoints (e.g., `md:` prefixes) so desktop stays identical.

## Pages and Components to Fix

### 1. OrchidHero (`src/components/landing/orchid-hero.tsx`) -- Primary Fix
This is the page shown in the screenshot. Issues:
- `text-[160px]` "ORCHID" title overflows on any screen under ~900px
- Carousel is fixed at 180x280px, clips on narrow screens
- Navigation links at 22px are fine but could use tighter spacing
- Canvas de-pixelation dimensions (180x280) are fixed

**Changes:**
- Scale the "ORCHID" text down on mobile: `text-[48px] sm:text-[80px] md:text-[120px] lg:text-[160px]`
- Scale carousel/canvas dimensions proportionally on mobile (e.g., 100x160 on small screens)
- Adjust the carousel negative margins (`mx-[-40px]`) for mobile
- Reduce padding on mobile
- Keep all desktop values behind `md:` or `lg:` breakpoints so nothing changes on desktop

### 2. StartPage (`src/components/landing/start-page.tsx`)
- Already uses `px-8 md:px-16` which is good
- Max-width of 520px should work on mobile
- Font sizes (18px, 22px) may need slight reduction on small screens
- Scroll-snap sections at `min-h-screen` should work

**Changes:**
- Reduce `/start` text and paragraph font sizes slightly on mobile
- Ensure back button positioning works with safe areas

### 3. PlantCarousel (`src/components/landing/plant-carousel.tsx`)
- Fixed at 180x280px -- needs to accept dynamic sizing from parent

**Changes:**
- Accept optional `width` and `height` props, defaulting to current values
- OrchidHero passes smaller dimensions on mobile

### 4. DemoPage (`src/pages/DemoPage.tsx`)
- Already has responsive canvas height logic (`getCanvasHeightPercent`)
- Uses `env(safe-area-inset-top)` for the back button -- good
- May need minor input bar adjustments

**Changes:**
- Verify input bar doesn't overflow on narrow screens (likely already okay)
- Minor padding tweaks if needed

### 5. LoginPage / Login Component (`src/components/Login.tsx`)
- Uses fixed character grid layout -- may need scaling
- Likely already workable but should verify

**Changes:**
- Ensure the `/LOGIN` text and form fit on 320px screens
- Reduce font sizes behind mobile breakpoints if needed

### 6. Meta viewport and PWA
- Check `index.html` has proper viewport meta tag
- `manifest.json` already has portrait orientation -- good

## Technical Approach
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) for all changes
- Use CSS `clamp()` for fluid typography where appropriate
- Add `env(safe-area-inset-*)` padding for notched devices
- Never alter any value at the `md:` breakpoint and above (desktop stays untouched)

## File Changes Summary

| File | Change |
|------|--------|
| `src/components/landing/orchid-hero.tsx` | Responsive font size, carousel size, margins, padding |
| `src/components/landing/plant-carousel.tsx` | Accept dynamic width/height props |
| `src/components/landing/start-page.tsx` | Smaller font sizes on mobile, safe area padding |
| `src/pages/DemoPage.tsx` | Minor mobile padding tweaks if needed |
| `src/components/Login.tsx` | Ensure form fits narrow screens |
| `index.html` | Verify viewport meta tag exists |


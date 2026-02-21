

# Mobile UX Overhaul

This plan addresses the broken mobile experience across the app while preserving the desktop design exactly as-is. All changes target screens below 768px (the existing `MOBILE_BREAKPOINT`).

---

## 1. Remove the placeholder rectangle from the de-pixelation animation (all screens)

**Problem:** The `createPlaceholderImage()` function in `orchid-hero.tsx` generates a colored rectangle (purple/green/brown blocks) that doesn't look like the real pixelated orchid. It was meant to bridge the loading gap but looks wrong.

**Fix:**
- Remove `createPlaceholderImage()` entirely from `orchid-hero.tsx`
- Instead, start the de-pixelation only after the real image loads (the `fullImg` path)
- Keep the loading progress bar at top as visual feedback while the image loads
- On the canvas, show nothing (transparent) until the real image is ready, then run the de-pixelation from step 0
- This applies to both desktop and mobile

---

## 2. Fix "plant care made easy" text positioning on mobile

**Problem:** The tagline overlaps the carousel and annotation on small screens. The large negative margin (`mb-[-40px]` / `mb-[-100px]`) designed for desktop causes collisions on mobile.

**Fix:**
- On mobile (`md:` breakpoint), reduce the negative margin to something like `mb-[-12px]` so the text sits ~8px above the orchid carousel
- Reduce font size on mobile (e.g., `text-[13px]` instead of `16px`)
- Keep the desktop values unchanged via responsive classes

---

## 3. Fix scroll-to-carousel on the homepage

**Problem:** Wheel events on the orchid-hero page prevent default scrolling but on mobile (touch), there's no way to swipe through the carousel. The page just scrolls normally and the carousel is stuck.

**Fix:**
- On touch devices, add touch/swipe gesture handling (touchstart/touchmove/touchend) to cycle through the carousel
- Keep the existing wheel handler for desktop
- Detect touch via the existing `useIsTouch()` hook

---

## 4. Hide the BackButton on mobile

**Problem:** The `BackButton` component (`absolute top-8 left-8`) overlaps with page content on small screens (visible in screenshots: back button over content on /demo, /proposal, start-page features).

**Fix:**
- Add `hidden md:block` to the BackButton component so it's invisible on mobile (under 768px)
- Mobile devices have their own native back gesture/button
- This is a one-line change in `back-button.tsx` that affects all pages using it

---

## 5. Fix StartPage feature sections for mobile

**Problem:** The two-column layout in feature sections (e.g., `identify-feature.tsx` uses `flex-row` with side-by-side chat mock + description) breaks on mobile -- content falls into margins, requires horizontal scrolling.

**Fix:**
- In `identify-feature.tsx`, change the content grid from `flex-row` to `flex-col` on mobile (`flex-col md:flex-row`)
- Reduce horizontal padding on mobile (`px-4 md:px-10 lg:px-24`)
- Apply the same pattern to `diagnosis-feature.tsx`, `memory-feature.tsx`, `proactive-feature.tsx`, `shopping-feature.tsx`, `guides-feature.tsx`, `live-feature.tsx`, and `cta-feature.tsx`
- Reduce large pixel-art heading font sizes on mobile (e.g., `fontSize: "32px"` becomes responsive)
- Cap mock chat and description panel widths to `100%` on mobile

---

## 6. General mobile polish pass

Additional responsive fixes across the app:

- **Annotation callout** in `orchid-hero.tsx`: Hide or reposition the SVG line + label on mobile since it extends off-screen
- **Start page decrypt text**: Reduce font size on mobile for the `/start` text and decrypted paragraph
- **Feature figure annotations** (e.g., "FIG 2.1 -- SPECIES IDENTIFICATION"): Reposition or hide on mobile to avoid overlap
- **Login/Begin pages**: Already look acceptable on mobile (confirmed via screenshots), no changes needed

---

## Technical Details

### Files to modify:
1. **`src/components/landing/orchid-hero.tsx`** -- Remove placeholder, fix tagline positioning, add touch swipe, fix annotation on mobile
2. **`src/components/ui/back-button.tsx`** -- Add `hidden md:block` for mobile hiding
3. **`src/components/landing/identify-feature.tsx`** -- Responsive flex direction, padding, font sizes
4. **`src/components/landing/diagnosis-feature.tsx`** -- Same responsive pattern
5. **`src/components/landing/memory-feature.tsx`** -- Same responsive pattern
6. **`src/components/landing/proactive-feature.tsx`** -- Same responsive pattern
7. **`src/components/landing/shopping-feature.tsx`** -- Same responsive pattern
8. **`src/components/landing/guides-feature.tsx`** -- Same responsive pattern
9. **`src/components/landing/live-feature.tsx`** -- Same responsive pattern
10. **`src/components/landing/cta-feature.tsx`** -- Same responsive pattern
11. **`src/components/landing/start-page.tsx`** -- Mobile font size adjustments

### Approach:
- All changes use responsive Tailwind classes or `isMobile` checks
- Desktop layout is never touched -- all mobile styles are additive via breakpoint prefixes
- The 768px breakpoint is used consistently (matching existing `MOBILE_BREAKPOINT`)


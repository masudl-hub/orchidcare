

# Mobile Refinements -- Round 2

## 1. Restore annotations on mobile in orchid-hero.tsx

The previous change added `hidden md:block` to the annotation callout. This should be reverted -- the annotation should be visible on all screen sizes.

**File:** `src/components/landing/orchid-hero.tsx`
- Remove `hidden md:block` from the annotation div (line 326)
- Keep all other annotation logic as-is

---

## 2. Move "plant care made easy" to bottom-center of page

Currently the tagline sits above the ORCHID text. Per the user's screenshot reference, it should be at the **bottom center** of the viewport, a few pixels above the bottom edge.

**File:** `src/components/landing/orchid-hero.tsx`
- Remove the tagline from its current position (above ORCHID, lines 299-305)
- Add it as an absolutely positioned element at the bottom of the container: `absolute bottom-6 left-0 right-0 text-center`
- Keep the reveal animation behavior

---

## 3. Reorder feature sections: text/headers BEFORE mockups on mobile

Currently, several features show the mockup first on mobile (via `order-1` on the mockup div), then the text description. The user wants the header/description to come first on mobile for the following features:

### identify-feature.tsx (lines 974-988)
- Currently: MockChat is first in DOM, FeatureDescription second. On mobile they stack in that order.
- Fix: Add `order-2 md:order-1` to MockChat div, `order-1 md:order-2` to FeatureDescription div -- so description appears first on mobile.

### diagnosis-feature.tsx (lines 814-838)
- Currently has `order-2 md:order-1` on description (correct on desktop, but on mobile order-2 means it comes second).
- Fix: Swap to `order-1 md:order-2` for description, `order-2 md:order-1` for mockup -- so description appears first on mobile.

### proactive-feature.tsx (lines 709-728)
- Currently has `order-2 md:order-1` on description, `order-1 md:order-2` on notifications.
- Fix: Same swap -- description gets `order-1 md:order-2`, notifications get `order-2 md:order-1`.

### live-feature.tsx (lines 162-340)
- Uses `grid grid-cols-1 md:grid-cols-2`. Description is first in DOM, video second. On mobile this should already be correct (description first). Verify no order classes are backwards.

### shopping-feature.tsx (lines 316-415)
- Currently: description is first (left), store listings second (right). On mobile with `grid-cols-1`, description comes first naturally. This is already correct order-wise.
- However, the PixelMap is currently inside the description column (left side). On mobile, the user wants the map to appear AFTER the "Where can I get neem oil nearby?" user message.
- Fix: Move the PixelMap from the left (description) column into the right (store listings) column, placed after the user message bubble and before the store results.

---

## 4. Fix "Local Shopping" title overlap with "LOCAL COMMERCE"

From the screenshot, the "Local Shopping" pixel heading is overlapping with the "FIG 2.5 -- LOCAL COMMERCE" annotation. On mobile, the heading text may collide with the figure annotation.

- Add `mt-8 md:mt-0` to the description heading to push it down on mobile, giving the annotation room.

---

## 5. Apply same patterns to /proposal page

The proposal page at `src/pages/Proposal.tsx` uses similar layouts. Key fixes:

- The **bento grid** (AI Technologies section, line 1870) uses `gridTemplateColumns: 'repeat(4, 1fr)'` which creates 4 narrow columns on mobile. Fix: change to `grid-cols-1 md:grid-cols-4` or use responsive classes.
- The `col-span-2` cells need to become `col-span-1 md:col-span-2` on mobile so they don't overflow.
- The **Problem Statement** grid (line 1823) uses `grid-cols-2 md:grid-cols-4` which is already decent but may need `grid-cols-1 md:grid-cols-4` for very narrow screens.
- The **stats grid** (line 2000) `grid-cols-3` may need font size reduction on mobile.
- The **Target Users** grid (line 2044) `md:grid-cols-3` already collapses to 1 column -- correct.

---

## Technical Summary

### Files to modify:
1. `src/components/landing/orchid-hero.tsx` -- Restore annotation visibility, move tagline to bottom-center
2. `src/components/landing/identify-feature.tsx` -- Swap mobile order so description comes first
3. `src/components/landing/diagnosis-feature.tsx` -- Swap mobile order so description comes first
4. `src/components/landing/proactive-feature.tsx` -- Swap mobile order so description comes first
5. `src/components/landing/shopping-feature.tsx` -- Move PixelMap after user message on mobile, fix title overlap
6. `src/pages/Proposal.tsx` -- Make bento grid responsive, fix col-span on mobile

### Approach:
- Only CSS/order class changes and minor JSX restructuring
- Desktop layout remains completely unchanged
- All changes use Tailwind responsive prefixes (`md:`)

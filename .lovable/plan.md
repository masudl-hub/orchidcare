

# Fix Safari "Add to Home Screen" Guide -- Accurate 4-Step Flow

## Problem

The current Safari guide is wrong. It shows a share icon in the center of a bottom toolbar (like old Safari) which doesn't match modern iOS Safari at all. The actual flow from your screenshots is 4 steps, not 3.

## Correct Safari Flow (from your screenshots)

**Step 1**: Tap the **three dots (...)** in the bottom-right corner of Safari's toolbar
- Illustration: Safari bottom bar with back arrow, address bar, reload icon, and the three-dot menu button highlighted/pulsing on the far right

**Step 2**: Tap **"Share"** at the top of the popup menu
- Illustration: A popup menu showing "Share" (with share icon) highlighted at top, then dimmed items: "Add to Bookmarks", "Add Bookmark to...", separator, "New Tab", "New Private Tab"

**Step 3**: Tap **"More"** in the share sheet
- Illustration: The share sheet action row with circle icons: Copy, Add to Bookmarks, Add to Reading List, and **More (...)** highlighted/pulsing on the right

**Step 4**: Tap **"Add to Home Screen"**
- Illustration: List menu showing dimmed "Add to Favorites", "Add to Quick Note", "Find on Page", then highlighted **"Add to Home Screen"** with the plus-in-square icon

## Chrome Flow (stays 3 steps, already mostly correct)

Keeping the existing 3 steps but verifying they match the screenshots from the earlier round.

## Changes

### File: `src/components/pwa/AddToHomeGuide.tsx`

Rewrite `safariSteps()` to return 4 steps matching the actual Safari UI:

**Step 1 illustration** -- Safari bottom toolbar:
- CSS-drawn bar with: back chevron icon, address bar pill showing "orchid.masudlewis.com", reload icon, and the three-dot (***) button on the right side pulsing
- Arrow pointing to the three-dot button

**Step 2 illustration** -- Popup menu:
- White-on-dark menu list with:
  - Share (share icon) -- **highlighted/pulsing**
  - Add to Bookmarks (bookmark icon) -- dimmed
  - Add Bookmark to... (book icon) -- dimmed
  - separator line
  - New Tab (+ icon) -- dimmed
  - New Private Tab (hand icon) -- dimmed
- Arrow pointing to Share

**Step 3 illustration** -- Share sheet action circles:
- Row of circular gray icons matching your screenshot: Copy, Add to Bookmarks, Add to Reading List, **More (...)** -- with More highlighted/pulsing
- Arrow pointing to More

**Step 4 illustration** -- Menu list:
- List items: Add to Favorites (star), Add to Quick Note, Find on Page -- all dimmed
- **Add to Home Screen** (plus-in-square icon) -- highlighted/pulsing

### Updated instructions text:
1. "tap the three dots in the bottom right"
2. "tap 'Share' at the top"
3. "tap 'More' with the three dots"
4. "tap 'Add to Home Screen'"

### Step counter updates automatically since `steps.length` is now 4 for Safari (shows "step 1/4", "step 2/4", etc.)

## Technical Details

Only one file changes: `src/components/pwa/AddToHomeGuide.tsx`

The `safariSteps()` function gets rewritten with 4 steps and updated CSS illustrations. All helper components (`ShareIcon`, `MoreDotsIcon`, `PlusSquareIcon`, `MenuRow`, `PulseArrow`) are reused. A new `ThreeDotsIcon` may be added for the horizontal three-dot Safari menu button (distinct from the circular `MoreDotsIcon`).

No changes to `use-pwa-install.ts`, `orchid-hero.tsx`, or `qr-orchid.tsx` -- the integration is already wired up correctly.

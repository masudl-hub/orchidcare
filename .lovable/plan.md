
# Fix Developer Bottom Nav + Add /developer/docs Route

## Problem
The developer context bottom nav currently shows: **LayoutDashboard, Terminal, | FileText, Leaf, Chat, Call** -- which reads as two "dashboard-like" icons before the separator. It should mirror the desktop header: **Dashboard, Docs | Collection, Chat, Call**.

Also, `/developer/docs` doesn't exist as a route yet.

## Changes

### 1. Fix BottomNav developer items (`src/components/navigation/BottomNav.tsx`)

Replace the developer nav items to match the header exactly:

```
LayoutDashboard (/developer)  FileText (/developer/docs)  |  Leaf (/dashboard/collection)  MessageSquare (/chat)  Phone (/call)
```

- Remove the redundant Terminal icon -- the LayoutDashboard icon already represents the developer dashboard
- Move the separator to after FileText (docs), before Leaf (collection)

### 2. Add `/developer/docs` route (`src/App.tsx`)

Add a new route that renders `DeveloperPlatform` with the docs tab active:

```
<Route path="/developer/docs" element={<ProtectedRoute><DeveloperPlatform /></ProtectedRoute>} />
```

### 3. Make DeveloperPlatform respond to URL (`src/pages/DeveloperPlatform.tsx`)

Read the current path to set the initial tab:
- `/developer/docs` opens the "docs" tab
- `/developer` opens the "dashboard" tab

This way the page responds to direct navigation from the bottom nav instead of relying only on internal tab state.

## Files Modified

| File | Change |
|------|--------|
| `src/components/navigation/BottomNav.tsx` | Fix developer nav: 5 items (Dashboard, Docs, \|, Collection, Chat, Call) |
| `src/App.tsx` | Add `/developer/docs` route |
| `src/pages/DeveloperPlatform.tsx` | Read URL path to set initial active tab |

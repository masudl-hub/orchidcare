

# Migrate Orchid Project

Full copy of the Orchid plant care AI app from the source project into this one.

## Batch 1: Config Files
- Copy `tailwind.config.ts` (custom colors, fonts, animations, border-radius)
- Copy `index.html` (PWA meta tags, Telegram SDK, service worker)
- Copy `components.json` (already identical)
- Install new dependencies: `@fontsource/instrument-serif`, `@google/genai`, `framer-motion`, `jspdf`, `lenis`, `pixi.js`, `qrcode-generator`, `react-markdown`

## Batch 2: Core Source Files
- Copy `src/index.css`, `src/App.tsx`, `src/App.css`, `src/main.tsx`
- Copy `src/types/qrcode-generator.d.ts`
- Copy `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`

## Batch 3: UI Components (src/components/ui/)
- Copy all 49 UI component files (many already exist but may have customizations)

## Batch 4: App Components
- Copy `src/components/call/` (5 files: CallScreen, CallControls, AnnotationOverlay, CallErrorBoundary, OrchidAvatar)
- Copy `src/components/dashboard/` (2 files: Dashboard, SystemProtocols)
- Copy `src/components/demo/` (6 files + artifacts subfolder with 7 files)
- Copy `src/components/figma/` (1 file: ImageWithFallback)
- Copy `src/components/landing/` (25+ files: Hero, Nav, feature sections, QR canvas, etc.)
- Copy `src/components/plants/` (1 file: PlantDetail)
- Copy root components: BrutalistTooltip, ConnectTelegram, CreateAccount, LinkPhone, Login, NavLink, OnboardingComplete, ProfileConfig, SmoothScroll

## Batch 5: Pages (16 pages)
- Auth, BeginPage, Dashboard, DemoPage, DevCallPage, Explorations, Index, LiveCallPage, LoginPage, NotFound, Onboarding, OrchidPage, PixelGarden, Plants, Proposal, Settings

## Batch 6: Hooks, Contexts & Lib
- Copy `src/hooks/` (8 files including call/ subfolder)
- Copy `src/contexts/AuthContext.tsx`
- Copy `src/lib/` (utils, theme, demoLimit, orchid-grid, qr-matrix, pixel-canvas/ with 6+ files including precomputed formations JSON)

## Batch 7: Edge Functions
- Copy `supabase/functions/_shared/` (5 files: auth, context, research, tools, types)
- Copy 6 edge functions: call-session, demo-agent, dev-call-proxy, orchid-agent, proactive-agent, telegram-bot

## Batch 8: Public Assets
- Copy `public/manifest.json`, `public/sw.js`, `public/sad_palm.png`, `public/mites_palm.png`, videos
- Copy `public/icons/` (2 PWA icons)
- Copy `public/botanical-pixels/` (14 images)
- Copy `public/prop_pothos/` (8 images)
- Copy `public/plant_assets_art/` (~80 plant folders, ~600+ assets)
- Copy `public/tools_art/` (~35 tool folders, ~280+ assets)

## Batch 9: Docs & Root Files
- Copy `docs/` folder (5 markdown files: DATABASE_SCHEMA, MIGRATION, REBUILD_PROMPT, SECRETS, VIDEO_GENERATION)
- Copy root markdown files: DEMO_PAGE_SPEC.md, ORCHID_DECISIONS.md, PIXEL_CANVAS_SPEC.md

## Notes
- Database migrations will NOT be copied (they need to be applied via Supabase)
- `.env`, `package.json`, `package-lock.json` excluded per instructions
- Supabase connection will need to be configured separately on this project
- Secrets (API keys etc.) will need to be re-added manually


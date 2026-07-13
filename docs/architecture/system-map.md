# Rich Bizness Universe — Locked System Map

This document is the source of truth for the rebuild. The platform is one connected product, not a collection of disconnected pages.

## Root architecture

```text
Rich-Bizness-Universe-/
├── apps/
│   ├── web/          # Vite frontend and visible route entry files
│   └── api/          # Vercel server functions and protected integrations
├── packages/         # Shared config, database, UI, auth, XP, realtime, media, payments, types
├── engines/          # Portal, avatar, Meta, Live, media, and shared game runtimes
├── games/            # 24 individual playable games
├── supabase/         # Migrations, Edge Functions, policies, triggers, storage, tests, generated types
├── infrastructure/   # Vercel, domains, security, monitoring, feature flags
├── scripts/          # Validation, sync, audits, production smoke, release
├── tests/            # Unit, integration, E2E, visual, performance, security
├── docs/             # Architecture, product, operations, testing
└── .github/          # Workflows, ownership, PR and issue controls
```

## One owner per critical system

- Browser Supabase client: `apps/web/src/core/supabase/client.ts`
- Server Supabase client: `apps/api/_shared/supabase-admin.ts`
- Auth session and route protection: `apps/web/src/core/auth/`
- Profile identity: `apps/web/src/core/identity/`
- XP browser display: `apps/web/src/core/xp/`
- XP awarding: protected Supabase processor/server function only
- Route registry: `packages/config/src/routes.ts`
- Table registry: `packages/config/src/tables.ts`
- Bucket registry: `packages/config/src/buckets.ts`
- Avatar runtime: `engines/avatar/`
- Portal runtime: `engines/portal/`
- Meta runtime: `engines/meta/`
- Live runtime: `engines/live/`
- Shared game runtime: `engines/game-runtime/`
- Individual game mechanics: `games/<game-slug>/`
- Stripe server logic: `apps/api/stripe/`
- LiveKit server logic: `apps/api/livekit/`

## Route entry rule

HTML files only mount page controllers. They do not own backend logic or duplicate shared systems.

```text
apps/web/index.html          -> root Portal entry
apps/web/portal.html         -> cinematic Portal
apps/web/tap-in.html         -> Auth UI
apps/web/profile.html        -> signed-in identity
apps/web/feed.html           -> Feed
apps/web/live.html           -> broadcast discovery/create
apps/web/watch.html          -> stream viewer
apps/web/music.html          -> music/podcast/radio
apps/web/gaming.html         -> 24-game universe
apps/web/meta.html           -> Meta world entry
```

## Visual and image design system

The rebuild does not treat every visual as one generic image. Each visual type has a defined owner and purpose.

```text
apps/web/public/
├── brand/
│   ├── logos/
│   ├── marks/
│   ├── backgrounds/
│   ├── portal-art/
│   ├── icons/
│   └── trailers/
├── images/
│   ├── portal/
│   ├── auth/
│   ├── profile/
│   ├── feed/
│   ├── gallery/
│   ├── live/
│   ├── music/
│   ├── sports/
│   ├── store/
│   ├── gaming/
│   ├── meta/
│   └── creator/
├── models/
│   ├── characters/{male,female,custom,npc}/
│   ├── outfits/
│   ├── accessories/
│   ├── vehicles/
│   ├── weapons/
│   ├── props/
│   ├── environments/
│   └── portals/
├── animations/
│   ├── locomotion/{idle,walk,jog,run,sprint,crouch,turn}/
│   ├── traversal/{jump,fall,land,climb,vault}/
│   ├── combat/
│   ├── weapons/
│   ├── driving/
│   ├── smoking/
│   ├── emotes/
│   ├── dancing/
│   ├── facial/
│   └── cinematics/
├── audio/{music,ambience,portal,footsteps,vehicles,weapons,interface,voices}/
├── shaders/{portal,smoke,skin,gold,hologram,post-processing}/
└── video/{intros,backgrounds,trailers,live-overlays}/
```

### Visual asset rules

1. Profile avatars, profile banners, 3D characters, game covers, game runtime assets, Live thumbnails, music covers, and Store product images are separate asset classes.
2. A profile image is never used as a 3D avatar model.
3. A banner is never used as a character asset.
4. 3D models must use GLB, GLTF, VRM, or FBX-compatible manifests.
5. Animation clips must declare skeleton compatibility, duration, loop mode, root motion, and state tags.
6. Every game owns its own cover art, scene assets, audio identity, effects, and runtime manifest.
7. High-resolution source art is preserved, while web delivery uses responsive AVIF/WebP/JPEG/PNG derivatives.
8. Mobile performance variants are required for heavy models, textures, video, shaders, and particle systems.
9. No placeholder is labeled complete or playable.

## Individual game contract

Each folder in `games/` must contain real game ownership:

```text
games/<slug>/
├── index.html
├── manifest.ts
├── game.ts
├── scene.ts
├── controls.ts
├── rules.ts
├── missions.ts
├── scoring.ts
├── save-schema.ts
├── assets.ts
├── mobile.ts
├── styles.css
└── tests/
```

All 24 game folders must have separate mechanics, rules, controls, scoring, saves, mobile behavior, and visual identity even when they share low-level engine utilities.

## Supabase contract

Supabase owns data, Auth, RLS, realtime, storage metadata, secure RPC/Edge Functions, XP processing, profile persistence, avatar manifests, game manifests, creator economy records, notifications, moderation, and operational logs.

GitHub owns frontend and server code. Vercel builds and serves that code. Supabase does not replace the actual 3D engine, game engine, visual assets, or page runtime.

## Vercel contract

- Frontend: `apps/web`
- Server functions: `apps/api`
- Framework: Vite
- Public environment values use `VITE_` prefixes.
- Secrets never use `VITE_` and never enter browser bundles.
- Production deployment is blocked when required environment variables, routes, game manifests, or imports are missing.

## No empty-folder deception

Git does not track empty folders. A directory is created only when it contains a real owner file, manifest, implementation, test, or documented contract. The repository must not be filled with fake empty folders presented as finished work.

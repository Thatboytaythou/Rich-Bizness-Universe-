# Rich Bizness Universe — Production Source of Truth Lock

**Status:** ACTIVE — FIRST-PRINCIPLES REBUILD
**Rule:** `main` is the canonical application. No rebuild/finish branch is the working application.

## Verified repository

- GitHub repository: `Thatboytaythou/Rich-Bizness-Universe-`
- Default branch: `main`
- Verified current main commit at lock update: `bff2361c7b75b712375ca3d95be19b0d1a4a6acf`
- `PR #85` is closed and is **not** the production working branch.
- Master rebuild record: GitHub Issue #86.

## Runtime ownership

- Frontend source: `apps/web`
- Server/API ownership: existing repository API contract; do not create a second backend owner
- Shared packages: `packages/`
- Runtime engines: `engines/`
- Individual game ownership: `games/<slug>/`
- Supabase migrations/functions/schema tooling: `supabase/`
- Architecture and operational documentation: `docs/`
- Vite root: `apps/web`
- Vite output: `apps/web/dist`
- Vercel framework: Vite

## Single-owner architecture

- Browser Supabase client: `apps/web/src/core/supabase/client.ts`
- Server Supabase client: `apps/api/_shared/supabase-admin.ts`
- Auth: `apps/web/src/core/auth/`
- Identity: `apps/web/src/core/identity/`
- Routes: `packages/config/src/routes.ts`
- Tables: `packages/config/src/tables.ts`
- Buckets: `packages/config/src/buckets.ts`
- Avatar: `engines/avatar/`
- Portal: `engines/portal/`
- Meta: `engines/meta/`
- Live: `engines/live/`
- Shared game runtime: `engines/game-runtime/`
- Game mechanics: `games/<game-slug>/`
- Stripe: `apps/api/stripe/`
- LiveKit: `apps/api/livekit/`

HTML route files mount controllers; they do not become alternate backend/shared-system owners.

## Verified Vercel project

- Team: `Rich Bizness LLC`
- Team ID: `team_OFXJ3TAQagI1I1ab7wSBEiyy`
- Project: `rich-bizness-llc`
- Project ID: `prj_uE9OskRnIuG83GHMLKRCzuRT0ZAJ`
- Git source: `Thatboytaythou/Rich-Bizness-Universe-`
- Production domain: `rich-bizness.com`

### Deployment synchronization rule

The exact Git commit being served by the production alias must match the intended `main` commit before a fix is called production-certified.

**Current synchronization state:**

- GitHub `main`: `bff2361c7b75b712375ca3d95be19b0d1a4a6acf`
- Latest observed Vercel production deployment: `dpl_5WakX9XnRMTNaMVsdTcgpHAgtbhE`
- Vercel production is not yet certified against the current main SHA.
- Current observed Vercel production state is `DEPLOYMENT_DISABLED`; this is an infrastructure/account state, not a GitHub build failure.

Do not call a GitHub-only change a production fix.

## Verified Supabase project

- Project: `Rich-Bizness-mobile`
- Project ref: `xfsrqomsiulswbalgknx`
- Region: `us-west-2`
- Status: `ACTIVE_HEALTHY`
- API URL: `https://xfsrqomsiulswbalgknx.supabase.co`

Supabase is the production source for Auth, Postgres data, RLS, Realtime, Storage metadata, secure RPCs, migrations, Edge Functions, XP processing, and operational state.

## RPC contract audit lock

- Production Supabase exposes **102 callable public database functions** relevant to the app contract; trigger-only functions are excluded.
- GitHub `apps/web/src/core/supabase/database.types.ts` was audited against that production function set.
- The contract was corrected in place on `main` to cover all 102 callable functions, including the previously missing admin, creator, DM, feed, gallery, game, gaming, live, music, notifications, podcast, profile, radio, search, sports, store, upload, watch, and settlement RPCs.
- Existing table/view type declarations were preserved; the fix is focused on the RPC contract.
- Previously loose contracts for `rb_feed_snapshot`, `rb_record_game_move`, `save_meta_avatar`, and other RPC argument/result shapes were tightened to the production-generated contract.
- The visual system and page CSS were not changed by this RPC contract fix.
- A live SQL smoke check confirmed `rb_feed_snapshot()` and `rb_search_snapshot('rich', null, 5)` both return JSON objects.

## First-principles rebuild rules

1. Inspect before changing.
2. Fix the owning implementation in place.
3. Prefer one contract and one owner over compatibility layers.
4. Never add a table, route, API, engine, or storage bucket without proving the existing contract cannot satisfy the requirement.
5. Keep database schema, RLS, RPCs, frontend calls, server handlers, and UI behavior aligned.
6. Remove proven duplication only when ownership and semantics are verified.
7. Protect the homepage/index, portal foundation, and global visual system from unrelated changes.
8. Performance, security, reliability, and mobile behavior are release requirements, not post-release polish.
9. Every production claim requires deployment and runtime evidence.

## Release verification chain

```text
GitHub main
  -> validation/build
  -> Vercel deployment
  -> production domain
  -> production Supabase project
  -> real user action
  -> runtime/log verification
  -> certification
```

## Current certification state

- GitHub canonical branch identified: YES
- Supabase production project identified: YES
- Vercel project identified: YES
- Architecture ownership identified: YES
- Master rebuild issue opened: YES (#86)
- Canonical web route validation expanded to all 53 explicit HTML entry points plus home
- Shared game route loader now registers all 28 game pages
- Canonical bucket contract now includes the active `podcast-video` bucket
- Production RPC contract synchronized to 102 callable database functions: YES
- GitHub main -> Vercel production synchronization: **NOT YET**
- Full visual/device certification: **NOT YET**
- Full production release certification: **NOT YET**

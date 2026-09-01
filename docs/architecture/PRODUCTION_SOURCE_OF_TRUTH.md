# Rich Bizness Universe — Production Source of Truth Lock

**Status:** ACTIVE
**Rule:** `main` is the canonical application. Do not use a rebuild/finish branch as the working application.

## Verified repository

- GitHub repository: `Thatboytaythou/Rich-Bizness-Universe-`
- Default branch: `main`
- Verified current main commit: `f6f730a53a37fad11a07b572dc412578add8d518`
- `PR #85` is closed and is **not** the production working branch.

## Runtime ownership

- Frontend source: `apps/web`
- Vercel server functions: `apps/api`
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

**Currently observed mismatch:**

- Production Vercel deployment commit: `8d638a288fc53dc25ac9f0ebc6d04ae13e6d3a19`
- Current GitHub `main`: `f6f730a53a37fad11a07b572dc412578add8d518`

Therefore the deployment chain is **not synchronized yet**. Do not call a GitHub-only change a production fix.

## Verified Supabase project

- Project: `Rich-Bizness-mobile`
- Project ref: `xfsrqomsiulswbalgknx`
- Region: `us-west-2`
- Status: `ACTIVE_HEALTHY`
- API URL: `https://xfsrqomsiulswbalgknx.supabase.co`

Supabase is the production source for Auth, Postgres data, RLS, Realtime, Storage metadata, secure RPCs, migrations, Edge Functions, XP processing, and operational state.

## Release verification chain

A change is production-certified only after all of these point to the same intended version:

```text
GitHub main
  -> GitHub validation/build
  -> Vercel deployment
  -> production domain
  -> production Supabase project
  -> real user action
  -> runtime/log verification
```

## Protected systems

Do not rewrite or replace the existing homepage/index, portal foundation, global visual system, route architecture, Supabase client architecture, or shared engines merely to solve a local defect. Repair the owning implementation in place.

## No parallel application rule

Do not create or use another rebuild/finish architecture as the application source of truth. Temporary branches are allowed only for an isolated surgical repair and must branch from current `main` and return to `main` after verification.

## Current certification state

- GitHub canonical branch identified: YES
- Vercel project identified: YES
- Supabase production project identified: YES
- Architecture ownership identified: YES
- PR #85 removed from active workflow: YES
- GitHub main -> Vercel production synchronization: **NOT YET**
- Full visual/device certification: **NOT YET**
- Full production release certification: **NOT YET**

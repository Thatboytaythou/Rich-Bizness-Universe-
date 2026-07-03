# Rich Bizness Build Command Center

This file tracks the live app rebuild so the work does not get lost between GitHub, Supabase, and Vercel.

## Current priority order

1. Stabilize index so it never black-screens and uses uploaded image assets.
2. Replace the flat portal ring with a cinematic city / portal / tower scene.
3. Keep live branding as `WE LIT🔥` everywhere.
4. Wire uploaded images from `/images` into index, avatar, gaming, music, sports, profile, and meta.
5. Finish XP to wallet logic: `1 XP = $0.01` display and backend conversion.
6. Finish Supabase RLS and policy hardening across public schema and storage.
7. Finish playable game engines and remove duplicate game layers.
8. Build real `/api` routes for health, config, domains, XP, games, sections, live, uploads, profile, and wallet.
9. Verify Vercel production deployment after each accepted batch.

## Files already touched

- `index.html`
- `src/main.js`
- `src/index-clean.css`
- `src/index-portal.css`
- `src/portal-phone.js`
- `src/rb-assets.js`
- `src/realtime-data.js`
- `src/rb-personality.js`
- `src/rb-personal-build.css`
- `src/rb-xp.js`
- `src/game-room.js`
- `src/game-room.css`
- `src/rb-elite-games.js`
- `api/index.js`
- `api/config.js`
- `api/xp.js`
- `api/routes.js`
- `api/domains.js`
- `api/games.js`
- `api/sections.js`
- `docs/SECURITY_HARDENING_STATUS.md`

## Backend work already applied live

- `rb_personality_settings` RLS enabled.
- `active_brand_assets` rebuilt and set to security invoker.
- Search path hardened on selected functions.
- Anon execute revoked from exposed sensitive functions.
- `live_brand` setting updated to `WE LIT🔥`.

## Still not finished

- Full public schema policy pass.
- Storage bucket policy pass.
- Auth settings review.
- Final frontend table-by-table source audit.
- Final image placement across every section.
- Final Vercel build/runtime verification across all routes.

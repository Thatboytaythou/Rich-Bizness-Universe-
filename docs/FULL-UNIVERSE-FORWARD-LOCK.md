# Rich Bizness Universe — Full Forward Lock

This branch is the single active recovery branch for the complete application upgrade. No route is marked complete because it builds, has a database table, or has a styled shell.

## Source of truth

- Frontend application: `apps/web`
- Production branch: `main`
- Active recovery branch: `recovery/full-universe-forward`
- Database project: `xfsrqomsiulswbalgknx`
- Production deployment: Vercel project `prj_uE9OskRnIuG83GHMLKRCzuRT0ZAJ`

## Completion gate for every route

A route is complete only after all seven pass:

1. The requested Rich Bizness visual identity is present.
2. The core feature works end to end.
3. Authentication and return routing work correctly.
4. Supabase ownership, RLS, RPC access, storage and realtime are correct.
5. Mobile interaction is verified on narrow and tall iPhone layouts.
6. No duplicate owner, dock, player, media mount, route or stylesheet was introduced.
7. The approved implementation is merged to `main` and matches Vercel production.

## Current production route inventory

- Portal / Index
- Tap In / Auth
- Profile
- Edit Profile
- Settings
- Notifications
- Messages
- Search
- Upload
- Creator
- Admin
- Feed
- Gallery
- Live
- Watch
- Music
- Sports
- Store
- Gaming
- Meta
- Avatar

## Verified structural defects that must be corrected

- `music.html` currently mounts a Podcast-only controller while the route and title say Music.
- Podcast and Radio are not standalone Vite entries.
- The project has accumulated multiple visual layers and follow-up patches around Live media containment.
- Successful builds and empty runtime-error dashboards do not prove visual or product completion.
- Supabase still reports anonymous execution on several public SECURITY DEFINER view-recording functions and leaked-password protection remains disabled.
- Authenticated SECURITY DEFINER warnings must be reviewed function by function; they are not all automatically defects because several are intentional user-action RPCs.

## Forward build order

### Foundation pass

- route ownership and standalone route map
- auth/session return flow
- global viewport, media lifecycle and navigation ownership
- shared tokens without cross-page visual leakage
- asset inventory and broken fallback removal

### Experience pass

- Portal / Index
- Profile / Edit / Settings / Avatar
- Feed / Gallery / Upload
- Live / Watch
- Music / Podcast / Radio / Playlists
- Gaming and all individual game runtimes
- Sports
- Meta
- Store
- Messages / Notifications / Search
- Creator / Admin

### Release pass

- Supabase schema, RLS, RPC and storage verification
- mobile route-by-route verification
- Vercel preview verification
- one pull request for the completed recovery batch
- merge to `main`
- production verification

## Branch rule

Do not create parallel rebuild branches for this recovery. Keep one active branch, one open recovery pull request, and one recovery ledger until the full batch is verified.
# Rich Bizness Universe — Cross-Platform Overlap Audit

Date: 2026-07-09
Branch: `audit/24-games-separation`

## Locked scope

- Keep the homepage portal/index ownership untouched during this pass.
- Consolidate duplicate and overlapping feature owners.
- Keep `/features/` as the canonical home for application features.
- Keep `/games/` as the canonical home for 24 separate playable games.
- Share auth, profile, avatar, XP, inventory, rewards, saves, rooms, scores, clips, and leaderboards instead of duplicating them per game.

## Verified platform state

- GitHub: `Thatboytaythou/Rich-Bizness-Universe-`
- Supabase: `xfsrqomsiulswbalgknx`
- Vercel: `rich-bizness-llc`
- Vercel framework: Vite
- Current production deployment is READY.
- No Vercel runtime error clusters were reported in the last 7 days.

## Current 24-game registry

The Supabase `public.games` table contains exactly 24 active rows:

1. `avatar-free-roam`
2. `beat-smoke-studio`
3. `bizness-party-room`
4. `boss-walk-battle`
5. `cash-rain-catcher`
6. `diamond-bat-flip`
7. `dj-radio-run`
8. `empire-builder`
9. `golf-green-gold`
10. `gym-grind-reps`
11. `hero-villain-showdown`
12. `market-flip`
13. `money-road-racer`
14. `portal-dash`
15. `portal-room-rush`
16. `rich-chess-boss`
17. `rich-court-king`
18. `rich-runner`
19. `smoke-burst-arena`
20. `smoke-cloud-drift`
21. `smoke-room-cards`
22. `smoke-tap`
23. `treehouse-ride`
24. `vault-unlock`

## Confirmed overlap risks

### Game routing

Twenty-three registry rows route back into one shared URL pattern, `/gaming.html?game=<slug>`, while `avatar-free-roam` routes to `/meta.html`. The separation pass must give each game a canonical module under `/games/<slug>/` while preserving one shared launcher and common services.

### Duplicate backend ownership

- `tracks` and `music_tracks` overlap as music track owners.
- `game_clips` and `gaming_uploads` overlap for gaming media.
- `games` plus chess-specific `game_rooms`, `game_room_members`, and `game_moves` need a shared game-session contract instead of chess-only assumptions in generic tables.
- `profiles`, `meta_avatars`, `gamer_profiles`, `sports_profiles`, and `store_seller_profiles` repeat identity fields. `profiles` must remain the identity owner; feature profiles should only own feature-specific extensions.
- `uploads` plus feature-specific upload tables need one canonical upload record with feature projections, not independent upload pipelines.
- `rich_notifications` and `store_notifications` overlap notification ownership.

## Security blockers found before game expansion

Supabase security advisors currently flag unrestricted write policies on game-related tables, including:

- `games`
- `game_rooms`
- `game_room_members`
- `game_moves`

These policies must be tightened before exposing all 24 game modules. The advisor also reports broad public bucket listing policies and publicly executable `SECURITY DEFINER` functions. No production database changes are included in this first inventory commit.

## Work order

1. Inventory every file under `/games`, `/features`, `/pages`, and `/src`.
2. Map each route to one canonical owner.
3. Create one folder per registered game under `/games/<slug>/`.
4. Move shared game runtime into `/games/shared/`.
5. Replace the one-page query-string ownership pattern with per-game entry modules.
6. Align Supabase `play_url` values only after the files exist and builds pass.
7. Tighten game RLS in a reviewed migration.
8. Validate Preview deployment before merging to `main`.

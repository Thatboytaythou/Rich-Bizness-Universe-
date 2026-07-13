-- Keep the unique constraint-backed index and remove the duplicate standalone index.
drop index if exists public.game_runtime_manifests_game_version_uidx;

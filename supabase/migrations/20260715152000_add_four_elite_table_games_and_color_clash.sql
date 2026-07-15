-- Rich Bizness game expansion: 24 -> 28 games.
-- Catalog owners added: Rich Color Clash, Rich Spades Royale, Rich Checkers Elite, Crown Connect Four.
-- Rich Color Clash activated as production-ready with canonical route and runtime manifest.

update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    engine_type = 'typescript-canvas',
    module_path = 'apps/web/src/pages/games/rich-color-clash.page.ts',
    bundle_url = '/src/pages/games/rich-color-clash.page.ts',
    manifest_url = '/games/rich-color-clash/',
    version = '1.0.0',
    updated_at = now()
where slug = 'rich-color-clash';

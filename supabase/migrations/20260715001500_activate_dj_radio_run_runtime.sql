with game_row as (
  select id from public.games where slug = 'dj-radio-run' limit 1
)
update public.games g
set play_url = '/games/dj-radio-run/',
    runtime_key = 'dj-radio-run',
    engine_type = 'canvas-rhythm-runner',
    module_path = '/src/pages/games/dj-radio-run.page.ts',
    is_playable = true,
    runtime_status = 'production_ready',
    controls = '{"keyboard":{"lanes":["A","S","K","L"],"alternate":["ArrowLeft","ArrowDown","ArrowUp","ArrowRight"]},"touch":{"lanes":4}}'::jsonb,
    capabilities = '{"solo":true,"offline":true,"local_multiplayer":true,"online_multiplayer":true,"realtime_score_race":true,"xp":true,"scores":true,"persistent_progress":true,"tournaments":true,"mobile_controls":true}'::jsonb,
    mobile_config = '{"enabled":true,"safe_area":true,"layout":"four-lane-touch"}'::jsonb,
    updated_at = now()
from game_row r
where g.id = r.id;

with game_row as (
  select id from public.games where slug = 'dj-radio-run' limit 1
)
insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, asset_manifest, controls,
  gameplay_rules, scoring_rules, save_schema, network_schema, mobile_config,
  required_env, is_active, updated_at
)
select r.id, '1.0.0', 'canvas-rhythm-runner', '/src/pages/games/dj-radio-run.page.ts',
  '{"artwork":"/images/music-logo.png.jpeg"}'::jsonb,
  '{"lanes":4,"keyboard":["A","S","K","L"],"touch":true}'::jsonb,
  '{"lives":3,"difficulty_levels":3,"combo_multiplier":true,"modes":["solo","local","online"]}'::jsonb,
  '{"perfect_window":20,"elite_window":42,"good_window":72,"xp_from_score":true}'::jsonb,
  '{"local_best":true,"progress_table":"game_player_progress","sessions_table":"game_sessions","scores_table":"game_scores"}'::jsonb,
  '{"rooms_table":"game_rooms","members_table":"game_room_members","moves_table":"game_moves","mode":"realtime_score_race"}'::jsonb,
  '{"safe_area":true,"touch_lanes":4,"responsive_canvas":true}'::jsonb,
  '{}'::jsonb, true, now()
from game_row r
where not exists (
  select 1 from public.game_runtime_manifests m where m.game_id = r.id and m.version = '1.0.0'
);

update public.game_runtime_manifests m
set is_active = (m.version = '1.0.0'), updated_at = now()
where m.game_id = (select id from public.games where slug = 'dj-radio-run' limit 1);

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode, canonical_file,
  rewrite_target, nav_label, is_home, is_enabled, metadata, updated_at
)
values (
  'dj_radio_run', '/games/dj-radio-run/', 'game', 'gaming', 'public',
  'dj-radio-run.html', '/dj-radio-run', 'DJ Radio Run', false, true,
  '{"game_slug":"dj-radio-run","runtime_status":"production_ready"}'::jsonb, now()
)
on conflict (route_key) do update set
  route_path = excluded.route_path,
  page_type = excluded.page_type,
  section = excluded.section,
  auth_mode = excluded.auth_mode,
  canonical_file = excluded.canonical_file,
  rewrite_target = excluded.rewrite_target,
  nav_label = excluded.nav_label,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();

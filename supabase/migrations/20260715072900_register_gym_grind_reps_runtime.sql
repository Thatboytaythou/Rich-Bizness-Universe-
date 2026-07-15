update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/gym-grind-reps/',
    runtime_key = 'gym-grind-reps',
    engine_type = 'canvas-fitness-v1',
    module_path = 'apps/web/src/pages/games/gym-grind-reps.page.ts',
    version = '1.0.0',
    is_tournament_enabled = true,
    controls = jsonb_build_object(
      'keyboard', jsonb_build_array('ArrowUp','ArrowDown','W','S','Space','B','R'),
      'mobile', jsonb_build_array('lower','power_rep','drive','smoke_boost','recover')
    ),
    capabilities = jsonb_build_object(
      'solo', true,
      'offline', true,
      'local_multiplayer', true,
      'online_multiplayer', true,
      'xp', true,
      'scores', true,
      'sessions', true,
      'persistent_progress', true,
      'tournaments', true
    ),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'advanced_runtime', true,
      'production_owner', 'apps/web/src/pages/games/gym-grind-reps.page.ts',
      'runtime_version', '1.0.0',
      'features', jsonb_build_array('rep_timing','form_meter','stamina','circuits','rival_ai','offline_progress','local_duel','realtime_ranked','xp','leaderboard','mobile_controls')
    ),
    updated_at = now()
where slug = 'gym-grind-reps';

update public.game_runtime_manifests
set is_active = false, updated_at = now()
where game_id = (select id from public.games where slug = 'gym-grind-reps');

insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, controls, gameplay_rules,
  scoring_rules, save_schema, network_schema, mobile_config, is_active
)
select id,
       '1.0.0',
       'canvas-fitness-v1',
       'apps/web/src/pages/games/gym-grind-reps.page.ts',
       jsonb_build_object('keyboard', true, 'touch', true),
       jsonb_build_object('modes', jsonb_build_array('career','survival','local','online'), 'difficulty', jsonb_build_array('rookie','elite','boss'), 'rounds', 5),
       jsonb_build_object('rep_quality', true, 'form', true, 'combo', true, 'victory_bonus', true),
       jsonb_build_object('local_storage', 'rb-ggr-v1', 'cloud_table', 'game_player_progress'),
       jsonb_build_object('transport', 'supabase_realtime', 'channel', 'gym:{room_code}'),
       jsonb_build_object('safe_area', true, 'responsive', true, 'reduced_motion', true),
       true
from public.games
where slug = 'gym-grind-reps';

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode, canonical_file,
  rewrite_target, nav_label, is_home, is_enabled, metadata
)
values (
  'game-gym-grind-reps', '/games/gym-grind-reps/', 'game', 'gaming', 'public',
  'apps/web/gym-grind-reps.html', '/gym-grind-reps', 'Gym Grind Reps', false, true,
  jsonb_build_object('game_slug', 'gym-grind-reps', 'runtime_version', '1.0.0')
)
on conflict (route_key) do update
set route_path = excluded.route_path,
    canonical_file = excluded.canonical_file,
    rewrite_target = excluded.rewrite_target,
    auth_mode = 'public',
    is_enabled = true,
    metadata = excluded.metadata,
    updated_at = now();
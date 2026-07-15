update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/rich-court-king/',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'runtime','canvas-sports-v1','runtime_version','1.0.0','advanced_runtime',true,
      'solo',true,'offline',true,'local_multiplayer',true,'online_multiplayer',true,
      'xp',true,'scores',true,'sessions',true,'tournaments',true,
      'sports_sync',true,'profile_sync',true,'mobile_controls',true,
      'module_owner','/games/rich-court-king/'
    ),
    updated_at = now()
where slug = 'rich-court-king';

update public.game_runtime_manifests
set is_active = false, updated_at = now()
where game_id = 'd38276c8-27d5-459b-bc15-a715f6ff30d5';

insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, asset_manifest, controls,
  gameplay_rules, scoring_rules, save_schema, network_schema, mobile_config,
  required_env, checksum, is_active
) values (
  'd38276c8-27d5-459b-bc15-a715f6ff30d5','1.0.0','canvas-sports-v1',
  '/src/pages/games/rich-court-king.page.ts','{}'::jsonb,
  '{"keyboard":["WASD","ARROWS","SPACE","SHIFT","E"],"touch":true}'::jsonb,
  '{"modes":["career","survival","local","online"],"shot_meter":true,"defense":true,"stamina":true,"ai_rivals":true}'::jsonb,
  '{"basket":650,"win_bonus":3500,"combo_bonus":180}'::jsonb,
  '{"local":"rb-rck-v1","cloud":"game_player_progress"}'::jsonb,
  '{"rooms":"game_rooms","transport":"supabase_realtime"}'::jsonb,
  '{"safe_area":true,"touch_controls":true,"reduced_motion":true}'::jsonb,
  '[]'::jsonb,'rich-court-king-v1',true
);

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode, canonical_file,
  rewrite_target, nav_label, is_home, is_enabled, metadata
) values (
  'game_rich_court_king','/games/rich-court-king/','game','gaming','public',
  'apps/web/rich-court-king.html','/rich-court-king','Rich Court King',false,true,
  '{"game_slug":"rich-court-king","runtime_version":"1.0.0"}'::jsonb
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
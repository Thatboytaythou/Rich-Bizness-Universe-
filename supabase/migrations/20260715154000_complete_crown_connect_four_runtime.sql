update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/crown-connect-four/',
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'runtime','connect-four-v1','advanced_runtime',true,'production_ready',true,
      'module_owner','/games/crown-connect-four/',
      'features',jsonb_build_array('gravity_board','threat_mapping','adaptive_ai','power_moves','offline_progress','local_multiplayer','realtime_ranked','xp','leaderboards','tournaments')
    ),
    updated_at = now()
where slug = 'crown-connect-four';

update public.game_runtime_manifests
set is_active = false, updated_at = now()
where game_id = (select id from public.games where slug='crown-connect-four') and is_active = true;

insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, asset_manifest, controls,
  gameplay_rules, scoring_rules, save_schema, network_schema, mobile_config,
  required_env, checksum, is_active
)
select id, '1.0.0', 'typescript-dom-strategy',
  'apps/web/src/pages/games/crown-connect-four.page.ts',
  jsonb_build_object('styles','apps/web/src/pages/games/crown-connect-four.css','html','apps/web/crown-connect-four.html'),
  jsonb_build_object('pointer',true,'touch',true,'keyboard_ready',true,'column_drop',true),
  jsonb_build_object('board','7x6','connect',4,'gravity',true,'forced_turns',true,'ai','minimax-alpha-beta','powers',jsonb_build_array('crown_drop','royal_swap')),
  jsonb_build_object('win',2500,'draw',700,'loss',250,'streak_bonus',250),
  jsonb_build_object('offline',true,'cloud_progress',true,'xp',true,'wins',true,'best_score',true),
  jsonb_build_object('rooms','game_rooms','members','game_room_members','transport','supabase_realtime_broadcast'),
  jsonb_build_object('safe_area',true,'responsive',true,'reduced_motion',true),
  jsonb_build_array('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  'crown-connect-four-v1', true
from public.games where slug='crown-connect-four';

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode, canonical_file,
  rewrite_target, nav_label, is_home, is_enabled, metadata, updated_at
)
values (
  'game-crown-connect-four','/games/crown-connect-four/','game','gaming','public',
  'apps/web/crown-connect-four.html','/crown-connect-four','Crown Connect Four',false,true,
  jsonb_build_object('game_slug','crown-connect-four','production_ready',true),now()
)
on conflict (route_key) do update set
  route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,
  auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,
  rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,
  is_enabled=true,metadata=excluded.metadata,updated_at=now();
update public.games
set is_playable=true,
    runtime_status='production_ready',
    play_url='/games/diamond-bat-flip/',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'runtime','canvas-baseball-v1','advanced_runtime',true,'production_ready',true,
      'solo',true,'offline',true,'local_multiplayer',true,'realtime_multiplayer',true,
      'xp',true,'scores',true,'sessions',true,'tournaments',true,
      'sports_sync',true,'profile_sync',true,'mobile_controls',true,
      'features',jsonb_build_array('batting','pitching','fielding','career','boss_pitchers','home_run_derby','ranked_rooms')
    )
where slug='diamond-bat-flip';

update public.game_runtime_manifests
set is_active=false, updated_at=now()
where game_id=(select id from public.games where slug='diamond-bat-flip');

insert into public.game_runtime_manifests(
  game_id,version,engine_type,entry_module,controls,gameplay_rules,scoring_rules,
  save_schema,network_schema,mobile_config,checksum,is_active,created_at,updated_at
)
select id,'1.0.0','canvas-baseball-v1','apps/web/src/pages/games/diamond-bat-flip.page.ts',
  jsonb_build_object('keyboard',jsonb_build_array('arrows','a','d','space','q','p','shift'),'touch',true),
  jsonb_build_object('modes',jsonb_build_array('career','derby','local','online'),'systems',jsonb_build_array('batting','pitching','fielding','innings','boss_ai')),
  jsonb_build_object('score','contact+distance+defense+wins','xp',true),
  jsonb_build_object('offline','localStorage','cloud','game_player_progress'),
  jsonb_build_object('rooms','game_rooms','transport','supabase_realtime'),
  jsonb_build_object('safe_area',true,'reduced_motion',true,'touch_controls',true),
  'diamond-bat-flip-v1',true,now(),now()
from public.games where slug='diamond-bat-flip';

insert into public.route_registry(
  route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,
  nav_label,is_home,is_enabled,metadata,created_at,updated_at
) values(
  'game_diamond_bat_flip','/games/diamond-bat-flip/','game','gaming','public',
  'apps/web/diamond-bat-flip.html','/diamond-bat-flip','Diamond Bat Flip',false,true,
  jsonb_build_object('game_slug','diamond-bat-flip','runtime','production_ready'),now(),now()
)
on conflict(route_key) do update set
  route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,
  auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,
  rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,
  metadata=excluded.metadata,updated_at=now();
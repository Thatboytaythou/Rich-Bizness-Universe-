update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/rich-checkers-elite/',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'runtime','checkers-v1','advanced_runtime',true,'forced_captures',true,
      'multi_jumps',true,'kings',true,'solo',true,'local_multiplayer',true,
      'realtime_multiplayer',true,'offline',true,'xp',true,'tournaments',true,
      'module_owner','/games/rich-checkers-elite/'
    ),
    updated_at = now()
where slug = 'rich-checkers-elite';

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,created_at,updated_at)
values('game-rich-checkers-elite','/games/rich-checkers-elite/','game','gaming','public','apps/web/rich-checkers-elite.html','/rich-checkers-elite','Rich Checkers Elite',false,true,jsonb_build_object('game_slug','rich-checkers-elite','production_ready',true),now(),now())
on conflict (route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();

update public.game_runtime_manifests set is_active=false,updated_at=now() where game_id=(select id from public.games where slug='rich-checkers-elite') and is_active=true;
insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,created_at,updated_at)
select id,'1.0.0','dom-strategy','/src/pages/games/rich-checkers-elite.page.ts','{}'::jsonb,
jsonb_build_object('touch',true,'pointer',true,'keyboard_ready',true),
jsonb_build_object('forced_captures',true,'multi_jumps',true,'kings',true,'ai_levels',3,'modes',jsonb_build_array('solo','local','online','offline')),
jsonb_build_object('win',5000,'piece',300,'king',500),
jsonb_build_object('offline',true,'cloud_progress',true),
jsonb_build_object('supabase_realtime',true,'private_rooms',true),
jsonb_build_object('safe_area',true,'responsive_board',true,'reduced_motion',true),
jsonb_build_array('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'),
'rich-checkers-elite-v1',true,now(),now()
from public.games where slug='rich-checkers-elite';
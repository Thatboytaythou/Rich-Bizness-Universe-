update public.games
set is_playable=true,
    runtime_status='production_ready',
    play_url='/games/avatar-free-roam/',
    runtime_key='avatar-free-roam',
    engine_type='canvas_rpg_v1',
    module_path='/src/pages/games/avatar-free-roam.page.ts',
    version='1.0.0',
    is_tournament_enabled=true,
    is_meta_enabled=true,
    controls=jsonb_build_object('keyboard',jsonb_build_array('WASD','ARROWS','SPACE','Q','SHIFT'),'touch',true),
    capabilities=jsonb_build_object('solo',true,'offline',true,'local',true,'realtime_multiplayer',true,'missions',true,'combat',true,'loot',true,'xp',true,'scores',true,'tournaments',true,'avatar_sync',true,'meta_sync',true),
    save_schema=jsonb_build_object('version',1),
    netcode_config=jsonb_build_object('provider','supabase_realtime','tick_ms',650,'max_players',8),
    mobile_config=jsonb_build_object('touch_controls',true,'safe_area',true,'orientation','responsive'),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('quality','hd','runtime','canvas-rpg-v1','advanced_runtime',true),
    updated_at=now()
where slug='avatar-free-roam';

update public.game_runtime_manifests
set is_active=false,updated_at=now()
where game_id=(select id from public.games where slug='avatar-free-roam');

insert into public.game_runtime_manifests
(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,updated_at)
select id,'1.0.0','canvas_rpg_v1','/src/pages/games/avatar-free-roam.page.ts',
jsonb_build_object('entry','/avatar-free-roam','style','/src/pages/games/avatar-free-roam.css'),
jsonb_build_object('keyboard',jsonb_build_array('WASD','ARROWS','SPACE','Q','SHIFT'),'touch',true),
jsonb_build_object('modes',jsonb_build_array('campaign','survival','local','online'),'missions',true,'combat',true,'loot',true,'bosses',true),
jsonb_build_object('mission_bonus',1500,'kill_bonus',45,'shard_bonus',80),
jsonb_build_object('version',1,'offline',true,'cloud_progress',true),
jsonb_build_object('provider','supabase_realtime','rooms',true,'presence',true,'broadcast',true),
jsonb_build_object('touch',true,'safe_area',true,'responsive_canvas',true),
'[]'::jsonb,'avatar-free-roam-v1',true,now()
from public.games where slug='avatar-free-roam';

insert into public.route_registry
(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values ('game_avatar_free_roam','/games/avatar-free-roam/','game','gaming','public','avatar-free-roam.html','/avatar-free-roam','Avatar Free Roam',false,true,jsonb_build_object('game_slug','avatar-free-roam','runtime_status','production_ready'),now())
on conflict (route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
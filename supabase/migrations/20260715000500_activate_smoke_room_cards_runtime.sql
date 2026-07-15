update public.games
set play_url='/games/smoke-room-cards/',
    runtime_key='smoke-room-cards',
    engine_type='dom-card-runtime',
    module_path='/smoke-room-cards.html',
    is_playable=true,
    runtime_status='production_ready',
    controls=jsonb_build_object('touch',jsonb_build_object('deal','button','hit','button','stand','button','double','button'),'keyboard',jsonb_build_object()),
    capabilities=jsonb_build_object('solo',true,'offline',true,'local_multiplayer',true,'online_multiplayer',true,'xp',true,'scores',true,'rooms',true,'persistent_progress',true,'tournaments',true),
    mobile_config=jsonb_build_object('enabled',true,'safe_area',true,'layout','responsive-card-table'),
    updated_at=now()
where slug='smoke-room-cards';

delete from public.game_runtime_manifests
where game_id=(select id from public.games where slug='smoke-room-cards') and version='1.0.0';

insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,is_active)
select id,'1.0.0','dom-card-runtime','/smoke-room-cards.html','{}'::jsonb,
jsonb_build_object('deal','button','hit','button','stand','button','double','button'),
jsonb_build_object('target',21,'dealer_rules','adaptive by difficulty','modes',jsonb_build_array('solo','local','online','offline')),
jsonb_build_object('win',1000,'push',400,'loss',100,'streak_bonus',100),
jsonb_build_object('local_key','rb-smoke-room-cards','supabase_table','game_player_progress'),
jsonb_build_object('rooms','game_rooms','members','game_room_members','moves','broadcast channel'),
jsonb_build_object('enabled',true,'safe_area',true,'responsive',true),'{}'::jsonb,true
from public.games where slug='smoke-room-cards';

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values('smoke_room_cards','/games/smoke-room-cards/','game','gaming','public','smoke-room-cards.html','/smoke-room-cards','Smoke Room Cards',false,true,jsonb_build_object('game_slug','smoke-room-cards','version','1.0.0'),now())
on conflict(route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_home=excluded.is_home,is_enabled=excluded.is_enabled,metadata=excluded.metadata,updated_at=now();
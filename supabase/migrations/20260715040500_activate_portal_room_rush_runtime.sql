update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    runtime_key = 'portal-room-rush',
    engine_type = 'vite-typescript',
    module_path = '/src/pages/games/portal-room-rush.page.ts',
    version = '1.0.0',
    play_url = '/games/portal-room-rush/',
    is_tournament_enabled = true,
    controls = jsonb_build_object('keyboard', jsonb_build_array('M move','S scan','P stabilize','R portal rush'), 'touch', true),
    capabilities = jsonb_build_object('solo',true,'offline',true,'local_multiplayer',true,'online_multiplayer',true,'xp',true,'scores',true,'rooms',true,'persistent_progress',true,'tournaments',true,'meta_link',true),
    save_schema = jsonb_build_object('chapter','integer','upgradePoints','integer','unlocked','text[]','best','integer'),
    netcode_config = jsonb_build_object('provider','supabase_realtime','state_sync',true,'max_players',2),
    mobile_config = jsonb_build_object('touch_controls',true,'safe_area',true,'orientation','adaptive'),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('runtime_version','1.0.0','production_owner','apps/web/src/pages/games/portal-room-rush.page.ts','advanced_runtime',true),
    updated_at = now()
where slug = 'portal-room-rush';

update public.game_runtime_manifests
set is_active = false, updated_at = now()
where game_id = (select id from public.games where slug = 'portal-room-rush');

insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,updated_at)
select id,'1.0.0','vite-typescript','/src/pages/games/portal-room-rush.page.ts','{}'::jsonb,
jsonb_build_object('keyboard',jsonb_build_array('M','S','P','R'),'touch',true),
jsonb_build_object('grid_size',36,'campaign_chapters',30,'procedural_rooms',true,'ai_rivals',true),
jsonb_build_object('room_capture',120,'core_capture',1400,'energy_bonus',3),
jsonb_build_object('chapter','integer','upgrades','jsonb','best','integer'),
jsonb_build_object('provider','supabase_realtime','rooms',true,'state_sync',true),
jsonb_build_object('responsive',true,'safe_area',true,'reduced_motion',true),'[]'::jsonb,'portal-room-rush-v1',true,now()
from public.games where slug = 'portal-room-rush';

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values('game_portal_room_rush','/games/portal-room-rush/','game','gaming','public','portal-room-rush.html','/portal-room-rush','Portal Room Rush',false,true,jsonb_build_object('game_slug','portal-room-rush','runtime_version','1.0.0'),now())
on conflict(route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    runtime_key = 'vault-unlock',
    engine_type = 'vite_typescript',
    module_path = '/src/pages/games/vault-unlock.page.ts',
    version = '1.0.0',
    is_tournament_enabled = true,
    controls = jsonb_build_object('keyboard', jsonb_build_array('1-9','Enter','Escape'), 'touch', true),
    capabilities = jsonb_build_object('solo',true,'offline',true,'local_multiplayer',true,'online_multiplayer',true,'xp',true,'scores',true,'persistent_progress',true,'tournaments',true),
    save_schema = jsonb_build_object('level','integer','best','integer','xp','integer','tokens','integer','tools','array'),
    netcode_config = jsonb_build_object('provider','supabase_realtime','rooms',true,'moves',true),
    anti_cheat_config = jsonb_build_object('server_scores',true,'rate_limit',true),
    mobile_config = jsonb_build_object('touch',true,'safe_area',true,'orientation','portrait_landscape'),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('elite',true,'mechanic','procedural_vault_heist','security_ai',true,'tools',true,'realtime_coop',true),
    updated_at = now()
where slug = 'vault-unlock';

insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,updated_at)
select id,'1.0.0','vite_typescript','/src/pages/games/vault-unlock.page.ts','{}'::jsonb,
       jsonb_build_object('keyboard',jsonb_build_array('1-9','Enter','Escape'),'touch',true),
       jsonb_build_object('rounds',5,'procedural_patterns',true,'security_ai',true,'tools',true),
       jsonb_build_object('time_bonus',true,'alarm_penalty',true,'streak_bonus',true),
       jsonb_build_object('level','integer','tokens','integer','tools','array'),
       jsonb_build_object('provider','supabase_realtime','rooms',true,'moves',true),
       jsonb_build_object('touch',true,'safe_area',true),'[]'::jsonb,'vault-unlock-v1',true,now()
from public.games where slug='vault-unlock'
on conflict do nothing;

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values('game_vault_unlock','/games/vault-unlock/','game','gaming','public','vault-unlock.html','/vault-unlock','Vault Unlock',false,true,jsonb_build_object('slug','vault-unlock','runtime','production_ready'),now())
on conflict (route_key) do update
set route_path=excluded.route_path,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,is_enabled=true,metadata=excluded.metadata,updated_at=now();
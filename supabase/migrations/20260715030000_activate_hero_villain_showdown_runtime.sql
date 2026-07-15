update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    runtime_key = 'hero-villain-showdown',
    engine_type = 'vite-typescript',
    module_path = '/games/hero-villain-showdown/',
    play_url = '/games/hero-villain-showdown/',
    version = '1.0.0',
    is_tournament_enabled = true,
    controls = jsonb_build_object('keyboard', jsonb_build_array('A','D','W','F','G','H','R','ArrowLeft','ArrowRight','ArrowUp','J','K','L','I'),'touch',true,'local_two_player',true),
    capabilities = jsonb_build_object('solo',true,'offline',true,'local_multiplayer',true,'online_multiplayer',true,'campaign',true,'survival',true,'xp',true,'scores',true,'rooms',true,'persistent_progress',true,'tournaments',true),
    save_schema = jsonb_build_object('version',1,'fields',jsonb_build_array('chapter','wins','upgradePoints','unlocked','fighter','bestCombo')),
    netcode_config = jsonb_build_object('provider','supabase-realtime','room_table','game_rooms','move_table','game_moves','max_players',2),
    anti_cheat_config = jsonb_build_object('server_recorded_scores',true,'signed_in_ranked_only',true),
    mobile_config = jsonb_build_object('touch_controls',true,'safe_area',true,'orientation','portrait_landscape'),
    updated_at = now()
where slug = 'hero-villain-showdown';

insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,updated_at)
select id,'1.0.0','vite-typescript','/src/pages/games/hero-villain-showdown.page.ts',jsonb_build_object('styles','/src/pages/games/hero-villain-showdown.css'),controls,jsonb_build_object('modes',jsonb_build_array('campaign','survival','local','online'),'fighters',4,'chapter_cap',20,'hazards',true,'air_combat',true),jsonb_build_object('win_bonus',1150,'chapter_bonus',150,'combo_bonus',45),save_schema,netcode_config,mobile_config,jsonb_build_array('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'),'hero-villain-showdown-v1',true,now()
from public.games where slug='hero-villain-showdown'
on conflict do nothing;

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values('game_hero_villain_showdown','/games/hero-villain-showdown/','game','gaming','public','apps/web/hero-villain-showdown.html','/hero-villain-showdown','Hero Villain Showdown',false,true,jsonb_build_object('game_slug','hero-villain-showdown','runtime_status','production_ready'),now())
on conflict (route_key) do update set route_path=excluded.route_path,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,is_enabled=true,metadata=excluded.metadata,updated_at=now();
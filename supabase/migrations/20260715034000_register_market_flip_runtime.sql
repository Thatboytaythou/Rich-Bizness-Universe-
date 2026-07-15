update public.games
set play_url='/games/market-flip/', runtime_key='market-flip', engine_type='typescript-canvas-strategy', module_path='/games/market-flip/', version='1.0.0', is_playable=true, runtime_status='production_ready', is_tournament_enabled=true,
controls=jsonb_build_object('keyboard',jsonb_build_array('B buy','S sell','N next day','Arrow keys select asset'),'touch',true),
capabilities=jsonb_build_object('solo',true,'offline',true,'local_multiplayer',true,'online_multiplayer',true,'xp',true,'scores',true,'rooms',true,'persistent_progress',true,'tournaments',true,'market_simulation',true),
save_schema=jsonb_build_object('version',1,'fields',jsonb_build_array('cash','day','score','streak','holdings','unlocked','intel')),
netcode_config=jsonb_build_object('provider','supabase_realtime','model','ranked_score_state'),
anti_cheat_config=jsonb_build_object('server_scores',true,'rate_limit_moves',true),
mobile_config=jsonb_build_object('touch_controls',true,'safe_area',true,'orientation','portrait_landscape'),
metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('elite',true,'advanced_runtime',true,'live_price_engine',true,'ai_rivals',true,'portfolio_upgrades',true), updated_at=now()
where slug='market-flip';

delete from public.game_runtime_manifests where game_id=(select id from public.games where slug='market-flip');
insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,updated_at)
select id,'1.0.0','typescript-canvas-strategy','/src/pages/games/market-flip.page.ts','{}'::jsonb,
jsonb_build_object('keyboard',true,'touch',true),jsonb_build_object('campaign_days',30,'assets',6,'dynamic_events',true,'ai_rivals',true,'upgrades',true),jsonb_build_object('net_worth',true,'profit_multiplier',true,'streak_bonus',true),jsonb_build_object('local_storage',true,'supabase_progress',true),jsonb_build_object('provider','supabase_realtime','rooms',true,'state_sync',true),jsonb_build_object('responsive',true,'safe_area',true,'reduced_motion',true),'[]'::jsonb,'market-flip-v1',true,now()
from public.games where slug='market-flip';

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values('game_market_flip','/games/market-flip/','game','gaming','public','market-flip.html','/market-flip','Market Flip',false,true,jsonb_build_object('game_slug','market-flip','runtime_status','production_ready'),now())
on conflict(route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
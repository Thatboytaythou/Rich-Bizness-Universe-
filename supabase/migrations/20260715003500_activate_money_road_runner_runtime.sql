update public.games
set play_url='/games/money-road-runner/',
    runtime_key='money-road-runner',
    engine_type='canvas-runner',
    module_path='/src/pages/games/money-road-runner.page.ts',
    is_playable=true,
    runtime_status='production_ready',
    controls='{"keyboard":{"left":"ArrowLeft/A","right":"ArrowRight/D","jump":"ArrowUp/W/Space","slide":"ArrowDown/S"},"touch":{"left":"button","right":"button","jump":"button","slide":"button"}}'::jsonb,
    capabilities='{"solo":true,"offline":true,"local_challenge":true,"online_multiplayer":true,"xp":true,"scores":true,"rooms":true,"persistent_progress":true,"tournaments":true}'::jsonb,
    mobile_config='{"enabled":true,"safe_area":true,"layout":"four-action-runner"}'::jsonb,
    updated_at=now()
where slug='money-road-runner';

update public.game_runtime_manifests set is_active=false,updated_at=now()
where game_id=(select id from public.games where slug='money-road-runner');

insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,is_active,updated_at)
select id,'1.0.0','canvas-runner','/src/pages/games/money-road-runner.page.ts','{}'::jsonb,
'{"keyboard":true,"touch":true}'::jsonb,
'{"lanes":3,"lives":3,"cash":true,"boosts":true,"obstacles":true}'::jsonb,
'{"distance":true,"cash_combo":true,"boost_bonus":true}'::jsonb,
'{"best_score":true,"xp":true,"runs":true,"highest_combo":true}'::jsonb,
'{"provider":"supabase-realtime","mode":"score-race","tables":["game_rooms","game_scores","game_sessions","game_player_progress"]}'::jsonb,
'{"safe_area":true,"touch_controls":true,"orientation":"portrait-landscape"}'::jsonb,'{}'::jsonb,true,now()
from public.games where slug='money-road-runner';

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,updated_at)
values('money_road_runner','/games/money-road-runner/','game','gaming','public','money-road-runner.html','/money-road-runner','Money Road Runner',false,true,'{"game_slug":"money-road-runner","runtime_version":"1.0.0"}'::jsonb,now())
on conflict(route_key) do update set route_path=excluded.route_path,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,is_enabled=true,metadata=excluded.metadata,updated_at=now();
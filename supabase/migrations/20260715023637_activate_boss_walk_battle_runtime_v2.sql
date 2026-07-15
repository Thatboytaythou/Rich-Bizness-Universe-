update public.games
set play_url='/games/boss-walk-battle/', runtime_key='boss-walk-battle', engine_type='vite-typescript', module_path='/games/boss-walk-battle/', version='1.0.0', is_playable=true, runtime_status='production_ready', is_tournament_enabled=true,
controls='{"keyboard":{"p1":["A","S","D","F","G","H","ArrowLeft","ArrowRight"],"p2":["J","K","L","I","O","P"]},"mobile":"touch-buttons"}'::jsonb,
capabilities='{"solo":true,"offline":true,"local_multiplayer":true,"online_multiplayer":true,"campaign":true,"boss_rush":true,"xp":true,"scores":true,"rooms":true,"persistent_progress":true,"tournaments":true,"finishers":true,"stage_hazards":true}'::jsonb,
save_schema='{"local":"rb-boss-walk-battle","cloud":"game_player_progress"}'::jsonb,
netcode_config='{"transport":"supabase-realtime","tables":["game_rooms","game_room_members","game_moves"]}'::jsonb,
anti_cheat_config='{"ranked_scores":"server-persisted","sessions":"tracked"}'::jsonb,
mobile_config='{"safe_area":true,"touch_controls":true,"orientation":"adaptive","reduced_motion":true}'::jsonb,
metadata=coalesce(metadata,'{}'::jsonb)||'{"genre":"fighting","runtime_owner":"apps/web/src/pages/games/boss-walk-battle.page.ts","quality":"elite-hd","campaign_chapters":15,"fighter_count":4}'::jsonb,
updated_at=now()
where slug='boss-walk-battle';

update public.game_runtime_manifests set is_active=false,updated_at=now() where game_id=(select id from public.games where slug='boss-walk-battle');

insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active,created_at,updated_at)
select id,'1.0.0','vite-typescript','/src/pages/games/boss-walk-battle.page.ts','{"styles":["/src/pages/games/boss-walk-battle.css"]}'::jsonb,controls,'{"modes":["campaign","boss","local","online"],"systems":["rage","finishers","hazards","upgrades","combos"]}'::jsonb,'{"ranked":true,"combo_bonus":true,"chapter_bonus":true}'::jsonb,save_schema,netcode_config,mobile_config,'["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY"]'::jsonb,'boss-walk-battle-1.0.0',true,now(),now()
from public.games where slug='boss-walk-battle';

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata,created_at,updated_at)
values('game_boss_walk_battle','/games/boss-walk-battle/','game','gaming','public','boss-walk-battle.html','/boss-walk-battle','Boss Walk Battle',false,true,'{"game_slug":"boss-walk-battle","runtime_status":"production_ready"}'::jsonb,now(),now())
on conflict(route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
update public.games
set is_playable=true,
    runtime_status='production_ready',
    runtime_key='bizness-party-room-v1',
    engine_type='canvas2d-party',
    play_url='/games/bizness-party-room/',
    module_path='/src/games/bizness-party-room/bizness-party-room.ts',
    version='1.0.0',
    is_tournament_enabled=true,
    controls='{"keyboard":["WASD","arrows","Space","E"],"touch":true,"pointer":true}'::jsonb,
    capabilities='{"solo":true,"offline":true,"local_party":true,"realtime_multiplayer":true,"private_rooms":true,"leaderboards":true,"xp":true,"tournaments":true,"minigames":["cash_scramble","portal_tag","beat_burst","crown_control"]}'::jsonb,
    save_schema='{"version":1,"local_key":"rb-bpr-v1","fields":["best","xp","level","wins"]}'::jsonb,
    netcode_config='{"transport":"supabase_realtime","channel":"party:{room_code}","presence":true,"score_broadcast_ms":900}'::jsonb,
    mobile_config='{"orientation":"any","safe_area":true,"touch_controls":true,"reduced_motion":true}'::jsonb,
    metadata=coalesce(metadata,'{}'::jsonb)||'{"runtime":"party-room-v1","module_owner":"/games/bizness-party-room/","systems":["gaming","profile","dm"],"production_ready":true}'::jsonb,
    updated_at=now()
where id='96f8b968-8366-4c1e-b56e-19744016d874';

update public.game_runtime_manifests set is_active=false,updated_at=now() where game_id='96f8b968-8366-4c1e-b56e-19744016d874';
insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,checksum,is_active)
values('96f8b968-8366-4c1e-b56e-19744016d874','1.0.0','canvas2d-party','/src/games/bizness-party-room/bizness-party-room.ts','{"styles":["/src/games/bizness-party-room/bizness-party-room.css"],"page":"/bizness-party-room.html"}'::jsonb,'{"keyboard":["WASD","arrows","Space","E"],"touch":true,"pointer":true}'::jsonb,'{"rounds":4,"minigames":["cash_scramble","portal_tag","beat_burst","crown_control"],"modes":["tour","endless","local","online"],"difficulty":[1,2,3]}'::jsonb,'{"combo_max":20,"win_bonus":2500,"xp_divisor":14}'::jsonb,'{"local_key":"rb-bpr-v1","cloud_table":"game_player_progress"}'::jsonb,'{"provider":"supabase_realtime","presence":true,"broadcast":"score"}'::jsonb,'{"touch":true,"pointer":true,"safe_area":true,"reduced_motion":true}'::jsonb,'["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY"]'::jsonb,'bizness-party-room-v1',true);

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata)
values('game-bizness-party-room','/games/bizness-party-room/','game','gaming','public','apps/web/bizness-party-room.html','/bizness-party-room','Bizness Party Room',false,true,'{"game_id":"96f8b968-8366-4c1e-b56e-19744016d874","runtime":"production_ready"}'::jsonb)
on conflict(route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
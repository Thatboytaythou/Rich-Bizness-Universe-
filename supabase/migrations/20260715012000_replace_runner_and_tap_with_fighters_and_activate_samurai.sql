update public.games
set slug='rich-samurais-son-ninja',
    title='Rich Samurai''s Son Ninja',
    game_type='fighting',
    play_url='/games/rich-samurais-son-ninja/',
    runtime_key='rich-samurais-son-ninja',
    engine_type='dom-canvas-hybrid',
    module_path='/src/pages/games/rich-samurais-son-ninja.page.ts',
    is_playable=true,
    runtime_status='production_ready',
    controls='{"keyboard":{"p1":"J K L I","p2":"A S D W"},"touch":"four action buttons"}'::jsonb,
    capabilities='{"solo":true,"offline":true,"local_multiplayer":true,"online_multiplayer":true,"xp":true,"scores":true,"rooms":true,"tournaments":true,"persistent_progress":true}'::jsonb,
    mobile_config='{"enabled":true,"safe_area":true,"layout":"four-action-fighter"}'::jsonb,
    updated_at=now()
where id='9a4f1eaf-9447-479a-879f-de1a7f84252c';

update public.games
set slug='aura-shinobi-clash',
    title='Aura Shinobi Clash',
    game_type='fighting',
    play_url='/games/aura-shinobi-clash/',
    runtime_key='aura-shinobi-clash',
    module_path='/games/aura-shinobi-clash/',
    is_playable=false,
    runtime_status='catalog_only',
    controls='{}'::jsonb,
    capabilities='{"solo":true,"offline":true,"local_multiplayer":true,"online_multiplayer":true,"xp":true,"scores":true,"rooms":true,"tournaments":true}'::jsonb,
    mobile_config='{"enabled":true,"safe_area":true}'::jsonb,
    updated_at=now()
where id='91d23c7b-9996-4f4a-839b-e3f40dbc6de7';

update public.game_runtime_manifests set is_active=false,updated_at=now() where game_id='9a4f1eaf-9447-479a-879f-de1a7f84252c';
insert into public.game_runtime_manifests(game_id,version,engine_type,entry_module,asset_manifest,controls,gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,required_env,is_active)
values('9a4f1eaf-9447-479a-879f-de1a7f84252c','1.0.0','dom-canvas-hybrid','/src/pages/games/rich-samurais-son-ninja.page.ts','{}'::jsonb,'{"keyboard":{"p1":"J K L I","p2":"A S D W"},"touch":"four action buttons"}'::jsonb,'{"round_seconds":90,"modes":["solo","local","online"],"actions":["quick","heavy","guard","special"]}'::jsonb,'{"win_bonus":1000,"combo_multiplier":true,"xp_win":175,"xp_complete":60}'::jsonb,'{"local_key":"rb-rich-samurai-best","progress_table":"game_player_progress"}'::jsonb,'{"rooms":"game_rooms","members":"game_room_members","moves":"game_moves","realtime":true}'::jsonb,'{"enabled":true,"safe_area":true,"layout":"four-action-fighter"}'::jsonb,'{}'::jsonb,true);

insert into public.route_registry(route_key,route_path,page_type,section,auth_mode,canonical_file,rewrite_target,nav_label,is_home,is_enabled,metadata)
values('rich_samurais_son_ninja','/games/rich-samurais-son-ninja/','game','gaming','public','rich-samurais-son-ninja.html','/rich-samurais-son-ninja','Rich Samurai''s Son Ninja',false,true,'{"game_slug":"rich-samurais-son-ninja"}'::jsonb)
on conflict(route_key) do update set route_path=excluded.route_path,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/smoke-burst-arena/',
    runtime_key = 'smoke-burst-arena',
    module_path = '/games/smoke-burst-arena/',
    version = '1.0.0',
    engine_type = 'vite-typescript',
    is_tournament_enabled = true,
    controls = jsonb_build_object(
      'keyboard', jsonb_build_array('A/D move','W jump','S guard','F strike','G heavy','H burst','Arrow keys move/jump'),
      'touch', jsonb_build_array('move','jump','strike','heavy','guard','burst')
    ),
    capabilities = jsonb_build_object(
      'solo', true,
      'offline', true,
      'local_multiplayer', true,
      'online_multiplayer', true,
      'campaign', true,
      'boss_phases', true,
      'aerial_combat', true,
      'dynamic_hazards', true,
      'multiple_arenas', true,
      'xp', true,
      'scores', true,
      'persistent_progress', true,
      'tournaments', true
    ),
    save_schema = jsonb_build_object('version',1,'fields',jsonb_build_array('chapter','wins','upgradePoints','unlocked','fighter','bestCombo','arenaIndex')),
    netcode_config = jsonb_build_object('provider','supabase_realtime','room_table','game_rooms','move_table','game_moves','max_players',2),
    anti_cheat_config = jsonb_build_object('server_score_log',true,'move_sequence',true,'signed_in_ranked_only',true),
    mobile_config = jsonb_build_object('touch_controls',true,'safe_area',true,'reduced_motion',true,'orientation','adaptive'),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('elite',true,'runtime_version','1.0.0','fighting_slot',4,'advanced_runtime',true),
    updated_at = now()
where slug = 'smoke-burst-arena';

update public.game_runtime_manifests set is_active = false, updated_at = now() where game_id = '2a220995-fdf0-4caa-8ba9-a3ee018f686e';
insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, asset_manifest, controls, gameplay_rules, scoring_rules, save_schema, network_schema, mobile_config, required_env, checksum, is_active, updated_at
) values (
  '2a220995-fdf0-4caa-8ba9-a3ee018f686e','1.0.0','vite-typescript','/src/pages/games/smoke-burst-arena.page.ts',
  jsonb_build_object('styles','/src/pages/games/smoke-burst-arena.css','entry','/smoke-burst-arena.html'),
  jsonb_build_object('keyboard',jsonb_build_array('move','jump','guard','strike','heavy','burst'),'touch',true),
  jsonb_build_object('modes',jsonb_build_array('campaign','boss','local','online'),'fighters',4,'arenas',3,'hazards',true,'aerial_combat',true),
  jsonb_build_object('victory',1000,'chapter_bonus',140,'combo_bonus',40),
  jsonb_build_object('local_storage','rb-smoke-burst-arena','progress_table','game_player_progress'),
  jsonb_build_object('provider','supabase_realtime','rooms','game_rooms','moves','game_moves'),
  jsonb_build_object('touch',true,'safe_area',true,'adaptive_orientation',true),
  jsonb_build_array('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  'smoke-burst-arena-v1',true,now()
);

insert into public.route_registry (route_key, route_path, page_type, section, auth_mode, canonical_file, rewrite_target, nav_label, is_home, is_enabled, metadata, updated_at)
values ('game_smoke_burst_arena','/games/smoke-burst-arena/','game','gaming','public','apps/web/smoke-burst-arena.html','/smoke-burst-arena','Smoke Burst Arena',false,true,jsonb_build_object('game_slug','smoke-burst-arena','runtime_status','production_ready'),now())
on conflict (route_key) do update set route_path=excluded.route_path,page_type=excluded.page_type,section=excluded.section,auth_mode=excluded.auth_mode,canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,updated_at=now();
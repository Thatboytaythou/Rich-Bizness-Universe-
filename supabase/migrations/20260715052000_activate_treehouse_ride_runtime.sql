update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/treehouse-ride/',
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'runtime','canvas-rpg-v1','solo',true,'offline',true,
      'local_multiplayer',true,'online_multiplayer',true,
      'xp',true,'scores',true,'sessions',true,
      'persistent_progress',true,'tournaments',true,
      'gaming_sync',true,'avatar_sync',true,'meta_sync',true
    ),
    updated_at = now()
where slug = 'treehouse-ride';

update public.game_runtime_manifests
set is_active = false, updated_at = now()
where game_id = '3845efe3-ed0a-44bc-a8db-9bca182bdd8f'::uuid;

insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, asset_manifest, controls,
  gameplay_rules, scoring_rules, save_schema, network_schema, mobile_config,
  required_env, checksum, is_active
) values (
  '3845efe3-ed0a-44bc-a8db-9bca182bdd8f'::uuid,
  '1.0.0','canvas-rpg','/src/pages/games/treehouse-ride.page.ts','{}'::jsonb,
  '{"keyboard":["WASD","arrows","space","Q","E"],"touch":true}'::jsonb,
  '{"modes":["campaign","survival","local","online"],"quests":true,"vehicle_combat":true,"upgrades":true}'::jsonb,
  '{"distance":true,"combat":true,"loot":true,"chapter_bonus":true}'::jsonb,
  '{"local":"rb-treehouse-ride-v1","cloud":"game_player_progress"}'::jsonb,
  '{"rooms":"game_rooms","transport":"supabase_realtime_broadcast"}'::jsonb,
  '{"safe_area":true,"touch_controls":true,"reduced_motion":true,"high_dpi_canvas":true}'::jsonb,
  '["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY"]'::jsonb,
  'treehouse-ride-v1',true
);

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode, canonical_file,
  rewrite_target, nav_label, is_home, is_enabled, metadata
) values (
  'game_treehouse_ride','/games/treehouse-ride/','game','gaming','public',
  'treehouse-ride.html','/treehouse-ride','Treehouse Ride',false,true,
  '{"game_slug":"treehouse-ride","runtime_status":"production_ready"}'::jsonb
)
on conflict (route_key) do update set
  route_path=excluded.route_path,page_type=excluded.page_type,
  section=excluded.section,auth_mode=excluded.auth_mode,
  canonical_file=excluded.canonical_file,rewrite_target=excluded.rewrite_target,
  nav_label=excluded.nav_label,is_enabled=true,metadata=excluded.metadata,
  updated_at=now();
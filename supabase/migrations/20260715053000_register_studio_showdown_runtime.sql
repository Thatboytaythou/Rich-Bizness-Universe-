update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/studio-showdown/',
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'runtime','canvas-rhythm-rpg-v1','production_ready',true,'solo',true,
      'offline',true,'local_multiplayer',true,'realtime_multiplayer',true,
      'xp',true,'scores',true,'missions',true,'music_link',true,
      'profile_sync',true,'tournaments',true,'mobile_controls',true,
      'module_owner','/games/studio-showdown/'
    ), updated_at = now()
where slug = 'studio-showdown';

update public.game_runtime_manifests
set is_active = false, updated_at = now()
where game_id = (select id from public.games where slug='studio-showdown');

insert into public.game_runtime_manifests (
  game_id, version, engine_type, entry_module, controls, gameplay_rules,
  scoring_rules, save_schema, network_schema, mobile_config, is_active, updated_at
)
select id, '1.0.0', 'canvas-rhythm-rpg', '/src/pages/games/studio-showdown.page.ts',
  '{"keyboard":["A","S","K","L","Arrow Keys","Q","Space"],"touch":true}'::jsonb,
  '{"modes":["campaign","survival","local","online"],"rhythm_battles":true,"missions":true,"upgrades":true,"bosses":true}'::jsonb,
  '{"combo":true,"timing_accuracy":true,"battle_bonus":true,"chapter_bonus":true}'::jsonb,
  '{"offline":true,"cloud":true,"fields":["xp","level","fans","chapter","best_score","max_combo","upgrades"]}'::jsonb,
  '{"provider":"supabase_realtime","rooms":true,"presence":true,"score_broadcast":true}'::jsonb,
  '{"touch_controls":true,"safe_area":true,"responsive_canvas":true,"reduced_motion":true}'::jsonb,
  true, now()
from public.games where slug='studio-showdown';

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode, canonical_file,
  rewrite_target, nav_label, is_home, is_enabled, metadata, updated_at
) values (
  'game_studio_showdown','/games/studio-showdown/','game','gaming','public',
  'apps/web/studio-showdown.html','/studio-showdown','Studio Showdown',false,true,
  '{"game_slug":"studio-showdown","runtime_status":"production_ready"}'::jsonb,now()
)
on conflict (route_key) do update set
  route_path=excluded.route_path, canonical_file=excluded.canonical_file,
  rewrite_target=excluded.rewrite_target, is_enabled=true,
  metadata=excluded.metadata, updated_at=now();
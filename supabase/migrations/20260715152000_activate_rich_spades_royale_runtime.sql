update public.games
set is_playable = true,
    runtime_status = 'production_ready',
    play_url = '/games/rich-spades-royale/',
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'runtime','spades-royale-v1',
      'advanced_runtime',true,
      'module_owner','/games/rich-spades-royale/',
      'features',jsonb_build_array('partnerships','bidding','nil','bags','adaptive_ai','offline_progress','local_play','realtime_rooms','ranked_scores','xp','tournaments')
    ),
    updated_at = now()
where slug = 'rich-spades-royale';

update public.game_runtime_manifests
set is_active=false, updated_at=now()
where game_id=(select id from public.games where slug='rich-spades-royale');

insert into public.game_runtime_manifests(
  game_id,version,engine_type,entry_module,asset_manifest,controls,
  gameplay_rules,scoring_rules,save_schema,network_schema,mobile_config,
  required_env,checksum,is_active
)
select id,'1.0.0','dom-card-engine',
  'apps/web/src/pages/games/rich-spades-royale.page.ts','{}'::jsonb,
  jsonb_build_object('touch',true,'pointer',true,'keyboard',true),
  jsonb_build_object('partnerships',true,'bidding',true,'nil',true,'bags',true,'spades_break',true,'ai_difficulties',3),
  jsonb_build_object('contracts',true,'nil_bonus',100,'bag_penalty',100,'ranked',true),
  jsonb_build_object('offline',true,'cloud_progress',true,'checkpoint',true),
  jsonb_build_object('realtime_rooms',true,'presence',true,'broadcast',true),
  jsonb_build_object('safe_area',true,'responsive',true,'reduced_motion',true),
  '[]'::jsonb,'rich-spades-royale-v1',true
from public.games where slug='rich-spades-royale';
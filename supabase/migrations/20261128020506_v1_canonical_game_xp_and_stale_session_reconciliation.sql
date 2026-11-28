begin;
CREATE OR REPLACE FUNCTION public.rb_apply_xp_queue_row(p_queue_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  q public.xp_event_queue%rowtype;
  e public.xp_events%rowtype;
  vx integer := 0;
  vc integer := 0;
  vp integer := 0;
  vt integer := 0;
  vl integer := 1;
  vcur integer := 0;
  vnext integer := 1000;
  vr text := 'Rookie Builder';
begin
  select * into q
  from public.xp_event_queue
  where id = p_queue_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'queue_not_found');
  end if;

  if q.status = 'awarded' then
    return jsonb_build_object('ok', true, 'reason', 'already_awarded');
  end if;

  update public.xp_event_queue
  set status = 'processing', error_message = null, processed_at = null
  where id = q.id;

  select * into e
  from public.xp_events
  where event_key = q.event_key
    and coalesce(is_active, true) = true
  limit 1;

  if not found then
    update public.xp_event_queue
    set status = 'rejected', error_message = 'unknown_event', processed_at = now()
    where id = q.id;
    return jsonb_build_object('ok', false, 'reason', 'unknown_event');
  end if;

  perform 1 from public.profiles where id=q.user_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-xp:'||q.user_id::text,0));
  if not public.rb_xp_event_allowed(q.user_id,q.event_key) then
    update public.xp_event_queue set status='rejected',error_message='cooldown_or_daily_limit',processed_at=now() where id=q.id;
    return jsonb_build_object('ok',false,'reason','cooldown_or_daily_limit');
  end if;
  if q.event_key='purchase_made' and not exists(select 1 from public.store_orders where id=q.source_id and buyer_id=q.user_id and payment_status='paid') then
    update public.xp_event_queue set status='rejected',error_message='payment_not_verified',processed_at=now() where id=q.id;
    return jsonb_build_object('ok',false,'reason','payment_not_verified');
  end if;
  if q.event_key in ('game_played','game_score_submit') then
    update public.xp_event_queue set status='rejected',error_message='canonical_game_reward_required',processed_at=now() where id=q.id;
    return jsonb_build_object('ok',false,'reason','canonical_game_reward_required');
  end if;
  vx := greatest(coalesce(e.xp_amount, 0), 0);
  vc := greatest(coalesce(e.coins_amount, 0), 0);
  vp := greatest(coalesce(e.rich_points_amount, vx, 0), 0);

  insert into public.user_xp_ledger(
    user_id,event_key,section,xp_amount,coins_amount,rich_points_amount,
    source_table,source_id,metadata
  ) values (
    q.user_id,q.event_key,q.section,vx,vc,vp,q.source_table,q.source_id,
    jsonb_build_object('queue_id',q.id,'idempotency_key',q.idempotency_key)
  )
  on conflict do nothing;

  if not found then
    update public.xp_event_queue
    set status = 'awarded', error_message = null, processed_at = now()
    where id = q.id;
    return jsonb_build_object('ok', true, 'reason', 'duplicate_ignored');
  end if;

  insert into public.user_levels(
    user_id,level,xp_total,xp_current,xp_next,rank_title,
    rich_points,coins,trust_score,metadata
  ) values (
    q.user_id,1,0,0,1000,'Rookie Builder',0,0,100,'{}'::jsonb
  )
  on conflict(user_id) do nothing;

  update public.user_levels
  set xp_total = coalesce(xp_total,0) + vx,
      rich_points = coalesce(rich_points,0) + vp,
      coins = coalesce(coins,0) + vc,
      updated_at = now()
  where user_id = q.user_id
  returning xp_total into vt;

  vl := greatest(1, floor(vt / 1000.0)::integer + 1);
  vcur := mod(vt, 1000);
  vnext := 1000;
  vr := public.rb_rank_for_level(vl);

  update public.user_levels
  set level = vl,
      xp_current = vcur,
      xp_next = vnext,
      rank_title = vr,
      updated_at = now()
  where user_id = q.user_id;

  insert into public.xp_section_progress(
    user_id,section,xp_total,level,current_streak,longest_streak,
    achievements,counters,last_event_at,updated_at
  ) values (
    q.user_id,q.section,vx,greatest(1,floor(vx/1000.0)::integer+1),
    0,0,'[]'::jsonb,'{}'::jsonb,now(),now()
  )
  on conflict(user_id,section) do update
  set xp_total = public.xp_section_progress.xp_total + excluded.xp_total,
      level = greatest(1,floor((public.xp_section_progress.xp_total + excluded.xp_total)/1000.0)::integer+1),
      last_event_at = now(),
      updated_at = now();

  update public.profiles
  set rich_points = coalesce(rich_points,0) + vp,
      rich_level = vl,
      rank_title = vr,
      updated_at = now()
  where id = q.user_id;

  update public.meta_avatars
  set xp = coalesce(xp,0) + vx,
      level = vl,
      rank = vr,
      updated_at = now()
  where user_id = q.user_id;

  update public.xp_event_queue
  set status = 'awarded', error_message = null, processed_at = now()
  where id = q.id;

  return jsonb_build_object('ok',true,'xp',vx,'coins',vc,'points',vp,'level',vl,'rank',vr);
exception when others then
  update public.xp_event_queue
  set status = 'failed', error_message = left(sqlerrm,500), processed_at = now()
  where id = p_queue_id;
  return jsonb_build_object('ok',false,'reason','processor_error');
end;
$function$;
CREATE OR REPLACE FUNCTION public.rb_award_xp(p_event_key text, p_section text DEFAULT 'global'::text, p_source_table text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_amount integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare v_game_source uuid; v_user uuid:=auth.uid(); e public.xp_events%rowtype; vx int; vc int; vp int; vt int; vl int; vcur int; vr text;
begin
  if v_user is null then return jsonb_build_object('ok',false,'reason','not_signed_in'); end if;
  perform 1 from public.profiles where id=v_user for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-xp:'||v_user::text,0));
  select * into e from public.xp_events where event_key=p_event_key and is_active=true limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','unknown_event'); end if;
  -- Only low-value presence events may be claimed without a persisted source.
  if p_event_key in ('daily_tap_in','section_visit') then
    if p_source_id is not null or p_source_table is not null then return jsonb_build_object('ok',false,'reason','invalid_presence_source'); end if;
  else
    if p_source_id is null or not (
      (p_event_key='creator_publish' and p_source_table='creator_page_settings' and exists(select 1 from public.creator_page_settings where id=p_source_id and user_id=v_user and updated_at>=now()-interval '10 minutes'))
      or (p_event_key='sports_pick' and p_source_table='sports_picks' and exists(select 1 from public.sports_picks where id=p_source_id and user_id=v_user and created_at>=now()-interval '10 minutes'))
      or (p_event_key='game_played' and p_source_table='game_sessions' and exists(select 1 from public.game_sessions where (id=p_source_id or session_key=p_source_id) and user_id=v_user and ended_at>=now()-interval '10 minutes' and duration_seconds>=5 and result not in ('abandoned','expired') and metadata->>'contract'='rb_game_action_v2'))
    ) is not true then return jsonb_build_object('ok',false,'reason','verified_activity_required'); end if;
    if p_event_key='game_played' then
      select id into v_game_source from public.game_sessions where user_id=v_user and (id=p_source_id or session_key=p_source_id) order by id limit 1;
      p_source_id:=v_game_source;
    end if;
    if exists(select 1 from public.user_xp_ledger where user_id=v_user and event_key=p_event_key and source_table=p_source_table and source_id=p_source_id) then return jsonb_build_object('ok',false,'reason','source_already_rewarded'); end if;
  end if;
  if not public.rb_xp_event_allowed(v_user,p_event_key) then return jsonb_build_object('ok',false,'reason','cooldown_or_daily_limit'); end if;
  if e.section<>'global' then p_section:=e.section; elsif p_section is null or p_section !~ '^[a-z][a-z0-9_-]{0,39}$' then p_section:='global'; end if;
  vx:=greatest(coalesce(e.xp_amount,0),0); vc:=greatest(coalesce(e.coins_amount,0),0); vp:=greatest(coalesce(e.rich_points_amount,vx),0);
  insert into public.user_xp_ledger(user_id,event_key,section,xp_amount,coins_amount,rich_points_amount,source_table,source_id,metadata)
  values(v_user,p_event_key,coalesce(nullif(p_section,''),e.section,'global'),vx,vc,vp,p_source_table,p_source_id,jsonb_build_object('source','rb_award_xp','requested_amount_ignored',p_amount));
  insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rich_points,coins,rank_title) values(v_user,1,0,0,1000,0,0,'Rookie Rich') on conflict(user_id) do nothing;
  update public.user_levels set xp_total=coalesce(xp_total,0)+vx,rich_points=coalesce(rich_points,0)+vp,coins=coalesce(coins,0)+vc,updated_at=now() where user_id=v_user returning xp_total into vt;
  vl:=greatest(1,floor(vt/1000.0)::int+1); vcur:=mod(vt,1000); vr:=public.rb_rank_for_level(vl);
  update public.user_levels set level=vl,xp_current=vcur,xp_next=1000,rank_title=vr,updated_at=now() where user_id=v_user;
  insert into public.xp_section_progress(user_id,section,xp_total,level,current_streak,longest_streak,achievements,counters,last_event_at,updated_at)
  values(v_user,coalesce(nullif(p_section,''),e.section,'global'),vx,greatest(1,floor(vx/1000.0)::int+1),0,0,'[]','{}',now(),now())
  on conflict(user_id,section) do update set xp_total=public.xp_section_progress.xp_total+excluded.xp_total,level=greatest(1,floor((public.xp_section_progress.xp_total+excluded.xp_total)/1000.0)::int+1),last_event_at=now(),updated_at=now();
  update public.profiles set rich_points=vp+coalesce(rich_points,0),rich_level=vl,rank_title=vr,online_status='online',last_seen_at=now(),updated_at=now() where id=v_user;
  update public.meta_avatars set xp=coalesce(xp,0)+vx,level=vl,rank=vr,updated_at=now() where user_id=v_user;
  return jsonb_build_object('ok',true,'xp',vx,'coins',vc,'points',vp,'total',vt,'level',vl,'rank',vr,'current',vcur,'next',1000);
end $function$;
CREATE OR REPLACE FUNCTION public.rb_game_action(p_action text, p_game_slug text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_profile public.profiles%rowtype;
  v_session uuid;
  v_session_row public.game_sessions%rowtype;
  v_score integer := greatest(coalesce((p_payload->>'score')::integer,0),0);
  v_duration integer := greatest(coalesce((p_payload->>'duration_seconds')::integer,0),0);
  v_result text := left(coalesce(nullif(p_payload->>'result',''),'completed'),80);
  v_mode text := left(coalesce(nullif(p_payload->>'mode',''),'standard'),40);
  v_platform text := left(coalesce(nullif(p_payload->>'platform_type',''),'web'),40);
  v_xp integer;
  v_xp_event text;
  v_xp_result jsonb := '{}'::jsonb;
  v_progress public.game_player_progress%rowtype;
  v_active integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_game
  from public.games
  where slug=p_game_slug and is_active=true and is_playable=true;
  if not found then raise exception 'Game unavailable'; end if;

  select * into v_profile from public.profiles where id=v_user;

  -- Serialize canonical session creation per identity and game.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-game:'||v_user::text||':'||v_game.id::text,0));
  if p_action='start_session' then
    update public.game_sessions
    set ended_at=coalesce(ended_at,now()),
        result=coalesce(result,'abandoned'),
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by','canonical_start_guard')
    where user_id=v_user and game_id=v_game.id and ended_at is null and started_at < now()-interval '12 hours';

    select session_key into v_session from public.game_sessions where user_id=v_user and game_id=v_game.id and ended_at is null and started_at>=now()-interval '12 hours' order by started_at desc,id desc limit 1;
    if found then return jsonb_build_object('ok',true,'session_key',v_session,'game_id',v_game.id,'contract','v2','reused',true); end if;
    insert into public.game_sessions(
      game_id,game_slug,user_id,username,display_name,started_at,
      platform_type,device_info,metadata
    ) values (
      v_game.id,v_game.slug,v_user,v_profile.username,v_profile.display_name,now(),
      v_platform,coalesce(p_payload->'device_info','{}'::jsonb),
      coalesce(p_payload->'metadata','{}'::jsonb)||jsonb_build_object('contract','rb_game_action_v2')
    ) returning session_key into v_session;

    select count(*)::integer into v_active
    from public.game_sessions
    where game_id=v_game.id and ended_at is null and started_at >= now()-interval '12 hours';

    update public.games
    set total_plays=coalesce(total_plays,0)+1,
        active_players=v_active,
        updated_at=now()
    where id=v_game.id;

    return jsonb_build_object('ok',true,'session_key',v_session,'game_id',v_game.id,'contract','v2');

  elsif p_action='finish_session' then
    v_session:=nullif(p_payload->>'session_key','')::uuid;
    if v_session is null then raise exception 'Valid session_key required'; end if;

    select * into v_session_row
    from public.game_sessions
    where session_key=v_session and user_id=v_user and game_id=v_game.id
    for update;

    if not found then raise exception 'Game session not found'; end if;

    if v_session_row.ended_at is not null then
      return jsonb_build_object(
        'ok',true,'idempotent',true,'session_key',v_session,
        'score',coalesce(v_session_row.score,0),'result',v_session_row.result
      );
    end if;

    if v_session_row.started_at<now()-interval '12 hours' then
      update public.game_sessions set ended_at=now(),result='abandoned',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by','canonical_finish_expiry') where id=v_session_row.id;
      return jsonb_build_object('ok',false,'reason','session_expired');
    end if;
    v_duration:=greatest(0,least(43200,extract(epoch from (now()-coalesce(v_session_row.started_at,now())))::integer));
    v_xp:=least(500,greatest(25,50+(least(v_score,100000)/1000)));
    v_xp_event:='game_played';

    update public.game_sessions
    set ended_at=now(),duration_seconds=v_duration,result=v_result,score=v_score,
        metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_payload->'metadata','{}'::jsonb)||jsonb_build_object('contract','rb_game_action_v2','xp_calculated',v_xp)
    where session_key=v_session;

    insert into public.game_scores(
      game_id,game_slug,user_id,username,display_name,score,mode,platform_type,
      is_verified,anti_cheat_status,metadata
    ) values (
      v_game.id,v_game.slug,v_user,v_profile.username,v_profile.display_name,v_score,v_mode,v_platform,
      false,'pending',coalesce(p_payload->'metadata','{}'::jsonb)||jsonb_build_object('session_key',v_session::text,'contract','rb_game_action_v2')
    ) on conflict ((metadata->>'session_key')) where nullif(metadata->>'session_key','') is not null do nothing;

    select * into v_progress
    from public.game_player_progress
    where game_id=v_game.id and user_id=v_user
    for update;

    if found then
      update public.game_player_progress
      set xp=coalesce(xp,0)+v_xp,
          current_level=greatest(1,((coalesce(xp,0)+v_xp)/500)+1),
          best_score=greatest(coalesce(best_score,0),v_score),
          total_play_seconds=coalesce(total_play_seconds,0)+v_duration,
          last_played_at=now(),updated_at=now(),
          progress=coalesce(progress,'{}'::jsonb)||jsonb_build_object(
            'last_result',v_result,
            'games',coalesce((progress->>'games')::integer,0)+1,
            'last_session_key',v_session::text
          )
      where id=v_progress.id;
    else
      insert into public.game_player_progress(
        game_id,user_id,current_level,xp,best_score,progress,total_play_seconds,last_played_at
      ) values (
        v_game.id,v_user,greatest(1,(v_xp/500)+1),v_xp,v_score,
        jsonb_build_object('last_result',v_result,'games',1,'last_session_key',v_session::text),
        v_duration,now()
      );
    end if;

    begin
      select public.rb_award_xp(v_xp_event,'gaming','game_sessions',v_session_row.id,null) into v_xp_result;
    exception when others then
      v_xp_result:=jsonb_build_object('ok',false,'reason','xp_ledger_unavailable');
    end;

    select count(*)::integer into v_active
    from public.game_sessions
    where game_id=v_game.id and ended_at is null and started_at >= now()-interval '12 hours';

    update public.games
    set active_players=v_active,
        high_score=greatest(coalesce(high_score,0),v_score),
        updated_at=now()
    where id=v_game.id;

    return jsonb_build_object(
      'ok',true,'session_key',v_session,'score',v_score,'xp',v_xp,
      'xp_event',v_xp_event,'xp_ledger',v_xp_result,'contract','v2'
    );
  else
    raise exception 'Unsupported game action';
  end if;
end;
$function$;
create or replace function public.rb_guard_canonical_game_session() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('anon','authenticated') then
   if tg_op='UPDATE' and old.metadata->>'contract'='rb_game_action_v2' then raise exception 'Canonical session is server-managed' using errcode='42501'; end if;
   if new.metadata->>'contract'='rb_game_action_v2' then raise exception 'Canonical session requires server action' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function public.rb_guard_canonical_game_session() from public,anon,authenticated;
create trigger rb_aa_guard_canonical_game_session before insert or update on public.game_sessions for each row execute function public.rb_guard_canonical_game_session();
-- Historical rows remain intact; close only expired zero-score, unfinished sessions.
update public.game_sessions set ended_at=now(),result='abandoned',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by','v1_stale_session_reconciliation') where ended_at is null and started_at<now()-interval '12 hours' and coalesce(score,0)=0 and (result is null or result='abandoned') and metadata->>'contract'='rb_game_action_v2';
update public.games g set active_players=(select count(*) from public.game_sessions s where s.game_id=g.id and s.ended_at is null and s.started_at>=now()-interval '12 hours') where g.active_players is distinct from (select count(*) from public.game_sessions s where s.game_id=g.id and s.ended_at is null and s.started_at>=now()-interval '12 hours');
update public.xp_rule_bindings set is_active=false where (source_table='game_sessions' and event_key='game_played') or (source_table='game_scores' and event_key='game_score_submit');
commit;

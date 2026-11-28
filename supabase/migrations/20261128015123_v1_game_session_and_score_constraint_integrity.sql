begin;
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

    v_duration:=greatest(0,least(43200,extract(epoch from (now()-coalesce(v_session_row.started_at,now())))::integer));
    v_xp:=least(500,greatest(25,50+(least(v_score,100000)/1000)));
    v_xp_event:=case when lower(v_result) ~ '(win|won|victory|complete|completed|success|checkmate)' then 'game_win' else 'game_completed' end;

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
      select public.rb_award_xp(v_xp_event,'gaming','game_sessions',v_session,v_xp) into v_xp_result;
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
$function$
;
CREATE OR REPLACE FUNCTION public.rb_normalize_game_score_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v_game public.games%rowtype;
  v_profile public.profiles%rowtype;
  v_canonical boolean;
begin
  if new.user_id is null then new.user_id:=auth.uid(); end if;
  if new.user_id is distinct from auth.uid() and auth.role()<>'service_role' then
    raise exception 'Invalid game score owner';
  end if;

  if new.game_id is not null then
    select * into v_game from public.games where id=new.game_id;
  elsif nullif(new.game_slug,'') is not null then
    select * into v_game from public.games where slug=new.game_slug;
  end if;
  if not found then raise exception 'Unknown game'; end if;

  new.game_id:=v_game.id;
  new.game_slug:=v_game.slug;
  new.score:=least(greatest(coalesce(new.score,0),0),2147483647);
  new.mode:=left(coalesce(nullif(new.mode,''),'standard'),40);
  new.platform_type:=left(coalesce(nullif(new.platform_type,''),'web'),40);
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
    'normalized_by','rb_normalize_game_score_write_v1'
  );

  select * into v_profile from public.profiles where id=new.user_id;
  new.username:=coalesce(nullif(new.username,''),v_profile.username);
  new.display_name:=coalesce(nullif(new.display_name,''),v_profile.display_name);

  v_canonical:=coalesce(new.metadata->>'contract','')='rb_game_action_v2'
    and nullif(new.metadata->>'session_key','') is not null;
  -- A client-supplied contract label is not proof of a verified score.
  if auth.role() is distinct from 'service_role' then
    new.is_verified:=false;
    new.anti_cheat_status:='pending';
  elsif not v_canonical then
    new.is_verified:=false;
    new.anti_cheat_status:='pending';
  end if;
  return new;
end;
$function$
;
commit;

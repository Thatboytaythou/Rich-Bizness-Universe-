begin;
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
    if p_source_id is null or (
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
commit;

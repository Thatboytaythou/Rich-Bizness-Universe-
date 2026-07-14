update public.xp_events set is_active=true where event_key in ('section_visit','daily_tap_in');

create or replace function public.rb_xp_event_allowed(p_user_id uuid,p_event_key text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare e public.xp_events%rowtype; v_last timestamptz; v_today int;
begin
  select * into e from public.xp_events where event_key=p_event_key and is_active=true limit 1;
  if not found then return false; end if;
  select max(created_at),count(*) filter(where created_at>=date_trunc('day',now())) into v_last,v_today from public.user_xp_ledger where user_id=p_user_id and event_key=p_event_key;
  if coalesce(e.daily_limit,0)>0 and v_today>=e.daily_limit then return false; end if;
  if coalesce(e.cooldown_seconds,0)>0 and v_last is not null and v_last>now()-make_interval(secs=>e.cooldown_seconds) then return false; end if;
  return true;
end $$;

create or replace function public.rb_award_xp(p_event_key text,p_section text default 'global',p_source_table text default null,p_source_id uuid default null,p_amount integer default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); e public.xp_events%rowtype; vx int; vc int; vp int; vt int; vl int; vcur int; vr text;
begin
  if v_user is null then return jsonb_build_object('ok',false,'reason','not_signed_in'); end if;
  select * into e from public.xp_events where event_key=p_event_key and is_active=true limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','unknown_event'); end if;
  if not public.rb_xp_event_allowed(v_user,p_event_key) then return jsonb_build_object('ok',false,'reason','cooldown_or_daily_limit'); end if;
  vx:=greatest(coalesce(e.xp_amount,0),0); vc:=greatest(coalesce(e.coins_amount,0),0); vp:=greatest(coalesce(e.rich_points_amount,vx),0);
  insert into public.user_xp_ledger(user_id,event_key,section,xp_amount,coins_amount,rich_points_amount,source_table,source_id,metadata) values(v_user,p_event_key,coalesce(nullif(p_section,''),e.section,'global'),vx,vc,vp,p_source_table,p_source_id,jsonb_build_object('source','rb_award_xp','requested_amount_ignored',p_amount));
  insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rich_points,coins,rank_title) values(v_user,1,0,0,1000,0,0,'Rookie Rich') on conflict(user_id) do nothing;
  update public.user_levels set xp_total=coalesce(xp_total,0)+vx,rich_points=coalesce(rich_points,0)+vp,coins=coalesce(coins,0)+vc,updated_at=now() where user_id=v_user returning xp_total into vt;
  vl:=greatest(1,floor(vt/1000.0)::int+1); vcur:=mod(vt,1000); vr:=public.rb_rank_for_level(vl);
  update public.user_levels set level=vl,xp_current=vcur,xp_next=1000,rank_title=vr,updated_at=now() where user_id=v_user;
  insert into public.xp_section_progress(user_id,section,xp_total,level,current_streak,longest_streak,achievements,counters,last_event_at,updated_at) values(v_user,coalesce(nullif(p_section,''),e.section,'global'),vx,greatest(1,floor(vx/1000.0)::int+1),0,0,'[]','{}',now(),now()) on conflict(user_id,section) do update set xp_total=public.xp_section_progress.xp_total+excluded.xp_total,level=greatest(1,floor((public.xp_section_progress.xp_total+excluded.xp_total)/1000.0)::int+1),last_event_at=now(),updated_at=now();
  update public.profiles set rich_points=vp+coalesce(rich_points,0),rich_level=vl,rank_title=vr,online_status='online',last_seen_at=now(),updated_at=now() where id=v_user;
  update public.meta_avatars set xp=coalesce(xp,0)+vx,level=vl,rank=vr,updated_at=now() where user_id=v_user;
  return jsonb_build_object('ok',true,'xp',vx,'coins',vc,'points',vp,'total',vt,'level',vl,'rank',vr,'current',vcur,'next',1000);
end $$;

grant execute on function public.rb_award_xp(text,text,text,uuid,integer) to authenticated;
revoke execute on function public.rb_award_xp(text,text,text,uuid,integer) from anon;
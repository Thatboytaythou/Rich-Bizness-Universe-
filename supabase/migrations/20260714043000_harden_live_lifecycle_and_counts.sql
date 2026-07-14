alter table public.live_streams alter column is_vip_enabled set default false;

update public.live_streams
set is_vip_enabled = access_type in ('vip','paid'),
    price_cents = case when access_type in ('vip','paid') then greatest(coalesce(price_cents,0),0) else 0 end,
    viewer_count = greatest(coalesce(viewer_count,0),0),
    peak_viewers = greatest(coalesce(peak_viewers,0),0);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='live_streams_status_valid') then
    alter table public.live_streams add constraint live_streams_status_valid check (status in ('draft','ready','scheduled','upcoming','live','ended','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname='live_streams_access_valid') then
    alter table public.live_streams add constraint live_streams_access_valid check (access_type in ('free','vip','paid','private'));
  end if;
  if not exists (select 1 from pg_constraint where conname='live_streams_counts_nonnegative') then
    alter table public.live_streams add constraint live_streams_counts_nonnegative check (viewer_count >= 0 and peak_viewers >= 0 and price_cents >= 0);
  end if;
end $$;

create unique index if not exists live_stream_members_one_active_user
on public.live_stream_members(stream_id,user_id)
where status='active';

create or replace function public.rb_live_join(p_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_count integer;
begin
  if v_uid is null then raise exception 'Tap in first.' using errcode='28000'; end if;
  if not exists(select 1 from public.live_streams where id=p_stream_id and status='live' and coalesce(last_activity_at,updated_at,started_at)>now()-interval '10 minutes') then
    raise exception 'That Bizness Party is not live right now.';
  end if;
  if exists(select 1 from public.live_stream_bans where stream_id=p_stream_id and banned_user_id=v_uid and (expires_at is null or expires_at>now())) then
    raise exception 'You cannot pop in this room.';
  end if;
  select * into v_profile from public.profiles where id=v_uid;
  insert into public.live_stream_members(stream_id,user_id,role,status,joined_at,left_at,metadata,created_at,updated_at)
  values(p_stream_id,v_uid,'viewer','active',now(),null,jsonb_build_object('display_name',v_profile.display_name,'username',v_profile.username),now(),now())
  on conflict do nothing;
  select count(*)::integer into v_count from public.live_stream_members where stream_id=p_stream_id and status='active';
  update public.live_streams set viewer_count=v_count,peak_viewers=greatest(coalesce(peak_viewers,0),v_count),last_activity_at=now(),updated_at=now() where id=p_stream_id;
  return jsonb_build_object('ok',true,'viewer_count',v_count);
end;
$$;

create or replace function public.rb_live_leave(p_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'Tap in first.' using errcode='28000'; end if;
  update public.live_stream_members set status='left',left_at=coalesce(left_at,now()),updated_at=now() where stream_id=p_stream_id and user_id=v_uid and status='active';
  update public.live_view_sessions set left_at=coalesce(left_at,now()) where stream_id=p_stream_id and user_id=v_uid and left_at is null;
  select count(*)::integer into v_count from public.live_stream_members where stream_id=p_stream_id and status='active';
  update public.live_streams set viewer_count=v_count,updated_at=now() where id=p_stream_id;
  return jsonb_build_object('ok',true,'viewer_count',v_count);
end;
$$;

create or replace function public.rb_end_live_stream(p_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_stream public.live_streams%rowtype;
begin
  if v_uid is null then raise exception 'Tap in first.' using errcode='28000'; end if;
  update public.live_streams
  set status='ended',status_label='PARTY’S OVER',ended_at=coalesce(ended_at,now()),last_activity_at=now(),viewer_count=0,updated_at=now()
  where id=p_stream_id and creator_id=v_uid and status in ('live','ready','scheduled','upcoming','draft')
  returning * into v_stream;
  if not found then raise exception 'That live room is not yours or it already ended.'; end if;
  update public.live_stream_members set status='left',left_at=coalesce(left_at,now()),updated_at=now() where stream_id=p_stream_id and status='active';
  update public.live_view_sessions set left_at=coalesce(left_at,now()) where stream_id=p_stream_id and left_at is null;
  update public.profiles set online_status='online',updated_at=now() where id=v_uid;
  return jsonb_build_object('ok',true,'message','PARTY’S OVER — replay gettin’ right.','stream',to_jsonb(v_stream));
end;
$$;

grant execute on function public.rb_live_join(uuid) to authenticated;
grant execute on function public.rb_live_leave(uuid) to authenticated;
grant execute on function public.rb_end_live_stream(uuid) to authenticated;
revoke execute on function public.rb_live_join(uuid) from anon;
revoke execute on function public.rb_live_leave(uuid) from anon;
revoke execute on function public.rb_end_live_stream(uuid) from anon;

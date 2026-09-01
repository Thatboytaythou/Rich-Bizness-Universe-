create or replace function public.rb_live_can_access(p_stream_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_user uuid := coalesce(p_user_id, v_caller);
begin
  if v_caller is null then
    return false;
  end if;

  if v_user is distinct from v_caller and not public.rb_is_admin(1) then
    return false;
  end if;

  return exists(
    select 1
    from public.live_streams s
    where s.id = p_stream_id
      and (
        s.creator_id = v_user
        or coalesce(s.access_type,'free') in ('free','public')
        or exists(
          select 1 from public.live_stream_members m
          where m.stream_id=s.id and m.user_id=v_user and m.status in ('active','invited')
        )
        or (
          s.access_type in ('vip','subscriber','private')
          and exists(
            select 1 from public.vip_live_access a
            where a.stream_id=s.id and a.user_id=v_user
              and a.access_status='active'
              and (a.expires_at is null or a.expires_at>now())
          )
        )
        or (
          s.access_type='paid'
          and exists(
            select 1 from public.live_stream_purchases p
            where p.stream_id=s.id and p.user_id=v_user and p.status='paid'
          )
        )
      )
  );
end;
$$;

create or replace function public.rb_live_snapshot(p_stream_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_public_room boolean := false;
  v_can_access boolean := false;
begin
  if v_user is not null then
    v_is_admin := public.rb_is_admin(1);
  end if;

  if p_stream_id is not null then
    select
      (v_user is not null and s.creator_id = v_user),
      (s.status = 'live' and coalesce(s.access_type,'free') in ('free','public'))
    into v_is_owner, v_public_room
    from public.live_streams s
    where s.id = p_stream_id;

    if found then
      if v_user is null then
        v_can_access := v_public_room;
      else
        v_can_access := v_is_admin or public.rb_live_can_access(p_stream_id, v_user);
      end if;
    end if;
  end if;

  select jsonb_build_object(
    'profile', case when v_user is null then null else (
      select to_jsonb(p) from (
        select id,username,display_name,avatar_url,rank_title,rich_level,rich_points
        from public.profiles where id=v_user
      ) p
    ) end,
    'live', coalesce((
      select jsonb_agg(to_jsonb(s) order by (s.status='live') desc,s.is_featured desc,s.created_at desc)
      from (
        select * from public.live_streams
        where status in ('draft','scheduled','upcoming','ready','live')
          and (
            creator_id = v_user
            or (status='live' and coalesce(access_type,'free') in ('free','public'))
          )
        order by (creator_id=v_user) desc,(status='live') desc,is_featured desc,created_at desc
        limit 120
      ) s
    ), '[]'::jsonb),
    'recordings','[]'::jsonb,
    'alerts', case when v_user is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('creator_id',creator_id,'stream_id',stream_id,'alert_level',alert_level))
      from public.live_alert_subscriptions
      where user_id=v_user and coalesce(is_active,true)
    ), '[]'::jsonb) end,
    'chat', case when p_stream_id is null or not v_can_access then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(c) order by c.is_pinned desc,c.created_at asc)
      from (
        select id,stream_id,user_id,username,display_name,message,body,is_pinned,created_at
        from public.live_chat_messages
        where stream_id=p_stream_id and coalesce(is_deleted,false)=false
        order by is_pinned desc,created_at asc limit 160
      ) c
    ), '[]'::jsonb) end,
    'activity', case when p_stream_id is null or not v_can_access then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (select * from public.live_member_activity where stream_id=p_stream_id order by created_at desc limit 80) a
    ), '[]'::jsonb) end,
    'members', case when p_stream_id is null or not v_can_access then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(m) order by m.joined_at desc)
      from (
        select stream_id,user_id,role,status,joined_at,left_at,metadata
        from public.live_stream_members where stream_id=p_stream_id order by joined_at desc limit 120
      ) m
    ), '[]'::jsonb) end,
    'tips', case when p_stream_id is null or not (v_is_owner or v_is_admin) then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at desc)
      from (select * from public.live_tips where stream_id=p_stream_id order by created_at desc limit 80) t
    ), '[]'::jsonb) end,
    'purchases', case
      when p_stream_id is null or not v_can_access then '[]'::jsonb
      when v_is_owner or v_is_admin then coalesce((
        select jsonb_agg(to_jsonb(p) order by p.created_at desc)
        from (select * from public.live_stream_purchases where stream_id=p_stream_id order by created_at desc limit 80) p
      ), '[]'::jsonb)
      when v_user is not null then coalesce((
        select jsonb_agg(to_jsonb(p) order by p.created_at desc)
        from (select * from public.live_stream_purchases where stream_id=p_stream_id and user_id=v_user order by created_at desc limit 20) p
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'metrics', jsonb_build_object(
      'live_count',(select count(*) from public.live_streams where status='live' and (creator_id=v_user or coalesce(access_type,'free') in ('free','public'))),
      'viewer_count',(select coalesce(sum(viewer_count),0) from public.live_streams where status='live' and (creator_id=v_user or coalesce(access_type,'free') in ('free','public'))),
      'chat_count',(select coalesce(sum(total_chat_messages),0) from public.live_streams where status='live' and (creator_id=v_user or coalesce(access_type,'free') in ('free','public'))),
      'reaction_count',(select coalesce(sum(total_reactions),0) from public.live_streams where status='live' and (creator_id=v_user or coalesce(access_type,'free') in ('free','public'))),
      'revenue_cents',case when v_user is null then 0 else (select coalesce(sum(total_revenue_cents),0) from public.live_streams where creator_id=v_user) end,
      'tip_cents',case when p_stream_id is null or not (v_is_owner or v_is_admin) then 0 else (select coalesce(sum(amount_cents),0) from public.live_tips where stream_id=p_stream_id) end,
      'purchase_cents',case when p_stream_id is null or not (v_is_owner or v_is_admin) then 0 else (select coalesce(sum(amount_cents),0) from public.live_stream_purchases where stream_id=p_stream_id) end,
      'member_count',case when p_stream_id is null or not v_can_access then 0 else (select count(*) from public.live_stream_members where stream_id=p_stream_id and status='active') end
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.rb_live_can_access(uuid,uuid) from anon;
grant execute on function public.rb_live_can_access(uuid,uuid) to authenticated, service_role;
grant execute on function public.rb_live_snapshot(uuid) to anon, authenticated, service_role;

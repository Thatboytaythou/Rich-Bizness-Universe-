create or replace function public.rb_authorize_livekit_room(p_room_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.dm_call_sessions%rowtype;
  v_stream public.live_streams%rowtype;
  v_allowed boolean := false;
  v_role text := 'viewer';
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_call
  from public.dm_call_sessions
  where livekit_room_name = p_room_name
  limit 1;

  if found then
    select exists (
      select 1 from public.dm_call_participants p
      where p.call_id = v_call.id
        and p.user_id = v_user_id
        and p.status in ('invited','joined')
    ) or v_call.started_by = v_user_id
      or exists (
        select 1 from public.dm_thread_members m
        where m.thread_id = v_call.thread_id
          and m.user_id = v_user_id
          and m.status = 'active'
      ) into v_allowed;

    if not v_allowed then raise exception 'room_access_denied'; end if;
    v_role := case when v_call.started_by = v_user_id then 'host' else 'participant' end;

    return jsonb_build_object(
      'allowed', true,
      'room_type', 'dm_call',
      'resource_id', v_call.id,
      'role', v_role,
      'can_publish', true,
      'can_subscribe', true,
      'can_publish_data', true
    );
  end if;

  select * into v_stream
  from public.live_streams
  where livekit_room_name = p_room_name
  limit 1;

  if found then
    if v_stream.creator_id = v_user_id then
      v_allowed := true;
      v_role := 'host';
    else
      select exists (
        select 1 from public.live_stream_members m
        where m.stream_id = v_stream.id
          and m.user_id = v_user_id
          and m.status in ('active','invited')
      ) into v_allowed;

      if v_allowed then
        select coalesce((select m.role from public.live_stream_members m
          where m.stream_id = v_stream.id and m.user_id = v_user_id
          order by m.created_at desc limit 1), 'viewer') into v_role;
      elsif v_stream.access_type = 'free' then
        v_allowed := true;
        v_role := 'viewer';
      elsif v_stream.access_type in ('vip','subscriber','private') then
        select exists (
          select 1 from public.vip_live_access a
          where a.stream_id = v_stream.id
            and a.user_id = v_user_id
            and a.access_status = 'active'
            and (a.expires_at is null or a.expires_at > now())
        ) into v_allowed;
      elsif v_stream.access_type = 'paid' then
        select exists (
          select 1 from public.live_stream_purchases p
          where p.stream_id = v_stream.id
            and p.user_id = v_user_id
            and p.status = 'paid'
        ) into v_allowed;
      end if;
    end if;

    if not v_allowed then raise exception 'room_access_denied'; end if;

    return jsonb_build_object(
      'allowed', true,
      'room_type', 'live_stream',
      'resource_id', v_stream.id,
      'role', v_role,
      'can_publish', v_role in ('host','cohost','moderator','guest'),
      'can_subscribe', true,
      'can_publish_data', true
    );
  end if;

  raise exception 'room_not_found';
end;
$$;

revoke all on function public.rb_authorize_livekit_room(text) from public;
grant execute on function public.rb_authorize_livekit_room(text) to authenticated;

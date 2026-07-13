-- Step 16: secure privileged RPC inputs.
-- Production migration applied through Supabase as step_16_secure_privileged_rpc_inputs.

create or replace function public.rb_award_xp(
  p_event_key text,
  p_section text default 'global',
  p_source_table text default null,
  p_source_id uuid default null,
  p_amount integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_event public.xp_events%rowtype;
  v_xp integer := 0;
  v_points integer := 0;
  v_total integer := 0;
  v_level integer := 1;
  v_current integer := 0;
  v_next integer := 1000;
  v_rank text := 'Rookie Builder';
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select * into v_event
  from public.xp_events
  where event_key = p_event_key and coalesce(is_active, true) = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_event');
  end if;

  v_xp := greatest(coalesce(v_event.xp_amount, 0), 0);
  v_points := greatest(coalesce(v_event.rich_points_amount, v_xp, 0), 0);

  if v_xp <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_xp');
  end if;

  insert into public.user_xp_ledger(
    user_id, event_key, section, xp_amount, rich_points_amount,
    source_table, source_id, metadata
  ) values (
    v_user, p_event_key, coalesce(p_section, 'global'), v_xp, v_points,
    p_source_table, p_source_id,
    jsonb_build_object('source', 'rb_award_xp', 'requested_amount_ignored', p_amount)
  );

  insert into public.user_levels(
    user_id, level, xp_total, xp_current, xp_next, rich_points, rank_title
  ) values (
    v_user, 1, 0, 0, 1000, 0, 'Rookie Builder'
  ) on conflict (user_id) do nothing;

  update public.user_levels
  set xp_total = coalesce(xp_total, 0) + v_xp,
      rich_points = coalesce(rich_points, 0) + v_points,
      updated_at = now()
  where user_id = v_user
  returning xp_total into v_total;

  v_level := greatest(1, floor(v_total / 1000)::integer + 1);
  v_current := mod(v_total, 1000);
  v_next := v_level * 1000;
  v_rank := public.rb_rank_for_level(v_level);

  update public.user_levels
  set level = v_level,
      xp_current = v_current,
      xp_next = v_next,
      rank_title = v_rank,
      updated_at = now()
  where user_id = v_user;

  update public.profiles
  set rich_points = coalesce(rich_points, 0) + v_points,
      rich_level = v_level,
      rank_title = v_rank,
      online_status = 'online',
      last_seen_at = now(),
      updated_at = now()
  where id = v_user;

  update public.meta_avatars
  set xp = coalesce(xp, 0) + v_xp,
      level = v_level,
      rank = v_rank,
      updated_at = now()
  where user_id = v_user;

  return jsonb_build_object(
    'ok', true,
    'xp', v_xp,
    'points', v_points,
    'total', v_total,
    'level', v_level,
    'rank', v_rank,
    'current', v_current,
    'next', v_next
  );
end;
$$;

revoke all on function public.rb_award_xp(text,text,text,uuid,integer) from public, anon;
grant execute on function public.rb_award_xp(text,text,text,uuid,integer) to authenticated, service_role;

create or replace function public.save_meta_avatar(
  p_aura text default 'emerald-gold',
  p_outfit text default 'rich-default',
  p_motion text default 'idle-float',
  p_avatar_url text default '/images/brand/Avatar-hero-Banner.png.jpeg',
  p_model_url text default '/images/brand/meta-avatar.png.jpeg',
  p_display_name text default null,
  p_rank text default 'Biz Legend',
  p_level integer default 1,
  p_xp integer default 0,
  p_avatar_config jsonb default '{}'::jsonb
)
returns public.meta_avatars
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.meta_avatars;
  v_level integer := 1;
  v_xp integer := 0;
  v_rank text := 'Rookie Builder';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(level, 1), coalesce(xp_total, 0), coalesce(rank_title, 'Rookie Builder')
  into v_level, v_xp, v_rank
  from public.user_levels
  where user_id = v_uid;

  insert into public.profiles(
    id, username, display_name, avatar_url, banner_url,
    rich_level, rank_title, rich_points, online_status, metadata, updated_at
  ) values (
    v_uid,
    'rich_' || replace(v_uid::text, '-', '_'),
    coalesce(nullif(p_display_name, ''), 'Rich User'),
    coalesce(nullif(p_avatar_url, ''), '/images/brand/Avatar-hero-Banner.png.jpeg'),
    '/images/brand/IMG_5997.png',
    v_level,
    v_rank,
    0,
    'online',
    jsonb_build_object('avatar_required', true, 'avatar_source', 'save_meta_avatar'),
    now()
  ) on conflict (id) do update set
    display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
    avatar_url = coalesce(nullif(excluded.avatar_url, ''), public.profiles.avatar_url),
    online_status = 'online',
    metadata = coalesce(public.profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  insert into public.meta_avatars(
    user_id, display_name, avatar_url, model_url, aura, rank, level, xp,
    is_active, metadata, updated_at
  ) values (
    v_uid,
    coalesce(nullif(p_display_name, ''), 'Rich User'),
    coalesce(nullif(p_avatar_url, ''), '/images/brand/Avatar-hero-Banner.png.jpeg'),
    coalesce(nullif(p_model_url, ''), '/images/brand/meta-avatar.png.jpeg'),
    coalesce(nullif(p_aura, ''), 'emerald-gold'),
    v_rank,
    v_level,
    v_xp,
    true,
    jsonb_build_object(
      'avatar_config', coalesce(p_avatar_config, '{}'::jsonb) || jsonb_build_object(
        'aura', p_aura,
        'outfit', p_outfit,
        'motion', p_motion,
        'version', 43
      ),
      'banner_url', '/images/brand/IMG_5997.png',
      'synced_from', 'save_meta_avatar',
      'client_progress_ignored', true
    ),
    now()
  ) on conflict (user_id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    model_url = excluded.model_url,
    aura = excluded.aura,
    rank = excluded.rank,
    level = excluded.level,
    xp = excluded.xp,
    is_active = true,
    metadata = coalesce(public.meta_avatars.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_meta_avatar(text,text,text,text,text,text,text,integer,integer,jsonb) from public, anon;
grant execute on function public.save_meta_avatar(text,text,text,text,text,text,text,integer,integer,jsonb) to authenticated, service_role;

revoke all on function public.rb_join_game_room(text) from public, anon;
revoke all on function public.rb_record_game_move(uuid,text,text,text,text,jsonb,text,jsonb) from public, anon;
revoke all on function public.rb_is_admin(integer) from public, anon;
revoke all on function public.rb_is_dm_thread_member(uuid) from public, anon;

grant execute on function public.rb_join_game_room(text) to authenticated, service_role;
grant execute on function public.rb_record_game_move(uuid,text,text,text,text,jsonb,text,jsonb) to authenticated, service_role;
grant execute on function public.rb_is_admin(integer) to authenticated, service_role;
grant execute on function public.rb_is_dm_thread_member(uuid) to authenticated, service_role;

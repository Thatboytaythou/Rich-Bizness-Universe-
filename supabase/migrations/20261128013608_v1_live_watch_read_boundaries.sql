-- V1: narrow direct public media reads; preserve owner access and permitted room realtime.
CREATE OR REPLACE FUNCTION public.rb_live_snapshot(p_stream_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
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
        order by is_pinned desc,created_at desc,id desc limit 160
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
$function$
;
CREATE OR REPLACE FUNCTION public.rb_watch_feed(p_limit integer DEFAULT 120)
 RETURNS TABLE(source_type text, source_id uuid, creator_id uuid, creator_name text, title text, description text, media_url text, thumbnail_url text, duration_seconds integer, view_count integer, created_at timestamp with time zone, section text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
  select * from (
    select
      'live_recording'::text as source_type,
      r.id as source_id,
      coalesce(r.creator_id,r.user_id) as creator_id,
      coalesce(p.display_name,p.username,'Rich Creator') as creator_name,
      coalesce(r.title,'Live Replay') as title,
      coalesce(r.description,'') as description,
      r.recording_url as media_url,
      coalesce(r.thumbnail_url,r.cover_url) as thumbnail_url,
      coalesce(r.duration_seconds,0)::integer as duration_seconds,
      coalesce(r.view_count,0)::integer as view_count,
      r.created_at,
      'live'::text as section
    from public.live_recordings r
    left join public.profiles p on p.id=coalesce(r.creator_id,r.user_id)
    where r.recording_url is not null
      and coalesce(r.visibility,'public')='public'
      and coalesce(r.status,'ready')='ready'

    union all

    select
      'podcast_episode',
      e.id,
      e.user_id,
      coalesce(p.display_name,p.username,'Rich Podcast'),
      coalesce(e.title,'Rich Podcast'),
      coalesce(e.description,''),
      e.video_url,
      coalesce(e.thumbnail_url,e.cover_url),
      coalesce(e.duration_seconds,0)::integer,
      coalesce(e.play_count,0)::integer,
      e.created_at,
      'podcast'
    from public.podcast_episodes e
    left join public.profiles p on p.id=e.user_id
    where e.video_url is not null
      and coalesce(e.is_published,true)=true
      and coalesce(e.visibility,'public')='public'

    union all

    select
      'feed_video',
      f.id,
      f.user_id,
      coalesce(f.display_name,f.username,'Rich Creator'),
      coalesce(f.title,'Rich Video'),
      coalesce(f.body,''),
      coalesce(f.media_url,f.file_url),
      coalesce(f.thumbnail_url,f.cover_url),
      0::integer,
      coalesce(f.view_count,0)::integer,
      f.created_at,
      coalesce(f.section,'feed')
    from public.feed_posts f
    where coalesce(f.media_url,f.file_url) is not null
      and (coalesce(f.media_type,'') like 'video%' or f.post_type='video')
      and coalesce(f.visibility,'public')='public'
      and coalesce(f.moderation_state,'clear') in ('clear','approved')

    union all

    select
      'game_clip',
      g.id,
      g.user_id,
      coalesce(g.display_name,g.username,'Rich Gamer'),
      coalesce(g.title,'Game Clip'),
      coalesce(g.caption,''),
      g.clip_url,
      g.thumbnail_url,
      0::integer,
      coalesce(g.view_count,0)::integer,
      g.created_at,
      'gaming'
    from public.game_clips g
    where g.clip_url is not null

    union all

    select
      'sports_clip',
      s.id,
      s.user_id,
      coalesce(s.display_name,s.username,'Rich Sports'),
      coalesce(s.title,'Sports Highlight'),
      coalesce(s.caption,''),
      s.file_url,
      s.thumbnail_url,
      0::integer,
      coalesce(s.views,0)::integer,
      s.created_at,
      'sports'
    from public.sports_uploads s
    where s.file_url is not null

    union all

    select
      'sports_replay',
      b.id,
      b.user_id,
      coalesce(b.display_name,b.username,'Rich Sports'),
      b.title,
      coalesce(b.description,''),
      b.replay_url,
      b.cover_url,
      0::integer,
      coalesce(b.viewer_count,0)::integer,
      b.created_at,
      'sports'
    from public.sports_broadcasts b
    where b.replay_url is not null
      and b.status='ended'
      and coalesce(b.access_type,'free') in ('free','public')
  ) q
  where nullif(q.media_url,'') is not null
  order by q.created_at desc
  limit greatest(1,least(coalesce(p_limit,120),200));
$function$
;
alter policy live_chat_messages_public_read on public.live_chat_messages using ((exists (select 1 from public.live_streams s where s.id = stream_id and s.status = 'live' and coalesce(s.access_type,'free') in ('free','public')) or case when (select auth.uid()) is not null then (public.rb_live_can_access(stream_id,(select auth.uid())) or (select public.rb_is_admin(1))) else false end) and not coalesce(is_deleted,false));
alter policy live_reactions_public_read on public.live_reactions using ((exists (select 1 from public.live_streams s where s.id = stream_id and s.status = 'live' and coalesce(s.access_type,'free') in ('free','public')) or case when (select auth.uid()) is not null then (public.rb_live_can_access(stream_id,(select auth.uid())) or (select public.rb_is_admin(1))) else false end));
alter policy live_member_activity_public_read on public.live_member_activity using ((exists (select 1 from public.live_streams s where s.id = stream_id and s.status = 'live' and coalesce(s.access_type,'free') in ('free','public')) or case when (select auth.uid()) is not null then (public.rb_live_can_access(stream_id,(select auth.uid())) or (select public.rb_is_admin(1))) else false end));
alter policy live_stream_members_public_read on public.live_stream_members using ((exists (select 1 from public.live_streams s where s.id = stream_id and s.status = 'live' and coalesce(s.access_type,'free') in ('free','public')) or case when (select auth.uid()) is not null then (public.rb_live_can_access(stream_id,(select auth.uid())) or (select public.rb_is_admin(1))) else false end));
alter policy live_recordings_select_public on public.live_recordings using ((visibility='public' and status in ('ready','completed','published','processed')) or (select auth.uid()) in (creator_id,user_id) or case when (select auth.uid()) is not null then (select public.rb_is_admin(1)) else false end);
alter policy feed_posts_public_read on public.feed_posts using ((visibility='public' and coalesce(moderation_state,'clear') in ('clear','approved')) or user_id=(select auth.uid()) or case when (select auth.uid()) is not null then (select public.rb_is_admin(1)) else false end);

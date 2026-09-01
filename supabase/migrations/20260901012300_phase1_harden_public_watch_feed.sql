create or replace function public.rb_watch_feed(p_limit integer default 120)
returns table(source_type text, source_id uuid, creator_id uuid, creator_name text, title text, description text, media_url text, thumbnail_url text, duration_seconds integer, view_count integer, created_at timestamptz, section text)
language sql
stable
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $$
  select * from (
    select 'live_recording'::text as source_type,r.id as source_id,coalesce(r.creator_id,r.user_id) as creator_id,coalesce(p.display_name,p.username,'Rich Creator') as creator_name,coalesce(r.title,'Live Replay') as title,coalesce(r.description,'') as description,r.recording_url as media_url,coalesce(r.thumbnail_url,r.cover_url) as thumbnail_url,coalesce(r.duration_seconds,0)::integer as duration_seconds,coalesce(r.view_count,0)::integer as view_count,r.created_at,'live'::text as section
    from public.live_recordings r left join public.profiles p on p.id=coalesce(r.creator_id,r.user_id)
    where r.recording_url is not null and coalesce(r.visibility,'public')='public' and coalesce(r.status,'ready')='ready'
    union all
    select 'podcast_episode',e.id,e.user_id,coalesce(p.display_name,p.username,'Rich Podcast'),coalesce(e.title,'Rich Podcast'),coalesce(e.description,''),e.video_url,coalesce(e.thumbnail_url,e.cover_url),coalesce(e.duration_seconds,0)::integer,coalesce(e.play_count,0)::integer,e.created_at,'podcast'
    from public.podcast_episodes e left join public.profiles p on p.id=e.user_id
    where e.video_url is not null and coalesce(e.is_published,true)=true and coalesce(e.visibility,'public')='public'
    union all
    select 'feed_video',f.id,f.user_id,coalesce(f.display_name,f.username,'Rich Creator'),coalesce(f.title,'Rich Video'),coalesce(f.body,''),coalesce(f.media_url,f.file_url),coalesce(f.thumbnail_url,f.cover_url),0::integer,coalesce(f.view_count,0)::integer,f.created_at,coalesce(f.section,'feed')
    from public.feed_posts f
    where coalesce(f.media_url,f.file_url) is not null and (coalesce(f.media_type,'') like 'video%' or f.post_type='video') and coalesce(f.visibility,'public')='public' and coalesce(f.moderation_state,'approved')<>'blocked'
    union all
    select 'game_clip',g.id,g.user_id,coalesce(g.display_name,g.username,'Rich Gamer'),coalesce(g.title,'Game Clip'),coalesce(g.caption,''),g.clip_url,g.thumbnail_url,0::integer,coalesce(g.view_count,0)::integer,g.created_at,'gaming'
    from public.game_clips g where g.clip_url is not null
    union all
    select 'sports_clip',s.id,s.user_id,coalesce(s.display_name,s.username,'Rich Sports'),coalesce(s.title,'Sports Highlight'),coalesce(s.caption,''),s.file_url,s.thumbnail_url,0::integer,coalesce(s.views,0)::integer,s.created_at,'sports'
    from public.sports_uploads s where s.file_url is not null
    union all
    select 'sports_replay',b.id,b.user_id,coalesce(b.display_name,b.username,'Rich Sports'),b.title,coalesce(b.description,''),b.replay_url,b.cover_url,0::integer,coalesce(b.viewer_count,0)::integer,b.created_at,'sports'
    from public.sports_broadcasts b
    where b.replay_url is not null and b.status='ended' and coalesce(b.access_type,'free') in ('free','public')
  ) q
  where nullif(q.media_url,'') is not null
  order by q.created_at desc
  limit greatest(1,least(coalesce(p_limit,120),200));
$$;

grant execute on function public.rb_watch_feed(integer) to anon, authenticated, service_role;

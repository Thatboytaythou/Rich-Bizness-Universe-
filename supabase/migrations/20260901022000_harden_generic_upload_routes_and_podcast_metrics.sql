create or replace function public.rb_upload_snapshot(p_limit integer default 20)
returns jsonb
language plpgsql
stable security definer
set search_path = public, extensions, auth, storage, pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_profile jsonb;
  v_routes jsonb;
  v_uploads jsonb;
  v_total bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select to_jsonb(p) - 'email' into v_profile from public.profiles p where p.id=v_user;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order,r.section,r.route_key),'[]'::jsonb)
    into v_routes
  from public.storage_bucket_routes r
  where r.is_active=true
    and r.route_key not in ('game-assets','game-covers','sports-covers');
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at desc),'[]'::jsonb)
    into v_uploads
  from (
    select * from public.uploads
    where user_id=v_user
    order by created_at desc
    limit greatest(1,least(coalesce(p_limit,20),100))
  ) u;
  select count(*) into v_total from public.uploads where user_id=v_user;
  return jsonb_build_object(
    'profile',coalesce(v_profile,'{}'::jsonb),
    'routes',v_routes,
    'recent_uploads',v_uploads,
    'total_uploads',v_total,
    'queued_uploads',(select count(*) from public.uploads where user_id=v_user and processing_status in ('queued','processing')),
    'failed_uploads',(select count(*) from public.uploads where user_id=v_user and processing_status='failed')
  );
end;
$$;

create or replace function public.rb_podcast_snapshot(p_episode_id uuid default null, p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $$
declare v_user uuid:=auth.uid(); v_episode uuid; v_result jsonb;
begin
 select coalesce(p_episode_id,(select id from public.podcast_episodes where coalesce(is_published,true)=true and coalesce(visibility,'public')='public' order by coalesce(is_featured,false) desc,created_at desc limit 1)) into v_episode;
 select jsonb_build_object(
  'shows',coalesce((select jsonb_agg(to_jsonb(s) order by s.is_featured desc,s.created_at desc) from (select * from public.podcast_shows where coalesce(is_published,true)=true order by coalesce(is_featured,false) desc,created_at desc limit greatest(1,least(p_limit,100))) s),'[]'::jsonb),
  'episodes',coalesce((select jsonb_agg(to_jsonb(e) order by e.is_featured desc,e.created_at desc) from (select pe.*,ps.title show_title,ps.category show_category,ps.cover_url show_cover_url,ls.status live_status,ls.viewer_count live_viewers,ls.thumbnail_url live_thumbnail_url from public.podcast_episodes pe left join public.podcast_shows ps on ps.id=pe.show_id left join public.live_streams ls on ls.id=pe.live_stream_id where coalesce(pe.is_published,true)=true and coalesce(pe.visibility,'public')='public' order by coalesce(pe.is_featured,false) desc,pe.created_at desc limit greatest(1,least(p_limit,100))) e),'[]'::jsonb),
  'liked',case when v_user is null then false else exists(select 1 from public.podcast_likes where user_id=v_user and episode_id=v_episode) end,
  'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at asc) from (select id,episode_id,user_id,username,display_name,body,created_at from public.podcast_comments where episode_id=v_episode order by created_at asc limit 160)c),'[]'::jsonb),
  'metrics',jsonb_build_object(
    'shows',(select count(*) from public.podcast_shows where coalesce(is_published,true)=true),
    'episodes',(select count(*) from public.podcast_episodes where coalesce(is_published,true)=true and coalesce(visibility,'public')='public'),
    'audio_episodes',(select count(*) from public.podcast_episodes where coalesce(is_published,true)=true and coalesce(visibility,'public')='public' and coalesce(media_type,'audio')='audio'),
    'video_episodes',(select count(*) from public.podcast_episodes where coalesce(is_published,true)=true and coalesce(visibility,'public')='public' and coalesce(media_type,'video')='video'),
    'live_now',(select count(*) from public.podcast_episodes pe join public.live_streams ls on ls.id=pe.live_stream_id where ls.status='live')
  )
 ) into v_result;
 return v_result;
end;
$$;

create or replace function public.rb_upload_route_requires_target(p_route_key text)
returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(p_route_key,'') in ('game-assets','game-covers','sports-covers');
$$;
revoke execute on function public.rb_upload_route_requires_target(text) from anon;
grant execute on function public.rb_upload_route_requires_target(text) to authenticated, service_role;

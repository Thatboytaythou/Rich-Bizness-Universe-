create or replace function public.rb_global_search(p_query text, p_limit integer default 40)
returns table(category text, id uuid, title text, subtitle text, image_url text, target_url text, score real)
language sql
stable
security definer
set search_path = public
as $function$
  with q as (
    select trim(coalesce(p_query,'')) as term,
           greatest(1, least(coalesce(p_limit,40),100)) as lim,
           auth.uid() as viewer_id
  ),
  results(category,id,title,subtitle,image_url,target_url,score) as (
    select 'creator'::text, p.id, coalesce(p.display_name,p.username,'Rich Member'), coalesce('@'||p.username,p.bio,''), p.avatar_url, '/profile.html?id='||p.id::text,
      greatest(similarity(coalesce(p.display_name,''),(select term from q)), similarity(coalesce(p.username,''),(select term from q)))::real
    from public.profiles p
    left join public.user_settings us on us.user_id=p.id, q
    where q.term<>'' and p.account_status='active'
      and (
        coalesce(us.profile_visibility,'public')='public'
        or p.id=q.viewer_id
        or (
          coalesce(us.profile_visibility,'public')='followers'
          and q.viewer_id is not null
          and exists (select 1 from public.followers f where f.follower_id=q.viewer_id and f.following_id=p.id)
        )
      )
      and (coalesce(p.display_name,'') ilike '%'||q.term||'%' or coalesce(p.username,'') ilike '%'||q.term||'%' or coalesce(p.bio,'') ilike '%'||q.term||'%')
    union all
    select 'post', f.id, coalesce(f.title,left(f.body,80),'Feed post'), coalesce(f.display_name,f.username,'Rich Bizness'), coalesce(f.thumbnail_url,f.media_url,f.cover_url), '/feed.html?post='||f.id::text, similarity(coalesce(f.title,'')||' '||coalesce(f.body,''),(select term from q))::real from public.feed_posts f, q where q.term<>'' and f.visibility='public' and (coalesce(f.title,'') ilike '%'||q.term||'%' or coalesce(f.body,'') ilike '%'||q.term||'%')
    union all
    select 'music', m.id, m.title, coalesce(m.display_name,m.username,m.genre,'Music'), m.cover_url, '/music.html?track='||m.id::text, similarity(coalesce(m.title,'')||' '||coalesce(m.description,''),(select term from q))::real from public.music_tracks m, q where q.term<>'' and m.is_published=true and coalesce(m.visibility,'public')='public' and (m.title ilike '%'||q.term||'%' or coalesce(m.description,'') ilike '%'||q.term||'%' or coalesce(m.display_name,'') ilike '%'||q.term||'%')
    union all
    select 'podcast', e.id, e.title, coalesce(e.display_name,e.username,'Podcast'), e.cover_url, '/podcast.html?episode='||e.id::text, similarity(coalesce(e.title,'')||' '||coalesce(e.description,''),(select term from q))::real from public.podcast_episodes e, q where q.term<>'' and e.is_published=true and coalesce(e.visibility,'public')='public' and (e.title ilike '%'||q.term||'%' or coalesce(e.description,'') ilike '%'||q.term||'%')
    union all
    select 'radio', r.id, r.station_name, coalesce(r.display_name,r.genre,'Radio'), r.cover_url, '/radio.html?station='||r.id::text, similarity(coalesce(r.station_name,'')||' '||coalesce(r.description,''),(select term from q))::real from public.radio_stations r, q where q.term<>'' and r.is_public=true and (r.station_name ilike '%'||q.term||'%' or coalesce(r.description,'') ilike '%'||q.term||'%')
    union all
    select 'live', l.id, l.title, coalesce(l.category,l.status_label,'Live'), coalesce(l.thumbnail_url,l.cover_url), '/live.html?stream='||l.id::text, similarity(coalesce(l.title,'')||' '||coalesce(l.description,''),(select term from q))::real from public.live_streams l, q where q.term<>'' and l.status in ('scheduled','live','ended') and (l.title ilike '%'||q.term||'%' or coalesce(l.description,'') ilike '%'||q.term||'%' or coalesce(l.category,'') ilike '%'||q.term||'%')
    union all
    select 'game', g.id, g.title, coalesce(g.game_type,g.platform_type,'Game'), coalesce(g.thumbnail_url,g.cover_url), '/gaming.html?game='||g.slug, similarity(coalesce(g.title,'')||' '||coalesce(g.description,''),(select term from q))::real from public.games g, q where q.term<>'' and g.is_active=true and (g.title ilike '%'||q.term||'%' or coalesce(g.description,'') ilike '%'||q.term||'%' or coalesce(g.game_type,'') ilike '%'||q.term||'%')
    union all
    select 'product', pr.id, pr.title, coalesce(pr.category,pr.product_type,'Store'), coalesce(pr.image_url,pr.cover_url), '/store.html?product='||pr.id::text, similarity(coalesce(pr.title,'')||' '||coalesce(pr.description,''),(select term from q))::real from public.products pr, q where q.term<>'' and pr.is_public=true and pr.status='active' and (pr.title ilike '%'||q.term||'%' or coalesce(pr.description,'') ilike '%'||q.term||'%' or coalesce(pr.category,'') ilike '%'||q.term||'%')
    union all
    select 'sports', s.id, coalesce(s.title,left(s.body,80),'Sports'), coalesce(s.sport,s.league,s.team_name,'Sports'), coalesce(s.thumbnail_url,s.cover_url,s.media_url), '/sports.html?post='||s.id::text, similarity(coalesce(s.title,'')||' '||coalesce(s.body,''),(select term from q))::real from public.sports_posts s, q where q.term<>'' and (coalesce(s.title,'') ilike '%'||q.term||'%' or coalesce(s.body,'') ilike '%'||q.term||'%' or coalesce(s.sport,'') ilike '%'||q.term||'%' or coalesce(s.team_name,'') ilike '%'||q.term||'%')
    union all
    select 'world', w.id, w.title, coalesce(w.world_type,w.visual_style,'Meta world'), coalesce(w.cover_url,w.background_url), '/meta.html?world='||w.slug, similarity(coalesce(w.title,'')||' '||coalesce(w.description,''),(select term from q))::real from public.meta_worlds w, q where q.term<>'' and w.status='active' and w.access_type in ('public','members') and (w.title ilike '%'||q.term||'%' or coalesce(w.description,'') ilike '%'||q.term||'%' or coalesce(w.world_type,'') ilike '%'||q.term||'%')
  )
  select * from results order by score desc, title asc limit (select lim from q);
$function$;

revoke all on function public.rb_global_search(text,integer) from public, anon;
grant execute on function public.rb_global_search(text,integer) to authenticated;

-- Search discovery must honor public content moderation and never publish private raw search terms.
CREATE OR REPLACE FUNCTION public.rb_global_search(p_query text, p_limit integer DEFAULT 60)
 RETURNS TABLE(category text, id uuid, title text, subtitle text, image_url text, target_url text, score real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
with q as (
  select lower(regexp_replace(trim(coalesce(p_query,'')), '\s+', ' ', 'g')) as term,
         greatest(1, least(coalesce(p_limit,60),120)) as lim,
         auth.uid() as viewer_id
), results as (
  select case when coalesce(p.is_creator,false) then 'creator' else 'people' end::text as category,
         p.id,
         coalesce(p.display_name,p.username,'Rich Member')::text as title,
         coalesce(case when p.username is not null then '@'||p.username end,p.bio,'Rich Bizness identity')::text as subtitle,
         p.avatar_url::text as image_url,
         ('/profile.html?id='||p.id::text)::text as target_url,
         (case when lower(coalesce(p.username,''))=(select term from q) then 8 when lower(coalesce(p.display_name,''))=(select term from q) then 7 when lower(coalesce(p.username,'')) like (select term from q)||'%' then 5 else 2 end
          + greatest(similarity(lower(coalesce(p.display_name,'')),(select term from q)), similarity(lower(coalesce(p.username,'')),(select term from q))) * 4
          + least(coalesce(p.rich_level,0),100)::real/100)::real as score
  from public.profiles p
  left join public.user_settings us on us.user_id=p.id, q
  where length(q.term)>=2 and p.account_status='active'
    and (coalesce(us.profile_visibility,'public')='public' or p.id=q.viewer_id or (coalesce(us.profile_visibility,'public')='followers' and q.viewer_id is not null and exists(select 1 from public.followers f where f.follower_id=q.viewer_id and f.following_id=p.id)))
    and (lower(coalesce(p.display_name,'')) like '%'||q.term||'%' or lower(coalesce(p.username,'')) like '%'||q.term||'%' or lower(coalesce(p.bio,'')) like '%'||q.term||'%')

  union all
  select case when lower(coalesce(f.section,'feed'))='gallery' then 'gallery' when lower(coalesce(f.section,''))='watch' or lower(coalesce(f.post_type,''))='video' or lower(coalesce(f.media_type,'')) like 'video%' then 'watch' else 'feed' end,
         f.id, coalesce(f.title,nullif(left(f.body,90),''),'Rich post'), coalesce(f.display_name,f.username,'Rich Bizness'), coalesce(f.thumbnail_url,f.media_url,f.cover_url),
         case when lower(coalesce(f.section,'feed'))='gallery' then '/gallery.html?id='||f.id::text
              when lower(coalesce(f.section,''))='watch' or lower(coalesce(f.post_type,''))='video' or lower(coalesce(f.media_type,'')) like 'video%' then '/watch.html?type=feed_video&id='||f.id::text
              else '/feed.html?post='||f.id::text end,
         (case when lower(coalesce(f.title,''))=(select term from q) then 7 when lower(coalesce(f.title,'')) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(f.title,'')||' '||coalesce(f.body,'')),(select term from q))*4 + ln(1+greatest(coalesce(f.like_count,0)+coalesce(f.comment_count,0)+coalesce(f.view_count,0),0))*.12)::real
  from public.feed_posts f, q
  where length(q.term)>=2 and f.visibility='public' and coalesce(f.moderation_state,'clear') in ('clear','approved')
    and (lower(coalesce(f.title,'')) like '%'||q.term||'%' or lower(coalesce(f.body,'')) like '%'||q.term||'%' or lower(coalesce(f.display_name,'')) like '%'||q.term||'%')

  union all
  select 'music',m.id,m.title,coalesce(m.display_name,m.username,m.genre,'Music'),m.cover_url,'/music.html?track='||m.id::text,
         (case when lower(m.title)=(select term from q) then 8 when lower(m.title) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(m.title,'')||' '||coalesce(m.description,'')||' '||coalesce(m.genre,'')),(select term from q))*4 + ln(1+greatest(coalesce(m.play_count,0)+coalesce(m.like_count,0),0))*.12)::real
  from public.music_tracks m,q where length(q.term)>=2 and m.is_published=true and coalesce(m.visibility,'public')='public' and (lower(m.title) like '%'||q.term||'%' or lower(coalesce(m.description,'')) like '%'||q.term||'%' or lower(coalesce(m.display_name,'')) like '%'||q.term||'%' or lower(coalesce(m.genre,'')) like '%'||q.term||'%')

  union all
  select 'podcast',e.id,e.title,coalesce(e.display_name,e.username,'Podcast'),coalesce(e.thumbnail_url,e.cover_url),'/podcast.html?episode='||e.id::text,
         (case when lower(e.title)=(select term from q) then 8 when lower(e.title) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(e.title,'')||' '||coalesce(e.description,'')),(select term from q))*4 + ln(1+greatest(coalesce(e.play_count,0)+coalesce(e.like_count,0)+coalesce(e.comment_count,0),0))*.12)::real
  from public.podcast_episodes e,q where length(q.term)>=2 and e.is_published=true and coalesce(e.visibility,'public')='public' and (lower(e.title) like '%'||q.term||'%' or lower(coalesce(e.description,'')) like '%'||q.term||'%' or lower(coalesce(e.display_name,'')) like '%'||q.term||'%')

  union all
  select 'radio',r.id,r.station_name,coalesce(r.display_name,r.genre,'Radio'),r.cover_url,'/radio.html?id='||r.id::text,
         (case when lower(r.station_name)=(select term from q) then 8 when lower(r.station_name) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(r.station_name,'')||' '||coalesce(r.description,'')||' '||coalesce(r.genre,'')),(select term from q))*4 + ln(1+greatest(coalesce(r.listener_count,0)+coalesce(r.like_count,0),0))*.12)::real
  from public.radio_stations r,q where length(q.term)>=2 and r.is_public=true and (lower(r.station_name) like '%'||q.term||'%' or lower(coalesce(r.description,'')) like '%'||q.term||'%' or lower(coalesce(r.genre,'')) like '%'||q.term||'%')

  union all
  select 'live',l.id,l.title,coalesce(l.category,l.status_label,'Live'),coalesce(l.thumbnail_url,l.cover_url),'/live.html?stream='||l.id::text,
         (case when lower(l.title)=(select term from q) then 8 when lower(l.title) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(l.title,'')||' '||coalesce(l.description,'')||' '||coalesce(l.category,'')),(select term from q))*4 + 2 + ln(1+greatest(coalesce(l.viewer_count,0),0))*.15)::real
  from public.live_streams l,q where length(q.term)>=2 and l.status='live'
    and (coalesce(l.access_type,'free')='free' or l.creator_id=q.viewer_id)
    and (lower(l.title) like '%'||q.term||'%' or lower(coalesce(l.description,'')) like '%'||q.term||'%' or lower(coalesce(l.category,'')) like '%'||q.term||'%')

  union all
  select 'gaming',g.id,g.title,coalesce(g.game_type,g.platform_type,'Game'),coalesce(g.thumbnail_url,g.cover_url),'/gaming.html?game='||g.slug,
         (case when lower(g.title)=(select term from q) then 8 when lower(g.title) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(g.title,'')||' '||coalesce(g.description,'')||' '||coalesce(g.game_type,'')),(select term from q))*4)::real
  from public.games g,q where length(q.term)>=2 and g.is_active=true and (lower(g.title) like '%'||q.term||'%' or lower(coalesce(g.description,'')) like '%'||q.term||'%' or lower(coalesce(g.game_type,'')) like '%'||q.term||'%')

  union all
  select 'store',pr.id,pr.title,coalesce(pr.category,pr.product_type,'Store'),coalesce(pr.image_url,pr.cover_url),'/store.html?product='||pr.id::text,
         (case when lower(pr.title)=(select term from q) then 8 when lower(pr.title) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(pr.title,'')||' '||coalesce(pr.description,'')||' '||coalesce(pr.category,'')),(select term from q))*4)::real
  from public.products pr,q where length(q.term)>=2 and pr.is_public=true and pr.status='active' and (lower(pr.title) like '%'||q.term||'%' or lower(coalesce(pr.description,'')) like '%'||q.term||'%' or lower(coalesce(pr.category,'')) like '%'||q.term||'%')

  union all
  select 'sports',s.id,coalesce(s.title,nullif(left(s.body,90),''),'Sports'),coalesce(s.sport,s.league,s.team_name,'Sports'),coalesce(s.thumbnail_url,s.cover_url,s.media_url),'/sports.html?post='||s.id::text,
         (case when lower(coalesce(s.title,''))=(select term from q) then 8 when lower(coalesce(s.title,'')) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(s.title,'')||' '||coalesce(s.body,'')||' '||coalesce(s.sport,'')||' '||coalesce(s.team_name,'')),(select term from q))*4)::real
  from public.sports_posts s,q where length(q.term)>=2 and (lower(coalesce(s.title,'')) like '%'||q.term||'%' or lower(coalesce(s.body,'')) like '%'||q.term||'%' or lower(coalesce(s.sport,'')) like '%'||q.term||'%' or lower(coalesce(s.team_name,'')) like '%'||q.term||'%')

  union all
  select 'meta',w.id,w.title,coalesce(w.world_type,w.visual_style,'Meta world'),coalesce(w.cover_url,w.background_url),'/meta.html?world='||w.slug,
         (case when lower(w.title)=(select term from q) then 8 when lower(w.title) like (select term from q)||'%' then 5 else 2 end + similarity(lower(coalesce(w.title,'')||' '||coalesce(w.description,'')||' '||coalesce(w.world_type,'')),(select term from q))*4)::real
  from public.meta_worlds w,q where length(q.term)>=2 and w.status='active' and w.access_type in ('public','members') and (lower(w.title) like '%'||q.term||'%' or lower(coalesce(w.description,'')) like '%'||q.term||'%' or lower(coalesce(w.world_type,'')) like '%'||q.term||'%')
)
select category,id,title,subtitle,image_url,target_url,score from results order by score desc,title asc limit (select lim from q);
$function$
;
CREATE OR REPLACE FUNCTION public.rb_search_snapshot(p_query text DEFAULT ''::text, p_category text DEFAULT 'all'::text, p_limit integer DEFAULT 80)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
with params as (
 select lower(regexp_replace(trim(coalesce(p_query,'')), '\s+', ' ', 'g')) query,
        case when lower(coalesce(p_category,'all')) in ('all','people','creator','feed','gallery','watch','music','podcast','radio','live','sports','gaming','store','meta') then lower(coalesce(p_category,'all')) else 'all' end category,
        greatest(1,least(coalesce(p_limit,80),120)) lim,
        auth.uid() viewer_id
), raw as (
 select * from public.rb_global_search((select query from params),120)
), filtered as (
 select * from raw where (select category from params)='all' or category=(select category from params) order by score desc,title asc limit (select lim from params)
), recent as (
 select distinct on (normalized_query) normalized_query as query, max(created_at) over(partition by normalized_query) as last_used_at
 from public.search_queries,params where params.viewer_id is not null and user_id=params.viewer_id and normalized_query<>'' order by normalized_query,created_at desc
), analytics_trending as (
 select normalized_query as query,count(*)::int searches,max(created_at) last_searched_at
 from public.search_queries where created_at>=now()-interval '30 days' and normalized_query<>'' group by normalized_query order by count(*) desc,max(created_at) desc limit 12
), fallback_trending as (
 select query, searches, last_searched_at from (
   select g.title::text query, 1::int searches, coalesce(g.updated_at,g.created_at,now()) last_searched_at from public.games g where g.is_active=true
   union all
   select coalesce(p.display_name,p.username,'Rich Creator')::text, greatest(1,coalesce(p.rich_level,0))::int, coalesce(p.updated_at,p.created_at,now()) from public.profiles p left join public.user_settings us on us.user_id=p.id where p.account_status='active' and coalesce(us.profile_visibility,'public')='public'
   union all
   select coalesce(f.title,nullif(left(f.body,70),''),'Rich Drop')::text, greatest(1,coalesce(f.view_count,0)+coalesce(f.like_count,0))::int, coalesce(f.updated_at,f.created_at,now()) from public.feed_posts f where f.visibility='public' and coalesce(f.moderation_state,'clear') in ('clear','approved')
   union all
   select m.title::text, greatest(1,coalesce(m.play_count,0)+coalesce(m.like_count,0))::int, coalesce(m.updated_at,m.created_at,now()) from public.music_tracks m where m.is_published=true and coalesce(m.visibility,'public')='public'
   union all
   select w.title::text, greatest(1,coalesce(w.like_count,0))::int, coalesce(w.updated_at,w.created_at,now()) from public.meta_worlds w where w.status='active' and w.access_type in ('public','members')
 ) x where nullif(trim(query),'') is not null order by searches desc,last_searched_at desc limit 12
), trending as (
 select f.query,coalesce(a.searches,f.searches) searches,coalesce(a.last_searched_at,f.last_searched_at) last_searched_at from fallback_trending f left join analytics_trending a on a.query=lower(regexp_replace(trim(f.query),'\s+',' ','g'))
), counts as (
 select category,count(*)::int total from raw group by category
), seeded as (
 select * from (
   select case when coalesce(p.is_creator,false) then 'creator' else 'people' end::text category,p.id,coalesce(p.display_name,p.username,'Rich Member')::text title,coalesce(case when p.username is not null then '@'||p.username end,p.bio,'Rich Bizness identity')::text subtitle,p.avatar_url::text image_url,('/profile.html?id='||p.id::text)::text target_url,10::real score,coalesce(p.updated_at,p.created_at,now()) created_at
   from public.profiles p left join public.user_settings us on us.user_id=p.id,params
   where p.account_status='active' and (coalesce(us.profile_visibility,'public')='public' or p.id=params.viewer_id)
   union all
   select 'gaming',g.id,g.title,coalesce(g.game_type,g.platform_type,'Game'),coalesce(g.thumbnail_url,g.cover_url,g.logo_url),'/gaming.html?id='||g.id::text,8::real,coalesce(g.updated_at,g.created_at,now()) from public.games g where g.is_active=true
   union all
   select case when lower(coalesce(f.section,'feed'))='gallery' then 'gallery' when lower(coalesce(f.section,''))='watch' or lower(coalesce(f.post_type,''))='video' or lower(coalesce(f.media_type,'')) like 'video%' then 'watch' else 'feed' end,f.id,coalesce(f.title,nullif(left(f.body,90),''),'Rich post'),coalesce(f.display_name,f.username,'Rich Bizness'),coalesce(f.thumbnail_url,f.cover_url,f.media_url),case when lower(coalesce(f.section,'feed'))='gallery' then '/gallery.html?id='||f.id::text when lower(coalesce(f.section,''))='watch' or lower(coalesce(f.post_type,''))='video' or lower(coalesce(f.media_type,'')) like 'video%' then '/watch.html?type=feed_video&id='||f.id::text else '/feed.html?post='||f.id::text end,7::real,coalesce(f.updated_at,f.created_at,now()) from public.feed_posts f where f.visibility='public' and coalesce(f.moderation_state,'clear') in ('clear','approved')
   union all
   select 'music',m.id,m.title,coalesce(m.display_name,m.username,m.genre,'Music'),m.cover_url,'/music.html?track='||m.id::text,7::real,coalesce(m.updated_at,m.created_at,now()) from public.music_tracks m where m.is_published=true and coalesce(m.visibility,'public')='public'
   union all
   select 'podcast',e.id,e.title,coalesce(e.display_name,e.username,'Podcast'),coalesce(e.thumbnail_url,e.cover_url),'/podcast.html?episode='||e.id::text,7::real,coalesce(e.updated_at,e.created_at,now()) from public.podcast_episodes e where e.is_published=true and coalesce(e.visibility,'public')='public'
   union all
   select 'radio',r.id,r.station_name,coalesce(r.display_name,r.genre,'Radio'),r.cover_url,'/radio.html?station='||r.id::text,7::real,coalesce(r.updated_at,r.created_at,now()) from public.radio_stations r where r.is_public=true
   union all
   select 'live',l.id,l.title,coalesce(l.category,l.status_label,'Live'),coalesce(l.thumbnail_url,l.cover_url),'/live.html?stream='||l.id::text,9::real,coalesce(l.updated_at,l.created_at,now()) from public.live_streams l,params where l.status='live' and (coalesce(l.access_type,'free')='free' or l.creator_id=params.viewer_id)
   union all
   select 'store',pr.id,pr.title,coalesce(pr.category,pr.product_type,'Store'),coalesce(pr.image_url,pr.cover_url),'/store.html?product='||pr.id::text,6::real,coalesce(pr.updated_at,pr.created_at,now()) from public.products pr where pr.is_public=true and pr.status='active'
   union all
   select 'sports',s.id,coalesce(s.title,nullif(left(s.body,90),''),'Sports'),coalesce(s.sport,s.league,s.team_name,'Sports'),coalesce(s.thumbnail_url,s.cover_url,s.media_url),'/sports.html?post='||s.id::text,6::real,coalesce(s.updated_at,s.created_at,now()) from public.sports_posts s
   union all
   select 'meta',w.id,w.title,coalesce(w.world_type,w.visual_style,'Meta world'),coalesce(w.cover_url,w.background_url),'/meta.html?world='||w.slug,6::real,coalesce(w.updated_at,w.created_at,now()) from public.meta_worlds w where w.status='active' and w.access_type in ('public','members')
 ) s order by score desc,created_at desc limit 120
)
select jsonb_build_object(
 'query',(select query from params),
 'category',(select category from params),
 'results',case when (select length(query) from params)<2 then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(filtered) order by score desc,title asc) from filtered),'[]'::jsonb) end,
 'featured',coalesce((select jsonb_agg(jsonb_build_object('category',category,'id',id,'title',title,'subtitle',subtitle,'image_url',image_url,'target_url',target_url,'score',score) order by score desc,created_at desc) from seeded),'[]'::jsonb),
 'counts',coalesce((select jsonb_object_agg(category,total) from counts),'{}'::jsonb),
 'inventory',jsonb_build_object(
   'creator',(select count(*) from public.profiles p left join public.user_settings us on us.user_id=p.id where p.account_status='active' and coalesce(p.is_creator,false)=true and coalesce(us.profile_visibility,'public')='public'),
   'people',(select count(*) from public.profiles p left join public.user_settings us on us.user_id=p.id where p.account_status='active' and coalesce(us.profile_visibility,'public')='public'),
   'feed',(select count(*) from public.feed_posts where visibility='public' and coalesce(moderation_state,'clear') in ('clear','approved') and lower(coalesce(section,'feed'))<>'gallery' and not (lower(coalesce(section,''))='watch' or lower(coalesce(post_type,''))='video' or lower(coalesce(media_type,'')) like 'video%')),
   'gallery',(select count(*) from public.feed_posts where visibility='public' and coalesce(moderation_state,'clear') in ('clear','approved') and lower(coalesce(section,'feed'))='gallery'),
   'watch',(select count(*) from public.feed_posts where visibility='public' and coalesce(moderation_state,'clear') in ('clear','approved') and (lower(coalesce(section,''))='watch' or lower(coalesce(post_type,''))='video' or lower(coalesce(media_type,'')) like 'video%')),
   'music',(select count(*) from public.music_tracks where is_published=true and coalesce(visibility,'public')='public'),
   'podcast',(select count(*) from public.podcast_episodes where is_published=true and coalesce(visibility,'public')='public'),
   'radio',(select count(*) from public.radio_stations where is_public=true),
   'live',(select count(*) from public.live_streams where status='live' and coalesce(access_type,'free')='free'),
   'sports',(select count(*) from public.sports_posts),
   'gaming',(select count(*) from public.games where is_active=true),
   'store',(select count(*) from public.products where is_public=true and status='active'),
   'meta',(select count(*) from public.meta_worlds where status='active' and access_type in ('public','members'))
 ),
 'total',(select count(*) from filtered),
 'recent',coalesce((select jsonb_agg(jsonb_build_object('query',query,'last_used_at',last_used_at) order by last_used_at desc) from (select * from recent order by last_used_at desc limit 8) r),'[]'::jsonb),
 'trending',coalesce((select jsonb_agg(jsonb_build_object('query',query,'searches',searches,'last_searched_at',last_searched_at) order by searches desc,last_searched_at desc) from trending),'[]'::jsonb)
);
$function$
;

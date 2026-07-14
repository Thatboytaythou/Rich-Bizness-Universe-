create or replace function public.rb_live_watch_podcast_snapshot()
returns jsonb
language sql
security definer
set search_path=public
as $$
with me as (select auth.uid() uid)
select jsonb_build_object(
  'profile',(select to_jsonb(p) - 'email' - 'phone' from profiles p,me where p.id=me.uid),
  'live',coalesce((select jsonb_agg(to_jsonb(s) order by s.is_featured desc,s.started_at desc nulls last,s.created_at desc) from live_streams s where s.status in ('live','scheduled','upcoming','ready','ended')),'[]'::jsonb),
  'live_cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.created_at desc) from live_stream_cards c where c.is_active=true),'[]'::jsonb),
  'live_members',coalesce((select jsonb_agg(to_jsonb(m) order by m.joined_at desc) from live_stream_members m,me where m.user_id=me.uid),'[]'::jsonb),
  'live_purchases',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from live_stream_purchases p,me where p.user_id=me.uid),'[]'::jsonb),
  'live_tips',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from live_tips t,me where t.from_user_id=me.uid or t.to_user_id=me.uid),'[]'::jsonb),
  'live_alerts',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from live_alert_subscriptions a,me where a.user_id=me.uid),'[]'::jsonb),
  'vip_access',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from vip_live_access v,me where v.user_id=me.uid and v.access_status='active'),'[]'::jsonb),
  'recordings',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from live_recordings r where coalesce(r.visibility,'public')='public'),'[]'::jsonb),
  'podcast_shows',coalesce((select jsonb_agg(to_jsonb(s) order by s.is_featured desc,s.play_count desc,s.created_at desc) from podcast_shows s where s.is_published=true),'[]'::jsonb),
  'podcast_episodes',coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('show_title',ps.title,'show_cover_url',ps.cover_url,'show_category',ps.category) order by e.is_featured desc,e.created_at desc) from podcast_episodes e left join podcast_shows ps on ps.id=e.show_id where e.is_published=true and coalesce(e.visibility,'public')='public'),'[]'::jsonb),
  'podcast_likes',coalesce((select jsonb_agg(to_jsonb(l)) from podcast_likes l,me where l.user_id=me.uid),'[]'::jsonb),
  'podcast_comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from podcast_comments c where c.episode_id in (select id from podcast_episodes where is_published=true) limit 100),'[]'::jsonb),
  'watch_feed',coalesce((select jsonb_agg(to_jsonb(w)) from rb_watch_feed(120) w),'[]'::jsonb),
  'watch_progress',coalesce((select jsonb_agg(to_jsonb(w) order by w.last_watched_at desc) from watch_progress w,me where w.user_id=me.uid),'[]'::jsonb),
  'watch_likes',coalesce((select jsonb_agg(to_jsonb(w)) from watch_likes w,me where w.user_id=me.uid),'[]'::jsonb),
  'watchlist',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from watchlist_items w,me where w.user_id=me.uid),'[]'::jsonb)
);
$$;
revoke all on function public.rb_live_watch_podcast_snapshot() from public,anon;
grant execute on function public.rb_live_watch_podcast_snapshot() to authenticated;
create index if not exists idx_live_streams_status_featured_activity on public.live_streams(status,is_featured,last_activity_at desc);
create index if not exists idx_live_stream_cards_active_sort on public.live_stream_cards(is_active,sort_order);
create index if not exists idx_podcast_episodes_published_featured_created on public.podcast_episodes(is_published,is_featured,created_at desc);
create index if not exists idx_podcast_shows_published_featured on public.podcast_shows(is_published,is_featured,play_count desc);
create index if not exists idx_watch_progress_user_recent on public.watch_progress(user_id,last_watched_at desc);
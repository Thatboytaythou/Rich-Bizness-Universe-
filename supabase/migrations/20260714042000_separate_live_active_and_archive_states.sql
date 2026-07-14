create or replace function public.rb_live_watch_podcast_snapshot()
returns jsonb
language sql
security definer
set search_path=public
as $$
with me as (select auth.uid() uid)
select jsonb_build_object(
  'profile',(select to_jsonb(p) - 'email' - 'phone' from profiles p,me where p.id=me.uid),
  'live',coalesce((select jsonb_agg(to_jsonb(s) order by case when s.status='live' then 0 else 1 end,s.is_featured desc,s.started_at desc nulls last,s.created_at desc)
    from live_streams s
    where s.status in ('live','scheduled','upcoming','ready')
      and (s.status <> 'live' or coalesce(s.last_activity_at,s.updated_at,s.started_at) > now() - interval '10 minutes')),'[]'::jsonb),
  'ended_live',coalesce((select jsonb_agg(to_jsonb(s) order by coalesce(s.ended_at,s.updated_at) desc)
    from live_streams s where s.status='ended' limit 100),'[]'::jsonb),
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

create or replace function public.rb_go_live_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_stream jsonb;
  v_categories jsonb;
begin
  if v_uid is null then raise exception 'Tap in first so we can lock your Rich ID to this broadcast.' using errcode='28000'; end if;

  update public.live_streams
  set status='ended',status_label='PARTY’S OVER',ended_at=coalesce(ended_at,now()),updated_at=now()
  where creator_id=v_uid and status='live' and coalesce(last_activity_at,updated_at,started_at) < now()-interval '10 minutes';

  select to_jsonb(p) into v_profile from public.profiles p where p.id=v_uid;
  if v_profile is null then
    insert into public.profiles(id,display_name,username,online_status,is_creator,updated_at)
    select u.id,coalesce(u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1),'Rich Member'),regexp_replace(lower(coalesce(u.raw_user_meta_data->>'username',split_part(u.email,'@',1),'rich_member')),'[^a-z0-9_]+','_','g'),'online',true,now()
    from auth.users u where u.id=v_uid
    on conflict(id) do update set is_creator=true,online_status='online',updated_at=now();
  else
    update public.profiles set is_creator=true,online_status='online',updated_at=now() where id=v_uid;
  end if;
  select to_jsonb(p) into v_profile from public.profiles p where p.id=v_uid;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb) into v_categories from public.live_categories c where c.is_active=true;
  select to_jsonb(s) into v_stream from public.live_streams s
    where s.creator_id=v_uid and s.status in ('draft','ready','scheduled','live')
      and (s.status <> 'live' or coalesce(s.last_activity_at,s.updated_at,s.started_at) > now()-interval '10 minutes')
    order by case when s.status='live' then 0 when s.status='ready' then 1 else 2 end,s.updated_at desc limit 1;
  return jsonb_build_object('user_id',v_uid,'profile',v_profile,'categories',v_categories,'active_stream',v_stream,'auth_ready',true,
    'copy',jsonb_build_object('tap_in','TAP IN','go_live','GO LIVE','start','LIGHT THIS SHYT UP','ready','WE LIT🔥','draft','GET RIGHT','room','BIZNESS PARTY','network','WE 🔥📺'));
end;
$$;
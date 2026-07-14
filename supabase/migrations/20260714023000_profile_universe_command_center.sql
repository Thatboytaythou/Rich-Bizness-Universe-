create table if not exists public.profile_view_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  session_id text,
  source text not null default 'profile',
  created_at timestamptz not null default now()
);
alter table public.profile_view_events enable row level security;
drop policy if exists profile_view_events_owner_read on public.profile_view_events;
create policy profile_view_events_owner_read on public.profile_view_events for select to authenticated using (profile_id=auth.uid() or viewer_id=auth.uid());
create index if not exists profile_view_events_profile_created_idx on public.profile_view_events(profile_id,created_at desc);
create index if not exists profile_view_events_viewer_created_idx on public.profile_view_events(viewer_id,created_at desc);

create or replace function public.rb_profile_toggle_follow(p_profile_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_following boolean;v_count bigint;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_profile_id is null or p_profile_id=v_user then raise exception 'Invalid profile'; end if;
 select exists(select 1 from followers where follower_id=v_user and following_id=p_profile_id) into v_following;
 if v_following then delete from followers where follower_id=v_user and following_id=p_profile_id;v_following:=false;
 else insert into followers(follower_id,following_id) values(v_user,p_profile_id) on conflict do nothing;v_following:=true;end if;
 select count(*) into v_count from followers where following_id=p_profile_id;
 return jsonb_build_object('following',v_following,'followers',v_count);
end$$;
grant execute on function public.rb_profile_toggle_follow(uuid) to authenticated;

create or replace function public.rb_profile_record_view(p_profile_id uuid,p_session_id text default null,p_source text default 'profile') returns void language plpgsql security definer set search_path=public as $$
begin
 if p_profile_id is null or not exists(select 1 from profiles where id=p_profile_id) then return;end if;
 insert into profile_view_events(profile_id,viewer_id,session_id,source) values(p_profile_id,auth.uid(),left(nullif(p_session_id,''),120),left(coalesce(nullif(p_source,''),'profile'),40));
end$$;
grant execute on function public.rb_profile_record_view(uuid,text,text) to anon,authenticated;

create or replace function public.rb_profile_universe_snapshot(p_profile_id uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_target uuid:=coalesce(p_profile_id,auth.uid());v_viewer uuid:=auth.uid();v_profile profiles%rowtype;v_settings user_settings%rowtype;v_visibility text:='public';v_can_view boolean:=false;v_following boolean:=false;
begin
 if v_target is null then raise exception 'Profile required';end if;
 select * into v_profile from profiles where id=v_target;if not found then raise exception 'Profile not found';end if;
 select * into v_settings from user_settings where user_id=v_target;v_visibility:=coalesce(v_settings.profile_visibility,'public');
 v_following:=v_viewer is not null and exists(select 1 from followers where follower_id=v_viewer and following_id=v_target);
 v_can_view:=v_visibility='public' or v_viewer=v_target or (v_visibility='followers' and v_following);
 if not v_can_view then return jsonb_build_object('restricted',true,'profile',jsonb_build_object('id',v_profile.id,'username',v_profile.username,'display_name',v_profile.display_name,'avatar_url',v_profile.avatar_url,'banner_url',v_profile.banner_url,'is_verified',v_profile.is_verified,'rank_title',v_profile.rank_title,'rich_level',v_profile.rich_level));end if;
 return jsonb_build_object(
 'restricted',false,'viewer',jsonb_build_object('id',v_viewer,'is_owner',v_viewer=v_target,'following',v_following),
 'profile',to_jsonb(v_profile)-'privacy_config'-'notification_config'-'capability_flags'-'secret_room_keys'-'last_secret_route',
 'theme',(select to_jsonb(t) from profile_theme_settings t where t.user_id=v_target),
 'settings',jsonb_build_object('profile_visibility',v_visibility,'dm_privacy',coalesce(v_settings.dm_privacy,'followers'),'motion_level',coalesce(v_settings.motion_level,'full')),
 'level',(select to_jsonb(l) from user_levels l where l.user_id=v_target),'avatar',(select to_jsonb(a) from meta_avatars a where a.user_id=v_target),'loadout',(select to_jsonb(l) from user_avatar_loadouts l where l.user_id=v_target),
 'creator',(select to_jsonb(c) from creator_page_settings c where c.user_id=v_target),'seller',(select to_jsonb(s) from store_seller_profiles s where s.user_id=v_target),'gamer',(select to_jsonb(g) from gamer_profiles g where g.user_id=v_target),'sports',(select to_jsonb(s) from sports_profiles s where s.user_id=v_target),
 'counts',jsonb_build_object('followers',(select count(*) from followers where following_id=v_target),'following',(select count(*) from followers where follower_id=v_target),'posts',(select count(*) from feed_posts where user_id=v_target and visibility='public'),'tracks',(select count(*) from music_tracks where coalesce(artist_user_id,user_id)=v_target and coalesce(is_published,true)),'products',(select count(*) from products where seller_id=v_target and is_public=true and status='active'),'game_clips',(select count(*) from game_clips where user_id=v_target),'sports_posts',(select count(*) from sports_posts where user_id=v_target),'worlds',(select count(*) from meta_worlds where owner_id=v_target and status='active'),'badges',(select count(*) from user_badges where user_id=v_target),'views',(select count(*) from profile_view_events where profile_id=v_target)),
 'badges',coalesce((select jsonb_agg(x order by x.unlocked_at desc) from(select b.badge_key,b.title,b.description,b.icon,b.badge_type,b.rarity,ub.equipped,ub.unlocked_at from user_badges ub join badges b on b.id=ub.badge_id where ub.user_id=v_target order by ub.equipped desc,ub.unlocked_at desc limit 12)x),'[]'::jsonb),
 'feed',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,title,body,media_url,file_url,thumbnail_url,cover_url,media_type,post_type,section,like_count,comment_count,view_count,created_at from feed_posts where user_id=v_target and visibility='public' order by created_at desc limit 18)x),'[]'::jsonb),
 'music',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,title,description,audio_url,cover_url,genre,play_count,like_count,created_at from music_tracks where coalesce(artist_user_id,user_id)=v_target and coalesce(is_published,true) order by created_at desc limit 12)x),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,title,description,image_url,cover_url,price_cents,currency,product_type,views,likes,sales_count,created_at from products where seller_id=v_target and is_public=true and status='active' order by created_at desc limit 12)x),'[]'::jsonb),
 'gaming',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,title,caption,clip_url,thumbnail_url,like_count,comment_count,view_count,created_at from game_clips where user_id=v_target order by created_at desc limit 12)x),'[]'::jsonb),
 'sports_content',coalesce((select jsonb_agg(x order by x.created_at desc) from(select id,title,body,sport,league,team_name,media_url,cover_url,thumbnail_url,like_count,comment_count,view_count,created_at from sports_posts where user_id=v_target order by created_at desc limit 12)x),'[]'::jsonb),
 'worlds',coalesce((select jsonb_agg(x order by x.updated_at desc) from(select id,slug,title,description,world_type,cover_url,background_url,visit_count,like_count,room_count,updated_at from meta_worlds where owner_id=v_target and status='active' order by updated_at desc limit 12)x),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(x order by x.created_at desc) from(select event_key,section,xp_amount,coins_amount,rich_points_amount,created_at from user_xp_ledger where user_id=v_target order by created_at desc limit 16)x),'[]'::jsonb));
end$$;
grant execute on function public.rb_profile_universe_snapshot(uuid) to anon,authenticated;
insert into xp_events(event_key,title,section,xp_amount,rich_points_amount,cooldown_seconds,daily_limit,is_active) values('profile_viewed','Profile viewed','profile',2,1,60,30,true),('profile_followed','Profile followed','profile',8,3,0,50,true) on conflict(event_key) do update set title=excluded.title,section=excluded.section,xp_amount=excluded.xp_amount,rich_points_amount=excluded.rich_points_amount,is_active=true;
alter publication supabase_realtime add table public.profile_view_events;

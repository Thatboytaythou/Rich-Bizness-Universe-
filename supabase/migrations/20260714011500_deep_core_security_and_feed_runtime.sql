revoke execute on function public.rb_enter_meta_world(uuid) from anon;
revoke execute on function public.rb_join_meta_room(uuid) from anon;
revoke execute on function public.rb_leave_meta_room(uuid) from anon;
revoke execute on function public.rb_sync_avatar_motion(jsonb,jsonb,jsonb,text,text,text,jsonb,integer) from anon;

create unique index if not exists feed_post_likes_user_post_unique on public.feed_post_likes(user_id,post_id);
create index if not exists feed_posts_public_rank_idx on public.feed_posts(is_featured desc,is_pinned desc,created_at desc) where visibility='public';
create index if not exists feed_comments_post_recent_idx on public.feed_comments(post_id,created_at desc);

create or replace function public.rb_feed_toggle_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_liked boolean; v_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.feed_posts where id=p_post_id and moderation_state is distinct from 'blocked') then raise exception 'Post unavailable'; end if;
  if exists(select 1 from public.feed_post_likes where post_id=p_post_id and user_id=v_user) then
    delete from public.feed_post_likes where post_id=p_post_id and user_id=v_user; v_liked:=false;
  else
    insert into public.feed_post_likes(post_id,user_id) values(p_post_id,v_user) on conflict do nothing; v_liked:=true;
  end if;
  select count(*)::integer into v_count from public.feed_post_likes where post_id=p_post_id;
  update public.feed_posts set like_count=v_count,updated_at=now() where id=p_post_id;
  return jsonb_build_object('liked',v_liked,'count',v_count);
end;
$$;

create or replace function public.rb_feed_add_comment(p_post_id uuid,p_body text)
returns public.feed_comments
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_comment public.feed_comments%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Comment must be 1 to 2000 characters'; end if;
  if not exists(select 1 from public.feed_posts where id=p_post_id and moderation_state is distinct from 'blocked') then raise exception 'Post unavailable'; end if;
  select * into v_profile from public.profiles where id=v_user;
  insert into public.feed_comments(post_id,user_id,username,display_name,body,metadata)
  values(p_post_id,v_user,v_profile.username,v_profile.display_name,trim(p_body),jsonb_build_object('source','feed-ui')) returning * into v_comment;
  update public.feed_posts set comment_count=(select count(*) from public.feed_comments where post_id=p_post_id),updated_at=now() where id=p_post_id;
  return v_comment;
end;
$$;

create or replace function public.rb_feed_record_view(p_post_id uuid,p_session_id text default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid(); begin
  if not exists(select 1 from public.feed_posts where id=p_post_id and visibility='public') then return; end if;
  insert into public.feed_post_views(post_id,user_id,session_id)
  select p_post_id,v_user,left(coalesce(nullif(p_session_id,''),gen_random_uuid()::text),120)
  where not exists(select 1 from public.feed_post_views where post_id=p_post_id and ((v_user is not null and user_id=v_user) or (v_user is null and session_id=left(coalesce(nullif(p_session_id,''),''),120))) and created_at>now()-interval '6 hours');
  update public.feed_posts set view_count=(select count(*) from public.feed_post_views where post_id=p_post_id),updated_at=now() where id=p_post_id;
end;
$$;

revoke execute on function public.rb_feed_toggle_like(uuid) from public,anon;
revoke execute on function public.rb_feed_add_comment(uuid,text) from public,anon;
grant execute on function public.rb_feed_toggle_like(uuid) to authenticated;
grant execute on function public.rb_feed_add_comment(uuid,text) to authenticated;
grant execute on function public.rb_feed_record_view(uuid,text) to anon,authenticated;

do $$ begin alter publication supabase_realtime add table public.feed_posts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.feed_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.feed_post_likes; exception when duplicate_object then null; end $$;
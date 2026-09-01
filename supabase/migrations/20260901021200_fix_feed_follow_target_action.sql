create or replace function public.rb_feed_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_post uuid := nullif(p_payload->>'post_id','')::uuid;
  v_profile_target uuid := nullif(coalesce(p_payload->>'profile_id',p_payload->>'post_id'),'')::uuid;
  v_profile public.profiles%rowtype;
  v_count int;
  v_state boolean;
  v_new public.feed_posts%rowtype;
  v_owner uuid;
  v_title text;
  v_actor text;
begin
  if p_action not in ('view') and v_user is null then raise exception 'Authentication required'; end if;
  if v_user is not null then
    select * into v_profile from public.profiles where id=v_user;
    v_actor := coalesce(v_profile.display_name, v_profile.username, 'A Rich Member');
  end if;

  if p_action='create_post' then
    if char_length(trim(coalesce(p_payload->>'body',''))) not between 1 and 4000 then raise exception 'Post must be 1 to 4000 characters'; end if;
    insert into public.feed_posts(user_id,username,display_name,body,section,visibility,post_type,media_type,moderation_state,metadata,ranking_signals,engagement_config)
    values(v_user,v_profile.username,v_profile.display_name,trim(p_payload->>'body'),coalesce(nullif(p_payload->>'section',''),'feed'),'public','text','text','clear',jsonb_build_object('source','feed-composer'),jsonb_build_object('source','organic','score',0),jsonb_build_object('comments',true,'likes',true,'shares',true,'saves',true))
    returning * into v_new;
    return jsonb_build_object('post',to_jsonb(v_new));
  end if;

  if p_action='toggle_follow' then
    if v_profile_target is null then raise exception 'Profile required'; end if;
    return public.rb_profile_toggle_follow(v_profile_target);
  end if;

  if v_post is null then raise exception 'Post required'; end if;
  select user_id, coalesce(nullif(title,''), left(coalesce(body,'Rich Feed post'),80)) into v_owner, v_title from public.feed_posts where id=v_post;
  if not found then raise exception 'Post not found'; end if;

  if p_action='toggle_like' then
    if exists(select 1 from public.feed_post_likes where post_id=v_post and user_id=v_user) then
      delete from public.feed_post_likes where post_id=v_post and user_id=v_user;
      v_state:=false;
      delete from public.rich_notifications where user_id=v_owner and actor_id=v_user and type='feed_like' and target_id=v_post and is_read=false;
    else
      insert into public.feed_post_likes(post_id,user_id) values(v_post,v_user) on conflict do nothing;
      v_state:=true;
      if v_owner<>v_user then
        insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,action_label,action_url,emoji,alert_style,priority,metadata)
        select v_owner,v_user,'feed_like',v_actor||' liked your post',v_title,'feed_posts','post',v_post,'/feed.html?post='||v_post,'OPEN POST','/feed.html?post='||v_post,'♥','social','normal',jsonb_build_object('source','feed','action','like')
        where not exists(select 1 from public.rich_notifications where user_id=v_owner and actor_id=v_user and type='feed_like' and target_id=v_post and is_read=false);
      end if;
    end if;
    select count(*) into v_count from public.feed_post_likes where post_id=v_post;
    update public.feed_posts set like_count=v_count,updated_at=now() where id=v_post;
    return jsonb_build_object('liked',v_state,'count',v_count);

  elsif p_action='toggle_save' then
    if exists(select 1 from public.feed_post_saves where post_id=v_post and user_id=v_user) then delete from public.feed_post_saves where post_id=v_post and user_id=v_user; v_state:=false;
    else insert into public.feed_post_saves(post_id,user_id) values(v_post,v_user) on conflict do nothing; v_state:=true; end if;
    return jsonb_build_object('saved',v_state);

  elsif p_action='toggle_repost' then
    if exists(select 1 from public.feed_reposts where post_id=v_post and user_id=v_user) then
      delete from public.feed_reposts where post_id=v_post and user_id=v_user;
      v_state:=false;
      delete from public.rich_notifications where user_id=v_owner and actor_id=v_user and type='feed_repost' and target_id=v_post and is_read=false;
    else
      insert into public.feed_reposts(post_id,user_id,quote_body) values(v_post,v_user,nullif(trim(p_payload->>'quote_body'),'')) on conflict do nothing;
      v_state:=true;
      if v_owner<>v_user then
        insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,action_label,action_url,emoji,alert_style,priority,metadata)
        select v_owner,v_user,'feed_repost',v_actor||' reposted your post',v_title,'feed_posts','post',v_post,'/feed.html?post='||v_post,'OPEN POST','/feed.html?post='||v_post,'↻','social','normal',jsonb_build_object('source','feed','action','repost')
        where not exists(select 1 from public.rich_notifications where user_id=v_owner and actor_id=v_user and type='feed_repost' and target_id=v_post and is_read=false);
      end if;
    end if;
    select count(*) into v_count from public.feed_reposts where post_id=v_post;
    update public.feed_posts set repost_count=v_count,updated_at=now() where id=v_post;
    return jsonb_build_object('reposted',v_state,'count',v_count);

  elsif p_action='comment' then
    perform public.rb_feed_add_comment(v_post,p_payload->>'body');
    select count(*) into v_count from public.feed_comments where post_id=v_post;
    if v_owner<>v_user then
      insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,action_label,action_url,emoji,alert_style,priority,metadata)
      values(v_owner,v_user,'feed_comment',v_actor||' commented on your post',left(trim(coalesce(p_payload->>'body','')),180),'feed_posts','post',v_post,'/feed.html?post='||v_post,'OPEN COMMENT','/feed.html?post='||v_post,'◌','social','normal',jsonb_build_object('source','feed','action','comment'));
    end if;
    return jsonb_build_object('count',v_count);

  elsif p_action='view' then
    perform public.rb_feed_record_view(v_post,p_payload->>'session_id');
    return jsonb_build_object('ok',true);
  elsif p_action='delete_post' then
    delete from public.feed_posts where id=v_post and user_id=v_user;
    return jsonb_build_object('deleted',found);
  else
    raise exception 'Unsupported Feed action';
  end if;
end
$$;

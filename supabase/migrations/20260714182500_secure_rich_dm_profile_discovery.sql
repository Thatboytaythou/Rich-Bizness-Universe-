create or replace function public.rb_dm_search_profiles(p_query text, p_limit integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  online_status text
)
language sql
security definer
set search_path = public
stable
as $$
  with viewer as (
    select auth.uid() as user_id
  )
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    case
      when coalesce((p.privacy_config->>'show_online')::boolean, true) then p.online_status
      else 'hidden'
    end as online_status
  from public.profiles p
  cross join viewer v
  left join public.user_settings us on us.user_id = p.id
  where v.user_id is not null
    and p.id <> v.user_id
    and coalesce(p.account_status, 'active') = 'active'
    and coalesce((p.privacy_config->>'allow_messages')::boolean, true)
    and (
      coalesce(us.dm_privacy, 'followers') = 'everyone'
      or (
        coalesce(us.dm_privacy, 'followers') = 'followers'
        and exists (
          select 1
          from public.followers f
          where f.follower_id = v.user_id
            and f.following_id = p.id
        )
      )
    )
    and (
      nullif(trim(p_query), '') is null
      or p.username ilike '%' || trim(p_query) || '%'
      or p.display_name ilike '%' || trim(p_query) || '%'
    )
  order by
    case when lower(p.username) = lower(trim(p_query)) then 0 else 1 end,
    coalesce(p.display_name, p.username)
  limit greatest(1, least(coalesce(p_limit, 20), 20));
$$;

revoke all on function public.rb_dm_search_profiles(text, integer) from public, anon;
grant execute on function public.rb_dm_search_profiles(text, integer) to authenticated;

create or replace function public.rb_create_direct_thread(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_thread uuid;
  v_title text;
  v_dm_privacy text;
  v_allow_messages boolean;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_other_user is null or p_other_user=v_me then raise exception 'Invalid recipient'; end if;
  if not exists(select 1 from public.profiles where id=p_other_user and coalesce(account_status,'active')='active') then raise exception 'Recipient unavailable'; end if;

  select
    coalesce((p.privacy_config->>'allow_messages')::boolean, true),
    coalesce(us.dm_privacy, 'followers')
  into v_allow_messages, v_dm_privacy
  from public.profiles p
  left join public.user_settings us on us.user_id=p.id
  where p.id=p_other_user;

  if not coalesce(v_allow_messages,true) then raise exception 'Recipient is not accepting messages'; end if;
  if v_dm_privacy='none' then raise exception 'Recipient is not accepting messages'; end if;
  if v_dm_privacy='followers' and not exists(
    select 1 from public.followers
    where follower_id=v_me and following_id=p_other_user
  ) then
    raise exception 'Follow this member before starting a message';
  end if;

  select t.id into v_thread
  from public.dm_threads t
  where t.thread_type='direct'
    and exists(select 1 from public.dm_thread_members m where m.thread_id=t.id and m.user_id=v_me and m.status='active')
    and exists(select 1 from public.dm_thread_members m where m.thread_id=t.id and m.user_id=p_other_user and m.status='active')
    and 2=(select count(*) from public.dm_thread_members m where m.thread_id=t.id and m.status='active')
  limit 1;

  if v_thread is not null then return v_thread; end if;

  select coalesce(display_name,username,'Rich Member') into v_title from public.profiles where id=p_other_user;
  insert into public.dm_threads(title,thread_type,created_by,last_message,last_message_at)
  values(v_title,'direct',v_me,'Conversation started',now()) returning id into v_thread;

  insert into public.dm_thread_members(thread_id,user_id,role,status)
  values(v_thread,v_me,'owner','active'),(v_thread,p_other_user,'member','active');
  return v_thread;
end;
$function$;

revoke all on function public.rb_create_direct_thread(uuid) from public, anon;
grant execute on function public.rb_create_direct_thread(uuid) to authenticated;

create unique index if not exists dm_message_reactions_unique on public.dm_message_reactions(message_id,user_id,emoji);
create unique index if not exists dm_message_reads_unique on public.dm_message_reads(message_id,user_id);
create unique index if not exists dm_typing_status_unique on public.dm_typing_status(thread_id,user_id);
create index if not exists dm_messages_thread_created_desc on public.dm_messages(thread_id,created_at desc) where is_deleted=false;
create index if not exists dm_thread_members_user_active on public.dm_thread_members(user_id,thread_id) where status='active';

create or replace function public.rb_touch_dm_thread()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.dm_threads
  set last_message=case when new.message_type='text' then left(coalesce(new.body,''),240) else '['||coalesce(new.message_type,'message')||']' end,
      last_message_at=coalesce(new.created_at,now()),last_message_user_id=new.sender_id,updated_at=now()
  where id=new.thread_id;
  return new;
end;$$;

drop trigger if exists trg_touch_dm_thread on public.dm_messages;
create trigger trg_touch_dm_thread after insert on public.dm_messages for each row execute function public.rb_touch_dm_thread();

create or replace function public.rb_create_direct_thread(p_other_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid();v_thread uuid;v_title text;
begin
 if v_me is null then raise exception 'Authentication required'; end if;
 if p_other_user is null or p_other_user=v_me then raise exception 'Invalid recipient'; end if;
 if not exists(select 1 from public.profiles where id=p_other_user and account_status='active') then raise exception 'Recipient unavailable'; end if;
 select t.id into v_thread from public.dm_threads t
 where t.thread_type='direct'
 and exists(select 1 from public.dm_thread_members m where m.thread_id=t.id and m.user_id=v_me and m.status='active')
 and exists(select 1 from public.dm_thread_members m where m.thread_id=t.id and m.user_id=p_other_user and m.status='active')
 and 2=(select count(*) from public.dm_thread_members m where m.thread_id=t.id and m.status='active') limit 1;
 if v_thread is not null then return v_thread; end if;
 select coalesce(display_name,username,'Rich Member') into v_title from public.profiles where id=p_other_user;
 insert into public.dm_threads(title,thread_type,created_by,last_message,last_message_at) values(v_title,'direct',v_me,'Conversation started',now()) returning id into v_thread;
 insert into public.dm_thread_members(thread_id,user_id,role,status) values(v_thread,v_me,'owner','active'),(v_thread,p_other_user,'member','active');
 return v_thread;
end;$$;

grant execute on function public.rb_create_direct_thread(uuid) to authenticated;
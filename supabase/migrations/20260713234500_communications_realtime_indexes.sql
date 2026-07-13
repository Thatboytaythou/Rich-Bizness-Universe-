create index if not exists rich_notifications_user_created_idx on public.rich_notifications(user_id, created_at desc);
create index if not exists dm_thread_members_user_status_idx on public.dm_thread_members(user_id, status, thread_id);
create index if not exists dm_messages_thread_created_idx on public.dm_messages(thread_id, created_at asc);
create index if not exists dm_threads_last_message_idx on public.dm_threads(last_message_at desc nulls last);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rich_notifications') then
    alter publication supabase_realtime add table public.rich_notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_messages') then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_thread_members') then
    alter publication supabase_realtime add table public.dm_thread_members;
  end if;
end $$;

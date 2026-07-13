create unique index if not exists dm_thread_members_thread_user_unique on public.dm_thread_members(thread_id,user_id);
create unique index if not exists dm_message_reactions_message_user_emoji_unique on public.dm_message_reactions(message_id,user_id,emoji);
create unique index if not exists dm_message_reads_message_user_unique on public.dm_message_reads(message_id,user_id);
create unique index if not exists dm_typing_status_thread_user_unique on public.dm_typing_status(thread_id,user_id);
create index if not exists dm_messages_thread_live_created_idx on public.dm_messages(thread_id,created_at) where is_deleted=false;
create index if not exists dm_call_sessions_thread_created_idx on public.dm_call_sessions(thread_id,created_at desc);
create index if not exists rich_notifications_user_priority_created_idx on public.rich_notifications(user_id,priority,created_at desc);
create index if not exists search_queries_user_query_created_idx on public.search_queries(user_id,query,created_at desc);
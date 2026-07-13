-- Production cleanup retained the newest active membership row for each stream/user pair.
-- The canonical uniqueness and query-path locks follow.
create unique index if not exists live_stream_members_stream_user_unique
  on public.live_stream_members(stream_id,user_id);
create index if not exists live_streams_status_featured_created_idx
  on public.live_streams(status,is_featured,created_at desc);
create index if not exists live_recordings_visibility_created_idx
  on public.live_recordings(visibility,created_at desc);
create index if not exists live_chat_messages_stream_created_idx
  on public.live_chat_messages(stream_id,created_at);
create index if not exists live_reactions_stream_created_idx
  on public.live_reactions(stream_id,created_at desc);

insert into public.system_health_checks(service,status,message,metadata,checked_at)
values ('live-watch','ok','Live and Watch interaction states, membership ownership, and realtime query paths hardened',jsonb_build_object('source','step_22','duplicate_members_removed',true),now());

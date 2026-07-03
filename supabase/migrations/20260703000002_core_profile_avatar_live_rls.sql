alter table public.profiles enable row level security;
alter table public.meta_avatars enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_stream_members enable row level security;
alter table public.live_view_sessions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists meta_avatars_select_own on public.meta_avatars;
drop policy if exists meta_avatars_insert_own on public.meta_avatars;
drop policy if exists meta_avatars_update_own on public.meta_avatars;
create policy meta_avatars_select_own on public.meta_avatars for select to authenticated using (user_id = auth.uid());
create policy meta_avatars_insert_own on public.meta_avatars for insert to authenticated with check (user_id = auth.uid());
create policy meta_avatars_update_own on public.meta_avatars for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists live_streams_public_read on public.live_streams;
drop policy if exists live_streams_insert_own on public.live_streams;
drop policy if exists live_streams_update_own on public.live_streams;
create policy live_streams_public_read on public.live_streams for select using (true);
create policy live_streams_insert_own on public.live_streams for insert to authenticated with check (creator_id = auth.uid());
create policy live_streams_update_own on public.live_streams for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists live_stream_members_select_authenticated on public.live_stream_members;
create policy live_stream_members_select_authenticated on public.live_stream_members for select to authenticated using (true);

drop policy if exists live_view_sessions_insert_own on public.live_view_sessions;
create policy live_view_sessions_insert_own on public.live_view_sessions for insert to authenticated with check (user_id = auth.uid());

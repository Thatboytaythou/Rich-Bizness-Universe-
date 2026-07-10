begin;

-- Registry writes are administrative only. Public clients may read active games.
drop policy if exists games_auth_insert on public.games;
drop policy if exists games_auth_update on public.games;
create policy games_admin_insert on public.games for insert to authenticated
with check (public.rb_is_admin(2));
create policy games_admin_update on public.games for update to authenticated
using (public.rb_is_admin(2)) with check (public.rb_is_admin(2));

-- A signed-in player can create only a room they host.
drop policy if exists "Authenticated users can create game rooms" on public.game_rooms;
drop policy if exists "Authenticated users can update game rooms" on public.game_rooms;
create policy game_rooms_host_insert on public.game_rooms for insert to authenticated
with check (host_user_id = auth.uid());
create policy game_rooms_host_update on public.game_rooms for update to authenticated
using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());

-- Membership is owned by the member or the room host.
drop policy if exists "Anyone can insert game room members" on public.game_room_members;
drop policy if exists "Authenticated users can update game room members" on public.game_room_members;
create policy game_room_members_join on public.game_room_members for insert to authenticated
with check (
  user_id = auth.uid()
  or exists (select 1 from public.game_rooms r where r.id = room_id and r.host_user_id = auth.uid())
);
create policy game_room_members_owner_update on public.game_room_members for update to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.game_rooms r where r.id = room_id and r.host_user_id = auth.uid())
)
with check (
  user_id = auth.uid()
  or exists (select 1 from public.game_rooms r where r.id = room_id and r.host_user_id = auth.uid())
);

-- Moves must belong to the caller and to a room they joined.
drop policy if exists "Anyone can insert game moves" on public.game_moves;
create policy game_moves_member_insert on public.game_moves for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.game_room_members m
    where m.room_id = game_moves.room_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

commit;

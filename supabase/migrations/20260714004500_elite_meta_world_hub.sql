create unique index if not exists meta_room_members_room_user_uidx on public.meta_room_members(room_id,user_id);
create unique index if not exists meta_world_likes_world_user_uidx on public.meta_world_likes(world_id,user_id);
create index if not exists meta_rooms_world_status_idx on public.meta_rooms(world_id,status,updated_at desc);
create index if not exists meta_chat_room_recent_idx on public.meta_chat_messages(room_id,created_at desc);
create index if not exists meta_visits_world_recent_idx on public.meta_visits(world_id,entered_at desc);

create or replace function public.rb_enter_meta_world(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_visit uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.meta_worlds where id=p_world_id and status='active') then raise exception 'World unavailable'; end if;
  select * into v_profile from public.profiles where id=v_user;
  insert into public.meta_visits(world_id,user_id,username,display_name,entered_at,metadata)
  values(p_world_id,v_user,v_profile.username,v_profile.display_name,now(),jsonb_build_object('source','meta-hub')) returning id into v_visit;
  update public.meta_worlds set visit_count=coalesce(visit_count,0)+1,updated_at=now() where id=p_world_id;
  update public.meta_avatars set current_world_id=p_world_id,is_active=true,updated_at=now() where user_id=v_user;
  return jsonb_build_object('visit_id',v_visit,'world_id',p_world_id,'entered',true);
end $$;

create or replace function public.rb_join_meta_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_room public.meta_rooms%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_room from public.meta_rooms where id=p_room_id and status='open';
  if v_room.id is null then raise exception 'Room unavailable'; end if;
  if coalesce(v_room.active_members,0)>=coalesce(v_room.max_members,50) and not exists(select 1 from public.meta_room_members where room_id=p_room_id and user_id=v_user and status='active') then raise exception 'Room is full'; end if;
  insert into public.meta_room_members(room_id,user_id,role,status,joined_at,left_at,metadata)
  values(p_room_id,v_user,case when v_room.owner_id=v_user then 'owner' else 'member' end,'active',now(),null,'{}'::jsonb)
  on conflict(room_id,user_id) do update set status='active',joined_at=now(),left_at=null;
  update public.meta_rooms set active_members=(select count(*) from public.meta_room_members where room_id=p_room_id and status='active'),updated_at=now() where id=p_room_id;
  update public.meta_avatars set current_world_id=v_room.world_id,is_active=true,updated_at=now() where user_id=v_user;
  return jsonb_build_object('room_id',p_room_id,'world_id',v_room.world_id,'joined',true);
end $$;

create or replace function public.rb_leave_meta_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.meta_room_members set status='left',left_at=now() where room_id=p_room_id and user_id=v_user;
  update public.meta_rooms set active_members=(select count(*) from public.meta_room_members where room_id=p_room_id and status='active'),updated_at=now() where id=p_room_id;
  return jsonb_build_object('room_id',p_room_id,'left',true);
end $$;

grant execute on function public.rb_enter_meta_world(uuid) to authenticated;
grant execute on function public.rb_join_meta_room(uuid) to authenticated;
grant execute on function public.rb_leave_meta_room(uuid) to authenticated;
revoke execute on function public.rb_enter_meta_world(uuid) from anon;
revoke execute on function public.rb_join_meta_room(uuid) from anon;
revoke execute on function public.rb_leave_meta_room(uuid) from anon;

do $$ begin alter publication supabase_realtime add table public.meta_rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meta_room_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meta_chat_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meta_world_likes; exception when duplicate_object then null; end $$;
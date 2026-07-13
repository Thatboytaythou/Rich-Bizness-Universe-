create unique index if not exists meta_world_likes_world_user_unique on public.meta_world_likes(world_id,user_id) where world_id is not null and user_id is not null;
create unique index if not exists meta_room_members_room_user_unique on public.meta_room_members(room_id,user_id) where room_id is not null and user_id is not null;
create unique index if not exists meta_inventory_user_item_unique on public.meta_inventory(user_id,item_id) where user_id is not null and item_id is not null;
create index if not exists meta_worlds_status_type_featured_created_idx on public.meta_worlds(status,world_type,is_featured desc,created_at desc);
create index if not exists meta_rooms_world_status_created_idx on public.meta_rooms(world_id,status,created_at desc);
create index if not exists meta_room_members_room_status_joined_idx on public.meta_room_members(room_id,status,joined_at);
create index if not exists meta_chat_messages_room_created_idx on public.meta_chat_messages(room_id,created_at);
create index if not exists meta_portals_world_active_sort_idx on public.meta_portals(world_id,is_active,sort_order);
create index if not exists meta_stream_links_world_status_created_idx on public.meta_stream_links(world_id,status,created_at desc);
create index if not exists meta_visits_world_entered_idx on public.meta_visits(world_id,entered_at desc);
create index if not exists meta_inventory_user_unlocked_idx on public.meta_inventory(user_id,unlocked_at desc);

drop policy if exists meta_room_members_owner_update on public.meta_room_members;
create policy meta_room_members_owner_update on public.meta_room_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists meta_visits_owner_update on public.meta_visits;
create policy meta_visits_owner_update on public.meta_visits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into public.system_health_checks(service,status,message,metadata)
values ('meta-universe','ok','Step 26 Meta interaction owner hardened',jsonb_build_object('worlds',true,'rooms',true,'presence',true,'chat',true,'portals',true,'inventory',true,'streams',true,'migration','step_26_meta_interaction_hardening'));
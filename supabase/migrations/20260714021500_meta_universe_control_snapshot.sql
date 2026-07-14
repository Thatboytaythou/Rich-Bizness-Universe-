create or replace function public.rb_meta_universe_snapshot(p_world_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_world uuid;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select coalesce(p_world_id,
    (select current_world_id from public.meta_avatars where user_id=v_user),
    (select id from public.meta_worlds where status='active' order by is_featured desc, created_at asc limit 1)
  ) into v_world;

  select jsonb_build_object(
    'profile',(select to_jsonb(p) - 'privacy_config' - 'notification_config' from public.profiles p where p.id=v_user),
    'avatar',(select to_jsonb(a) from public.meta_avatars a where a.user_id=v_user),
    'loadout',(select to_jsonb(l) from public.user_avatar_loadouts l where l.user_id=v_user and l.is_active=true order by l.updated_at desc limit 1),
    'avatar_inventory',coalesce((select jsonb_agg(jsonb_build_object('item_key',i.item_key,'equipped',i.equipped,'item',to_jsonb(ai))) from public.avatar_inventory i left join public.avatar_items ai on ai.item_key=i.item_key where i.user_id=v_user),'[]'::jsonb),
    'world',(select to_jsonb(w) from public.meta_worlds w where w.id=v_world and w.status='active'),
    'worlds',coalesce((select jsonb_agg(to_jsonb(w) order by w.is_featured desc,w.created_at asc) from public.meta_worlds w where w.status='active'),'[]'::jsonb),
    'rooms',coalesce((select jsonb_agg(to_jsonb(r) order by r.active_members desc,r.created_at asc) from public.meta_rooms r where r.world_id=v_world and r.status='open'),'[]'::jsonb),
    'portals',coalesce((select jsonb_agg(to_jsonb(p) order by p.sort_order asc,p.created_at asc) from public.meta_portals p where p.is_active=true and (p.world_id is null or p.world_id=v_world)),'[]'::jsonb),
    'stream_links',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.meta_stream_links s where s.world_id=v_world and s.status in ('active','live')),'[]'::jsonb),
    'meta_inventory',coalesce((select jsonb_agg(jsonb_build_object('inventory',to_jsonb(mi),'item',to_jsonb(it))) from public.meta_inventory mi join public.meta_items it on it.id=mi.item_id where mi.user_id=v_user order by mi.unlocked_at desc),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from public.meta_room_members m where m.user_id=v_user and m.status='active'),'[]'::jsonb),
    'liked_world_ids',coalesce((select jsonb_agg(l.world_id) from public.meta_world_likes l where l.user_id=v_user),'[]'::jsonb),
    'recent_visits',coalesce((select jsonb_agg(to_jsonb(v) order by v.entered_at desc) from (select * from public.meta_visits where user_id=v_user order by entered_at desc limit 20) v),'[]'::jsonb),
    'character_presets',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at asc) from public.avatar_character_presets c where c.is_active=true),'[]'::jsonb),
    'avatar_models',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at asc) from public.avatar_models m where m.is_active=true),'[]'::jsonb),
    'xp',(select public.rb_xp_snapshot(v_user))
  ) into v_result;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

grant execute on function public.rb_meta_universe_snapshot(uuid) to authenticated;
revoke execute on function public.rb_meta_universe_snapshot(uuid) from anon;

create index if not exists meta_visits_user_recent_idx on public.meta_visits(user_id,entered_at desc);
create index if not exists meta_rooms_world_status_members_idx on public.meta_rooms(world_id,status,active_members desc);
create index if not exists meta_stream_links_world_status_idx on public.meta_stream_links(world_id,status,created_at desc);
create index if not exists meta_worlds_active_featured_idx on public.meta_worlds(status,is_featured desc,created_at asc);
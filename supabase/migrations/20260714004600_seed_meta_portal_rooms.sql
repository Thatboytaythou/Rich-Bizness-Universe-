insert into public.meta_rooms(world_id,owner_id,title,room_type,status,max_members,cover_url,metadata)
select w.id,w.owner_id,v.title,v.room_type,'open',v.max_members,null,jsonb_build_object('seed','rich-bizness-meta','voice_enabled',true)
from public.meta_worlds w
cross join (values
  ('Smoke Lounge','social',50),
  ('Creator Stage','live',100),
  ('Arcade District','gaming',64),
  ('VIP Skybox','vip',24)
) as v(title,room_type,max_members)
where w.slug='rich-bizness-portal'
and not exists(select 1 from public.meta_rooms r where r.world_id=w.id and r.title=v.title);

update public.meta_worlds w
set room_count=(select count(*) from public.meta_rooms r where r.world_id=w.id),updated_at=now()
where w.slug='rich-bizness-portal';
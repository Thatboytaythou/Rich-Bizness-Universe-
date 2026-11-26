begin;
insert into public.meta_worlds(slug,title,description,world_type,status,access_type,entry_route,visual_style,engine_type,voice_enabled,avatar_required,metadata)
values
('rb-personal-residence','Personal Residence','Solo residence template. Lighting, wardrobe and profile access. No visitor or shared occupancy service yet.','custom','active','public','/avatar.html?district=personal','cinematic-interior','three',false,true,'{"runtime":"rb-district-v1","district":"personal","occupancy":"solo"}'::jsonb),
('rb-living-city','Living City','Explore the central avenue, commerce and social destinations. Solo 3D movement with separate public social rooms.','lounge','active','public','/avatar.html?district=city','cinematic-street','three',false,true,'{"runtime":"rb-district-v1","district":"city","occupancy":"solo"}'::jsonb),
('rb-creative-district','Creative District','Recording and exhibition space with Music, Upload, Gallery and Live destinations.','custom','active','public','/avatar.html?district=creative','cinematic-studio','three',false,true,'{"runtime":"rb-district-v1","district":"creative","occupancy":"solo"}'::jsonb)
on conflict(slug) do nothing;
insert into public.meta_portals(world_id,title,destination_type,destination_url,sort_order,metadata)
select w.id,v.title,'route',v.url,v.ord,'{"source":"rb-district-v1"}'::jsonb
from (values
('rb-personal-residence','Wardrobe','/avatar-characters.html',10),
('rb-personal-residence','Rich ID','/profile.html',20),
('rb-personal-residence','Living City','/avatar.html?district=city',30),
('rb-living-city','Personal Residence','/avatar.html?district=personal',10),
('rb-living-city','Commerce','/store.html',20),
('rb-living-city','Creative District','/avatar.html?district=creative',30),
('rb-creative-district','Music','/music.html',10),
('rb-creative-district','Publish','/upload.html',20),
('rb-creative-district','Gallery','/gallery.html',30),
('rb-creative-district','Live','/live.html',40),
('rb-creative-district','Living City','/avatar.html?district=city',50)
) as v(slug,title,url,ord) join public.meta_worlds w on w.slug=v.slug
where w.metadata->>'runtime'='rb-district-v1' and not exists(select 1 from public.meta_portals p where p.world_id=w.id and p.destination_url=v.url);
insert into public.meta_rooms(world_id,title,room_type,status,max_members,metadata)
select w.id,v.title,v.kind,'open',32,'{"source":"rb-district-v1"}'::jsonb
from (values ('rb-living-city','City Social Square','social'),('rb-creative-district','Creative Exchange','music')) v(slug,title,kind)
join public.meta_worlds w on w.slug=v.slug
where w.metadata->>'runtime'='rb-district-v1' and not exists(select 1 from public.meta_rooms r where r.world_id=w.id and r.title=v.title);
update public.meta_worlds w set room_count=(select count(*) from public.meta_rooms r where r.world_id=w.id and r.status='open') where w.metadata->>'runtime'='rb-district-v1';
commit;
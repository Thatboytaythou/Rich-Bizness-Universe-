create table if not exists public.live_categories (
  slug text primary key,
  label text not null,
  slang_label text not null,
  description text,
  icon text,
  hero_asset_url text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.live_categories enable row level security;
drop policy if exists live_categories_public_read on public.live_categories;
create policy live_categories_public_read on public.live_categories for select using (is_active=true);

insert into public.live_categories(slug,label,slang_label,description,icon,hero_asset_url,sort_order,metadata) values
('family-bizness','Family & Lifestyle','FAMILY BIZNESS','Family moments, daily life, real talk and behind-the-scenes energy.','🏠','/images/live/family-bizness.svg',10,'{"tone":"warm","accent":"gold"}'),
('bizness-party','Party & Events','BIZNESS PARTY','Turn-up rooms, celebrations, club energy and special events.','🔥','/images/live/bizness-party.svg',20,'{"tone":"hype","accent":"green"}'),
('smoke-session','Chill & Conversation','SMOKE SESSION','Laid-back talk, storytelling, reactions and smoke-cloud vibes.','💨','/images/live/smoke-session.svg',30,'{"tone":"chill","accent":"emerald"}'),
('music-drop','Music & Studio','MUSIC DROP','Studio sessions, listening parties, previews, performances and releases.','🎵','/images/live/music-drop.svg',40,'{"tone":"music","accent":"gold"}'),
('game-time','Gaming','GAME TIME','Gameplay, tournaments, challenges, live reactions and squad rooms.','🎮','/images/live/game-time.svg',50,'{"tone":"gaming","accent":"green"}'),
('sports-talk','Sports','SPORTS TALK','Live games, picks, debates, highlights, watch parties and training.','🏆','/images/live/sports-talk.svg',60,'{"tone":"sports","accent":"gold"}'),
('podcast-lounge','Podcast & Interviews','PODCAST LOUNGE','Long-form conversations, interviews, panels and creator stories.','🎙️','/images/live/podcast-lounge.svg',70,'{"tone":"podcast","accent":"emerald"}'),
('behind-the-bizness','Creator & Business','BEHIND THE BIZNESS','Building the brand, creator strategy, store drops and real business moves.','💼','/images/live/behind-the-bizness.svg',80,'{"tone":"business","accent":"gold"}'),
('on-the-go','IRL & Mobile','ON THE GO','Street streams, rides, local events, travel and real-world action.','📍','/images/live/on-the-go.svg',90,'{"tone":"irl","accent":"green"}'),
('vip-rich-room','VIP & Premium','VIP RICH ROOM','Private premium broadcasts, paid access, members-only rooms and elite drops.','👑','/images/live/vip-rich-room.svg',100,'{"tone":"vip","accent":"gold"}')
on conflict(slug) do update set label=excluded.label,slang_label=excluded.slang_label,description=excluded.description,icon=excluded.icon,hero_asset_url=excluded.hero_asset_url,sort_order=excluded.sort_order,metadata=excluded.metadata,is_active=true,updated_at=now();

create or replace function public.rb_go_live_bootstrap() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_profile jsonb; v_stream jsonb; v_categories jsonb;
begin
 if v_uid is null then raise exception 'Tap in first so we can lock your Rich ID to this broadcast.' using errcode='28000'; end if;
 select to_jsonb(p) into v_profile from public.profiles p where p.id=v_uid;
 if v_profile is null then
  insert into public.profiles(id,display_name,username,online_status,is_creator,updated_at)
  select u.id,coalesce(u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1),'Rich Member'),regexp_replace(lower(coalesce(u.raw_user_meta_data->>'username',split_part(u.email,'@',1),'rich_member')),'[^a-z0-9_]+','_','g'),'online',true,now() from auth.users u where u.id=v_uid
  on conflict(id) do update set is_creator=true,online_status='online',updated_at=now();
 else update public.profiles set is_creator=true,online_status='online',updated_at=now() where id=v_uid; end if;
 select to_jsonb(p) into v_profile from public.profiles p where p.id=v_uid;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb) into v_categories from public.live_categories c where c.is_active=true;
 select to_jsonb(s) into v_stream from public.live_streams s where s.creator_id=v_uid and s.status in ('draft','ready','scheduled','live') order by case when s.status='live' then 0 when s.status='ready' then 1 else 2 end,s.updated_at desc limit 1;
 return jsonb_build_object('user_id',v_uid,'profile',v_profile,'categories',v_categories,'active_stream',v_stream,'auth_ready',true,'copy',jsonb_build_object('tap_in','TAP IN','go_live','GO LIVE','start','LIGHT THIS BITCH UP','ready','WE LIT🔥','draft','GET RIGHT','room','BIZNESS PARTY','network','WE 🔥📺'));
end;$$;

create or replace function public.rb_start_live_stream(p_title text,p_description text default null,p_category text default 'family-bizness',p_access_type text default 'free',p_price_cents integer default 0,p_thumbnail_url text default null,p_cover_url text default null,p_is_chat_enabled boolean default true,p_is_cohost_enabled boolean default true,p_recording_enabled boolean default true,p_transcription_enabled boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_category public.live_categories%rowtype; v_stream public.live_streams%rowtype; v_room text; v_slug text;
begin
 if v_uid is null then raise exception 'Tap in first so we can lock your Rich ID to this broadcast.' using errcode='28000'; end if;
 if length(trim(coalesce(p_title,'')))<3 then raise exception 'Give your live a real title first.'; end if;
 select * into v_category from public.live_categories where slug=p_category and is_active=true;
 if not found then raise exception 'Pick a valid live category.'; end if;
 v_room:='bizness-party-'||left(replace(gen_random_uuid()::text,'-',''),12);
 v_slug:=regexp_replace(lower(trim(p_title)),'[^a-z0-9]+','-','g')||'-'||left(replace(gen_random_uuid()::text,'-',''),6);
 update public.live_streams set status='ended',status_label='PARTY’S OVER',ended_at=now(),last_activity_at=now(),updated_at=now() where creator_id=v_uid and status='live';
 insert into public.live_streams(creator_id,slug,display_slug,title,description,category,status,status_label,access_type,price_cents,currency,livekit_room_name,display_room_name,thumbnail_url,cover_url,is_chat_enabled,is_cohost_enabled,is_vip_enabled,recording_enabled,transcription_enabled,stream_protocol,latency_mode,started_at,last_activity_at,metadata,layout_config,quality_config)
 values(v_uid,v_slug,'WE 🔥📺',trim(p_title),nullif(trim(coalesce(p_description,'')),''),v_category.slug,'live','WE LIT🔥',case when p_access_type in ('free','vip','paid','private') then p_access_type else 'free' end,case when p_access_type in ('vip','paid') then greatest(coalesce(p_price_cents,0),0) else 0 end,'usd',v_room,v_category.slang_label,coalesce(nullif(trim(coalesce(p_thumbnail_url,'')),''),v_category.hero_asset_url),coalesce(nullif(trim(coalesce(p_cover_url,'')),''),v_category.hero_asset_url),coalesce(p_is_chat_enabled,true),coalesce(p_is_cohost_enabled,true),p_access_type in ('vip','paid'),coalesce(p_recording_enabled,true),coalesce(p_transcription_enabled,false),'livekit','interactive',now(),now(),jsonb_build_object('category_label',v_category.label,'slang_label',v_category.slang_label,'icon',v_category.icon,'source','go-live-studio'),jsonb_build_object('theme','smoke-cloud','orientation','portrait-first','brand','Rich Bizness LLC'),jsonb_build_object('video','1080p','audio','studio','adaptive',true)) returning * into v_stream;
 update public.profiles set is_creator=true,online_status='live',updated_at=now() where id=v_uid;
 return jsonb_build_object('ok',true,'message','WE LIT🔥 — your Bizness Party room is ready.','stream',to_jsonb(v_stream),'host_path','/live.html?host='||v_stream.id::text,'room_name',v_stream.livekit_room_name);
end;$$;

create or replace function public.rb_end_live_stream(p_stream_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_stream public.live_streams%rowtype;
begin
 if v_uid is null then raise exception 'Tap in first.' using errcode='28000'; end if;
 update public.live_streams set status='ended',status_label='PARTY’S OVER',ended_at=now(),last_activity_at=now(),updated_at=now() where id=p_stream_id and creator_id=v_uid returning * into v_stream;
 if not found then raise exception 'That live room is not yours.'; end if;
 update public.profiles set online_status='online',updated_at=now() where id=v_uid;
 return jsonb_build_object('ok',true,'message','PARTY’S OVER — replay processing can start.','stream',to_jsonb(v_stream));
end;$$;

revoke all on function public.rb_go_live_bootstrap() from public,anon;
revoke all on function public.rb_start_live_stream(text,text,text,text,integer,text,text,boolean,boolean,boolean,boolean) from public,anon;
revoke all on function public.rb_end_live_stream(uuid) from public,anon;
grant execute on function public.rb_go_live_bootstrap() to authenticated;
grant execute on function public.rb_start_live_stream(text,text,text,text,integer,text,text,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.rb_end_live_stream(uuid) to authenticated;

create index if not exists live_categories_active_sort_idx on public.live_categories(is_active,sort_order);
create index if not exists live_streams_creator_status_updated_idx on public.live_streams(creator_id,status,updated_at desc);

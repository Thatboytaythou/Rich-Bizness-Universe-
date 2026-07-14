create unique index if not exists live_categories_slug_unique on public.live_categories(slug);
create unique index if not exists live_streams_one_active_per_creator on public.live_streams(creator_id) where status='live';

update public.live_categories set hero_asset_url = case slug
  when 'family-bizness' then '/images/live/categories/family-bizness.svg'
  when 'bizness-party' then '/images/live/categories/bizness-party.svg'
  when 'smoke-session' then '/images/live/categories/smoke-session.svg'
  when 'music-drop' then '/images/live/categories/music-drop.svg'
  when 'game-time' then '/images/live/categories/game-time.svg'
  when 'sports-talk' then '/images/live/categories/sports-talk.svg'
  when 'podcast-lounge' then '/images/live/categories/podcast-lounge.svg'
  when 'behind-the-bizness' then '/images/live/categories/behind-the-bizness.svg'
  when 'on-the-go' then '/images/live/categories/on-the-go.svg'
  when 'vip-rich-room' then '/images/live/categories/vip-rich-room.svg'
  else hero_asset_url end;

create or replace function public.rb_start_live_stream(
  p_title text,
  p_description text default null,
  p_category text default 'family-bizness',
  p_access_type text default 'free',
  p_price_cents integer default 0,
  p_thumbnail_url text default null,
  p_cover_url text default null,
  p_is_chat_enabled boolean default true,
  p_is_cohost_enabled boolean default true,
  p_recording_enabled boolean default true,
  p_transcription_enabled boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_category public.live_categories%rowtype;
  v_stream public.live_streams%rowtype;
  v_room text;
  v_slug text;
  v_access text := case when p_access_type in ('free','vip','paid','private') then p_access_type else 'free' end;
begin
  if v_uid is null then raise exception 'Tap in first so we can lock your Rich ID to this broadcast.' using errcode='28000'; end if;
  if length(trim(coalesce(p_title,''))) < 3 then raise exception 'Name the live first — tell everybody what type time we on.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
  select * into v_category from public.live_categories where slug=p_category and is_active=true;
  if not found then raise exception 'Pick one live lane before we light it up.'; end if;

  select * into v_stream from public.live_streams where creator_id=v_uid and status='live' order by updated_at desc limit 1 for update;
  if found then
    update public.live_streams set
      title=trim(p_title), description=nullif(trim(coalesce(p_description,'')),''), category=v_category.slug,
      display_room_name=v_category.slang_label, access_type=v_access,
      price_cents=case when v_access in ('vip','paid') then greatest(coalesce(p_price_cents,0),0) else 0 end,
      is_vip_enabled=v_access in ('vip','paid'),
      thumbnail_url=coalesce(nullif(trim(coalesce(p_thumbnail_url,'')),''),v_category.hero_asset_url),
      cover_url=coalesce(nullif(trim(coalesce(p_cover_url,'')),''),v_category.hero_asset_url),
      is_chat_enabled=coalesce(p_is_chat_enabled,true), is_cohost_enabled=coalesce(p_is_cohost_enabled,true),
      recording_enabled=coalesce(p_recording_enabled,true), transcription_enabled=coalesce(p_transcription_enabled,false),
      last_activity_at=now(), updated_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('category_label',v_category.label,'slang_label',v_category.slang_label,'icon',v_category.icon,'source','go-live-studio-v3','copy',jsonb_build_object('tap_in','TAP IN','start','LIGHT THIS SHYT UP','live','WE LIT🔥','end','PARTY’S OVER'))
    where id=v_stream.id returning * into v_stream;
    update public.profiles set is_creator=true,online_status='live',updated_at=now() where id=v_uid;
    return jsonb_build_object('ok',true,'reused',true,'message','WE LIT🔥 — your same Bizness Party stayed open.','stream',to_jsonb(v_stream),'host_path','/live.html?host='||v_stream.id::text,'room_name',v_stream.livekit_room_name);
  end if;

  update public.live_streams set status='ended',status_label='PARTY’S OVER',ended_at=coalesce(ended_at,now()),last_activity_at=now(),updated_at=now()
  where creator_id=v_uid and status in ('draft','ready','scheduled','upcoming');
  v_room:='bizness-party-'||left(replace(gen_random_uuid()::text,'-',''),12);
  v_slug:=trim(both '-' from regexp_replace(lower(trim(p_title)),'[^a-z0-9]+','-','g'))||'-'||left(replace(gen_random_uuid()::text,'-',''),6);

  insert into public.live_streams(
    creator_id,slug,display_slug,title,description,category,status,status_label,access_type,price_cents,currency,
    livekit_room_name,display_room_name,thumbnail_url,cover_url,is_chat_enabled,is_cohost_enabled,is_vip_enabled,
    recording_enabled,transcription_enabled,stream_protocol,latency_mode,started_at,last_activity_at,metadata,layout_config,quality_config
  ) values (
    v_uid,v_slug,'WE 🔥📺',trim(p_title),nullif(trim(coalesce(p_description,'')),''),v_category.slug,'live','WE LIT🔥',v_access,
    case when v_access in ('vip','paid') then greatest(coalesce(p_price_cents,0),0) else 0 end,'usd',v_room,v_category.slang_label,
    coalesce(nullif(trim(coalesce(p_thumbnail_url,'')),''),v_category.hero_asset_url),coalesce(nullif(trim(coalesce(p_cover_url,'')),''),v_category.hero_asset_url),
    coalesce(p_is_chat_enabled,true),coalesce(p_is_cohost_enabled,true),v_access in ('vip','paid'),coalesce(p_recording_enabled,true),coalesce(p_transcription_enabled,false),
    'livekit','interactive',now(),now(),jsonb_build_object('category_label',v_category.label,'slang_label',v_category.slang_label,'icon',v_category.icon,'source','go-live-studio-v3','copy',jsonb_build_object('tap_in','TAP IN','start','LIGHT THIS SHYT UP','live','WE LIT🔥','end','PARTY’S OVER')),
    jsonb_build_object('theme','smoke-cloud','orientation','portrait-first','brand','Rich Bizness LLC'),jsonb_build_object('video','1080p','audio','studio','adaptive',true)
  ) returning * into v_stream;
  update public.profiles set is_creator=true,online_status='live',updated_at=now() where id=v_uid;
  return jsonb_build_object('ok',true,'reused',false,'message','WE LIT🔥 — your Bizness Party is open.','stream',to_jsonb(v_stream),'host_path','/live.html?host='||v_stream.id::text,'room_name',v_stream.livekit_room_name);
end;
$$;

grant execute on function public.rb_start_live_stream(text,text,text,text,integer,text,text,boolean,boolean,boolean,boolean) to authenticated;
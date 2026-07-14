update public.live_streams set category='bizness-party',display_room_name='BIZNESS PARTY',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('slang_label','BIZNESS PARTY') where category in ('live','Bizness Party','bizness party');

with ranked as (
  select id,row_number() over(partition by creator_id order by case when status='live' then 0 else 1 end,updated_at desc nulls last,created_at desc nulls last) rn
  from public.live_streams
  where status in ('draft','ready','scheduled','upcoming','live')
)
update public.live_streams s
set status='ended',status_label='PARTY’S OVER',ended_at=coalesce(ended_at,now()),updated_at=now()
from ranked r where s.id=r.id and r.rn>1;

create unique index if not exists live_streams_one_open_room_per_creator_idx
on public.live_streams(creator_id)
where status in ('draft','ready','scheduled','upcoming','live');

create or replace function public.rb_start_live_stream(p_title text,p_description text default null,p_category text default 'family-bizness',p_access_type text default 'free',p_price_cents integer default 0,p_thumbnail_url text default null,p_cover_url text default null,p_is_chat_enabled boolean default true,p_is_cohost_enabled boolean default true,p_recording_enabled boolean default true,p_transcription_enabled boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_category public.live_categories%rowtype; v_stream public.live_streams%rowtype; v_room text; v_slug text;
begin
 if v_uid is null then raise exception 'Tap in first so we can lock your Rich ID to this broadcast.' using errcode='28000'; end if;
 if length(trim(coalesce(p_title,'')))<3 then raise exception 'Name the live first — tell everybody what type time we on.'; end if;
 select * into v_category from public.live_categories where slug=p_category and is_active=true;
 if not found then raise exception 'Pick one live lane before we light it up.'; end if;
 v_room:='bizness-party-'||left(replace(gen_random_uuid()::text,'-',''),12);
 v_slug:=trim(both '-' from regexp_replace(lower(trim(p_title)),'[^a-z0-9]+','-','g'))||'-'||left(replace(gen_random_uuid()::text,'-',''),6);
 update public.live_streams set status='ended',status_label='PARTY’S OVER',ended_at=coalesce(ended_at,now()),last_activity_at=now(),updated_at=now() where creator_id=v_uid and status in ('draft','ready','scheduled','upcoming','live');
 insert into public.live_streams(creator_id,slug,display_slug,title,description,category,status,status_label,access_type,price_cents,currency,livekit_room_name,display_room_name,thumbnail_url,cover_url,is_chat_enabled,is_cohost_enabled,is_vip_enabled,recording_enabled,transcription_enabled,stream_protocol,latency_mode,started_at,last_activity_at,metadata,layout_config,quality_config)
 values(v_uid,v_slug,'WE 🔥 📺',trim(p_title),nullif(trim(coalesce(p_description,'')),''),v_category.slug,'live','WE LIVE',case when p_access_type in ('free','vip','paid','private') then p_access_type else 'free' end,case when p_access_type in ('vip','paid') then greatest(coalesce(p_price_cents,0),0) else 0 end,'usd',v_room,v_category.slang_label,coalesce(nullif(trim(coalesce(p_thumbnail_url,'')),''),v_category.hero_asset_url),coalesce(nullif(trim(coalesce(p_cover_url,'')),''),v_category.hero_asset_url),coalesce(p_is_chat_enabled,true),coalesce(p_is_cohost_enabled,true),p_access_type in ('vip','paid'),coalesce(p_recording_enabled,true),coalesce(p_transcription_enabled,false),'livekit','interactive',now(),now(),jsonb_build_object('category_label',v_category.label,'slang_label',v_category.slang_label,'icon',v_category.icon,'source','go-live-studio-v2','copy',jsonb_build_object('tap_in','TAP IN','start','LIGHT THIS SHYT UP','live','WE LIVE','end','PARTY’S OVER')),jsonb_build_object('theme','smoke-cloud','orientation','portrait-first','brand','Rich Bizness LLC'),jsonb_build_object('video','1080p','audio','studio','adaptive',true)) returning * into v_stream;
 update public.profiles set is_creator=true,online_status='live',updated_at=now() where id=v_uid;
 return jsonb_build_object('ok',true,'message','WE LIVE — your Bizness Party is open.','stream',to_jsonb(v_stream),'host_path','/live.html?host='||v_stream.id::text,'room_name',v_stream.livekit_room_name);
end$$;

revoke execute on function public.rb_start_live_stream(text,text,text,text,integer,text,text,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.rb_start_live_stream(text,text,text,text,integer,text,text,boolean,boolean,boolean,boolean) to authenticated;
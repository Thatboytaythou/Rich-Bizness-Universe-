insert into public.avatar_character_presets (preset_key,title,aura,outfit,motion,config,is_active)
values
('boss','Rich Boss','Emerald Gold','Executive Street Armor','Boss Idle',jsonb_build_object('body_type','male','build','athletic','skin','deep-brown','hair','fade','facial_hair','trimmed-beard','smoke','heavy','voice','boss','signature','chain'),true),
('queen','Rich Queen','Diamond Mist','Luxury Combat Couture','Queen Walk',jsonb_build_object('body_type','female','build','athletic','skin','warm-brown','hair','long-wave','smoke','mist','voice','queen','signature','crown'),true),
('street_legend','Street Legend','Neon Phantom','Hooded Tactical Set','Street Glide',jsonb_build_object('body_type','male','build','lean','skin','dark-brown','hair','locs','smoke','neon','voice','street','signature','hood'),true),
('meta_guardian','Meta Guardian','Emerald Gold','Portal Guardian Armor','Power Stance',jsonb_build_object('body_type','neutral','build','heroic','skin','custom','hair','energy','smoke','portal','voice','guardian','signature','aura-core'),true),
('anime_villain','Anime Villain','Neon Phantom','Shadow Emperor Coat','Villain Hover',jsonb_build_object('body_type','custom','build','heroic','skin','stylized','hair','spiked','smoke','dark-energy','voice','villain','signature','katana'),true),
('anime_hero','Anime Hero','Diamond Mist','Celestial Hero Suit','Hero Flight',jsonb_build_object('body_type','custom','build','heroic','skin','stylized','hair','spiked','smoke','lightning','voice','hero','signature','energy-blade'),true),
('cyber_hustler','Cyber Hustler','Neon Phantom','Chrome Street Tech','Cyber Stride',jsonb_build_object('body_type','neutral','build','athletic','skin','custom','hair','cyber','smoke','digital','voice','synth','signature','visor'),true),
('classic_cartoon','Classic 80s','Emerald Gold','Retro Hustler Fit','Cartoon Bounce',jsonb_build_object('body_type','custom','build','stylized','skin','toon','hair','retro','smoke','toon-cloud','voice','classic','signature','boombox'),true)
on conflict (preset_key) do update set title=excluded.title,aura=excluded.aura,outfit=excluded.outfit,motion=excluded.motion,config=excluded.config,is_active=true,updated_at=now();

insert into public.avatar_items (item_key,item_type,title,rarity,config,is_active)
values
('gold_chain','neck','Rich Gold Chain','legendary',jsonb_build_object('mesh','chain','material','gold','glow',true),true),
('diamond_chain','neck','Diamond Smoke Chain','mythic',jsonb_build_object('mesh','chain','material','diamond','particles',true),true),
('boss_shades','face','Boss Shades','epic',jsonb_build_object('mesh','shades','lens','black-gold'),true),
('cyber_visor','face','Cyber Visor','legendary',jsonb_build_object('mesh','visor','emissive','neon-green'),true),
('rich_beanie','head','Rich Beanie','rare',jsonb_build_object('mesh','beanie','logo','RB'),true),
('royal_crown','head','Royal Smoke Crown','mythic',jsonb_build_object('mesh','crown','material','gold','aura',true),true),
('shadow_katana','weapon','Shadow Katana','legendary',jsonb_build_object('mesh','katana','trail','violet'),true),
('energy_blade','weapon','Emerald Energy Blade','mythic',jsonb_build_object('mesh','blade','trail','emerald'),true),
('smoke_blunt','hand','Cinematic Smoke Blunt','epic',jsonb_build_object('mesh','blunt','ember',true,'smoke',true),true),
('money_aura','aura','Money Storm Aura','legendary',jsonb_build_object('particles','money','orbit',true),true),
('portal_wings','back','Portal Wings','mythic',jsonb_build_object('mesh','wings','energy','green-gold'),true),
('retro_boombox','hand','Retro Rich Boombox','epic',jsonb_build_object('mesh','boombox','reactive_audio',true),true)
on conflict (item_key) do update set item_type=excluded.item_type,title=excluded.title,rarity=excluded.rarity,config=excluded.config,is_active=true;

create or replace function public.rb_avatar_runtime_snapshot() returns jsonb language sql security invoker set search_path=public as $$
select jsonb_build_object('profile',to_jsonb(p),'avatar',to_jsonb(a),'loadout',to_jsonb(l),'model',to_jsonb(m),'controller',to_jsonb(c),'motion',to_jsonb(s),'inventory',coalesce((select jsonb_agg(jsonb_build_object('item',to_jsonb(i),'equipped',inv.equipped)) from public.avatar_inventory inv join public.avatar_items i on i.item_key=inv.item_key where inv.user_id=auth.uid()),'[]'::jsonb),'presets',coalesce((select jsonb_agg(to_jsonb(ap) order by ap.title) from public.avatar_character_presets ap where ap.is_active),'[]'::jsonb),'items',coalesce((select jsonb_agg(to_jsonb(ai) order by ai.item_type,ai.title) from public.avatar_items ai where ai.is_active),'[]'::jsonb),'clips',coalesce((select jsonb_agg(to_jsonb(ac) order by ac.state_group,ac.title) from public.avatar_animation_clips ac where ac.is_active),'[]'::jsonb)) from public.profiles p left join public.meta_avatars a on a.user_id=p.id left join public.user_avatar_loadouts l on l.user_id=p.id left join public.avatar_models m on m.id=l.model_id left join public.avatar_controller_profiles c on c.id=l.controller_profile_id left join public.avatar_motion_state s on s.user_id=p.id where p.id=auth.uid();
$$;
grant execute on function public.rb_avatar_runtime_snapshot() to authenticated;
revoke execute on function public.rb_avatar_runtime_snapshot() from anon;

create or replace function public.rb_avatar_set_item(p_item_key text,p_equipped boolean default true) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_type text;
begin if v_user is null then raise exception 'Authentication required'; end if; select item_type into v_type from public.avatar_items where item_key=p_item_key and is_active; if v_type is null then raise exception 'Avatar item unavailable'; end if; if p_equipped then update public.avatar_inventory set equipped=false where user_id=v_user and item_key in(select item_key from public.avatar_items where item_type=v_type); insert into public.avatar_inventory(user_id,item_key,equipped) values(v_user,p_item_key,true) on conflict(user_id,item_key) do update set equipped=true; else update public.avatar_inventory set equipped=false where user_id=v_user and item_key=p_item_key; end if; return public.rb_avatar_runtime_snapshot(); end $$;
grant execute on function public.rb_avatar_set_item(text,boolean) to authenticated;
revoke execute on function public.rb_avatar_set_item(text,boolean) from anon;

insert into public.xp_events(event_key,title,section,xp_amount,coins_amount,rich_points_amount,cooldown_seconds,daily_limit,is_active,metadata)
values ('avatar_item_equipped','Avatar Gear Equipped','avatar',8,0,8,30,20,true,jsonb_build_object('source','avatar_inventory')),('avatar_character_changed','Avatar Character Changed','avatar',15,1,15,60,10,true,jsonb_build_object('source','avatar_character_presets'))
on conflict(event_key) do update set title=excluded.title,section=excluded.section,xp_amount=excluded.xp_amount,coins_amount=excluded.coins_amount,rich_points_amount=excluded.rich_points_amount,cooldown_seconds=excluded.cooldown_seconds,daily_limit=excluded.daily_limit,is_active=true,metadata=excluded.metadata,updated_at=now();
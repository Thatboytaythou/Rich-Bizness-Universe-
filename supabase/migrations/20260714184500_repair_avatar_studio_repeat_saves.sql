create or replace function public.rb_save_avatar_studio(
  p_display_name text,
  p_preset_key text,
  p_aura text,
  p_outfit jsonb default '{}'::jsonb,
  p_accessories jsonb default '{}'::jsonb,
  p_smoke jsonb default '{}'::jsonb,
  p_emotes jsonb default '{}'::jsonb,
  p_character_type text default 'custom'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_controller uuid;
  v_loadout uuid;
  v_avatar uuid;
  v_name text := nullif(trim(p_display_name), '');
  v_preset text := coalesce(nullif(trim(p_preset_key), ''), 'boss');
  v_aura text := coalesce(nullif(trim(p_aura), ''), 'Emerald Gold');
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select id
    into v_controller
  from public.avatar_controller_profiles
  where controller_key = 'rich-free-roam'
    and is_active
  limit 1;

  insert into public.user_avatar_loadouts (
    user_id,
    controller_profile_id,
    display_name,
    outfit_config,
    accessory_config,
    aura_config,
    smoke_config,
    emote_config,
    animation_overrides,
    is_active,
    metadata
  ) values (
    v_user,
    v_controller,
    v_name,
    coalesce(p_outfit, '{}'::jsonb),
    coalesce(p_accessories, '{}'::jsonb),
    jsonb_build_object('name', v_aura),
    coalesce(p_smoke, '{}'::jsonb),
    coalesce(p_emotes, '{}'::jsonb),
    jsonb_build_object('preset', v_preset),
    true,
    jsonb_build_object('source', 'avatar-studio', 'saved_at', now())
  )
  on conflict (user_id) do update set
    controller_profile_id = coalesce(excluded.controller_profile_id, public.user_avatar_loadouts.controller_profile_id),
    display_name = coalesce(excluded.display_name, public.user_avatar_loadouts.display_name),
    outfit_config = excluded.outfit_config,
    accessory_config = excluded.accessory_config,
    aura_config = excluded.aura_config,
    smoke_config = excluded.smoke_config,
    emote_config = excluded.emote_config,
    animation_overrides = excluded.animation_overrides,
    is_active = true,
    metadata = coalesce(public.user_avatar_loadouts.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into v_loadout;

  insert into public.meta_avatars (
    user_id,
    display_name,
    aura,
    rank,
    level,
    xp,
    is_active,
    metadata,
    controller_profile_id,
    active_loadout_id,
    animation_state,
    movement_settings,
    character_type,
    is_realistic_3d,
    is_controllable
  ) values (
    v_user,
    v_name,
    v_aura,
    'Traveler',
    1,
    0,
    true,
    jsonb_build_object(
      'preset_key', v_preset,
      'outfit', coalesce(p_outfit, '{}'::jsonb),
      'accessories', coalesce(p_accessories, '{}'::jsonb),
      'smoke', coalesce(p_smoke, '{}'::jsonb),
      'emotes', coalesce(p_emotes, '{}'::jsonb)
    ),
    v_controller,
    v_loadout,
    jsonb_build_object('state', 'idle', 'clip', 'boss-idle'),
    jsonb_build_object('controller', 'rich-free-roam', 'move_speed', 4.8, 'sprint_speed', 8.2, 'jump_force', 6.8),
    coalesce(nullif(trim(p_character_type), ''), 'custom'),
    true,
    true
  )
  on conflict (user_id) do update set
    display_name = coalesce(excluded.display_name, public.meta_avatars.display_name),
    aura = excluded.aura,
    is_active = true,
    metadata = coalesce(public.meta_avatars.metadata, '{}'::jsonb) || excluded.metadata,
    controller_profile_id = coalesce(excluded.controller_profile_id, public.meta_avatars.controller_profile_id),
    active_loadout_id = excluded.active_loadout_id,
    animation_state = coalesce(public.meta_avatars.animation_state, '{}'::jsonb) || excluded.animation_state,
    movement_settings = coalesce(public.meta_avatars.movement_settings, '{}'::jsonb) || excluded.movement_settings,
    character_type = excluded.character_type,
    is_realistic_3d = true,
    is_controllable = true,
    updated_at = now()
  returning id into v_avatar;

  update public.profiles
  set preferred_avatar_loadout_id = v_loadout,
      has_avatar = true,
      updated_at = now()
  where id = v_user;

  return jsonb_build_object(
    'avatar_id', v_avatar,
    'loadout_id', v_loadout,
    'controller_profile_id', v_controller,
    'saved', true,
    'reused_loadout', true
  );
end;
$function$;

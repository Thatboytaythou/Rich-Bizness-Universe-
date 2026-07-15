update public.route_registry
set auth_mode = 'public',
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'public_profile_lookup', true,
      'owner_actions_require_auth', true
    )
where route_key = 'profile'
  and route_path = '/profile.html';

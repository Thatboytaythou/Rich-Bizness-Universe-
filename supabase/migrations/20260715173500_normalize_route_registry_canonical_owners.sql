update public.route_registry
set canonical_file = case
  when route_key = 'portal' then 'apps/web/index.html'
  when canonical_file is not null and canonical_file not like 'apps/web/%'
    then 'apps/web/' || regexp_replace(canonical_file, '^.*/', '')
  else canonical_file
end,
updated_at = now()
where route_key = 'portal'
   or (canonical_file is not null and canonical_file not like 'apps/web/%');

insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode,
  canonical_file, rewrite_target, nav_label,
  is_home, is_enabled, metadata
)
values (
  'game-rich-spades-royale',
  '/games/rich-spades-royale/',
  'game',
  'gaming',
  'public',
  'apps/web/rich-spades-royale.html',
  '/rich-spades-royale',
  'Rich Spades Royale',
  false,
  true,
  jsonb_build_object('game_slug','rich-spades-royale','production_ready',true)
)
on conflict (route_key) do update set
  route_path = excluded.route_path,
  page_type = excluded.page_type,
  section = excluded.section,
  auth_mode = excluded.auth_mode,
  canonical_file = excluded.canonical_file,
  rewrite_target = excluded.rewrite_target,
  nav_label = excluded.nav_label,
  is_home = excluded.is_home,
  is_enabled = excluded.is_enabled,
  metadata = excluded.metadata,
  updated_at = now();

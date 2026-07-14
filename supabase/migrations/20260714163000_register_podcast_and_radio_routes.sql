insert into public.route_registry (
  route_key, route_path, page_type, section, auth_mode,
  canonical_file, rewrite_target, nav_label, is_home, is_enabled, metadata
) values
  ('podcast', '/podcast.html', 'page', 'music', 'authenticated', 'podcast.html', '/podcast.html', 'PODCAST', false, true, '{"owner":"apps/web/src/pages/podcast/podcast.page.ts"}'::jsonb),
  ('radio', '/radio.html', 'page', 'music', 'authenticated', 'radio.html', '/radio.html', 'RADIO', false, true, '{"owner":"apps/web/src/pages/radio/radio.page.ts"}'::jsonb)
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

insert into public.route_registry (route_key, route_path, page_type, section, auth_mode, canonical_file, rewrite_target, nav_label, is_home, is_enabled, metadata)
values
  ('portal_page','/portal.html','page','portal','public','portal.html','/portal.html','PORTAL',false,true,'{}'::jsonb),
  ('tap_in','/tap-in.html','page','auth','guest_only','tap-in.html','/tap-in.html','TAP IN',false,true,'{}'::jsonb),
  ('profile','/profile.html','page','profile','authenticated','profile.html','/profile.html','PROFILE',false,true,'{}'::jsonb),
  ('edit_profile','/edit-profile.html','feature','profile','authenticated','edit-profile.html','/edit-profile.html','EDIT PROFILE',false,true,'{}'::jsonb),
  ('settings','/settings.html','feature','settings','authenticated','settings.html','/settings.html','SETTINGS',false,true,'{}'::jsonb),
  ('notifications','/notifications.html','feature','notifications','authenticated','notifications.html','/notifications.html','NOTIFICATIONS',false,true,'{}'::jsonb),
  ('messages','/messages.html','feature','messages','authenticated','messages.html','/messages.html','MESSAGES',false,true,'{}'::jsonb),
  ('search','/search.html','feature','search','authenticated','search.html','/search.html','SEARCH',false,true,'{}'::jsonb),
  ('upload','/upload.html','feature','upload','authenticated','upload.html','/upload.html','UPLOAD',false,true,'{}'::jsonb),
  ('creator','/creator.html','page','creator','authenticated','creator.html','/creator.html','CREATOR',false,true,'{}'::jsonb),
  ('admin','/admin.html','page','admin','authenticated','admin.html','/admin.html','ADMIN',false,true,'{}'::jsonb),
  ('feed','/feed.html','page','feed','authenticated','feed.html','/feed.html','FEED',false,true,'{}'::jsonb),
  ('gallery','/gallery.html','page','gallery','authenticated','gallery.html','/gallery.html','GALLERY',false,true,'{}'::jsonb),
  ('live','/live.html','page','live','authenticated','live.html','/live.html','LIVE',false,true,'{}'::jsonb),
  ('watch','/watch.html','feature','live','authenticated','watch.html','/watch.html','WATCH',false,true,'{}'::jsonb),
  ('music','/music.html','page','music','authenticated','music.html','/music.html','MUSIC',false,true,'{}'::jsonb),
  ('sports','/sports.html','page','sports','authenticated','sports.html','/sports.html','SPORTS',false,true,'{}'::jsonb),
  ('store','/store.html','page','store','authenticated','store.html','/store.html','STORE',false,true,'{}'::jsonb),
  ('gaming','/gaming.html','page','gaming','authenticated','gaming.html','/gaming.html','GAMING',false,true,'{}'::jsonb),
  ('meta','/meta.html','page','meta','authenticated','meta.html','/meta.html','META',false,true,'{}'::jsonb),
  ('avatar','/avatar.html','feature','avatar','authenticated','avatar.html','/avatar.html','AVATAR',false,true,'{}'::jsonb)
on conflict (route_key) do update set
  route_path = excluded.route_path,
  page_type = excluded.page_type,
  section = excluded.section,
  auth_mode = excluded.auth_mode,
  canonical_file = excluded.canonical_file,
  rewrite_target = excluded.rewrite_target,
  nav_label = excluded.nav_label,
  is_enabled = true,
  updated_at = now();

delete from public.route_registry where route_key = 'edit' and route_path = '/features/edit.html';

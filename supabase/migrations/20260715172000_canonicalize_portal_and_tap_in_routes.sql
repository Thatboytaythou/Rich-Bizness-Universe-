update public.route_registry
set route_path = '/tap-in',
    rewrite_target = '/tap-in.html',
    canonical_file = 'apps/web/tap-in.html',
    auth_mode = 'guest_only',
    updated_at = now()
where route_key = 'tap_in';

update public.route_registry
set route_path = '/',
    rewrite_target = '/',
    canonical_file = 'apps/web/index.html',
    auth_mode = 'public',
    is_home = true,
    is_enabled = true,
    updated_at = now()
where route_key = 'portal';

delete from public.route_registry
where route_key in ('index','auth','portal_page')
   or route_path in ('/portal','/portal.html','/auth','/auth.html');

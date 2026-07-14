update public.route_registry
set canonical_file = 'index.html',
    rewrite_target = '/',
    is_home = true,
    is_enabled = true,
    updated_at = now()
where route_key = 'portal';

delete from public.route_registry
where route_key = 'portal_page'
   or route_path in ('/portal', '/portal.html');

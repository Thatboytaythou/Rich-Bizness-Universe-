update public.route_registry
set rewrite_target = '/rich-chess', updated_at = now()
where route_key = 'rich_chess';

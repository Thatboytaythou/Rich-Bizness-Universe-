update public.route_registry
set route_key='edit-profile', updated_at=now()
where route_key='edit_profile'
  and route_path='/edit-profile.html'
  and not exists (
    select 1
    from public.route_registry
    where route_key='edit-profile'
  );

create or replace function public.rb_profile_follow_action(p_target_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, extensions, auth, storage, pg_temp
as $$
  select public.rb_profile_toggle_follow(p_target_id);
$$;

revoke execute on function public.rb_profile_follow_action(uuid) from public, anon;
grant execute on function public.rb_profile_follow_action(uuid) to authenticated, service_role;

-- Live room membership requires a signed-in Rich ID.
revoke execute on function public.rb_live_join(uuid) from public, anon;
revoke execute on function public.rb_live_leave(uuid) from public, anon;
grant execute on function public.rb_live_join(uuid) to authenticated;
grant execute on function public.rb_live_leave(uuid) to authenticated;

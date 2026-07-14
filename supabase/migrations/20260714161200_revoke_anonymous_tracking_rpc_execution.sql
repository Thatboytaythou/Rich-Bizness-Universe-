revoke execute on function public.rb_feed_record_view(uuid, text) from anon;
revoke execute on function public.rb_profile_record_view(uuid, text, text) from anon;
revoke execute on function public.rb_profile_universe_snapshot(uuid) from anon;
revoke execute on function public.rb_store_record_view(uuid, text) from anon;

grant execute on function public.rb_feed_record_view(uuid, text) to authenticated;
grant execute on function public.rb_profile_record_view(uuid, text, text) to authenticated;
grant execute on function public.rb_profile_universe_snapshot(uuid) to authenticated;
grant execute on function public.rb_store_record_view(uuid, text) to authenticated;

revoke execute on function public.rb_avatar_set_item(text,boolean) from public, anon;
grant execute on function public.rb_avatar_set_item(text,boolean) to authenticated;

revoke execute on function public.rb_live_heartbeat(uuid) from public, anon;
grant execute on function public.rb_live_heartbeat(uuid) to authenticated;

revoke execute on function public.rb_profile_toggle_follow(uuid) from public, anon;
grant execute on function public.rb_profile_toggle_follow(uuid) to authenticated;

revoke execute on function public.rb_meta_universe_snapshot(uuid) from public, anon;
grant execute on function public.rb_meta_universe_snapshot(uuid) to authenticated;

revoke execute on function public.rb_portal_elite_snapshot() from public, anon;
grant execute on function public.rb_portal_elite_snapshot() to authenticated;

revoke execute on function public.rb_portal_universe_snapshot() from public, anon;
grant execute on function public.rb_portal_universe_snapshot() to authenticated;

revoke execute on function public.rb_media_universe_snapshot() from public, anon;
grant execute on function public.rb_media_universe_snapshot() to authenticated;

revoke execute on function public.rb_live_watch_podcast_snapshot() from public, anon;
grant execute on function public.rb_live_watch_podcast_snapshot() to authenticated;

revoke execute on function public.rb_reconcile_xp_identity(uuid) from public, anon;
grant execute on function public.rb_reconcile_xp_identity(uuid) to authenticated;

revoke execute on function public.rb_authorize_livekit_room(text) from public, anon;
grant execute on function public.rb_authorize_livekit_room(text) to authenticated;
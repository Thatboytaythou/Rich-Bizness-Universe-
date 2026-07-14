revoke all on function public.rb_register_upload(text,text,text,text,text,text,bigint,text,jsonb) from public, anon;
grant execute on function public.rb_register_upload(text,text,text,text,text,text,bigint,text,jsonb) to authenticated;
revoke all on function public.rb_create_direct_thread(uuid) from public, anon;
grant execute on function public.rb_create_direct_thread(uuid) to authenticated;
revoke all on function public.rb_authorize_livekit_room(text) from public, anon;
grant execute on function public.rb_authorize_livekit_room(text) to authenticated, service_role;
revoke all on function public.rb_touch_dm_thread() from public, anon, authenticated;
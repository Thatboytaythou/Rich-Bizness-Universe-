alter function public.rb_search_snapshot(text,text,integer) set search_path = public, extensions, auth, storage, pg_temp;
alter function public.rb_global_search(text,integer) set search_path = public, extensions, auth, storage, pg_temp;
notify pgrst, 'reload schema';

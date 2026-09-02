grant execute on function public.rb_search_snapshot(text,text,integer) to authenticated;
notify pgrst, 'reload schema';

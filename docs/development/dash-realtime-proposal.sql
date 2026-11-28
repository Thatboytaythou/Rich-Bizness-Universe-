-- Development only; apply after RLS review on isolated Supabase.
alter publication supabase_realtime add table public.rb_dash_listings, public.rb_dash_bookings, public.rb_dash_quotes;

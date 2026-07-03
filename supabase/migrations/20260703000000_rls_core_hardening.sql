-- Rich Bizness Universe core RLS hardening
-- Applied live in Supabase where accepted; kept here as source-of-truth.

alter table if exists public.rb_personality_settings enable row level security;

create policy if not exists rb_personality_settings_public_read_active
on public.rb_personality_settings
for select
using (is_active = true);

create policy if not exists rb_personality_settings_admin_all
on public.rb_personality_settings
for all
using (public.rb_is_admin(3))
with check (public.rb_is_admin(3));

create policy if not exists followers_read_policy
on public.followers
for select
using (true);

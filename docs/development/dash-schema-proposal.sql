-- Isolated development proposal only; no hosted deployment.
begin;
create table public.rb_dash_listings (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.rb_orgs(id),
 title text not null check(length(title) between 2 and 120),
 city text not null check(length(city) between 2 and 100),
 service text not null check(service in ('rides','food','packages','groceries','local','business','roadside','moving','errands')),
 price_mode text not null check(price_mode in ('fixed','estimate','quote')),
 price_cents integer check(price_cents between 0 and 10000000),
 online boolean not null default false,
 check(price_mode='quote' or price_cents is not null)
);
alter table public.rb_dash_listings enable row level security;
revoke all on public.rb_dash_listings from public,anon,authenticated;
grant select,insert,update on public.rb_dash_listings to authenticated;
create policy listing_read on public.rb_dash_listings for select to authenticated using (online or exists(select 1 from public.rb_orgs o where o.id=org_id and o.owner_id=auth.uid()));
create policy listing_create on public.rb_dash_listings for insert to authenticated with check (exists(select 1 from public.rb_orgs o where o.id=org_id and o.owner_id=auth.uid()) and coalesce(auth.jwt()->>'is_anonymous','false')='false');
create policy listing_update on public.rb_dash_listings for update to authenticated using (exists(select 1 from public.rb_orgs o where o.id=org_id and o.owner_id=auth.uid())) with check (exists(select 1 from public.rb_orgs o where o.id=org_id and o.owner_id=auth.uid()));
create index rb_dash_listing_search on public.rb_dash_listings(city,service) where online;
create table public.rb_dash_bookings (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.rb_dash_listings(id),
 customer_id uuid not null references auth.users(id),
 scheduled_at timestamptz,
 status text not null default 'requested' check(status in ('requested','accepted','completed','cancelled')),
 created_at timestamptz not null default now()
);
alter table public.rb_dash_bookings enable row level security;
revoke all on public.rb_dash_bookings from public,anon,authenticated;
grant select,insert on public.rb_dash_bookings to authenticated;
grant update(status) on public.rb_dash_bookings to authenticated;
create policy booking_read on public.rb_dash_bookings for select to authenticated using (customer_id=auth.uid() or exists(select 1 from public.rb_dash_listings l join public.rb_orgs o on o.id=l.org_id where l.id=listing_id and o.owner_id=auth.uid()));
create policy booking_create on public.rb_dash_bookings for insert to authenticated with check(customer_id=auth.uid() and status='requested' and coalesce(auth.jwt()->>'is_anonymous','false')='false' and (scheduled_at is null or scheduled_at>now()) and exists(select 1 from public.rb_dash_listings l where l.id=listing_id and l.online));
create policy booking_provider_transition on public.rb_dash_bookings for update to authenticated using(status in ('requested','accepted') and exists(select 1 from public.rb_dash_listings l join public.rb_orgs o on o.id=l.org_id where l.id=listing_id and o.owner_id=auth.uid())) with check(status in ('accepted','completed','cancelled') and exists(select 1 from public.rb_dash_listings l join public.rb_orgs o on o.id=l.org_id where l.id=listing_id and o.owner_id=auth.uid()));
create function public.rb_dash_transition_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not ((old.status='requested' and new.status in ('accepted','cancelled')) or (old.status='accepted' and new.status in ('completed','cancelled'))) then raise exception 'invalid transition' using errcode='23514'; end if;
 return new;
end $$;
create trigger rb_dash_transition before update on public.rb_dash_bookings for each row execute function public.rb_dash_transition_guard();
commit;

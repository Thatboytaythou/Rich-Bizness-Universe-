-- Development only. No payment processing or hosted migration.
begin;
create table public.rb_dash_quotes (
 booking_id uuid primary key references public.rb_dash_bookings(id),
 amount_cents integer not null check(amount_cents between 1 and 10000000),
 currency text not null default 'usd' check(currency='usd'),
 accepted boolean not null default false
);
alter table public.rb_dash_quotes enable row level security;
revoke all on public.rb_dash_quotes from public,anon,authenticated;
grant select,insert on public.rb_dash_quotes to authenticated;
grant update(accepted) on public.rb_dash_quotes to authenticated;
create policy quote_read on public.rb_dash_quotes for select to authenticated using (exists(select 1 from public.rb_dash_bookings b where b.id=booking_id));
create policy quote_provider_insert on public.rb_dash_quotes for insert to authenticated with check(not accepted and exists(select 1 from public.rb_dash_bookings b join public.rb_dash_listings l on l.id=b.listing_id join public.rb_orgs o on o.id=l.org_id where b.id=booking_id and b.status='requested' and o.owner_id=auth.uid() and (l.price_mode<>'fixed' or l.price_cents=amount_cents)));
create policy quote_customer_accept on public.rb_dash_quotes for update to authenticated using(not accepted and exists(select 1 from public.rb_dash_bookings b where b.id=booking_id and b.customer_id=auth.uid() and b.status='requested')) with check(accepted and exists(select 1 from public.rb_dash_bookings b where b.id=booking_id and b.customer_id=auth.uid() and b.status='requested'));
create or replace function public.rb_dash_transition_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not ((old.status='requested' and new.status in ('accepted','cancelled')) or (old.status='accepted' and new.status in ('completed','cancelled'))) then raise exception 'invalid transition' using errcode='23514'; end if;
 if new.status='accepted' and not exists(select 1 from public.rb_dash_quotes q where q.booking_id=old.id and q.accepted) then raise exception 'customer price agreement required' using errcode='23514'; end if;
 return new;
end $$;
commit;

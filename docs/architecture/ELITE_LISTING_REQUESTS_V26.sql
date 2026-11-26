create table public.elite_listing_requests (
 owner_id uuid primary key references public.elite_creator_designs(owner_id) on delete cascade,
 proposed_price_cents integer not null check (proposed_price_cents between 100 and 100000),
 currency text not null default 'usd' check (currency='usd'),
 submitted_at timestamptz not null default now()
);
alter table public.elite_listing_requests enable row level security;
revoke all on public.elite_listing_requests from anon,authenticated;
grant select,insert,update,delete on public.elite_listing_requests to authenticated;
create policy elite_request_read on public.elite_listing_requests for select to authenticated using (owner_id=(select auth.uid()));
create policy elite_request_insert on public.elite_listing_requests for insert to authenticated with check (owner_id=(select auth.uid()));
create policy elite_request_update on public.elite_listing_requests for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy elite_request_delete on public.elite_listing_requests for delete to authenticated using (owner_id=(select auth.uid()));
comment on table public.elite_listing_requests is 'Private mutable proposed USD price for an existing creator design. Never a checkout, product, entitlement, approval or earnings record.';
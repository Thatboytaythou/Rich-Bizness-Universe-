-- Development proposal only. Do not apply to production.
begin;
create table public.rb_orgs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 name text not null check (char_length(name) between 2 and 120),
 kind text not null check(kind in ('enterprise','corporation','franchise','cooperative','union','foundation','fundraiser','small-business','startup','local-business','independent')),
 created_at timestamptz not null default now()
);
alter table public.rb_orgs enable row level security;
revoke all on public.rb_orgs from public, anon, authenticated;
grant select,insert on public.rb_orgs to authenticated;
create policy org_owner_read on public.rb_orgs for select to authenticated using ((select auth.uid())=owner_id);
create policy org_owner_create on public.rb_orgs for insert to authenticated with check ((select auth.uid())=owner_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
create table public.rb_org_members (
 org_id uuid not null references public.rb_orgs(id),
 user_id uuid not null references auth.users(id),
 role text not null check(role in ('manager','employee','member')),
 primary key(org_id,user_id)
);
alter table public.rb_org_members enable row level security;
revoke all on public.rb_org_members from public, anon, authenticated;
grant select on public.rb_org_members to authenticated;
create policy org_member_self on public.rb_org_members for select to authenticated using ((select auth.uid())=user_id);
-- Membership writes intentionally unavailable until invitation/acceptance authorization is implemented.
commit;

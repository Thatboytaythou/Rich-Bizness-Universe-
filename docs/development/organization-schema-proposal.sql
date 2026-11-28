-- Development-only migration proposal. Never apply directly to the production project.
-- Rich ID UUIDs are already created by Supabase Auth. No user tokens in URLs.
begin;
create table public.rb_orgs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 name text not null check (char_length(name) between 2 and 120),
 kind text not null check(kind in ('enterprise','corporation','franchise','cooperative','union','foundation','fundraiser','small-business','startup','local-business','independent')),
 created_at timestamptz not null default now()
);
create index rb_orgs_owner_created on public.rb_orgs(owner_id,created_at desc);
alter table public.rb_orgs enable row level security;
revoke all on public.rb_orgs from public,anon,authenticated;
grant select,insert on public.rb_orgs to authenticated;
create policy rb_org_owner_read on public.rb_orgs for select to authenticated using ((select auth.uid())=owner_id);
create policy rb_org_owner_create on public.rb_orgs for insert to authenticated
 with check ((select auth.uid())=owner_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false');

create table public.rb_org_members (
 org_id uuid not null references public.rb_orgs(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 role text not null check(role in ('manager','employee','member')),
 joined_at timestamptz not null default now(),
 primary key(org_id,user_id)
);
create index rb_org_members_user on public.rb_org_members(user_id);
alter table public.rb_org_members enable row level security;
revoke all on public.rb_org_members from public,anon,authenticated;
grant select on public.rb_org_members to authenticated;
create policy rb_org_members_visibility on public.rb_org_members for select to authenticated
 using ((select auth.uid())=user_id or exists (
  select 1 from public.rb_orgs o where o.id=org_id and o.owner_id=(select auth.uid())
 ));

create table public.rb_org_invites (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.rb_orgs(id) on delete cascade,
 invited_user_id uuid not null references auth.users(id),
 invited_by uuid not null references auth.users(id),
 role text not null check(role in ('manager','employee','member')),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 answered_at timestamptz
);
create unique index rb_org_invite_one_pending on public.rb_org_invites(org_id,invited_user_id) where status='pending';
create index rb_org_invites_recipient on public.rb_org_invites(invited_user_id,status);
alter table public.rb_org_invites enable row level security;
revoke all on public.rb_org_invites from public,anon,authenticated;
grant select on public.rb_org_invites to authenticated;
create policy rb_org_invite_visible on public.rb_org_invites for select to authenticated
 using ((select auth.uid())=invited_user_id or exists (
  select 1 from public.rb_orgs o where o.id=org_id and o.owner_id=(select auth.uid())
 ));

-- RPC functions are the ONLY membership write interface.
create function public.rb_org_invite(p_org_id uuid,p_user_id uuid,p_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid;v_id uuid;
begin
 v_uid:=auth.uid();
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not exists(select 1 from public.rb_orgs where id=p_org_id and owner_id=v_uid)
   or p_user_id=v_uid or p_role not in ('manager','employee','member') then
   raise exception 'not_authorized' using errcode='42501';
 end if;
 insert into public.rb_org_invites(org_id,invited_user_id,invited_by,role)
 values(p_org_id,p_user_id,v_uid,p_role)
 on conflict (org_id,invited_user_id) where status='pending'
 do update set role=excluded.role
 returning id into v_id;
 return v_id;
end $$;
create function public.rb_org_respond(p_invite_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid;v_invite public.rb_org_invites%rowtype;
begin
 v_uid:=auth.uid();
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   raise exception 'not_authorized' using errcode='42501';
 end if;
 select * into v_invite from public.rb_org_invites
  where id=p_invite_id and invited_user_id=v_uid and status='pending' for update;
 if not found then raise exception 'invite_unavailable' using errcode='42501';end if;
 update public.rb_org_invites set status=case when p_accept then 'accepted' else 'declined' end,
 answered_at=now() where id=p_invite_id;
 if p_accept then
  insert into public.rb_org_members(org_id,user_id,role)
   values(v_invite.org_id,v_uid,v_invite.role)
   on conflict (org_id,user_id) do update set role=excluded.role;
 end if;
 return true;
end $$;
create function public.rb_org_remove_member(p_org_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid;
begin
 v_uid:=auth.uid();
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 or not exists(select 1 from public.rb_orgs where id=p_org_id and owner_id=v_uid)
 then raise exception 'not_authorized' using errcode='42501'; end if;
 delete from public.rb_org_members where org_id=p_org_id and user_id=p_user_id;
 return found;
end $$;
revoke all on function public.rb_org_invite(uuid,uuid,text) from public,anon;
revoke all on function public.rb_org_respond(uuid,boolean) from public,anon;
revoke all on function public.rb_org_remove_member(uuid,uuid) from public,anon;
grant execute on function public.rb_org_invite(uuid,uuid,text) to authenticated;
grant execute on function public.rb_org_respond(uuid,boolean) to authenticated;
grant execute on function public.rb_org_remove_member(uuid,uuid) to authenticated;
commit;

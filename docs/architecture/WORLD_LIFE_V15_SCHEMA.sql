create table public.rb_residence_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 lighting text not null default 'daylight' check(lighting in ('daylight','evening')),
 furnishing text not null default 'emerald' check(furnishing in ('emerald','onyx','cognac'))
);
alter table public.rb_residence_settings enable row level security;
revoke all on public.rb_residence_settings from public,anon,authenticated;
grant select,insert,update on public.rb_residence_settings to authenticated;
create policy residence_read on public.rb_residence_settings for select to authenticated using ((select auth.uid())=user_id);
create policy residence_create on public.rb_residence_settings for insert to authenticated with check ((select auth.uid())=user_id);
create policy residence_update on public.rb_residence_settings for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create table public.rb_world_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null,
 district text not null check(district in ('city','creative')),
 x real not null check(x between -6 and 6),
 y real not null check(y between 0 and 4),
 z real not null check(z between -79 and 6),
 yaw real not null check(yaw between -7 and 7),
 motion text not null check(motion in ('idle','walk','run','jump','power')),
 updated_at timestamptz not null default now()
);
alter table public.rb_world_presence enable row level security;
revoke all on public.rb_world_presence from public,anon,authenticated;
grant select,insert,update,delete on public.rb_world_presence to authenticated;
create policy presence_read on public.rb_world_presence for select to authenticated using (user_id=(select auth.uid()) or updated_at>now()-interval '25 seconds');
create policy presence_create on public.rb_world_presence for insert to authenticated with check(user_id=(select auth.uid()));
create policy presence_update on public.rb_world_presence for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy presence_delete on public.rb_world_presence for delete to authenticated using(user_id=(select auth.uid()));
create function public.rb_stamp_world_presence() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$begin new.updated_at=clock_timestamp();return new;end;$$;
revoke execute on function public.rb_stamp_world_presence() from public,anon,authenticated;
create trigger rb_stamp_presence before insert or update on public.rb_world_presence for each row execute function public.rb_stamp_world_presence();
create index rb_presence_district_updated on public.rb_world_presence(district,updated_at desc);
alter publication supabase_realtime add table public.rb_world_presence;
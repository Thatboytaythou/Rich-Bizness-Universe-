\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
grant usage on schema auth to authenticated,anon;
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
\ir ../docs/development/organization-schema-proposal.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.rb_orgs(id,owner_id,name,kind) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'Fixture business','local-business');
select public.rb_org_invite('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','employee');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin
 if exists(select 1 from public.rb_orgs) or exists(select 1 from public.rb_org_invites) then raise exception 'private rows leaked'; end if;
 begin perform public.rb_org_invite('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','manager'); raise exception 'unauthorized invite'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.rb_org_respond(id,true) from public.rb_org_invites where status='pending';
do $$begin if not exists(select 1 from public.rb_org_members where user_id=auth.uid() and role='employee') then raise exception 'membership missing'; end if; end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.rb_org_remove_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');
do $$begin if exists(select 1 from public.rb_org_members) then raise exception 'removal failed'; end if; end$$;
reset role;
set role anon;
do $$begin if has_function_privilege(current_user,'public.rb_org_invite(uuid,uuid,text)','execute') then raise exception 'anon execute leaked'; end if; end$$;
reset role;

\ir ../docs/development/dash-schema-proposal.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.rb_dash_listings(id,org_id,title,city,service,price_mode,price_cents,online) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fixture delivery','Fixture City','food','fixed',1000,true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
insert into public.rb_dash_bookings(id,listing_id,customer_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth.uid());
do $$begin update public.rb_dash_bookings set status='accepted'; if found then raise exception 'customer accepted own booking'; end if; end$$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin if exists(select 1 from public.rb_dash_bookings) then raise exception 'booking leaked'; end if; end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
update public.rb_dash_bookings set status='accepted' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.rb_dash_bookings set status='completed' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$begin if not exists(select 1 from public.rb_dash_bookings where status='completed') then raise exception 'provider completion failed'; end if; end$$;
reset role;

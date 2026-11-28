-- Fixture-only Storage metadata and DM tables; no object service, secrets or live records.
reset role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;
-- Reproduce the broad legacy policies to prove restrictive guards actually work.
create policy fixture_broad on storage.objects for all to authenticated using(true) with check(true);
create policy fixture_public on storage.objects for select to anon using(true);
create table public.dm_threads(id uuid primary key,last_message text,last_message_at timestamptz,last_message_user_id uuid,updated_at timestamptz);
create table public.dm_thread_members(thread_id uuid references public.dm_threads,user_id uuid references auth.users,status text,primary key(thread_id,user_id));
create table public.dm_call_sessions(id uuid primary key,thread_id uuid references public.dm_threads,started_by uuid,call_type text,call_status text,livekit_room_name text,ended_at timestamptz);
create table public.dm_call_participants(call_id uuid references public.dm_call_sessions,user_id uuid,status text,primary key(call_id,user_id));
grant select,insert,update,delete on public.dm_thread_members,public.dm_call_sessions,public.dm_call_participants to authenticated;
create table public.dm_messages(id uuid primary key default gen_random_uuid(),thread_id uuid references public.dm_threads,sender_id uuid,body text,message_type text,metadata jsonb,is_deleted boolean default false);
create function public.rb_dm_finalize_attachment(uuid,text,text,text,bigint,text) returns uuid language sql as $$select gen_random_uuid()$$;
insert into public.dm_threads(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.dm_thread_members values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','active'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','active');
\ir ../docs/development/rich-dm-private-storage-proposal.sql
insert into public.dm_call_sessions values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','audio','ringing','rich-call-fixture',null);
insert into public.dm_call_participants values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','joined'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','invited');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if public.rb_dm_authorize_call_v2('dddddddd-dddd-4ddd-8ddd-dddddddddddd') is not null then raise exception 'unreviewed call authorized';end if;
 if has_table_privilege(current_user,'public.dm_thread_members','INSERT') or has_table_privilege(current_user,'public.dm_call_participants','INSERT') or has_table_privilege(current_user,'public.dm_call_sessions','UPDATE') then raise exception 'direct membership or call mutation allowed';end if;
 if public.rb_dm_private_storage_ready_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'unreviewed membership trusted';end if;
end$$;
reset role;
insert into rb_dm_private.trusted_threads(thread_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into rb_dm_private.trusted_calls(call_id) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
set role authenticated;
do $$begin if not public.rb_dm_private_storage_ready_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'verified private storage unavailable';end if;if coalesce(public.rb_dm_authorize_call_v2('dddddddd-dddd-4ddd-8ddd-dddddddddddd')->>'role','')<>'host' then raise exception 'verified call denied';end if;if jsonb_array_length(public.rb_dm_list_verified_calls_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))<>1 then raise exception 'verified call list missing';end if;end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into storage.objects(bucket_id,name,owner_id,metadata) values('rich-dm-private','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth.uid()::text,'{"size":1024,"mimetype":"image/png"}');
do $$begin
 if exists(select 1 from storage.objects where bucket_id='rich-dm-private') then raise exception 'unfinished attachment readable';end if;
 if has_function_privilege(current_user,'public.rb_dm_finalize_attachment(uuid,text,text,text,bigint,text)','execute') then raise exception 'legacy finalize remains callable';end if;
 begin insert into storage.objects(bucket_id,name,owner_id) values('rich-dm-private','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc',auth.uid()::text);raise exception 'spoofed upload accepted';exception when insufficient_privilege then null;end;
end$$;
select public.rb_dm_finalize_private_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fixture.png');
select public.rb_dm_finalize_private_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fixture.png');
do $$begin
 if (select count(*) from public.rb_dm_private_assets)<>1 then raise exception 'duplicate finalization';end if;
 update storage.objects set name='changed' where bucket_id='rich-dm-private';if found then raise exception 'private object replaced';end if;
 delete from storage.objects where bucket_id='rich-dm-private';if found then raise exception 'private object deleted';end if;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin if (select count(*) from storage.objects where bucket_id='rich-dm-private')<>1 then raise exception 'active recipient cannot read';end if;end$$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin if exists(select 1 from storage.objects where bucket_id='rich-dm-private') or exists(select 1 from public.rb_dm_private_assets) then raise exception 'outsider read';end if;end$$;
reset role;
set role anon;
do $$begin if exists(select 1 from storage.objects where bucket_id='rich-dm-private') then raise exception 'anonymous read';end if;end$$;
reset role;
update public.dm_thread_members set status='left' where user_id='22222222-2222-4222-8222-222222222222';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin if exists(select 1 from storage.objects where bucket_id='rich-dm-private') then raise exception 'removed member read';end if; if public.rb_dm_authorize_call_v2('dddddddd-dddd-4ddd-8ddd-dddddddddddd') is not null then raise exception 'removed member call access';end if;end$$;
reset role;
\echo Rich-DM private attachment policy fixture passed

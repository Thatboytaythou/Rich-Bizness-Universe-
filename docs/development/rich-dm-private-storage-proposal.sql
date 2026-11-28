-- DEVELOPMENT PROPOSAL ONLY. Apply in an isolated Supabase environment after review.
-- Do not move, delete or expose legacy general-uploads objects automatically.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rich-dm-private','rich-dm-private',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;
do $$begin
 if not exists(select 1 from storage.buckets where id='rich-dm-private' and public=false and file_size_limit=26214400) then
   raise exception 'private DM bucket configuration mismatch';
 end if;
end$$;

-- New objects use <thread UUID>/<uploader UUID>/<random UUID>. No URL is persisted.
create table public.rb_dm_private_assets(
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.dm_threads(id),
 message_id uuid not null unique references public.dm_messages(id),
 uploader_id uuid not null references auth.users(id),
 object_path text not null unique,
 file_name text not null,
 mime_type text not null,
 file_size bigint not null check(file_size between 1 and 26214400),
 created_at timestamptz not null default now()
);
alter table public.rb_dm_private_assets enable row level security;
revoke all on public.rb_dm_private_assets from public,anon,authenticated;
grant select on public.rb_dm_private_assets to authenticated;

create schema if not exists rb_dm_private;
revoke all on schema rb_dm_private from public,anon;
grant usage on schema rb_dm_private to authenticated;
create function rb_dm_private.member(p_thread text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false')='false' and exists(
 select 1 from public.dm_thread_members m where m.thread_id::text=p_thread and m.user_id=auth.uid() and m.status='active')
$$;
revoke all on function rb_dm_private.member(text) from public,anon;
grant execute on function rb_dm_private.member(text) to authenticated;
create policy rb_dm_private_asset_member_read on public.rb_dm_private_assets for select to authenticated
using (rb_dm_private.member(thread_id::text));

create function rb_dm_private.can_upload(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'
 and split_part(p_path,'/',2)=auth.uid()::text
 and rb_dm_private.member(split_part(p_path,'/',1))
$$;
create function rb_dm_private.can_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.rb_dm_private_assets a join public.dm_messages m on m.id=a.message_id
 where a.object_path=p_path and m.thread_id=a.thread_id and coalesce(m.is_deleted,false)=false and rb_dm_private.member(a.thread_id::text))
$$;
revoke all on function rb_dm_private.can_upload(text),rb_dm_private.can_read(text) from public,anon;
grant execute on function rb_dm_private.can_upload(text),rb_dm_private.can_read(text) to authenticated;
-- Permissive grants plus restrictive guards prevent existing broad storage policies
-- from bypassing this bucket's membership checks. Anonymous has no grant.
create policy rb_dm_private_upload on storage.objects for insert to authenticated
with check(bucket_id='rich-dm-private' and rb_dm_private.can_upload(name) and owner_id=auth.uid()::text);
create policy rb_dm_private_read on storage.objects for select to authenticated
using(bucket_id='rich-dm-private' and rb_dm_private.can_read(name));
create policy rb_dm_private_read_guard on storage.objects as restrictive for select to authenticated
using(bucket_id<>'rich-dm-private' or rb_dm_private.can_read(name));
create policy rb_dm_private_upload_guard on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'rich-dm-private' or (rb_dm_private.can_upload(name) and owner_id=auth.uid()::text));
create policy rb_dm_private_anon_guard on storage.objects as restrictive for all to anon
using(bucket_id<>'rich-dm-private') with check(bucket_id<>'rich-dm-private');
create policy rb_dm_private_no_replace on storage.objects as restrictive for update to authenticated
using(bucket_id<>'rich-dm-private') with check(bucket_id<>'rich-dm-private');
create policy rb_dm_private_no_delete on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'rich-dm-private');

-- Finalize only an uploaded, caller-owned object. Verify metadata from Storage, not caller size/URL.
create function public.rb_dm_finalize_private_asset(p_thread_id uuid,p_object_path text,p_file_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_size bigint; v_mime text; v_name text;
begin
 if not coalesce(rb_dm_private.can_upload(p_object_path),false) or split_part(p_object_path,'/',1)<>p_thread_id::text then
  raise exception 'not_authorized' using errcode='42501';
 end if;
 perform 1 from public.dm_thread_members where thread_id=p_thread_id and user_id=v_user and status='active' for update;
 if not found then raise exception 'not_authorized' using errcode='42501'; end if;
 select case when metadata->>'size' ~ '^[0-9]{1,10}$' then (metadata->>'size')::bigint else 0 end,metadata->>'mimetype'
 into v_size,v_mime from storage.objects where bucket_id='rich-dm-private' and name=p_object_path and owner_id=v_user::text for update;
 if not found or v_size is null or v_size not between 1 and 26214400 or v_mime is null or v_mime not in
 ('image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') then
  raise exception 'invalid_private_object' using errcode='22023';
 end if;
 select message_id into v_id from public.rb_dm_private_assets where object_path=p_object_path and uploader_id=v_user;
 if found then return v_id; end if;
 v_name:=left(coalesce(nullif(btrim(p_file_name),''),'Attachment'),255);
 insert into public.dm_messages(thread_id,sender_id,body,message_type,metadata)
 values(p_thread_id,v_user,v_name,'file',jsonb_build_object('source','rich-dm-private')) returning id into v_id;
 insert into public.rb_dm_private_assets(thread_id,message_id,uploader_id,object_path,file_name,mime_type,file_size)
 values(p_thread_id,v_id,v_user,p_object_path,v_name,v_mime,v_size);
 update public.dm_threads set last_message='Private attachment',last_message_at=now(),last_message_user_id=v_user,updated_at=now() where id=p_thread_id;
 return v_id;
end$$;
revoke all on function public.rb_dm_finalize_private_asset(uuid,text,text) from public,anon;
grant execute on function public.rb_dm_finalize_private_asset(uuid,text,text) to authenticated;
-- Disable the legacy caller-supplied public URL path only when this proposal is actually approved/applied.
revoke execute on function public.rb_dm_finalize_attachment(uuid,text,text,text,bigint,text) from public,anon,authenticated;
commit;

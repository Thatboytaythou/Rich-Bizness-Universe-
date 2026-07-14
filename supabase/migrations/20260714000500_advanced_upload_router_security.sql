create index if not exists uploads_user_created_idx on public.uploads(user_id, created_at desc);
create index if not exists uploads_section_created_idx on public.uploads(section, created_at desc);
create index if not exists upload_processing_queue_status_idx on public.upload_processing_queue(status, created_at);

alter table public.uploads enable row level security;
alter table public.upload_processing_queue enable row level security;
alter table public.storage_bucket_routes enable row level security;

drop policy if exists uploads_owner_read on public.uploads;
create policy uploads_owner_read on public.uploads for select to authenticated using (user_id = auth.uid());
drop policy if exists uploads_owner_insert on public.uploads;
create policy uploads_owner_insert on public.uploads for insert to authenticated with check (user_id = auth.uid());
drop policy if exists uploads_owner_update on public.uploads;
create policy uploads_owner_update on public.uploads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists upload_queue_owner_read on public.upload_processing_queue;
create policy upload_queue_owner_read on public.upload_processing_queue for select to authenticated using (user_id = auth.uid());
drop policy if exists upload_queue_owner_insert on public.upload_processing_queue;
create policy upload_queue_owner_insert on public.upload_processing_queue for insert to authenticated with check (user_id = auth.uid());

drop policy if exists storage_routes_authenticated_read on public.storage_bucket_routes;
create policy storage_routes_authenticated_read on public.storage_bucket_routes for select to authenticated using (true);

create or replace function public.rb_register_upload(
  p_route_key text,
  p_title text,
  p_description text,
  p_file_path text,
  p_public_url text,
  p_mime_type text,
  p_file_size bigint,
  p_visibility text default 'public',
  p_metadata jsonb default '{}'::jsonb
) returns public.uploads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_route public.storage_bucket_routes%rowtype;
  v_upload public.uploads%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_route from public.storage_bucket_routes where route_key = p_route_key limit 1;
  if v_route.id is null then raise exception 'Unknown upload route'; end if;
  if p_file_size > coalesce(v_route.max_file_size_mb, 300) * 1024 * 1024 then raise exception 'File exceeds route limit'; end if;
  if p_visibility not in ('public','followers','private','unlisted') then raise exception 'Invalid visibility'; end if;
  insert into public.uploads(user_id,category,section,title,description,bucket,file_path,public_url,mime_type,file_size,media_type,visibility,processing_status,metadata)
  values(v_user,p_route_key,v_route.section,nullif(trim(p_title),''),nullif(trim(p_description),''),v_route.bucket,p_file_path,p_public_url,p_mime_type,p_file_size,
    case when p_mime_type like 'image/%' then 'image' when p_mime_type like 'video/%' then 'video' when p_mime_type like 'audio/%' then 'audio' else coalesce(v_route.media_type,'file') end,
    p_visibility,case when coalesce(v_route.processing_type,'metadata')='metadata' then 'completed' else 'queued' end,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('route_key',p_route_key,'target_table',v_route.target_table,'target_column',v_route.target_column,'processing_type',v_route.processing_type))
  returning * into v_upload;
  if coalesce(v_route.processing_type,'metadata') <> 'metadata' then
    insert into public.upload_processing_queue(upload_id,user_id,bucket,file_path,public_url,processing_type,status,metadata)
    values(v_upload.id,v_user,v_route.bucket,p_file_path,p_public_url,v_route.processing_type,'queued',jsonb_build_object('route_key',p_route_key));
  end if;
  return v_upload;
end;
$$;
grant execute on function public.rb_register_upload(text,text,text,text,text,text,bigint,text,jsonb) to authenticated;
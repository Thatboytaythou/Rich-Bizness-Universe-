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
)
returns public.uploads
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_route public.storage_bucket_routes%rowtype;
  v_upload public.uploads%rowtype;
  v_detected text;
  v_expected_prefix text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_route from public.storage_bucket_routes where route_key = p_route_key limit 1;
  if v_route.id is null then raise exception 'Unknown upload route'; end if;
  if p_file_size is null or p_file_size <= 0 then raise exception 'Invalid file size'; end if;
  if p_file_size > coalesce(v_route.max_file_size_mb,300) * 1024 * 1024 then raise exception 'File exceeds route limit'; end if;
  if p_visibility not in ('public','followers','private','unlisted') then raise exception 'Invalid visibility'; end if;

  v_expected_prefix := v_user::text || '/' || p_route_key || '/';
  if p_file_path is null or p_file_path not like v_expected_prefix or p_file_path like '%..%' then raise exception 'Invalid upload path'; end if;

  v_detected := case
    when coalesce(p_mime_type,'') like 'image/%' then 'image'
    when coalesce(p_mime_type,'') like 'video/%' then 'video'
    when coalesce(p_mime_type,'') like 'audio/%' then 'audio'
    else 'file'
  end;

  if v_route.media_type in ('image','video','audio','file') and v_detected <> v_route.media_type then raise exception 'File type does not match upload destination'; end if;
  if v_route.media_type = 'model' and lower(coalesce(p_mime_type,'')) not in ('model/gltf-binary','model/gltf+json','application/octet-stream','application/json') then raise exception 'Avatar model must be GLB or GLTF'; end if;

  if coalesce(v_route.is_public,true) then
    if p_public_url is null or p_public_url not like 'http%' then raise exception 'Public upload URL required'; end if;
  else
    if p_public_url <> 'private://' || v_route.bucket || '/' || p_file_path then raise exception 'Invalid private upload reference'; end if;
  end if;

  insert into public.uploads(user_id,category,section,title,description,bucket,file_path,public_url,mime_type,file_size,media_type,visibility,processing_status,metadata)
  values(v_user,p_route_key,v_route.section,nullif(trim(p_title),''),nullif(trim(p_description),''),v_route.bucket,p_file_path,p_public_url,p_mime_type,p_file_size,
    case when v_route.media_type='model' then 'model' else v_detected end,
    p_visibility,case when coalesce(v_route.processing_type,'metadata')='metadata' then 'completed' else 'queued' end,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('route_key',p_route_key,'target_table',v_route.target_table,'target_column',v_route.target_column,'processing_type',v_route.processing_type,'validated',true))
  returning * into v_upload;

  if coalesce(v_route.processing_type,'metadata') <> 'metadata' then
    insert into public.upload_processing_queue(upload_id,user_id,bucket,file_path,public_url,processing_type,status,metadata)
    values(v_upload.id,v_user,v_route.bucket,p_file_path,p_public_url,v_route.processing_type,'queued',jsonb_build_object('route_key',p_route_key));
  end if;

  if p_route_key='profile-avatar' then
    update public.profiles set avatar_url=p_public_url,has_avatar=true,updated_at=now() where id=v_user;
    insert into public.meta_avatars(user_id,display_name,avatar_url,is_active,metadata)
    select p.id,p.display_name,p_public_url,true,jsonb_build_object('source','upload-studio','upload_id',v_upload.id)
    from public.profiles p where p.id=v_user
    on conflict(user_id) do update set avatar_url=excluded.avatar_url,is_active=true,metadata=coalesce(public.meta_avatars.metadata,'{}'::jsonb)||excluded.metadata,updated_at=now();
  elsif p_route_key='profile-banner' then
    update public.profiles set banner_url=p_public_url,updated_at=now() where id=v_user;
  end if;

  return v_upload;
end;
$$;

revoke execute on function public.rb_register_upload(text,text,text,text,text,text,bigint,text,jsonb) from public, anon;
grant execute on function public.rb_register_upload(text,text,text,text,text,text,bigint,text,jsonb) to authenticated;

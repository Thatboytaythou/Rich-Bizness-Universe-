update public.storage_bucket_routes
set is_active=false,
    updated_at=now()
where route_key in ('game-assets','game-covers','sports-covers')
  and is_active=true;

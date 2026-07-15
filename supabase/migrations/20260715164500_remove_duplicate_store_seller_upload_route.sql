delete from public.storage_bucket_routes
where route_key = 'store-seller-media'
  and exists (
    select 1
    from public.storage_bucket_routes canonical
    where canonical.route_key = 'store-seller'
      and canonical.section = storage_bucket_routes.section
      and canonical.bucket = storage_bucket_routes.bucket
      and canonical.target_table is not distinct from storage_bucket_routes.target_table
      and canonical.target_column is not distinct from storage_bucket_routes.target_column
      and canonical.media_type is not distinct from storage_bucket_routes.media_type
      and canonical.processing_type is not distinct from storage_bucket_routes.processing_type
  );

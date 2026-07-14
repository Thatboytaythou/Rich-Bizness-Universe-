revoke execute on function public.rb_avatar_set_item(text,boolean) from anon;
revoke execute on function public.rb_live_heartbeat(uuid) from anon;
revoke execute on function public.rb_profile_toggle_follow(uuid) from anon;
revoke execute on function public.rb_meta_universe_snapshot(uuid) from anon;
revoke execute on function public.rb_portal_elite_snapshot() from anon;
revoke execute on function public.rb_portal_universe_snapshot() from anon;
revoke execute on function public.rb_media_universe_snapshot() from anon;
revoke execute on function public.rb_live_watch_podcast_snapshot() from anon;

create index if not exists watch_comments_user_id_idx on public.watch_comments(user_id);

drop policy if exists product_likes_owner_insert on public.product_likes;
drop policy if exists storage_routes_authenticated_read on public.storage_bucket_routes;
drop policy if exists store_cart_owner_all on public.store_cart_items;
drop policy if exists store_comments_owner_insert on public.store_comments;
drop policy if exists store_orders_buyer_read on public.store_orders;
drop policy if exists upload_queue_owner_read on public.upload_processing_queue;
drop policy if exists uploads_owner_insert on public.uploads;

alter policy uploads_owner_update on public.uploads using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
alter policy profile_view_events_owner_read on public.profile_view_events using (profile_id=(select auth.uid()) or viewer_id=(select auth.uid()));
alter policy watch_progress_owner_all on public.watch_progress using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
alter policy watch_likes_owner_all on public.watch_likes using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
alter policy watch_comments_owner_delete on public.watch_comments using (user_id=(select auth.uid()));
alter policy watch_comments_owner_insert on public.watch_comments with check (user_id=(select auth.uid()));
alter policy watch_comments_owner_update on public.watch_comments using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
alter policy watchlist_owner_all on public.watchlist_items using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
alter policy upload_queue_owner_insert on public.upload_processing_queue with check (user_id=(select auth.uid()));
alter policy uploads_owner_read on public.uploads using (user_id=(select auth.uid()));

drop index if exists public.live_categories_slug_unique;
drop index if exists public.dm_message_reactions_unique;
drop index if exists public.dm_message_reads_unique;
drop index if exists public.dm_typing_status_unique;
drop index if exists public.meta_room_members_room_user_uidx;
drop index if exists public.meta_world_likes_world_user_uidx;
drop index if exists public.product_likes_user_product_uidx;
drop index if exists public.store_cart_user_product_uidx;
drop index if exists public.idx_rich_notifications_user_created_at;
drop index if exists public.store_orders_buyer_recent_idx;
drop index if exists public.idx_uploads_user_created_at;
drop index if exists public.idx_watch_progress_user_recent;
drop index if exists public.idx_podcast_episodes_published_featured;
drop index if exists public.meta_stream_links_world_status_idx;
drop index if exists public.meta_visits_world_recent_idx;
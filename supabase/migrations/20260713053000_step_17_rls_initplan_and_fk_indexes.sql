-- Step 17 production migration.
-- Optimizes high-traffic policy auth checks and covers reported foreign keys.

alter policy feed_posts_auth_insert on public.feed_posts
  with check ((select auth.uid()) = user_id);
alter policy feed_posts_owner_update on public.feed_posts
  using ((select auth.uid()) = user_id);
alter policy feed_posts_owner_delete on public.feed_posts
  using ((select auth.uid()) = user_id);

alter policy uploads_auth_insert on public.uploads
  with check ((select auth.uid()) = user_id);
alter policy uploads_owner_update on public.uploads
  using ((select auth.uid()) = user_id);
alter policy uploads_owner_delete on public.uploads
  using ((select auth.uid()) = user_id);

alter policy music_tracks_auth_insert on public.music_tracks
  with check ((select auth.uid()) = user_id);
alter policy music_tracks_owner_update on public.music_tracks
  using ((select auth.uid()) = user_id);
alter policy music_tracks_owner_delete on public.music_tracks
  using ((select auth.uid()) = user_id);

alter policy game_scores_auth_insert on public.game_scores
  with check (((select auth.uid()) = user_id) or user_id is null);
alter policy game_scores_owner_update on public.game_scores
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy live_streams_insert_own on public.live_streams
  with check (creator_id = (select auth.uid()));
alter policy live_streams_update_own on public.live_streams
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));
alter policy live_streams_owner_delete on public.live_streams
  using ((select auth.uid()) = creator_id);

alter policy meta_worlds_owner_insert on public.meta_worlds
  with check ((select auth.uid()) = owner_id);
alter policy meta_worlds_owner_update on public.meta_worlds
  using ((select auth.uid()) = owner_id);

alter policy sports_posts_auth_insert on public.sports_posts
  with check ((select auth.uid()) = user_id);
alter policy sports_posts_owner_update on public.sports_posts
  using ((select auth.uid()) = user_id);
alter policy sports_posts_owner_delete on public.sports_posts
  using ((select auth.uid()) = user_id);

alter policy product_likes_auth_insert on public.product_likes
  with check ((select auth.uid()) = user_id);
alter policy product_likes_owner_delete on public.product_likes
  using ((select auth.uid()) = user_id);

alter policy dm_message_reactions_auth_insert on public.dm_message_reactions
  with check ((select auth.uid()) = user_id);
alter policy dm_message_reactions_owner_delete on public.dm_message_reactions
  using ((select auth.uid()) = user_id);

drop policy if exists rb_personality_settings_admin_all on public.rb_personality_settings;
drop policy if exists rb_personality_settings_public_read_active on public.rb_personality_settings;

create policy rb_personality_settings_read
on public.rb_personality_settings
for select to public
using (is_active = true or (select public.rb_is_admin(3)));

create policy rb_personality_settings_admin_insert
on public.rb_personality_settings
for insert to authenticated
with check ((select public.rb_is_admin(3)));

create policy rb_personality_settings_admin_update
on public.rb_personality_settings
for update to authenticated
using ((select public.rb_is_admin(3)))
with check ((select public.rb_is_admin(3)));

create policy rb_personality_settings_admin_delete
on public.rb_personality_settings
for delete to authenticated
using ((select public.rb_is_admin(3)));

create index if not exists game_comments_game_id_fk_idx on public.game_comments(game_id);
create index if not exists game_comments_clip_id_fk_idx on public.game_comments(clip_id);
create index if not exists game_comments_user_id_fk_idx on public.game_comments(user_id);
create index if not exists game_likes_user_id_fk_idx on public.game_likes(user_id);
create index if not exists game_moves_user_id_fk_idx on public.game_moves(user_id);
create index if not exists game_room_members_user_id_fk_idx on public.game_room_members(user_id);
create index if not exists game_rooms_host_user_id_fk_idx on public.game_rooms(host_user_id);
create index if not exists live_chat_messages_user_id_fk_idx on public.live_chat_messages(user_id);
create index if not exists live_reactions_user_id_fk_idx on public.live_reactions(user_id);
create index if not exists live_recordings_user_id_fk_idx on public.live_recordings(user_id);
create index if not exists meta_chat_messages_world_id_fk_idx on public.meta_chat_messages(world_id);
create index if not exists meta_chat_messages_user_id_fk_idx on public.meta_chat_messages(user_id);
create index if not exists meta_room_members_user_id_fk_idx on public.meta_room_members(user_id);
create index if not exists meta_world_likes_user_id_fk_idx on public.meta_world_likes(user_id);
create index if not exists music_comments_user_id_fk_idx on public.music_comments(user_id);
create index if not exists music_likes_user_id_fk_idx on public.music_likes(user_id);
create index if not exists podcast_comments_user_id_fk_idx on public.podcast_comments(user_id);
create index if not exists podcast_likes_user_id_fk_idx on public.podcast_likes(user_id);
create index if not exists radio_likes_user_id_fk_idx on public.radio_likes(user_id);
create index if not exists sports_comments_user_id_fk_idx on public.sports_comments(user_id);
create index if not exists sports_reactions_user_id_fk_idx on public.sports_reactions(user_id);
create index if not exists rich_notifications_group_id_fk_idx on public.rich_notifications(group_id);
create index if not exists user_badges_badge_id_fk_idx on public.user_badges(badge_id);
create index if not exists user_product_unlocks_product_id_fk_idx on public.user_product_unlocks(product_id);
create index if not exists user_product_unlocks_order_id_fk_idx on public.user_product_unlocks(order_id);

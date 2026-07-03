# Rich Bizness Universe Structure Map

## Core idea
Index is the portal. Profile is the wallet and identity dashboard. Avatar is the body. Meta is movement. Watch is the hologram TV. Live is broadcasting. Games is action. XP flows from action systems back into profile.

## Identity spine
profiles is the root user record linked to auth users. Everything points back to profiles.id.

Identity tables:
- profiles
- user_settings
- profile_theme_settings
- user_levels
- user_xp_ledger
- xp_events
- rank_rules
- badges
- user_badges
- followers

Profile expands into:
- meta_avatars
- gamer_profiles
- sports_profiles
- store_seller_profiles
- creator_page_settings
- creator_available_balances

## XP map
Index, profile, and avatar display XP only. They should not award XP just for opening.

XP should come from action systems:
- feed_post
- upload_drop
- music_play
- podcast_play
- radio_listen
- live_watch
- live_chat
- store_action
- game_room_join
- game_move
- game_score_submit
- sports_pick
- meta_enter
- message_send
- creator_open

XP writes to:
- user_xp_ledger for history
- user_levels for totals
- profiles for display mirror
- meta_avatars for avatar mirror when needed

## Live and Watch
Live tables:
- live_streams
- live_stream_members
- live_chat_messages
- live_reactions
- live_stream_bans
- live_stream_purchases
- live_tips
- live_view_sessions
- vip_live_access
- live_stream_cards
- live_recordings
- live_alert_subscriptions
- livekit_room_events

Watch screen:
- /watch.html is the hologram TV
- reads live_streams
- shows room names
- plays recording_url, stream_url, or embed URLs when present
- logs live_view_sessions
- awards live_watch only from actual watch action

## Games
Game tables:
- game_categories
- games
- gamer_profiles
- game_sessions
- game_scores
- game_clips
- game_likes
- game_comments
- game_challenges
- game_tournaments
- tournament_players
- game_rewards
- game_stream_links
- game_platform_accounts
- game_rooms
- game_room_members
- game_moves
- gaming_uploads

Gaming page:
- /gaming.html is the game hub
- game-room.js adds join room and play move
- game actions write game_sessions
- game actions award game XP
- game streams connect to live and watch TV

## Meta and avatar free roam
Meta tables:
- meta_avatars
- meta_worlds
- meta_portals
- meta_visits
- meta_rooms
- meta_room_members
- meta_chat_messages
- meta_world_likes
- meta_items
- meta_inventory
- meta_stream_links

Free roam:
- /meta.html runs meta-free-roam.js
- avatar moves around a portal world
- position syncs into meta_avatars.position
- portals connect to live, games, store, music, gallery

## Music, podcast, radio
Music:
- music_tracks
- music_likes
- music_comments
- playlists
- playlist_tracks
- music_play_events

Podcast:
- podcast_shows
- podcast_episodes
- podcast_likes
- podcast_comments

Radio:
- radio_stations
- radio_sessions
- radio_likes

## Feed, gallery, upload
Feed/social:
- feed_posts
- feed_comments
- feed_post_likes
- feed_post_views
- followers

Uploads:
- uploads
- upload_processing_queue
- storage_bucket_routes

## Store
Store tables:
- store_seller_profiles
- products
- product_likes
- product_views
- store_cart_items
- store_orders
- store_comments
- store_notifications
- user_product_unlocks
- creator_available_balances
- stripe_sync_events

## Sports
Sports tables:
- sports_profiles
- sports_leagues
- sports_teams
- sports_posts
- sports_uploads
- sports_picks
- sports_pick_results
- sports_brackets
- sports_broadcasts
- sports_comments
- sports_reactions
- sports_alert_subscriptions

## Messages and calls
DM tables:
- dm_threads
- dm_thread_members
- dm_messages
- dm_message_attachments
- dm_message_reactions
- dm_message_reads
- dm_typing_status
- dm_call_sessions
- dm_call_participants

## Notifications
Notification tables:
- notification_groups
- rich_notifications
- notification_reads
- push_devices
- live_alert_subscriptions
- creator_alert_subscriptions
- sports_alert_subscriptions
- game_alert_subscriptions
- store_notifications

## Admin and operations
Ops tables:
- admin_roles
- admin_audit_logs
- moderation_reports
- content_review_queue
- platform_announcements
- feature_flags
- api_webhook_events
- api_jobs
- api_request_logs
- platform_analytics_events
- user_sessions
- trust_events
- system_health_checks

## Storage buckets
- avatars
- profile-banners
- meta-avatars
- gallery-media
- general-uploads
- music-audio
- music-covers
- podcast-audio
- podcast-covers
- radio-covers
- live-thumbnails
- live-recordings
- game-assets
- game-clips
- game-covers
- sports-media
- sports-clips
- sports-covers
- store-products
- store-digital
- store-seller-media

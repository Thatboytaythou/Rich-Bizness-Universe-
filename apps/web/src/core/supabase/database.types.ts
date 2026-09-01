export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row = Record<string, any>;
type Table = { Row: Row; Insert: Row; Update: Row; Relationships: [] };
type Fn = { Args: Record<string, any>; Returns: any };

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: Table; admin_roles: Table; api_jobs: Table; api_request_logs: Table; api_webhook_events: Table;
      app_env_contract: Table; app_runtime_modules: Table; audio_listening_history: Table;
      avatar_animation_clips: Table; avatar_character_presets: Table; avatar_controller_profiles: Table; avatar_inventory: Table; avatar_items: Table; avatar_models: Table; avatar_motion_state: Table;
      background_presets: Table; badges: Table; brand_assets: Table;
      content_review_queue: Table; creator_alert_subscriptions: Table; creator_available_balances: Table; creator_dimension_access: Table; creator_page_settings: Table;
      dm_call_participants: Table; dm_call_sessions: Table; dm_message_attachments: Table; dm_message_reactions: Table; dm_message_reads: Table; dm_messages: Table; dm_thread_members: Table; dm_threads: Table; dm_typing_status: Table;
      feature_flags: Table; feed_comments: Table; feed_post_likes: Table; feed_post_saves: Table; feed_post_views: Table; feed_posts: Table; feed_reposts: Table; followers: Table; gallery_saves: Table;
      game_alert_subscriptions: Table; game_categories: Table; game_challenges: Table; game_clips: Table; game_comments: Table; game_levels: Table; game_likes: Table; game_missions: Table; game_moves: Table; game_platform_accounts: Table; game_player_progress: Table; game_rewards: Table; game_room_members: Table; game_rooms: Table; game_runtime_manifests: Table; game_save_history: Table; game_scores: Table; game_sessions: Table; game_stream_links: Table; game_tournaments: Table; gamer_profiles: Table; games: Table; gaming_uploads: Table;
      layout_presets: Table;
      live_alert_subscriptions: Table; live_categories: Table; live_chat_messages: Table; live_member_activity: Table; live_reactions: Table; live_recordings: Table; live_stream_bans: Table; live_stream_cards: Table; live_stream_members: Table; live_stream_purchases: Table; live_streams: Table; live_tips: Table; live_view_sessions: Table; livekit_room_events: Table;
      meta_avatars: Table; meta_chat_messages: Table; meta_inventory: Table; meta_items: Table; meta_portals: Table; meta_room_members: Table; meta_rooms: Table; meta_stream_links: Table; meta_visits: Table; meta_world_likes: Table; meta_worlds: Table;
      moderation_reports: Table;
      music_comments: Table; music_likes: Table; music_play_events: Table; music_tracks: Table;
      notification_groups: Table; notification_reads: Table;
      platform_analytics_events: Table; platform_announcements: Table; playlist_tracks: Table; playlists: Table;
      podcast_comments: Table; podcast_episodes: Table; podcast_likes: Table; podcast_shows: Table;
      product_likes: Table; product_views: Table; products: Table;
      profile_theme_settings: Table; profile_view_events: Table; profiles: Table; public_profile_cards: Table; push_devices: Table;
      radio_comments: Table; radio_likes: Table; radio_sessions: Table; radio_stations: Table;
      rank_rules: Table; rb_personality_settings: Table; rb_secret_rooms: Table; rich_notifications: Table; route_access_rules: Table; route_registry: Table;
      search_clicks: Table; search_queries: Table; section_theme_settings: Table;
      sports_alert_subscriptions: Table; sports_brackets: Table; sports_broadcasts: Table; sports_comments: Table; sports_leagues: Table; sports_pick_results: Table; sports_picks: Table; sports_posts: Table; sports_profiles: Table; sports_reactions: Table; sports_teams: Table; sports_uploads: Table;
      storage_bucket_routes: Table; store_cart_items: Table; store_comments: Table; store_notifications: Table; store_orders: Table; store_seller_profiles: Table; stripe_sync_events: Table; system_health_checks: Table;
      tournament_players: Table; tracks: Table; trust_events: Table;
      upload_processing_queue: Table; uploads: Table; user_avatar_loadouts: Table; user_badges: Table; user_custom_screens: Table; user_levels: Table; user_product_unlocks: Table; user_sessions: Table; user_settings: Table; user_xp_ledger: Table;
      vip_live_access: Table; watch_comments: Table; watch_likes: Table; watch_progress: Table; watch_sessions: Table; watchlist_items: Table;
      xp_event_queue: Table; xp_events: Table; xp_rule_bindings: Table; xp_section_progress: Table;
    };
    Views: { active_brand_assets: Table; creator_products: Table };
    Functions: {
      rb_admin_action: Fn; rb_admin_snapshot: Fn; rb_apply_xp_queue_row: Fn; rb_authorize_livekit_room: Fn;
      rb_avatar_runtime_snapshot: Fn; rb_avatar_set_item: Fn; rb_award_xp: Fn;
      rb_claim_upload_jobs: Fn; rb_create_direct_thread: Fn; rb_creator_dimension_snapshot: Fn; rb_creator_request_dimension: Fn; rb_creator_save_page: Fn;
      rb_dm_assert_member: Fn; rb_dm_finalize_attachment: Fn; rb_dm_mark_thread_read: Fn; rb_dm_search_profiles: Fn; rb_dm_send_message: Fn; rb_dm_set_typing: Fn; rb_dm_start_call: Fn; rb_dm_thread_snapshot: Fn; rb_dm_threads_snapshot: Fn; rb_dm_toggle_reaction: Fn;
      rb_end_live_stream: Fn; rb_enter_meta_world: Fn;
      rb_feed_action: Fn; rb_feed_add_comment: Fn; rb_feed_record_view: Fn; rb_feed_snapshot: Fn; rb_feed_toggle_like: Fn;
      rb_finish_upload_job: Fn; rb_gallery_action: Fn; rb_gallery_snapshot: Fn;
      rb_game_action: Fn; rb_game_room_action: Fn; rb_game_save_action: Fn; rb_gaming_snapshot: Fn;
      rb_global_search: Fn; rb_go_live_bootstrap: Fn; rb_is_admin: Fn; rb_is_dm_thread_member: Fn; rb_join_game_room: Fn; rb_join_meta_room: Fn; rb_leave_meta_room: Fn;
      rb_live_action: Fn; rb_live_can_access: Fn; rb_live_heartbeat: Fn; rb_live_join: Fn; rb_live_leave: Fn; rb_live_snapshot: Fn; rb_live_watch_podcast_snapshot: Fn;
      rb_media_universe_snapshot: Fn; rb_meta_universe_snapshot: Fn; rb_music_action: Fn; rb_music_snapshot: Fn;
      rb_notifications_mark_read: Fn; rb_notifications_mark_seen: Fn; rb_notifications_snapshot: Fn; rb_personality: Fn;
      rb_podcast_action: Fn; rb_podcast_snapshot: Fn; rb_portal_elite_snapshot: Fn; rb_portal_universe_snapshot: Fn;
      rb_profile_follow_action: Fn; rb_profile_record_view: Fn; rb_profile_toggle_follow: Fn; rb_profile_universe_snapshot: Fn;
      rb_radio_action: Fn; rb_radio_snapshot: Fn; rb_rank_for_level: Fn; rb_reconcile_xp_identity: Fn; rb_record_game_move: Fn;
      rb_recover_stale_upload_jobs: Fn; rb_register_upload: Fn;
      rb_save_avatar_studio: Fn; rb_save_profile_identity: Fn; rb_save_universe_settings: Fn;
      rb_search_action: Fn; rb_search_snapshot: Fn; rb_send_meta_message: Fn;
      rb_settle_live_payment: Fn; rb_settle_store_payment: Fn; rb_sports_action: Fn; rb_sports_snapshot: Fn; rb_start_live_stream: Fn;
      rb_store_cart_set: Fn; rb_store_catalog: Fn; rb_store_checkout: Fn; rb_store_record_view: Fn; rb_store_toggle_like: Fn;
      rb_sync_avatar_motion: Fn; rb_sync_processed_upload_destination: Fn;
      rb_upload_processing_claim: Fn; rb_upload_processing_finish: Fn; rb_upload_processing_recover_stale: Fn; rb_upload_route_requires_target: Fn; rb_upload_snapshot: Fn;
      rb_watch_action: Fn; rb_watch_feed: Fn; rb_watch_snapshot: Fn; rb_xp_event_allowed: Fn; rb_xp_snapshot: Fn; save_meta_avatar: Fn;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

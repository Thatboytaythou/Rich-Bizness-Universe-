const env = import.meta.env || {};

export const RB_CONFIG = Object.freeze({
  app: Object.freeze({ name: 'Rich Bizness Universe', brand: 'Rich Bizness LLC', version: '1.0.0-rebuild' }),
  supabase: Object.freeze({ url: env.VITE_SUPABASE_URL || '', publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || '' }),
  routes: Object.freeze({ home:'/',feed:'/feed.html',live:'/live.html',watch:'/watch.html',gallery:'/gallery.html',music:'/music.html',upload:'/upload.html',gaming:'/gaming.html',sports:'/sports.html',meta:'/meta.html',store:'/store.html',profile:'/profile.html',edit:'/edit.html',avatar:'/avatar.html',settings:'/settings.html',auth:'/auth.html' }),
  tables: Object.freeze({
    profiles:'profiles',followers:'followers',feedPosts:'feed_posts',feedLikes:'feed_post_likes',feedComments:'feed_comments',feedViews:'feed_post_views',
    liveStreams:'live_streams',liveRecordings:'live_recordings',liveChatMessages:'live_chat_messages',liveReactions:'live_reactions',
    musicTracks:'music_tracks',musicLikes:'music_likes',musicComments:'music_comments',podcastEpisodes:'podcast_episodes',podcastComments:'podcast_comments',podcastLikes:'podcast_likes',radioStations:'radio_stations',radioLikes:'radio_likes',playlists:'playlists',playlistTracks:'playlist_tracks',audioHistory:'audio_listening_history',
    games:'games',gameRooms:'game_rooms',gameScores:'game_scores',gameComments:'game_comments',gameLikes:'game_likes',gameClips:'game_clips',gamingUploads:'gaming_uploads',gamerProfiles:'gamer_profiles',
    sportsPosts:'sports_posts',sportsComments:'sports_comments',sportsUploads:'sports_uploads',sportsProfiles:'sports_profiles',
    metaWorlds:'meta_worlds',metaWorldLikes:'meta_world_likes',metaPortals:'meta_portals',metaAvatars:'meta_avatars',
    products:'products',uploads:'uploads',storageRoutes:'storage_bucket_routes',userLevels:'user_levels',userSettings:'user_settings',profileThemes:'profile_theme_settings',creatorPages:'creator_page_settings'
  })
});
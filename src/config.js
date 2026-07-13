const env = import.meta.env || {};

export const RB_CONFIG = Object.freeze({
  app: Object.freeze({
    name: 'Rich Bizness Universe',
    brand: 'Rich Bizness LLC',
    version: '1.0.0-rebuild'
  }),
  supabase: Object.freeze({
    url: env.VITE_SUPABASE_URL || '',
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  }),
  routes: Object.freeze({
    home: '/',
    feed: '/feed.html',
    live: '/live.html',
    watch: '/watch.html',
    gallery: '/gallery.html',
    music: '/music.html',
    upload: '/upload.html',
    gaming: '/gaming.html',
    sports: '/sports.html',
    meta: '/meta.html',
    store: '/store.html',
    profile: '/profile.html',
    edit: '/edit.html',
    avatar: '/avatar.html',
    settings: '/settings.html',
    auth: '/auth.html'
  }),
  tables: Object.freeze({
    profiles: 'profiles',
    followers: 'followers',
    feedPosts: 'feed_posts',
    feedLikes: 'feed_post_likes',
    feedComments: 'feed_comments',
    feedViews: 'feed_post_views',
    liveStreams: 'live_streams',
    liveRecordings: 'live_recordings',
    liveChatMessages: 'live_chat_messages',
    liveReactions: 'live_reactions',
    musicTracks: 'music_tracks',
    games: 'games',
    products: 'products',
    metaWorlds: 'meta_worlds',
    metaAvatars: 'meta_avatars',
    sportsPosts: 'sports_posts',
    uploads: 'uploads',
    storageRoutes: 'storage_bucket_routes',
    userLevels: 'user_levels',
    userSettings: 'user_settings',
    profileThemes: 'profile_theme_settings',
    creatorPages: 'creator_page_settings'
  })
});
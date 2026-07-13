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
    live: '/live.html',
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
    liveStreams: 'live_streams',
    musicTracks: 'music_tracks',
    games: 'games',
    products: 'products',
    metaWorlds: 'meta_worlds',
    metaAvatars: 'meta_avatars',
    sportsPosts: 'sports_posts',
    uploads: 'uploads',
    userLevels: 'user_levels',
    userSettings: 'user_settings',
    profileThemes: 'profile_theme_settings',
    creatorPages: 'creator_page_settings'
  })
});

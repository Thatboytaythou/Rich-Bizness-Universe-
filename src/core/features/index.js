import { RB_SECTIONS, RB_SYSTEMS, routeFor, sectionFor, accessFor } from '../../rb-schema-map.js';

export const RB_APP_SOURCE = Object.freeze({
  appName: 'Rich Bizness Universe',
  brand: 'Rich Bizness LLC',
  appUrl: 'https://rich-bizness.com',
  mobileUrl: 'https://rich-bizness-mobile-app.vercel.app',
  supabaseRef: 'xfsrqomsiulswbalgknx',
  supabaseUrl: 'https://xfsrqomsiulswbalgknx.supabase.co',
  supabasePublishableKey: 'sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8',
  livekitUrl: 'wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud',
  profileTable: 'profiles',
  avatarTable: 'meta_avatars',
  xpTables: ['profiles', 'user_levels', 'user_xp_ledger', 'xp_events', 'rank_rules'],
});

export const RB_FEATURES = Object.freeze({
  index: { key: 'index', route: '/', category: 'core', required: true },
  auth: { key: 'auth', route: '/auth.html', category: 'core', required: true },
  profile: { key: 'profile', route: '/profile.html', category: 'identity', required: true },
  avatar: { key: 'avatar', route: '/avatar.html', category: 'identity', required: true },
  avatarCharacters: { key: 'avatar-characters', route: '/avatar-characters/', category: 'identity', required: true },
  upload: { key: 'upload', route: '/upload.html', category: 'creation', required: true },
  feed: { key: 'feed', route: '/feed.html', category: 'social', required: true },
  notifications: { key: 'notifications', route: '/notifications.html', category: 'alerts', required: true },
  edit: { key: 'edit', route: '/edit.html', category: 'identity', required: true },
  settings: { key: 'settings', route: '/settings.html', category: 'identity', required: true },
  messages: { key: 'messages', route: '/messages.html', category: 'messaging', required: true },
  search: { key: 'search', route: '/search.html', category: 'discovery', required: true },
  admin: { key: 'admin', route: '/admin.html', category: 'ops', required: true },
  secrets: { key: 'rb-secret', route: '/rb-secret-door.html', category: 'vault', required: true },
  creator: { key: 'creator', route: '/creator.html', category: 'creator', required: true },
  store: { key: 'store', route: '/store.html', category: 'commerce', required: true },
  sports: { key: 'sports', route: '/sports.html', category: 'sports', required: true },
  music: { key: 'music', route: '/music.html', category: 'audio', required: true },
  radio: { key: 'radio', route: '/radio.html', category: 'audio', required: true },
  podcast: { key: 'podcast', route: '/podcast.html', category: 'audio', required: true },
  games: { key: 'games', route: '/games/', category: 'gaming', required: true },
  gaming: { key: 'gaming', route: '/gaming.html', category: 'gaming', required: true },
  gallery: { key: 'gallery', route: '/gallery.html', category: 'media', required: true },
  live: { key: 'live', route: '/live.html', category: 'live', required: true },
  watch: { key: 'watch', route: '/watch.html', category: 'live', required: true },
});

export function getFeature(key) {
  const normalized = String(key || '').replace(/_/g, '-');
  return Object.values(RB_FEATURES).find((feature) => feature.key === normalized) || sectionFor(normalized) || null;
}

export function getFeatureRoute(key) {
  return getFeature(key)?.route || routeFor(key) || '/';
}

export function getFeatureAccess(key) {
  return accessFor(getFeature(key)?.key || key);
}

export const RB_UNIVERSAL_INDEX = Object.freeze({
  source: RB_APP_SOURCE,
  sections: RB_SECTIONS,
  systems: RB_SYSTEMS,
  features: RB_FEATURES,
});

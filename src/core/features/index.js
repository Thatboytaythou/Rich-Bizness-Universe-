import {
  RB_ACCESS_RULES,
  RB_SECTIONS,
  RB_SYSTEMS,
  routeFor,
  sectionFor,
} from '../../rb-schema-map.js';

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

const FEATURE_CATEGORIES = Object.freeze({
  index: 'core',
  auth: 'core',
  profile: 'identity',
  avatar: 'identity',
  'avatar-characters': 'identity',
  edit: 'identity',
  settings: 'identity',
  upload: 'creation',
  feed: 'social',
  notifications: 'alerts',
  messages: 'messaging',
  search: 'discovery',
  admin: 'ops',
  secret: 'vault',
  'rb-secret': 'vault',
  creator: 'creator',
  store: 'commerce',
  sports: 'sports',
  music: 'audio',
  radio: 'audio',
  podcast: 'audio',
  games: 'gaming',
  gaming: 'gaming',
  gallery: 'media',
  live: 'live',
  watch: 'live',
  meta: 'meta',
});

function featureFromSection(section) {
  return Object.freeze({
    key: section.key,
    route: section.route,
    category: FEATURE_CATEGORIES[section.key] || 'section',
    required: true,
    primaryTable: section.primaryTable,
    tables: section.tables,
    buckets: section.buckets,
  });
}

export const RB_FEATURES = Object.freeze(
  RB_SECTIONS.reduce((registry, section) => {
    registry[section.key] = featureFromSection(section);
    return registry;
  }, {})
);

function normalizeFeatureKey(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return 'index';

  const aliasRoute = routeFor(raw);
  const section = RB_SECTIONS.find((item) => item.key === raw || item.route === raw || item.route === aliasRoute);
  return section?.key || raw.replace(/^\//, '').replace(/\.html$/, '').replace(/_/g, '-');
}

export function getFeature(key) {
  const normalized = normalizeFeatureKey(key);
  return RB_FEATURES[normalized] || null;
}

export function getFeatureRoute(key) {
  return getFeature(key)?.route || routeFor(key) || '/';
}

export function getFeatureAccess(key) {
  const normalized = normalizeFeatureKey(getFeature(key)?.key || key);
  return RB_ACCESS_RULES[normalized] || RB_ACCESS_RULES.index || { gate: 'public', entryCostCents: 0 };
}

export const RB_UNIVERSAL_INDEX = Object.freeze({
  source: RB_APP_SOURCE,
  sections: RB_SECTIONS,
  systems: RB_SYSTEMS,
  features: RB_FEATURES,
});

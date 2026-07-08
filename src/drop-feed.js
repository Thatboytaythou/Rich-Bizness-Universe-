import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=realtime-2';
import { getAuthoritativeIdentity, ensureProfile } from './rb-identity.js?v=tap-in-foundation-3';
import './rb-personality.js?v=drop-feed-2';
import './section-language-foundation.js?v=language-foundation-3';

const key = document.body?.dataset?.section || 'feed';
const isUpload = key === 'upload';
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();

const routes = [
  ['feed', 'feed_posts', 'RICH FEED'],
  ['gallery', 'feed_posts', 'GALLERY'],
  ['music', 'music_tracks', 'MUSIC'],
  ['podcast', 'podcast_episodes', 'PODCAST'],
  ['radio', 'radio_stations', 'RB RADIO'],
  ['sports', 'sports_posts', 'SPORTS'],
  ['gaming', 'game_clips', 'GAMING'],
  ['store-product', 'products', 'STORE'],
  ['store-digital', 'products', 'DIGITAL'],
  ['live-thumbnail', 'live_streams', 'LIVE THUMB'],
  ['live-recording', 'live_recordings', 'REPLAY'],
  ['meta', 'meta_worlds', 'META']
];

let user = null;
let profile = null;
let posts = [];
let selectedRoute = new URL(location.href).searchParams.get('section') || 'feed';
let pickedFile = null;

function addCss() {
  if ($('#dropFeedCss')) return;
  const l = document.createElement('link');
  l.id = 'dropFeedCss';
  l.rel = 'stylesheet';
  l.href = '/src/drop-feed.css?v=drop-feed-2';
  document.head.appendChild(l);
}

async function auth() {
  const state = await getAuthoritativeIdentity();
  user = state.user || null;
  profile = user ? await ensureProfile(user) : null;
  return { ...state, profile };
}

function routeInfo() { return routes.find((r) => r[0] === selectedRoute) || routes[0]; }
function mediaOf(row) { return row.media_url || row.image_url || row.cover_url || row.thumbnail_url || row.video_url || row.file_url || row.audio_url || row.clip_url || row.recording_url || row.world_url || row.metadata?.media_url || row.metadata?.public_url || ''; }
function nameOf(row) { return row.title || row.station_name || row.caption || row.body || 'Rich Bizness Drop'; }
function authorOf(row) { return row.display_name || row.username || row.metadata?.display_name || 'Rich Bizness'; }
function faceOf(row) { return row.avatar_url || row.metadata?.avatar_url || ''; }
function mediaTypeFrom(file) {
  const type = file?.type || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return file ? 'file' : 'text';
}
function bucketFor(route) {
  if (route === 'music') return 'music-audio';
  if (route === 'podcast') return 'podcast-audio';
  if (route === 'sports') return 'sports-media';
  if (route === 'gaming') return 'game-clips';
  if (route === 'store-product') return 'store-products';
  if (route === 'store-digital') return 'store-digital';
  if (route === 'live-recording') return 'live-recordings';
  if (route === 'live-thumbnail') return 'live-thumbnails';
  if (route === 'meta') return 'meta-avatars';
  if (route === 'gallery') return 'gallery-media';
  return 'general-uploads';
}
function slugify(value) {
  return String(value || 'rich-bizness-drop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54) || 'rich-bizness-drop';
}
function identityMeta(extra = {}) {
  return {
    display_name: profile?.display_name || user?.email?.split('@')[0] || 'Rich Bizness',
    username: profile?.username || user?.email?.split('@')[0] || 'rich_user',
    avatar_url: profile?.avatar_url || '',
    ...extra,
  };
}

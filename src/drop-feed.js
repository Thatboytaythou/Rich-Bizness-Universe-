import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=realtime-2';
import { getAuthoritativeIdentity, ensureProfile } from './rb-identity.js?v=tap-in-foundation-3';
import './rb-personality.js?v=drop-feed-2';
import './section-language-foundation.js?v=copy-only-1';

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
function slugify(value) { return String(value || 'rich-bizness-drop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54) || 'rich-bizness-drop'; }
function identityMeta(extra = {}) {
  return {
    display_name: profile?.display_name || user?.email?.split('@')[0] || 'Rich Bizness',
    username: profile?.username || user?.email?.split('@')[0] || 'rich_user',
    avatar_url: profile?.avatar_url || '',
    rb_language: 'They are here Rich',
    route: selectedRoute,
    ...extra,
  };
}
function identityFields() {
  return {
    user_id: user.id,
    username: profile?.username || user.email?.split('@')[0] || 'rich_user',
    display_name: profile?.display_name || user.email?.split('@')[0] || 'Rich Bizness',
  };
}

function mount() {
  if ($('#dropFeedShell')) return;
  const main = document.querySelector('main') || document.body;
  const shell = document.createElement('section');
  shell.id = 'dropFeedShell';
  shell.className = 'drop-feed-shell';
  shell.dataset.rbGeneratedShell = 'drop-feed';
  shell.innerHTML = isUpload ? uploadMarkup() : feedMarkup();
  main.appendChild(shell);
  window.dispatchEvent(new CustomEvent('rb-page-rendered'));
  wire();
}

function uploadMarkup() {
  return `<section class="df-hero"><small>DROP ZONE • ROUTE IT RIGHT</small><h1>DROP ZONE</h1><p>Drop it once and let Rich Bizness route the file to feed, gallery, music, podcast, sports, gaming, store, live, or meta without breaking profile lock.</p><div class="df-metrics"><div class="df-metric"><b id="dfRecordCount">0</b><span>DROPS</span></div><div class="df-metric"><b id="dfRouteName">FEED</b><span>ROUTE</span></div><div class="df-metric"><b id="dfStatusTop">READY</b><span>STATUS</span></div></div></section><section class="df-layout"><section class="df-panel"><h2>Drop Control</h2><form class="df-form" id="dropForm"><input id="dropTitle" placeholder="Title this drop"><select id="dropRoute">${routes.map(r=>`<option value="${r[0]}">${r[2]}</option>`).join('')}</select><textarea id="dropCaption" placeholder="Talk that Rich Bizness language..."></textarea><label class="df-dropzone" for="dropFile"><span><b>Tap to pick file</b><small>Image, video, audio, cover, clip, product, replay</small></span><input id="dropFile" type="file" hidden></label><div class="df-preview"><div class="df-preview-box" id="dfPreviewBox">RB</div><div><b id="dfPreviewTitle">No file yet</b><p id="dfPreviewMeta">Pick a route and file.</p><small class="df-status" id="dropStatus">Router ready.</small></div></div><div class="df-actions"><button class="primary" type="submit">DROP IT</button><a href="/feed.html" data-route="feed">OPEN FEED</a><a href="/profile.html" data-route="profile">PROFILE LOCK</a></div></form></section><aside class="df-panel"><h2>Auto Route</h2><div class="df-route-grid" id="dfRoutes"></div><div class="df-status" id="routeStatus">Every lane keeps RB language and identity metadata.</div></aside></section>`;
}

function feedMarkup() {
  return `<section class="df-hero"><small>RICH FEED • REAL DROPS</small><h1>RICH FEED</h1><p>Posts, visuals, drops, likes, comments, follows, XP, and creator movement — all tied to the same Rich Bizness identity.</p><div class="df-metrics"><div class="df-metric"><b id="dfRecordCount">0</b><span>POSTS</span></div><div class="df-metric"><b id="dfRouteName">LIVE</b><span>READY</span></div><div class="df-metric"><b id="dfStatusTop">READY</b><span>STATUS</span></div></div></section><section class="df-layout"><section class="df-panel"><h2>Say It Rich</h2><form class="df-form" id="feedForm"><input id="feedTitle" placeholder="Title / headline"><textarea id="feedBody" placeholder="Drop something for the universe..."></textarea><input id="feedMedia" placeholder="Optional image/video/audio URL"><div class="df-actions"><button class="primary" type="submit">DROP POST</button><a href="/upload.html?section=feed" data-route="upload">UPLOAD FILE</a><a href="/profile.html" data-route="profile">PROFILE LOCK</a></div><small class="df-status" id="dropStatus">Feed ready.</small></form></section><aside class="df-panel"><h2>Live Drops</h2><div class="df-feed-list" id="dfFeedList"><div class="df-status">Checking live records...</div></div></aside></section>`;
}

function wire() {
  if (isUpload) {
    $('#dropRoute').value = selectedRoute;
    renderRouteTiles();
    $('#dropRoute')?.addEventListener('change', () => { selectedRoute = $('#dropRoute').value; renderRouteTiles(); });
    $('#dropFile')?.addEventListener('change', (e) => { pickedFile = e.target.files?.[0] || null; previewFile(); });
    $('#dropForm')?.addEventListener('submit', submitUpload);
  } else {
    $('#feedForm')?.addEventListener('submit', submitFeed);
  }
}

function renderRouteTiles() {
  const box = $('#dfRoutes');
  if (!box) return;
  box.innerHTML = routes.map((r) => `<article class="df-route ${r[0] === selectedRoute ? 'active' : ''}" data-route-pick="${r[0]}"><b>${r[2]}</b><small>${r[1]}</small></article>`).join('');
  document.querySelectorAll('[data-route-pick]').forEach((el) => el.addEventListener('click', () => {
    selectedRoute = el.dataset.routePick;
    if ($('#dropRoute')) $('#dropRoute').value = selectedRoute;
    renderRouteTiles();
    updateRouteLabel();
  }));
  updateRouteLabel();
}

function updateRouteLabel() {
  const r = routeInfo();
  if ($('#dfRouteName')) $('#dfRouteName').textContent = r[2].split(' ')[0];
  if ($('#routeStatus')) $('#routeStatus').textContent = `${r[2]} routes into ${r[1]} with a table-safe payload.`;
}

function previewFile() {
  const box = $('#dfPreviewBox');
  const title = $('#dfPreviewTitle');
  const meta = $('#dfPreviewMeta');
  if (!pickedFile) { if (box) box.textContent = 'RB'; return; }
  if (title) title.textContent = pickedFile.name;
  if (meta) meta.textContent = `${pickedFile.type || 'file'} • ${fmt(pickedFile.size)} bytes`;
  if (!box) return;
  const url = URL.createObjectURL(pickedFile);
  if (pickedFile.type.startsWith('image/')) box.innerHTML = `<img src="${url}" alt="">`;
  else if (pickedFile.type.startsWith('video/')) box.innerHTML = `<video src="${url}" muted playsinline></video>`;
  else box.textContent = pickedFile.type.startsWith('audio/') ? '♪' : 'RB';
}

async function uploadFile() {
  if (!pickedFile) return { bucket: '', filePath: '', publicUrl: '', mimeType: '', fileSize: 0, mediaType: 'text' };
  const bucket = bucketFor(selectedRoute);
  const ext = pickedFile.name.split('.').pop() || 'bin';
  const filePath = `${user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const up = await supabase.storage.from(bucket).upload(filePath, pickedFile, { upsert: false, contentType: pickedFile.type || undefined });
  if (up.error) throw up.error;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  return { bucket, filePath, publicUrl, mimeType: pickedFile.type || '', fileSize: pickedFile.size || 0, mediaType: mediaTypeFrom(pickedFile) };
}

async function insertOne(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select('*').maybeSingle();
  if (error) throw error;
  return { table, data };
}
async function insertOptional(table, row) {
  try { return await insertOne(table, row); }
  catch (error) { console.warn(`[RB upload] optional ${table} insert blocked`, error.message); return null; }
}
function feedRow({ title, caption, upload }) {
  return { ...identityFields(), title, body: caption, media_url: upload.publicUrl, media_type: upload.mediaType, thumbnail_url: upload.mediaType === 'image' ? upload.publicUrl : '', section: selectedRoute === 'gallery' ? 'gallery' : selectedRoute === 'feed' ? 'feed' : selectedRoute, visibility: 'public', post_type: selectedRoute, file_url: upload.publicUrl, cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', metadata: identityMeta({ public_url: upload.publicUrl, bucket: upload.bucket, file_path: upload.filePath }) };
}
function uploadLogRow({ title, caption, upload }) {
  return { user_id: user.id, category: selectedRoute, section: selectedRoute, title, description: caption, bucket: upload.bucket, file_path: upload.filePath, public_url: upload.publicUrl, mime_type: upload.mimeType, file_size: upload.fileSize, media_type: upload.mediaType, visibility: 'public', processing_status: upload.publicUrl ? 'uploaded' : 'text-only', metadata: identityMeta({ route_table: routeInfo()[1] }) };
}
function sectionRows({ title, caption, upload, feedPostId }) {
  const id = identityFields();
  const meta = identityMeta({ upload_id: null, feed_post_id: feedPostId || null, public_url: upload.publicUrl, bucket: upload.bucket, file_path: upload.filePath, mime_type: upload.mimeType, media_type: upload.mediaType });
  if (selectedRoute === 'feed' || selectedRoute === 'gallery') return [];
  if (selectedRoute === 'music') return [['music_tracks', { ...id, artist_user_id: user.id, title, description: caption, audio_url: upload.publicUrl, file_url: upload.publicUrl, cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', genre: 'Rich Bizness', is_published: true, visibility: 'public', metadata: meta }]];
  if (selectedRoute === 'podcast') return [['podcast_episodes', { ...id, creator_id: user.id, title, description: caption, audio_url: upload.publicUrl, file_url: upload.publicUrl, cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', episode_number: 1, is_published: true, visibility: 'public', metadata: meta }]];
  if (selectedRoute === 'radio') return [['radio_stations', { ...id, station_name: title, station_tag: slugify(title), description: caption, stream_url: upload.publicUrl, cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', genre: 'Rich Bizness', is_live: false, is_public: true, metadata: meta }]];
  if (selectedRoute === 'sports') return [['sports_uploads', { ...id, title, caption, sport_name: 'Rich Bizness Sports', content_type: upload.mediaType, clip_type: 'drop', file_url: upload.publicUrl, thumbnail_url: upload.mediaType === 'image' ? upload.publicUrl : '', metadata: meta }], ['sports_posts', { ...id, title, body: caption, sport: 'Rich Bizness Sports', media_url: upload.publicUrl, media_type: upload.mediaType, cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', thumbnail_url: upload.mediaType === 'image' ? upload.publicUrl : '', metadata: meta }]];
  if (selectedRoute === 'gaming') return [['gaming_uploads', { ...id, title, description: caption, caption, category: 'clip', media_type: upload.mediaType, file_url: upload.publicUrl, clip_url: upload.publicUrl, thumbnail_url: upload.mediaType === 'image' ? upload.publicUrl : '', bucket: upload.bucket, file_path: upload.filePath, visibility: 'public', processing_status: 'uploaded', metadata: meta }], ['game_clips', { ...id, title, caption, clip_url: upload.publicUrl, thumbnail_url: upload.mediaType === 'image' ? upload.publicUrl : '', feed_post_id: feedPostId || null, metadata: meta }]];
  if (selectedRoute === 'store-product' || selectedRoute === 'store-digital') return [['products', { seller_id: user.id, title, description: caption, category: selectedRoute === 'store-digital' ? 'digital' : 'drop', product_type: selectedRoute === 'store-digital' ? 'digital' : 'physical', fulfillment_type: selectedRoute === 'store-digital' ? 'download' : 'local', price_cents: 0, currency: 'usd', image_url: upload.mediaType === 'image' ? upload.publicUrl : '', cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', media_url: upload.publicUrl, preview_url: upload.publicUrl, digital_file_url: selectedRoute === 'store-digital' ? upload.publicUrl : '', is_digital: selectedRoute === 'store-digital', is_public: true, status: 'active', metadata: meta }]];
  if (selectedRoute === 'live-thumbnail') return [['live_streams', { creator_id: user.id, slug: `drop-${user.id.slice(0, 8)}`, display_slug: title, title, description: caption, category: 'drop', status: 'draft', status_label: 'Thumbnail ready', access_type: 'public', price_cents: 0, currency: 'usd', livekit_room_name: `we-lit-${user.id.slice(0, 8)}`, display_room_name: 'Bizness Party', thumbnail_url: upload.publicUrl, cover_url: upload.publicUrl, is_chat_enabled: true, is_cohost_enabled: true, metadata: meta }]];
  if (selectedRoute === 'live-recording') return [['live_recordings', { creator_id: user.id, user_id: user.id, title, description: caption, recording_url: upload.publicUrl, thumbnail_url: upload.mediaType === 'image' ? upload.publicUrl : '', cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', status: 'ready', visibility: 'public', metadata: meta }]];
  if (selectedRoute === 'meta') return [['meta_worlds', { owner_id: user.id, slug: slugify(title), title, description: caption, world_type: 'drop', status: 'published', access_type: 'public', cover_url: upload.mediaType === 'image' ? upload.publicUrl : '', background_url: upload.mediaType === 'image' ? upload.publicUrl : '', world_url: upload.publicUrl, entry_route: '/meta.html', theme: 'smoke-cloud', visual_style: 'green-gold cinematic', metadata: meta }]];
  return [];
}

async function routeUpload({ title, caption }) {
  const upload = await uploadFile();
  const uploadLog = await insertOne('uploads', uploadLogRow({ title, caption, upload }));
  const feedPost = await insertOptional('feed_posts', feedRow({ title, caption, upload }));
  const rows = sectionRows({ title, caption, upload, feedPostId: feedPost?.data?.id });
  const created = [uploadLog, feedPost].filter(Boolean);
  for (const [table, row] of rows) created.push(await insertOptional(table, { ...row, metadata: { ...(row.metadata || {}), upload_id: uploadLog.data?.id } }));
  return created.filter(Boolean);
}
async function submitUpload(e) {
  e.preventDefault();
  try {
    await auth();
    if (!user) { location.href = '/auth.html?next=' + encodeURIComponent('/upload.html'); return; }
    const title = $('#dropTitle')?.value?.trim() || 'Rich Bizness Drop';
    const caption = $('#dropCaption')?.value?.trim() || 'They are here Rich';
    $('#dropStatus').textContent = 'Routing through table-safe payloads...';
    const created = await routeUpload({ title, caption });
    await awardXp('drop_zone_upload', { section: selectedRoute, sourceTable: created[0]?.table, sourceId: created[0]?.data?.id });
    $('#dropStatus').textContent = `Dropped into ${created.map(c => c.table).join(', ')}.`;
    $('#dfStatusTop').textContent = 'DROPPED';
    loadFeed();
  } catch (error) { console.warn(error); $('#dropStatus').textContent = error.message || String(error); }
}
async function submitFeed(e) {
  e.preventDefault();
  try {
    await auth();
    if (!user) { location.href = '/auth.html?next=' + encodeURIComponent('/feed.html'); return; }
    const title = $('#feedTitle')?.value?.trim() || 'Rich Bizness Post';
    const body = $('#feedBody')?.value?.trim() || 'They are here Rich';
    const media = $('#feedMedia')?.value?.trim() || '';
    const row = { ...identityFields(), title, body, caption: body, media_url: media, visibility: 'public', section: 'feed', post_type: media ? 'media' : 'text', metadata: identityMeta({ source: 'feed-composer' }) };
    const { data, error } = await supabase.from('feed_posts').insert(row).select('*').maybeSingle();
    if (error) throw error;
    await awardXp('feed_post_create', { section: 'feed', sourceTable: 'feed_posts', sourceId: data?.id });
    $('#dropStatus').textContent = 'Post dropped.';
    e.target.reset();
    loadFeed();
  } catch (error) { console.warn(error); $('#dropStatus').textContent = error.message || String(error); }
}
async function loadFeed() {
  if (isUpload) return;
  const { data } = await supabase.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(24);
  posts = data || [];
  const list = $('#dfFeedList');
  const count = $('#dfRecordCount');
  if (count) count.textContent = fmt(posts.length);
  if (!list) return;
  list.innerHTML = posts.length ? posts.map((p) => `<article class="df-post"><div class="df-author">${faceOf(p) ? `<img src="${faceOf(p)}" alt="">` : '<span>RB</span>'}<div><b>${authorOf(p)}</b><small>${p.created_at ? new Date(p.created_at).toLocaleString() : 'now'}</small></div></div><h3>${nameOf(p)}</h3><p>${p.body || p.caption || ''}</p>${mediaOf(p) ? `<a class="df-media" href="${mediaOf(p)}" target="_blank" rel="noreferrer">OPEN MEDIA</a>` : ''}</article>`).join('') : '<div class="df-status">No feed posts yet.</div>';
}

addCss();
mount();
auth().catch(() => {});
loadFeed();
supabase.channel('drop-feed-live').on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, loadFeed).subscribe();

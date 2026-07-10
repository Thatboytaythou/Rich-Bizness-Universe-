import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=identity-owner-3';
import { getAuthoritativeIdentity } from './rb-identity.js?v=identity-owner-2';
import './section-language-foundation.js?v=copy-only-1';

const section = document.body?.dataset?.section || 'feed';
const isUpload = section === 'upload';
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

const routes = [
  ['feed', 'RICH FEED'], ['gallery', 'GALLERY'], ['music', 'MUSIC'],
  ['podcast', 'PODCAST'], ['radio', 'RB RADIO'], ['sports', 'SPORTS'],
  ['gaming', 'GAMING'], ['store-product', 'STORE'], ['store-digital', 'DIGITAL'],
];

let user = null;
let profile = null;
let identityFlight = null;
let feedFlight = null;
let feedTimer = null;
let channel = null;
let pickedFile = null;
let submitting = false;
let selectedRoute = new URL(location.href).searchParams.get('section') || 'feed';

function say(text) { const el = $('#dropStatus'); if (el) el.textContent = text; }
function identityRow() {
  return {
    user_id: user.id,
    username: profile?.username || user.email?.split('@')[0] || 'rich_user',
    display_name: profile?.display_name || user.email?.split('@')[0] || 'Rich Bizness',
  };
}
function metadata(extra = {}) {
  return {
    username: profile?.username || '', display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '', route: selectedRoute, ...extra,
  };
}
async function ensureIdentity() {
  if (user) return { user, profile };
  if (identityFlight) return identityFlight;
  identityFlight = getAuthoritativeIdentity().then((state) => {
    user = state.user || null;
    profile = state.profile || null;
    return { user, profile };
  }).finally(() => { identityFlight = null; });
  return identityFlight;
}
function requireUser(next) {
  if (user) return true;
  location.href = `/auth.html?next=${encodeURIComponent(next)}`;
  return false;
}

function uploadMarkup() {
  return `<div id="dropFeedShell" class="drop-feed-shell"><form class="df-form" id="dropForm"><input id="dropTitle" placeholder="Title"><select id="dropRoute">${routes.map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select><textarea id="dropCaption" placeholder="Description"></textarea><label class="df-dropzone" for="dropFile"><span><b>Pick file</b><small>Image, video, audio, cover, clip, product</small></span><input id="dropFile" type="file" hidden></label><div class="df-actions"><button class="primary" type="submit">DROP IT</button><a href="/feed.html">OPEN FEED</a></div><small class="df-status" id="dropStatus">Router ready.</small></form></div>`;
}
function feedMarkup() {
  return `<div id="dropFeedShell" class="drop-feed-shell"><form class="df-form" id="feedForm"><input id="feedTitle" placeholder="Title"><textarea id="feedBody" placeholder="Say it Rich..."></textarea><input id="feedMedia" placeholder="Optional media URL"><div class="df-actions"><button class="primary" type="submit">DROP POST</button><a href="/upload.html?section=feed">UPLOAD FILE</a></div><small class="df-status" id="dropStatus">Feed ready.</small></form><div class="df-feed-list" id="dfFeedList"></div></div>`;
}
function mount() {
  if ($('#dropFeedShell')) return;
  const target = $('#sectionCards') || $('.cards');
  if (!target) return;
  target.innerHTML = isUpload ? uploadMarkup() : feedMarkup();
  if (isUpload) {
    const route = $('#dropRoute');
    if (!routes.some(([key]) => key === selectedRoute)) selectedRoute = 'feed';
    route.value = selectedRoute;
    route.addEventListener('change', () => { selectedRoute = route.value; });
    $('#dropFile')?.addEventListener('change', (event) => { pickedFile = event.target.files?.[0] || null; });
    $('#dropForm')?.addEventListener('submit', submitUpload);
  } else {
    $('#feedForm')?.addEventListener('submit', submitFeed);
  }
}

function bucketFor(route) {
  return ({ music:'music-audio', podcast:'podcast-audio', sports:'sports-media', gaming:'game-clips', gallery:'gallery-media', 'store-product':'store-products', 'store-digital':'store-digital' })[route] || 'general-uploads';
}
function fileKind(file) {
  const type = file?.type || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return file ? 'file' : 'text';
}
function validateFile(route, file) {
  if (['music','podcast'].includes(route) && file.mediaType !== 'audio') throw new Error('Music and podcast drops require an audio file.');
  if (route === 'gaming' && !['video','image'].includes(file.mediaType)) throw new Error('Gaming drops require a video clip or image.');
  if (route === 'store-digital' && !file.publicUrl) throw new Error('Digital products require a file.');
}
async function uploadFile() {
  if (!pickedFile) return { publicUrl:'', bucket:'', filePath:'', mimeType:'', fileSize:0, mediaType:'text' };
  const bucket = bucketFor(selectedRoute);
  const ext = pickedFile.name.split('.').pop() || 'bin';
  const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, pickedFile, { contentType: pickedFile.type || undefined, upsert:false });
  if (error) throw error;
  return {
    publicUrl: supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl,
    bucket, filePath, mimeType:pickedFile.type || '', fileSize:pickedFile.size || 0, mediaType:fileKind(pickedFile),
  };
}
async function insert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select('*').single();
  if (error) throw error;
  return data;
}
async function updateUpload(id, patch) {
  if (!id) return;
  const { error } = await supabase.from('uploads').update(patch).eq('id', id);
  if (error) console.warn('[RB Upload status]', error.message);
}
function routePayload(route, title, description, file, upload) {
  const who = identityRow();
  const source = metadata({ upload_id:upload.id, bucket:file.bucket, file_path:file.filePath, public_url:file.publicUrl, media_type:file.mediaType });
  const image = file.mediaType === 'image' ? file.publicUrl : null;
  if (route === 'feed' || route === 'gallery') return ['feed_posts', { ...who, title, body:description, section:route, post_type:file.mediaType, media_url:file.publicUrl || null, file_url:file.publicUrl || null, cover_url:image, visibility:'public', metadata:source }];
  if (route === 'music') return ['music_tracks', { ...who, artist_user_id:user.id, title, description, audio_url:file.publicUrl, file_url:file.publicUrl, cover_url:null, is_published:true, visibility:'public', metadata:source }];
  if (route === 'podcast') return ['podcast_episodes', { ...who, creator_id:user.id, title, description, audio_url:file.publicUrl, file_url:file.publicUrl, cover_url:null, is_published:true, visibility:'public', metadata:source }];
  if (route === 'radio') return ['radio_stations', { ...who, station_name:title, description, stream_url:file.publicUrl, cover_url:image, is_live:false, is_public:true, metadata:source }];
  if (route === 'sports') return ['sports_posts', { ...who, title, body:description, media_url:file.publicUrl || null, media_type:file.mediaType, cover_url:image, thumbnail_url:image, metadata:source }];
  if (route === 'gaming') return ['game_clips', { ...who, title, caption:description, clip_url:file.publicUrl, thumbnail_url:image, metadata:source }];
  if (route === 'store-product' || route === 'store-digital') {
    const digital = route === 'store-digital';
    return ['products', { seller_id:user.id, title, description, category:digital?'digital':'general', product_type:digital?'digital':'physical', fulfillment_type:digital?'download':'shipping', image_url:image, cover_url:image, media_url:file.publicUrl || null, preview_url:image, digital_file_url:digital?file.publicUrl:null, is_digital:digital, is_public:true, status:'active', price_cents:0, currency:'usd', metadata:source }];
  }
  throw new Error(`Unsupported upload route: ${route}`);
}

async function submitUpload(event) {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  const button = event.submitter;
  if (button) button.disabled = true;
  let upload = null;
  try {
    await ensureIdentity();
    if (!requireUser(`/upload.html?section=${encodeURIComponent(selectedRoute)}`)) return;
    say('Uploading...');
    const title = $('#dropTitle')?.value?.trim() || 'Rich Bizness Drop';
    const description = $('#dropCaption')?.value?.trim() || '';
    const file = await uploadFile();
    validateFile(selectedRoute, file);
    upload = await insert('uploads', { user_id:user.id, title, description, section:selectedRoute, category:selectedRoute, bucket:file.bucket, file_path:file.filePath, public_url:file.publicUrl || null, mime_type:file.mimeType, file_size:file.fileSize, media_type:file.mediaType, visibility:'public', processing_status:'routing', metadata:metadata(file) });
    const [table, row] = routePayload(selectedRoute, title, description, file, upload);
    const routed = await insert(table, row);
    await updateUpload(upload.id, { processing_status:'completed', metadata:metadata({ ...file, target_table:table, target_id:routed.id }) });
    await awardXp('drop_zone_upload', { section:selectedRoute, sourceTable:table, sourceId:routed.id }).catch(() => {});
    say(`Uploaded to ${selectedRoute}.`);
    event.target.reset();
    pickedFile = null;
    await loadUploadCount();
  } catch (error) {
    await updateUpload(upload?.id, { processing_status:'failed', metadata:metadata({ error:error.message || String(error) }) });
    say(error.message || String(error));
  } finally {
    submitting = false;
    if (button) button.disabled = false;
  }
}

async function submitFeed(event) {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    await ensureIdentity();
    if (!requireUser('/feed.html')) return;
    const title = $('#feedTitle')?.value?.trim() || 'Rich Bizness Post';
    const body = $('#feedBody')?.value?.trim() || '';
    const media = $('#feedMedia')?.value?.trim() || '';
    const post = await insert('feed_posts', { ...identityRow(), title, body, media_url:media || null, section:'feed', post_type:media?'media':'text', visibility:'public', metadata:metadata({ source:'feed-composer' }) });
    await awardXp('feed_post_create', { section:'feed', sourceTable:'feed_posts', sourceId:post.id }).catch(() => {});
    event.target.reset();
    say('Posted.');
    await loadFeed(true);
  } catch (error) { say(error.message || String(error)); }
  finally { submitting = false; if (button) button.disabled = false; }
}

function profileUrl(row) {
  if (row.user_id) return `/profile.html?id=${encodeURIComponent(row.user_id)}`;
  if (row.username) return `/profile.html?u=${encodeURIComponent(row.username)}`;
  return '/profile.html';
}
function postCard(post) {
  const author = esc(post.display_name || post.username || 'Rich Bizness');
  const handle = esc(post.username ? `@${post.username}` : 'profile');
  const media = post.media_url ? `<div class="df-post-media"><img src="${esc(post.media_url)}" alt="" loading="lazy" decoding="async"></div>` : '';
  return `<article class="df-post"><a class="df-author" href="${profileUrl(post)}"><span>${author.slice(0,2).toUpperCase()}</span><b>${author}</b><small>${handle}</small></a><h3>${esc(post.title || 'Rich Bizness Post')}</h3><p>${esc(post.body || '')}</p>${media}</article>`;
}
async function loadFeed(force = false) {
  if (isUpload) return;
  if (feedFlight && !force) return feedFlight;
  feedFlight = supabase.from('feed_posts').select('*').order('created_at', { ascending:false }).limit(24).then(({ data, error }) => {
    if (error) throw error;
    const rows = data || [];
    if ($('#recordCount')) $('#recordCount').textContent = String(rows.length);
    const list = $('#dfFeedList');
    if (list) list.innerHTML = rows.length ? rows.map(postCard).join('') : '<div class="df-status">No feed posts yet.</div>';
  }).catch((error) => say(error.message)).finally(() => { feedFlight = null; });
  return feedFlight;
}
function scheduleFeed() {
  clearTimeout(feedTimer);
  feedTimer = setTimeout(() => loadFeed(true), 180);
}
async function loadUploadCount() {
  if (!isUpload) return;
  await ensureIdentity();
  if (!user) { if ($('#recordCount')) $('#recordCount').textContent = '0'; return; }
  const { count, error } = await supabase.from('uploads').select('id', { count:'exact', head:true }).eq('user_id', user.id);
  if (!error && $('#recordCount')) $('#recordCount').textContent = String(count || 0);
}
async function boot() {
  mount();
  if (isUpload) {
    await loadUploadCount();
    return;
  }
  await loadFeed();
  channel = supabase.channel('feed-owner')
    .on('postgres_changes', { event:'*', schema:'public', table:'feed_posts' }, scheduleFeed)
    .subscribe();
}
function cleanup() {
  clearTimeout(feedTimer);
  if (channel) { supabase.removeChannel(channel); channel = null; }
}
window.addEventListener('pagehide', cleanup, { once:true });
boot().catch((error) => say(error.message || String(error)));

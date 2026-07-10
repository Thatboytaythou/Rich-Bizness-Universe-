import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=xp-idempotent-1';
import { getAuthoritativeIdentity, ensureProfile } from './rb-identity.js?v=profile-avatar-separate-1';
import './section-language-foundation.js?v=copy-only-1';

const key = document.body?.dataset?.section || 'feed';
const isUpload = key === 'upload';
const $ = (s) => document.querySelector(s);
let user = null;
let profile = null;
let pickedFile = null;
let selectedRoute = new URL(location.href).searchParams.get('section') || 'feed';

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
];

const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, (m) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[m]));

function authProfileUrl(row) {
  if (row.user_id) return `/profile.html?id=${encodeURIComponent(row.user_id)}`;
  if (row.username) return `/profile.html?u=${encodeURIComponent(row.username)}`;
  return '/profile.html';
}

async function auth() {
  const state = await getAuthoritativeIdentity();
  user = state.user || null;
  profile = user ? await ensureProfile(user) : null;
  return state;
}

function bucketFor(route) {
  if (route === 'music') return 'music-audio';
  if (route === 'podcast') return 'podcast-audio';
  if (route === 'sports') return 'sports-media';
  if (route === 'gaming') return 'game-clips';
  if (route === 'store-product') return 'store-products';
  if (route === 'store-digital') return 'store-digital';
  if (route === 'gallery') return 'gallery-media';
  return 'general-uploads';
}

function mediaType(file) {
  const type = file?.type || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return file ? 'file' : 'text';
}

function identity() {
  return {
    user_id: user.id,
    username: profile?.username || user.email?.split('@')[0] || 'rich_user',
    display_name: profile?.display_name || user.email?.split('@')[0] || 'Rich Bizness',
  };
}

function meta(extra = {}) {
  return {
    username: profile?.username || '',
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
    route: selectedRoute,
    ...extra,
  };
}

function uploadMarkup() {
  return `<div id="dropFeedShell" class="drop-feed-shell"><form class="df-form" id="dropForm"><input id="dropTitle" placeholder="Title"><select id="dropRoute">${routes.map((r) => `<option value="${r[0]}">${r[2]}</option>`).join('')}</select><textarea id="dropCaption" placeholder="Description"></textarea><label class="df-dropzone" for="dropFile"><span><b>Pick file</b><small>Image, video, audio, cover, clip, product</small></span><input id="dropFile" type="file" hidden></label><div class="df-actions"><button class="primary" type="submit">DROP IT</button><a href="/feed.html">OPEN FEED</a></div><small class="df-status" id="dropStatus">Router ready.</small></form></div>`;
}

function feedMarkup() {
  return `<div id="dropFeedShell" class="drop-feed-shell"><form class="df-form" id="feedForm"><input id="feedTitle" placeholder="Title"><textarea id="feedBody" placeholder="Say it Rich..."></textarea><input id="feedMedia" placeholder="Optional media URL"><div class="df-actions"><button class="primary" type="submit">DROP POST</button><a href="/upload.html?section=feed">UPLOAD FILE</a></div><small class="df-status" id="dropStatus">Feed ready.</small></form><div class="df-feed-list" id="dfFeedList"></div></div>`;
}

function mount() {
  if ($('#dropFeedShell')) return;
  const target = $('#sectionCards') || $('.cards');
  if (!target) return;
  target.innerHTML = isUpload ? uploadMarkup() : feedMarkup();
  wire();
}

function wire() {
  if (isUpload) {
    const select = $('#dropRoute');
    if (select) select.value = selectedRoute;
    select?.addEventListener('change', () => { selectedRoute = select.value; });
    $('#dropFile')?.addEventListener('change', (event) => { pickedFile = event.target.files?.[0] || null; });
    $('#dropForm')?.addEventListener('submit', submitUpload);
  } else {
    $('#feedForm')?.addEventListener('submit', submitFeed);
  }
}

function validateRouteFile(route, file) {
  if (['music', 'podcast'].includes(route) && file.mediaType !== 'audio') {
    throw new Error('Music and podcast drops require an audio file.');
  }
  if (route === 'gaming' && !['video', 'image'].includes(file.mediaType)) {
    throw new Error('Gaming drops require a video clip or image.');
  }
  if (route === 'store-digital' && !file.publicUrl) {
    throw new Error('Digital products require a file.');
  }
}

async function uploadFile() {
  if (!pickedFile) {
    return { publicUrl: '', bucket: '', filePath: '', mimeType: '', fileSize: 0, mediaType: 'text' };
  }
  const bucket = bucketFor(selectedRoute);
  const ext = pickedFile.name.split('.').pop() || 'bin';
  const filePath = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, pickedFile, {
    contentType: pickedFile.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  return {
    publicUrl,
    bucket,
    filePath,
    mimeType: pickedFile.type || '',
    fileSize: pickedFile.size || 0,
    mediaType: mediaType(pickedFile),
  };
}

async function insert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function updateUpload(uploadId, patch) {
  if (!uploadId) return;
  const { error } = await supabase.from('uploads').update(patch).eq('id', uploadId);
  if (error) console.warn('[RB Upload status update failed]', error.message);
}

function routePayload(route, title, description, file, upload) {
  const who = identity();
  const source = meta({
    upload_id: upload?.id || null,
    bucket: file.bucket,
    file_path: file.filePath,
    public_url: file.publicUrl,
    media_type: file.mediaType,
  });
  const image = file.mediaType === 'image' ? file.publicUrl : null;

  switch (route) {
    case 'feed':
    case 'gallery':
      return {
        table: 'feed_posts',
        row: {
          ...who,
          title,
          body: description,
          section: route,
          post_type: file.mediaType || 'text',
          media_url: file.publicUrl || null,
          file_url: file.publicUrl || null,
          cover_url: image,
          visibility: 'public',
          metadata: source,
        },
      };
    case 'music':
      return {
        table: 'music_tracks',
        row: {
          ...who,
          artist_user_id: user.id,
          title,
          description,
          audio_url: file.publicUrl,
          file_url: file.publicUrl,
          cover_url: null,
          is_published: true,
          visibility: 'public',
          metadata: source,
        },
      };
    case 'podcast':
      return {
        table: 'podcast_episodes',
        row: {
          ...who,
          creator_id: user.id,
          title,
          description,
          audio_url: file.publicUrl,
          file_url: file.publicUrl,
          cover_url: null,
          is_published: true,
          visibility: 'public',
          metadata: source,
        },
      };
    case 'radio':
      return {
        table: 'radio_stations',
        row: {
          ...who,
          station_name: title,
          description,
          stream_url: file.publicUrl,
          cover_url: image,
          is_live: false,
          is_public: true,
          metadata: source,
        },
      };
    case 'sports':
      return {
        table: 'sports_posts',
        row: {
          ...who,
          title,
          body: description,
          media_url: file.publicUrl || null,
          media_type: file.mediaType,
          cover_url: image,
          thumbnail_url: image,
          metadata: source,
        },
      };
    case 'gaming':
      return {
        table: 'game_clips',
        row: {
          ...who,
          title,
          caption: description,
          clip_url: file.publicUrl,
          thumbnail_url: image,
          metadata: source,
        },
      };
    case 'store-product':
    case 'store-digital': {
      const isDigital = route === 'store-digital';
      return {
        table: 'products',
        row: {
          seller_id: user.id,
          title,
          description,
          category: isDigital ? 'digital' : 'general',
          product_type: isDigital ? 'digital' : 'physical',
          fulfillment_type: isDigital ? 'download' : 'shipping',
          image_url: image,
          cover_url: image,
          media_url: file.publicUrl || null,
          preview_url: image,
          digital_file_url: isDigital ? file.publicUrl : null,
          is_digital: isDigital,
          is_public: true,
          status: 'active',
          price_cents: 0,
          currency: 'usd',
          metadata: source,
        },
      };
    }
    default:
      throw new Error(`Unsupported upload route: ${route}`);
  }
}

async function submitUpload(event) {
  event.preventDefault();
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  let upload = null;

  try {
    await auth();
    if (!user) {
      location.href = '/auth.html?next=/upload.html';
      return;
    }

    const title = $('#dropTitle')?.value?.trim() || 'Rich Bizness Drop';
    const description = $('#dropCaption')?.value?.trim() || '';
    const file = await uploadFile();
    validateRouteFile(selectedRoute, file);

    upload = await insert('uploads', {
      user_id: user.id,
      title,
      description,
      section: selectedRoute,
      category: selectedRoute,
      bucket: file.bucket,
      file_path: file.filePath,
      public_url: file.publicUrl,
      mime_type: file.mimeType,
      file_size: file.fileSize,
      media_type: file.mediaType,
      visibility: 'public',
      processing_status: 'routing',
      metadata: meta(file),
    });

    const target = routePayload(selectedRoute, title, description, file, upload);
    const routed = await insert(target.table, target.row);

    await updateUpload(upload.id, {
      processing_status: 'completed',
      metadata: meta({
        ...file,
        target_table: target.table,
        target_id: routed.id,
      }),
    });

    await awardXp('drop_zone_upload', {
      section: selectedRoute,
      sourceTable: target.table,
      sourceId: routed.id,
    }).catch(() => {});

    if ($('#dropStatus')) $('#dropStatus').textContent = `Uploaded to ${selectedRoute}.`;
    event.target.reset();
    pickedFile = null;
  } catch (error) {
    await updateUpload(upload?.id, {
      processing_status: 'failed',
      metadata: meta({ error: error.message || String(error) }),
    });
    if ($('#dropStatus')) $('#dropStatus').textContent = error.message || String(error);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function submitFeed(event) {
  event.preventDefault();
  try {
    await auth();
    if (!user) {
      location.href = '/auth.html?next=/feed.html';
      return;
    }
    const title = $('#feedTitle')?.value?.trim() || 'Rich Bizness Post';
    const body = $('#feedBody')?.value?.trim() || '';
    const media = $('#feedMedia')?.value?.trim() || '';
    const post = await insert('feed_posts', {
      ...identity(),
      title,
      body,
      media_url: media || null,
      section: 'feed',
      post_type: media ? 'media' : 'text',
      visibility: 'public',
      metadata: meta({ source: 'feed-composer' }),
    });
    await awardXp('feed_post_create', {
      section: 'feed',
      sourceTable: 'feed_posts',
      sourceId: post.id,
    }).catch(() => {});
    event.target.reset();
    loadFeed();
  } catch (error) {
    if ($('#dropStatus')) $('#dropStatus').textContent = error.message || String(error);
  }
}

function postCard(post) {
  const author = esc(post.display_name || post.username || 'Rich Bizness');
  const handle = esc(post.username ? `@${post.username}` : 'profile');
  const media = post.media_url ? `<div class="df-post-media"><img src="${esc(post.media_url)}" alt=""></div>` : '';
  return `<article class="df-post"><a class="df-author" href="${authProfileUrl(post)}"><span>${author.slice(0, 2).toUpperCase()}</span><b>${author}</b><small>${handle}</small></a><h3>${esc(post.title || 'Rich Bizness Post')}</h3><p>${esc(post.body || '')}</p>${media}</article>`;
}

async function loadFeed() {
  if (isUpload) return;
  const { data, error } = await supabase.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(24);
  if (error) {
    if ($('#dropStatus')) $('#dropStatus').textContent = error.message;
    return;
  }
  const list = $('#dfFeedList');
  if ($('#recordCount')) $('#recordCount').textContent = String((data || []).length);
  if (list) list.innerHTML = (data || []).map(postCard).join('') || '<div class="df-status">No feed posts yet.</div>';
}

mount();
auth().catch(() => {});
loadFeed();

if (!isUpload) {
  const channel = supabase
    .channel('drop-feed-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, loadFeed)
    .subscribe();
  window.addEventListener('pagehide', () => supabase.removeChannel(channel), { once: true });
}

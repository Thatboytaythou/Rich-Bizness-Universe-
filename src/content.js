import { supabase } from './supabase-client.js';

const page = document.body.dataset.contentPage || 'feed';
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ''), location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
const fileType = (file) => String(file?.type || '').split('/')[0] || 'file';
const ext = (file) => String(file?.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
const slug = (value) => String(value || 'drop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'drop';

let user = null;
let profile = null;
let selectedFile = null;
let objectUrl = '';
let busy = false;
let disposed = false;
let reloadTimer = null;
let loading = false;
let queued = false;
let activeFilter = page === 'gallery' ? 'gallery' : 'all';
let channels = [];

function setStatus(message, tone = 'ready') {
  const node = $('#contentStatus');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function setProgress(value) {
  const fill = $('#progressFill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function cleanupPreview() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
}

function mediaMarkup(url, type = '') {
  const safe = safeUrl(url);
  if (!safe) return '';
  if (type === 'video') return `<div class="post-media"><video src="${esc(safe)}" controls playsinline preload="metadata"></video></div>`;
  if (type === 'audio') return `<div class="post-media"><audio src="${esc(safe)}" controls preload="metadata"></audio></div>`;
  return `<div class="post-media"><img src="${esc(safe)}" alt="" loading="lazy" decoding="async"></div>`;
}

function postCard(row) {
  const url = row.media_url || row.file_url || row.public_url || row.cover_url || '';
  const type = row.media_type || (String(row.mime_type || '').split('/')[0]) || 'image';
  const title = row.title || row.display_name || 'Rich Bizness Drop';
  const body = row.body || row.description || '';
  const author = row.display_name || row.username || 'Rich Bizness Member';
  const when = row.created_at ? new Date(row.created_at).toLocaleString() : '';
  return `<article class="post" data-id="${esc(row.id || '')}">
    ${mediaMarkup(url, type)}
    <div class="post-body">
      <div class="post-top"><div><h3>${esc(title)}</h3><small>${esc(author)}</small></div><small>${esc(row.section || 'feed')}</small></div>
      ${body ? `<p>${esc(body)}</p>` : ''}
      <div class="post-meta"><span>${esc(when)}</span><span>${Number(row.like_count || row.likes || 0).toLocaleString()} likes</span><span>${Number(row.comment_count || 0).toLocaleString()} comments</span><span>${Number(row.view_count || row.views || 0).toLocaleString()} views</span></div>
      <div class="post-actions"><button type="button" data-action="like">LIKE</button><button type="button" data-action="comment">COMMENT</button><button type="button" data-action="share">SHARE</button></div>
    </div>
  </article>`;
}

async function resolveIdentity() {
  const { data: auth } = await supabase.auth.getUser();
  user = auth?.user || null;
  if (!user) return;
  const { data } = await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('id', user.id).maybeSingle();
  profile = data || null;
}

async function loadRows() {
  if (!supabase || loading) { queued = true; return; }
  loading = true;
  queued = false;
  setStatus('SYNCING CONTENT');
  try {
    let query;
    if (page === 'upload') {
      if (!user) {
        $('#contentFeed').innerHTML = '<div class="empty">Tap in to manage your drops.</div>';
        $('#contentMetric').textContent = '0';
        setStatus('TAP IN REQUIRED', 'error');
        return;
      }
      query = supabase.from('uploads').select('*', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
    } else {
      query = supabase.from('feed_posts').select('*', { count: 'exact' }).eq('visibility', 'public').order('created_at', { ascending: false }).limit(40);
      if (activeFilter !== 'all') query = query.eq('section', activeFilter);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    if (disposed) return;
    const rows = data || [];
    $('#contentMetric').textContent = Number(count ?? rows.length).toLocaleString();
    $('#contentFeed').innerHTML = rows.length ? rows.map(postCard).join('') : '<div class="empty">This lane is ready for its first drop.</div>';
    setStatus('CONNECTED • ONE CONTENT OWNER');
  } catch (error) {
    setStatus(`SYNC ERROR • ${error.message}`, 'error');
  } finally {
    loading = false;
    if (queued && !disposed) loadRows();
  }
}

function scheduleLoad() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(loadRows, 180);
}

function chooseFile(file) {
  selectedFile = file || null;
  cleanupPreview();
  const preview = $('#filePreview');
  if (!preview) return;
  if (!file) {
    preview.innerHTML = '<span class="empty">Preview appears here</span>';
    return;
  }
  objectUrl = URL.createObjectURL(file);
  const type = fileType(file);
  if (type === 'image') preview.innerHTML = `<img src="${esc(objectUrl)}" alt="Selected upload preview">`;
  else if (type === 'video') preview.innerHTML = `<video src="${esc(objectUrl)}" controls playsinline></video>`;
  else if (type === 'audio') preview.innerHTML = `<audio src="${esc(objectUrl)}" controls></audio>`;
  else preview.innerHTML = `<span class="empty">${esc(file.name)}</span>`;
}

async function routeConfig(routeKey) {
  const { data, error } = await supabase.from('storage_bucket_routes').select('*').eq('route_key', routeKey).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('UPLOAD ROUTE NOT CONFIGURED');
  return data;
}

async function submitUpload(event) {
  event.preventDefault();
  if (busy || !supabase) return;
  if (!user) return setStatus('TAP IN BEFORE UPLOADING', 'error');
  if (!selectedFile) return setStatus('CHOOSE A FILE FIRST', 'error');

  const routeKey = $('#routeKey')?.value || 'feed';
  const title = String($('#dropTitle')?.value || '').trim();
  const description = String($('#dropDescription')?.value || '').trim();
  const visibility = $('#dropVisibility')?.value || 'public';
  if (!title) return setStatus('ADD A TITLE', 'error');

  busy = true;
  $('#dropSubmit').disabled = true;
  setProgress(8);
  setStatus('PREPARING DROP');
  let storage = null;
  try {
    const route = await routeConfig(routeKey);
    const maxBytes = Number(route.max_file_size_mb || 300) * 1024 * 1024;
    if (selectedFile.size > maxBytes) throw new Error(`FILE LIMIT IS ${route.max_file_size_mb} MB`);
    const allowed = route.media_type || 'mixed';
    const type = fileType(selectedFile);
    if (allowed !== 'mixed' && allowed !== 'file' && allowed !== type) throw new Error(`${allowed.toUpperCase()} FILE REQUIRED`);

    const path = `${user.id}/${Date.now()}-${slug(title)}.${ext(selectedFile)}`;
    setProgress(28);
    setStatus('UPLOADING MEDIA');
    const { error: uploadError } = await supabase.storage.from(route.bucket).upload(path, selectedFile, { cacheControl: '3600', upsert: false, contentType: selectedFile.type || undefined });
    if (uploadError) throw uploadError;
    storage = { bucket: route.bucket, path };

    let publicUrl = '';
    if (route.is_public) publicUrl = supabase.storage.from(route.bucket).getPublicUrl(path).data.publicUrl || '';
    if (!publicUrl) throw new Error('PUBLIC MEDIA URL REQUIRED FOR THIS CONTENT LANE');

    setProgress(58);
    setStatus('REGISTERING DROP');
    const uploadRow = {
      user_id: user.id,
      category: routeKey,
      section: route.section,
      title,
      description,
      bucket: route.bucket,
      file_path: path,
      public_url: publicUrl,
      mime_type: selectedFile.type || null,
      file_size: selectedFile.size,
      media_type: type,
      visibility,
      processing_status: 'completed',
      metadata: { route_key: routeKey, source: 'content-owner' }
    };
    const { data: insertedUpload, error: uploadRowError } = await supabase.from('uploads').insert(uploadRow).select('id').single();
    if (uploadRowError) throw uploadRowError;

    if (route.section === 'feed' || route.section === 'gallery') {
      const post = {
        user_id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'member',
        display_name: profile?.display_name || user.user_metadata?.display_name || 'Rich Bizness Member',
        title,
        body: description,
        media_url: publicUrl,
        file_url: publicUrl,
        media_type: type,
        section: route.section,
        visibility,
        post_type: type,
        metadata: { upload_id: insertedUpload.id, route_key: routeKey }
      };
      const { error: postError } = await supabase.from('feed_posts').insert(post);
      if (postError) throw postError;
    }

    setProgress(100);
    setStatus('DROP LIVE');
    event.currentTarget.reset();
    chooseFile(null);
    scheduleLoad();
    setTimeout(() => setProgress(0), 900);
  } catch (error) {
    if (storage) await supabase.storage.from(storage.bucket).remove([storage.path]);
    setProgress(0);
    setStatus(`UPLOAD FAILED • ${error.message}`, 'error');
  } finally {
    busy = false;
    $('#dropSubmit').disabled = false;
  }
}

function startRealtime() {
  const specs = page === 'upload'
    ? [{ table: 'uploads', filter: user ? `user_id=eq.${user.id}` : undefined }]
    : [{ table: 'feed_posts', filter: activeFilter !== 'all' ? `section=eq.${activeFilter}` : undefined }];
  specs.forEach((spec, index) => {
    const config = { event: '*', schema: 'public', table: spec.table };
    if (spec.filter) config.filter = spec.filter;
    const channel = supabase.channel(`rb-content:${page}:${index}`).on('postgres_changes', config, scheduleLoad).subscribe();
    channels.push(channel);
  });
}

function bind() {
  $('#dropForm')?.addEventListener('submit', submitUpload);
  $('#dropFile')?.addEventListener('change', (event) => chooseFile(event.target.files?.[0]));
  const zone = $('#dropZone');
  zone?.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('drag'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone?.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('drag'); chooseFile(event.dataTransfer.files?.[0]); });
  document.addEventListener('click', async (event) => {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      activeFilter = filter.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((node) => node.setAttribute('aria-pressed', String(node === filter)));
      channels.forEach((channel) => supabase.removeChannel(channel));
      channels = [];
      loadRows();
      startRealtime();
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const card = action.closest('[data-id]');
    if (action.dataset.action === 'share' && card?.dataset.id) {
      const url = `${location.origin}/feed.html?post=${encodeURIComponent(card.dataset.id)}`;
      if (navigator.share) await navigator.share({ title: 'Rich Bizness Drop', url }).catch(() => {});
      else await navigator.clipboard?.writeText(url);
      setStatus('SHARE LINK READY');
    }
  });
}

function cleanup() {
  disposed = true;
  clearTimeout(reloadTimer);
  cleanupPreview();
  channels.forEach((channel) => supabase.removeChannel(channel));
  channels = [];
}

async function boot() {
  if (!supabase) return setStatus('SUPABASE ENV VARIABLES REQUIRED', 'error');
  try {
    await resolveIdentity();
    bind();
    await loadRows();
    startRealtime();
    window.addEventListener('pagehide', cleanup, { once: true });
  } catch (error) {
    setStatus(`BOOT FAILED • ${error.message}`, 'error');
  }
}

boot();
import { supabase } from './supabase-client.js';

const $ = (selector) => document.querySelector(selector);
const list = $('#sectionCards');
const count = $('#recordCount');
const imageCount = $('#imageCount');
const videoCount = $('#videoCount');

let loading = false;
let reloadTimer = null;
let channel = null;

const mediaOf = (row) => row.media_url || row.public_url || row.thumbnail_url || row.cover_url || row.image_url || row.file_url || '';
const typeOf = (row) => row.media_type || row.post_type || row.mime_type || 'image';
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function card(row) {
  const url = mediaOf(row);
  const type = String(typeOf(row));
  const visual = url
    ? (type.includes('video')
      ? `<video src="${esc(url)}" muted playsinline controls></video>`
      : `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`)
    : '';

  return `<article class="card gallery-card ${row.is_featured ? 'featured' : ''}">${visual}<b>${esc(row.title || row.caption || 'Gallery Visual')}</b><p>${esc(row.body || row.description || row.caption || 'Rich Bizness visual drop.')}</p><small>${esc(row.display_name || row.username || 'Gallery')} • ${esc(row.section || row.category || 'gallery')} • ${Number(row.view_count || 0).toLocaleString()} views</small></article>`;
}

function paint(rows, error) {
  if (count) count.textContent = rows.length.toLocaleString();
  if (imageCount) imageCount.textContent = rows.filter((row) => !String(typeOf(row)).includes('video')).length.toLocaleString();
  if (videoCount) videoCount.textContent = rows.filter((row) => String(typeOf(row)).includes('video')).length.toLocaleString();
  if (list) list.innerHTML = error
    ? `<div class="empty">${esc(error.message || error)}</div>`
    : rows.length
      ? rows.map(card).join('')
      : '<div class="empty">No gallery drops yet.</div>';
}

async function loadGallery() {
  if (loading) return;
  loading = true;
  try {
    let result = await supabase
      .from('feed_posts')
      .select('*')
      .eq('section', 'gallery')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(36);

    let rows = result.data || [];
    let error = result.error;

    if (error || !rows.length) {
      result = await supabase
        .from('uploads')
        .select('*')
        .eq('section', 'gallery')
        .order('created_at', { ascending: false })
        .limit(36);
      rows = result.data || [];
      error = result.error;
    }

    paint(rows, error);
  } finally {
    loading = false;
  }
}

function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(loadGallery, 180);
}

function startRealtime() {
  if (channel) return;
  channel = supabase
    .channel('gallery-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts', filter: 'section=eq.gallery' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads', filter: 'section=eq.gallery' }, scheduleReload)
    .subscribe();
}

function cleanup() {
  clearTimeout(reloadTimer);
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

window.addEventListener('pagehide', cleanup, { once: true });
loadGallery().then(startRealtime).catch((error) => paint([], error));

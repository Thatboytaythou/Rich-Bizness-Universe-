import { supabase } from './supabase-client.js';

const page = document.body.dataset.page || 'home';
const table = document.body.dataset.table || '';
const titleField = document.body.dataset.titleField || 'title';
const subtitleField = document.body.dataset.subtitleField || 'description';
const imageField = document.body.dataset.imageField || '';
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ''), location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

let disposed = false;
let channel = null;
let reloadTimer = null;
let loading = false;

function setStatus(message, tone = 'ready') {
  const node = $('#pageStatus');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function card(row) {
  const title = row[titleField] || row.display_name || row.username || `${page} record`;
  const subtitle = row[subtitleField] || row.status || row.category || row.created_at || 'Rich Bizness';
  const image = safeUrl(imageField ? row[imageField] : '');
  const media = image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async" style="width:54px;height:54px;object-fit:cover;border-radius:16px">` : `<span class="rb-card-media">RB</span>`;
  return `<article class="rb-card">${media}<span><b>${esc(title)}</b><small>${esc(subtitle)}</small></span><span>›</span></article>`;
}

async function load() {
  if (!supabase || !table || loading) return;
  loading = true;
  setStatus('SYNCING WITH RICH BIZNESS');
  try {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(18);
    if (error) throw error;
    if (disposed) return;
    const rows = data || [];
    const metric = $('#pageMetric');
    if (metric) metric.textContent = Number(count ?? rows.length).toLocaleString();
    const list = $('#pageList');
    if (list) list.innerHTML = rows.length ? rows.map(card).join('') : `<div class="rb-empty">This lane is live and ready for its first drop.</div>`;
    setStatus('CONNECTED • ONE OWNER');
  } catch (error) {
    if (!disposed) setStatus(`SYNC ERROR • ${error.message}`, 'error');
  } finally {
    loading = false;
  }
}

function scheduleLoad() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(load, 180);
}

function startRealtime() {
  if (!supabase || !table) return;
  channel = supabase
    .channel(`rb-section:${page}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, scheduleLoad)
    .subscribe();
}

function cleanup() {
  disposed = true;
  clearTimeout(reloadTimer);
  if (channel) supabase.removeChannel(channel);
  channel = null;
}

function boot() {
  document.documentElement.dataset.rbPage = page;
  if (!supabase) {
    setStatus('ADD SUPABASE ENV VARIABLES', 'error');
    return;
  }
  load();
  startRealtime();
  window.addEventListener('pagehide', cleanup, { once: true });
}

boot();

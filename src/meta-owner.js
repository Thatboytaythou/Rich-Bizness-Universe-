import { supabase } from './supabase-client.js';
import { ensureProfile, getMetaAvatar, getSessionUser } from './rb-identity.js?v=profile-avatar-separate-1';
import '../features/meta/systems.js?v=meta-systems-2';

const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

let user = null;
let profile = null;
let meta = null;
let worlds = [];
let activeWorld = null;
let position = { x: 0, y: 0, z: 0 };
let channel = null;
let loadFlight = null;
let reloadTimer = null;

function say(text) {
  const el = $('#metaStatus');
  if (el) el.textContent = text;
}

function imageFor(row) {
  return row?.cover_url || row?.background_url || row?.thumbnail_url || row?.image_url || '';
}

function paintAvatar() {
  const avatar = $('#metaAvatar');
  if (!avatar) return;
  const url = meta?.avatar_url || '';
  const name = meta?.metadata?.selectedCharacter || meta?.display_name || 'RB Avatar';
  if ($('#avatarState')) $('#avatarState').textContent = name.split(' ')[0] || 'READY';
  if (url) {
    avatar.classList.remove('fallback');
    avatar.innerHTML = `<img src="${esc(url)}" alt="${esc(name)}">`;
  } else {
    avatar.classList.add('fallback');
    avatar.textContent = 'RB';
  }
  avatar.style.transform = `translate(calc(-50% + ${Number(position.x || 0)}px),calc(-50% + ${Number(position.y || 0)}px)) scale(${1 + Number(position.z || 0) * 0.03})`;
}

function worldCard(row, index) {
  const image = imageFor(row);
  return `<article class="card world-card ${activeWorld?.id === row.id ? 'active' : ''}" data-world-index="${index}">${image ? `<img src="${esc(image)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:16px;margin-bottom:10px">` : ''}<b>${esc(row.title || row.name || 'Meta World')}</b><p>${esc(row.description || 'Rich Bizness world lane.')}</p><small>${esc(row.world_type || row.theme || 'meta')} • ${esc(row.status || 'ready')}</small></article>`;
}

async function savePosition() {
  if (!user || !profile) return;
  const { error } = await supabase.from('meta_avatars').upsert({
    user_id: user.id,
    display_name: profile.display_name,
    avatar_url: meta?.avatar_url || '',
    aura: meta?.aura || 'Emerald Gold',
    rank: profile.rank_title || 'BIZ LEGEND',
    level: profile.rich_level || 1,
    xp: profile.rich_points || 0,
    current_world_id: activeWorld?.id || null,
    position: { world: activeWorld?.slug || activeWorld?.title || 'portal-hub', ...position },
    is_active: true,
    metadata: { ...(meta?.metadata || {}), lastMetaMove: new Date().toISOString() },
  }, { onConflict: 'user_id' });
  if (error) say(error.message);
}

function bindWorldCards() {
  document.querySelectorAll('[data-world-index]').forEach((node) => {
    node.addEventListener('click', async () => {
      activeWorld = worlds[Number(node.dataset.worldIndex)] || activeWorld;
      say(`Entered ${activeWorld?.title || 'Meta World'}`);
      await renderWorlds();
      await savePosition();
    });
  });
}

async function renderWorlds(force = false) {
  if (loadFlight && !force) return loadFlight;
  loadFlight = supabase.from('meta_worlds').select('*').order('created_at', { ascending: true }).limit(24)
    .then(({ data, error }) => {
      if (error) throw error;
      worlds = data || [];
      activeWorld = worlds.find((row) => row.id === activeWorld?.id) || worlds[0] || null;
      if ($('#recordCount')) $('#recordCount').textContent = worlds.length.toLocaleString();
      if ($('#worldState')) $('#worldState').textContent = activeWorld?.title || 'Portal';
      const cards = $('#sectionCards');
      if (cards) cards.innerHTML = worlds.length ? worlds.map(worldCard).join('') : '<div class="empty">No meta worlds yet.</div>';
      bindWorldCards();
      if (activeWorld) window.dispatchEvent(new CustomEvent('rb:meta-world-selected', { detail: { world: activeWorld } }));
    })
    .catch((error) => say(error.message || String(error)))
    .finally(() => { loadFlight = null; });
  return loadFlight;
}

function scheduleWorldReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => renderWorlds(true), 180);
}

function bindControls() {
  document.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', async () => {
      const move = button.dataset.move;
      if (move === 'watch') {
        location.href = '/watch.html';
        return;
      }
      if (move === 'portal') position = { x: 0, y: 0, z: 0 };
      if (move === 'left') position.x -= 24;
      if (move === 'right') position.x += 24;
      if (move === 'up') position.y -= 20;
      if (move === 'down') position.y += 20;
      paintAvatar();
      await savePosition();
    });
  });
}

async function boot() {
  user = await getSessionUser();
  if (!user) {
    location.href = '/auth.html?next=/meta.html';
    return;
  }
  profile = await ensureProfile(user);
  meta = await getMetaAvatar(user.id).catch(() => null);
  position = meta?.position && typeof meta.position === 'object' ? { ...position, ...meta.position } : position;
  paintAvatar();
  bindControls();
  await renderWorlds();
  say('Avatar presence connected.');
  channel = supabase.channel('meta-avatar-world-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_worlds' }, scheduleWorldReload)
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
boot().catch((error) => say(error.message || String(error)));

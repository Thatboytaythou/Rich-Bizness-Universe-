import { supabase } from './supabase-client.js';
import { RB_SECTIONS, RB_ALL_TABLES } from './rb-schema-map.js';
import './xp-gauge.js';

const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmt = (n) => Number(n || 0).toLocaleString();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const state = { user: null, profile: null, avatar: null, counts: {}, refreshing: false, refreshQueued: false };

function statusCells() { const cells = $$('.status span'); return { live: cells[0]?.querySelector('b'), online: cells[1]?.querySelector('b') }; }
function setText(selector, value) { $$(selector).forEach((el) => { el.textContent = value; }); }
function initials(name = 'RB') { return String(name).split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'RB'; }
function paintAvatarTarget(el, url, label) { if (!el) return; el.textContent = url ? '' : initials(label); el.style.backgroundImage = url ? `url("${url}")` : ''; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
function setAuthLanguage(signedIn) {
  setText('[data-auth-label]', signedIn ? 'TAPPED IN' : 'TAP IN');
  setText('[data-auth-status]', signedIn ? 'TAPPED IN' : 'TAP IN READY');
  document.body.dataset.rbAuthState = signedIn ? 'tapped-in' : 'tap-in-ready';
}
function setAvatarChip(url, label) {
  const cleanLabel = label || 'Rich Bizness';
  const chips = [document.querySelector('.status i'), document.querySelector('[data-route="profile"]'), ...$$('[data-profile-avatar]')].filter(Boolean);
  chips.forEach((chip) => paintAvatarTarget(chip, url, cleanLabel));
  setText('[data-profile-name]', cleanLabel);
}
function clearShellPlaceholders() {
  const status = statusCells();
  [status.live, status.online].forEach((el) => { if (el) el.textContent = '0'; });
  setText('[data-live-count]', '0');
  setText('[data-online-count]', '0');
  setText('[data-profile-name]', 'Rich Bizness');
  setAuthLanguage(false);
  updateXpGauge({ rich_points: 0, rich_level: 1, rank_title: 'BIZ LEGEND' });
  setAvatarChip('', 'RB');
}
function setLiveCount(value) { const text = fmt(value); const status = statusCells(); if (status.live) status.live.textContent = text; setText('[data-live-count]', text); }
function setOnlineCount(value) { const text = fmt(value); const status = statusCells(); if (status.online) status.online.textContent = text; setText('[data-online-count]', text); }
function updateXpGauge(profile = {}) {
  const points = Number(profile.rich_points ?? profile.xp ?? state.avatar?.xp ?? 0);
  const level = Number(profile.rich_level ?? state.avatar?.level ?? 1) || 1;
  const next = Math.max(1000, level * 1000);
  const percent = clamp((points % 1000) / 1000, 0, 1) * 100;
  setText('[data-xp-level]', `LEVEL ${level}`);
  setText('[data-xp-current]', `${fmt(points)} XP`);
  setText('[data-xp-next]', `${fmt(next)} XP NEXT`);
  setText('[data-xp-rank]', profile.rank_title || profile.rank || 'BIZ LEGEND');
  $$('[data-xp-fill], .xp-track em').forEach((el) => { el.style.width = `${percent}%`; });
}
async function countTable(table) {
  try { const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }); if (!error && typeof count === 'number') { state.counts[table] = count; return count; } }
  catch (error) { console.warn('[RB realtime] count failed:', table, error); }
  return state.counts[table] || 0;
}
async function loadSectionCounts() {
  await Promise.all(RB_SECTIONS.map(async (section) => {
    const count = await countTable(section.primaryTable || section.tables[0]);
    const text = fmt(count);
    $$(`[data-route="${section.key}"], [data-section="${section.key}"]`).forEach((card) => { card.dataset.recordCount = text; card.dataset.recordLabel = section.stat || section.title; card.classList.add('is-live-data'); card.classList.remove('is-synced'); });
  }));
}
async function loadSessionProfile() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    state.user = user || null;
    setAuthLanguage(Boolean(user));
    if (!user) { state.profile = null; state.avatar = null; updateXpGauge({ rich_points: 0, rich_level: 1, rank_title: 'BIZ LEGEND' }); setAvatarChip('', 'Rich Bizness'); return; }
    const [{ data: profileData }, { data: avatarData }] = await Promise.all([
      supabase.from('profiles').select('display_name,username,avatar_url,rich_level,rank_title,rich_points,online_status').eq('id', user.id).maybeSingle(),
      supabase.from('meta_avatars').select('display_name,avatar_url,aura,rank,level,xp,metadata').eq('user_id', user.id).maybeSingle(),
    ]);
    state.profile = profileData || null;
    state.avatar = avatarData || null;
    const name = profileData?.display_name || avatarData?.display_name || profileData?.username || user.email?.split('@')[0] || 'Rich Bizness';
    setAvatarChip(profileData?.avatar_url || avatarData?.avatar_url, name);
    updateXpGauge(profileData || avatarData || {});
  } catch (error) { console.warn('[RB realtime] profile failed:', error); updateXpGauge({ rich_points: 0, rich_level: 1, rank_title: 'BIZ LEGEND' }); }
}
async function refreshUniverse() {
  if (state.refreshing) { state.refreshQueued = true; return; }
  state.refreshing = true;
  try {
    await Promise.all([
      countTable('live_streams').then(setLiveCount),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('online_status', 'online').then(({ count }) => setOnlineCount(count || state.counts.profiles || 0)).catch(() => countTable('profiles').then(setOnlineCount)),
      loadSessionProfile(),
      loadSectionCounts(),
    ]);
  } finally { state.refreshing = false; if (state.refreshQueued) { state.refreshQueued = false; window.setTimeout(refreshUniverse, 180); } }
}
function subscribeRealtime() {
  const channel = supabase.channel('rich-bizness-universe-all-sections');
  RB_ALL_TABLES.forEach((table) => { channel.on('postgres_changes', { event: '*', schema: 'public', table }, refreshUniverse); });
  channel.subscribe((status) => console.info('[RB realtime]', status));
}
supabase.auth.onAuthStateChange(() => refreshUniverse());
clearShellPlaceholders();
refreshUniverse();
subscribeRealtime();

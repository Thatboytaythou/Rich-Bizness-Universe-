import { supabase } from './supabase-client.js';

const fmt = (n) => Number(n || 0).toLocaleString();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let xpChannel = null;
let xpUserId = null;
let xpBooted = false;
let xpAuthListenerInstalled = false;
let xpLoading = null;

const RANKS = [
  [0, 'ROOKIE RICH'],
  [1000, 'ON THE COME UP'],
  [5000, 'RICH RUNNER'],
  [10000, 'BIZ BUILDER'],
  [25000, 'BIZ LEGEND'],
  [50000, 'RICH ELITE'],
  [100000, 'RICH BOSS'],
  [250000, 'RICH ICON'],
  [500000, 'RICH UNIVERSE'],
  [1000000, 'MAX RICH']
];

function levelFromXp(total) {
  const xp = Math.max(0, Number(total || 0));
  return Math.max(1, Math.floor(Math.sqrt(xp / 250)) + 1);
}

function boundsForLevel(level) {
  const lvl = Math.max(1, Number(level || 1));
  const start = Math.pow(lvl - 1, 2) * 250;
  const next = Math.pow(lvl, 2) * 250;
  return { start, next };
}

function rankFromXp(total, fallback) {
  const xp = Number(total || 0);
  const rank = RANKS.slice().reverse().find(([min]) => xp >= min)?.[1];
  return fallback && fallback !== 'BIZ LEGEND' ? fallback : rank || 'ROOKIE RICH';
}

export function xpMath(profile = {}, levelRow = {}, avatar = {}) {
  const total = Number(levelRow.xp_total ?? levelRow.rich_points ?? profile.rich_points ?? avatar.xp ?? 0);
  const calculatedLevel = levelFromXp(total);
  const level = Number(levelRow.level ?? profile.rich_level ?? avatar.level ?? calculatedLevel) || calculatedLevel;
  const bounds = boundsForLevel(level);
  const current = Number(levelRow.xp_current ?? Math.max(0, total - bounds.start));
  const next = Number(levelRow.xp_next ?? Math.max(1, bounds.next - bounds.start));
  const progress = clamp(current / next, 0, 1) * 100;
  const richPoints = Number(levelRow.rich_points ?? profile.rich_points ?? total);
  const rank = rankFromXp(total, levelRow.rank_title || profile.rank_title || avatar.rank);
  return { total, level, current, next, progress, rank, points: richPoints, coins: Number(levelRow.coins ?? 0), trust: Number(levelRow.trust_score ?? profile.trust_score ?? 100) };
}

export function cleanXpMoneyArtifacts() {
  document.getElementById('globalXpBadge')?.remove();
  document.getElementById('xpToast')?.remove();
  document.querySelectorAll('.rb-xp-float, .rb-xp-toast, [data-rb-xp-injected="true"]').forEach((el) => el.remove());
  document.body?.removeAttribute('data-rich-money');
}

export function renderXp(xp = {}) {
  cleanXpMoneyArtifacts();
  const data = xpMath(xp.profile, xp.levelRow, xp.avatar);
  document.querySelectorAll('[data-xp-level]').forEach((el) => { el.textContent = `LEVEL ${data.level}`; });
  document.querySelectorAll('[data-xp-rank]').forEach((el) => { el.textContent = data.rank; });
  document.querySelectorAll('[data-xp-total]').forEach((el) => { el.textContent = `${fmt(data.total)} XP`; });
  document.querySelectorAll('[data-xp-current]').forEach((el) => { el.textContent = `${fmt(data.current)} / ${fmt(data.next)}`; });
  document.querySelectorAll('[data-xp-next]').forEach((el) => { el.textContent = `${fmt(data.next)} XP NEXT`; });
  document.querySelectorAll('[data-rich-points]').forEach((el) => { el.textContent = fmt(data.points); });
  document.querySelectorAll('[data-rich-coins]').forEach((el) => { el.textContent = fmt(data.coins); });
  document.querySelectorAll('[data-xp-trust]').forEach((el) => { el.textContent = fmt(data.trust); });
  document.querySelectorAll('[data-xp-fill], .xp-track em, .xp i, #xpFill').forEach((el) => { el.style.width = `${data.progress}%`; });
  document.body.dataset.richLevel = String(data.level);
  document.body.dataset.richRank = data.rank;
  window.dispatchEvent(new CustomEvent('rb-xp-rendered', { detail: data }));
  return data;
}

export async function loadXp(userId) {
  if (!userId) return renderXp({});
  if (xpLoading) return xpLoading;
  xpLoading = Promise.all([
    supabase.from('profiles').select('rich_points,rich_level,rank_title,trust_score').eq('id', userId).maybeSingle(),
    supabase.from('user_levels').select('level,xp_total,xp_current,xp_next,rank_title,rich_points,coins,trust_score').eq('user_id', userId).maybeSingle(),
    supabase.from('meta_avatars').select('level,xp,rank').eq('user_id', userId).maybeSingle(),
  ]).then(([{ data: profile }, { data: levelRow }, { data: avatar }]) => renderXp({ profile: profile || {}, levelRow: levelRow || {}, avatar: avatar || {} })).finally(() => { xpLoading = null; });
  return xpLoading;
}

export async function loadCurrentXp() {
  const { data } = await supabase.auth.getUser();
  return loadXp(data?.user?.id);
}

export function installRealtimeXp(userId) {
  if (!userId || xpUserId === userId) return;
  if (xpChannel) supabase.removeChannel(xpChannel);
  xpUserId = userId;
  xpChannel = supabase.channel('rb-xp-realtime-' + userId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId }, () => loadXp(userId))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_levels', filter: 'user_id=eq.' + userId }, () => loadXp(userId))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_avatars', filter: 'user_id=eq.' + userId }, () => loadXp(userId))
    .subscribe();
}

export async function awardXp(eventKey = 'section_visit', opts = {}) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return { ok: false, reason: 'not_signed_in' };
  installRealtimeXp(data.user.id);
  const payload = {
    p_event_key: eventKey,
    p_section: opts.section || document.body?.dataset?.section || 'global',
    p_source_table: opts.sourceTable || null,
    p_source_id: opts.sourceId || null,
    p_amount: opts.amount || null,
  };
  const { data: award, error } = await supabase.rpc('rb_award_xp', payload);
  if (error) { console.warn('[RB XP] award failed', error.message); return { ok: false, reason: error.message }; }
  await loadXp(data.user.id);
  window.dispatchEvent(new CustomEvent('rb-xp-awarded', { detail: { eventKey, award } }));
  return award;
}

export function showXpToast() { cleanXpMoneyArtifacts(); }
export function installXpBadge() { cleanXpMoneyArtifacts(); }

export async function bootXp(eventKey) {
  cleanXpMoneyArtifacts();
  if (xpBooted && !eventKey) return loadCurrentXp();
  xpBooted = true;
  const { data } = await supabase.auth.getUser();
  if (data?.user?.id) installRealtimeXp(data.user.id);
  await loadCurrentXp();
  if (eventKey) awardXp(eventKey).catch(() => {});
  if (!xpAuthListenerInstalled) {
    xpAuthListenerInstalled = true;
    supabase.auth.onAuthStateChange((_event, session) => { if (session?.user?.id) installRealtimeXp(session.user.id); loadCurrentXp(); });
  }
}

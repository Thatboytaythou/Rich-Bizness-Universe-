import { supabase } from './supabase-client.js';

const fmt = (n) => Number(n || 0).toLocaleString();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function xpMath(profile = {}, levelRow = {}, avatar = {}) {
  const total = Number(levelRow.xp_total ?? profile.rich_points ?? avatar.xp ?? 0);
  const level = Number(levelRow.level ?? profile.rich_level ?? avatar.level ?? Math.floor(total / 1000) + 1) || 1;
  const current = Number(levelRow.xp_current ?? (total % 1000));
  const next = Number(levelRow.xp_next ?? level * 1000) || 1000;
  const progress = clamp(current / 1000, 0, 1) * 100;
  const richPoints = Number(levelRow.rich_points ?? profile.rich_points ?? total);
  return { total, level, current, next, progress, rank: levelRow.rank_title || profile.rank_title || avatar.rank || 'BIZ LEGEND', points: richPoints, coins: Number(levelRow.coins ?? 0) };
}

export function cleanXpMoneyArtifacts() {
  document.getElementById('globalXpBadge')?.remove();
  document.getElementById('xpToast')?.remove();
  document.querySelectorAll('[data-rich-money],[data-balance-cents],[data-wallet-money],.xp-gauge,#globalXpBadge').forEach((el) => el.remove());
  document.body?.removeAttribute('data-rich-money');
}

export function renderXp(xp = {}) {
  cleanXpMoneyArtifacts();
  const data = xpMath(xp.profile, xp.levelRow, xp.avatar);
  document.querySelectorAll('[data-xp-level]').forEach((el) => { el.textContent = `LEVEL ${data.level}`; });
  document.querySelectorAll('[data-xp-rank]').forEach((el) => { el.textContent = data.rank; });
  document.querySelectorAll('[data-xp-total]').forEach((el) => { el.textContent = `${fmt(data.total)} XP`; });
  document.querySelectorAll('[data-xp-current]').forEach((el) => { el.textContent = `${fmt(data.current)} / 1,000`; });
  document.querySelectorAll('[data-rich-points]').forEach((el) => { el.textContent = fmt(data.points); });
  document.querySelectorAll('[data-rich-coins]').forEach((el) => { el.textContent = fmt(data.coins); });
  document.querySelectorAll('[data-xp-fill], .xp-track em, .xp i, #xpFill').forEach((el) => { el.style.width = `${data.progress}%`; });
  document.body.dataset.richLevel = String(data.level);
  document.body.dataset.richRank = data.rank;
  return data;
}

export async function loadXp(userId) {
  if (!userId) return renderXp({});
  const [{ data: profile }, { data: levelRow }, { data: avatar }] = await Promise.all([
    supabase.from('profiles').select('rich_points,rich_level,rank_title').eq('id', userId).maybeSingle(),
    supabase.from('user_levels').select('level,xp_total,xp_current,xp_next,rank_title,rich_points,coins,trust_score').eq('user_id', userId).maybeSingle(),
    supabase.from('meta_avatars').select('level,xp,rank').eq('user_id', userId).maybeSingle(),
  ]);
  return renderXp({ profile: profile || {}, levelRow: levelRow || {}, avatar: avatar || {} });
}

export async function loadCurrentXp() {
  const { data } = await supabase.auth.getUser();
  return loadXp(data?.user?.id);
}

export async function awardXp(eventKey = 'section_visit', opts = {}) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return { ok: false, reason: 'not_signed_in' };
  const { data: award, error } = await supabase.rpc('rb_award_xp', { p_event_key: eventKey, p_section: opts.section || document.body?.dataset?.section || 'global', p_source_table: opts.sourceTable || null, p_source_id: opts.sourceId || null, p_amount: opts.amount || null });
  if (error) { console.warn('[RB XP] award failed', error.message); return { ok: false, reason: error.message }; }
  await loadXp(data.user.id);
  return award;
}

export function showXpToast() {
  cleanXpMoneyArtifacts();
}

export function installXpBadge() {
  cleanXpMoneyArtifacts();
}

export async function bootXp(eventKey) {
  installXpBadge();
  await loadCurrentXp();
  if (eventKey) awardXp(eventKey).catch(() => {});
  supabase.auth.onAuthStateChange(() => loadCurrentXp());
}

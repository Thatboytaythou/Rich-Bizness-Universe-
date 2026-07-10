import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

const $ = (selector) => document.querySelector(selector);
const state = { user: null, target: null, isOwner: false };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function mount() {
  if ($('#profileEmpireDepth')) return;
  const shell = document.querySelector('.profile-screen') || document.querySelector('.identity-shell');
  if (!shell) return;
  shell.insertAdjacentHTML('beforeend', `
    <section id="profileEmpireDepth" class="profile-feed-grid" style="margin-top:14px">
      <section class="identity-panel"><h2>Badges + Theme</h2><div id="profileBadgeList" class="profile-mini-list"><div class="empty">Loading badges...</div></div><div id="profileThemeState" class="identity-stats" style="margin-top:10px"></div></section>
      <section class="identity-panel"><h2>Access + Trust</h2><div id="profileAccessList" class="profile-mini-list"><div class="empty">Loading access...</div></div><div id="profileTrustState" class="identity-stats" style="margin-top:10px"></div></section>
    </section>
    <section id="profileOwnerDepth" class="identity-panel" style="margin-top:14px;display:none"><h2>Owner Sessions + Analytics</h2><div class="identity-stats"><span><b id="profileSessionCount">0</b><small>Sessions</small></span><span><b id="profileAnalyticsCount">0</b><small>Events</small></span><span><b id="profileTrustCount">0</b><small>Trust Events</small></span></div></section>`);
}

async function resolveTarget() {
  const identity = await getAuthoritativeIdentity({ fresh: true });
  state.user = identity.user;
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || params.get('user_id');
  const username = (params.get('u') || params.get('user') || params.get('username') || '').replace(/^@/, '');
  if (id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    state.target = data || null;
  } else if (username) {
    const { data } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
    state.target = data || null;
  } else {
    state.target = identity.profile || null;
  }
  state.isOwner = Boolean(state.user?.id && state.target?.id === state.user.id);
}

function renderBadges(rows) {
  const list = $('#profileBadgeList');
  if (!list) return;
  list.innerHTML = rows.length ? rows.map((row) => { const badge = row.badge || {}; return `<article class="card"><b>${esc(badge.icon || '◆')} ${esc(badge.title || badge.badge_key || 'Badge')}</b><p>${esc(badge.description || 'Rich Bizness achievement.')}</p><small>${esc(badge.rarity || 'common')} • ${row.equipped ? 'EQUIPPED' : 'UNLOCKED'}</small></article>`; }).join('') : '<div class="empty">No badges unlocked yet.</div>';
}

function renderTheme(theme) {
  const box = $('#profileThemeState');
  if (!box) return;
  box.innerHTML = `<span><b>${esc(theme?.profile_layout || 'empire')}</b><small>Layout</small></span><span><b>${theme?.smoke_fx ? 'ON' : 'OFF'}</b><small>Smoke</small></span><span><b>${theme?.depth_3d ? '3D' : '2D'}</b><small>Depth</small></span>`;
  if (theme?.background_url && state.target?.id) {
    const hero = $('#profileHero');
    if (hero) hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.7)),url(${theme.background_url})`;
  }
}

function renderAccess(rows) {
  const list = $('#profileAccessList');
  if (!list) return;
  const role = String(state.target?.role || 'user').toLowerCase();
  const allowed = rows.filter((row) => !row.required_role || row.required_role === role || role === 'founder' || role === 'admin');
  list.innerHTML = allowed.length ? allowed.slice(0, 8).map((row) => `<article class="card"><b>${esc(row.route_key || row.route_path || 'Route')}</b><p>${esc(row.gate || 'profile')}</p><small>${esc(row.required_role || 'member')} • ${Number(row.entry_cost_cents || 0) ? '$' + (Number(row.entry_cost_cents) / 100).toFixed(2) : 'FREE'}</small></article>`).join('') : '<div class="empty">Standard profile access.</div>';
}

async function load() {
  await resolveTarget();
  if (!state.target?.id) return;
  const [badgesResult, themeResult, accessResult, trustResult] = await Promise.all([
    supabase.from('user_badges').select('*,badge:badges(*)').eq('user_id', state.target.id).order('unlocked_at', { ascending: false }).limit(24),
    supabase.from('profile_theme_settings').select('*').eq('user_id', state.target.id).maybeSingle(),
    supabase.from('route_access_rules').select('*').eq('is_active', true).limit(40),
    supabase.from('trust_events').select('id,score_delta,severity,event_type').eq('user_id', state.target.id).order('created_at', { ascending: false }).limit(40)
  ]);
  renderBadges(badgesResult.data || []);
  renderTheme(themeResult.data || null);
  renderAccess(accessResult.data || []);
  const trustRows = trustResult.data || [];
  const score = trustRows.reduce((sum, row) => sum + Number(row.score_delta || 0), 0);
  if ($('#profileTrustState')) $('#profileTrustState').innerHTML = `<span><b>${score}</b><small>Trust Delta</small></span><span><b>${trustRows.length}</b><small>Events</small></span><span><b>${esc(trustRows[0]?.severity || 'normal')}</b><small>Latest</small></span>`;
  if (state.isOwner) {
    $('#profileOwnerDepth').style.display = '';
    const [sessions, analytics] = await Promise.all([
      supabase.from('user_sessions').select('id', { count: 'exact', head: true }).eq('user_id', state.target.id).eq('is_active', true),
      supabase.from('platform_analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', state.target.id)
    ]);
    $('#profileSessionCount').textContent = String(sessions.count || 0);
    $('#profileAnalyticsCount').textContent = String(analytics.count || 0);
    $('#profileTrustCount').textContent = String(trustRows.length);
  }
  await supabase.from('platform_analytics_events').insert({ user_id: state.user?.id || null, session_id: sessionStorage.getItem('rb_session_id') || crypto.randomUUID(), event_name: 'profile_view', section: 'profile', target_table: 'profiles', target_id: state.target.id, device_type: innerWidth < 768 ? 'mobile' : 'desktop', platform: navigator.platform || 'web', route: location.pathname + location.search, metadata: { owner_view: state.isOwner } }).then(() => {}, () => {});
}

mount();
load();
supabase.channel('profile-empire-depth').on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'profile_theme_settings' }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'route_access_rules' }, load).subscribe();

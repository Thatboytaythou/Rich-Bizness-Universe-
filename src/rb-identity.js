import { supabase } from './supabase-client.js';

export const DEFAULT_PROFILE = Object.freeze({
  display_name: 'Rich Bizness User', username: 'rich_user', rich_level: 1, rich_points: 0, rank_title: 'BIZ LEGEND', balance_cents: 0, avatar_url: '', banner_url: '/images/hero-banner.png', bio: 'Building a Rich Bizness lane across the universe.', onboarding_state: 'needs_avatar', has_avatar: false, has_profile_identity: true, last_route: '/',
});

export function slugName(value) { return String(value || 'rich_user').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'rich_user'; }
export function safeNextRoute(value, fallback = '/') {
  const next = String(value || '').trim();
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('://')) return fallback;
  if (next === '/auth.html') return fallback;
  return next;
}
export function currentRoute() { return `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`; }

export async function getAuthoritativeIdentity() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData?.session || null;
  if (!session) return { session: null, user: null };
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return { session, user: data?.user || null };
}

export async function getSessionUser() { try { return (await getAuthoritativeIdentity()).user; } catch (_) { return null; } }

export async function getProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url,banner_url,bio,rich_level,rich_points,rank_title,balance_cents,online_status,onboarding_state,has_avatar,has_profile_identity,last_route').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export function profileRoute(profile, nextRoute = '') {
  const next = safeNextRoute(nextRoute, '');
  const state = profile?.onboarding_state || (profile?.has_avatar || profile?.avatar_url ? 'complete' : 'needs_avatar');
  if (next && next !== '/auth.html') return next;
  if (state === 'new' || state === 'needs_avatar') return '/avatar.html';
  if (state === 'needs_profile') return '/edit.html';
  const last = safeNextRoute(profile?.last_route || '', '');
  if (last && !['/auth.html', '/profile.html', '/avatar.html'].includes(last)) return last;
  return '/';
}

export async function ensureProfile(user) {
  if (!user) return null;
  const existing = await getProfile(user.id);
  if (existing) {
    const complete = Boolean(existing.has_avatar || existing.avatar_url || existing.onboarding_state === 'complete');
    const patch = { online_status: 'online', last_seen_at: new Date().toISOString(), has_profile_identity: true };
    supabase.from('profiles').update(patch).eq('id', user.id).then(() => {}, () => {});
    return { ...DEFAULT_PROFILE, ...existing, ...patch, has_avatar: complete, onboarding_state: complete ? 'complete' : (existing.onboarding_state || 'needs_avatar'), rank_title: existing.rank_title || DEFAULT_PROFILE.rank_title };
  }
  const meta = user.user_metadata || {};
  const display = meta.display_name || meta.name || meta.username || (user.email ? user.email.split('@')[0] : DEFAULT_PROFILE.display_name);
  const username = slugName(meta.username || display);
  const hasAvatar = Boolean(meta.avatar_url);
  const row = { id: user.id, username, display_name: display, avatar_url: meta.avatar_url || '', banner_url: DEFAULT_PROFILE.banner_url, bio: DEFAULT_PROFILE.bio, rich_level: 1, rich_points: 0, rank_title: 'BIZ LEGEND', balance_cents: 0, online_status: 'online', onboarding_state: hasAvatar ? 'complete' : 'needs_avatar', has_avatar: hasAvatar, has_profile_identity: true, last_route: hasAvatar ? '/' : '/avatar.html', metadata: { rb_language: 'Tap In', source: 'global_tap_in_foundation' } };
  const { data, error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_PROFILE, ...(data || row) };
}

export async function ensureMetaAvatar(user, profile, config = {}) {
  if (!user) return null;
  const level = Number(profile?.rich_level || config.level || 1);
  const xp = Number(profile?.rich_points || config.xp || 0);
  const avatar = { user_id: user.id, display_name: profile?.display_name || DEFAULT_PROFILE.display_name, avatar_url: profile?.avatar_url || '', model_url: config.model_url || '', aura: config.aura || 'Emerald Gold', rank: profile?.rank_title || config.rank || 'BIZ LEGEND', level, xp, position: config.position || { world: 'portal-hub', x: 0, y: 0, z: 0 }, is_active: true, metadata: { gender: config.gender || 'boy', skin: config.skin || 'brown', hair: config.hair || 'shortFade', hairColor: config.hairColor || 'black', outfit: config.outfit || 'Black Gold Boss', shoes: config.shoes || 'Gold Runners', motion: config.motion || 'Boss Idle', smoke: config.smoke || 'cinematic', chain: config.chain || 'RB Crown Chain', glasses: config.glasses || 'Black Shades', accessory: config.accessory || '', hoodieLogo: config.hoodieLogo || 'RICH BIZNESS LLC', aura: config.aura || 'Emerald Gold', creatorMode: true, theme: 'smoke-cloud', visualQuality: '4k-hd', personality: 'Rich Bizness green-gold smoke-cloud avatar', rb_language: 'Profile Lock', updatedAt: new Date().toISOString() } };
  const { data, error } = await supabase.from('meta_avatars').upsert(avatar, { onConflict: 'user_id' }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureUserLevel(user, profile = {}) {
  if (!user) return null;
  const points = Number(profile.rich_points || 0);
  const level = Number(profile.rich_level || 1);
  const row = { user_id: user.id, level, xp_total: points, xp_current: points % 1000, xp_next: 1000, rank_title: profile.rank_title || 'BIZ LEGEND', rank_style: 'green-gold smoke-cloud', rich_points: points, coins: 0, trust_score: 100, metadata: { rb_language: 'RICH LEVEL', source: 'global_tap_in_foundation' } };
  const { data, error } = await supabase.from('user_levels').upsert(row, { onConflict: 'user_id' }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureTapInFoundation(user, options = {}) {
  if (!user) return { user: null, profile: null, avatar: null, level: null, route: safeNextRoute(options.next, '/') };
  const profile = await ensureProfile(user);
  const [avatar, level] = await Promise.all([
    ensureMetaAvatar(user, profile, options.avatarConfig || {}).catch((error) => { console.warn('[RB Tap In] meta avatar sync blocked', error.message); return null; }),
    ensureUserLevel(user, profile).catch((error) => { console.warn('[RB Tap In] level sync blocked', error.message); return null; }),
  ]);
  const next = safeNextRoute(options.next || '', '');
  return { user, profile, avatar, level, route: profileRoute(profile, next) };
}

export async function requireTapIn(options = {}) {
  const { session, user } = await getAuthoritativeIdentity();
  if (!session || !user) {
    const next = encodeURIComponent(options.next || currentRoute());
    location.replace(`/auth.html?next=${next}`);
    return null;
  }
  return ensureTapInFoundation(user, options);
}

export async function signOutLocal() {
  try { const { user } = await getAuthoritativeIdentity(); if (user?.id) await supabase.from('profiles').update({ online_status: 'offline', last_seen_at: new Date().toISOString() }).eq('id', user.id); } catch (_) {}
  return supabase.auth.signOut({ scope: 'local' });
}
export async function signOutAndGoHome() { await signOutLocal(); location.href = '/auth.html'; }

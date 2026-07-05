import { supabase } from './supabase-client.js';

export const DEFAULT_PROFILE = Object.freeze({
  display_name: 'Rich Bizness User', username: 'rich_user', rich_level: 1, rich_points: 0, rank_title: 'BIZ LEGEND', balance_cents: 0, avatar_url: '', banner_url: '/images/hero-banner.png', bio: 'Building a Rich Bizness lane across the universe.', onboarding_state: 'needs_avatar', has_avatar: false, has_profile_identity: true, last_route: '/',
});

export function slugName(value) { return String(value || 'rich_user').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'rich_user'; }

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

export function profileRoute(profile) {
  const state = profile?.onboarding_state || (profile?.has_avatar || profile?.avatar_url ? 'complete' : 'needs_avatar');
  if (state === 'new' || state === 'needs_avatar') return '/avatar.html';
  if (state === 'needs_profile') return '/edit.html';
  const last = profile?.last_route;
  if (last && !['/auth.html', '/profile.html', '/avatar.html'].includes(last)) return last;
  return '/';
}

export async function ensureProfile(user) {
  if (!user) return null;
  const existing = await getProfile(user.id);
  if (existing) {
    const complete = Boolean(existing.has_avatar || existing.avatar_url || existing.onboarding_state === 'complete');
    return { ...DEFAULT_PROFILE, ...existing, has_avatar: complete, onboarding_state: complete ? 'complete' : (existing.onboarding_state || 'needs_avatar'), rank_title: existing.rank_title || DEFAULT_PROFILE.rank_title };
  }
  const meta = user.user_metadata || {};
  const display = meta.display_name || meta.name || meta.username || (user.email ? user.email.split('@')[0] : DEFAULT_PROFILE.display_name);
  const username = slugName(meta.username || display);
  const hasAvatar = Boolean(meta.avatar_url);
  const row = { id: user.id, username, display_name: display, avatar_url: meta.avatar_url || '', banner_url: DEFAULT_PROFILE.banner_url, bio: DEFAULT_PROFILE.bio, rich_level: 1, rich_points: 0, rank_title: 'BIZ LEGEND', balance_cents: 0, online_status: 'online', onboarding_state: hasAvatar ? 'complete' : 'needs_avatar', has_avatar: hasAvatar, has_profile_identity: true, last_route: hasAvatar ? '/' : '/avatar.html' };
  const { data, error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_PROFILE, ...(data || row) };
}

export async function ensureMetaAvatar(user, profile, config = {}) {
  if (!user) return null;
  const level = Number(profile?.rich_level || config.level || 1);
  const xp = Number(profile?.rich_points || config.xp || 0);
  const avatar = { user_id: user.id, display_name: profile?.display_name || DEFAULT_PROFILE.display_name, avatar_url: profile?.avatar_url || '', model_url: config.model_url || '', aura: config.aura || 'Emerald Gold', rank: profile?.rank_title || config.rank || 'BIZ LEGEND', level, xp, position: config.position || { world: 'portal-hub', x: 0, y: 0, z: 0 }, is_active: true, metadata: { gender: config.gender || 'boy', skin: config.skin || 'brown', hair: config.hair || 'shortFade', hairColor: config.hairColor || 'black', outfit: config.outfit || 'Black Gold Boss', shoes: config.shoes || 'Gold Runners', motion: config.motion || 'Boss Idle', smoke: config.smoke || 'cinematic', chain: config.chain || 'RB Crown Chain', glasses: config.glasses || 'Black Shades', accessory: config.accessory || '', hoodieLogo: config.hoodieLogo || 'RICH BIZNESS LLC', aura: config.aura || 'Emerald Gold', creatorMode: true, theme: 'smoke-cloud', visualQuality: '4k-hd', personality: 'Rich Bizness green-gold smoke-cloud avatar', updatedAt: new Date().toISOString() } };
  const { data, error } = await supabase.from('meta_avatars').upsert(avatar, { onConflict: 'user_id' }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function signOutLocal() { return supabase.auth.signOut({ scope: 'local' }); }
export async function signOutAndGoHome() { await signOutLocal(); location.href = '/auth.html'; }

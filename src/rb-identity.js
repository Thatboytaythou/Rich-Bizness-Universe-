import { supabase } from './supabase-client.js';

export const DEFAULT_PROFILE = Object.freeze({
  display_name: 'Rich Bizness Elite',
  username: 'rich_user',
  rich_level: 1,
  rich_points: 0,
  rank_title: 'Rookie Builder',
  balance_cents: 0,
  avatar_url: '',
  banner_url: '',
  bio: 'Building in the Rich Bizness Universe.',
});

export function slugName(value) {
  return String(value || 'rich_user')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28) || 'rich_user';
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function getProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,banner_url,bio,rich_level,rich_points,rank_title,balance_cents,online_status')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

export async function ensureProfile(user) {
  if (!user) return null;
  const existing = await getProfile(user.id);
  if (existing) return { ...DEFAULT_PROFILE, ...existing };

  const meta = user.user_metadata || {};
  const display = meta.display_name || meta.name || user.email?.split('@')[0] || 'Rich Bizness Elite';
  const username = slugName(meta.username || display);
  const row = {
    id: user.id,
    username,
    display_name: display,
    avatar_url: meta.avatar_url || '',
    banner_url: '',
    bio: DEFAULT_PROFILE.bio,
    rich_level: 1,
    rich_points: 0,
    rank_title: 'Rookie Builder',
    balance_cents: 0,
    online_status: 'online',
  };

  const { data, error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
  if (error) return { ...DEFAULT_PROFILE, ...row };
  return { ...DEFAULT_PROFILE, ...(data || row) };
}

export async function ensureMetaAvatar(user, profile, config = {}) {
  if (!user) return null;
  const avatar = {
    user_id: user.id,
    display_name: profile?.display_name || DEFAULT_PROFILE.display_name,
    avatar_url: profile?.avatar_url || '',
    presence_state: 'online',
    aura: config.aura || 'Emerald Gold',
    level: Number(profile?.rich_level || 1),
    avatar_config: {
      outfit: config.outfit || 'Rich Default',
      motion: config.motion || 'Boss Idle',
      creatorMode: true,
      smoke: config.smoke || 'cinematic',
      chain: config.chain || 'RB Crown Chain',
      stance: config.stance || 'portal-ready',
      updatedAt: new Date().toISOString(),
    },
  };
  const { data, error } = await supabase.from('meta_avatars').upsert(avatar, { onConflict: 'user_id' }).select().maybeSingle();
  return error ? avatar : data;
}

export async function signOutAndGoHome() {
  await supabase.auth.signOut();
  location.href = '/';
}

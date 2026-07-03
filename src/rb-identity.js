import { supabase } from './supabase-client.js';

export const DEFAULT_PROFILE = Object.freeze({
  display_name: 'ThatboyTayThou',
  username: 'thatboytaythou',
  rich_level: 1,
  rich_points: 0,
  rank_title: 'BIZ LEGEND',
  balance_cents: 0,
  avatar_url: '',
  banner_url: '/images/brand/Avatar-hero-Banner.png.jpeg',
  bio: 'Building my Rich Bizness lane across live, music, gaming, sports, gallery, store, meta, and money.',
});

export function slugName(value) {
  return String(value || 'thatboytaythou')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28) || 'thatboytaythou';
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
  if (existing) return { ...DEFAULT_PROFILE, ...existing, rank_title: existing.rank_title || DEFAULT_PROFILE.rank_title };

  const meta = user.user_metadata || {};
  const display = meta.display_name || meta.name || 'ThatboyTayThou';
  const username = slugName(meta.username || display || 'thatboytaythou');
  const row = {
    id: user.id,
    username,
    display_name: display,
    avatar_url: meta.avatar_url || '',
    banner_url: DEFAULT_PROFILE.banner_url,
    bio: DEFAULT_PROFILE.bio,
    rich_level: 1,
    rich_points: 0,
    rank_title: 'BIZ LEGEND',
    balance_cents: 0,
    online_status: 'online',
  };

  const { data, error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
  if (error) return { ...DEFAULT_PROFILE, ...row };
  return { ...DEFAULT_PROFILE, ...(data || row) };
}

export async function ensureMetaAvatar(user, profile, config = {}) {
  if (!user) return null;
  const level = Number(profile?.rich_level || config.level || 1);
  const xp = Number(profile?.rich_points || config.xp || 0);
  const avatar = {
    user_id: user.id,
    display_name: profile?.display_name || DEFAULT_PROFILE.display_name,
    avatar_url: profile?.avatar_url || '',
    model_url: config.model_url || '',
    aura: config.aura || 'Emerald Gold',
    rank: profile?.rank_title || config.rank || 'BIZ LEGEND',
    level,
    xp,
    position: config.position || { world: 'portal-hub', x: 0, y: 0, z: 0 },
    is_active: true,
    metadata: {
      gender: config.gender || 'boy',
      skin: config.skin || 'brown',
      hair: config.hair || 'shortFade',
      hairColor: config.hairColor || 'black',
      outfit: config.outfit || 'Black Gold Boss',
      shoes: config.shoes || 'Gold Runners',
      motion: config.motion || 'Boss Idle',
      smoke: config.smoke || 'cinematic',
      chain: config.chain || 'RB Crown Chain',
      glasses: config.glasses || 'Black Shades',
      accessory: config.accessory || 'Teddy Bear',
      hoodieLogo: config.hoodieLogo || 'RICH BIZNESS LLC',
      aura: config.aura || 'Emerald Gold',
      creatorMode: true,
      theme: 'smoke-cloud',
      visualQuality: '4k-hd',
      personality: 'ThatboyTayThou Rich Bizness green-gold smoke-cloud hero',
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

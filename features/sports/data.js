import { supabase } from '../../src/supabase-client.js';

export async function loadSportsPosts() {
  let result = await supabase.from('sports_posts').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(36);
  let sourceTable = 'sports_posts';
  if (result.error || !(result.data || []).length) {
    result = await supabase.from('sports_uploads').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(36);
    sourceTable = 'sports_uploads';
  }
  return { rows: result.data || [], error: result.error, sourceTable };
}

export async function loadSportsSystems() {
  const [picks, leagues, teams, brackets, broadcasts] = await Promise.all([
    supabase.from('sports_picks').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(16),
    supabase.from('sports_leagues').select('*').eq('is_active', true).limit(30),
    supabase.from('sports_teams').select('*').limit(100),
    supabase.from('sports_brackets').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('sports_broadcasts').select('*').order('created_at', { ascending: false }).limit(30)
  ]);
  return {
    picks: picks.data || [],
    leagues: leagues.data || [],
    teams: teams.data || [],
    brackets: brackets.data || [],
    broadcasts: broadcasts.data || []
  };
}

export async function loadSportsProfile(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('sports_profiles').select('*').eq('user_id', userId).maybeSingle();
  return data || null;
}

export async function loadSportsSocial(postId) {
  if (!postId) return { comments: [], reactions: 0 };
  const [comments, reactions] = await Promise.all([
    supabase.from('sports_comments').select('*').eq('post_id', postId).order('created_at', { ascending: false }).limit(30),
    supabase.from('sports_reactions').select('id', { count: 'exact', head: true }).eq('post_id', postId)
  ]);
  return { comments: comments.data || [], reactions: reactions.count || 0 };
}

export async function addSportsComment({ postId, user, profile, body }) {
  const text = String(body || '').trim();
  if (!postId || !user?.id || !text) return null;
  return supabase.from('sports_comments').insert({ post_id: postId, user_id: user.id, username: profile?.username, display_name: profile?.display_name, body: text });
}

export async function addSportsReaction({ postId, userId }) {
  if (!postId || !userId) return null;
  return supabase.from('sports_reactions').insert({ post_id: postId, user_id: userId, reaction: 'FIRE' });
}

export async function createSportsPick({ user, profile, title, teamName, opponent, prediction }) {
  if (!user?.id || !title || !teamName || !opponent || !prediction) return null;
  return supabase.from('sports_picks').insert({
    user_id: user.id,
    username: profile?.username,
    display_name: profile?.display_name,
    title,
    sport: 'sports',
    league: 'arena',
    team_name: teamName,
    opponent,
    prediction,
    confidence: 50,
    pick_type: 'community',
    currency: 'usd',
    is_premium: false,
    is_featured: false,
    status: 'open',
    points: 0,
    metadata: { source: 'sports-page' }
  });
}

export function watchSports(callbacks = {}) {
  return supabase.channel('sports-feature-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_posts' }, callbacks.posts || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_uploads' }, callbacks.posts || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_comments' }, callbacks.social || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_reactions' }, callbacks.social || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_picks' }, callbacks.systems || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_leagues' }, callbacks.systems || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_teams' }, callbacks.systems || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_brackets' }, callbacks.systems || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_broadcasts' }, callbacks.systems || (() => {}))
    .subscribe();
}

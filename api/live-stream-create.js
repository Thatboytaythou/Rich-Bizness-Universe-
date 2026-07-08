import { createClient } from '@supabase/supabase-js';

function send(res, status, body) { res.status(status).json(body); }
function env(name) { return process.env[name] || ''; }
function supabaseAdmin() {
  const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase service env missing in Vercel');
  return createClient(url, key, { auth: { persistSession: false } });
}
function clean(value, fallback) { return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80); }
function usernameFrom(id) { return `live_${String(id || '').replace(/-/g, '').slice(0, 12) || Date.now()}`; }

async function ensureCreatorProfile(db, creatorId, body = {}) {
  const { data: existing, error: readError } = await db.from('profiles').select('id').eq('id', creatorId).maybeSingle();
  if (readError) throw readError;
  if (existing?.id) return true;
  const display = String(body.display_name || body.displayName || body.name || 'Rich Bizness Host').slice(0, 80);
  const row = {
    id: creatorId,
    username: usernameFrom(creatorId),
    display_name: display,
    avatar_url: body.avatar_url || null,
    banner_url: body.banner_url || null,
    bio: 'Live on Rich Bizness.',
    rich_level: 1,
    rich_points: 0,
    rank_title: 'BIZ LEGEND',
    balance_cents: 0,
    online_status: 'online',
    onboarding_state: 'complete',
    has_profile_identity: true,
    has_avatar: Boolean(body.avatar_url),
    last_route: '/live.html'
  };
  const { error } = await db.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const db = supabaseAdmin();
    const b = req.body || {};
    const creatorId = b.creator_id || b.creatorId || b.user_id || b.userId;
    if (!creatorId) return send(res, 400, { ok: false, error: 'creator_id required' });
    await ensureCreatorProfile(db, creatorId, b);

    const room = clean(b.livekit_room_name || b.room, `we-lit-${String(creatorId).slice(0, 8)}`);
    const now = new Date().toISOString();
    const row = {
      creator_id: creatorId,
      slug: clean(b.slug || room, room),
      display_slug: clean(b.display_slug || room, room),
      title: b.title || 'WE LIT🔥',
      description: b.description || 'Bizness Party live room',
      category: b.category || 'live',
      status: 'live',
      status_label: b.status_label || 'WE LIT🔥',
      access_type: b.access_type || 'free',
      price_cents: Number(b.price_cents || 0),
      currency: b.currency || 'usd',
      livekit_room_name: room,
      display_room_name: b.display_room_name || b.displayRoomName || 'Bizness Party',
      thumbnail_url: b.thumbnail_url || null,
      cover_url: b.cover_url || null,
      viewer_count: 0,
      peak_viewers: 0,
      total_chat_messages: 0,
      total_reactions: 0,
      is_chat_enabled: b.is_chat_enabled ?? true,
      is_cohost_enabled: b.is_cohost_enabled ?? true,
      is_featured: b.is_featured ?? true,
      started_at: now,
      last_activity_at: now,
      metadata: { ...(b.metadata || {}), source: 'api/live-stream-create', token_source: 'vercel' }
    };

    const { data: stream, error } = await db.from('live_streams').upsert(row, { onConflict: 'slug' }).select('*').maybeSingle();
    if (error) throw error;

    await db.from('live_stream_members').upsert({ stream_id: stream.id, user_id: creatorId, role: 'host', status: 'active', joined_at: now, metadata: { api: 'live-stream-create' } }, { onConflict: 'stream_id,user_id,role' }).then(() => {}, () => {});
    await db.from('livekit_room_events').insert({ room_name: room, stream_id: stream.id, event_type: 'stream_created', participant_identity: creatorId, user_id: creatorId, payload: { api: 'live-stream-create' } }).then(() => {}, () => {});

    return send(res, 200, { ok: true, stream });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

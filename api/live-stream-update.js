import { createClient } from '@supabase/supabase-js';

function send(res, status, body) {
  res.status(status).json(body);
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env missing in Vercel');
  return createClient(url, key, { auth: { persistSession: false } });
}

function clean(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

export default async function handler(req, res) {
  if (!['POST', 'PATCH'].includes(req.method)) return send(res, 405, { ok: false, error: 'POST or PATCH required' });
  try {
    const db = supabaseAdmin();
    const body = req.body || {};
    const action = body.action || 'upsert';
    const creatorId = body.creator_id || body.creatorId || body.user_id || body.userId;
    const slug = clean(body.slug || body.livekit_room_name || body.room, creatorId ? `we-lit-${String(creatorId).slice(0, 8)}` : 'bizness-party');

    if (!creatorId && action !== 'end') return send(res, 400, { ok: false, error: 'creator_id required' });

    const base = {
      creator_id: creatorId,
      slug,
      display_slug: slug,
      title: body.title || 'WE LIT🔥',
      description: body.description || 'Bizness Party live room',
      category: body.category || 'live',
      status: action === 'end' ? 'ended' : (body.status || 'live'),
      status_label: action === 'end' ? 'ROOM ENDED' : (body.status_label || 'WE LIT🔥'),
      access_type: body.access_type || 'free',
      price_cents: Number(body.price_cents || 0),
      currency: body.currency || 'usd',
      livekit_room_name: body.livekit_room_name || slug,
      display_room_name: body.display_room_name || 'Bizness Party',
      thumbnail_url: body.thumbnail_url || null,
      cover_url: body.cover_url || null,
      viewer_count: Number(body.viewer_count || 0),
      total_chat_messages: Number(body.total_chat_messages || 0),
      total_reactions: Number(body.total_reactions || 0),
      is_chat_enabled: body.is_chat_enabled ?? true,
      is_cohost_enabled: body.is_cohost_enabled ?? true,
      is_featured: body.is_featured ?? true,
      last_activity_at: new Date().toISOString(),
      metadata: { ...(body.metadata || {}), token_source: 'vercel', api: 'live-stream-update' }
    };

    if (base.status === 'live') base.started_at = body.started_at || new Date().toISOString();
    if (base.status === 'ended') base.ended_at = body.ended_at || new Date().toISOString();

    const { data, error } = await db.from('live_streams').upsert(base, { onConflict: 'slug' }).select('*').maybeSingle();
    if (error) throw error;

    await db.from('livekit_room_events').insert({
      room_name: data.livekit_room_name,
      stream_id: data.id,
      event_type: action === 'end' ? 'stream_ended' : 'stream_upserted',
      participant_identity: creatorId || null,
      user_id: creatorId || null,
      payload: { source: 'api/live-stream-update', action }
    }).then(() => {}, () => {});

    return send(res, 200, { ok: true, stream: data });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

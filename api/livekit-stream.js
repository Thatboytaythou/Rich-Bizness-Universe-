import { createClient } from '@supabase/supabase-js';

function send(res, status, body) {
  res.status(status).json(body);
}

function env(name) {
  return process.env[name] || '';
}

function supabaseAdmin() {
  const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase admin env missing in Vercel');
  return createClient(url, key, { auth: { persistSession: false } });
}

function clean(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const db = supabaseAdmin();
    const body = req.body || {};
    const action = String(body.action || 'start');
    const userId = body.userId || body.creator_id;
    const room = clean(body.room || body.livekit_room_name, 'bizness-party');
    const now = new Date().toISOString();

    if (!userId) return send(res, 400, { ok: false, error: 'Missing userId' });

    if (action === 'end') {
      const { data, error } = await db.from('live_streams')
        .update({ status: 'ended', status_label: 'ROOM ENDED', ended_at: now, last_activity_at: now })
        .eq('creator_id', userId)
        .eq('livekit_room_name', room)
        .select('id,slug,title,status,status_label,livekit_room_name')
        .maybeSingle();
      if (error) throw error;
      return send(res, 200, { ok: true, stream: data });
    }

    const row = {
      creator_id: userId,
      slug: room,
      display_slug: room,
      title: body.title || 'WE LIT🔥',
      description: body.description || 'Bizness Party live room.',
      category: body.category || 'live',
      status: 'live',
      status_label: 'WE LIT🔥',
      access_type: 'free',
      price_cents: 0,
      currency: 'usd',
      livekit_room_name: room,
      display_room_name: body.displayRoomName || body.display_room_name || 'Bizness Party',
      viewer_count: 0,
      peak_viewers: 0,
      total_chat_messages: 0,
      total_reactions: 0,
      is_chat_enabled: true,
      is_cohost_enabled: true,
      is_featured: true,
      started_at: now,
      last_activity_at: now,
      metadata: { source: 'vercel-livekit-stream-api', token_source: 'vercel', ...(body.metadata || {}) }
    };

    const { data, error } = await db.from('live_streams')
      .upsert(row, { onConflict: 'slug' })
      .select('id,slug,title,status,status_label,livekit_room_name,display_room_name,viewer_count,total_chat_messages')
      .maybeSingle();
    if (error) throw error;
    return send(res, 200, { ok: true, stream: data });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

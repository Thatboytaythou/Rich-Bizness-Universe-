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

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const db = supabaseAdmin();
    const body = req.body || {};
    const row = {
      room_name: body.room_name || body.roomName || body.room || null,
      stream_id: body.stream_id || body.streamId || null,
      event_type: body.event_type || body.eventType || 'room_event',
      participant_identity: body.participant_identity || body.identity || null,
      participant_name: body.participant_name || body.name || null,
      user_id: body.user_id || body.userId || null,
      payload: { ...(body.payload || {}), api: 'live-room-event' }
    };

    const { data, error } = await db.from('livekit_room_events').insert(row).select('*').maybeSingle();
    if (error) throw error;
    return send(res, 200, { ok: true, event: data });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

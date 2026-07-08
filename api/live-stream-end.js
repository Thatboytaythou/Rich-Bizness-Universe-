import { createClient } from '@supabase/supabase-js';

function send(res, status, body) { res.status(status).json(body); }
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
    const b = req.body || {};
    const id = b.id || b.stream_id || b.streamId;
    const room = b.livekit_room_name || b.room;
    const creatorId = b.creator_id || b.creatorId || b.user_id || b.userId;
    if (!id && !room && !creatorId) return send(res, 400, { ok: false, error: 'id, room, or creator_id required' });

    let q = db.from('live_streams').update({ status: 'ended', status_label: 'ROOM ENDED', ended_at: new Date().toISOString(), last_activity_at: new Date().toISOString() });
    if (id) q = q.eq('id', id);
    else if (room) q = q.eq('livekit_room_name', room);
    else q = q.eq('creator_id', creatorId).eq('status', 'live');

    const { data, error } = await q.select('*').maybeSingle();
    if (error) throw error;
    if (!data) return send(res, 404, { ok: false, error: 'Stream not found' });

    const now = new Date().toISOString();
    await db.from('live_stream_members').update({ status: 'left', left_at: now }).eq('stream_id', data.id).eq('status', 'active').then(() => {}, () => {});
    await db.from('live_view_sessions').update({ left_at: now }).eq('stream_id', data.id).is('left_at', null).then(() => {}, () => {});
    await db.from('livekit_room_events').insert({ room_name: data.livekit_room_name, stream_id: data.id, event_type: 'stream_ended', participant_identity: creatorId || null, user_id: creatorId || null, payload: { api: 'live-stream-end' } }).then(() => {}, () => {});

    return send(res, 200, { ok: true, stream: data });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

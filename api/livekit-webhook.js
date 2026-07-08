import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function send(res, status, body) {
  res.status(status).json(body);
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin env missing in Vercel');
  return createClient(url, key, { auth: { persistSession: false } });
}

function verify(req, raw) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = req.headers['x-livekit-signature'] || req.headers['authorization'] || '';
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return String(signature).includes(digest);
}

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const raw = await readRaw(req);
    if (!verify(req, raw)) return send(res, 401, { ok: false, error: 'Invalid webhook signature' });
    const event = raw ? JSON.parse(raw) : {};
    const db = supabaseAdmin();
    const roomName = event.room?.name || event.room_name || event.roomName || event.room || null;
    const eventType = event.event || event.type || event.event_type || 'livekit_event';
    const participant = event.participant || {};

    let streamId = null;
    if (roomName) {
      const { data: stream } = await db.from('live_streams').select('id,viewer_count,peak_viewers').eq('livekit_room_name', roomName).maybeSingle();
      streamId = stream?.id || null;
      if (stream) {
        const isJoin = String(eventType).includes('participant_joined');
        const isLeave = String(eventType).includes('participant_left');
        const viewerCount = Math.max(0, Number(stream.viewer_count || 0) + (isJoin ? 1 : isLeave ? -1 : 0));
        const peak = Math.max(Number(stream.peak_viewers || 0), viewerCount);
        await db.from('live_streams').update({ viewer_count: viewerCount, peak_viewers: peak, last_activity_at: new Date().toISOString() }).eq('id', stream.id);
      }
    }

    await db.from('livekit_room_events').insert({
      room_name: roomName,
      stream_id: streamId,
      event_type: eventType,
      participant_identity: participant.identity || event.participant_identity || null,
      participant_name: participant.name || event.participant_name || null,
      user_id: null,
      payload: event
    });

    return send(res, 200, { ok: true });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

export const config = { api: { bodyParser: false } };

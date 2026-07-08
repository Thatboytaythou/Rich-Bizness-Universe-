import { createClient } from '@supabase/supabase-js';

function send(res, status, body) { res.status(status).json(body); }
function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env missing in Vercel');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const db = admin();
    const b = req.body || {};
    const streamId = b.stream_id || b.streamId;
    const userId = b.user_id || b.userId || null;
    if (!streamId) return send(res, 400, { ok: false, error: 'stream_id required' });

    const { data: stream, error } = await db.from('live_streams').select('id,creator_id,status,access_type,price_cents,currency').eq('id', streamId).maybeSingle();
    if (error) throw error;
    if (!stream) return send(res, 404, { ok: false, error: 'Stream not found' });

    const isOwner = userId && stream.creator_id === userId;
    const free = !stream.price_cents || stream.access_type === 'free' || stream.access_type === 'public';
    let purchased = false;

    if (!free && userId) {
      const { data: access } = await db.from('vip_live_access').select('id').eq('stream_id', streamId).eq('user_id', userId).maybeSingle();
      const { data: purchase } = await db.from('live_stream_purchases').select('id').eq('stream_id', streamId).eq('user_id', userId).maybeSingle();
      purchased = Boolean(access || purchase);
    }

    return send(res, 200, { ok: true, allowed: Boolean(isOwner || free || purchased), stream, reason: isOwner ? 'owner' : free ? 'free' : purchased ? 'purchased' : 'purchase_required' });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

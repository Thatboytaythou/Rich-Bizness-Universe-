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
    const userId = b.user_id || b.userId;
    if (!streamId || !userId) return send(res, 400, { ok: false, error: 'stream_id and user_id required' });

    const { data: stream, error: streamError } = await db.from('live_streams').select('id,price_cents,currency,creator_id').eq('id', streamId).maybeSingle();
    if (streamError) throw streamError;
    if (!stream) return send(res, 404, { ok: false, error: 'Stream not found' });

    const amount = Number(b.amount_cents || b.amountCents || stream.price_cents || 0);
    const currency = b.currency || stream.currency || 'usd';
    const row = {
      stream_id: streamId,
      user_id: userId,
      creator_id: stream.creator_id,
      amount_cents: amount,
      currency,
      status: amount > 0 ? 'pending' : 'granted',
      provider: b.provider || 'internal',
      provider_session_id: b.provider_session_id || b.providerSessionId || null,
      metadata: { ...(b.metadata || {}), source: 'api/live-stream-purchase' }
    };

    const { data: purchase, error } = await db.from('live_stream_purchases').insert(row).select('*').maybeSingle();
    if (error) throw error;

    if (amount === 0) {
      await db.from('vip_live_access').upsert({ stream_id: streamId, user_id: userId, access_type: 'free', status: 'active', metadata: { purchase_id: purchase.id } }, { onConflict: 'stream_id,user_id' }).then(() => {}, () => {});
    }

    return send(res, 200, { ok: true, purchase });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

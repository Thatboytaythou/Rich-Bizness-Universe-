const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xfsrqomsiulswbalgknx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function send(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  if (!SUPABASE_KEY) return send(res, 500, { ok: false, error: 'Supabase env missing' });
  try {
    const b = req.body || {};
    if (!b.stream_id || !b.user_id) return send(res, 400, { ok: false, error: 'stream_id and user_id required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/live_chat_messages`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ stream_id: b.stream_id, user_id: b.user_id, body: b.body || b.message || 'They’re here Rich', message_type: 'text', metadata: { source: 'api', live: 'WE LIT🔥' } })
    });
    const data = await r.json().catch(() => null);
    return send(res, r.ok ? 200 : 500, { ok: r.ok, message: Array.isArray(data) ? data[0] : data, error: r.ok ? null : data?.message });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message });
  }
}

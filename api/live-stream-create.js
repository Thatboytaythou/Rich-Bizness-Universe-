const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xfsrqomsiulswbalgknx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function send(res, status, body) { res.status(status).json(body); }

async function post(table, row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || 'Supabase insert failed');
  return Array.isArray(data) ? data[0] : data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  if (!SUPABASE_KEY) return send(res, 500, { ok: false, error: 'Supabase env missing' });
  try {
    const b = req.body || {};
    const room = String(b.livekit_room_name || b.room || `we-lit-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    const creator_id = b.creator_id || b.user_id;
    if (!creator_id) return send(res, 400, { ok: false, error: 'creator_id required' });
    const stream = await post('live_streams', {
      creator_id,
      slug: b.slug || room,
      title: b.title || 'WE LIT🔥',
      display_slug: 'WE LIT🔥',
      display_room_name: b.display_room_name || 'Bizness Party',
      livekit_room_name: room,
      status: 'live',
      status_label: 'Get Right',
      category: b.category || 'we-lit',
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      is_chat_enabled: true,
      is_cohost_enabled: true,
      metadata: { ...(b.metadata || {}), source: 'api', rb_language: 'They’re here Rich' }
    });
    return send(res, 200, { ok: true, stream });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message });
  }
}

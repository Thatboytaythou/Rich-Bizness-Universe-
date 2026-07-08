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
  if (!['POST', 'PATCH'].includes(req.method)) return send(res, 405, { ok: false, error: 'POST or PATCH required' });
  try {
    const db = supabaseAdmin();
    const body = req.body || {};
    const streamId = body.stream_id || body.streamId;
    const userId = body.user_id || body.userId;
    const role = body.role || 'viewer';
    const status = body.status || 'active';
    if (!streamId || !userId) return send(res, 400, { ok: false, error: 'stream_id and user_id required' });

    const row = {
      stream_id: streamId,
      user_id: userId,
      role,
      status,
      joined_at: body.joined_at || (status === 'active' ? new Date().toISOString() : undefined),
      left_at: body.left_at || (status === 'left' ? new Date().toISOString() : null),
      metadata: { ...(body.metadata || {}), api: 'live-member' }
    };

    Object.keys(row).forEach((key) => row[key] === undefined && delete row[key]);

    const { data, error } = await db.from('live_stream_members').upsert(row, { onConflict: 'stream_id,user_id,role' }).select('*').maybeSingle();
    if (error) throw error;

    return send(res, 200, { ok: true, member: data });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

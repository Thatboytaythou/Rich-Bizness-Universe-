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
    if (!streamId) return send(res, 400, { ok: false, error: 'stream_id required' });

    const row = {
      stream_id: streamId,
      user_id: body.user_id || body.userId || null,
      username: body.username || null,
      display_name: body.display_name || body.displayName || null,
      anonymous_id: body.anonymous_id || body.anonymousId || null,
      joined_at: body.joined_at || new Date().toISOString(),
      left_at: body.left_at || null,
      watch_seconds: Number(body.watch_seconds || 0),
      device_info: body.device_info || {},
      metadata: { ...(body.metadata || {}), token_source: 'vercel', api: 'live-watch-session' }
    };

    const { data, error } = await db.from('live_view_sessions').insert(row).select('*').maybeSingle();
    if (error) throw error;

    await db.from('live_streams').update({ last_activity_at: new Date().toISOString() }).eq('id', streamId).then(() => {}, () => {});

    return send(res, 200, { ok: true, session: data });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

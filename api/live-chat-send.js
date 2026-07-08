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
    const streamId = b.stream_id || b.streamId;
    const userId = b.user_id || b.userId;
    const text = String(b.body || b.message || '').trim();
    if (!streamId || !userId || !text) return send(res, 400, { ok: false, error: 'stream_id, user_id, and message required' });

    const { data: message, error } = await db.from('live_chat_messages').insert({
      stream_id: streamId,
      user_id: userId,
      username: b.username || null,
      display_name: b.display_name || b.displayName || null,
      message: text,
      body: text,
      is_pinned: false,
      is_deleted: false,
      metadata: { ...(b.metadata || {}), source: 'api/live-chat-send', live: 'WE LIT🔥' }
    }).select('*').maybeSingle();
    if (error) throw error;

    const { data: stream } = await db.from('live_streams').select('total_chat_messages').eq('id', streamId).maybeSingle();
    await db.from('live_streams').update({ total_chat_messages: Number(stream?.total_chat_messages || 0) + 1, last_activity_at: new Date().toISOString() }).eq('id', streamId).then(() => {}, () => {});

    return send(res, 200, { ok: true, message });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

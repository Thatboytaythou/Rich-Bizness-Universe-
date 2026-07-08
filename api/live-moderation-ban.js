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
    const bannedUserId = b.banned_user_id || b.bannedUserId || b.user_id || b.userId;
    const bannedBy = b.banned_by || b.bannedBy || b.moderator_id || b.moderatorId || null;
    if (!streamId || !bannedUserId) return send(res, 400, { ok: false, error: 'stream_id and banned_user_id required' });

    const row = {
      stream_id: streamId,
      banned_user_id: bannedUserId,
      banned_by: bannedBy,
      reason: b.reason || 'moderation',
      expires_at: b.expires_at || b.expiresAt || null,
      metadata: { ...(b.metadata || {}), source: 'api/live-moderation-ban' }
    };

    const { data: ban, error } = await db.from('live_stream_bans').insert(row).select('*').maybeSingle();
    if (error) throw error;
    await db.from('live_stream_members').update({ status: 'removed', left_at: new Date().toISOString() }).eq('stream_id', streamId).eq('user_id', bannedUserId).then(() => {}, () => {});
    return send(res, 200, { ok: true, ban });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

import { createClient } from '@supabase/supabase-js';

function send(res, status, body) { res.status(status).json(body); }
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin env missing in Vercel');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const db = supabaseAdmin();
    const body = req.body || {};
    const streamId = body.streamId || body.stream_id;
    const userId = body.userId || body.user_id || null;
    if (!streamId) return send(res, 400, { ok: false, error: 'Missing streamId' });

    if (body.action === 'leave' && body.sessionId) {
      const leftAt = body.leftAt || body.left_at || new Date().toISOString();
      const { data: session, error } = await db.from('live_view_sessions')
        .update({ left_at: leftAt, watch_seconds: Number(body.watchSeconds || body.watch_seconds || 0) })
        .eq('id', body.sessionId)
        .select('id,stream_id,user_id,left_at,watch_seconds')
        .maybeSingle();
      if (error) throw error;
      const { data: stream } = await db.from('live_streams').select('viewer_count').eq('id', streamId).maybeSingle();
      await db.from('live_streams').update({ viewer_count: Math.max(0, Number(stream?.viewer_count || 0) - 1), last_activity_at: new Date().toISOString() }).eq('id', streamId).then(() => {}, () => {});
      if (userId) await db.from('live_stream_members').update({ status: 'left', left_at: leftAt }).eq('stream_id', streamId).eq('user_id', userId).eq('role', 'viewer').then(() => {}, () => {});
      return send(res, 200, { ok: true, session });
    }

    const { data: stream, error: streamError } = await db.from('live_streams')
      .select('id,viewer_count,peak_viewers,total_chat_messages,total_reactions')
      .eq('id', streamId)
      .maybeSingle();
    if (streamError) throw streamError;
    if (!stream) return send(res, 404, { ok: false, error: 'Stream not found' });

    const { data: session, error: insertError } = await db.from('live_view_sessions')
      .insert({
        stream_id: streamId,
        user_id: userId,
        username: body.username || null,
        display_name: body.displayName || body.display_name || null,
        anonymous_id: body.anonymousId || body.anonymous_id || null,
        joined_at: body.joinedAt || body.joined_at || new Date().toISOString(),
        device_info: body.device || body.device_info || {},
        metadata: { source: 'api/livekit-watch', token_source: 'vercel', ...(body.metadata || {}) }
      })
      .select('id,stream_id,user_id,joined_at')
      .maybeSingle();
    if (insertError) throw insertError;

    const nextViewerCount = Number(stream.viewer_count || 0) + 1;
    const nextPeak = Math.max(Number(stream.peak_viewers || 0), nextViewerCount);
    await db.from('live_streams').update({ viewer_count: nextViewerCount, peak_viewers: nextPeak, last_activity_at: new Date().toISOString() }).eq('id', streamId);
    if (userId) await db.from('live_stream_members').upsert({ stream_id: streamId, user_id: userId, role: 'viewer', status: 'active', joined_at: new Date().toISOString(), metadata: { api: 'livekit-watch' } }, { onConflict: 'stream_id,user_id,role' }).then(() => {}, () => {});

    return send(res, 200, { ok: true, session, viewer_count: nextViewerCount, peak_viewers: nextPeak });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

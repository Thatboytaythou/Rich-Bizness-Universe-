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

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  try {
    const db = supabaseAdmin();
    const body = req.body || {};
    const streamId = body.streamId || body.stream_id;
    const userId = body.userId || body.user_id || null;
    if (!streamId) return send(res, 400, { ok: false, error: 'Missing streamId' });

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
        device_info: body.device || {},
        metadata: { source: 'vercel-livekit-watch-api', token_source: 'vercel', ...(body.metadata || {}) }
      })
      .select('id,stream_id,user_id,joined_at')
      .maybeSingle();
    if (insertError) throw insertError;

    const nextViewerCount = Number(stream.viewer_count || 0) + 1;
    const nextPeak = Math.max(Number(stream.peak_viewers || 0), nextViewerCount);
    await db.from('live_streams').update({ viewer_count: nextViewerCount, peak_viewers: nextPeak, last_activity_at: new Date().toISOString() }).eq('id', streamId);

    return send(res, 200, { ok: true, session, viewer_count: nextViewerCount, peak_viewers: nextPeak });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || String(error) });
  }
}

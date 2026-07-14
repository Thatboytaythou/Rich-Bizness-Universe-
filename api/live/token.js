import { createClient } from '@supabase/supabase-js';
import { AccessToken } from 'livekit-server-sdk';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const bearer = (req) => {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const livekitUrl = process.env.LIVEKIT_URL;
  const livekitKey = process.env.LIVEKIT_API_KEY;
  const livekitSecret = process.env.LIVEKIT_API_SECRET;

  if (!supabaseUrl || !supabaseKey || !livekitUrl || !livekitKey || !livekitSecret) {
    return json(res, 500, { error: 'Live runtime is missing server environment values.' });
  }

  const accessToken = bearer(req);
  if (!accessToken) return json(res, 401, { error: 'Tap in first.' });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return json(res, 401, { error: 'Your Rich ID session expired. Tap in again.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const roomName = String(body.roomName || '').trim();
  const role = body.role === 'host' ? 'host' : 'viewer';
  const streamId = String(body.streamId || '').trim();
  if (!roomName || roomName.length > 160) return json(res, 400, { error: 'Missing live room.' });

  if (role === 'host') {
    if (!streamId) return json(res, 400, { error: 'Missing stream identity.' });
    const { data: stream, error } = await supabase
      .from('live_streams')
      .select('id,creator_id,livekit_room_name,status,title')
      .eq('id', streamId)
      .eq('creator_id', userData.user.id)
      .eq('livekit_room_name', roomName)
      .maybeSingle();
    if (error || !stream) return json(res, 403, { error: 'That Bizness Party room is not yours.' });
  } else {
    const { data: stream, error } = await supabase
      .from('live_streams')
      .select('id,status,access_type,livekit_room_name')
      .eq('livekit_room_name', roomName)
      .maybeSingle();
    if (error || !stream || !['live', 'ready', 'scheduled'].includes(String(stream.status))) {
      return json(res, 404, { error: 'That live room is not active.' });
    }
  }

  const identity = userData.user.id;
  const displayName = String(userData.user.user_metadata?.display_name || userData.user.email?.split('@')[0] || 'Rich Member');
  const token = new AccessToken(livekitKey, livekitSecret, {
    identity,
    name: displayName,
    metadata: JSON.stringify({ role, richBizness: true })
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: role === 'host',
    canPublishData: true,
    canSubscribe: true,
    roomAdmin: role === 'host'
  });

  return json(res, 200, {
    token: await token.toJwt(),
    url: livekitUrl,
    roomName,
    role,
    message: role === 'host' ? 'WE LIT🔥 — host access ready.' : 'Pop in — the room is live.'
  });
}

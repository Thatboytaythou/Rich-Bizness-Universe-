import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });

  const authHeader = String(req.headers.authorization ?? '');
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) return json(res, 401, { error: 'Tap in again — your Rich ID token is missing.' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const livekitUrl = process.env.LIVEKIT_URL;
  const livekitKey = process.env.LIVEKIT_API_KEY;
  const livekitSecret = process.env.LIVEKIT_API_SECRET;

  if (!supabaseUrl || !supabaseKey) return json(res, 500, { error: 'Supabase server auth is not configured.' });
  if (!livekitUrl || !livekitKey || !livekitSecret) return json(res, 500, { error: 'LiveKit host credentials are missing on Vercel.' });

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });

  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) return json(res, 401, { error: 'Your Rich ID session expired. Tap in again.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const roomName = String(body.roomName ?? '').trim();
  const streamId = String(body.streamId ?? '').trim();
  const role = body.role === 'host' ? 'host' : 'viewer';
  if (!roomName || !streamId) return json(res, 400, { error: 'That Bizness Party room is missing.' });

  const { data: stream, error: streamError } = await client
    .from('live_streams')
    .select('id,creator_id,status,livekit_room_name,title')
    .eq('id', streamId)
    .maybeSingle();

  if (streamError || !stream) return json(res, 404, { error: 'That live room does not exist.' });
  if (stream.livekit_room_name !== roomName) return json(res, 403, { error: 'Room identity mismatch.' });
  if (role === 'host' && stream.creator_id !== userData.user.id) return json(res, 403, { error: 'That Bizness Party is not yours to host.' });
  if (role === 'viewer' && !['live', 'ready', 'scheduled', 'upcoming'].includes(String(stream.status))) {
    return json(res, 409, { error: 'Party’s over — open the replay instead.' });
  }

  const profileResult = await client.from('profiles').select('display_name,username').eq('id', userData.user.id).maybeSingle();
  const identity = profileResult.data?.display_name || profileResult.data?.username || userData.user.email?.split('@')[0] || 'Rich Member';

  const token = new AccessToken(livekitKey, livekitSecret, {
    identity: userData.user.id,
    name: identity,
    metadata: JSON.stringify({ streamId, role, brand: 'Rich Bizness LLC' })
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: role === 'host',
    canPublishData: true
  });

  return json(res, 200, {
    token: await token.toJwt(),
    url: livekitUrl,
    roomName,
    streamId,
    role,
    identity
  });
}

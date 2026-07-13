import { createHmac } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_shared/supabase-admin';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload: Record<string, unknown>): string {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) throw new Error('LiveKit server credentials are not configured.');
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', LIVEKIT_API_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function bearerToken(req: VercelRequest): string | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

function cleanRoomName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const room = value.trim();
  return /^[A-Za-z0-9_-]{3,128}$/.test(room) ? room : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: 'LiveKit is not configured on the server.' });
  }

  const accessToken = bearerToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Authentication required.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) return res.status(401).json({ error: 'Invalid session.' });

  const roomName = cleanRoomName(req.body?.roomName);
  if (!roomName) return res.status(400).json({ error: 'A valid roomName is required.' });

  const { data: stream, error: streamError } = await supabaseAdmin
    .from('live_streams')
    .select('id,creator_id,status,access_type,title')
    .eq('livekit_room_name', roomName)
    .maybeSingle();

  if (streamError) return res.status(500).json({ error: streamError.message });
  if (!stream) return res.status(404).json({ error: 'Live stream not found.' });

  const isHost = stream.creator_id === authData.user.id;
  if (!isHost && !['scheduled', 'live'].includes(stream.status)) {
    return res.status(403).json({ error: 'This live room is not open.' });
  }

  if (!isHost && ['paid', 'vip', 'subscriber', 'private'].includes(stream.access_type)) {
    const { count, error: accessError } = await supabaseAdmin
      .from('vip_live_access')
      .select('*', { count: 'exact', head: true })
      .eq('stream_id', stream.id)
      .eq('user_id', authData.user.id)
      .eq('access_status', 'active');
    if (accessError) return res.status(500).json({ error: accessError.message });
    if (!count) return res.status(403).json({ error: 'Access to this live room is required.' });
  }

  const metadata = authData.user.user_metadata ?? {};
  const displayName = String(metadata.display_name ?? metadata.username ?? authData.user.email ?? 'Rich Member').slice(0, 80);
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({
    iss: LIVEKIT_API_KEY,
    sub: authData.user.id,
    name: displayName,
    nbf: now - 5,
    exp: now + 60 * 60,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: isHost,
      canSubscribe: true,
      canPublishData: true
    },
    metadata: JSON.stringify({ userId: authData.user.id, streamId: stream.id, role: isHost ? 'host' : 'viewer' })
  });

  const { error: memberError } = await supabaseAdmin.from('live_stream_members').upsert({
    stream_id: stream.id,
    user_id: authData.user.id,
    role: isHost ? 'host' : 'viewer',
    status: 'active',
    joined_at: new Date().toISOString(),
    left_at: null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'stream_id,user_id' });

  if (memberError) return res.status(500).json({ error: memberError.message });

  return res.status(200).json({
    token,
    url: LIVEKIT_URL,
    roomName,
    identity: authData.user.id,
    role: isHost ? 'host' : 'viewer',
    streamId: stream.id,
    title: stream.title
  });
}

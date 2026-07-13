import { createHmac } from 'node:crypto';
import { supabaseAdmin } from '../_shared/supabase-admin';
import { createSupabaseUserClient } from '../_shared/supabase-user';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(payload: unknown): unknown;
};

type RoomGrant = {
  allowed: boolean;
  room_type: 'dm_call' | 'live_stream';
  resource_id: string;
  role: string;
  can_publish: boolean;
  can_subscribe: boolean;
  can_publish_data: boolean;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function bearerToken(headers: ApiRequest['headers']): string | null {
  const raw = headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

function requestRoom(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const room = (body as { room?: unknown }).room;
  if (typeof room !== 'string') return null;
  const normalized = room.trim();
  return /^[A-Za-z0-9_-]{3,128}$/.test(normalized) ? normalized : null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const accessToken = bearerToken(req.headers);
  const room = requestRoom(req.body);
  if (!accessToken) return res.status(401).json({ ok: false, error: 'authentication_required' });
  if (!room) return res.status(400).json({ ok: false, error: 'invalid_room' });

  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!livekitUrl || !apiKey || !apiSecret) {
    return res.status(503).json({ ok: false, error: 'livekit_not_configured' });
  }

  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userResult.user) {
    return res.status(401).json({ ok: false, error: 'invalid_session' });
  }

  const userClient = createSupabaseUserClient(accessToken);
  const { data, error } = await userClient.rpc('rb_authorize_livekit_room', { p_room_name: room });
  if (error || !data) {
    const message = error?.message ?? 'room_access_denied';
    const status = message.includes('room_not_found') ? 404 : 403;
    return res.status(status).json({ ok: false, error: message });
  }

  const grant = data as RoomGrant;
  const now = Math.floor(Date.now() / 1000);
  const identity = userResult.user.id;
  const metadata = JSON.stringify({
    user_id: identity,
    role: grant.role,
    room_type: grant.room_type,
    resource_id: grant.resource_id
  });

  const token = signJwt({
    iss: apiKey,
    sub: identity,
    name: userResult.user.user_metadata?.display_name ?? userResult.user.user_metadata?.username ?? identity,
    metadata,
    nbf: now - 5,
    exp: now + 600,
    video: {
      roomJoin: true,
      room,
      canPublish: grant.can_publish,
      canSubscribe: grant.can_subscribe,
      canPublishData: grant.can_publish_data
    }
  }, apiSecret);

  return res.status(200).json({
    ok: true,
    url: livekitUrl,
    token,
    room,
    role: grant.role,
    expiresIn: 600
  });
}

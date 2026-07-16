import { createClient } from '@supabase/supabase-js';
import { AccessToken } from 'livekit-server-sdk';

const TOKEN_TTL = '10m';
const PAID_STATUSES = ['paid', 'completed', 'succeeded', 'active'];
const ACTIVE_MEMBER_STATUSES = ['active', 'joined', 'invited'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

function env(...names) {
  return names
    .map((name) => process.env[name])
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim();
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function clients() {
  const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const publicKey = env(
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY'
  );
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publicKey || !serviceKey) throw new Error('supabase_livekit_not_configured');

  return {
    auth: createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  };
}

async function viewerAllowed(admin, stream, userId) {
  if (stream.creator_id === userId || String(stream.access_type || 'free') === 'free') return true;

  const [{ data: membership }, { data: purchase }] = await Promise.all([
    admin
      .from('live_stream_members')
      .select('id')
      .eq('stream_id', stream.id)
      .eq('user_id', userId)
      .in('status', ACTIVE_MEMBER_STATUSES)
      .maybeSingle(),
    admin
      .from('live_stream_purchases')
      .select('id')
      .eq('stream_id', stream.id)
      .eq('user_id', userId)
      .in('status', PAID_STATUSES)
      .maybeSingle()
  ]);

  return Boolean(membership || purchase);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'rich-bizness-livekit-token',
      route: '/api/live/token',
      ttl: TOKEN_TTL,
      roles: ['host', 'viewer']
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const livekitUrl = env('LIVEKIT_URL', 'NEXT_PUBLIC_LIVEKIT_URL', 'VITE_LIVEKIT_URL');
  const livekitKey = env('LIVEKIT_API_KEY');
  const livekitSecret = env('LIVEKIT_API_SECRET');
  if (!livekitUrl || !livekitKey || !livekitSecret) {
    return json(res, 503, { ok: false, error: 'livekit_not_configured' });
  }

  const sessionToken = bearer(req);
  if (!sessionToken) return json(res, 401, { ok: false, error: 'missing_bearer_token' });

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return json(res, 400, { ok: false, error: 'invalid_json' });
  }

  const roomName = String(body?.roomName || '').trim();
  const streamId = String(body?.streamId || '').trim();
  const role = body?.role === 'host' ? 'host' : body?.role === 'viewer' ? 'viewer' : '';
  if (!streamId || !roomName || roomName.length > 160 || !role) {
    return json(res, 400, { ok: false, error: 'stream_room_and_role_required' });
  }

  let auth;
  let admin;
  try {
    ({ auth, admin } = clients());
  } catch (error) {
    return json(res, 503, { ok: false, error: String(error?.message || error) });
  }

  const { data: userData, error: userError } = await auth.auth.getUser(sessionToken);
  const user = userData?.user;
  if (userError || !user) return json(res, 401, { ok: false, error: 'invalid_or_expired_session' });

  const { data: stream, error: streamError } = await admin
    .from('live_streams')
    .select('id,creator_id,title,status,access_type,livekit_room_name')
    .eq('id', streamId)
    .maybeSingle();

  if (streamError || !stream) return json(res, 404, { ok: false, error: 'live_stream_not_found' });
  if (stream.livekit_room_name !== roomName) return json(res, 409, { ok: false, error: 'livekit_room_mismatch' });

  const { data: ban } = await admin
    .from('live_stream_bans')
    .select('id')
    .eq('stream_id', stream.id)
    .eq('banned_user_id', user.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  if (ban) return json(res, 403, { ok: false, error: 'live_room_access_revoked' });

  if (role === 'host' && stream.creator_id !== user.id) {
    return json(res, 403, { ok: false, error: 'host_permission_denied' });
  }

  if (role === 'viewer') {
    if (String(stream.status).toLowerCase() !== 'live') {
      return json(res, 409, { ok: false, error: 'live_room_not_active' });
    }
    if (!(await viewerAllowed(admin, stream, user.id))) {
      return json(res, 402, { ok: false, error: 'live_room_payment_or_invite_required' });
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name,username,avatar_url,rank_title,rich_level')
    .eq('id', user.id)
    .maybeSingle();

  const participantName = String(profile?.display_name || profile?.username || user.email || 'Rich Member').slice(0, 128);
  const participantMetadata = JSON.stringify({
    user_id: user.id,
    role,
    stream_id: stream.id,
    avatar_url: profile?.avatar_url || null,
    rank_title: profile?.rank_title || null,
    rich_level: profile?.rich_level || 1
  });

  const token = new AccessToken(livekitKey, livekitSecret, {
    identity: user.id,
    name: participantName,
    metadata: participantMetadata,
    ttl: TOKEN_TTL
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canSubscribe: true,
    canPublish: role === 'host',
    canPublishData: true,
    roomAdmin: role === 'host'
  });

  const jwt = await token.toJwt();
  await admin.from('live_stream_members').upsert({
    stream_id: stream.id,
    user_id: user.id,
    role,
    status: 'active',
    joined_at: new Date().toISOString(),
    left_at: null,
    metadata: { source: 'livekit_token', room_name: roomName }
  }, { onConflict: 'stream_id,user_id' });

  return json(res, 200, {
    ok: true,
    token: jwt,
    url: livekitUrl,
    roomName,
    role,
    expiresIn: TOKEN_TTL
  });
}

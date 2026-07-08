import crypto from 'crypto';

function send(res, status, body) {
  res.status(status).json(body);
}

function clean(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeToken({ key, secret, room, identity, name, role }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: key,
    sub: identity,
    name,
    iat: now,
    nbf: now - 10,
    exp: now + 21600,
    video: {
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: role === 'host',
      canPublishData: true,
      canUpdateOwnMetadata: true
    },
    metadata: JSON.stringify({ app: 'Rich Bizness Universe', live: 'WE LIT', roomLabel: 'Bizness Party', status: 'Get Right', role })
  };
  const unsigned = `${base64url(header)}.${base64url(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  if (!livekitUrl || !key || !secret) return send(res, 500, { ok: false, error: 'LiveKit env missing in Vercel' });
  const body = req.body || {};
  const role = body.role === 'host' ? 'host' : 'audience';
  const room = clean(body.room, 'bizness-party');
  const identity = clean(body.identity || body.userId, `guest-${Date.now()}`);
  const name = String(body.name || (role === 'host' ? 'Rich Bizness Host' : 'Rich Bizness Viewer')).slice(0, 80);
  const token = makeToken({ key, secret, room, identity, name, role });
  return send(res, 200, { ok: true, token, livekitUrl, room, role, label: 'WE LIT', roomLabel: 'Bizness Party' });
}

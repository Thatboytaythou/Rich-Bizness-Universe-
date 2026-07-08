import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xfsrqomsiulswbalgknx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseStripeSignature(header) {
  return Object.fromEntries(String(header || '').split(',').map((p) => p.split('=').map((v) => String(v || '').trim())).filter(([k, v]) => k && v));
}

function verify(raw, header, secret) {
  if (!secret || !header) return false;
  const parts = parseStripeSignature(header);
  if (!parts.t || !parts.v1) return false;
  const digest = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw.toString('utf8')}`).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(parts.v1)); } catch { return false; }
}

async function log(event, status, errorMessage = null) {
  if (!SUPABASE_KEY) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/api_webhook_events`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ provider: 'stripe', event_type: event.type || 'payment.event', event_id: event.id || null, status, payload: event, error_message: errorMessage, processed_at: new Date().toISOString() })
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST required' });
  try {
    const raw = await rawBody(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ ok: false, error: 'Stripe webhook secret missing in Vercel' });
    if (!verify(raw, req.headers['stripe-signature'], secret)) return res.status(400).send('Webhook Error: invalid signature');
    const event = JSON.parse(raw.toString('utf8') || '{}');
    await log(event, 'received');
    return res.status(200).json({ ok: true, received: true, type: event.type || null, message: 'They’re here Rich' });
  } catch (error) {
    await log({ type: 'payment.error', error: error.message }, 'failed', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

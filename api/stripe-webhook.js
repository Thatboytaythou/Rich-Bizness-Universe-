import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xfsrqomsiulswbalgknx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function send(res, status, body) { return res.status(status).json(body); }
function toInt(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : fallback; }
function meta(obj) { return obj?.metadata || {}; }

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifyStripe(raw, header, secret) {
  if (!secret) return true;
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const signed = `${parts.t}.${raw.toString('utf8')}`;
  const digest = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(parts.v1)); } catch { return false; }
}

async function supa(table, method, body, query = '') {
  if (!SUPABASE_KEY) throw new Error('Supabase env missing');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json', prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || `${table} ${method} failed`);
  return Array.isArray(data) ? data[0] : data;
}

async function logEvent(event, status = 'processed') {
  try {
    await supa('api_webhook_events', 'POST', {
      provider: 'stripe',
      event_type: event.type || 'stripe.event',
      provider_event_id: event.id || null,
      status,
      payload: event,
      metadata: { source: 'stripe-webhook', rb_language: 'They’re here Rich', app: 'Rich Bizness Universe' }
    });
  } catch (_) {}
}

async function checkoutCompleted(session) {
  const m = meta(session);
  const mode = m.mode || m.checkout_mode || m.source_type || 'checkout';
  const gross = toInt(session.amount_total, 0);
  if (m.live_room_access_id) {
    await supa('live_room_access', 'PATCH', { status: 'paid', stripe_session_id: session.id }, `?id=eq.${encodeURIComponent(m.live_room_access_id)}`);
  }
  if (m.stream_id || m.live_stream_id) {
    await supa('live_stream_members', 'POST', { stream_id: m.stream_id || m.live_stream_id, user_id: m.user_id || null, role: 'viewer', status: 'paid', metadata: { stripe_session_id: session.id, mode, gross_cents: gross } });
  }
  if (m.product_id || m.store_product_id) {
    await supa('store_orders', 'POST', { buyer_user_id: m.user_id || null, product_id: m.product_id || m.store_product_id, status: 'paid', total_cents: gross, stripe_session_id: session.id, metadata: { mode, rb_language: 'They’re here Rich' } });
  }
  if (m.artist_user_id || m.creator_user_id) {
    await supa('creator_available_balances', 'POST', { artist_user_id: m.artist_user_id || m.creator_user_id, earned_cents: gross, pending_cents: gross, available_cents: 0, currency: session.currency || 'usd', metadata: { source: mode, stripe_session_id: session.id } });
  }
}

async function subscriptionChanged(subscription) {
  const status = subscription.status || 'active';
  try { await supa('fan_subscriptions', 'PATCH', { status }, `?stripe_subscription_id=eq.${encodeURIComponent(subscription.id)}`); } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST required' });
  if (!process.env.STRIPE_WEBHOOK_SECRET) return send(res, 500, { ok: false, error: 'Missing STRIPE_WEBHOOK_SECRET' });
  try {
    const raw = await rawBody(req);
    if (!verifyStripe(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) return res.status(400).send('Webhook Error: invalid signature');
    const event = JSON.parse(raw.toString('utf8') || '{}');
    if (event.type === 'checkout.session.completed') await checkoutCompleted(event.data.object);
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') await subscriptionChanged(event.data.object);
    await logEvent(event, 'processed');
    return send(res, 200, { ok: true, received: true, type: event.type || null, message: 'They’re here Rich' });
  } catch (error) {
    try { await logEvent({ type: 'stripe.error', error: error.message }, 'failed'); } catch (_) {}
    return send(res, 500, { ok: false, error: error.message });
  }
}

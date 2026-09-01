import { createClient } from '@supabase/supabase-js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

function env(...names) {
  return names.map((name) => process.env[name]).find((value) => typeof value === 'string' && value.trim())?.trim();
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

function clients(token) {
  const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const publicKey = env('SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publicKey || !serviceKey) throw new Error('supabase_checkout_not_configured');
  return {
    auth: createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    user: createClient(url, publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  };
}

async function createStripeSession(secret, payload, userId, appUrl) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('client_reference_id', userId);
  params.set('success_url', `${appUrl}/store.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${appUrl}/store.html?checkout=cancelled`);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', String(payload.currency || 'usd').toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(Number(payload.amount_total || 0)));
  params.set('line_items[0][price_data][product_data][name]', 'Rich Bizness Order');
  params.set('line_items[0][price_data][product_data][description]', `${Array.isArray(payload.order_ids) ? payload.order_ids.length : 1} marketplace order${Array.isArray(payload.order_ids) && payload.order_ids.length === 1 ? '' : 's'}`);
  params.set('metadata[checkout_key]', String(payload.checkout_key));
  params.set('metadata[buyer_id]', userId);
  params.set('payment_intent_data[metadata][checkout_key]', String(payload.checkout_key));
  params.set('payment_intent_data[metadata][buyer_id]', userId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `rb-store-${payload.checkout_key}`
    },
    body: params
  });
  const data = await response.json();
  if (!response.ok || !data?.id || !data?.url) {
    const message = data?.error?.message || `stripe_checkout_failed_${response.status}`;
    throw new Error(message);
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, service: 'rich-bizness-store-checkout', mode: 'stripe-checkout-session' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const token = bearer(req);
  if (!token) return json(res, 401, { ok: false, error: 'missing_bearer_token' });

  const stripeSecret = env('STRIPE_SECRET_KEY');
  const appUrl = (env('APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL') || 'https://rich-bizness.com').replace(/\/$/, '');
  if (!stripeSecret) return json(res, 503, { ok: false, error: 'stripe_not_configured' });

  let body;
  try { body = await parseBody(req); }
  catch { return json(res, 400, { ok: false, error: 'invalid_json' }); }

  const checkoutKey = String(body?.checkoutKey || '').trim();
  if (!checkoutKey || checkoutKey.length > 160) return json(res, 400, { ok: false, error: 'checkout_key_required' });

  let auth;
  let userClient;
  let admin;
  try {
    ({ auth, user: userClient, admin } = clients(token));
  } catch (error) {
    return json(res, 503, { ok: false, error: String(error?.message || error) });
  }

  const { data: userData, error: userError } = await auth.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json(res, 401, { ok: false, error: 'invalid_or_expired_session' });

  const { data: checkout, error: checkoutError } = await userClient.rpc('rb_store_checkout', {
    p_idempotency_key: checkoutKey
  });
  if (checkoutError || !checkout?.ok) {
    return json(res, 400, { ok: false, error: checkoutError?.message || 'checkout_contract_failed' });
  }

  const amount = Number(checkout.amount_total || 0);
  const currency = String(checkout.currency || 'usd').toLowerCase();

  if (amount <= 0) {
    const freePaymentId = `free_${checkoutKey}`.slice(0, 240);
    const { data: settlement, error: settlementError } = await admin.rpc('rb_settle_store_payment', {
      p_checkout_key: checkoutKey,
      p_payment_intent_id: freePaymentId,
      p_checkout_session_id: null,
      p_amount_cents: 0,
      p_currency: currency,
      p_metadata: { processor: 'free-checkout', buyer_id: user.id }
    });
    if (settlementError) return json(res, 500, { ok: false, error: settlementError.message || 'free_checkout_settlement_failed' });
    return json(res, 200, {
      ok: true,
      requiresPayment: false,
      checkoutKey,
      orderIds: checkout.order_ids || [],
      paymentStatus: 'paid',
      settlement
    });
  }

  try {
    const session = await createStripeSession(stripeSecret, checkout, user.id, appUrl);
    return json(res, 200, {
      ok: true,
      requiresPayment: true,
      checkoutKey,
      orderIds: checkout.order_ids || [],
      amountTotal: amount,
      currency,
      sessionId: session.id,
      checkoutUrl: session.url
    });
  } catch (error) {
    return json(res, 502, {
      ok: false,
      error: 'stripe_checkout_session_failed',
      message: String(error?.message || error).slice(0, 300),
      checkoutKey
    });
  }
}

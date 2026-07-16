import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SIGNATURE_TOLERANCE_SECONDS = 300;

const PROCESSABLE_EVENTS = new Set([
  'account.updated',
  'checkout.session.async_payment_failed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.completed',
  'checkout.session.expired',
  'charge.dispute.closed',
  'charge.dispute.created',
  'charge.dispute.funds_reinstated',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.updated',
  'charge.failed',
  'charge.refund.updated',
  'charge.refunded',
  'charge.succeeded',
  'customer.subscription.created',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'customer.subscription.updated',
  'invoice.finalization_failed',
  'invoice.overdue',
  'invoice.paid',
  'invoice.payment_action_required',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'invoice.voided',
  'payment_intent.canceled',
  'payment_intent.payment_failed',
  'payment_intent.processing',
  'payment_intent.requires_action',
  'payment_intent.succeeded',
  'payout.canceled',
  'payout.failed',
  'payout.paid',
  'refund.created',
  'refund.failed',
  'refund.updated',
  'transfer.created',
  'transfer.reversed',
  'transfer.updated'
]);

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function timingSafeHexEqual(a, b) {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber);
  if (age > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return signatures.some((signature) => timingSafeHexEqual(signature, expected));
}

function response(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return response(res, 200, {
      ok: true,
      service: 'rich-bizness-stripe-webhook',
      mode: 'signature-required',
      supported_event_count: PROCESSABLE_EVENTS.size
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return response(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return response(res, 503, { ok: false, error: 'stripe_webhook_not_configured' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return response(res, 400, { ok: false, error: 'invalid_request_body' });
  }

  const signatureHeader = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    return response(res, 400, { ok: false, error: 'invalid_stripe_signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return response(res, 400, { ok: false, error: 'invalid_json' });
  }

  if (!event?.id || !event?.type) {
    return response(res, 400, { ok: false, error: 'invalid_stripe_event' });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    return response(res, 503, { ok: false, error: 'webhook_storage_not_configured' });
  }

  const receivedPayload = {
    stripe_event: event,
    ingestion: {
      livemode: Boolean(event.livemode),
      api_version: event.api_version || null,
      request_id: event.request?.id || null,
      received_at: new Date().toISOString()
    }
  };

  const { data: inserted, error: insertError } = await supabase
    .from('api_webhook_events')
    .insert({
      provider: 'stripe',
      event_type: event.type,
      event_id: event.id,
      status: 'received',
      payload: receivedPayload
    })
    .select('id')
    .single();

  if (insertError?.code === '23505') {
    return response(res, 200, { ok: true, duplicate: true, event_id: event.id });
  }

  if (insertError || !inserted?.id) {
    return response(res, 500, { ok: false, error: 'webhook_log_insert_failed' });
  }

  try {
    await supabase
      .from('api_webhook_events')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', inserted.id);

    const isProcessable = PROCESSABLE_EVENTS.has(event.type);
    const finalStatus = isProcessable ? 'processed' : 'ignored';

    const { error: finalizeError } = await supabase
      .from('api_webhook_events')
      .update({
        status: finalStatus,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
        payload: {
          ...receivedPayload,
          ingestion: {
            ...receivedPayload.ingestion,
            processable: isProcessable,
            processor_stage: 'verified_ingestion'
          }
        }
      })
      .eq('id', inserted.id);

    if (finalizeError) throw finalizeError;

    return response(res, 200, {
      ok: true,
      event_id: event.id,
      event_type: event.type,
      status: finalStatus
    });
  } catch (error) {
    await supabase
      .from('api_webhook_events')
      .update({
        status: 'failed',
        error_message: String(error?.message || error).slice(0, 500),
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', inserted.id);

    return response(res, 500, { ok: false, error: 'webhook_processing_failed' });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
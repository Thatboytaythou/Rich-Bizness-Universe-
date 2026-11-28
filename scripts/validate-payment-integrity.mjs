import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyStripeSignature} from '../api/stripe-webhook.js';
const now=1700000000000,ts=String(now/1000),secret='local-unit-test',raw=Buffer.from('{"id":"evt_test"}');
const mac=crypto.createHmac('sha256',secret).update(ts+'.').update(raw).digest('hex');
assert.equal(verifyStripeSignature(raw,'t='+ts+',v1='+mac,secret,now),true);
assert.equal(verifyStripeSignature(Buffer.from('{}'),'t='+ts+',v1='+mac,secret,now),false);
assert.equal(verifyStripeSignature(raw,'t='+ts+',v1='+mac,secret,now+301000),false);
assert.equal(verifyStripeSignature(raw,'t='+ts+',t='+ts+',v1='+mac,secret,now),false);
assert.equal(verifyStripeSignature(raw,['t='+ts+',v1='+mac],secret,now),false);
assert.equal(verifyStripeSignature(raw,'t='+ts+',v1='+mac+'0',secret,now),false);
for(const path of ['api/stripe-webhook.js','supabase/functions/stripe-webhook/index.ts']){const s=readFileSync(path,'utf8');assert.match(s,/rb_process_stripe_event/);assert.doesNotMatch(s,/\.from\(['"]api_webhook_events/);assert.match(s,/livemode\s*!==\s*true/);}
const sql=readFileSync('supabase/migrations/20261127121151_v1_atomic_stripe_and_xp_integrity.sql','utf8');assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/payment_status'='paid'/);assert.match(sql,/creator_balance_currency_mismatch/);assert.match(sql,/grant execute on function public.rb_process_stripe_event\(jsonb\) to service_role/);
const xp=readFileSync('apps/web/src/core/xp/xp-runtime.ts','utf8');assert.match(xp,/return cleanup/);assert.match(xp,/loadRevision/);assert.match(xp,/abortSignal\(signal\)/);
console.log('V1 payment integrity: raw signature, tamper and replay rejection, shared settlement, XP cancellation');

const boundary=readFileSync('supabase/migrations/20261127124051_v1_verified_xp_paid_inventory_and_refund_review.sql','utf8');assert.match(boundary,/verified_activity_required/);assert.match(boundary,/as restrictive for insert/);assert.match(boundary,/refund_reconciliation_required/);assert.match(boundary,/excluded.refunded_cents>public.rb_stripe_refund_review.refunded_cents/);assert.match(boundary,/payment_status='paid'/);const meta=readFileSync('apps/web/src/pages/meta/meta.page.ts','utf8');assert.match(meta,/own!==chatRevision/);assert.match(meta,/own!==worldRevision/);const creator=readFileSync('apps/web/src/pages/creator/creator.page.ts','utf8');assert.ok(creator.indexOf('const cleanup=async')<creator.indexOf('await load();if(!isCurrent())return;'));console.log('V1 verified XP, refund review and stale room lifecycle contracts');

const authority=readFileSync('supabase/migrations/20261128011207_v1_profile_authority_full_store_refund.sql','utf8');assert.match(authority,/Server-managed Rich ID field/);assert.match(authority,/verified_full_refund_required/);assert.match(authority,/payment_status='refunded'/);assert.match(authority,/Verified paid entitlement required/);for(const path of ["apps/web/src/core/section-update/runtime.ts","apps/web/src/pages/creator/creator.page.ts","apps/web/src/features/avatar/avatar.elite.services.ts"])assert.doesNotMatch(readFileSync(path,'utf8'),/\.(?:maybeSingle|single)\(\)\.abortSignal\(/);console.log('V1 profile authority, full Store refund and correct query-cancellation order');

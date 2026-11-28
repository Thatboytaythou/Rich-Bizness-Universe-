import {createClient} from '@supabase/supabase-js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
export function checkoutFields(kind,reference,stream,amount){
 if(!['tip','purchase'].includes(kind)||!uuid.test(reference)||!uuid.test(stream)||!Number.isSafeInteger(amount)||amount<100||amount>10000000)throw Error('invalid_checkout_reference');
 const home='https://rich-bizness.com/live?stream='+encodeURIComponent(stream);
 return new URLSearchParams({mode:'payment','payment_method_types[0]':'card','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':kind==='tip'?'Rich Bizness live creator tip':'Rich Bizness live room access','line_items[0][quantity]':'1',success_url:home+'&payment=return',cancel_url:home+'&payment=cancelled','metadata[live_kind]':kind,'metadata[reference_id]':reference,'payment_intent_data[metadata][live_kind]':kind,'payment_intent_data[metadata][reference_id]':reference});
}
export default async function handler(req,res){
 if(req.method==='GET')return respond(res,200,{ok:true,service:'rich-bizness-live-checkout',authorization:'Rich ID required',settlement:'verified webhook'});
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return respond(res,405,{ok:false,error:'method_not_allowed'});}
 const token=String(req.headers.authorization||'');if(!token.startsWith('Bearer '))return respond(res,401,{ok:false,error:'missing_session'});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,pub=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,stripe=process.env.STRIPE_SECRET_KEY;
 if(!url||!key||!pub||!stripe||! /^(sk|rk)_live_/.test(stripe))return respond(res,503,{ok:false,error:'Live checkout not configured'});
 try{
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;const kind=body?.kind,reference=body?.reference_id;if(!['tip','purchase'].includes(kind)||typeof reference!=='string'||!uuid.test(reference))return respond(res,400,{ok:false,error:'invalid_reference'});
 const opts={auth:{persistSession:false,autoRefreshToken:false}},auth=createClient(url,pub,opts),admin=createClient(url,key,opts);
 const {data:u,error:authError}=await auth.auth.getUser(token.slice(7));if(authError||!u?.user)return respond(res,401,{ok:false,error:'invalid_session'});
 const table=kind==='tip'?'live_tips':'live_stream_purchases',owner=kind==='tip'?'from_user_id':'user_id';
 const {data:row,error:rowError}=await admin.from(table).select('id,stream_id,status,amount_cents,currency,stripe_checkout_session_id').eq('id',reference).eq(owner,u.user.id).maybeSingle();
 if(rowError||!row)return respond(res,404,{ok:false,error:'payment_reference_not_found'});
 if(row.status!=='pending'||row.currency!=='usd')return respond(res,409,{ok:false,error:'payment_not_pending'});
 const {data:stream,error:streamError}=await admin.from('live_streams').select('id,creator_id,status,access_type').eq('id',row.stream_id).maybeSingle();
 if(streamError||!stream||stream.status!=='live'||stream.creator_id===u.user.id||(kind==='purchase'&&!['paid','vip'].includes(stream.access_type)))return respond(res,409,{ok:false,error:'room_not_available'});
 const {data:ban,error:banError}=await admin.from('live_stream_bans').select('id').eq('stream_id',stream.id).eq('banned_user_id',u.user.id).or('expires_at.is.null,expires_at.gt.'+new Date().toISOString()).limit(1);
 if(banError||ban?.length)return respond(res,403,{ok:false,error:'room_access_unavailable'});
 const headers={Authorization:'Bearer '+stripe};let session;
 if(row.stripe_checkout_session_id){const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(row.stripe_checkout_session_id),{headers});if(!response.ok)return respond(res,502,{ok:false,error:'checkout_lookup_failed'});session=await response.json();}
 else{const fields=checkoutFields(kind,reference,stream.id,Number(row.amount_cents));const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'rb-live-v1-'+kind+'-'+reference},body:fields});if(!response.ok)return respond(res,502,{ok:false,error:'stripe_checkout_unavailable'});session=await response.json();
 if(session.livemode!==true||typeof session.id!=='string'||session.metadata?.reference_id!==reference||session.metadata?.live_kind!==kind||session.amount_total!==Number(row.amount_cents)||session.currency!=='usd')return respond(res,502,{ok:false,error:'checkout_mismatch'});
 const {error:saveError}=await admin.from(table).update({stripe_checkout_session_id:session.id}).eq('id',reference).eq(owner,u.user.id).eq('status','pending').is('stripe_checkout_session_id',null);if(saveError)return respond(res,503,{ok:false,error:'checkout_reference_save_failed'});}
 if(session.livemode!==true||session.status!=='open'||session.metadata?.reference_id!==reference||session.metadata?.live_kind!==kind||session.amount_total!==Number(row.amount_cents)||session.currency!=='usd'||typeof session.url!=='string')return respond(res,409,{ok:false,error:'checkout_no_longer_open'});
 const checkout=new URL(session.url);if(checkout.protocol!=='https:'||checkout.hostname!=='checkout.stripe.com')return respond(res,502,{ok:false,error:'invalid_checkout_url'});
 return respond(res,200,{ok:true,url:checkout.href});
 }catch{return respond(res,503,{ok:false,error:'checkout_unavailable'});}
}

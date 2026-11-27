import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const MAX_BODY=1024*1024;
export function verifyStripeSignature(raw,header,secret,now=Date.now()){
 if(typeof header!=='string'||!secret||!Buffer.isBuffer(raw))return false;
 const parts=header.split(',').map(p=>p.trim());const times=parts.filter(p=>p.startsWith('t=')).map(p=>p.slice(2));
 if(times.length!==1||!/^\d+$/.test(times[0])||Math.abs(Math.floor(now/1000)-Number(times[0]))>300)return false;
 const expected=crypto.createHmac('sha256',secret).update(times[0]+'.').update(raw).digest();
 return parts.filter(p=>p.startsWith('v1=')).some(p=>/^[0-9a-f]{64}$/i.test(p.slice(3))&&crypto.timingSafeEqual(Buffer.from(p.slice(3),'hex'),expected));
}
async function readRaw(req){
 if(Buffer.isBuffer(req.body)||typeof req.body==='string'){const raw=Buffer.from(req.body);if(raw.length>MAX_BODY)throw Error('body_limit');return raw;}
 if(req.body&&typeof req.body==='object')throw Error('raw_body_required');
 const chunks=[];let size=0;for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>MAX_BODY)throw Error('body_limit');chunks.push(bytes);}return Buffer.concat(chunks);
}
const response=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
export default async function handler(req,res){
 if(req.method==='GET')return response(res,200,{ok:true,service:'rich-bizness-stripe-webhook',mode:'signature-required',processor:'rb_stripe_atomic_v1'});
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return response(res,405,{ok:false,error:'method_not_allowed'});}
 const secret=process.env.STRIPE_WEBHOOK_SECRET,url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||!url||!key)return response(res,503,{ok:false,error:'webhook_not_configured'});
 let raw;try{raw=await readRaw(req);}catch{return response(res,400,{ok:false,error:'invalid_request_body'});}
 if(!verifyStripeSignature(raw,req.headers['stripe-signature'],secret))return response(res,400,{ok:false,error:'invalid_stripe_signature'});
 let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return response(res,400,{ok:false,error:'invalid_json'});}
 if(event?.livemode!==true||typeof event.id!=='string'||typeof event.type!=='string')return response(res,400,{ok:false,error:'invalid_live_stripe_event'});
 try{const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.rpc('rb_process_stripe_event',{p_event:event});if(error||data?.ok!==true)return response(res,500,{ok:false,error:'settlement_failed'});return response(res,200,{ok:true,status:data.status,duplicate:data.duplicate===true});}catch{return response(res,500,{ok:false,error:'settlement_failed'});}
}
export const config={api:{bodyParser:false}};

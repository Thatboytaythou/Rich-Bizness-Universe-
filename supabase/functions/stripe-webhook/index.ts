import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET"),stripeKey=Deno.env.get("STRIPE_SECRET_KEY"),url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!secret||!stripeKey||!url||!serviceKey)return json({ok:false,error:"webhook_not_configured"},503);
 const signature=req.headers.get("stripe-signature");if(!signature)return json({ok:false,error:"missing_signature"},400);
 if(Number(req.headers.get("content-length")??0)>1048576)return json({ok:false,error:"body_limit"},413);
 let event:Stripe.Event;
 try{const raw=await req.text();if(new TextEncoder().encode(raw).length>1048576)return json({ok:false,error:"body_limit"},413);const stripe=new Stripe(stripeKey,{apiVersion:"2025-06-30.basil"});event=await stripe.webhooks.constructEventAsync(raw,signature,secret);}catch{return json({ok:false,error:"invalid_signature"},400);}
 if(event.livemode!==true)return json({ok:false,error:"invalid_live_stripe_event"},400);
 try{const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.rpc("rb_process_stripe_event",{p_event:event});if(error||data?.ok!==true)return json({ok:false,error:"settlement_failed"},500);return json({ok:true,status:data.status,duplicate:data.duplicate===true});}catch{return json({ok:false,error:"settlement_failed"},500);}
});

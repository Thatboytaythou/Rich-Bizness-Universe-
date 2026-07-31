import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return json({ok:false,error:"method_not_allowed"},405);
  const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET")||"";
  const stripeKey=Deno.env.get("STRIPE_SECRET_KEY")||"";
  const url=Deno.env.get("SUPABASE_URL")||"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!secret||!stripeKey||!url||!serviceKey) return json({ok:false,error:"webhook_not_configured"},503);

  const signature=req.headers.get("stripe-signature");
  if(!signature) return json({ok:false,error:"missing_signature"},400);
  const raw=await req.text();
  const stripe=new Stripe(stripeKey,{apiVersion:"2025-06-30.basil"});
  let event:Stripe.Event;
  try{event=await stripe.webhooks.constructEventAsync(raw,signature,secret);}catch(error){return json({ok:false,error:"invalid_signature",message:error instanceof Error?error.message:String(error)},400);}

  const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:existing}=await supabase.from("api_webhook_events").select("id,status").eq("provider","stripe").eq("event_id",event.id).maybeSingle();
  if(existing?.status==="processed") return json({ok:true,idempotent:true,event_id:event.id});

  const payload=event.data.object as Record<string,any>;
  const {data:logRow,error:logError}=await supabase.from("api_webhook_events").upsert({provider:"stripe",event_type:event.type,event_id:event.id,status:"processing",payload:event,error_message:null,updated_at:new Date().toISOString()},{onConflict:"provider,event_id"}).select("id").single();
  if(logError) return json({ok:false,error:"webhook_log_failed",message:logError.message},500);

  try{
    if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
      const session=payload;
      const paymentIntent=typeof session.payment_intent==="string"?session.payment_intent:"";
      const amount=Number(session.amount_total||0);
      const currency=String(session.currency||"usd");
      const metadata=session.metadata||{};
      if(metadata.checkout_key){
        const {error}=await supabase.rpc("rb_settle_store_payment",{p_checkout_key:String(metadata.checkout_key),p_payment_intent_id:paymentIntent,p_checkout_session_id:String(session.id),p_amount_cents:amount,p_currency:currency,p_metadata:{stripe_event_id:event.id}});
        if(error) throw error;
      }else if(metadata.live_kind&&metadata.reference_id){
        const {error}=await supabase.rpc("rb_settle_live_payment",{p_kind:String(metadata.live_kind),p_reference_id:String(metadata.reference_id),p_payment_intent_id:paymentIntent,p_checkout_session_id:String(session.id),p_amount_cents:amount,p_metadata:{stripe_event_id:event.id}});
        if(error) throw error;
      }
    }else if(event.type==="payment_intent.succeeded"){
      const intent=payload;
      const metadata=intent.metadata||{};
      if(metadata.checkout_key){
        const {error}=await supabase.rpc("rb_settle_store_payment",{p_checkout_key:String(metadata.checkout_key),p_payment_intent_id:String(intent.id),p_checkout_session_id:null,p_amount_cents:Number(intent.amount_received||intent.amount||0),p_currency:String(intent.currency||"usd"),p_metadata:{stripe_event_id:event.id}});
        if(error) throw error;
      }else if(metadata.live_kind&&metadata.reference_id){
        const {error}=await supabase.rpc("rb_settle_live_payment",{p_kind:String(metadata.live_kind),p_reference_id:String(metadata.reference_id),p_payment_intent_id:String(intent.id),p_checkout_session_id:null,p_amount_cents:Number(intent.amount_received||intent.amount||0),p_metadata:{stripe_event_id:event.id}});
        if(error) throw error;
      }
    }

    await supabase.from("api_webhook_events").update({status:"processed",processed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",logRow.id);
    return json({ok:true,event_id:event.id,type:event.type});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await supabase.from("api_webhook_events").update({status:"failed",error_message:message,updated_at:new Date().toISOString()}).eq("id",logRow.id);
    return json({ok:false,error:"settlement_failed",message,event_id:event.id},500);
  }
});

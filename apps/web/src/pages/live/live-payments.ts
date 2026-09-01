import { supabase } from '../../core/supabase/client';

type CleanupHost=Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};

const currentStreamId=()=>new URLSearchParams(location.search).get('stream');
const showNotice=(message:string,error=false)=>{let node=document.querySelector<HTMLElement>('#livePaymentNotice');if(!node){node=document.createElement('div');node.id='livePaymentNotice';node.className='live-payment-notice';document.body.append(node);}node.dataset.error=String(error);node.textContent=message;window.setTimeout(()=>{if(node?.textContent===message)node.remove();},4200);};

export function mountLivePayments():void{
 const root=document.querySelector<HTMLElement>('#app');if(!root)return;
 const host=window as CleanupHost;
 const previousCleanup=host.__rbPageCleanup;
 let disposed=false;
 let busy=false;
 const paymentReturn=new URLSearchParams(location.search).get('payment');
 if(paymentReturn==='success')showNotice('Payment confirmed. Your Live access is syncing.');
 else if(paymentReturn==='cancelled')showNotice('Payment cancelled. Nothing was charged.');

 const checkout=async(kind:'tip'|'purchase',amountCents?:number)=>{
  if(disposed||busy)return;
  const streamId=currentStreamId();if(!streamId)return showNotice('Choose a Live room first.',true);
  const{data,error}=await supabase.auth.getSession();if(error||!data.session){location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname+location.search)}`);return;}
  busy=true;showNotice(kind==='tip'?'Opening secure tip…':'Opening secure access…');
  try{
   const response=await fetch('/api/live/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({kind,streamId,amountCents})});
   const payload=await response.json();
   if(!response.ok||!payload?.ok)throw new Error(String(payload?.message||payload?.error||'Live checkout failed.'));
   if(payload.checkoutUrl){location.assign(String(payload.checkoutUrl));return;}
   if(payload.alreadyOpen)showNotice('Access already active. Pop in.');
   else showNotice(kind==='tip'?'Tip confirmed.':'Access unlocked.');
  }catch(error){showNotice(error instanceof Error?error.message:'Live checkout failed.',true);}
  finally{busy=false;}
 };

 const capture=(event:Event)=>{
  const target=event.target instanceof Element?event.target.closest<HTMLElement>('#buyAccessBtn,#tipBtn'):null;
  if(!target)return;
  event.preventDefault();event.stopPropagation();(event as any).stopImmediatePropagation?.();
  if(target.id==='buyAccessBtn')void checkout('purchase');
  else{const dollars=Number(prompt('Tip amount in dollars','5')||0);if(Number.isFinite(dollars)&&dollars>0)void checkout('tip',Math.round(dollars*100));}
 };
 root.addEventListener('click',capture,true);
 const cleanup=async()=>{if(disposed)return;disposed=true;root.removeEventListener('click',capture,true);document.querySelector('#livePaymentNotice')?.remove();};
 host.__rbPageCleanup=async()=>{await cleanup();if(typeof previousCleanup==='function')await previousCleanup();};
}

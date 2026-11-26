// One shared, non-destructive section update bus. Broadcasts contain no credentials or identity data.
import {getAuthSnapshot} from '../auth/auth-store';
import {supabase} from '../supabase/client';
const CHANNEL='rb-section-updates-v1',KEY='rb.section.update.v1';
const consumers:Record<string,string[]>={'avatar-characters':['profile','avatar','meta','avatar-free-roam']};
type Notice={section:string;at:number};
export function publishSectionUpdate(section:string):void{
  if(!consumers[section])return;
  const message:Notice={section,at:Date.now()};
  try{const bus=new BroadcastChannel(CHANNEL);bus.postMessage(message);bus.close();}catch{}
  try{localStorage.setItem(KEY,JSON.stringify(message));}catch{}
  window.dispatchEvent(new CustomEvent('rb:section-update',{detail:message}));
}
export function mountSectionUpdates(page:string):()=>void{
  if(!page||page==='home'||page==='portal')return ()=>{};
  const controller=new AbortController(),signal=controller.signal;
  let bus:BroadcastChannel|undefined,last=0,notice:HTMLElement|undefined,release='',checking=false;
  const show=(message:string)=>{
    document.body.dataset.rbSectionFreshness='update-available';
    if(notice)return;
    notice=document.createElement('aside');notice.setAttribute('role','status');
    notice.style.cssText='position:relative;max-width:680px;margin:10px auto;padding:12px;background:#14271d;color:#f4eed7;border:1px solid #b8a66b;border-radius:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font:13px system-ui;box-shadow:0 4px 20px #0006';
    const label=document.createElement('span');label.textContent=message;
    const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh';refresh.onclick=()=>location.reload();
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss update');dismiss.onclick=()=>{notice?.remove();notice=undefined;};
    notice.append(label,refresh,dismiss);(document.querySelector('#app')??document.body).prepend(notice);
  };
  const receive=(value:unknown)=>{
    if(!value||typeof value!=='object')return;
    const {section,at}=value as Notice;
    if(typeof at!=='number'||at<=last||!consumers[section]?.includes(page))return;
    last=at;show('Rich ID was updated in another section. Refresh when ready.');
  };
  const check=async()=>{
    if(checking||signal.aborted||document.hidden)return;checking=true;
    try{
      const response=await fetch('/rb-section-release.json',{cache:'no-store',signal});
      if(!response.ok)return;
      const data=await response.json() as {schema?:number;release?:string;sections?:Record<string,{owner:string;revision:string}>};
      if(signal.aborted||data.schema!==1||typeof data.release!=='string')return;
      const current=data.sections?.[page];if(current)document.body.dataset.rbSectionRevision=current.revision;
      if(!release){release=data.release;document.body.dataset.rbSectionRelease=release;}
      else if(data.release!==release)show('A new Rich Bizness release is available. Refresh when ready.');
    }catch{}finally{checking=false;}
  };
  // Cross-device check compares only the signed-in member's saved appearance; no data enters browser storage.
  let baseline:string|undefined,baselineUser='',identityChecking=false;
  const checkIdentity=async()=>{
    if(!consumers['avatar-characters'].includes(page)||identityChecking||signal.aborted||document.hidden)return;
    const user=getAuthSnapshot().user;if(!user)return;identityChecking=true;
    const request=new AbortController(),cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});
    const timeout=window.setTimeout(cancel,8000);
    try{
      const {data,error}=await supabase.from('user_avatar_loadouts').select('id,display_name,outfit_config,aura_config').eq('user_id',user.id).maybeSingle().abortSignal(request.signal);
      if(error||signal.aborted||getAuthSnapshot().user?.id!==user.id)return;
      const value=JSON.stringify(data??null);
      if(baselineUser!==user.id){baseline=undefined;baselineUser=user.id;}
      if(baseline!==undefined&&baseline!==value)show('Your saved character changed on another session. Refresh when ready.');
      baseline=value;document.body.dataset.rbIdentityCheck='read-complete';
    }catch{}finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);identityChecking=false;}
  };
  const checkAll=()=>{void check();void checkIdentity();};
  const timer=window.setInterval(checkAll,120000);
  document.addEventListener('visibilitychange',checkAll,{signal});
  window.addEventListener('focus',checkAll,{signal});
  checkAll();
  try{bus=new BroadcastChannel(CHANNEL);bus.onmessage=e=>receive(e.data);}catch{}
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{receive(JSON.parse(e.newValue));}catch{}}},{signal});
  document.body.dataset.rbSectionUpdate='v2';
  document.body.dataset.rbSectionFreshness='current-session';
  return ()=>{controller.abort();clearInterval(timer);bus?.close();notice?.remove();};
}

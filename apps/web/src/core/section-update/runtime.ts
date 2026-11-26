// One shared, non-destructive section update bus. No user data or credentials are transmitted.
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
  let bus:BroadcastChannel|undefined,last=0,notice:HTMLElement|undefined;
  const receive=(value:unknown)=>{
    if(!value||typeof value!=='object')return;
    const {section,at}=value as Notice;
    if(typeof at!=='number'||at<=last||!consumers[section]?.includes(page))return;
    last=at;document.body.dataset.rbSectionFreshness='update-available';
    if(notice)return;
    notice=document.createElement('aside');notice.setAttribute('role','status');
    notice.style.cssText='position:fixed;bottom:calc(env(safe-area-inset-bottom) + 76px);left:12px;right:12px;max-width:440px;margin:auto;z-index:90;padding:12px;background:#14271d;color:#f4eed7;border:1px solid #b8a66b;border-radius:12px;display:flex;gap:10px;align-items:center;font:13px system-ui;box-shadow:0 4px 20px #0006';
    const label=document.createElement('span');label.textContent='Rich ID was updated in another section. Refresh when ready.';
    const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh';refresh.onclick=()=>location.reload();
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss update');dismiss.onclick=()=>{notice?.remove();notice=undefined;};
    notice.append(label,refresh,dismiss);document.body.append(notice);
  };
  try{bus=new BroadcastChannel(CHANNEL);bus.onmessage=e=>receive(e.data);}catch{}
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{receive(JSON.parse(e.newValue));}catch{}}},{signal});
  document.body.dataset.rbSectionUpdate='v1';
  document.body.dataset.rbSectionFreshness='current-session';
  return ()=>{controller.abort();bus?.close();notice?.remove();};
}

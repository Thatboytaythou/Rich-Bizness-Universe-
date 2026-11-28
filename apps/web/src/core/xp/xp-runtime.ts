import { supabase } from '../supabase/client';

type XpSnapshot={level?:number;xp_total?:number;xp_current?:number;xp_next?:number;progress_percent?:number;rank_title?:string;rich_points?:number;coins?:number;sections?:Array<{section?:string;xp_total?:number;level?:number}>;recent?:Array<{event_key?:string;xp?:number;created_at?:string}>};

type XpRuntimeState={
  owner:string;
  section:string;
  sessionId:string;
  cleanup:()=>Promise<void>;
};

declare global {
  interface Window {
    __rbXpRuntime?:XpRuntimeState;
  }
}

const pageSection=()=>document.body.dataset.page||location.pathname.replace(/^\//,'').replace(/\.html$/,'')||'portal';
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]??c));
const hiddenDockPages=new Set(['tap-in']);
const compactDockPages=new Set(['home','live','watch','music','gaming','meta','avatar','avatar-characters']);
const RUNTIME_OWNER='rich-bizness-xp-runtime-v2';

function removeStaleDocks():void{
  document.querySelectorAll<HTMLElement>('#rbXpDock,[data-rb-xp-runtime]').forEach(node=>node.remove());
}

function placeDock(dock:HTMLElement,section:string):void{
  if(section==='avatar-characters'||section==='avatar'){
    const slot=document.getElementById(section==='avatar'?'alXpSlot':'acXpSlot');
    if(slot){dock.classList.add('rb-xp-dock--inline');slot.append(dock);return;}
    dock.classList.add('rb-xp-dock--inline');(document.querySelector<HTMLElement>('#app')??document.body).prepend(dock);return;
  }
  if(section!=='profile'){
    document.body.append(dock);
    return;
  }

  dock.classList.add('rb-xp-dock--inline');
  const achievementHeading=[...document.querySelectorAll<HTMLElement>('h1,h2,h3')]
    .find(node=>/BADGES\s*\+\s*STATUS/i.test(node.textContent??''));
  const achievementCard=achievementHeading?.closest<HTMLElement>('section,article,div');
  const anchor=achievementCard?.parentElement;

  if(anchor&&achievementCard){
    anchor.insertBefore(dock,achievementCard);
    return;
  }

  (document.querySelector<HTMLElement>('#app')??document.body).append(dock);
}

let mountEpoch=0;
export async function mountXpRuntime():Promise<(()=>Promise<void>)|undefined>{
  const epoch=++mountEpoch;
  const pending=new AbortController();
  window.addEventListener('pagehide',()=>{mountEpoch++;pending.abort();},{once:true,signal:pending.signal});
  const section=pageSection();
  if(hiddenDockPages.has(section)){
    pending.abort();
    if(window.__rbXpRuntime)await window.__rbXpRuntime.cleanup();
    removeStaleDocks();
    return;
  }

  const {data:{session}}=await supabase.auth.getSession();
  if(epoch!==mountEpoch||pending.signal.aborted){pending.abort();return;}
  if(!session){
    pending.abort();
    if(window.__rbXpRuntime)await window.__rbXpRuntime.cleanup();
    removeStaleDocks();
    return;
  }

  const existing=window.__rbXpRuntime;
  if(existing?.owner===RUNTIME_OWNER&&existing.section===section&&existing.sessionId===session.user.id&&document.querySelector('#rbXpDock')){pending.abort();return existing.cleanup;}
  if(existing)await existing.cleanup();
  if(epoch!==mountEpoch||pending.signal.aborted){pending.abort();return;}
  removeStaleDocks();

  const lifecycle=pending;
  const signal=lifecycle.signal;
  const dock=document.createElement('aside');
  dock.id='rbXpDock';
  dock.dataset.rbXpRuntime=RUNTIME_OWNER;
  dock.className=`rb-xp-dock${compactDockPages.has(section)?' rb-xp-dock--compact':''}`;
  dock.dataset.section=section;
  dock.innerHTML='<button id="rbXpToggle" type="button" aria-expanded="false" aria-controls="rbXpPanel"><span>LVL</span><strong>1</strong><i><b></b></i></button><section id="rbXpPanel" hidden><header><div><small>RICH LEVEL</small><h3>SYNCING</h3></div><button id="rbXpClose" type="button" aria-label="Close XP panel">×</button></header><div class="rb-xp-grid"><article><small>TOTAL XP</small><strong id="rbXpTotal">0</strong></article><article><small>RICH POINTS</small><strong id="rbXpPoints">0</strong></article><article><small>COINS</small><strong id="rbXpCoins">0</strong></article></div><div class="rb-xp-progress"><span><b id="rbXpBar"></b></span><small id="rbXpProgress">0 / 1000 XP</small><strong id="rbXpMilestone" class="rb-xp-milestone">1,000 XP to your next level</strong></div><div class="rb-xp-lanes-heading">YOUR GROWTH LANES <small>Verified activity</small></div><div id="rbXpLanes" class="rb-xp-lanes"><p>Complete activities to grow your lanes.</p></div><div class="rb-xp-lanes-heading">RECENT GROWTH</div><div id="rbXpRecent" class="rb-xp-recent"></div><nav class="rb-xp-actions" aria-label="Rich Bizness growth destinations"><a href="/creator.html">Creator tools</a><a href="/search.html">Find your community</a></nav><p class="rb-xp-disclaimer">XP, points and coins are in-app progress, not cash earnings.</p></section>';
  placeDock(dock,section);

  const toggle=dock.querySelector<HTMLButtonElement>('#rbXpToggle')!;
  const panel=dock.querySelector<HTMLElement>('#rbXpPanel')!;
  const close=dock.querySelector<HTMLButtonElement>('#rbXpClose')!;
  const render=(data:XpSnapshot|null)=>{
    if(!data||!dock.isConnected)return;
    toggle.querySelector('strong')!.textContent=String(data.level??1);
    (toggle.querySelector('b') as HTMLElement).style.width=`${Math.max(0,Math.min(100,Number(data.progress_percent??0)))}%`;
    panel.querySelector('h3')!.textContent=data.rank_title??'Rookie Rich';
    panel.querySelector<HTMLElement>('#rbXpTotal')!.textContent=Number(data.xp_total??0).toLocaleString();
    panel.querySelector<HTMLElement>('#rbXpPoints')!.textContent=Number(data.rich_points??0).toLocaleString();
    panel.querySelector<HTMLElement>('#rbXpCoins')!.textContent=Number(data.coins??0).toLocaleString();
    panel.querySelector<HTMLElement>('#rbXpBar')!.style.width=`${Math.max(0,Math.min(100,Number(data.progress_percent??0)))}%`;
    panel.querySelector<HTMLElement>('#rbXpProgress')!.textContent=`${Number(data.xp_current??0).toLocaleString()} / ${Number(data.xp_next??1000).toLocaleString()} XP`;
    const current=Math.max(0,Number(data.xp_current??0)||0);
    const target=Math.max(1,Number(data.xp_next??1000)||1000);
    panel.querySelector<HTMLElement>('#rbXpMilestone')!.textContent=`${Math.max(0,target-current).toLocaleString()} XP until Level ${Math.max(1,Number(data.level??1)||1)+1}`;
    toggle.setAttribute('aria-label',`Rich level ${Math.max(1,Number(data.level??1)||1)}. Open your XP and growth lanes`);
    const lanes=(Array.isArray(data.sections)?data.sections:[]).filter(row=>row.section&&row.section!=='auth'&&row.section!=='global').sort((a,b)=>(Number(b.xp_total)||0)-(Number(a.xp_total)||0)).slice(0,3);
    const maxLane=Math.max(1,...lanes.map(row=>Number(row.xp_total)||0));
    panel.querySelector<HTMLElement>('#rbXpLanes')!.innerHTML=lanes.length?lanes.map(row=>{
      const name=esc(String(row.section??'').replaceAll('_',' ').toUpperCase());
      const amount=Math.max(0,Number(row.xp_total)||0);
      const width=Math.max(0,Math.min(100,Math.round(amount/maxLane*100)));
      return `<article><div><span>${name}</span><strong>${amount.toLocaleString()} XP</strong></div><i aria-hidden="true"><b style="width:${width}%"></b></i></article>`;
    }).join(''):'<p>Your growth lanes will appear after verified activity.</p>';
    const recent=Array.isArray(data.recent)?data.recent.slice(0,5):[];
    panel.querySelector<HTMLElement>('#rbXpRecent')!.innerHTML=recent.length?recent.map(row=>`<article><span>${esc(String(row.event_key??'XP EARNED').replaceAll('_',' ').toUpperCase())}</span><strong>+${Number(row.xp??0)} XP</strong></article>`).join(''):'<p>Your XP activity will appear here.</p>';
  };
  let loadRevision=0;
  const load=async()=>{const own=++loadRevision;try{const {data,error}=await supabase.rpc('rb_xp_snapshot',{p_user_id:session.user.id}).abortSignal(signal);if(!signal.aborted&&own===loadRevision&&!error)render(data as XpSnapshot|null);}catch(error){if(!signal.aborted)console.warn('[Rich XP] snapshot unavailable',error);}};

  toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));},{signal});
  close.addEventListener('click',()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');},{signal});

  let channel:ReturnType<typeof supabase.channel>|null=null;
  let cleaned=false;
  const cleanup=async()=>{
    if(cleaned)return;
    cleaned=true;lifecycle.abort();dock.remove();
    if(window.__rbXpRuntime?.cleanup===cleanup)delete window.__rbXpRuntime;
    if(channel)await supabase.removeChannel(channel);
  };
  window.__rbXpRuntime={owner:RUNTIME_OWNER,section,sessionId:session.user.id,cleanup};
  signal.addEventListener('abort',()=>void cleanup(),{once:true});
  const initialize=async()=>{
    try{
      const daily=await supabase.rpc('rb_award_xp',{p_event_key:'daily_tap_in',p_section:'auth',p_source_table:null,p_source_id:null,p_amount:null}).abortSignal(signal);if(daily.error&&!signal.aborted)console.warn('[Rich XP] daily award unavailable',daily.error.message);
      if(signal.aborted)return;
      if(section!=='home'){const visit=await supabase.rpc('rb_award_xp',{p_event_key:'section_visit',p_section:section,p_source_table:null,p_source_id:null,p_amount:null}).abortSignal(signal);if(visit.error&&!signal.aborted)console.warn('[Rich XP] section award unavailable',visit.error.message);}
      if(signal.aborted)return;
      await load();
      if(signal.aborted)return;
      channel=supabase.channel(`xp-runtime:${session.user.id}:${section}`).on('postgres_changes',{event:'*',schema:'public',table:'user_levels',filter:`user_id=eq.${session.user.id}`},()=>void load()).subscribe();
    }catch(error){if(!signal.aborted)console.warn('[Rich XP] initialization failed',error);}
  };
  void initialize();
  return cleanup;
}

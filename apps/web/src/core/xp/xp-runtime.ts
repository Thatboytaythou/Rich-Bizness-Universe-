import { supabase } from '../supabase/client';

type XpSnapshot={level?:number;xp_total?:number;xp_current?:number;xp_next?:number;progress_percent?:number;rank_title?:string;rich_points?:number;coins?:number;recent?:Array<{event_key?:string;xp?:number;created_at?:string}>};

const pageSection=()=>document.body.dataset.page||location.pathname.replace(/^\//,'').replace(/\.html$/,'')||'portal';
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const immersivePages=new Set(['portal','tap-in','live','watch','music','podcast','radio','gaming','meta','avatar']);

export async function mountXpRuntime():Promise<void>{
  const section=pageSection();
  if(immersivePages.has(section))return;
  const {data:{session}}=await supabase.auth.getSession();
  if(!session||document.querySelector('#rbXpDock'))return;

  const dock=document.createElement('aside');
  dock.id='rbXpDock';
  dock.className='rb-xp-dock';
  dock.innerHTML='<button id="rbXpToggle" type="button" aria-expanded="false"><span>LVL</span><strong>1</strong><i><b></b></i></button><section id="rbXpPanel" hidden><header><div><small>RICH LEVEL</small><h3>SYNCING</h3></div><button id="rbXpClose" type="button">×</button></header><div class="rb-xp-grid"><article><small>TOTAL XP</small><strong id="rbXpTotal">0</strong></article><article><small>RICH POINTS</small><strong id="rbXpPoints">0</strong></article><article><small>COINS</small><strong id="rbXpCoins">0</strong></article></div><div class="rb-xp-progress"><span><b id="rbXpBar"></b></span><small id="rbXpProgress">0 / 1000 XP</small></div><div id="rbXpRecent" class="rb-xp-recent"></div></section>';
  document.body.append(dock);

  const toggle=dock.querySelector<HTMLButtonElement>('#rbXpToggle')!;
  const panel=dock.querySelector<HTMLElement>('#rbXpPanel')!;
  const close=dock.querySelector<HTMLButtonElement>('#rbXpClose')!;
  const render=(data:XpSnapshot|null)=>{
    if(!data)return;
    toggle.querySelector('strong')!.textContent=String(data.level??1);
    (toggle.querySelector('b') as HTMLElement).style.width=`${Math.max(0,Math.min(100,Number(data.progress_percent??0)))}%`;
    panel.querySelector('h3')!.textContent=data.rank_title??'Rookie Rich';
    panel.querySelector<HTMLElement>('#rbXpTotal')!.textContent=Number(data.xp_total??0).toLocaleString();
    panel.querySelector<HTMLElement>('#rbXpPoints')!.textContent=Number(data.rich_points??0).toLocaleString();
    panel.querySelector<HTMLElement>('#rbXpCoins')!.textContent=Number(data.coins??0).toLocaleString();
    panel.querySelector<HTMLElement>('#rbXpBar')!.style.width=`${Math.max(0,Math.min(100,Number(data.progress_percent??0)))}%`;
    panel.querySelector<HTMLElement>('#rbXpProgress')!.textContent=`${Number(data.xp_current??0).toLocaleString()} / ${Number(data.xp_next??1000).toLocaleString()} XP`;
    const recent=Array.isArray(data.recent)?data.recent.slice(0,5):[];
    panel.querySelector<HTMLElement>('#rbXpRecent')!.innerHTML=recent.length?recent.map(row=>`<article><span>${esc(String(row.event_key??'XP EARNED').replaceAll('_',' ').toUpperCase())}</span><strong>+${Number(row.xp??0)} XP</strong></article>`).join(''):'<p>Your XP activity will appear here.</p>';
  };
  const load=async()=>{const {data}=await supabase.rpc('rb_xp_snapshot',{p_user_id:session.user.id});render(data as XpSnapshot|null);};
  toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
  close.onclick=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');};

  await supabase.rpc('rb_award_xp',{p_event_key:'section_visit',p_section:section,p_source_table:null,p_source_id:null,p_amount:null});
  await load();

  const channel=supabase.channel(`xp-runtime:${session.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'user_levels',filter:`user_id=eq.${session.user.id}`},()=>void load()).subscribe();
  window.addEventListener('beforeunload',()=>{void supabase.removeChannel(channel);},{once:true});
}

import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './creator-dimensions.css';

type DimensionKey = 'on_the_go' | 'dash_businesses' | 'private_world' | 'movies';
type Rule = { route_key:string; route_path:string; entry_cost_cents:number|null; metadata:Record<string,unknown>|null };
type Access = { id:string; dimension_key:DimensionKey; status:string; fee_cents:number; currency:string; approved_at:string|null; expires_at:string|null };

const DETAILS: Record<DimensionKey,{label:string;eyebrow:string;description:string;icon:string}> = {
  on_the_go:{label:'On The Go',eyebrow:'MOBILE EARNINGS DIMENSION',description:'Local rides, pickups, deliveries, driver sessions, dispatch and creator mobility tools.',icon:'⚡'},
  dash_businesses:{label:'Dash Businesses',eyebrow:'BUSINESS NETWORK DIMENSION',description:'Private seller operations, local business dashboards, service drops, orders and paid growth tools.',icon:'🏙️'},
  private_world:{label:'Private World',eyebrow:'MEMBERS-ONLY WORLD',description:'A protected social and Meta layer for approved members, private rooms, events and premium experiences.',icon:'◎'},
  movies:{label:'Movies',eyebrow:'CINEMA DIMENSION',description:'Premium screenings, creator premieres, watch rooms, releases and protected movie experiences.',icon:'🎬'}
};
const money=(cents:number|null|undefined,currency='usd')=>new Intl.NumberFormat('en-US',{style:'currency',currency:currency.toUpperCase()}).format(Number(cents??0)/100);
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app'); if(!root) throw new Error('Missing #app');
  if(root.dataset.mounted==='true') return; root.dataset.mounted='true';
  const auth=getAuthSnapshot(); const user=auth.user;
  if(!user){location.replace('/tap-in.html?next=%2Fcreator-dimensions.html');return;}
  root.innerHTML=`<main class="dimension-shell"><div class="dimension-wrap"><header class="dimension-head"><a href="/creator.html">←</a><div><p>RICH BIZNESS SECRET CREATOR GATE</p><h1>Creator Dimensions</h1></div><span id="dimensionState" class="dimension-live">SECURE</span></header><section class="dimension-hero"><div><span>ADMIN APPROVAL · PAID ACCESS · PRIVATE ROUTES</span><h2>ENTER ANOTHER DIMENSION</h2><p>Four protected creator systems. Every entry is verified through Supabase access rules, payment state and administrator approval.</p></div></section><section id="dimensionGrid" class="dimension-grid"></section><p id="dimensionStatus" class="dimension-status" role="status"></p></div></main>`;
  const grid=document.querySelector<HTMLElement>('#dimensionGrid')!; const status=document.querySelector<HTMLElement>('#dimensionStatus')!; const state=document.querySelector<HTMLElement>('#dimensionState')!;
  let loading=false; let queued=false; let channel:ReturnType<typeof supabase.channel>|null=null; let destroyed=false;
  const setStatus=(message:string,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
  const requestAccess=async(key:DimensionKey,fee:number)=>{
    setStatus('CREATING SECURE ACCESS REQUEST…');
    const {error}=await supabase.from('creator_dimension_access').upsert({user_id:user.id,dimension_key:key,status:'pending',fee_cents:fee,currency:'usd',updated_at:new Date().toISOString()},{onConflict:'user_id,dimension_key'});
    if(error){setStatus(error.message,true);return;}
    setStatus('REQUEST SENT — ADMIN APPROVAL AND PAYMENT CONFIRMATION REQUIRED'); await load();
  };
  const render=(rules:Rule[],accessRows:Access[],profile:Record<string,unknown>)=>{
    const accessMap=new Map(accessRows.map(row=>[row.dimension_key,row]));
    const keys=(['on_the_go','dash_businesses','private_world','movies'] as DimensionKey[]);
    grid.innerHTML=keys.map(key=>{
      const detail=DETAILS[key]; const rule=rules.find(row=>row.route_key===`dimension_${key}`); const access=accessMap.get(key); const fee=Number(rule?.entry_cost_cents??0);
      const active=access?.status==='active'&&(!access.expires_at||new Date(access.expires_at)>new Date());
      const pending=access?.status==='pending';
      const badge=active?'ACCESS ACTIVE':pending?'APPROVAL PENDING':access?.status?access.status.toUpperCase():'LOCKED';
      return `<article class="dimension-card ${active?'active':''}"><div class="dimension-icon">${detail.icon}</div><span>${esc(detail.eyebrow)}</span><h3>${esc(detail.label)}</h3><p>${esc(detail.description)}</p><div class="dimension-meta"><strong>${money(fee)}</strong><em>${esc(badge)}</em></div>${active?`<button class="dimension-btn primary" data-enter="${key}">ENTER DIMENSION</button>`:`<button class="dimension-btn" data-request="${key}" data-fee="${fee}" ${pending?'disabled':''}>${pending?'REQUEST PENDING':'REQUEST ACCESS'}</button>`}</article>`;
    }).join('');
    state.textContent=profile.vault_unlocked?'VAULT UNLOCKED':'SECURE';
    grid.querySelectorAll<HTMLButtonElement>('[data-request]').forEach(button=>button.onclick=()=>void requestAccess(button.dataset.request as DimensionKey,Number(button.dataset.fee||0)));
    grid.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach(button=>button.onclick=()=>{const key=button.dataset.enter as DimensionKey;location.assign(`/creator-dimensions.html?dimension=${encodeURIComponent(key)}&mode=enter`);});
  };
  const load=async()=>{
    if(loading){queued=true;return;} loading=true; setStatus('VERIFYING DIMENSION ACCESS…');
    const {data,error}=await supabase.rpc('rb_creator_dimension_snapshot');
    loading=false; if(destroyed)return;
    if(error){setStatus(error.message,true);return;}
    const snapshot=(data??{}) as {rules?:Rule[];access?:Access[];profile?:Record<string,unknown>};
    render(snapshot.rules??[],snapshot.access??[],snapshot.profile??{}); setStatus('DIMENSION GATE ONLINE');
    if(queued){queued=false;void load();}
  };
  await load();
  channel=supabase.channel(`creator-dimensions:${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'creator_dimension_access',filter:`user_id=eq.${user.id}`},()=>void load()).subscribe();
  const cleanup=()=>{if(destroyed)return;destroyed=true;if(channel)void supabase.removeChannel(channel);};
  window.addEventListener('pagehide',cleanup,{once:true}); window.addEventListener('beforeunload',cleanup,{once:true});
}

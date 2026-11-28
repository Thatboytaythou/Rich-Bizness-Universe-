import {renderPortalShell,bindPortalDestinations} from './portal.shell';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { mountPortalMotion } from './portal.motion';
import './portal.command.css';

type JsonMap=Record<string,unknown>;
type PortalSnapshot={profile?:JsonMap;level?:JsonMap;avatar?:JsonMap;settings?:JsonMap;unread_notifications?:number;unread_threads?:number};
const CANONICAL_OWNER='rich-bizness-portal-v3';
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const safeMedia=(v:unknown)=>{if(typeof v!=='string'||!v.trim())return '';try{const u=new URL(String(v??''),location.origin);return u.protocol==='https:'||u.origin===location.origin?u.href:'';}catch{return'';}};
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;};
const money=(v:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(v)/100);
export async function mountPortalPage():Promise<void>{
 const app=document.querySelector<HTMLDivElement>('#app');if(!app)throw new Error('Missing #app mount');
 const mountEpoch=app.dataset.pageEpoch??'';let disposed=false;const user=getAuthSnapshot().user;const isCurrent=()=>!disposed&&!app.hidden&&getAuthSnapshot().user?.id===user?.id&&app.dataset.pageEpoch===mountEpoch&&app.dataset.pageOwner===CANONICAL_OWNER;
 if(!user||!isCurrent())return;
 const lifecycle=new AbortController();let pending:AbortController|undefined;let timeout=0;let lastSync=0;let cleanupMotion=()=>{};let currentReduced:boolean|undefined;
 renderPortalShell(app);
 const get=(id:string)=>app.querySelector<HTMLElement>('#'+id);
 const put=(id:string,value:unknown)=>{const el=get(id);if(el)el.textContent=String(value);};
 bindPortalDestinations(app,lifecycle,isCurrent);
 const badge=(id:string,v:unknown)=>{const el=get(id),n=num(v);if(el){el.hidden=n===0;el.textContent=n>999?'999+':String(n);}};
 const setMotion=(reduced:boolean)=>{if(currentReduced===reduced)return;currentReduced=reduced;cleanupMotion();app.querySelector('.portal-command')?.setAttribute('data-motion',reduced?'reduced':'full');cleanupMotion=mountPortalMotion({reduced});};
 const prefers=matchMedia('(prefers-reduced-motion: reduce)');let memberReduced=false;const pauseVisuals=()=>app.querySelector('.portal-command')?.setAttribute('data-visibility',document.hidden?'hidden':'visible');pauseVisuals();
 setMotion(prefers.matches);
 const apply=(s:PortalSnapshot)=>{const profile=s.profile??{},level=s.level??{},avatar=s.avatar??{},settings=s.settings??{};put('rbPortalName',profile.display_name??profile.username??avatar.display_name??'Rich member');put('rbPortalLevel','LEVEL '+Math.max(1,num(level.level??profile.rich_level)));const image=safeMedia(profile.avatar_url??avatar.avatar_url),holder=get('rbPortalAvatar');if(holder&&image&&holder.querySelector('img')?.src!==image){const img=document.createElement('img');img.alt='';img.src=image;img.onerror=()=>{if(holder.contains(img))holder.textContent='RB';};holder.replaceChildren(img);}
 const xp=num(level.xp_current),next=Math.max(1,num(level.xp_next??100));put('rbPortalXp',xp.toLocaleString()+' / '+next.toLocaleString()+' XP');const progress=get('rbPortalProgress');if(progress)progress.style.width=Math.min(100,xp/next*100)+'%';
 put('rbPortalBalance',money(profile.balance_cents));put('rbPortalPoints',num(level.rich_points??profile.rich_points).toLocaleString());put('rbPortalRank',level.rank_title??profile.rank_title??'Member');put('rbPortalOnline',String(profile.online_status??'connected').toUpperCase());badge('rbPortalDM',s.unread_threads);badge('rbPortalAlerts',s.unread_notifications);memberReduced=['reduced','off'].includes(String(settings.motion_level??'full').toLowerCase());setMotion(prefers.matches||memberReduced);};
 let snapshotReady=false;const refresh=async()=>{if(!isCurrent()||document.hidden||pending)return;const abort=new AbortController();pending=abort;timeout=window.setTimeout(()=>abort.abort(),9000);const button=app.querySelector<HTMLButtonElement>('#rbPortalRefresh');if(button)button.disabled=true;put('rbPortalStatus',snapshotReady?'Refreshing…':'Connecting dashboard…');try{const {data,error}=await supabase.rpc('rb_portal_elite_snapshot',{}).abortSignal(abort.signal);if(error||!data)throw Error('Dashboard unavailable');if(!isCurrent())return;apply(data as PortalSnapshot);snapshotReady=true;lastSync=Date.now();put('rbPortalStatus','Synced '+new Date(lastSync).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));}catch{if(isCurrent())put('rbPortalStatus',snapshotReady?'Last sync retained · retry':'Dashboard unavailable · retry');}finally{clearTimeout(timeout);if(pending===abort)pending=undefined;if(isCurrent()&&button)button.disabled=false;}};
 const poll=window.setInterval(()=>{if(!document.hidden&&Date.now()-lastSync>40000)void refresh();},45000);
 document.addEventListener('visibilitychange',()=>{pauseVisuals();if(!document.hidden&&Date.now()-lastSync>30000)void refresh();},{signal:lifecycle.signal});
 window.addEventListener('online',()=>void refresh(),{signal:lifecycle.signal});
 prefers.addEventListener('change',()=>{setMotion(prefers.matches||memberReduced);},{signal:lifecycle.signal});
 get('rbPortalRefresh')?.addEventListener('click',()=>void refresh(),{signal:lifecycle.signal});
 const host=window as Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};const cleanup=()=>{if(disposed)return;disposed=true;lifecycle.abort();pending?.abort();clearTimeout(timeout);clearInterval(poll);cleanupMotion();if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null;};host.__rbPageCleanup=cleanup;window.addEventListener('pagehide',cleanup,{signal:lifecycle.signal,once:true});
 void refresh();
}

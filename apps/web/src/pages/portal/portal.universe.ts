import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { mountPortalMotion } from './portal.motion';
import './portal.motion.css';
import './portal.overdrive.css';
import './portal.machine.css';
import './portal.index-fix.css';

type JsonMap=Record<string,unknown>;
type Activity={kind?:string;title?:string;href?:string};
type PortalSnapshot={profile?:JsonMap;level?:JsonMap;avatar?:JsonMap;settings?:JsonMap;announcement?:JsonMap;section_pulse?:Record<string,number>;recent_activity?:Activity[];unread_notifications?:number;unread_threads?:number};
type Destination={key:string;label:string;icon:string;href:string;position:string;kicker:string};
const DEFAULT_PORTAL_BACKGROUND='/images/0E886281-8F03-4288-B3CA-C45369B7B58E.png';
const CANONICAL_OWNER='rich-bizness-portal-v3';
const destinations:Destination[]=[
{key:'live',label:'LIVE',icon:'◉',href:ROUTES.live,position:'top',kicker:'BROADCAST'},
{key:'gallery',label:'GALLERY',icon:'▣',href:ROUTES.gallery,position:'top-left',kicker:'VISUALS'},
{key:'music',label:'MUSIC',icon:'♪',href:ROUTES.music,position:'top-right',kicker:'AUDIO'},
{key:'upload',label:'UPLOAD',icon:'⬆',href:ROUTES.upload,position:'left',kicker:'CREATE'},
{key:'gaming',label:'GAMING',icon:'🎮',href:ROUTES.gaming,position:'right',kicker:'PLAY'},
{key:'sports',label:'SPORTS',icon:'🏆',href:ROUTES.sports,position:'bottom-left',kicker:'ARENA'},
{key:'meta',label:'META',icon:'◎',href:ROUTES.meta,position:'bottom',kicker:'WORLDS'},
{key:'store',label:'STORE',icon:'🛒',href:ROUTES.store,position:'bottom-right',kicker:'MARKET'}];
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const money=(value:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value??0)/100);
const safeUrl=(value:unknown)=>{const raw=String(value??'').trim();return raw.startsWith('/')||raw.startsWith('https://')?raw:'';};
const badge=(count:number,label:string)=>count>0?`<b data-count="${count}" aria-label="${count} new ${esc(label)} updates">${count>999?'999+':count}</b>`:'';

export async function mountPortalPage():Promise<void>{
 const app=document.querySelector<HTMLDivElement>('#app');if(!app)throw new Error('Missing #app mount');
 const mountEpoch=app.dataset.pageEpoch??'';let disposed=false;const isCurrent=()=>!disposed&&app.dataset.pageEpoch===mountEpoch&&app.dataset.pageOwner===CANONICAL_OWNER;
 const user=getAuthSnapshot().user;if(!user||!isCurrent())return;
 let snapshot:PortalSnapshot={};const{data,error}=await supabase.rpc('rb_portal_elite_snapshot',{});if(!isCurrent())return;if(!error)snapshot=(data??{}) as PortalSnapshot;
 const profile=snapshot.profile??{},level=snapshot.level??{},avatar=snapshot.avatar??{},settings=snapshot.settings??{},pulse=snapshot.section_pulse??{};
 const name=String(profile.display_name??profile.username??avatar.display_name??user.email?.split('@')[0]??'RICH BIZNESS');
 const avatarUrl=safeUrl(profile.avatar_url??avatar.avatar_url);const accent=String(settings.accent_color??'#31ff63');const richLevel=Number(level.level??profile.rich_level??avatar.level??1);const xpCurrent=Number(level.xp_current??0),xpNext=Math.max(1,Number(level.xp_next??100)),xpPercent=Math.min(100,Math.max(0,(xpCurrent/xpNext)*100));
 const motionLevel=String(settings.motion_level??'full').toLowerCase();const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches||motionLevel==='reduced'||motionLevel==='off';
 app.innerHTML=`<main class="portal-stage portal-stage--elite portal-stage--reset" style="--portal-accent:${esc(accent)};--portal-bg:url('${DEFAULT_PORTAL_BACKGROUND}')">
 <canvas id="portalMotionCanvas" class="portal-motion-canvas" aria-hidden="true"></canvas><div class="portal-bg" aria-hidden="true"></div><div class="portal-vignette" aria-hidden="true"></div>
 <header class="portal-topbar"><a class="portal-profile" href="${ROUTES.profile}"><span class="portal-profile__avatar">${avatarUrl?`<img src="${esc(avatarUrl)}" alt="">`:'RB'}<i></i></span><span class="portal-profile__copy"><small>WELCOME BACK</small><strong>${esc(name)}</strong><em>LEVEL ${richLevel}</em></span></a><div class="portal-brand"><small>RICH BIZNESS LLC</small><strong>UNIVERSE</strong></div></header>
 <section class="portal-world" aria-label="Rich Bizness Universe portal"><div class="portal-horizon" aria-hidden="true"></div><div class="portal-machine" aria-hidden="true"><div class="portal-machine__base"></div><div class="portal-machine__tunnel"></div><div class="portal-machine__membrane"></div><div class="portal-machine__frame"></div></div><div class="portal-core portal-core--unified"><span class="portal-core__content"><small>RICH BIZNESS LLC</small><strong>PORTAL</strong><span>CHOOSE YOUR UNIVERSE</span><b>${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()} XP</b><i><u style="width:${xpPercent}%"></u></i></span></div><nav class="portal-route-layer" aria-label="Universe destinations">${destinations.map((d,i)=>`<a class="portal-node portal-node--${d.position}" href="${d.href}" style="--node:${i};--delay:${i*.1}s"><span class="portal-node__icon">${d.icon}</span><span class="portal-node__copy"><small>${d.kicker}</small><strong>${d.label}</strong></span>${badge(Number(pulse[d.key]??0),d.label)}</a>`).join('')}</nav></section>
 <aside class="portal-actions"><a href="${ROUTES.search}"><span>⌕</span><small>SEARCH</small></a><a href="${ROUTES.messages}"><span>✦</span><small>DM</small>${snapshot.unread_threads?`<b>${snapshot.unread_threads}</b>`:''}</a><a href="${ROUTES.notifications}"><span>◌</span><small>ALERTS</small>${snapshot.unread_notifications?`<b>${snapshot.unread_notifications}</b>`:''}</a><a href="${ROUTES.avatarCharacters}"><span>◉</span><small>3D</small></a></aside>
 <footer class="portal-stats"><article><small>BALANCE</small><strong>${money(profile.balance_cents)}</strong></article><article><small>RICH POINTS</small><strong>${Number(level.rich_points??profile.rich_points??0).toLocaleString()}</strong></article><article><small>RANK</small><strong>${esc(level.rank_title??profile.rank_title??'BIZ LEGEND')}</strong></article><article><small>ONLINE</small><strong>${esc(String(profile.online_status??'LIVE').toUpperCase())}</strong></article></footer></main>`;
 if(!isCurrent())return;const cleanupMotion=mountPortalMotion({reduced:reducedMotion});const cleanup=()=>{if(disposed)return;disposed=true;cleanupMotion();};(window as Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null}).__rbPageCleanup=cleanup;window.addEventListener('pagehide',cleanup,{once:true});window.addEventListener('beforeunload',cleanup,{once:true});
}

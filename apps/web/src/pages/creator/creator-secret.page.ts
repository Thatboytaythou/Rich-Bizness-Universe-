import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './creator-dimensions.css';
import './creator-secret-motion.css';

type SecretKey = 'secret-on-the-go-day' | 'secret-businesses' | 'secret-movies' | 'secret-private-world';
type DimensionKey = 'on_the_go' | 'dash_businesses' | 'movies' | 'private_world';
type Access = { dimension_key: DimensionKey; status: string; expires_at: string | null };

const CONFIG: Record<SecretKey, { dimension:DimensionKey; kicker:string; title:string; subtitle:string; cards:Array<[string,string,string]> }> = {
  'secret-on-the-go-day': { dimension:'on_the_go', kicker:'CREATOR SECRET 01 • LOCAL MOBILITY', title:'ON THE GO DAY', subtitle:'Creator-owned local rides, pickups, deliveries, driver sessions, dispatch, routes and neighborhood earnings.', cards:[['DISPATCH','Mission control','Assign, track and complete local jobs.'],['DRIVERS','Trusted network','Driver identity, availability and performance.'],['EARNINGS','Money flow','Track job value, tips, fees and payout readiness.']] },
  'secret-businesses': { dimension:'dash_businesses', kicker:'CREATOR SECRET 02 • LOCAL COMMERCE', title:'BUSINESSES', subtitle:'Creator-owned merchant tools for storefronts, services, discovery, inventory, trust and paid local growth.', cards:[['DISCOVERY','Business universe','Find verified local businesses and services.'],['MERCHANTS','Operator tools','Profiles, hours, offers, inventory and customer activity.'],['TRUST','Business safety','Verification, reports, reviews and platform controls.']] },
  'secret-movies': { dimension:'movies', kicker:'CREATOR SECRET 03 • CINEMA NETWORK', title:'MOVIES', subtitle:'Creator-owned premium screenings, premieres, watch rooms, releases and protected playback experiences.', cards:[['PREMIERES','Release command','Schedule and launch protected movie events.'],['WATCH ROOMS','Shared cinema','Private and public synchronized viewing spaces.'],['RIGHTS','Playback control','Access tiers, availability, ownership and moderation.']] },
  'secret-private-world': { dimension:'private_world', kicker:'CREATOR SECRET 04 • PRIVATE DIMENSION', title:'PRIVATE WORLD', subtitle:'Creator-owned approved-member rooms, invitation gates, private inventory and premium Meta experiences.', cards:[['GATES','Invitation access','Control entry, roles, keys and membership.'],['ROOMS','Private dimensions','Build protected lounges, studios and worlds.'],['VAULT','Hidden inventory','Manage unreleased assets, rewards and private drops.']] }
};

const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));

export async function mount(): Promise<void> {
  const root=document.querySelector<HTMLElement>('#app');
  if(!root) throw new Error('Missing #app');
  const key=(document.body.dataset.page || '') as SecretKey;
  const config=CONFIG[key];
  if(!config) throw new Error('Unknown creator secret door');
  const owner=`rich-bizness-creator-${config.dimension}-v2`;
  if(root.dataset.pageOwner===owner) return;
  root.dataset.pageOwner=owner;
  const user=getAuthSnapshot().user;
  if(!user){location.replace(`${ROUTES.tapIn}?next=${encodeURIComponent(location.pathname)}`);return;}
  const { data,error }=await supabase.rpc('rb_creator_dimension_snapshot');
  if(error){root.innerHTML=`<main class="dimension-shell"><div class="dimension-wrap"><header class="dimension-head"><a href="${ROUTES.creator}">←</a><div><p>RICH BIZNESS CREATOR SECURITY</p><h1>Restricted</h1></div></header><section class="dimension-hero"><div><span>CREATOR ACCESS REQUIRED</span><h2>SECRET GATE</h2><p>${esc(error.message)}</p></div></section></div></main>`;return;}
  const access=((data as {access?:Access[]}|null)?.access??[]).find((row)=>row.dimension_key===config.dimension);
  const active=access?.status==='active'&&(!access.expires_at||new Date(access.expires_at)>new Date());
  if(!active){root.innerHTML=`<main class="dimension-shell"><div class="dimension-wrap"><header class="dimension-head"><a href="${ROUTES.creatorDimensions}">←</a><div><p>RICH BIZNESS SECRET CREATOR GATE</p><h1>${config.title}</h1></div><span class="dimension-live">LOCKED</span></header><section class="dimension-hero"><div><span>${config.kicker}</span><h2>ACCESS REQUIRED</h2><p>This creator dimension requires an active approved access record. Return to Creator Dimensions to request or verify access.</p><a class="dimension-btn primary" href="${ROUTES.creatorDimensions}">OPEN CREATOR DIMENSIONS</a></div></section></div></main>`;return;}
  root.innerHTML=`<main class="dimension-shell"><div class="dimension-wrap"><header class="dimension-head"><a href="${ROUTES.creator}" aria-label="Back to Creator">←</a><div><p>RICH BIZNESS CREATOR SECRET DOOR</p><h1>${config.title}</h1></div><span class="dimension-live">ACCESS ACTIVE</span></header><section class="dimension-hero"><div><span>${config.kicker}</span><h2>${config.title}</h2><p>${config.subtitle}</p></div></section><section class="dimension-grid">${config.cards.map(([tag,title,copy])=>`<article class="dimension-card active"><div class="dimension-icon">${esc(tag.slice(0,1))}</div><span>${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join('')}</section></div></main>`;
}

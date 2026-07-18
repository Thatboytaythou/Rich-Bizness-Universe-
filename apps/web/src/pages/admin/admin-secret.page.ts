import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './admin-secret-motion.css';

type SecretKey = 'secret-on-the-go-day' | 'secret-businesses' | 'secret-movies' | 'secret-private-world';

const CONFIG: Record<SecretKey, { kicker:string; title:string; subtitle:string; cards:Array<[string,string,string]> }> = {
  'secret-on-the-go-day': { kicker:'SECRET 01 • LOCAL MOBILITY', title:'ON THE GO DAY', subtitle:'A protected operations space for local drivers, pickup missions, delivery runs, dispatch, routes and neighborhood earnings.', cards:[['DISPATCH','Mission control','Assign, track and complete local jobs.'],['DRIVERS','Trusted network','Driver identity, status, availability and performance.'],['EARNINGS','Money flow','Track job value, tips, fees and payout readiness.']] },
  'secret-businesses': { kicker:'SECRET 02 • LOCAL COMMERCE', title:'BUSINESSES', subtitle:'A premium command space for local merchants, service providers, storefronts, listings and trusted business operations.', cards:[['DISCOVERY','Business universe','Find verified local businesses and services.'],['MERCHANTS','Operator tools','Profiles, hours, offers, inventory and customer activity.'],['TRUST','Business safety','Verification, reports, reviews and platform controls.']] },
  'secret-movies': { kicker:'SECRET 03 • CINEMA NETWORK', title:'MOVIES', subtitle:'A protected cinematic layer for licensed releases, creator premieres, private screenings, watch rooms and synchronized playback.', cards:[['PREMIERES','Release command','Schedule and launch protected movie events.'],['WATCH ROOMS','Shared cinema','Private and public synchronized viewing spaces.'],['RIGHTS','Playback control','Access tiers, availability, ownership and moderation.']] },
  'secret-private-world': { kicker:'SECRET 04 • FOUNDER DIMENSION', title:'PRIVATE WORLD', subtitle:'A founder-controlled dimension for invitation-only rooms, elite access, private inventory and unreleased Rich Bizness experiences.', cards:[['GATES','Invitation access','Control entry, roles, keys and membership.'],['ROOMS','Private dimensions','Build protected lounges, studios and worlds.'],['VAULT','Hidden inventory','Manage unreleased assets, rewards and private drops.']] }
};

export async function mount(): Promise<void> {
  const root=document.querySelector<HTMLElement>('#app');
  if(!root) throw new Error('Missing #app');
  const key=(document.body.dataset.page || '') as SecretKey;
  const config=CONFIG[key];
  if(!config) throw new Error('Unknown secret door');
  const user=getAuthSnapshot().user;
  if(!user){location.replace(`${ROUTES.tapIn}?next=${encodeURIComponent(location.pathname)}`);return;}
  const { error }=await supabase.rpc('rb_admin_snapshot',{p_limit:1});
  if(error){root.innerHTML=`<main class="secret-shell"><div class="secret-wrap"><header class="secret-head"><a href="${ROUTES.portal}">←</a><div><p>RICH BIZNESS SECURITY</p><h1>Restricted</h1></div></header><section class="secret-hero"><small>ADMIN ACCESS REQUIRED</small><h2>FOUNDER GATE</h2><p>${String(error.message).replace(/[&<>"']/g,'')}</p></section></div></main>`;return;}
  root.innerHTML=`<main class="secret-shell"><div class="secret-wrap"><header class="secret-head"><a href="${ROUTES.admin}" aria-label="Back to Admin">←</a><div><p>RICH BIZNESS SECRET DOOR</p><h1>${config.title}</h1></div><span class="secret-live">SECURE</span></header><section class="secret-hero"><small>${config.kicker}</small><h2>${config.title}</h2><p>${config.subtitle}</p></section><section class="secret-grid">${config.cards.map(([tag,title,copy])=>`<article class="secret-card"><b>${tag}</b><h3>${title}</h3><p>${copy}</p></article>`).join('')}</section></div></main>`;
}

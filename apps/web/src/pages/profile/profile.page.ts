import { supabase } from '../../core/supabase/client';
import './profile-universe.css';
import './profile-upgrade.css';

type JsonRow=Record<string,any>;
type Snapshot={restricted?:boolean;viewer?:JsonRow;profile?:JsonRow;theme?:JsonRow;settings?:JsonRow;level?:JsonRow;avatar?:JsonRow;loadout?:JsonRow;creator?:JsonRow;seller?:JsonRow;gamer?:JsonRow;sports?:JsonRow;counts?:JsonRow;badges?:JsonRow[];feed?:JsonRow[];music?:JsonRow[];products?:JsonRow[];gaming?:JsonRow[];sports_content?:JsonRow[];worlds?:JsonRow[];activity?:JsonRow[]};
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const money=(c:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(c??0)/100);
const compact=(n:any)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(Number(n??0));
const media=(x:JsonRow)=>x.thumbnail_url??x.cover_url??x.image_url??x.media_url??x.file_url??x.clip_url??x.background_url??'';
const relative=(value:any)=>{if(!value)return'';const d=(Date.now()-new Date(value).getTime())/1000;if(d<60)return'NOW';if(d<3600)return`${Math.floor(d/60)}M`;if(d<86400)return`${Math.floor(d/3600)}H`;return`${Math.floor(d/86400)}D`;};
const safeExternal=(value:any)=>{try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return'';}};

function socialLinks(p:JsonRow):string{
 const links=[['WEB',p.website_url],['IG',p.instagram_url],['YT',p.youtube_url],['TT',p.tiktok_url],['FB',p.facebook_url],['SC',p.snapchat_url]].map(([label,url])=>[label,safeExternal(url)]).filter(([,url])=>url);
 return links.length?`<div class="profile-socials">${links.map(([label,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('')}</div>`:'';
}

function contentCard(item:JsonRow,type:string):string{
 const image=media(item);const title=item.title??item.body??item.caption??item.description??item.world_type??type;
 const meta=[item.genre,item.sport,item.team_name,item.product_type,item.world_type].filter(Boolean).join(' · ');
 const href=type==='MUSIC'?`/music.html?track=${item.id}`:type==='STORE'?`/store.html?product=${item.id}`:type==='GAMING'?`/gaming.html?clip=${item.id}`:type==='SPORTS'?`/sports.html?post=${item.id}`:type==='META'?`/meta.html?world=${item.id}`:`/feed.html?post=${item.id}`;
 return `<a class="pu-card" href="${href}">${image?`<img src="${esc(image)}" alt="">`:`<div class="pu-card__empty">RB</div>`}<div class="pu-card__shade"></div><div class="pu-card__copy"><small>${type}${item.created_at?` · ${relative(item.created_at)}`:''}</small><strong>${esc(title)}</strong>${meta?`<span>${esc(meta)}</span>`:''}<em>${compact(item.view_count??item.views??item.play_count??item.visit_count??0)} views · ${compact(item.like_count??item.likes??0)} likes</em></div></a>`;
}

function stat(label:string,value:any,sub=''):string{return `<article><small>${label}</small><strong>${esc(value)}</strong>${sub?`<span>${esc(sub)}</span>`:''}</article>`;}

export async function mountProfilePage():Promise<void>{
 const root=document.querySelector<HTMLElement>('#app');if(!root)throw new Error('Missing #app mount');
 const {data:{session}}=await supabase.auth.getSession();const params=new URLSearchParams(location.search);const requested=params.get('id')||params.get('user')||params.get('u');
 if(!session&&!requested){location.replace(`/tap-in.html?next=${encodeURIComponent('/profile.html')}`);return;}
 const profileId=requested||session!.user.id;
 const {data,error}=await supabase.rpc('rb_profile_universe_snapshot',{p_profile_id:profileId});
 if(error){root.innerHTML=`<main class="pu-fail"><a href="/portal.html">← PORTAL</a><h1>PROFILE ENGINE OFFLINE</h1><p>${esc(error.message)}</p></main>`;return;}
 const snap=(data??{}) as unknown as Snapshot,p=snap.profile??{},viewer=snap.viewer??{},isOwner=Boolean(viewer.is_owner),counts=snap.counts??{},level=snap.level??{},avatar=snap.avatar??{};
 const display=p.display_name??p.username??avatar.display_name??'Rich Member';const avatarUrl=p.avatar_url??avatar.avatar_url??'/brand/icons/profile-placeholder.svg';const banner=p.banner_url??'/images/brand/Avatar-hero-Banner.png.jpeg';
 if(snap.restricted){root.innerHTML=`<main class="pu-restricted"><a href="/portal.html">←</a><img src="${esc(avatarUrl)}"><h1>${esc(display)}</h1><p>@${esc(p.username??'member')}</p><strong>PRIVATE RICH ID</strong><span>This profile is only available to approved followers.</span></main>`;return;}
 void supabase.rpc('rb_profile_record_view',{p_profile_id:profileId,p_session_id:crypto.randomUUID(),p_source:'profile-page'});
 const xpCurrent=Number(level.xp_current??avatar.xp??0),xpNext=Math.max(Number(level.xp_next??100),1),xpPct=Math.min(100,Math.round(xpCurrent/xpNext*100));
 const tabs=[['feed','DROPS',snap.feed??[]],['music','MUSIC',snap.music??[]],['store','STORE',snap.products??[]],['gaming','GAMING',snap.gaming??[]],['sports','SPORTS',snap.sports_content??[]],['meta','META',snap.worlds??[]]] as const;
 const roles=[p.is_verified&&'VERIFIED',p.is_creator&&'CREATOR',p.is_artist&&'ARTIST',p.is_seller&&'SELLER',snap.gamer&&'GAMER',snap.sports&&'SPORTS'].filter(Boolean);
 root.innerHTML=`<main class="profile-universe" style="--profile-bg:url('${esc(snap.theme?.background_url??banner)}')">
 <div class="pu-atmosphere"><i></i><i></i><i></i></div>
 <header class="pu-top"><a href="/portal.html">←</a><div><small>RICH BIZNESS UNIVERSAL IDENTITY</small><strong>${isOwner?'MY COMMAND CENTER':'PUBLIC PROFILE'}</strong></div><a href="${isOwner?'/settings.html':`/messages.html?to=${profileId}`}">${isOwner?'⚙':'✦'}</a></header>
 <section class="pu-hero">
  <div class="pu-banner" style="background-image:linear-gradient(180deg,rgba(1,4,2,.04),rgba(1,4,2,.93)),url('${esc(banner)}')"></div>
  <div class="pu-hero-grid">
   <div class="pu-avatar"><img src="${esc(avatarUrl)}" alt="${esc(display)}"><span class="${p.online_status==='online'?'online':''}"></span><b>${avatar.is_realistic_3d?'3D':'RB'}</b></div>
   <div class="pu-identity"><div class="pu-kickers"><span>${p.is_verified?'◆ VERIFIED RICH ID':'RICH BIZNESS MEMBER'}</span>${roles.map(x=>`<span>${x}</span>`).join('')}</div><h1>${esc(display)}</h1><p>@${esc(p.username??'member')}</p><blockquote>${esc(p.bio??'Building a Rich Bizness universe.')}</blockquote>${socialLinks(p)}</div>
   <aside class="pu-level"><small>RICH LEVEL</small><strong>${esc(level.level??p.rich_level??avatar.level??1)}</strong><span>${esc(level.rank_title??p.rank_title??avatar.rank??'Smoke Rookie')}</span><div><i style="width:${xpPct}%"></i></div><em>${compact(xpCurrent)} / ${compact(xpNext)} XP</em></aside>
  </div>
 </section>
 <section class="pu-metrics">${stat('FOLLOWERS',compact(counts.followers))}${stat('FOLLOWING',compact(counts.following))}${stat('TOTAL DROPS',compact(counts.posts))}${stat('PROFILE VIEWS',compact(counts.views))}${stat('RICH POINTS',compact(level.rich_points??p.rich_points))}${stat('TRUST',`${level.trust_score??p.trust_score??100}%`)}</section>
 <nav class="pu-actions">${isOwner?`<a class="primary" href="/edit-profile.html">EDIT IDENTITY</a><a href="/avatar.html">3D AVATAR</a><a href="/upload.html">DROP CONTENT</a><a href="/creator.html">CREATOR HQ</a><a href="/settings.html">PRIVACY</a>`:`<button id="followButton" class="primary">${viewer.following?'FOLLOWING':'FOLLOW'}</button><a href="/messages.html?to=${profileId}">MESSAGE</a><a href="/creator.html?id=${profileId}">CREATOR PAGE</a><a href="/store.html?seller=${profileId}">STORE</a><button id="shareButton">SHARE</button>`}</nav>
 <section class="pu-command">
  <article class="pu-command__avatar"><div><small>UNIVERSAL CHARACTER</small><h2>${esc((avatar.character_type??'CUSTOM').toUpperCase())}</h2><p>${esc(avatar.aura??'Emerald Gold')} aura · ${avatar.is_controllable?'Realtime controllable':'Identity ready'} · ${esc(snap.loadout?.version??1)} loadout</p></div><a href="/avatar.html">ENTER AVATAR UNIVERSE</a></article>
  ${stat('BALANCE',money(p.balance_cents),'Wallet + creator funds')}${stat('CREATOR',snap.creator?'ACTIVE':'LOCKED',snap.creator?.creator_title??'Build creator presence')}${stat('SELLER',snap.seller?'ACTIVE':'LOCKED',snap.seller?.seller_rank??'Open Rich Store')}${stat('GAMER',snap.gamer?.rank_title??'ROOKIE',`${compact(snap.gamer?.wins??0)} wins`)}${stat('SPORTS',snap.sports?.rank_title??'FAN',`${compact(snap.sports?.points??0)} points`)}
 </section>
 <section class="pu-badges"><header><div><small>ACHIEVEMENT VAULT</small><h2>BADGES + STATUS</h2></div><span>${compact(counts.badges)} UNLOCKED</span></header><div>${(snap.badges??[]).length?(snap.badges??[]).map(b=>`<article class="${b.equipped?'equipped':''}"><i>${esc(b.icon??'◆')}</i><div><strong>${esc(b.title)}</strong><small>${esc(b.rarity)} · ${esc(b.badge_type)}</small></div></article>`).join(''):'<p>No badges unlocked yet.</p>'}</div></section>
 <section class="pu-library"><header><div><small>COMPLETE PROFILE UNIVERSE</small><h2>${esc(display.toUpperCase())}</h2></div><div class="pu-tabs">${tabs.map(([key,label,items])=>`<button data-tab="${key}">${label}<span>${items.length}</span></button>`).join('')}</div></header>${tabs.map(([key,label,items])=>`<div class="pu-panel" data-panel="${key}">${items.length?items.map(x=>contentCard(x,label)).join(''):`<div class="pu-empty">NO ${label} YET — THIS SECTION IS READY.</div>`}</div>`).join('')}</section>
 <section class="pu-activity"><header><small>RECENT POWER MOVES</small><h2>XP + UNIVERSE ACTIVITY</h2></header><div>${(snap.activity??[]).length?(snap.activity??[]).map(a=>`<article><span>+${esc(a.xp_amount??0)} XP</span><div><strong>${esc(String(a.event_key??'activity').replaceAll('_',' ').toUpperCase())}</strong><small>${esc(a.section??'global')} · ${relative(a.created_at)}</small></div><em>+${esc(a.rich_points_amount??0)} RP</em></article>`).join(''):'<p>No activity recorded yet.</p>'}</div></section>
 </main>`;
 const activateTab=(key:string)=>{const valid=tabs.some(([tab])=>tab===key)?key:'feed';document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',(x as HTMLElement).dataset.tab===valid));document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',(x as HTMLElement).dataset.panel===valid));params.set('tab',valid);history.replaceState(null,'',`${location.pathname}?${params.toString()}`);};
 document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.onclick=()=>activateTab(button.dataset.tab??'feed'));
 activateTab(params.get('tab')??'feed');
 const follow=document.querySelector<HTMLButtonElement>('#followButton');follow?.addEventListener('click',async()=>{follow.disabled=true;const original=follow.textContent;follow.textContent='SYNCING';const {data:result,error:followError}=await supabase.rpc('rb_profile_toggle_follow',{p_profile_id:profileId});if(followError){follow.textContent=original;follow.title=followError.message;}else{const r=result as any;follow.textContent=r.following?'FOLLOWING':'FOLLOW';const first=document.querySelector<HTMLElement>('.pu-metrics article strong');if(first)first.textContent=compact(r.followers);if(r.following)void supabase.rpc('rb_award_xp',{p_event_key:'profile_followed',p_section:'profile',p_source_table:'followers'});}follow.disabled=false;});
 document.querySelector<HTMLButtonElement>('#shareButton')?.addEventListener('click',async()=>{const url=`${location.origin}/profile.html?id=${profileId}`;try{if(navigator.share)await navigator.share({title:`${display} · Rich Bizness`,url});else await navigator.clipboard.writeText(url);}catch{/* user cancelled */}});
 const channel=supabase.channel(`profile-universe:${profileId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:`id=eq.${profileId}`},()=>location.reload()).subscribe();
 window.addEventListener('beforeunload',()=>{void supabase.removeChannel(channel);},{once:true});
}
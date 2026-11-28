import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './profile-universe.css';

type JsonRow = Record<string, any>;
type Snapshot = {
  restricted?: boolean;
  viewer?: JsonRow;
  profile?: JsonRow;
  theme?: JsonRow;
  settings?: JsonRow;
  level?: JsonRow;
  avatar?: JsonRow;
  loadout?: JsonRow;
  creator?: JsonRow;
  seller?: JsonRow;
  gamer?: JsonRow;
  sports?: JsonRow;
  counts?: JsonRow;
  badges?: JsonRow[];
  feed?: JsonRow[];
  music?: JsonRow[];
  products?: JsonRow[];
  gaming?: JsonRow[];
  sports_content?: JsonRow[];
  worlds?: JsonRow[];
  activity?: JsonRow[];
};

const esc = (value: any) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
const money = (cents: any) => cents==null||!Number.isSafeInteger(Number(cents))?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents)/100);
const compact = (value: any) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value ?? 0));
const safeMedia=(value:unknown)=>{if(typeof value!=='string'||!value.trim())return '';try{const url=new URL(value,location.origin);if(url.username||url.password||!(url.protocol==='https:'||url.origin===location.origin))return '';return url.href;}catch{return '';}};
const media=(item:JsonRow)=>[item.thumbnail_url,item.cover_url,item.image_url,item.background_url,(!/video|audio/i.test(String(item.media_type??''))?item.media_url:undefined)].map(safeMedia).find(Boolean)??'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const relative = (value: any) => {
  if (!value) return '';
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if(!Number.isFinite(seconds))return '';
  if (seconds < 60) return 'NOW';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
};
const safeExternal = (value: any) => {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

function socialLinks(profile: JsonRow): string {
  const links = [
    ['WEB', profile.website_url],
    ['IG', profile.instagram_url],
    ['YT', profile.youtube_url],
    ['TT', profile.tiktok_url],
    ['FB', profile.facebook_url],
    ['SC', profile.snapchat_url],
  ].map(([label, url]) => [label, safeExternal(url)]).filter(([, url]) => url);

  return links.length
    ? `<div class="profile-socials">${links.map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(label)} profile">${esc(label)}</a>`).join('')}</div>`
    : '';
}

function contentCard(item: JsonRow, type: string): string {
  const image = media(item);
  const title = item.title ?? item.body ?? item.caption ?? item.description ?? item.world_type ?? type;
  const meta = [item.genre, item.sport, item.team_name, item.product_type, item.world_type].filter(Boolean).join(' · ');
  const id=encodeURIComponent(String(item.id??''));
  const href = type === 'MUSIC'
    ? `/music.html?track=${id}`
    : type === 'STORE'
      ? `/store.html?product=${id}`
      : type === 'GAMING'
        ? `/gaming.html?game=${encodeURIComponent(item.slug ?? item.game_slug ?? item.id)}`
        : type === 'SPORTS'
          ? `/sports.html?post=${id}`
          : type === 'META'
            ? `/meta.html?world=${encodeURIComponent(item.slug ?? item.world_slug ?? item.id)}`
            : `/feed.html?post=${id}`;

  return `<a class="pu-card" href="${esc(href)}">
    ${image ? `<img src="${esc(image)}" alt="${esc(title)}" loading="lazy" decoding="async">` : '<div class="pu-card__empty" aria-hidden="true">RB</div>'}
    <div class="pu-card__shade"></div>
    <div class="pu-card__copy">
      <small>${type}${item.created_at ? ` · ${relative(item.created_at)}` : ''}</small>
      <strong>${esc(title)}</strong>
      ${meta ? `<span>${esc(meta)}</span>` : ''}
      <em>${compact(item.view_count ?? item.views ?? item.play_count ?? item.visit_count ?? 0)} views · ${compact(item.like_count ?? item.likes ?? 0)} likes</em>
    </div>
  </a>`;
}

function stat(label: string, value: any, sub = ''): string {
  return `<article><small>${label}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</article>`;
}

function ownerControl(href: string, icon: string, label: string, detail: string, className = ''): string {
  return `<a class="pu-owner-control ${className}" href="${href}"><i aria-hidden="true">${icon}</i><span><strong>${label}</strong><small>${detail}</small></span><b aria-hidden="true">→</b></a>`;
}

function getViewSessionId(profileId: string): string {
  const key = `rb:profile-view:${profileId}`;
  try{const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;}catch{return crypto.randomUUID();}
}

export async function mountProfilePage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const mountEpoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  const isCurrent = () => !disposed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === 'rich-bizness-profile-v2';
  const session = getAuthSnapshot().session;
  const params = new URLSearchParams(location.search);
  const requested = params.get('id') || params.get('user') || params.get('u');

  if (!session && !requested) {
    location.replace(`/tap-in.html?next=${encodeURIComponent('/profile.html')}`);
    return;
  }

  const profileId = requested || session!.user.id;
  if(!uuid.test(profileId)){root.innerHTML='<main class="pu-fail"><a href="/portal.html">← Portal</a><h1>Profile unavailable</h1><p>This Rich ID link is invalid.</p></main>';return;}
  const life=new AbortController();const cleanup=()=>{disposed=true;life.abort();};
  (window as Window & {__rbPageCleanup?:()=>void}).__rbPageCleanup=cleanup;
  window.addEventListener('pagehide',cleanup,{once:true});
  root.innerHTML='<main class="pu-fail" role="status"><span class="pu-loading-mark">RB</span><h1>Connecting Rich ID</h1><p>Loading your universe…</p></main>';
  const timer=window.setTimeout(()=>life.abort(),12000);
  const [{ data, error }, { data: adminData, error: adminError }] = await Promise.all([
    supabase.rpc('rb_profile_universe_snapshot', { p_profile_id: profileId }).abortSignal(life.signal),
    session?.user.id===profileId ? supabase.rpc('rb_is_admin', { p_min_permission: 0 }).abortSignal(life.signal) : Promise.resolve({ data: false, error: null } as any),
  ]);
  clearTimeout(timer);
  if (!isCurrent()) return;

  if (error) {
    root.innerHTML = `<main class="pu-fail"><a href="/portal.html">← PORTAL</a><h1>Profile unavailable</h1><p>Could not load this Rich ID. Your saved data has not changed.</p><button id="puRetry" type="button">Retry</button></main>`;
    root.querySelector('#puRetry')?.addEventListener('click',()=>location.reload(),{signal:life.signal});return;
  }
  if (adminError) console.warn('Profile admin check failed', adminError.message);

  const snap = (data ?? {}) as unknown as Snapshot;
  const profile = snap.profile ?? {};
  const viewer = snap.viewer ?? {};
  const counts = snap.counts ?? {};
  const level = snap.level ?? {};
  const avatar = snap.avatar ?? {};
  const isOwner = viewer.is_owner===true && session?.user.id===profileId;
  const characterOutfit=snap.loadout?.outfit_config??avatar.metadata?.outfit??{};
  const hasOriginal=isOwner&&snap.loadout?.outfit_config?.rig==='rb-original-human-v1';
  const isAdmin = isOwner&&adminData===true;
  const display = profile.display_name ?? profile.username ?? avatar.display_name ?? 'Rich Member';
  const avatarUrl = safeMedia(profile.avatar_url)||safeMedia(avatar.avatar_url)||'/brand/icons/profile-placeholder.svg';
  const banner = safeMedia(profile.banner_url);
  const canMessage=!!session&&(isOwner||snap.settings?.dm_privacy==='everyone'||snap.settings?.dm_privacy==='public'||(snap.settings?.dm_privacy==='followers'&&viewer.following===true));

  if (snap.restricted) {
    root.innerHTML = `<main class="pu-restricted"><a href="/portal.html" aria-label="Return to Portal">←</a><img src="${esc(avatarUrl)}" alt="${esc(display)}"><h1>${esc(display)}</h1><p>@${esc(profile.username ?? 'member')}</p><strong>PRIVATE RICH ID</strong><span>This profile is available to approved followers.</span></main>`;
    return;
  }

  if (!isOwner&&session) {
    void supabase.rpc('rb_profile_record_view', {
      p_profile_id: profileId,
      p_session_id: getViewSessionId(profileId),
      p_source: 'profile-page',
    });
  }

  const xpCurrent = Number(level.xp_current ?? avatar.xp ?? 0);
  const xpNext = Math.max(Number(level.xp_next ?? 1000), 1);
  const xpPct = Number.isFinite(xpCurrent/xpNext)?Math.max(0,Math.min(100,Math.round((xpCurrent / xpNext) * 100))):0;
  const tabs = [
    ['feed', 'DROPS', snap.feed ?? []],
    ['music', 'MUSIC', snap.music ?? []],
    ['store', 'STORE', snap.products ?? []],
    ['gaming', 'GAMING', snap.gaming ?? []],
    ['sports', 'SPORTS', snap.sports_content ?? []],
    ['meta', 'META', snap.worlds ?? []],
  ] as const;
  const roles = [
    profile.is_verified && 'VERIFIED',
    profile.is_creator && 'CREATOR',
    profile.is_artist && 'ARTIST',
    profile.is_seller && 'SELLER',
    snap.gamer && 'GAMER',
    snap.sports && 'SPORTS',
    isAdmin && 'ADMIN',
  ].filter(Boolean);

  const ownerActions = [
    ownerControl('/edit-profile.html', '✎', 'EDIT PROFILE', 'Identity, bio, avatar and banner', 'is-primary'),
    ownerControl('/settings.html', '⚙', 'SETTINGS', 'Privacy, motion, theme and notifications'),
    ownerControl('/avatar-characters.html', '◆', 'CHARACTER STUDIO', 'Customize your persistent Rich ID'),
    ownerControl('/avatar.html', '◉', 'STREET DISTRICT', 'Enter the controllable avatar environment'),
    ownerControl('/creator.html', '✦', 'CREATOR', 'Open your creator dimensions'),
    ownerControl('/creator.html?lane=money','◈','CREATOR WALLET','Recorded earnings and receipts'),
    ownerControl('/messages.html','✉','MESSAGES','Your private conversations'),
    ownerControl('/notifications.html','◌','ALERTS','Your universe activity'),
    ownerControl('/upload.html', '↑', 'UPLOAD', 'Publish into the universe'),
    isAdmin ? ownerControl('/admin.html', '⌘', 'ADMIN', 'Platform control', 'is-admin') : '',
  ].filter(Boolean).join('');

  root.innerHTML = `<main class="profile-universe ${isOwner ? 'is-owner' : 'is-public'}" data-motion="${snap.settings?.motion_level==='full'?'full':'reduced'}">
    <div class="pu-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="pu-top">
      <a href="/portal.html" aria-label="Return to Portal">←</a>
      <div><small>RICH BIZNESS</small><strong>${isOwner ? 'MY PROFILE' : 'PROFILE'}</strong></div>
      <button type="button" id="shareButton" aria-label="Share profile">↗</button>
    </header>

    <section class="pu-hero">
      <div class="pu-banner">${banner?`<img src="${esc(banner)}" alt="" decoding="async" fetchpriority="high">`:'<picture><source media="(min-width:1601px)" srcset="/images/brand/rb-universe-4k.webp"><source media="(min-width:601px)" srcset="/images/brand/rb-universe-hd.webp"><img src="/images/brand/rb-universe-mobile.webp" alt="" decoding="async" fetchpriority="high"></picture>'}</div>
      <div class="pu-hero-grid">
        <div class="pu-avatar"><img src="${esc(avatarUrl)}" alt="${esc(display)}"><span class="${profile.online_status === 'online' ? 'online' : ''}"></span><b>${avatar.is_realistic_3d ? '3D' : 'RB'}</b></div>
        <div class="pu-identity">
          <div class="pu-kickers"><span>${profile.is_verified ? '◆ VERIFIED' : 'RICH MEMBER'}</span>${roles.slice(0,3).map(role => `<span>${esc(role)}</span>`).join('')}</div>
          <h1>${esc(display)}</h1><p>@${esc(profile.username ?? 'member')}</p>
          <blockquote>${esc(profile.bio ?? '')}</blockquote>${socialLinks(profile)}
        </div>
        <aside class="pu-level"><small>LEVEL</small><strong>${esc(level.level ?? profile.rich_level ?? avatar.level ?? 1)}</strong><span>${esc(level.rank_title ?? profile.rank_title ?? avatar.rank ?? 'Rookie Rich')}</span><div><i style="width:${xpPct}%"></i></div><em>${compact(xpCurrent)} / ${compact(xpNext)} XP</em></aside>
      </div>
    </section>

    ${isOwner ? `<section class="pu-owner-deck"><header><small>YOUR RICH ID</small><h2>Command center</h2><p>Identity, creation, commerce and connections.</p></header><div>${ownerActions}</div></section>` : ''}

    <section class="pu-metrics"><article><small>FOLLOWERS</small><strong id="puFollowerCount">${esc(compact(counts.followers))}</strong></article>${stat('FOLLOWING', compact(counts.following))}${stat('DROPS', compact(counts.posts))}${stat('VIEWS', compact(counts.views))}</section>

    ${!isOwner ? `<nav class="pu-actions" aria-label="Profile actions">${session?`<button type="button" id="followButton" class="primary" aria-pressed="${viewer.following===true}">${viewer.following ? 'FOLLOWING' : 'FOLLOW'}</button>`:`<a class="primary" href="/tap-in.html?next=${encodeURIComponent('/profile.html?id='+profileId)}">TAP IN TO FOLLOW</a>`}${canMessage?`<a href="/messages.html?to=${profileId}">MESSAGE</a>`:''}<a href="/creator.html?id=${profileId}">CREATOR</a><a href="/store.html?seller=${profileId}">STORE</a><span id="puFollowStatus" role="status"></span></nav>` : ''}

    <section class="pu-command">
      <article class="pu-command__avatar"><div><small>CHARACTER</small>${hasOriginal?'<img id="rbOriginalPortrait" hidden alt="Your saved Rich Bizness character" class="pu-original-portrait"><button type="button" id="puLoadPortrait">RENDER SAVED CHARACTER</button>':''}<h2>${esc((characterOutfit.character_type ?? avatar.character_type ?? 'CUSTOM').toUpperCase())}</h2><p>${esc(avatar.aura ?? 'Emerald Gold')} · ${hasOriginal?'Saved textured character':avatar.is_controllable ? 'Realtime controllable' : 'Ready'}${hasOriginal?' · '+esc(characterOutfit.style??'street'):''}</p></div>${isOwner?'<div class="pu-character-links"><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/avatar.html">3D LOBBY</a></div>':''}</article>
      ${isOwner?stat('BALANCE', money(profile.balance_cents)):''}${stat('CREATOR', snap.creator ? 'ACTIVE' : '—')}${stat('GAMER', snap.gamer?.rank_title ?? '—')}
    </section>

    ${(snap.badges ?? []).length ? `<section class="pu-badges"><header><div><small>BADGES</small><h2>ACHIEVEMENTS</h2></div><span>${compact(counts.badges)} UNLOCKED</span></header><div>${(snap.badges ?? []).map(badge => `<article class="${badge.equipped ? 'equipped' : ''}"><i>${esc(badge.icon ?? '◆')}</i><div><strong>${esc(badge.title)}</strong><small>${esc(badge.rarity)}</small></div></article>`).join('')}</div></section>` : ''}

    <section class="pu-library"><header><div><small>CONTENT</small><h2>PROFILE DROPS</h2></div><div class="pu-tabs" role="tablist" aria-label="Content categories">${tabs.map(([key, label, items]) => `<button type="button" role="tab" id="pu-tab-${key}" aria-controls="pu-panel-${key}" data-tab="${key}">${label}<span>${compact(items.length)}</span></button>`).join('')}</div></header><label class="pu-search">Find content in this category<input id="puContentSearch" type="search" placeholder="Search titles, genres and captions"></label><div id="puContentStatus" role="status"></div>${tabs.map(([key]) => `<div class="pu-panel" id="pu-panel-${key}" data-panel="${key}" role="tabpanel" aria-labelledby="pu-tab-${key}" hidden></div>`).join('')}</section>
    ${isOwner&&(snap.activity??[]).length?`<section class="pu-activity"><header><div><small>YOUR PROGRESS</small><h2>Recent activity</h2></div></header><div>${(snap.activity??[]).map(item=>`<article><span>${esc(item.section??'UNIVERSE')}</span><div><strong>${esc(String(item.event_key??'Activity').replaceAll('_',' '))}</strong><small>${esc(relative(item.created_at))}</small></div><em>${esc(compact(item.xp_amount))} XP</em></article>`).join('')}</div></section>`:''}<div id="puShareStatus" role="status" class="pu-share-status"></div>
  </main>`;

  // Render one still from the same saved runtime; no continuous WebGL context on Profile.
  const main=root.querySelector<HTMLElement>('.profile-universe');const theme=safeMedia(snap.theme?.background_url);if(main&&theme)main.style.setProperty('--profile-bg','url('+JSON.stringify(theme)+')');
  root.querySelectorAll<HTMLImageElement>('.pu-avatar img,.pu-banner img').forEach(img=>img.addEventListener('error',()=>{if(img.closest('.pu-avatar')){if(!img.src.endsWith('/brand/icons/profile-placeholder.svg'))img.src='/brand/icons/profile-placeholder.svg';}else img.hidden=true;},{signal:life.signal}));
  const portraitButton=root.querySelector<HTMLButtonElement>('#puLoadPortrait');
  portraitButton?.addEventListener('click',()=>{if(!hasOriginal||portraitButton.disabled)return;portraitButton.disabled=true;portraitButton.textContent='RENDERING…';void (async()=>{
    const [{createTexturedAvatar},{disposeSkinnedAvatar,setAvatarMotion},THREE]=await Promise.all([import('../../features/avatar/avatar.textured.runtime'),import('../../features/avatar/avatar.skinned.runtime'),import('three')]);
    if(!isCurrent())return;
    const portrait=root.querySelector<HTMLImageElement>('#rbOriginalPortrait');if(!portrait)return;
    let renderer:InstanceType<typeof THREE.WebGLRenderer>|undefined;
    let runtime:Awaited<ReturnType<typeof createTexturedAvatar>>|undefined;
    try{
      runtime=await createTexturedAvatar((characterOutfit.character_type??avatar.character_type)==='female'?'girl':'boy',characterOutfit.appearance,characterOutfit.build);
      if(!isCurrent())return;
      setAvatarMotion(runtime,'idle',0);
      const scene=new THREE.Scene();scene.background=new THREE.Color(0x10251a);scene.add(runtime.root);
      scene.add(new THREE.HemisphereLight(0xffffff,0x384b3b,2.3));const key=new THREE.DirectionalLight(0xffe4b5,2.6);key.position.set(3,4,5);scene.add(key);
      const camera=new THREE.PerspectiveCamera(32,240/288,.1,15);camera.position.set(0,runtime.height*.75,3.6);camera.lookAt(0,runtime.height*.53,0);
      renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});renderer.setSize(240,288);renderer.render(scene,camera);
      if(isCurrent()){portrait.src=renderer.domElement.toDataURL('image/png');portrait.hidden=false;}
    }finally{if(runtime)disposeSkinnedAvatar(runtime);renderer?.dispose();renderer?.forceContextLoss();}
  })().then(()=>{if(isCurrent())portraitButton.textContent='RENDER AGAIN';}).catch(()=>{if(isCurrent())portraitButton.textContent='RETRY CHARACTER';}).finally(()=>{if(isCurrent())portraitButton.disabled=false;});},{signal:life.signal});
  const buttons=[...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const search=root.querySelector<HTMLInputElement>('#puContentSearch');
  let activeTab='feed';
  const setTab=(tab:string)=>{
    const selected=tabs.find(t=>t[0]===tab)??tabs[0];activeTab=selected[0];
    buttons.forEach(button=>{const active=button.dataset.tab===activeTab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    const query=search?.value.trim().toLowerCase()??'';
    const items=selected[2].filter(item=>[item.title,item.body,item.caption,item.description,item.genre,item.sport,item.world_type].some(value=>String(value??'').toLowerCase().includes(query))||!query);
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel=>{const active=panel.dataset.panel===activeTab;panel.hidden=!active;panel.classList.toggle('active',active);panel.innerHTML=active?(items.length?items.map(item=>contentCard(item,selected[1])).join(''):'<p class="pu-empty">No matching content</p>'):'';});
    const status=root.querySelector('#puContentStatus');if(status)status.textContent=items.length+' recent items shown';
  };
  buttons.forEach((button,index)=>{button.addEventListener('click',()=>setTab(button.dataset.tab??'feed'),{signal:life.signal});button.addEventListener('keydown',event=>{const n=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;if(n>=0){event.preventDefault();const target=buttons[n];if(target){setTab(target.dataset.tab??'feed');target.focus();}}},{signal:life.signal});});
  search?.addEventListener('input',()=>setTab(activeTab),{signal:life.signal});setTab(params.get('tab')??'feed');

  const follow = root.querySelector<HTMLButtonElement>('#followButton');
  follow?.addEventListener('click', async () => {
    if(follow.disabled||!session)return;follow.disabled=true;
    const status=root.querySelector('#puFollowStatus');if(status)status.textContent='Updating…';
    try{const { data: followData, error: followError } = await supabase.rpc('rb_profile_follow_action', { p_target_id: profileId }).abortSignal(life.signal);
    if (!isCurrent()) return;
    if (followError) {
      if(status)status.textContent='Could not update follow. Try again.';
      return;
    }
    const result=followData as any;follow.textContent=result?.following?'FOLLOWING':'FOLLOW';follow.setAttribute('aria-pressed',String(result?.following===true));const count=root.querySelector('#puFollowerCount');if(count&&Number.isFinite(Number(result?.followers)))count.textContent=compact(result.followers);if(status)status.textContent='';if(snap.settings?.profile_visibility==='followers'||snap.settings?.dm_privacy==='followers')location.reload();
    }catch{if(status&&isCurrent())status.textContent='Could not update follow.';}finally{if(isCurrent())follow.disabled=false;}
  },{signal:life.signal});

  root.querySelector<HTMLButtonElement>('#shareButton')?.addEventListener('click', async () => {
    const url = `${location.origin}/profile.html?id=${profileId}`;
    try {
      if (navigator.share) await navigator.share({ title: display, url });
      else {await navigator.clipboard.writeText(url);const status=root.querySelector('#puShareStatus');if(status)status.textContent='Profile link copied.';}
    } catch {const status=root.querySelector('#puShareStatus');if(status)status.textContent='Share unavailable or cancelled.';}
  },{signal:life.signal});
}

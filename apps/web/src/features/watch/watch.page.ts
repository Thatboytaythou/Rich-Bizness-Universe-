import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import './watch.css';

type Row=Record<string,any>;
type Channel=ReturnType<typeof supabase.channel>;
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const key=(r:Row)=>`${r.source_type}:${r.source_id}`;
const pct=(p:Row|undefined)=>p&&Number(p.duration_seconds)>0?Math.min(100,Math.round(Number(p.position_seconds)/Number(p.duration_seconds)*100)):0;
const safeUrl=(v:unknown)=>{try{const url=new URL(String(v||''),location.origin);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return'';}};

export async function mount():Promise<void>{
 const root=document.querySelector<HTMLElement>('#app');
 if(!root)throw new Error('Missing #app mount');
 if(root.dataset.mounted==='watch')return;
 root.dataset.mounted='watch';

 const auth=getAuthSnapshot();
 const user=auth.user;
 const userId=user?.id??null;
 let items:Row[]=[];
 let progress=new Map<string,Row>();
 let liked=new Set<string>();
 let saved=new Set<string>();
 let lane='featured';
 let active:Row|null=null;
 let catalogChannel:Channel|null=null;
 let interactionChannel:Channel|null=null;
 let player:HTMLVideoElement|null=null;
 let progressTimer:number|null=null;
 let commentsLoading=false;
 let commentsQueued=false;
 let catalogLoading=false;
 let catalogQueued=false;
 let disposed=false;

 const requireUser=()=>{if(userId)return true;location.href='/tap-in.html?next=%2Fwatch.html';return false;};
 const loadSnapshot=async()=>{
  if(catalogLoading){catalogQueued=true;return;}
  catalogLoading=true;
  try{
   const {data,error}=await supabase.rpc('rb_live_watch_podcast_snapshot',{});
   if(error)throw error;
   const snap=(data??{}) as Row;
   items=(snap.watch_feed??[]) as Row[];
   progress=new Map(((snap.watch_progress??[]) as Row[]).map(p=>[`${p.source_type}:${p.source_id}`,p]));
   liked=new Set(((snap.watch_likes??[]) as Row[]).map(x=>`${x.source_type}:${x.source_id}`));
   saved=new Set(((snap.watchlist??[]) as Row[]).map(x=>`${x.source_type}:${x.source_id}`));
   if(!active||!items.some(i=>key(i)===key(active!)))active=items[0]??null;
   renderMetrics();render();
   if(active)await open(active,false);
  }finally{
   catalogLoading=false;
   if(catalogQueued&&!disposed){catalogQueued=false;void loadSnapshot();}
  }
 };

 root.innerHTML=`<main class="media-ultimate watch-universe"><div class="media-ultimate__wrap">
  <header class="media-ultimate__head"><a href="/portal.html" aria-label="Back to Portal">←</a><div><p>RICH BIZNESS CINEMA NETWORK</p><h1>WE 🔥 📺</h1></div><span class="media-ultimate__status">${user?'● PERSONALIZED':'PUBLIC CINEMA'}</span></header>
  <nav class="watch-command" aria-label="Watch universe connections"><a href="/live.html">WE LIT 🔥</a><a href="/feed.html">FEED</a><a href="/gallery.html">GALLERY</a><a href="/sports.html">SPORTS</a><a href="/gaming.html">GAMING</a><a href="/music.html">MUSIC</a><a href="/podcast.html">PODCAST</a><a href="/creator.html">CREATOR</a><a href="${user?'/upload.html?route=feed':'/tap-in.html?next=%2Fupload.html'}">DROP VIDEO</a></nav>
  <section id="watchHero" class="media-ultimate__hero"><div class="media-ultimate__empty">Loading the cinema network…</div></section>
  <section class="media-ultimate__metrics"><article><small>GLOBAL LIBRARY</small><strong id="watchLibraryCount">0</strong></article><article><small>CONTINUE WATCHING</small><strong id="watchContinueCount">0</strong></article><article><small>MY LIST</small><strong id="watchSavedCount">0</strong></article><article><small>COMPLETED</small><strong id="watchCompletedCount">0</strong></article></section>
  <nav class="media-ultimate__tabs">${[['featured','FEATURED'],['continue','CONTINUE'],['live','LIVE REPLAYS'],['gaming','GAMING'],['sports','SPORTS'],['feed','CREATOR FEED'],['saved','MY LIST']].map(([v,l],i)=>`<button class="${i===0?'active':''}" data-lane="${v}">${l}</button>`).join('')}</nav>
  <section class="media-ultimate__section"><header><div><h3 id="watchLaneTitle">Featured Cinema</h3><p>Replays, creator films, game clips, sports moments and saved universes in one network.</p></div></header><div id="watchRail" class="cinema-rail"></div></section>
  <section class="media-ultimate__split"><article class="media-ultimate__panel"><header><h4>NOW WATCHING INTELLIGENCE</h4></header><div id="watchDetail" class="media-ultimate__list"></div></article><article class="media-ultimate__panel"><header><h4>RICH REACTIONS</h4></header><div id="watchComments" class="media-ultimate__chat"><div class="media-ultimate__empty">Choose a video.</div></div><form id="watchCommentForm" class="media-ultimate__form"><input id="watchCommentInput" maxlength="2000" placeholder="React to this drop..." ${user?'':'disabled'}><button class="media-ultimate__btn primary">${user?'POST':'TAP IN'}</button></form></article></section>
  <section class="media-ultimate__section"><header><div><h3>Because You Watch</h3><p>More from the sections and creators already in your history.</p></div></header><div id="recommendGrid" class="media-ultimate__grid"></div></section>
 </div></main>`;

 const rail=document.querySelector<HTMLElement>('#watchRail')!;
 const detail=document.querySelector<HTMLElement>('#watchDetail')!;
 const comments=document.querySelector<HTMLElement>('#watchComments')!;
 const recs=document.querySelector<HTMLElement>('#recommendGrid')!;
 const continueRows=()=>items.filter(i=>{const p=progress.get(key(i));return p&&Number(p.position_seconds)>0&&!p.completed;});
 const visible=()=>lane==='continue'?continueRows():lane==='saved'?items.filter(i=>saved.has(key(i))):lane==='featured'?items:items.filter(i=>String(i.section)===lane);
 const card=(i:Row)=>`<article class="media-ultimate__card" data-key="${esc(key(i))}"><img src="${esc(safeUrl(i.thumbnail_url)||'/images/brand/IMG_5997.png')}" alt=""><div class="watch-progress"><span style="width:${pct(progress.get(key(i)))}%"></span></div><div class="media-ultimate__card-body"><h4>${esc(i.title||'Rich Cinema')}</h4><p>${esc(i.creator_name||'Rich Creator')} · ${Number(i.view_count??0).toLocaleString()} views</p><div class="media-ultimate__meta"><span>${esc((i.section||'WATCH').toUpperCase())}</span><span>${progress.get(key(i))?.completed?'COMPLETED':pct(progress.get(key(i)))+'%'}</span></div></div></article>`;
 const bindCards=(host:HTMLElement)=>host.querySelectorAll<HTMLElement>('[data-key]').forEach(el=>el.onclick=()=>{const item=items.find(x=>key(x)===el.dataset.key);if(item)void open(item);});
 const renderMetrics=()=>{
  document.querySelector<HTMLElement>('#watchLibraryCount')!.textContent=String(items.length);
  document.querySelector<HTMLElement>('#watchContinueCount')!.textContent=String(continueRows().length);
  document.querySelector<HTMLElement>('#watchSavedCount')!.textContent=String(saved.size);
  document.querySelector<HTMLElement>('#watchCompletedCount')!.textContent=String([...progress.values()].filter(p=>p.completed).length);
 };
 const render=()=>{
  const rows=visible();
  rail.innerHTML=rows.map(card).join('')||'<div class="media-ultimate__empty">Nothing in this lane yet.</div>';
  bindCards(rail);
  const basis=active?.section?items.filter(i=>i.section===active!.section&&key(i)!==key(active!)):items.slice(1);
  recs.innerHTML=basis.slice(0,8).map(card).join('')||'<div class="media-ultimate__empty">Recommendations build as you watch.</div>';
  bindCards(recs);
 };

 const loadComments=async()=>{
  if(!active)return;
  if(commentsLoading){commentsQueued=true;return;}
  commentsLoading=true;
  const selected=key(active);
  try{
   const {data,error}=await supabase.from('watch_comments').select('id,body,created_at,profiles(display_name,username)').eq('source_type',active.source_type).eq('source_id',active.source_id).order('created_at',{ascending:true}).limit(120);
   if(error)throw error;
   if(!active||key(active)!==selected)return;
   comments.innerHTML=(data??[]).map((c:any)=>`<article><p>${esc(c.body)}</p><small>${esc(c.profiles?.display_name||c.profiles?.username||'Rich Viewer')} · ${new Date(c.created_at).toLocaleString()}</small></article>`).join('')||'<div class="media-ultimate__empty">Start the conversation.</div>';
   comments.scrollTop=comments.scrollHeight;
  }finally{
   commentsLoading=false;
   if(commentsQueued&&!disposed){commentsQueued=false;void loadComments();}
  }
 };
 const sync=async(force=false)=>{
  if(!userId||!active||!player||(!force&&player.currentTime<1))return;
  const row={user_id:userId,source_type:active.source_type,source_id:active.source_id,position_seconds:Math.floor(player.currentTime),duration_seconds:Number.isFinite(player.duration)?Math.floor(player.duration):Number(active.duration_seconds??0),completed:player.duration>0&&player.currentTime/player.duration>.92,last_watched_at:new Date().toISOString()};
  const {error}=await supabase.from('watch_progress').upsert(row,{onConflict:'user_id,source_type,source_id'});
  if(!error){progress.set(key(active),row);renderMetrics();render();}
 };
 const teardownPlayer=async(save=true)=>{
  if(progressTimer){clearInterval(progressTimer);progressTimer=null;}
  if(player){if(save)await sync(true);player.pause();player.removeAttribute('src');player.load();player=null;}
 };
 const replaceInteractionChannel=async(i:Row)=>{
  if(interactionChannel){await supabase.removeChannel(interactionChannel);interactionChannel=null;}
  interactionChannel=supabase.channel(`watch-interactions:${i.source_type}:${i.source_id}`).on('postgres_changes',{event:'*',schema:'public',table:'watch_comments',filter:`source_id=eq.${i.source_id}`},()=>void loadComments()).on('postgres_changes',{event:'*',schema:'public',table:'watch_likes',filter:`source_id=eq.${i.source_id}`},()=>void loadSnapshot()).on('postgres_changes',{event:'*',schema:'public',table:'watchlist_items',filter:`source_id=eq.${i.source_id}`},()=>void loadSnapshot()).subscribe();
 };
 const open=async(i:Row,savePrevious=true)=>{
  if(savePrevious)await teardownPlayer(true);
  active=i;
  document.querySelector<HTMLElement>('#watchHero')!.innerHTML=hero(i,liked.has(key(i)),saved.has(key(i)),Boolean(userId));
  detail.innerHTML=[['TITLE',`${i.title||'Rich Cinema'} · ${i.section||'watch'}`],['CREATOR',i.creator_name||'Rich Creator'],['AUDIENCE',`${Number(i.view_count??0).toLocaleString()} views`],['PROGRESS',`${pct(progress.get(key(i)))}% watched · ${progress.get(key(i))?.completed?'completed':'in progress'}`],['LIBRARY',`${liked.has(key(i))?'liked':'not liked'} · ${saved.has(key(i))?'saved':'not saved'}`]].map(([a,b])=>`<div class="media-ultimate__row"><div><h5>${a}</h5><p>${esc(b)}</p></div></div>`).join('');
  player=document.querySelector<HTMLVideoElement>('#watchPlayer');
  if(player){
   player.disablePictureInPicture=true;player.disableRemotePlayback=true;player.playsInline=true;
   const p=progress.get(key(i));
   player.addEventListener('loadedmetadata',()=>{if(p?.position_seconds&&Number(p.position_seconds)<player!.duration-5)player!.currentTime=Number(p.position_seconds);},{once:true});
   player.addEventListener('pause',()=>void sync(true));
   player.addEventListener('ended',()=>void sync(true));
   progressTimer=window.setInterval(()=>void sync(false),15000);
  }
  document.querySelector<HTMLButtonElement>('#watchPlayBtn')?.addEventListener('click',()=>void player?.play());
  document.querySelector<HTMLButtonElement>('#watchLikeBtn')?.addEventListener('click',async()=>{if(!requireUser())return;const k=key(i);if(liked.has(k)){await supabase.from('watch_likes').delete().eq('user_id',userId!).eq('source_type',i.source_type).eq('source_id',i.source_id);liked.delete(k);}else{await supabase.from('watch_likes').upsert({user_id:userId,source_type:i.source_type,source_id:i.source_id},{onConflict:'user_id,source_type,source_id'});liked.add(k);}await open(i,false);});
  document.querySelector<HTMLButtonElement>('#watchSaveBtn')?.addEventListener('click',async()=>{if(!requireUser())return;const k=key(i);if(saved.has(k)){await supabase.from('watchlist_items').delete().eq('user_id',userId!).eq('source_type',i.source_type).eq('source_id',i.source_id);saved.delete(k);}else{await supabase.from('watchlist_items').upsert({user_id:userId,source_type:i.source_type,source_id:i.source_id},{onConflict:'user_id,source_type,source_id'});saved.add(k);}renderMetrics();render();await open(i,false);});
  await loadComments();await replaceInteractionChannel(i);render();
 };

 document.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach(button=>button.onclick=()=>{lane=button.dataset.lane!;document.querySelectorAll('[data-lane]').forEach(node=>node.classList.toggle('active',node===button));document.querySelector<HTMLElement>('#watchLaneTitle')!.textContent=button.textContent??'Watch';render();const first=visible()[0];if(first)void open(first);});
 document.querySelector<HTMLFormElement>('#watchCommentForm')!.onsubmit=async event=>{event.preventDefault();if(!requireUser()||!active)return;const input=document.querySelector<HTMLInputElement>('#watchCommentInput')!;const body=input.value.trim();if(!body)return;const submit=event.submitter as HTMLButtonElement|null;if(submit)submit.disabled=true;try{const {error}=await supabase.from('watch_comments').insert({user_id:userId,source_type:active.source_type,source_id:active.source_id,body});if(error)throw error;input.value='';await loadComments();}finally{if(submit)submit.disabled=false;}};

 catalogChannel=supabase.channel('watch-catalog').on('postgres_changes',{event:'*',schema:'public',table:'live_recordings'},()=>void loadSnapshot()).on('postgres_changes',{event:'*',schema:'public',table:'game_clips'},()=>void loadSnapshot()).on('postgres_changes',{event:'*',schema:'public',table:'sports_posts'},()=>void loadSnapshot()).on('postgres_changes',{event:'*',schema:'public',table:'feed_posts'},()=>void loadSnapshot()).subscribe();
 const cleanup=async()=>{if(disposed)return;disposed=true;await teardownPlayer(true);if(catalogChannel)await supabase.removeChannel(catalogChannel);if(interactionChannel)await supabase.removeChannel(interactionChannel);catalogChannel=null;interactionChannel=null;};
 window.addEventListener('pagehide',()=>void cleanup(),{once:true});
 window.addEventListener('beforeunload',()=>void cleanup(),{once:true});
 await loadSnapshot();
}

function hero(i:Row,isLiked:boolean,isSaved:boolean,signedIn:boolean){
 const poster=safeUrl(i.thumbnail_url)||'/images/brand/IMG_5997.png';
 const media=safeUrl(i.media_url);
 return `<video id="watchPlayer" class="media-ultimate__hero-media" controls playsinline webkit-playsinline disablePictureInPicture disableRemotePlayback preload="metadata" poster="${esc(poster)}" src="${esc(media)}"></video><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">WE 🔥 📺 · ${esc((i.section||'WATCH').toUpperCase())}</span><h2>${esc(i.title||'Rich Cinema')}</h2><p>${esc(i.description||'Premium creator video from across the Rich Bizness universe.')}</p><div class="media-ultimate__actions"><button id="watchPlayBtn" class="media-ultimate__btn primary" type="button">▶ WATCH NOW</button><button id="watchLikeBtn" class="media-ultimate__btn" type="button">${isLiked?'♥ LIKED':'♡ LIKE'}</button><button id="watchSaveBtn" class="media-ultimate__btn" type="button">${isSaved?'✓ MY LIST':'+ MY LIST'}</button><a class="media-ultimate__btn" href="${signedIn?`/profile.html?id=${encodeURIComponent(String(i.creator_id||''))}`:'/tap-in.html?next=%2Fwatch.html'}">CREATOR</a></div></div>`;
}
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './feed.css';

type FeedPost={id:string;user_id:string;username:string|null;display_name:string|null;body:string|null;title:string|null;media_url:string|null;file_url:string|null;thumbnail_url:string|null;cover_url:string|null;media_type:string|null;post_type:string|null;section:string|null;visibility:string|null;like_count:number|null;comment_count:number|null;repost_count:number|null;view_count:number|null;is_featured:boolean|null;is_pinned:boolean|null;ranking_signals:Record<string,unknown>|null;engagement_config:Record<string,unknown>|null;created_at:string};
type CommentRow={id:string;post_id:string;display_name:string|null;username:string|null;body:string;created_at:string};
type Profile={id?:string;display_name:string|null;username:string|null;avatar_url:string|null;rich_level:number|null;rank_title:string|null};
type Channel=ReturnType<typeof supabase.channel>;

const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
const safeMedia=(value:unknown)=>{try{const url=new URL(String(value||''),location.origin);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return'';}};
const ago=(value:string)=>{const seconds=Math.max(1,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return`${seconds}s`;if(seconds<3600)return`${Math.floor(seconds/60)}m`;if(seconds<86400)return`${Math.floor(seconds/3600)}h`;return`${Math.floor(seconds/86400)}d`;};
const mediaOf=(post:FeedPost)=>safeMedia(post.media_url||post.file_url||post.thumbnail_url||post.cover_url||'');
const laneLabel=(value:string|null)=>({feed:'FEED',gallery:'GALLERY',watch:'WATCH',music:'MUSIC',podcast:'PODCAST',radio:'RADIO',sports:'SPORTS',gaming:'GAMING',store:'STORE',live:'LIVE',meta:'META'}[value||'feed']||String(value||'FEED').toUpperCase());

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root)throw new Error('Missing #app mount');
  if(root.dataset.mounted==='feed')return;
  root.dataset.mounted='feed';

  const auth=getAuthSnapshot();
  const user=auth.user;
  const userId=user?.id??null;
  const ownProfileResult=userId?await supabase.from('profiles').select('id,display_name,username,avatar_url,rich_level,rank_title').eq('id',userId).maybeSingle():{data:null,error:null};
  const ownProfile=(ownProfileResult.data??{}) as Profile;
  const sessionKey=localStorage.getItem('rb_feed_session')||crypto.randomUUID();
  localStorage.setItem('rb_feed_session',sessionKey);

  root.innerHTML=`<main class="feed-shell"><div class="feed-wrap">
    <header class="feed-top"><a href="/portal.html" aria-label="Back to Portal">←</a><div><small>RICH BIZNESS SOCIAL UNIVERSE</small><h1>RICH FEED</h1></div><nav><a href="/search.html">SEARCH</a><a href="/upload.html?route=feed">UPLOAD</a><a href="/profile.html${userId?`?id=${encodeURIComponent(userId)}`:''}">PROFILE</a></nav></header>
    <section class="feed-command"><div><span>LIVE SOCIAL SIGNAL</span><h2>EVERY UNIVERSE. ONE FEED.</h2><p>Creator drops, live moments, music, sports, games, stores, worlds and visual culture ranked into one cinematic social stream.</p></div><div class="feed-command-links"><a href="/live.html">WE LIT 🔥</a><a href="/watch.html">WE 🔥 📺</a><a href="/messages.html">RICH-DM</a></div></section>
    <div class="feed-layout"><section class="feed-main">
      <form id="composer" class="feed-composer"><div class="feed-composer-head"><img src="${esc(ownProfile.avatar_url||'/brand/icons/profile-placeholder.svg')}" alt=""><div><strong>${esc(ownProfile.display_name||ownProfile.username||(user?'Rich Member':'Public Viewer'))}</strong><small>${user?`LEVEL ${ownProfile.rich_level??1} · ${esc(ownProfile.rank_title||'Starter')}`:'BROWSE PUBLIC · TAP IN TO POST'}</small></div></div><textarea id="postBody" maxlength="4000" placeholder="Drop something into the universe..." ${user?'':'disabled'}></textarea><div class="feed-composer-actions"><div><a class="feed-button" href="${user?'/upload.html?route=feed':'/tap-in.html?next=%2Ffeed.html'}">ADD MEDIA</a><select id="postSection" class="feed-button" ${user?'':'disabled'}><option value="feed">FEED</option><option value="gallery">GALLERY</option><option value="watch">WATCH</option><option value="music">MUSIC</option><option value="podcast">PODCAST</option><option value="radio">RADIO</option><option value="sports">SPORTS</option><option value="gaming">GAMING</option><option value="store">STORE</option><option value="live">LIVE</option><option value="meta">META</option></select></div><button class="feed-button primary" type="submit">${user?'DROP POST':'TAP IN'}</button></div></form>
      <div id="tabs" class="feed-tabs"></div><div id="posts"></div><p id="status" class="feed-status" role="status"></p>
    </section><aside class="feed-side"><section class="feed-side-card"><h3>UNIVERSE LANES</h3><a href="/live.html"><span>LIVE NOW</span><b>◉</b></a><a href="/watch.html"><span>WATCH</span><b>▻</b></a><a href="/music.html"><span>MUSIC</span><b>♪</b></a><a href="/podcast.html"><span>PODCAST</span><b>◍</b></a><a href="/radio.html"><span>RADIO</span><b>◉</b></a><a href="/sports.html"><span>SPORTS</span><b>🏆</b></a><a href="/gaming.html"><span>GAMING</span><b>🎮</b></a><a href="/store.html"><span>STORE</span><b>🛒</b></a></section><section class="feed-side-card"><h3>YOUR CORE</h3><a href="/messages.html"><span>RICH-DM</span><b>✦</b></a><a href="/notifications.html"><span>ALERTS</span><b>◌</b></a><a href="/creator.html"><span>CREATOR</span><b>◆</b></a><a href="/avatar.html"><span>AVATAR</span><b>◎</b></a></section></aside></div>
    <div id="feedModal" class="feed-modal" hidden><article class="feed-modal-card"><button id="feedModalClose" class="feed-modal-close" aria-label="Close conversation">×</button><div id="feedModalPost"></div><section class="feed-comments open"><div id="feedModalComments" class="feed-comment-list"></div><form id="feedModalForm" class="feed-comment-form"><input maxlength="2000" placeholder="Add to the conversation..." ${user?'':'disabled'}><button class="feed-button primary">${user?'POST':'TAP IN'}</button></form></section></article></div>
  </div></main>`;

  const postsEl=document.querySelector<HTMLElement>('#posts')!;
  const tabsEl=document.querySelector<HTMLElement>('#tabs')!;
  const status=document.querySelector<HTMLElement>('#status')!;
  const modal=document.querySelector<HTMLElement>('#feedModal')!;
  const modalPost=document.querySelector<HTMLElement>('#feedModalPost')!;
  const modalComments=document.querySelector<HTMLElement>('#feedModalComments')!;
  const modalForm=document.querySelector<HTMLFormElement>('#feedModalForm')!;
  let posts:FeedPost[]=[];
  let creatorProfiles=new Map<string,Profile>();
  let liked=new Set<string>();
  let following=new Set<string>();
  let filter=new URLSearchParams(location.search).get('section')||'all';
  let catalogChannel:Channel|null=null;
  let commentChannel:Channel|null=null;
  let activePost:FeedPost|null=null;
  let loadingPosts=false;
  let queuedPosts=false;
  let loadingComments=false;
  let queuedComments=false;
  let disposed=false;
  let statusTimer=0;
  const observedViews=new Set<string>();

  const setStatus=(message:string)=>{status.textContent=message;window.clearTimeout(statusTimer);statusTimer=window.setTimeout(()=>{if(status.textContent===message)status.textContent='';},2600);};
  const requireUser=()=>{if(userId)return true;location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname+location.search)}`);return false;};
  const profileFor=(post:FeedPost)=>creatorProfiles.get(post.user_id)??{display_name:post.display_name,username:post.username,avatar_url:null,rich_level:null,rank_title:null};

  const loadIdentityState=async()=>{
    if(!userId){liked.clear();following.clear();return;}
    const [likesResult,followsResult]=await Promise.all([
      supabase.from('feed_post_likes').select('post_id').eq('user_id',userId),
      supabase.from('followers').select('following_id').eq('follower_id',userId)
    ]);
    liked=new Set((likesResult.data??[]).map((row:any)=>String(row.post_id)));
    following=new Set((followsResult.data??[]).map((row:any)=>String(row.following_id)));
  };

  const hydrateCreators=async(rows:FeedPost[])=>{
    const ids=[...new Set(rows.map(row=>row.user_id).filter(Boolean))];
    if(!ids.length){creatorProfiles.clear();return;}
    const {data}=await supabase.from('profiles').select('id,display_name,username,avatar_url,rich_level,rank_title').in('id',ids);
    creatorProfiles=new Map((data??[]).map((profile:any)=>[String(profile.id),profile as Profile]));
  };

  const loadPosts=async()=>{
    if(loadingPosts){queuedPosts=true;return;}
    loadingPosts=true;
    try{
      let query=supabase.from('feed_posts').select('id,user_id,username,display_name,body,title,media_url,file_url,thumbnail_url,cover_url,media_type,post_type,section,visibility,like_count,comment_count,repost_count,view_count,is_featured,is_pinned,ranking_signals,engagement_config,created_at').neq('moderation_state','blocked').in('visibility',['public','followers']).order('is_pinned',{ascending:false}).order('is_featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
      if(filter!=='all')query=query.eq('section',filter);
      const {data,error}=await query;
      if(error){postsEl.innerHTML=`<div class="feed-empty">${esc(error.message)}</div>`;return;}
      posts=(data??[]) as FeedPost[];
      await Promise.all([hydrateCreators(posts),loadIdentityState()]);
      renderPosts();
    }finally{loadingPosts=false;if(queuedPosts){queuedPosts=false;void loadPosts();}}
  };

  const tabs=[['all','FOR YOU'],['feed','FEED'],['gallery','GALLERY'],['watch','WATCH'],['music','MUSIC'],['podcast','PODCAST'],['radio','RADIO'],['live','LIVE'],['sports','SPORTS'],['gaming','GAMING'],['store','STORE'],['meta','META']];
  const renderTabs=()=>{tabsEl.innerHTML=tabs.map(([value,label])=>`<button class="feed-tab ${filter===value?'active':''}" data-filter="${value}">${label}</button>`).join('');tabsEl.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter||'all';const url=new URL(location.href);if(filter==='all')url.searchParams.delete('section');else url.searchParams.set('section',filter);history.replaceState({},'',url);renderTabs();void loadPosts();});};

  const renderMedia=(post:FeedPost)=>{const src=mediaOf(post);if(!src)return'';const type=(post.media_type||post.post_type||'').toLowerCase();if(type.includes('video')||/\.(mp4|webm|mov)(\?|$)/i.test(src))return`<video class="feed-media" controls playsinline poster="${esc(safeMedia(post.thumbnail_url||post.cover_url))}" src="${esc(src)}" preload="metadata"></video>`;if(type.includes('audio')||/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(src))return`<audio class="feed-media" controls src="${esc(src)}" preload="metadata"></audio>`;return`<img class="feed-media" loading="lazy" src="${esc(src)}" alt="${esc(post.title||'Rich Feed media')}">`;};
  const postMarkup=(post:FeedPost,compact=false)=>{const creator=profileFor(post);const followed=following.has(post.user_id);return`<article class="feed-card ${post.is_pinned?'pinned':''} ${post.is_featured?'featured':''}" data-post="${post.id}"><header class="feed-card-head"><img src="${esc(creator.avatar_url||'/brand/icons/profile-placeholder.svg')}" alt=""><div><a href="/profile.html?id=${encodeURIComponent(post.user_id)}"><strong>${esc(creator.display_name||post.display_name||creator.username||post.username||'Rich Creator')}</strong></a><span>@${esc(creator.username||post.username||'member')} · ${ago(post.created_at)}${creator.rank_title?` · ${esc(creator.rank_title)}`:''}</span></div><em>${post.is_pinned?'PINNED':post.is_featured?'FEATURED':laneLabel(post.section)}</em></header><div class="feed-card-copy">${post.title?`<h2>${esc(post.title)}</h2>`:''}${post.body?`<p>${esc(post.body)}</p>`:''}</div>${renderMedia(post)}<div class="feed-card-stats"><span>${Number(post.like_count??0).toLocaleString()} likes</span><span>${Number(post.comment_count??0).toLocaleString()} comments</span><span>${Number(post.repost_count??0).toLocaleString()} reposts</span><span>${Number(post.view_count??0).toLocaleString()} views</span></div>${compact?'':`<div class="feed-card-actions"><button data-like class="${liked.has(post.id)?'active':''}">${liked.has(post.id)?'♥ LIKED':'♡ LIKE'}</button><button data-comments>◌ COMMENT</button><button data-follow class="${followed?'active':''}">${followed?'✓ FOLLOWING':'+ FOLLOW'}</button><a href="/messages.html?share=${encodeURIComponent(post.id)}">✦ SHARE</a></div>`}</article>`;};

  const viewObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting||entry.intersectionRatio<.55)continue;const id=(entry.target as HTMLElement).dataset.post;if(!id||observedViews.has(id))continue;observedViews.add(id);void supabase.rpc('rb_feed_record_view',{p_post_id:id,p_session_id:sessionKey});viewObserver.unobserve(entry.target);}}, {threshold:[.55]});

  const renderPosts=()=>{
    viewObserver.disconnect();
    postsEl.innerHTML=posts.length?posts.map(post=>postMarkup(post)).join(''):'<div class="feed-empty">No drops in this lane yet.</div>';
    postsEl.querySelectorAll<HTMLElement>('[data-post]').forEach(card=>{
      viewObserver.observe(card);
      const id=card.dataset.post!;
      const post=posts.find(item=>item.id===id)!;
      card.querySelector<HTMLButtonElement>('[data-like]')!.onclick=async()=>{if(!requireUser())return;const button=card.querySelector<HTMLButtonElement>('[data-like]')!;button.disabled=true;const {data,error}=await supabase.rpc('rb_feed_toggle_like',{p_post_id:id});button.disabled=false;if(error){setStatus(error.message);return;}const result=data as any;if(result?.liked)liked.add(id);else liked.delete(id);post.like_count=Number(result?.count??post.like_count??0);renderPosts();};
      card.querySelector<HTMLButtonElement>('[data-comments]')!.onclick=()=>void openConversation(post);
      card.querySelector<HTMLButtonElement>('[data-follow]')!.onclick=async()=>{if(!requireUser()||post.user_id===userId)return;const isFollowing=following.has(post.user_id);const result=isFollowing?await supabase.from('followers').delete().eq('follower_id',userId!).eq('following_id',post.user_id):await supabase.from('followers').upsert({follower_id:userId!,following_id:post.user_id},{onConflict:'follower_id,following_id'});if(result.error){setStatus(result.error.message);return;}if(isFollowing)following.delete(post.user_id);else following.add(post.user_id);renderPosts();};
    });
  };

  const loadComments=async(postId:string)=>{
    if(loadingComments){queuedComments=true;return;}
    loadingComments=true;
    try{const {data,error}=await supabase.from('feed_comments').select('id,post_id,display_name,username,body,created_at').eq('post_id',postId).order('created_at',{ascending:true}).limit(150);if(error){modalComments.innerHTML=`<div class="feed-empty">${esc(error.message)}</div>`;return;}const rows=(data??[]) as CommentRow[];modalComments.innerHTML=rows.length?rows.map(comment=>`<article class="feed-comment"><strong>${esc(comment.display_name||comment.username||'Rich Member')}</strong><small>${ago(comment.created_at)}</small><p>${esc(comment.body)}</p></article>`).join(''):'<div class="feed-empty">Start the conversation.</div>';modalComments.scrollTop=modalComments.scrollHeight;}finally{loadingComments=false;if(queuedComments&&activePost){queuedComments=false;void loadComments(activePost.id);}}
  };

  const openConversation=async(post:FeedPost)=>{activePost=post;modalPost.innerHTML=postMarkup(post,true);modal.hidden=false;document.body.style.overflow='hidden';if(commentChannel)await supabase.removeChannel(commentChannel);await loadComments(post.id);commentChannel=supabase.channel(`feed-comments:${post.id}`).on('postgres_changes',{event:'*',schema:'public',table:'feed_comments',filter:`post_id=eq.${post.id}`},()=>void loadComments(post.id)).subscribe();};
  const closeConversation=async()=>{modal.hidden=true;modalPost.innerHTML='';modalComments.innerHTML='';document.body.style.overflow='';activePost=null;if(commentChannel){await supabase.removeChannel(commentChannel);commentChannel=null;}};
  const onKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!modal.hidden)void closeConversation();};
  const onBackdrop=(event:MouseEvent)=>{if(event.target===modal)void closeConversation();};
  document.querySelector<HTMLButtonElement>('#feedModalClose')!.onclick=()=>void closeConversation();
  modal.addEventListener('click',onBackdrop);
  window.addEventListener('keydown',onKeydown);
  modalForm.onsubmit=async event=>{event.preventDefault();if(!activePost||!requireUser())return;const input=modalForm.querySelector<HTMLInputElement>('input')!;const body=input.value.trim();if(!body)return;const button=modalForm.querySelector<HTMLButtonElement>('button')!;button.disabled=true;const {error}=await supabase.rpc('rb_feed_add_comment',{p_post_id:activePost.id,p_body:body});button.disabled=false;if(error){setStatus(error.message);return;}input.value='';activePost.comment_count=Number(activePost.comment_count??0)+1;await loadComments(activePost.id);};

  document.querySelector<HTMLFormElement>('#composer')!.onsubmit=async event=>{event.preventDefault();if(!requireUser())return;const body=document.querySelector<HTMLTextAreaElement>('#postBody')!.value.trim();const section=document.querySelector<HTMLSelectElement>('#postSection')!.value;if(!body){setStatus('WRITE SOMETHING FIRST');return;}const submit=(event.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"]')!;submit.disabled=true;setStatus('DROPPING POST...');const {error}=await supabase.from('feed_posts').insert({user_id:userId!,username:ownProfile.username,display_name:ownProfile.display_name,body,section,visibility:'public',post_type:'text',media_type:'text',moderation_state:'approved',metadata:{source:'feed-composer'},ranking_signals:{source:'organic'},engagement_config:{comments:true,likes:true,shares:true}});submit.disabled=false;if(error){setStatus(error.message);return;}document.querySelector<HTMLTextAreaElement>('#postBody')!.value='';setStatus('POST LIVE');await loadPosts();};

  renderTabs();
  await loadPosts();
  catalogChannel=supabase.channel('rich-feed-catalog').on('postgres_changes',{event:'*',schema:'public',table:'feed_posts'},()=>void loadPosts()).on('postgres_changes',{event:'*',schema:'public',table:'feed_post_likes'},()=>void loadPosts()).on('postgres_changes',{event:'*',schema:'public',table:'followers'},()=>void loadIdentityState().then(renderPosts)).subscribe();

  const cleanup=()=>{if(disposed)return;disposed=true;window.clearTimeout(statusTimer);viewObserver.disconnect();window.removeEventListener('keydown',onKeydown);modal.removeEventListener('click',onBackdrop);document.body.style.overflow='';root.querySelectorAll('video,audio').forEach(media=>{const element=media as HTMLMediaElement;element.pause();element.removeAttribute('src');element.load();});if(catalogChannel)void supabase.removeChannel(catalogChannel);if(commentChannel)void supabase.removeChannel(commentChannel);};
  window.addEventListener('pagehide',cleanup,{once:true});
  window.addEventListener('beforeunload',cleanup,{once:true});
}
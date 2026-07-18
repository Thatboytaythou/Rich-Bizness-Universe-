import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './communications.css';
import './notifications-universe.css';

type Notice = {
  id:string; type:string; title:string|null; body:string|null; emoji:string|null;
  target_table:string|null; target_type:string|null; target_url:string|null;
  action_label:string|null; action_url:string|null; alert_style:string|null;
  priority:string|null; is_read:boolean|null; is_seen:boolean|null;
  is_silent:boolean|null; created_at:string|null;
};
type FilterKey='all'|'unread'|'social'|'media'|'live'|'money'|'system';
type Snapshot={counts?:{all?:number;unread?:number;unseen?:number};notifications?:Notice[]};

const esc=(value:string|null|undefined)=>(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]??character));
function relativeTime(value:string|null):string{
  if(!value)return'';
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60)return'NOW'; if(seconds<3600)return`${Math.floor(seconds/60)}M`; if(seconds<86400)return`${Math.floor(seconds/3600)}H`; if(seconds<604800)return`${Math.floor(seconds/86400)}D`;
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(value));
}
function safeTarget(value:string|null|undefined):string{
  const raw=(value??'').trim(); if(!raw)return ROUTES.notifications;
  if(raw.startsWith('/')&&!raw.startsWith('//'))return raw;
  try{const url=new URL(raw,location.origin);return url.origin===location.origin?`${url.pathname}${url.search}${url.hash}`:ROUTES.notifications;}catch{return ROUTES.notifications;}
}
function categoryFor(notice:Notice):Exclude<FilterKey,'all'|'unread'>{
  const source=`${notice.type} ${notice.target_type??''} ${notice.target_table??''}`.toLowerCase();
  if(/(live|stream|broadcast|room|call)/.test(source))return'live';
  if(/(music|track|podcast|radio|watch|video|gallery)/.test(source))return'media';
  if(/(order|sale|payout|money|balance|store|purchase|tip)/.test(source))return'money';
  if(/(follow|comment|like|message|reaction|mention|profile)/.test(source))return'social';
  return'system';
}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root||root.dataset.notificationsOwner==='mounted')return;
  root.dataset.notificationsOwner='mounted';
  const user=getAuthSnapshot().user;
  if(!user){location.replace(`/tap-in.html?next=${encodeURIComponent(ROUTES.notifications)}`);return;}

  root.innerHTML=`<main class="notifications-shell"><div class="notifications-wrap">
    <header class="notifications-head"><a href="${ROUTES.portal}" aria-label="Back to Portal">←</a><div><p>SMOKE CLOUD RICH ALERTS</p><h1>Notifications</h1></div><span id="noticeCount" class="notifications-count">0 NEW</span></header>
    <nav class="notifications-shortcuts" aria-label="Notification shortcuts"><a href="${ROUTES.messages}">RICH-DM</a><a href="${ROUTES.live}">LIVE</a><a href="${ROUTES.watch}">WATCH</a><a href="${ROUTES.settings}">SETTINGS</a></nav>
    <section class="notifications-command"><div class="notifications-filters" role="tablist">${(['all','unread','social','media','live','money','system'] as FilterKey[]).map((filter)=>`<button type="button" data-filter="${filter}" class="${filter==='all'?'active':''}">${filter.toUpperCase()} <span data-filter-count="${filter}">0</span></button>`).join('')}</div><div class="notifications-actions"><button id="markAll" type="button">MARK ALL READ</button><button id="refresh" type="button">REFRESH</button></div></section>
    <p id="noticeStatus" class="notifications-status" role="status"></p><section id="noticeList" class="notifications-list" aria-live="polite"></section>
  </div></main>`;

  const list=root.querySelector<HTMLElement>('#noticeList')!;
  const count=root.querySelector<HTMLElement>('#noticeCount')!;
  const status=root.querySelector<HTMLElement>('#noticeStatus')!;
  const refreshButton=root.querySelector<HTMLButtonElement>('#refresh')!;
  const markAllButton=root.querySelector<HTMLButtonElement>('#markAll')!;
  const filterButtons=Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  let notices:Notice[]=[]; let authoritativeAll=0; let authoritativeUnread=0; let activeFilter:FilterKey='all';
  let destroyed=false; let loading=false; let refreshQueued=false; let refreshTimer=0; let channel:ReturnType<typeof supabase.channel>|null=null;

  const setStatus=(message:string)=>{if(!destroyed)status.textContent=message;};
  const filteredNotices=()=>notices.filter((notice)=>activeFilter==='all'||(activeFilter==='unread'?!notice.is_read:categoryFor(notice)===activeFilter));
  const updateCounts=()=>{
    count.textContent=`${authoritativeUnread} NEW`;
    root.querySelectorAll<HTMLElement>('[data-filter-count]').forEach((node)=>{
      const key=node.dataset.filterCount as FilterKey;
      const value=key==='all'?authoritativeAll:key==='unread'?authoritativeUnread:notices.filter((notice)=>categoryFor(notice)===key).length;
      node.textContent=String(value);
    });
    markAllButton.disabled=authoritativeUnread===0||loading;
  };
  const render=()=>{
    const rows=filteredNotices(); updateCounts();
    list.innerHTML=rows.length?rows.map((notice)=>{
      const category=categoryFor(notice); const target=safeTarget(notice.action_url||notice.target_url); const action=notice.action_label||'OPEN';
      return `<article class="notification-card ${notice.is_read?'':'unread'} priority-${esc(notice.priority||'normal')} ${notice.is_silent?'silent':''}" data-category="${category}"><button class="notification-main" type="button" data-open="${notice.id}" data-target="${esc(target)}"><span class="notification-icon">${esc(notice.emoji||'💨')}</span><span class="notification-copy"><span class="notification-meta"><b>${esc(category.toUpperCase())}</b><time>${relativeTime(notice.created_at)}</time></span><strong>${esc(notice.title||notice.type||'Rich Bizness update')}</strong><span>${esc(notice.body||'Something new happened in your universe.')}</span></span><span class="notification-action">${esc(action)}</span></button>${notice.is_read?'':`<button type="button" class="notification-read" data-read="${notice.id}" aria-label="Mark notification read">✓</button>`}</article>`;
    }).join(''):`<div class="notifications-empty"><span>💨</span><h2>${activeFilter==='all'?'No alerts yet':`No ${activeFilter} alerts`}</h2><p>Your Rich Bizness universe is clear right now.</p></div>`;
  };
  const markRead=async(id:string)=>{
    const{data,error}=await supabase.rpc('rb_notifications_mark_read',{p_notification_id:id,p_all:false}); if(error)throw error;
    const notice=notices.find((row)=>row.id===id); if(notice){notice.is_read=true;notice.is_seen=true;}
    authoritativeUnread=Number((data as any)?.unread??Math.max(0,authoritativeUnread-1));
  };
  const load=async()=>{
    if(destroyed)return; if(loading){refreshQueued=true;return;} loading=true; refreshButton.disabled=true; setStatus('SYNCING ALERTS…');
    try{
      const{data,error}=await supabase.rpc('rb_notifications_snapshot',{p_limit:150}); if(error)throw error;
      const snapshot=(data??{}) as Snapshot; notices=snapshot.notifications??[]; authoritativeAll=Number(snapshot.counts?.all??notices.length); authoritativeUnread=Number(snapshot.counts?.unread??notices.filter((notice)=>!notice.is_read).length); render();
      const unseenIds=notices.filter((notice)=>!notice.is_seen).map((notice)=>notice.id);
      if(unseenIds.length){const{error:seenError}=await supabase.rpc('rb_notifications_mark_seen',{p_ids:unseenIds});if(seenError)throw seenError;notices.forEach((notice)=>{if(unseenIds.includes(notice.id))notice.is_seen=true;});}
      setStatus('');
    }catch(caught){setStatus(caught instanceof Error?caught.message:'Unable to sync notifications.');}
    finally{loading=false;refreshButton.disabled=false;updateCounts();if(refreshQueued){refreshQueued=false;void load();}}
  };
  const queueLoad=()=>{window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>void load(),180);};

  list.addEventListener('click',async(event)=>{
    const target=event.target as HTMLElement; const readButton=target.closest<HTMLButtonElement>('[data-read]');
    if(readButton){readButton.disabled=true;try{await markRead(readButton.dataset.read!);render();}catch(caught){setStatus(caught instanceof Error?caught.message:'Unable to update alert.');}return;}
    const openButton=target.closest<HTMLButtonElement>('[data-open]'); if(!openButton)return;
    try{await markRead(openButton.dataset.open!);location.assign(openButton.dataset.target||ROUTES.notifications);}catch(caught){setStatus(caught instanceof Error?caught.message:'Unable to open alert.');}
  });
  filterButtons.forEach((button)=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter as FilterKey;filterButtons.forEach((item)=>item.classList.toggle('active',item===button));render();}));
  refreshButton.addEventListener('click',()=>void load());
  markAllButton.addEventListener('click',async()=>{
    markAllButton.disabled=true;
    try{const{data,error}=await supabase.rpc('rb_notifications_mark_read',{p_notification_id:null,p_all:true});if(error)throw error;notices.forEach((notice)=>{notice.is_read=true;notice.is_seen=true;});authoritativeUnread=Number((data as any)?.unread??0);render();setStatus('All alerts marked read.');}
    catch(caught){setStatus(caught instanceof Error?caught.message:'Unable to mark alerts read.');}
    finally{updateCounts();}
  });

  await load();
  channel=supabase.channel(`rich-notifications:${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'rich_notifications',filter:`user_id=eq.${user.id}`},queueLoad).subscribe();
  const cleanup=()=>{if(destroyed)return;destroyed=true;window.clearTimeout(refreshTimer);if(channel){void supabase.removeChannel(channel);channel=null;}delete root.dataset.notificationsOwner;};
  window.addEventListener('pagehide',cleanup,{once:true});
}
import { supabase } from '../../core/supabase/client';
import './communications.css';

type Notice = { id:string; type:string; title:string|null; body:string|null; emoji:string|null; target_url:string|null; action_url:string|null; is_read:boolean|null; created_at:string|null };

function esc(v:string|null|undefined){return (v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]??c));}
function time(v:string|null){return v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)):'';}
function safeTarget(value:string|null|undefined){const raw=(value??'').trim();if(!raw)return'#';if(raw.startsWith('/')&&!raw.startsWith('//'))return raw;try{const url=new URL(raw,location.origin);return url.origin===location.origin?`${url.pathname}${url.search}${url.hash}`:'#';}catch{return'#';}}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app'); if(!root) throw new Error('Missing #app mount');
  const {data:{session}}=await supabase.auth.getSession(); if(!session){location.replace('/tap-in.html?next=%2Fnotifications.html');return;}
  root.innerHTML=`<main class="comm-shell"><div class="comm-wrap"><header class="comm-head"><a href="/portal.html">←</a><div><p>SMOKE CLOUD RICH ALERTS</p><h1>Notifications</h1></div><span id="noticeCount" class="comm-pill">0 NEW</span></header><div class="comm-actions"><button id="markAll" class="comm-button primary">MARK ALL READ</button><button id="refresh" class="comm-button">REFRESH</button></div><p id="noticeStatus" class="status-line" role="status"></p><section id="noticeList" class="comm-card comm-list"></section></div></main>`;
  const list=document.querySelector<HTMLElement>('#noticeList')!; const count=document.querySelector<HTMLElement>('#noticeCount')!; const status=document.querySelector<HTMLElement>('#noticeStatus')!;
  const markRead=async(id:string)=>{const now=new Date().toISOString();const {error}=await supabase.from('rich_notifications').update({is_read:true,is_seen:true,read_at:now,seen_at:now}).eq('id',id).eq('user_id',session.user.id);if(error)throw error;};
  const render=async()=>{status.textContent='';const {data,error}=await supabase.from('rich_notifications').select('id,type,title,body,emoji,target_url,action_url,is_read,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(100); if(error){status.textContent=error.message;return;} const rows=(data??[]) as Notice[]; count.textContent=`${rows.filter(n=>!n.is_read).length} NEW`; list.innerHTML=rows.length?rows.map(n=>`<a class="comm-item ${n.is_read?'':'comm-unread'}" href="${esc(safeTarget(n.action_url||n.target_url))}" data-notice="${n.id}"><span class="comm-icon">${esc(n.emoji||'💨')}</span><div><h2>${esc(n.title||n.type)}</h2><p>${esc(n.body||'Rich Bizness update')}</p></div><time>${time(n.created_at)}</time></a>`).join(''):'<div class="comm-empty">No alerts yet.</div>'; list.querySelectorAll<HTMLAnchorElement>('[data-notice]').forEach(link=>link.addEventListener('click',async event=>{event.preventDefault();const target=link.getAttribute('href')||'#';try{await markRead(link.dataset.notice!);}catch(caught){status.textContent=caught instanceof Error?caught.message:'Unable to open alert.';return;}location.assign(target);})); const seenAt=new Date().toISOString();await supabase.from('rich_notifications').update({is_seen:true,seen_at:seenAt}).eq('user_id',session.user.id).eq('is_seen',false);};
  document.querySelector('#refresh')?.addEventListener('click',()=>void render());
  document.querySelector('#markAll')?.addEventListener('click',async()=>{const now=new Date().toISOString();const {error}=await supabase.from('rich_notifications').update({is_read:true,is_seen:true,read_at:now,seen_at:now}).eq('user_id',session.user.id).eq('is_read',false);if(error){status.textContent=error.message;return;}await render();});
  await render();
  const channel=supabase.channel(`notices:${session.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'rich_notifications',filter:`user_id=eq.${session.user.id}`},()=>void render()).subscribe();
  window.addEventListener('beforeunload',()=>{void supabase.removeChannel(channel);},{once:true});
}

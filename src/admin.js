import { supabase } from './supabase-client.js';
import { RB_CONFIG } from './config.js';

const T = RB_CONFIG.tables;
const $ = (id) => document.getElementById(id);
const state = { user:null, role:null, channels:[], busy:false };
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const fmt = (value) => value ? new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—';
const setText = (id,value) => { const el=$(id); if(el) el.textContent=value; };
const can = (key) => Boolean(state.role?.is_active && (state.role?.[key] || state.role?.permission_level >= 4));

function setAccess(message, ok=false){
  setText('adminStatus',message);
  $('adminStatus')?.classList.toggle('muted',!ok);
  setText('adminRole',state.role ? `${state.role.role_label || state.role.role_key} · LEVEL ${state.role.permission_level || 0}` : 'NO ACTIVE ADMIN ROLE');
  setText('adminFooter',message);
}

async function audit(action,targetTable=null,targetId=null,severity='normal',metadata={}){
  if(!state.user) return;
  const { error } = await supabase.from(T.adminAuditLogs).insert({admin_id:state.user.id,action,target_table:targetTable,target_id:targetId,severity,metadata});
  if(error) console.warn('Admin audit write failed',error.message);
}

function item(title,body,meta='',actions=''){
  return `<article class="item"><div class="item-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body || '')}</p></div></div>${meta?`<div class="meta">${escapeHtml(meta)}</div>`:''}${actions?`<div class="item-actions">${actions}</div>`:''}</article>`;
}

async function loadRole(){
  const { data:{ session } } = await supabase.auth.getSession();
  state.user=session?.user || null;
  if(!state.user){ location.href=`/auth.html?next=${encodeURIComponent('/admin.html')}`; return false; }
  const { data,error } = await supabase.from(T.adminRoles).select('*').eq('user_id',state.user.id).eq('is_active',true).maybeSingle();
  if(error || !data){ setAccess('ACCESS DENIED'); document.querySelectorAll('form,button').forEach((el)=>el.disabled=true); return false; }
  state.role=data; setAccess('ADMIN COMMAND ONLINE',true); return true;
}

async function loadAnnouncements(){
  const { data=[],error }=await supabase.from(T.announcements).select('*').order('created_at',{ascending:false}).limit(20);
  if(error) throw error;
  setText('announcementCount',data.length);
  $('announcementList').innerHTML=data.length?data.map((a)=>item(`${a.emoji||'📣'} ${a.title}`,a.body,`${a.priority||'normal'} · ${a.target_section||'global'} · ${fmt(a.created_at)}`,can('can_manage_platform')?`<button data-action="announcement-toggle" data-id="${a.id}" data-active="${a.is_active}">${a.is_active?'DEACTIVATE':'ACTIVATE'}</button>`:'')).join(''):'<p class="empty">No announcements yet.</p>';
}

async function loadReports(){
  const { data=[],error }=await supabase.from(T.moderationReports).select('*').order('created_at',{ascending:false}).limit(30);
  if(error) throw error;
  const open=data.filter((r)=>!['resolved','dismissed'].includes(r.status)); setText('reportMetric',open.length); setText('reportCount',data.length);
  $('reportList').innerHTML=data.length?data.map((r)=>item(r.reason||'Moderation report',r.details,`${r.priority||'normal'} · ${r.status||'open'} · ${fmt(r.created_at)}`,can('can_moderate')&&!['resolved','dismissed'].includes(r.status)?`<button data-action="report-resolve" data-id="${r.id}">RESOLVE</button><button data-action="report-dismiss" data-id="${r.id}">DISMISS</button>`:'')).join(''):'<p class="empty">No reports in queue.</p>';
}

async function loadReviews(){
  const { data=[],error }=await supabase.from(T.contentReview).select('*').order('created_at',{ascending:false}).limit(30);
  if(error) throw error;
  const pending=data.filter((r)=>r.status==='pending'); setText('reviewMetric',pending.length); setText('reviewCount',data.length);
  $('reviewList').innerHTML=data.length?data.map((r)=>item(`${r.review_type||'content'} · ${r.target_table}`,r.flagged_reason,`${r.status||'pending'} · ${fmt(r.created_at)}`,can('can_moderate')&&r.status==='pending'?`<button data-action="review-approve" data-id="${r.id}">APPROVE</button><button data-action="review-reject" data-id="${r.id}">REJECT</button>`:'')).join(''):'<p class="empty">Review queue is clear.</p>';
}

async function loadFlags(){
  const { data=[],error }=await supabase.from(T.featureFlags).select('*').order('section').order('flag_key');
  if(error) throw error;
  setText('flagMetric',data.filter((f)=>f.is_enabled).length); setText('flagCount',data.length);
  $('flagList').innerHTML=data.length?data.map((f)=>item(f.title||f.flag_key,f.description,`${f.section||'global'} · ${f.rollout_percent||0}% rollout`,can('can_manage_platform')?`<button data-action="flag-toggle" data-id="${f.id}" data-active="${f.is_enabled}">${f.is_enabled?'DISABLE':'ENABLE'}</button>`:'')).join(''):'<p class="empty">No feature flags configured.</p>';
}

async function loadHealth(){
  const { data=[],error }=await supabase.from(T.systemHealth).select('*').order('checked_at',{ascending:false}).limit(20);
  if(error) throw error;
  const latest=[...new Map(data.map((h)=>[h.service,h])).values()]; setText('healthMetric',latest.length); setText('healthCount',latest.length);
  $('healthList').innerHTML=latest.length?latest.map((h)=>item(h.service,h.message,`${h.status||'unknown'} · ${h.latency_ms??'—'}ms · ${fmt(h.checked_at)}`)).join(''):'<p class="empty">No health signals recorded.</p>';
}

async function loadAudits(){
  const { data=[],error }=await supabase.from(T.adminAuditLogs).select('*').order('created_at',{ascending:false}).limit(30);
  if(error) throw error;
  setText('auditCount',data.length);
  $('auditList').innerHTML=data.length?data.map((a)=>item(a.action,a.target_table||'platform',`${a.severity||'normal'} · ${fmt(a.created_at)}`)).join(''):'<p class="empty">No audit events recorded.</p>';
}

async function refresh(){
  const jobs=[loadAnnouncements(),loadReports(),loadReviews(),loadFlags(),loadHealth(),loadAudits()];
  const results=await Promise.allSettled(jobs); const failed=results.filter((r)=>r.status==='rejected');
  setAccess(failed.length?`ADMIN ONLINE · ${failed.length} LANE${failed.length>1?'S':''} RESTRICTED`:'ADMIN COMMAND ONLINE',failed.length===0);
}

async function mutate(table,id,values,action,severity='normal'){
  if(state.busy) return; state.busy=true;
  try{
    const { error }=await supabase.from(table).update(values).eq('id',id); if(error) throw error;
    await audit(action,table,id,severity,values); await refresh();
  }catch(error){ setAccess(`ACTION BLOCKED · ${error.message}`); }
  finally{ state.busy=false; }
}

$('announcementForm')?.addEventListener('submit',async(e)=>{
  e.preventDefault(); if(!can('can_manage_platform')||state.busy) return;
  state.busy=true;
  try{
    const payload={created_by:state.user.id,title:$('announcementTitle').value.trim(),body:$('announcementBody').value.trim(),emoji:$('announcementEmoji').value.trim()||'📣',announcement_style:'rich',target_section:'global',priority:$('announcementPriority').value,is_active:true,starts_at:new Date().toISOString()};
    const { data,error }=await supabase.from(T.announcements).insert(payload).select('id').single(); if(error) throw error;
    await audit('announcement.publish',T.announcements,data.id,payload.priority,payload); e.target.reset(); await refresh();
  }catch(error){ setAccess(`PUBLISH BLOCKED · ${error.message}`); }
  finally{ state.busy=false; }
});

document.addEventListener('click',(e)=>{
  const button=e.target.closest('[data-action]'); if(!button) return;
  const { action,id,active }=button.dataset;
  if(action==='announcement-toggle') mutate(T.announcements,id,{is_active:active!=='true'},'announcement.toggle');
  if(action==='flag-toggle') mutate(T.featureFlags,id,{is_enabled:active!=='true',updated_at:new Date().toISOString()},'feature_flag.toggle','high');
  if(action==='report-resolve') mutate(T.moderationReports,id,{status:'resolved',assigned_admin_id:state.user.id,resolved_at:new Date().toISOString()},'moderation.resolve','high');
  if(action==='report-dismiss') mutate(T.moderationReports,id,{status:'dismissed',assigned_admin_id:state.user.id,resolved_at:new Date().toISOString()},'moderation.dismiss');
  if(action==='review-approve') mutate(T.contentReview,id,{status:'approved',reviewed_by:state.user.id,reviewed_at:new Date().toISOString()},'content_review.approve','high');
  if(action==='review-reject') mutate(T.contentReview,id,{status:'rejected',reviewed_by:state.user.id,reviewed_at:new Date().toISOString()},'content_review.reject','high');
});

function subscribe(){
  ['platform_announcements','feature_flags','moderation_reports','content_review_queue','system_health_checks','admin_audit_logs'].forEach((table)=>{
    const channel=supabase.channel(`admin:${table}`).on('postgres_changes',{event:'*',schema:'public',table},()=>refresh()).subscribe(); state.channels.push(channel);
  });
}

window.addEventListener('pagehide',()=>state.channels.forEach((channel)=>supabase.removeChannel(channel)),{once:true});

(async()=>{
  if(!supabase){ setAccess('SUPABASE CONFIG MISSING'); return; }
  if(await loadRole()){ await refresh(); subscribe(); }
})();

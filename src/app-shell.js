import { supabase } from './supabase-client.js';

const ROUTES=[
  ['HOME','⌂','/'],['FEED','◫','/feed.html'],['LIVE','◉','/live.html'],['MUSIC','♪','/music.html'],['GAMES','🎮','/gaming.html'],['STORE','◇','/store.html'],['MESSAGES','✦','/messages.html','messages'],['ALERTS','●','/notifications.html','alerts'],['SEARCH','⌕','/search.html'],['ME','◎','/profile.html']
];

let currentUser=null;
let channels=[];
let stateTimer=0;
let lastSavedRoute='';
const normalizedPath=()=>location.pathname.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';
const safeInternal=(value)=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//');

function showState(text){
  const node=document.querySelector('#rbShellState');
  if(!node)return;
  node.textContent=text;
  node.classList.add('is-visible');
  clearTimeout(stateTimer);
  stateTimer=setTimeout(()=>node.classList.remove('is-visible'),1800);
}

function mountStyles(){
  const styles=[
    ['/src/mobile-regression.css','mobile'],
    ['/src/app-shell.css','shell']
  ];
  styles.forEach(([href,key])=>{
    if(document.querySelector(`link[data-rb-${key}]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset[`rb${key[0].toUpperCase()}${key.slice(1)}`]='true';
    document.head.append(link);
  });
}

function mountDock(){
  if(document.querySelector('#rbGlobalShell'))return;
  const path=normalizedPath();
  const shell=document.createElement('div');
  shell.className='rb-global-shell';
  shell.id='rbGlobalShell';
  shell.innerHTML=`<nav class="rb-global-dock" aria-label="Rich Bizness app navigation">${ROUTES.map(([label,icon,href,badge])=>{
    const active=(href==='/'?path==='/':path===href.replace(/\/$/,''));
    return `<a class="rb-shell-link" href="${href}"${active?' aria-current="page"':''}><b>${icon}</b><span>${label}</span>${badge?`<i class="rb-shell-badge" id="rbBadge-${badge}" data-count="0">0</i>`:''}</a>`;
  }).join('')}</nav>`;
  const state=document.createElement('div');
  state.id='rbShellState';
  state.className='rb-shell-state';
  document.body.append(shell,state);
  shell.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest',inline:'center'});
  shell.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link)return;
    const href=link.getAttribute('href');
    if(!safeInternal(href)){event.preventDefault();return;}
    void saveRoute(href);
  });
}

function setBadge(name,count){
  const node=document.querySelector(`#rbBadge-${name}`);
  if(!node)return;
  const total=Math.max(0,Number(count)||0);
  node.dataset.count=String(total);
  node.textContent=total>99?'99+':String(total);
}

async function saveRoute(route){
  if(!supabase||!currentUser||!safeInternal(route)||route===lastSavedRoute)return;
  lastSavedRoute=route;
  const {error}=await supabase.from('profiles').update({last_route:route,last_seen_at:new Date().toISOString()}).eq('id',currentUser.id);
  if(error){
    lastSavedRoute='';
    console.warn('Rich route continuity update skipped:',error.message);
  }
}

async function loadBadges(){
  if(!supabase||!currentUser){setBadge('messages',0);setBadge('alerts',0);return;}
  const [{count:alerts},{data:members}]=await Promise.all([
    supabase.from('rich_notifications').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id).eq('is_read',false),
    supabase.from('dm_thread_members').select('thread_id,last_read_at').eq('user_id',currentUser.id).eq('status','active')
  ]);
  setBadge('alerts',alerts||0);
  const unread=await countUnreadThreads(members||[]);
  setBadge('messages',unread);
}

async function countUnreadThreads(members){
  if(!members.length)return 0;
  const ids=members.map(item=>item.thread_id);
  const {data:threads}=await supabase.from('dm_threads').select('id,last_message_at,last_message_user_id').in('id',ids);
  const reads=new Map(members.map(item=>[item.thread_id,item.last_read_at?new Date(item.last_read_at).getTime():0]));
  return (threads||[]).filter(item=>item.last_message_user_id!==currentUser.id&&new Date(item.last_message_at||0).getTime()>(reads.get(item.id)||0)).length;
}

function subscribe(){
  if(!supabase||!currentUser)return;
  channels=[
    supabase.channel(`rb-shell-alerts-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'rich_notifications',filter:`user_id=eq.${currentUser.id}`},loadBadges).subscribe(),
    supabase.channel(`rb-shell-members-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'dm_thread_members',filter:`user_id=eq.${currentUser.id}`},loadBadges).subscribe(),
    supabase.channel(`rb-shell-threads-${currentUser.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'dm_threads'},loadBadges).subscribe()
  ];
}

async function boot(){
  mountStyles();
  mountDock();
  if(!supabase){showState('SUPABASE ENV REQUIRED');return;}
  const {data}=await supabase.auth.getUser();
  currentUser=data?.user||null;
  if(currentUser){
    await saveRoute(normalizedPath());
    await loadBadges();
    subscribe();
  }
}

window.addEventListener('pagehide',()=>{
  channels.forEach(channel=>supabase?.removeChannel(channel));
  channels=[];
},{once:true});

boot();
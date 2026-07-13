import { supabase } from './supabase-client.js';
import { RB_CONFIG } from './config.js';

const T=RB_CONFIG.tables;
const $=(id)=>document.getElementById(id);
let user=null;
let channel=null;

const money=(cents,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase()}).format((Number(cents)||0)/100);
const text=(value,fallback='—')=>value===null||value===undefined||value===''?fallback:String(value);
const safe=(value)=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function status(message){$('creatorStatus').textContent=message;$('creatorFooter').textContent=message;}
function setChecked(id,value){$(id).checked=value!==false;}

async function loadIdentity(){
  const {data:profile}=await supabase.from(T.profiles).select('display_name,username,is_creator,is_artist,is_seller').eq('id',user.id).maybeSingle();
  $('creatorName').textContent=(profile?.display_name||profile?.username||'CREATOR COMMAND CENTER').toUpperCase();
  status(profile?.is_creator||profile?.is_artist||profile?.is_seller?'CREATOR ACTIVE':'CREATOR TOOLS READY');
}

async function loadLevel(){
  const {data}=await supabase.from(T.userLevels).select('level,xp_total,xp_current,xp_next,rank_title,rich_points,coins').eq('user_id',user.id).maybeSingle();
  $('levelValue').textContent=text(data?.level,'1');
  $('rankValue').textContent=text(data?.rank_title,'Rising Creator');
  $('xpValue').textContent=Number(data?.xp_total||0).toLocaleString();
  $('xpProgress').textContent=`${Number(data?.xp_current||0).toLocaleString()} / ${Number(data?.xp_next||100).toLocaleString()} XP TO NEXT LEVEL`;
}

async function loadBalance(){
  const {data}=await supabase.from(T.creatorBalances).select('earned_cents,pending_cents,paid_out_cents,available_cents,currency').eq('artist_user_id',user.id).maybeSingle();
  const currency=data?.currency||'USD';
  $('availableValue').textContent=money(data?.available_cents,currency);
  $('pendingValue').textContent=`${money(data?.pending_cents,currency)} pending`;
  $('earnedValue').textContent=money(data?.earned_cents,currency);
  $('pendingMoneyValue').textContent=money(data?.pending_cents,currency);
  $('paidValue').textContent=money(data?.paid_out_cents,currency);
  $('availableMoneyValue').textContent=money(data?.available_cents,currency);
}

async function loadSettings(){
  const {data}=await supabase.from(T.creatorPages).select('creator_title,creator_tagline,page_theme,intro_style,show_music,show_live,show_store,show_gallery,show_games,show_meta').eq('user_id',user.id).maybeSingle();
  $('titleInput').value=data?.creator_title||'';
  $('taglineInput').value=data?.creator_tagline||'';
  $('themeInput').value=data?.page_theme||'smoke-cloud';
  $('introInput').value=data?.intro_style||'cinematic';
  setChecked('showMusic',data?.show_music);setChecked('showLive',data?.show_live);setChecked('showStore',data?.show_store);setChecked('showGallery',data?.show_gallery);setChecked('showGames',data?.show_games);setChecked('showMeta',data?.show_meta);
  if(data?.creator_tagline)$('creatorTagline').textContent=data.creator_tagline;
}

async function loadLedger(){
  const {data=[]}=await supabase.from(T.userXpLedger).select('id,event_key,section,xp_amount,rich_points_amount,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(12);
  $('ledgerCount').textContent=String(data.length);
  $('ledgerList').innerHTML=data.length?data.map(item=>`<article class="ledger-item"><div><b>${safe(item.event_key||'CREATOR ACTIVITY')}</b><small>${safe(item.section||'global')} · ${new Date(item.created_at).toLocaleDateString()}</small></div><strong>+${Number(item.xp_amount||0)} XP</strong></article>`).join(''):'<p class="empty">No XP activity yet. Publish, stream, sell, and engage to build your rank.</p>';
}

async function loadBadges(){
  const {data=[]}=await supabase.from(T.userBadges).select('id,equipped,unlocked_at,badges(title,description,icon,rarity)').eq('user_id',user.id).order('unlocked_at',{ascending:false}).limit(12);
  const equipped=data.filter(item=>item.equipped).length;
  $('badgeValue').textContent=String(data.length);
  $('badgeCount').textContent=String(data.length);
  $('equippedValue').textContent=`${equipped} equipped`;
  $('badgeList').innerHTML=data.length?data.map(item=>`<article class="badge-item"><span class="icon">${safe(item.badges?.icon||'◆')}</span><div><b>${safe(item.badges?.title||'Rich Badge')}</b><small>${safe(item.badges?.rarity||'earned')}${item.equipped?' · EQUIPPED':''}</small></div></article>`).join(''):'<p class="empty">No badges unlocked yet.</p>';
}

async function countRows(table,column){
  const {count}=await supabase.from(table).select('*',{count:'exact',head:true}).eq(column,user.id);
  return count||0;
}

async function loadOutput(){
  const [music,products,live,games]=await Promise.all([
    countRows(T.musicTracks,'artist_user_id'),countRows(T.products,'seller_id'),countRows(T.liveStreams,'user_id'),countRows(T.gameClips,'user_id')
  ]);
  $('musicCount').textContent=music;$('productCount').textContent=products;$('liveCount').textContent=live;$('gameCount').textContent=games;
}

async function saveSettings(event){
  event.preventDefault();
  status('SAVING CREATOR PAGE');
  const payload={
    user_id:user.id,creator_title:$('titleInput').value.trim()||null,creator_tagline:$('taglineInput').value.trim()||null,page_theme:$('themeInput').value.trim()||'smoke-cloud',intro_style:$('introInput').value.trim()||'cinematic',
    show_music:$('showMusic').checked,show_live:$('showLive').checked,show_store:$('showStore').checked,show_gallery:$('showGallery').checked,show_games:$('showGames').checked,show_meta:$('showMeta').checked,updated_at:new Date().toISOString()
  };
  const {error}=await supabase.from(T.creatorPages).upsert(payload,{onConflict:'user_id'});
  if(error){status('SAVE FAILED');return;}
  if(payload.creator_tagline)$('creatorTagline').textContent=payload.creator_tagline;
  status('CREATOR PAGE SAVED');
}

function subscribe(){
  channel=supabase.channel(`creator-economy-${user.id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:T.userLevels,filter:`user_id=eq.${user.id}`},loadLevel)
    .on('postgres_changes',{event:'*',schema:'public',table:T.userXpLedger,filter:`user_id=eq.${user.id}`},loadLedger)
    .on('postgres_changes',{event:'*',schema:'public',table:T.creatorBalances,filter:`artist_user_id=eq.${user.id}`},loadBalance)
    .on('postgres_changes',{event:'*',schema:'public',table:T.userBadges,filter:`user_id=eq.${user.id}`},loadBadges)
    .subscribe();
}

async function boot(){
  if(!supabase){status('SUPABASE ENV REQUIRED');return;}
  const {data}=await supabase.auth.getUser();
  user=data?.user||null;
  if(!user){location.href=`${RB_CONFIG.routes.auth}?next=${encodeURIComponent('/creator.html')}`;return;}
  $('creatorForm').addEventListener('submit',saveSettings);
  await Promise.all([loadIdentity(),loadLevel(),loadBalance(),loadSettings(),loadLedger(),loadBadges(),loadOutput()]);
  subscribe();
}

window.addEventListener('pagehide',()=>{if(channel)supabase?.removeChannel(channel);},{once:true});
boot();
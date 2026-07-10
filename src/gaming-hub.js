import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity } from './rb-identity.js?v=profile-avatar-separate-1';

const $=s=>document.querySelector(s), fmt=n=>Number(n||0).toLocaleString();
const iconFor=t=>({strategy:'♛',racing:'🏎️',sports:'🏆',fighting:'🥊',simulation:'🌐',party:'🎉',arcade:'🎮',rpg:'⚔️',shooter:'🎯'})[t]||'🎮';
let allGames=[], filtered=[], activeCategory='all', search='';

function playUrl(g){
  if(g?.play_url && !g.play_url.startsWith('/games/?game=')) return g.play_url;
  return `/games/${g.slug}/`;
}
function renderFeatured(){
  const g=allGames.find(x=>x.slug==='rich-chess')||allGames.find(x=>x.is_featured)||allGames[0];
  if(!g)return;
  $('#featureIcon').textContent=iconFor(g.game_type);
  $('#featureType').textContent=(g.game_type||'game').toUpperCase();
  $('#featureTitle').textContent=g.title||'Rich Bizness Game';
  $('#featureDesc').textContent=g.description||'Premium Rich Bizness gameplay experience.';
  $('#featurePlay').href=playUrl(g);
}
function renderCategories(){
  const counts=allGames.reduce((m,g)=>{const k=g.category?.slug||g.game_type||'other';m[k]=(m[k]||0)+1;return m},{});
  const items=[['all',allGames.length],...Object.entries(counts)];
  $('#categories').innerHTML=items.map(([k,n])=>`<button class="${activeCategory===k?'active':''}" data-cat="${k}">${k==='all'?'ALL GAMES':k.replaceAll('-',' ').toUpperCase()} <small>${n}</small></button>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;applyFilters();renderCategories()});
}
function applyFilters(){
  filtered=allGames.filter(g=>{
    const cat=g.category?.slug||g.game_type||'other';
    const text=`${g.title||''} ${g.description||''} ${g.slug||''} ${g.game_type||''}`.toLowerCase();
    return (activeCategory==='all'||cat===activeCategory)&&(!search||text.includes(search));
  });
  renderGames();
}
function renderGames(){
  const root=$('#gameGrid');
  $('#gameCount').textContent=`${filtered.length} AVAILABLE`;
  root.innerHTML=filtered.length?filtered.map(g=>{
    const cover=g.cover_url||g.thumbnail_url||g.logo_url||'';
    const url=playUrl(g);
    return `<article class="game-card"><div class="game-cover">${cover?`<img src="${cover}" alt="${g.title||''}">`:`<span>${iconFor(g.game_type)}</span>`}<span class="game-tag">${(g.game_type||'game').toUpperCase()}</span></div><div class="game-body"><h3>${g.title||'Rich Game'}</h3><p>${g.description||'A Rich Bizness Universe game experience.'}</p><div class="game-meta"><span>${fmt(g.total_plays)} PLAYS</span><span>${fmt(g.active_players)} ACTIVE</span><span>${g.is_tournament_enabled?'TOURNAMENT':'CASUAL'}</span></div><div class="game-actions"><a href="${url}">PLAY NOW</a><button data-fav="${g.id}" aria-label="Favorite ${g.title}">＋</button></div></div></article>`
  }).join(''):'<div class="empty">No games match this filter yet.</div>';
}
function renderLeaderboard(rows=[]){
  $('#leaderboard').innerHTML=rows.length?rows.map((r,i)=>`<div class="leader-row"><b>#${i+1}</b><span><strong>${r.display_name||r.username||'Rich Player'}</strong><small>${r.game_slug||r.mode||'gaming'}</small></span><b>${fmt(r.score)}</b></div>`).join(''):'<div class="empty">Leaderboard opens as scores come in.</div>';
}
function renderRecent(rows=[]){
  $('#recentGames').innerHTML=rows.length?rows.map(r=>`<div class="recent-row"><b>${iconFor(r.game_type)}</b><span><strong>${r.title||'Rich Game'}</strong><small>${r.game_type||'arcade'}</small></span><a href="${playUrl(r)}">PLAY</a></div>`).join(''):'<div class="empty">New games will appear here.</div>';
}
async function load(){
  const {data,error}=await supabase.from('games').select('*,category:game_categories(slug,title)').or('is_active.is.true,is_active.is.null').order('is_featured',{ascending:false}).order('updated_at',{ascending:false}).limit(120);
  if(error){$('#gameGrid').innerHTML=`<div class="empty">${error.message}</div>`;return}
  allGames=data||[];filtered=[...allGames];
  $('#totalGames').textContent=fmt(allGames.length);
  $('#featuredGames').textContent=fmt(allGames.filter(g=>g.is_featured).length);
  $('#activePlayers').textContent=fmt(allGames.reduce((n,g)=>n+Number(g.active_players||0),0));
  renderFeatured();renderCategories();renderGames();renderRecent(allGames.slice(0,6));
  const {data:scores}=await supabase.from('game_scores').select('display_name,username,score,game_slug,mode').order('score',{ascending:false}).limit(8);
  renderLeaderboard(scores||[]);
  const identity=await getAuthoritativeIdentity().catch(()=>({}));
  const p=identity.profile||{};
  $('#hubPlayer').textContent=p.display_name||p.username||'GUEST PLAYER';
  $('#hubPoints').textContent=fmt(p.rich_points||0);
}

$('#gameSearch').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();applyFilters()});
$('#refreshGames').addEventListener('click',load);
load();
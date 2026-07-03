import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js';

let games = [];
let user = null;
const fmt = (n) => Number(n || 0).toLocaleString();

function addCss(){ if(document.getElementById('gameRoomCss')) return; const l=document.createElement('link'); l.id='gameRoomCss'; l.rel='stylesheet'; l.href='/src/game-room.css?v=game-room-1'; document.head.appendChild(l); }
function mount(){ if(document.getElementById('gameRoom')) return; const r=document.createElement('section'); r.id='gameRoom'; r.className='game-room'; r.innerHTML='<div class="game-room-head"><div><small>GAME ROOM</small><b>RICH BIZNESS ARCADE</b></div><small id="gameStatus">READY</small></div><div class="game-board"><div class="game-player">RB</div></div><div class="game-actions"><button id="joinGameRoom" type="button">JOIN ROOM</button><button id="playGameMove" type="button">PLAY MOVE</button><a href="/watch.html">STREAM TV</a><a href="/meta.html">FREE ROAM</a></div><div class="game-list" id="gameList"></div>'; document.querySelector('main')?.appendChild(r); document.getElementById('joinGameRoom')?.addEventListener('click', joinRoom); document.getElementById('playGameMove')?.addEventListener('click', playMove); }
function render(){ const list=document.getElementById('gameList'); if(!list) return; list.innerHTML=games.length?games.map(g=>`<article class="game-tile"><b>${g.title}</b><small>${g.game_type||'arcade'} • ${fmt(g.total_plays)} plays</small></article>`).join(''):'<article class="game-tile"><b>No games yet</b><small>game_categories are seeded; add games and they show here.</small></article>'; }
async function load(){ const { data } = await supabase.from('games').select('id,slug,title,game_type,total_plays,active_players,is_featured').order('created_at',{ascending:false}).limit(12); games=data||[]; render(); }
async function getUser(){ const { data }=await supabase.auth.getUser(); user=data?.user||null; return user; }
async function joinRoom(){ await getUser(); if(!user){ location.href='/auth.html'; return; } const game=games[0]; await awardXp('game_room_join',{section:'gaming',sourceTable:game?'games':null,sourceId:game?.id||null}); document.getElementById('gameStatus').textContent='ROOM JOINED'; }
async function playMove(){ await getUser(); if(!user){ location.href='/auth.html'; return; } const game=games[0]; if(game){ await supabase.from('game_sessions').insert({game_id:game.id,game_slug:game.slug,user_id:user.id,score:1,result:'move'}); } await awardXp('game_move',{section:'gaming',sourceTable:game?'games':null,sourceId:game?.id||null}); document.getElementById('gameStatus').textContent='MOVE SAVED'; }
addCss(); mount(); load(); supabase.channel('game-room-ui').on('postgres_changes',{event:'*',schema:'public',table:'games'},load).subscribe();

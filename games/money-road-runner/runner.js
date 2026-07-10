import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';
import { awardXp } from '../../src/rb-xp.js?v=xp-idempotent-1';

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d',{alpha:false});
const dpr=Math.min(window.devicePixelRatio||1,2);
const state={running:false,paused:false,over:false,score:0,cash:0,distance:0,lives:3,combo:0,speed:7,shield:0,magnet:0,boost:0,frame:0,last:0,items:[],particles:[],identity:null,game:null};
const player={x:150,y:0,w:54,h:72,vy:0,lane:1};
const $=id=>document.getElementById(id);
const set=(id,v)=>{const n=$(id);if(n)n.textContent=v};
const rand=(a,b)=>a+Math.random()*(b-a);

function resize(){
  const rect=canvas.getBoundingClientRect();
  canvas.width=Math.max(640,Math.floor(rect.width*dpr));
  canvas.height=Math.max(360,Math.floor(rect.width*9/16*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function ground(){return canvas.clientHeight*.76}
function laneY(lane){return ground()-84+(lane-1)*32}

function reset(){
  Object.assign(state,{running:false,paused:false,over:false,score:0,cash:0,distance:0,lives:3,combo:0,speed:7,shield:0,magnet:0,boost:0,frame:0,items:[],particles:[]});
  Object.assign(player,{x:canvas.clientWidth*.14,y:laneY(1),vy:0,lane:1});
  syncHud();draw();showOverlay('MONEY ROAD RUNNER','Collect cash, dodge tax blocks, and reach the Rich Treehouse.','START RUN');
}

function start(){state.running=true;state.paused=false;state.over=false;state.last=performance.now();hideOverlay();requestAnimationFrame(loop)}
function togglePause(){if(state.over)return;state.paused=!state.paused;set('pauseLabel',state.paused?'RESUME':'PAUSE');if(!state.paused){state.last=performance.now();requestAnimationFrame(loop)}}

function spawn(){
  const roll=Math.random();
  let type='cash';
  if(roll<.24)type='tax';else if(roll<.32)type='shield';else if(roll<.39)type='magnet';else if(roll<.46)type='boost';
  state.items.push({type,x:canvas.clientWidth+80,y:laneY(Math.floor(rand(0,3))),w:type==='tax'?54:38,h:type==='tax'?58:38,done:false,bob:rand(0,6.28)});
}

function act(action){
  if(!state.running&&!state.over){start();return}
  if(action==='jump'&&player.y>=laneY(player.lane)-1)player.vy=-15.5;
  if(action==='left')player.x=Math.max(28,player.x-42);
  if(action==='right')player.x=Math.min(canvas.clientWidth-player.w-28,player.x+42);
}

function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function burst(x,y,text){for(let i=0;i<12;i++)state.particles.push({x,y,vx:rand(-2.8,2.8),vy:rand(-4,-1),life:1,text:i===0?text:''})}

function update(dt){
  state.frame++;
  state.distance+=dt*.06*(state.boost>0?1.8:1);
  state.speed=Math.min(16,7+state.distance/700);
  state.score+=Math.floor(dt*.08*(1+state.combo*.05));
  if(state.frame%Math.max(42,Math.floor(84-state.speed*2))===0)spawn();
  player.vy+=.85;player.y+=player.vy;
  const floor=laneY(player.lane);if(player.y>floor){player.y=floor;player.vy=0}
  if(state.shield>0)state.shield-=dt;if(state.magnet>0)state.magnet-=dt;if(state.boost>0)state.boost-=dt;
  for(const it of state.items){
    it.x-=state.speed*(state.boost>0?1.35:1);
    it.bob+=.06;it.y+=Math.sin(it.bob)*.18;
    if(state.magnet>0&&it.type==='cash'&&Math.abs(it.x-player.x)<220){it.x+=(player.x-it.x)*.08;it.y+=(player.y-it.y)*.08}
    if(!it.done&&hit(player,it))collect(it);
  }
  state.items=state.items.filter(i=>i.x>-100&&!i.done);
  for(const p of state.particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.14;p.life-=.025}
  state.particles=state.particles.filter(p=>p.life>0);
  syncHud();
}

function collect(it){
  it.done=true;
  if(it.type==='cash'){state.cash+=100;state.combo++;state.score+=500+state.combo*40;burst(it.x,it.y,'+$100')}
  if(it.type==='tax'){
    if(state.shield>0){state.shield=0;state.score+=150;burst(it.x,it.y,'SHIELD')}
    else{state.lives--;state.combo=0;state.score=Math.max(0,state.score-350);burst(it.x,it.y,'-1 LIFE');if(state.lives<=0)gameOver()}
  }
  if(it.type==='shield'){state.shield=7000;state.score+=250;burst(it.x,it.y,'SHIELD')}
  if(it.type==='magnet'){state.magnet=7000;state.score+=250;burst(it.x,it.y,'MAGNET')}
  if(it.type==='boost'){state.boost=5000;state.score+=350;burst(it.x,it.y,'BOOST')}
}

function loop(now){
  if(!state.running||state.paused)return;
  const dt=Math.min(34,now-state.last||16.7);state.last=now;
  update(dt);draw();
  if(state.running)requestAnimationFrame(loop);
}

function draw(){
  const w=canvas.clientWidth,h=canvas.clientHeight,g=ground();
  ctx.clearRect(0,0,w,h);
  const sky=ctx.createLinearGradient(0,0,0,g);sky.addColorStop(0,'#0f3519');sky.addColorStop(1,'#07110a');ctx.fillStyle=sky;ctx.fillRect(0,0,w,g);
  ctx.fillStyle='#071007';for(let i=0;i<8;i++){const x=((i*210-state.distance*.6)%(w+300))-120;ctx.fillRect(x,g-180,90,180)}
  ctx.fillStyle='#372816';ctx.fillRect(0,g,w,h-g);
  ctx.fillStyle='#9dff63';for(let i=0;i<14;i++)ctx.fillRect(((i*110-state.distance*2.2)%(w+140))-70,g+55,58,7);
  ctx.globalAlpha=.18;ctx.fillStyle='#ffe58a';ctx.fillRect(0,g-2,w,4);ctx.globalAlpha=1;
  ctx.font='48px system-ui';ctx.fillText(state.shield>0?'🛡️':'🏃',player.x,player.y+54);
  for(const it of state.items){ctx.font=it.type==='tax'?'48px system-ui':'38px system-ui';ctx.fillText(({cash:'💵',tax:'🧱',shield:'🛡️',magnet:'🧲',boost:'⚡'})[it.type],it.x,it.y+40)}
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle='#ffe58a';ctx.font='bold 16px system-ui';if(p.text)ctx.fillText(p.text,p.x,p.y);else{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;
  if(state.boost>0){ctx.globalAlpha=.12;ctx.fillStyle='#9dff63';for(let i=0;i<20;i++)ctx.fillRect(rand(0,w),rand(0,h),rand(30,120),2);ctx.globalAlpha=1}
}

function syncHud(){set('score',state.score.toLocaleString());set('cash',`$${state.cash.toLocaleString()}`);set('distance',Math.floor(state.distance));set('lives',state.lives);set('combo',`x${state.combo}`);set('speed',state.speed.toFixed(1));set('powerState',state.shield>0?'Shield':state.magnet>0?'Magnet':state.boost>0?'Boost':'None')}
function showOverlay(title,text,button){$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('overlayButton').textContent=button;$('overlay').classList.remove('hidden')}
function hideOverlay(){$('overlay').classList.add('hidden')}

async function gameOver(){
  state.running=false;state.over=true;
  showOverlay('RUN OVER',`Score ${state.score.toLocaleString()} • Cash $${state.cash.toLocaleString()}`,'RUN AGAIN');
  await saveScore();
}

async function loadIdentity(){state.identity=await getAuthoritativeIdentity().catch(()=>({}));const {data}=await supabase.from('games').select('id').eq('slug','money-road-runner').maybeSingle();state.game=data||null;await loadLeaderboard()}
async function saveScore(){
  const user=state.identity?.user;if(!user||!state.game)return;
  const profile=state.identity.profile||{};
  await supabase.from('game_sessions').insert({game_id:state.game.id,game_slug:'money-road-runner',user_id:user.id,username:profile.username||null,display_name:profile.display_name||null,ended_at:new Date().toISOString(),duration_seconds:Math.max(1,Math.round(state.distance/6)),result:'completed',score:state.score,platform_type:'web',metadata:{cash:state.cash,distance:Math.floor(state.distance),lives:state.lives,combo:state.combo,source:'games/money-road-runner'}});
  await supabase.from('game_scores').insert({game_id:state.game.id,game_slug:'money-road-runner',user_id:user.id,username:profile.username||null,display_name:profile.display_name||null,score:state.score,mode:'runner',platform_type:'web',is_verified:true,anti_cheat_status:'verified',metadata:{cash:state.cash,distance:Math.floor(state.distance)}});
  await awardXp('game_score_submit',{section:'gaming',sourceTable:'games',sourceId:state.game.id}).catch(()=>{});
  await loadLeaderboard();
}
async function loadLeaderboard(){const {data}=await supabase.from('game_scores').select('display_name,username,score').eq('game_slug','money-road-runner').eq('is_verified',true).order('score',{ascending:false}).limit(5);$('leaderboard').innerHTML=(data||[]).map((r,i)=>`<div><b>#${i+1} ${r.display_name||r.username||'Runner'}</b><span>${Number(r.score||0).toLocaleString()}</span></div>`).join('')||'<small>No scores yet.</small>'}

$('overlayButton').onclick=()=>{reset();start()};$('restart').onclick=()=>{reset();start()};$('pause').onclick=togglePause;document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));
addEventListener('keydown',e=>{if(e.key==='ArrowLeft')act('left');if(e.key==='ArrowRight')act('right');if(e.key==='ArrowUp'||e.key===' ')act('jump');if(e.key.toLowerCase()==='p')togglePause()});
addEventListener('resize',()=>{resize();draw()});
resize();await loadIdentity();reset();
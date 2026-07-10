import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d',{alpha:false});
const $=id=>document.getElementById(id);
const state={running:false,paused:false,frame:0,score:0,cash:0,heat:0,health:100,fuel:100,packages:0,combo:1,speed:5,distance:0,boost:100,carSkin:'emerald',player:null,entities:[],particles:[],identity:{},game:null,sessionStartedAt:0};
const keys=new Set();

function resize(){const ratio=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;canvas.width=Math.max(640,Math.floor(w*ratio));canvas.height=Math.max(360,Math.floor(h*ratio));ctx.setTransform(ratio,0,0,ratio,0,0)}
addEventListener('resize',resize);

function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1700)}
function syncHUD(){
  $('score').textContent=Math.floor(state.score).toLocaleString();
  $('cash').textContent=`$${Math.floor(state.cash).toLocaleString()}`;
  $('heat').textContent=Math.floor(state.heat);
  $('packages').textContent=state.packages;
  $('health').textContent=Math.max(0,Math.floor(state.health));
  $('boost').textContent=Math.floor(state.boost);
  $('missionProgress').style.width=`${Math.min(100,state.packages*20)}%`;
  $('statusChip').textContent=state.paused?'PAUSED':state.running?'HUSTLE ACTIVE':'READY';
}
function reset(){
  state.running=true;state.paused=false;state.frame=0;state.score=0;state.cash=0;state.heat=0;state.health=100;state.fuel=100;state.packages=0;state.combo=1;state.speed=5;state.distance=0;state.boost=100;state.entities=[];state.particles=[];state.sessionStartedAt=Date.now();
  state.player={x:0.5,y:0.78,w:0.055,h:0.12,vx:0,vy:0};
  syncHUD();toast('Hustle started');
}
function spawn(){
  const roll=Math.random();
  let type='package';
  if(roll<.24)type='cop'; else if(roll<.39)type='roadblock'; else if(roll<.49)type='cash'; else if(roll<.57)type='repair'; else if(roll<.64)type='boost';
  state.entities.push({type,x:.18+Math.random()*.64,y:-.15,w:type==='roadblock'?.12:.06,h:type==='roadblock'?.07:.09,speed:.0035+Math.random()*.0025,drift:(Math.random()-.5)*.0009,hit:false});
}
function collide(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2}
function burst(x,y,label){for(let i=0;i<18;i++)state.particles.push({x,y,vx:(Math.random()-.5)*.012,vy:(Math.random()-.5)*.012,life:28+Math.random()*20,label:i===0?label:''})}
function handleEntity(e){
  if(e.hit)return;e.hit=true;
  if(e.type==='package'){state.packages++;state.cash+=250*state.combo;state.score+=1200*state.combo;state.combo=Math.min(8,state.combo+1);state.heat=Math.min(100,state.heat+6);burst(e.x,e.y,'PACKAGE')}
  if(e.type==='cash'){state.cash+=100;state.score+=400;burst(e.x,e.y,'CASH')}
  if(e.type==='repair'){state.health=Math.min(100,state.health+25);burst(e.x,e.y,'REPAIR')}
  if(e.type==='boost'){state.boost=Math.min(100,state.boost+35);burst(e.x,e.y,'BOOST')}
  if(e.type==='cop'||e.type==='roadblock'){state.health-=e.type==='cop'?18:28;state.heat=Math.min(100,state.heat+15);state.combo=1;burst(e.x,e.y,'HIT');if(state.health<=0)endGame('busted')}
}
function controls(){
  const p=state.player,boosting=keys.has('Shift')&&state.boost>0;
  if(keys.has('ArrowLeft')||keys.has('a'))p.vx-=.00075;
  if(keys.has('ArrowRight')||keys.has('d'))p.vx+=.00075;
  if(keys.has('ArrowUp')||keys.has('w'))state.speed=Math.min(14,state.speed+.035);
  if(keys.has('ArrowDown')||keys.has('s'))state.speed=Math.max(2,state.speed-.08);
  if(boosting){state.speed=Math.min(18,state.speed+.18);state.boost=Math.max(0,state.boost-.6);state.score+=4}else state.boost=Math.min(100,state.boost+.08);
  p.vx*=.9;p.x+=p.vx;p.x=Math.max(.2,Math.min(.8,p.x));
}
function update(){
  if(!state.running||state.paused)return;
  state.frame++;controls();state.distance+=state.speed*.03;state.score+=state.speed*.28;state.heat=Math.max(0,state.heat-.01);state.fuel=Math.max(0,state.fuel-.004*state.speed);
  if(state.frame%(Math.max(28,80-Math.floor(state.speed*3)))===0)spawn();
  for(const e of state.entities){e.y+=e.speed+state.speed*.00055;e.x+=e.drift;if(e.type==='cop')e.x+=(state.player.x-e.x)*.004;if(collide(state.player,e))handleEntity(e)}
  state.entities=state.entities.filter(e=>e.y<1.2&&!e.hit);
  for(const p of state.particles){p.x+=p.vx;p.y+=p.vy;p.life--}
  state.particles=state.particles.filter(p=>p.life>0);
  if(state.packages>=5&&!state.missionDone){state.missionDone=true;state.cash+=2500;state.score+=10000;toast('Mission complete +$2,500')}
  syncHUD();
}
function drawRoad(w,h){
  const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#132116');grad.addColorStop(1,'#050805');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#1c241f';ctx.fillRect(w*.15,0,w*.7,h);
  ctx.fillStyle='#070a08';ctx.fillRect(0,0,w*.15,h);ctx.fillRect(w*.85,0,w*.15,h);
  ctx.strokeStyle='#ffe58a';ctx.lineWidth=4;ctx.setLineDash([28,26]);const offset=(state.distance*8)%54;for(const x of [.383,.617]){ctx.beginPath();ctx.moveTo(w*x,-54+offset);ctx.lineTo(w*x,h+54);ctx.stroke()}ctx.setLineDash([]);
  ctx.fillStyle='rgba(157,255,99,.22)';for(let i=0;i<12;i++){const y=((i*100+state.distance*9)%(h+120))-60;ctx.fillRect(w*.13,y,8,42);ctx.fillRect(w*.86,y,8,42)}
}
function drawCar(x,y,skin='emerald',police=false){const palette={emerald:'#22c55e',gold:'#facc15',onyx:'#111827'};ctx.save();ctx.translate(x,y);ctx.shadowBlur=18;ctx.shadowColor=police?'#3b82f6':palette[skin]||palette.emerald;ctx.fillStyle=police?'#e5e7eb':palette[skin]||palette.emerald;ctx.fillRect(-18,-32,36,64);ctx.fillStyle='#020402';ctx.fillRect(-13,-21,26,18);ctx.fillRect(-13,7,26,15);if(police){ctx.fillStyle='#ef4444';ctx.fillRect(-14,-36,12,5);ctx.fillStyle='#3b82f6';ctx.fillRect(2,-36,12,5)}ctx.restore()}
function draw(){
  const w=canvas.clientWidth,h=canvas.clientHeight;drawRoad(w,h);
  for(const e of state.entities){const x=e.x*w,y=e.y*h;if(e.type==='cop')drawCar(x,y,'onyx',true);else if(e.type==='roadblock'){ctx.fillStyle='#7f1d1d';ctx.fillRect(x-w*.06,y-16,w*.12,32);ctx.fillStyle='#facc15';ctx.fillRect(x-w*.06,y-4,w*.12,8)}else{ctx.font=`${Math.max(24,w*.035)}px system-ui`;ctx.textAlign='center';ctx.fillText(e.type==='package'?'📦':e.type==='cash'?'💵':e.type==='repair'?'🛠️':'⚡',x,y)}}
  drawCar(state.player.x*w,state.player.y*h,state.carSkin,false);
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/48);ctx.fillStyle=p.label?'#ffe58a':'#9dff63';ctx.font='bold 13px system-ui';ctx.fillText(p.label||'•',p.x*w,p.y*h)}ctx.globalAlpha=1;
  if(!state.running||state.paused){ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#ffe58a';ctx.font=`900 ${Math.max(34,w*.055)}px system-ui`;ctx.fillText(state.paused?'PAUSED':'BUSTED',w/2,h*.46);ctx.fillStyle='#fff';ctx.font='700 18px system-ui';ctx.fillText(state.paused?'Press P to continue':'Start a new hustle',w/2,h*.54)}ctx.textAlign='start';
}
function frame(){update();draw();requestAnimationFrame(frame)}
async function loadIdentity(){state.identity=await getAuthoritativeIdentity().catch(()=>({}));const p=state.identity.profile||{};$('playerName').textContent=p.display_name||p.username||'Rich Driver';const {data}=await supabase.from('games').select('id,slug,title').eq('slug','smoke-city-hustle').maybeSingle();state.game=data||null;loadLeaderboard()}
async function saveScore(result='completed'){
  if(!state.identity.user){location.href='/auth.html?next='+encodeURIComponent(location.pathname);return}
  const profile=state.identity.profile||{},duration=Math.floor((Date.now()-state.sessionStartedAt)/1000),meta={cash:state.cash,packages:state.packages,heat:state.heat,distance:state.distance,car_skin:state.carSkin};
  await supabase.from('game_sessions').insert({game_id:state.game?.id||null,game_slug:'smoke-city-hustle',user_id:state.identity.user.id,username:profile.username||null,display_name:profile.display_name||null,duration_seconds:duration,result,score:Math.floor(state.score),platform_type:'web',metadata:meta});
  await supabase.from('game_scores').insert({game_id:state.game?.id||null,game_slug:'smoke-city-hustle',user_id:state.identity.user.id,username:profile.username||null,display_name:profile.display_name||null,score:Math.floor(state.score),mode:'hustle',platform_type:'web',is_verified:true,anti_cheat_status:'verified',metadata:meta});
  await supabase.rpc('rb_award_xp',{p_user_id:state.identity.user.id,p_event_key:'game_play',p_source_table:'game_scores',p_source_id:null,p_metadata:{game_slug:'smoke-city-hustle',score:Math.floor(state.score)}}).catch(()=>{});
  toast('Score saved');loadLeaderboard();
}
async function loadLeaderboard(){const {data}=await supabase.from('game_scores').select('display_name,username,score').eq('game_slug','smoke-city-hustle').order('score',{ascending:false}).limit(5);$('leaderboard').innerHTML=(data||[]).map((r,i)=>`<div><span>#${i+1} ${r.display_name||r.username||'Driver'}</span><b>${Number(r.score||0).toLocaleString()}</b></div>`).join('')||'<div><span>No scores yet</span><b>—</b></div>'}
async function endGame(result){if(!state.running)return;state.running=false;syncHUD();await saveScore(result)}
function action(name){if(name==='left')keys.add('ArrowLeft');if(name==='right')keys.add('ArrowRight');if(name==='gas')keys.add('ArrowUp');if(name==='brake')keys.add('ArrowDown');if(name==='boost')keys.add('Shift');setTimeout(()=>keys.clear(),160)}
addEventListener('keydown',e=>{keys.add(e.key);if(e.key.toLowerCase()==='p'){state.paused=!state.paused;syncHUD()}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault()},{passive:false});addEventListener('keyup',e=>keys.delete(e.key));
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',()=>action(b.dataset.action)));
document.querySelectorAll('[data-skin]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-skin]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.carSkin=b.dataset.skin;toast(`${b.textContent.trim()} equipped`)}));
$('restart').onclick=reset;$('pause').onclick=()=>{state.paused=!state.paused;syncHUD()};$('saveScore').onclick=()=>saveScore('manual_save');
resize();await loadIdentity();reset();frame();
import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';
import { awardXp } from '../../src/rb-xp.js?v=xp-idempotent-1';
import { getGameConfig, slugFromLocation } from './catalog.js';

const slug = slugFromLocation();
const config = getGameConfig(slug);
const state = { score:0, progress:0, combo:0, lives:3, startedAt:Date.now(), complete:false, user:null, profile:null, game:null };
const $ = (id) => document.getElementById(id);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

function setText(id,value){ const el=$(id); if(el) el.textContent=value; }
function render(){
  setText('gameTitle',config.title); setText('gameType',config.type.toUpperCase()); setText('gameObjective',config.objective);
  setText('gameScore',state.score.toLocaleString()); setText('gameProgress',`${state.progress}/${config.target}`); setText('gameLives',state.lives);
  const bar=$('progressBar'); if(bar) bar.style.width=`${clamp(state.progress/config.target*100,0,100)}%`;
  const avatar=$('gameAvatar'); if(avatar) avatar.textContent=iconFor(config.mechanic);
  document.title=`${config.title} • Rich Bizness`;
}
function iconFor(m){ return ({roam:'🧍',rhythm:'🎛️',party:'🎉',duel:'🥊',catch:'💸',batting:'⚾',lane:'📻',builder:'🏙️',golf:'⛳',reps:'🏋️',market:'📈',race:'🏎️',dash:'🌀',rooms:'🚪',chess:'♟️',basketball:'🏀',runner:'🏃',arena:'💨',drift:'🏁',cards:'🃏',tap:'☁️',ride:'🌳',vault:'🔐'})[m]||'RB'; }
function status(message){ setText('gameStatus',message); }
function pulse(control){ const avatar=$('gameAvatar'); if(!avatar) return; const x=(Math.random()*90)-45, y=(Math.random()*70)-35; avatar.style.transform=`translate(${x}px,${y}px) rotate(${(Math.random()*18)-9}deg) scale(${1+Math.random()*.12})`; setTimeout(()=>avatar.style.transform='',180); status(`${control.toUpperCase()} • COMBO ${state.combo}`); }

function applyMove(control){
  if(state.complete) return;
  state.combo += 1;
  let gain=config.step;
  if(['rhythm','tap','reps'].includes(config.mechanic) && state.combo%4===0) gain*=2;
  if(['race','drift','ride'].includes(config.mechanic) && control==='boost') gain=Math.round(gain*1.8);
  if(['duel','arena'].includes(config.mechanic) && control==='finisher') gain=Math.round(gain*1.5);
  if(config.mechanic==='market' && control==='sell') gain=Math.round(gain*1.4);
  if(config.mechanic==='vault' && control!=='confirm') gain=0;
  state.progress=clamp(state.progress+gain,0,config.target);
  state.score += Math.max(25,gain*100) + state.combo*5;
  if(state.progress>=config.target){ state.complete=true; state.score+=1000; status('MISSION COMPLETE • SUBMIT SCORE'); }
  pulse(control); render();
}

async function loadIdentity(){ const identity=await getAuthoritativeIdentity().catch(()=>({})); state.user=identity.user||null; state.profile=identity.profile||null; }
async function loadGame(){ const {data}=await supabase.from('games').select('*').eq('slug',slug).maybeSingle(); state.game=data||null; }
async function submitScore(){
  if(!state.user){ location.href=`/auth.html?next=${encodeURIComponent(location.pathname)}`; return; }
  if(!state.game){ status('GAME REGISTRY NOT FOUND'); return; }
  const duration=Math.max(1,Math.round((Date.now()-state.startedAt)/1000));
  const payload={game_id:state.game.id,game_slug:slug,user_id:state.user.id,username:state.profile?.username||null,display_name:state.profile?.display_name||null,score:state.score,mode:config.mechanic,platform_type:'web',is_verified:true,anti_cheat_status:'verified',metadata:{source:'games/shared/runtime',progress:state.progress,target:config.target,duration_seconds:duration,completed:state.complete}};
  const {error}=await supabase.from('game_scores').insert(payload);
  if(error){ status(error.message); return; }
  await supabase.from('game_sessions').insert({game_id:state.game.id,game_slug:slug,user_id:state.user.id,username:state.profile?.username||null,display_name:state.profile?.display_name||null,started_at:new Date(state.startedAt).toISOString(),ended_at:new Date().toISOString(),duration_seconds:duration,result:state.complete?'completed':'submitted',score:state.score,platform_type:'web',metadata:{source:'games/shared/runtime',mechanic:config.mechanic}});
  await awardXp('game_score_submit',{section:'gaming',sourceTable:'games',sourceId:state.game.id}).catch(()=>{});
  status('SCORE SAVED');
}
function reset(){ Object.assign(state,{score:0,progress:0,combo:0,lives:3,startedAt:Date.now(),complete:false}); status('READY'); render(); }
function mountControls(){ const root=$('gameControls'); if(!root) return; root.innerHTML=config.controls.map((control,index)=>`<button type="button" data-control="${control}" ${index===0?'class="primary"':''}>${control}</button>`).join(''); root.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>applyMove(btn.dataset.control))); $('submitScore')?.addEventListener('click',submitScore); $('resetGame')?.addEventListener('click',reset); }

await Promise.all([loadIdentity(),loadGame()]); mountControls(); render(); status(state.user?'SIGNED IN • READY':'GUEST MODE • SIGN IN TO SAVE');

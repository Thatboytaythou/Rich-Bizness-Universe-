import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

const pieces={r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔',P:'♙'};
const start=['rnbqkbnr','pppppppp','........','........','........','........','PPPPPPPP','RNBQKBNR'];
let board=start.map(r=>r.split('')),turn='white',selected=null,history=[],flipped=false,mode='casual',cpuElo=2500,room=null,clock=600,timer=null,identity={};
const el=id=>document.getElementById(id);
const colorOf=p=>p==='.'?null:(p===p.toUpperCase()?'white':'black');
const fmt=n=>Number(n||0).toLocaleString();
const setText=(id,value)=>{const node=el(id);if(node)node.textContent=value};

function legal(from,to){
  const [fr,fc]=from,[tr,tc]=to,p=board[fr][fc];
  if(!p||p==='.'||colorOf(p)!==turn||colorOf(board[tr][tc])===turn)return false;
  const dr=tr-fr,dc=tc-fc,a=p.toLowerCase();
  if(a==='p'){
    const dir=turn==='white'?-1:1,startRow=turn==='white'?6:1;
    if(dc===0&&board[tr][tc]==='.'&&(dr===dir||(fr===startRow&&dr===2*dir&&board[fr+dir][fc]==='.')))return true;
    if(Math.abs(dc)===1&&dr===dir&&board[tr][tc]!=='.')return true;
    return false;
  }
  if(a==='n')return Math.abs(dr)*Math.abs(dc)===2;
  if(a==='k')return Math.max(Math.abs(dr),Math.abs(dc))===1;
  if(a==='r'&&!(dr===0||dc===0))return false;
  if(a==='b'&&Math.abs(dr)!==Math.abs(dc))return false;
  if(a==='q'&&!(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)))return false;
  if(['r','b','q'].includes(a)){
    const sr=Math.sign(dr),sc=Math.sign(dc);
    for(let r=fr+sr,c=fc+sc;r!==tr||c!==tc;r+=sr,c+=sc)if(board[r][c]!=='.')return false;
    return true;
  }
  return false;
}

function draw(){
  const root=el('board');
  if(!root)return;
  root.innerHTML='';
  const rows=[...Array(8).keys()],cols=[...Array(8).keys()];
  if(flipped){rows.reverse();cols.reverse()}
  for(const r of rows)for(const c of cols){
    const s=document.createElement('button');
    s.type='button';
    s.className=`square ${(r+c)%2?'dark':'light'}`;
    s.dataset.r=r;s.dataset.c=c;s.textContent=pieces[board[r][c]]||'';
    if(selected&&selected[0]===r&&selected[1]===c)s.classList.add('selected');
    if(selected&&legal(selected,[r,c]))s.classList.add('target');
    s.onclick=()=>pick(r,c);
    root.appendChild(s);
  }
}

function pick(r,c){
  if(!selected){if(colorOf(board[r][c])===turn){selected=[r,c];draw()}return}
  if(selected[0]===r&&selected[1]===c){selected=null;draw();return}
  if(!legal(selected,[r,c])){if(colorOf(board[r][c])===turn)selected=[r,c];draw();return}
  const [fr,fc]=selected,captured=board[r][c];
  history.push({board:board.map(x=>[...x]),turn,move:`${String.fromCharCode(97+fc)}${8-fr}-${String.fromCharCode(97+c)}${8-r}`,captured});
  board[r][c]=board[fr][fc];board[fr][fc]='.';
  turn=turn==='white'?'black':'white';selected=null;
  renderHistory();renderStatus();draw();
  if(mode==='cpu'&&turn==='black')setTimeout(cpuMove,320);
}

function cpuMove(){
  const moves=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(colorOf(board[r][c])==='black')for(let tr=0;tr<8;tr++)for(let tc=0;tc<8;tc++)if(legal([r,c],[tr,tc]))moves.push([[r,c],[tr,tc]]);
  if(!moves.length)return;
  const pickMove=moves[Math.floor(Math.random()*moves.length)];
  selected=pickMove[0];pick(...pickMove[1]);
}

function renderHistory(){
  const moves=el('moves');
  if(moves)moves.innerHTML=history.map((h,i)=>`<li>${i+1}. ${h.move}${h.captured!=='.'?` × ${pieces[h.captured]}`:''}</li>`).join('');
  const whiteCaptured=history.filter(h=>h.captured!=='.'&&colorOf(h.captured)==='black').map(h=>pieces[h.captured]).join(' ');
  const blackCaptured=history.filter(h=>h.captured!=='.'&&colorOf(h.captured)==='white').map(h=>pieces[h.captured]).join(' ');
  setText('whiteCapturedPieces',whiteCaptured||'—');setText('blackCapturedPieces',blackCaptured||'—');
  setText('moveCount',history.length);setText('captureCount',history.filter(h=>h.captured!=='.').length);
}

function renderStatus(message){
  const label=message||`${turn[0].toUpperCase()+turn.slice(1)} to move`;
  setText('status',label);setText('statusDetail',room?`Room ${room.room_code}`:'Make your move...');
}

function renderClock(){
  const m=String(Math.floor(clock/60)).padStart(2,'0'),s=String(clock%60).padStart(2,'0');
  setText('matchClock',`${m}:${s}`);setText('timeControl',`${m}:${s}`);
}

function startClock(){clearInterval(timer);timer=setInterval(()=>{if(clock>0){clock--;renderClock()}else{clearInterval(timer);renderStatus('TIME EXPIRED')}},1000)}

function reset(){
  board=start.map(r=>r.split(''));turn='white';selected=null;history=[];clock=600;room=null;
  renderHistory();renderStatus();renderClock();draw();startClock();
}

async function getGame(){
  const {data}=await supabase.from('games').select('id,slug,title').in('slug',['rich-chess','rich-chess-boss']).order('is_featured',{ascending:false}).limit(1).maybeSingle();
  return data||null;
}

async function loadIdentity(){
  identity=await getAuthoritativeIdentity().catch(()=>({}));
  const profile=identity.profile||{};
  setText('playerName',profile.display_name||profile.username||'Rich Player');
  setText('whitePlayer',profile.display_name||profile.username||'Rich Player');
  setText('richPoints',fmt(profile.rich_points));
  setText('coinBalance',fmt(Math.round(Number(profile.balance_cents||0)/100)));
  const avatar=el('playerAvatar');if(avatar&&profile.avatar_url)avatar.innerHTML=`<img src="${profile.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  if(identity.user){
    const {data:gamer}=await supabase.from('gamer_profiles').select('*').eq('user_id',identity.user.id).maybeSingle();
    setText('winsStat',fmt(gamer?.wins));setText('eloStat',fmt(gamer?.rating||gamer?.elo||1200));
    const {count}=await supabase.from('game_scores').select('*',{count:'exact',head:true}).eq('user_id',identity.user.id).eq('game_slug','rich-chess');
    setText('rankStat',count?`#${Math.max(1,100-count)}`:'#—');
  }
}

async function save(result='in_progress'){
  if(!identity.user)await loadIdentity();
  if(!identity.user){location.href='/auth.html?next='+encodeURIComponent(location.pathname);return}
  const game=await getGame();
  const payload={game_id:game?.id||null,game_slug:'rich-chess',user_id:identity.user.id,username:identity.profile?.username||null,display_name:identity.profile?.display_name||null,result,score:history.length,platform_type:'web',metadata:{source:'games/rich-chess',turn,position:board,mode,cpu_elo:cpuElo,room_id:room?.id||null,move_history:history.map(h=>h.move)}};
  const {error}=await supabase.from('game_sessions').insert(payload);
  renderStatus(error?error.message:(result==='completed'?'SCORE SUBMITTED':'MATCH SAVED'));
}

async function createRoom(){
  if(!identity.user)await loadIdentity();
  if(!identity.user){location.href='/auth.html?next='+encodeURIComponent(location.pathname);return}
  const code=('RC'+Math.random().toString(36).slice(2,8)).toUpperCase(),game=await getGame();
  const {data,error}=await supabase.from('game_rooms').insert({room_code:code,game_key:'rich-chess',host_user_id:identity.user.id,status:'active',current_turn:identity.user.id,board_state:{position:board,turn},game_state:{mode:'custom',cpu_elo:cpuElo},metadata:{source:'games/rich-chess',game_id:game?.id||null}}).select('*').maybeSingle();
  if(error){renderStatus(error.message);return}
  room=data;mode='room';
  await supabase.from('game_room_members').insert({room_id:data.id,user_id:identity.user.id,username:identity.profile?.username||null,display_name:identity.profile?.display_name||null,role:'host',status:'active',metadata:{source:'games/rich-chess'}});
  renderStatus(`ROOM ${code} CREATED`);
}

function bind(){
  el('newGame')?.addEventListener('click',reset);
  el('flipBoard')?.addEventListener('click',()=>{flipped=!flipped;draw()});
  el('undoMove')?.addEventListener('click',()=>{const h=history.pop();if(!h)return;board=h.board;turn=h.turn;selected=null;renderHistory();renderStatus();draw()});
  el('saveMatch')?.addEventListener('click',()=>save('in_progress'));
  el('submitScore')?.addEventListener('click',()=>save('completed'));
  el('createRoom')?.addEventListener('click',createRoom);
  el('joinRoom')?.addEventListener('click',()=>{const code=prompt('Enter Rich Chess room code');if(code)renderStatus(`JOIN REQUEST • ${code.toUpperCase()}`)});
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');mode=btn.dataset.mode;renderStatus(`${mode.toUpperCase()} MODE`)}));
  document.querySelectorAll('[data-elo]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-elo]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');cpuElo=Number(btn.dataset.elo);setText('blackRating',cpuElo);renderStatus(`CPU ${cpuElo} ELO`)}));
}

await loadIdentity();bind();reset();

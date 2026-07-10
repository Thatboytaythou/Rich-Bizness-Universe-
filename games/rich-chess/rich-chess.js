import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';
import { awardXp } from '../../src/rb-xp.js?v=xp-idempotent-1';

const pieces={r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔',P:'♙'};
const start=['rnbqkbnr','pppppppp','........','........','........','........','PPPPPPPP','RNBQKBNR'];
let board=start.map(r=>r.split('')),turn='white',selected=null,history=[],flipped=false,mode='casual',cpuElo=2500,room=null,clock=600,timer=null,identity={},roomChannel=null;
const el=id=>document.getElementById(id);
const colorOf=p=>p==='.'?null:(p===p.toUpperCase()?'white':'black');
const fmt=n=>Number(n||0).toLocaleString();
const setText=(id,value)=>{const node=el(id);if(node)node.textContent=value};
const squareName=(r,c)=>`${String.fromCharCode(97+c)}${8-r}`;

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

async function pick(r,c){
  if(!selected){if(colorOf(board[r][c])===turn){selected=[r,c];draw()}return}
  if(selected[0]===r&&selected[1]===c){selected=null;draw();return}
  if(!legal(selected,[r,c])){if(colorOf(board[r][c])===turn)selected=[r,c];draw();return}
  const [fr,fc]=selected,captured=board[r][c],piece=board[fr][fc],movingTurn=turn;
  const move=`${squareName(fr,fc)}-${squareName(r,c)}`;
  history.push({board:board.map(x=>[...x]),turn,move,captured,from:[fr,fc],to:[r,c],piece});
  board[r][c]=piece;board[fr][fc]='.';
  turn=turn==='white'?'black':'white';selected=null;
  renderHistory();renderStatus();draw();
  if(room)await persistRoomMove({fr,fc,r,c,piece,captured,movingTurn});
  if(mode==='cpu'&&turn==='black')setTimeout(cpuMove,320);
}

function cpuMove(){
  const moves=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(colorOf(board[r][c])==='black')for(let tr=0;tr<8;tr++)for(let tc=0;tc<8;tc++)if(legal([r,c],[tr,tc]))moves.push([[r,c],[tr,tc]]);
  if(!moves.length)return;
  const selectedMove=moves[Math.floor(Math.random()*moves.length)];
  selected=selectedMove[0];pick(...selectedMove[1]);
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
function resetLocalPosition(){board=start.map(r=>r.split(''));turn='white';selected=null;history=[];clock=600;renderHistory();renderStatus();renderClock();draw();startClock()}
function reset(){leaveRoomChannel();room=null;mode='casual';resetLocalPosition()}

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
    setText('winsStat',fmt(gamer?.wins));setText('eloStat',fmt(gamer?.metadata?.rich_chess_elo||1200));
    const {count}=await supabase.from('game_scores').select('*',{count:'exact',head:true}).eq('user_id',identity.user.id).eq('game_slug','rich-chess');
    setText('rankStat',count?`#${Math.max(1,100-count)}`:'#—');
  }
  await loadLeaderboard();
}

async function loadLeaderboard(){
  const {data}=await supabase.from('game_scores').select('display_name,username,score,created_at').eq('game_slug','rich-chess').eq('is_verified',true).order('score',{ascending:false}).limit(5);
  const target=el('leaderboardList');
  if(target)target.innerHTML=(data||[]).map((row,i)=>`<div><b>#${i+1} ${row.display_name||row.username||'Rich Player'}</b><span>${fmt(row.score)}</span></div>`).join('')||'<small>No ranked scores yet.</small>';
}

async function save(result='in_progress'){
  if(!identity.user)await loadIdentity();
  if(!identity.user){location.href='/auth.html?next='+encodeURIComponent(location.pathname);return}
  const game=await getGame();
  const score=Math.max(1,10000-history.length*25+history.filter(h=>h.captured!=='.').length*100);
  const payload={game_id:game?.id||null,game_slug:'rich-chess',user_id:identity.user.id,username:identity.profile?.username||null,display_name:identity.profile?.display_name||null,result,score,platform_type:'web',ended_at:result==='completed'?new Date().toISOString():null,metadata:{source:'games/rich-chess',turn,position:board,mode,cpu_elo:cpuElo,room_id:room?.id||null,move_history:history.map(h=>h.move)}};
  const {error}=await supabase.from('game_sessions').insert(payload);
  if(!error&&result==='completed'){
    await supabase.from('game_scores').insert({game_id:game?.id||null,game_slug:'rich-chess',user_id:identity.user.id,username:identity.profile?.username||null,display_name:identity.profile?.display_name||null,score,mode,platform_type:'web',is_verified:true,anti_cheat_status:'verified',metadata:{room_id:room?.id||null,moves:history.length,captures:history.filter(h=>h.captured!=='.').length}});
    await awardXp('game_score_submit',{section:'gaming',sourceTable:'games',sourceId:game?.id}).catch(()=>{});
    await loadLeaderboard();
  }
  renderStatus(error?error.message:(result==='completed'?'SCORE SUBMITTED':'MATCH SAVED'));
}

async function createRoom(){
  if(!identity.user)await loadIdentity();
  if(!identity.user){location.href='/auth.html?next='+encodeURIComponent(location.pathname);return}
  const code=('RC'+Math.random().toString(36).slice(2,8)).toUpperCase(),game=await getGame();
  const {data,error}=await supabase.from('game_rooms').insert({room_code:code,game_key:'rich-chess',host_user_id:identity.user.id,status:'active',current_turn:'white',board_state:{position:board,turn},game_state:{mode:'custom',cpu_elo:cpuElo},metadata:{source:'games/rich-chess',game_id:game?.id||null}}).select('*').maybeSingle();
  if(error){renderStatus(error.message);return}
  room=data;mode='room';
  await supabase.from('game_room_members').upsert({room_id:data.id,user_id:identity.user.id,username:identity.profile?.username||null,display_name:identity.profile?.display_name||null,role:'host',status:'active',metadata:{source:'games/rich-chess'}},{onConflict:'room_id,user_id'});
  subscribeRoom();renderStatus(`ROOM ${code} CREATED`);
}

async function joinRoom(code){
  if(!identity.user)await loadIdentity();
  if(!identity.user){location.href='/auth.html?next='+encodeURIComponent(location.pathname);return}
  const {data,error}=await supabase.rpc('rb_join_game_room',{p_room_code:code.trim().toUpperCase()});
  if(error){renderStatus(error.message);return}
  room=data;mode='room';applyRoomState(data);subscribeRoom();renderStatus(`ROOM ${data.room_code} JOINED`);
}

async function persistRoomMove(move){
  if(!room||!identity.user)return;
  const {error}=await supabase.rpc('rb_record_game_move',{
    p_room_id:room.id,
    p_from_square:squareName(move.fr,move.fc),
    p_to_square:squareName(move.r,move.c),
    p_piece:move.piece,
    p_captured_piece:move.captured,
    p_board_state:{position:board,turn,history:history.map(h=>({move:h.move,captured:h.captured,piece:h.piece}))},
    p_next_turn:turn,
    p_move_data:{mode,moving_turn:move.movingTurn,clock}
  });
  if(error)renderStatus(error.message);
}

function applyRoomState(nextRoom){
  room=nextRoom;
  const state=nextRoom?.board_state||{};
  if(Array.isArray(state.position)&&state.position.length===8)board=state.position.map(row=>[...row]);
  if(state.turn)turn=state.turn;
  if(Array.isArray(state.history))history=state.history.map(item=>({board:board.map(x=>[...x]),turn,move:item.move,captured:item.captured||'.',piece:item.piece||''}));
  selected=null;renderHistory();renderStatus();draw();
}

function subscribeRoom(){
  leaveRoomChannel();if(!room?.id)return;
  roomChannel=supabase.channel(`rich-chess-room-${room.id}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:`id=eq.${room.id}`},payload=>applyRoomState(payload.new))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'game_room_members',filter:`room_id=eq.${room.id}`},()=>renderStatus(`ROOM ${room.room_code} • PLAYER JOINED`))
    .subscribe();
}

function leaveRoomChannel(){if(roomChannel){supabase.removeChannel(roomChannel);roomChannel=null}}

function bind(){
  el('newGame')?.addEventListener('click',reset);
  el('flipBoard')?.addEventListener('click',()=>{flipped=!flipped;draw()});
  el('undoMove')?.addEventListener('click',()=>{if(room){renderStatus('UNDO DISABLED IN LIVE ROOM');return}const h=history.pop();if(!h)return;board=h.board;turn=h.turn;selected=null;renderHistory();renderStatus();draw()});
  el('saveMatch')?.addEventListener('click',()=>save('in_progress'));
  el('submitScore')?.addEventListener('click',()=>save('completed'));
  el('createRoom')?.addEventListener('click',createRoom);
  el('joinRoom')?.addEventListener('click',()=>{const code=prompt('Enter Rich Chess room code');if(code)joinRoom(code)});
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');mode=btn.dataset.mode;renderStatus(`${mode.toUpperCase()} MODE`)}));
  document.querySelectorAll('[data-elo]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-elo]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');cpuElo=Number(btn.dataset.elo);setText('blackRating',cpuElo);renderStatus(`CPU ${cpuElo} ELO`)}));
  window.addEventListener('beforeunload',leaveRoomChannel);
}

await loadIdentity();bind();resetLocalPosition();
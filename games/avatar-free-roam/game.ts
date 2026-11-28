import { createControls } from './controls';
import { mountMobileControls } from './mobile';
import { FREE_ROAM_MISSIONS } from './missions';
import { calculateFreeRoamScore } from './scoring';
import { clampToWorld, FREE_ROAM_RULES } from './rules';
import { createDefaultFreeRoamSave, type AvatarFreeRoamSave } from './save-schema';

const root = document.querySelector<HTMLElement>('#game-root');
if (!root) throw new Error('Missing game root');

root.innerHTML = `
  <section class="hud">
    <p>AVATAR FREE ROAM</p>
    <strong id="score">0</strong>
    <span id="mission">Loading mission…</span>
    <small id="status">WASD / ARROWS · SHIFT SPRINT · SPACE JUMP</small>
  </section>
  <div class="world" id="world">
    <div class="portal portal-a"></div>
    <div class="portal portal-b"></div>
    <div class="player" id="player" aria-label="Player avatar"></div>
    <div class="checkpoint" id="checkpoint" aria-label="Mission checkpoint"></div>
  </div>`;

function requireHud(selector:string):HTMLElement{const el=root!.querySelector<HTMLElement>(selector);if(!el)throw Error('Game HUD failed to mount: '+selector);return el;}
const player=requireHud('#player'),checkpoint=requireHud('#checkpoint'),scoreLabel=requireHud('#score'),missionLabel=requireHud('#mission'),statusLabel=requireHud('#status');

const lifetime=new AbortController();
const readKeyboard = createControls(lifetime.signal);
const readMobile = mountMobileControls(root,lifetime.signal);
let raf=0,lastSavedAt=performance.now(),disposed=false;
const startedAt = performance.now();
const storageKey = 'rb.avatar-free-roam.save.v1';
const saved = loadSave();
const completedMissionIds = new Set(saved.completedMissionIds);

const state = {
  x: saved.position.x,
  z: saved.position.z,
  y: saved.position.y,
  velocityY: 0,
  grounded: saved.position.y <= 0,
  last: performance.now(),
  distance: saved.totalDistance,
  checkpoints: completedMissionIds.size,
  missionIndex: nextMissionIndex()
};

function loadSave(): AvatarFreeRoamSave {
  try {
    const raw = localStorage.getItem(storageKey);
    if(!raw)return createDefaultFreeRoamSave();const v=JSON.parse(raw);if(!v||v.version!==1||!v.position||![v.position.x,v.position.y,v.position.z,v.bestScore,v.totalDistance,v.totalPlaySeconds].every(Number.isFinite)||!Array.isArray(v.completedMissionIds))return createDefaultFreeRoamSave();return {...v,position:{x:clampToWorld(v.position.x),z:clampToWorld(v.position.z),y:Math.max(0,Math.min(20,v.position.y))},completedMissionIds:[...new Set<string>(v.completedMissionIds.filter((id:unknown)=>typeof id==='string'&&FREE_ROAM_MISSIONS.some(m=>m.id===id)))]};
  } catch {
    return createDefaultFreeRoamSave();
  }
}

function nextMissionIndex(): number {
  const index = FREE_ROAM_MISSIONS.findIndex((mission) => !completedMissionIds.has(mission.id));
  return index === -1 ? FREE_ROAM_MISSIONS.length : index;
}

function currentMission() {
  return state.missionIndex < FREE_ROAM_MISSIONS.length ? FREE_ROAM_MISSIONS[state.missionIndex] : null;
}

function saveProgress(score: number): void {
  const data: AvatarFreeRoamSave = {
    version: 1,
    position: { x: state.x, y: state.y, z: state.z },
    completedMissionIds: [...completedMissionIds],
    bestScore: Math.max(saved.bestScore, score),
    totalDistance: state.distance,
    totalPlaySeconds: saved.totalPlaySeconds + Math.floor((performance.now() - startedAt) / 1000),
    updatedAt: new Date().toISOString()
  };
  try{localStorage.setItem(storageKey,JSON.stringify(data));}catch{}
}

function updateMissionHud(): void {
  const mission = currentMission();
  if (!mission) {
    missionLabel.textContent = 'ALL MISSIONS COMPLETE';
    checkpoint.hidden = true;
    return;
  }
  missionLabel.textContent = `${mission.title} · ${mission.description}`;
  checkpoint.hidden = false;
  checkpoint.style.transform = `translate3d(${mission.target.x * 18}px, ${mission.target.z * 8}px, 0)`;
}

function frame(now: number): void {
  raf=0;if(disposed||document.hidden)return;const dt = Math.max(0,Math.min((now - state.last) / 1000, 0.05));
  state.last = now;

  const keyboard = readKeyboard();
  const mobile = readMobile();
  const forward = Math.max(-1, Math.min(1, keyboard.forward + mobile.forward));
  const strafe = Math.max(-1, Math.min(1, keyboard.strafe + mobile.strafe));
  const sprint = keyboard.sprint || mobile.sprint;
  const jump = keyboard.jump || mobile.jump;
  const speed = sprint ? FREE_ROAM_RULES.sprintSpeed : FREE_ROAM_RULES.walkSpeed;
  const previousX = state.x;
  const previousZ = state.z;

  state.x = clampToWorld(state.x + strafe * speed * dt);
  state.z = clampToWorld(state.z + forward * speed * dt);
  state.distance += Math.hypot(state.x - previousX, state.z - previousZ);

  if (jump && state.grounded) {
    state.velocityY = FREE_ROAM_RULES.jumpVelocity;
    state.grounded = false;
  }

  state.velocityY -= FREE_ROAM_RULES.gravity * dt;
  state.y += state.velocityY * dt;
  if (state.y <= 0) {
    state.y = 0;
    state.velocityY = 0;
    state.grounded = true;
  }

  const mission = currentMission();
  if (mission && Math.hypot(state.x - mission.target.x, state.z - mission.target.z) <= FREE_ROAM_RULES.checkpointRadius) {
    completedMissionIds.add(mission.id);
    state.checkpoints = completedMissionIds.size;
    state.missionIndex = nextMissionIndex();
    statusLabel.textContent = `MISSION COMPLETE · +${mission.rewardXp} XP · +${mission.rewardRichPoints} RICH POINTS`;
    updateMissionHud();
  }

  const elapsedSeconds = (now - startedAt) / 1000;
  const score = calculateFreeRoamScore(state.distance, state.checkpoints, elapsedSeconds);
  player.style.transform = `translate3d(${state.x * 18}px, ${-state.y * 22 + state.z * 8}px, 0) scale(${1 + state.z * 0.002})`;
  scoreLabel.textContent = score.toLocaleString();

  if(now-lastSavedAt>=5000){lastSavedAt=now;saveProgress(score);}
  raf=requestAnimationFrame(frame);
}

function saveNow(){
  const score = calculateFreeRoamScore(state.distance, state.checkpoints, (performance.now() - startedAt) / 1000);
  saveProgress(score);
}
addEventListener('pagehide',()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);saveNow();lifetime.abort();},{once:true});
addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;if(disposed)return;if(document.hidden)saveNow();else{state.last=performance.now();raf=requestAnimationFrame(frame);}},{signal:lifetime.signal});
updateMissionHud();
if(!document.hidden)raf=requestAnimationFrame(frame);

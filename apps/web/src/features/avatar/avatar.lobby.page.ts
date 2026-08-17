import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.lobby.css';

type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
type Snapshot = { profile?: Record<string, any>; avatar?: Record<string, any> };
type Rig = {
  root: THREE.Group;
  pelvis: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftWrist: THREE.Group;
  rightWrist: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightAnkle: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
};

const OWNER = 'rich-bizness-avatar-lobby-v1';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
const makeMesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
const capsule = (radius:number,length:number,material:THREE.Material) => makeMesh(new THREE.CapsuleGeometry(radius,length,10,24),material);

function createRig(kind:'male'|'female', accent:number, build:string, style:string):Rig {
  const female = kind === 'female';
  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  const chest = new THREE.Group();
  const neck = new THREE.Group();
  const head = new THREE.Group();
  const leftShoulder = new THREE.Group(), rightShoulder = new THREE.Group();
  const leftElbow = new THREE.Group(), rightElbow = new THREE.Group();
  const leftWrist = new THREE.Group(), rightWrist = new THREE.Group();
  const leftHip = new THREE.Group(), rightHip = new THREE.Group();
  const leftKnee = new THREE.Group(), rightKnee = new THREE.Group();
  const leftAnkle = new THREE.Group(), rightAnkle = new THREE.Group();

  const skin = new THREE.MeshPhysicalMaterial({ color:female?0xa96f50:0x925e42, roughness:.5, metalness:0, clearcoat:.05 });
  const jacket = new THREE.MeshPhysicalMaterial({ color:style==='boss'?0x161a18:accent, roughness:.34, metalness:style==='cyber'?.24:.04, clearcoat:.18 });
  const shirt = new THREE.MeshStandardMaterial({ color:0xf2f4ef, roughness:.7 });
  const pants = new THREE.MeshPhysicalMaterial({ color:style==='boss'?0x101312:0x171b1a, roughness:.64, metalness:.02 });
  const shoes = new THREE.MeshPhysicalMaterial({ color:0x0b0d0c, roughness:.38, metalness:.12, clearcoat:.22 });
  const hairMat = new THREE.MeshStandardMaterial({ color:0x101010, roughness:.7 });
  const white = new THREE.MeshStandardMaterial({ color:0xf8f7f2, roughness:.52 });
  const iris = new THREE.MeshStandardMaterial({ color:0x2b180f, roughness:.45 });
  const lip = new THREE.MeshStandardMaterial({ color:female?0x7b3c46:0x593129, roughness:.6 });

  const bodyScale = build==='lean'?.94:build==='heroic'?1.06:1;
  const shoulderX = (female?.37:.42)*bodyScale;
  const hipX = female?.195:.18;

  root.add(pelvis);
  pelvis.position.y = 1.92;
  const pelvisMesh = makeMesh(new THREE.CapsuleGeometry(female?.25:.24,.28,10,24),pants);
  pelvisMesh.rotation.z = Math.PI/2;
  pelvisMesh.scale.set(1,.78,.78);
  pelvis.add(pelvisMesh);

  const abdomen = makeMesh(new THREE.CylinderGeometry(.245*bodyScale,.27*bodyScale,.58,28),shirt);
  abdomen.position.y = .48;
  abdomen.scale.z = .67;
  pelvis.add(abdomen);

  chest.position.y = .78;
  pelvis.add(chest);
  const torso = makeMesh(new THREE.CylinderGeometry((female?.31:.36)*bodyScale,.255*bodyScale,.72,32),jacket);
  torso.position.y = .36;
  torso.scale.z = .62;
  chest.add(torso);
  const shirtPanel = makeMesh(new THREE.BoxGeometry(.34,.5,.035),shirt);
  shirtPanel.position.set(0,.34,.235);
  chest.add(shirtPanel);

  neck.position.y = .79;
  chest.add(neck);
  neck.add(makeMesh(new THREE.CylinderGeometry(.095,.11,.25,20),skin));

  head.position.y = .31;
  neck.add(head);
  const skull = makeMesh(new THREE.SphereGeometry(.245,40,30),skin);
  skull.scale.set(.88,1.05,.93);
  skull.position.y = .12;
  head.add(skull);
  const jaw = makeMesh(new THREE.SphereGeometry(.19,30,22),skin);
  jaw.scale.set(.9,.58,.82);
  jaw.position.set(0,-.07,.018);
  head.add(jaw);
  const leftEar = makeMesh(new THREE.SphereGeometry(.045,14,10),skin); leftEar.scale.set(.55,1,.45); leftEar.position.set(-.225,.1,0); head.add(leftEar);
  const rightEar = leftEar.clone(); rightEar.position.x=.225; head.add(rightEar);
  const hair = makeMesh(new THREE.SphereGeometry(.252,32,20,0,Math.PI*2,0,Math.PI*.5),hairMat);
  hair.position.y = .29;
  hair.scale.set(1.02,.5,1.01);
  head.add(hair);
  const leftEye = makeMesh(new THREE.SphereGeometry(.029,14,10),white); leftEye.position.set(-.082,.11,.226); head.add(leftEye);
  const rightEye = leftEye.clone(); rightEye.position.x=.082; head.add(rightEye);
  for(const x of [-.082,.082]){ const pupil=makeMesh(new THREE.SphereGeometry(.012,10,8),iris); pupil.position.set(x,.11,.252); head.add(pupil); }
  const nose = capsule(.014,.055,skin); nose.rotation.x=Math.PI/2; nose.position.set(0,.045,.245); head.add(nose);
  const mouth = makeMesh(new THREE.BoxGeometry(.078,.012,.014),lip); mouth.position.set(0,-.075,.235); head.add(mouth);
  for(const x of [-.082,.082]){ const brow=makeMesh(new THREE.BoxGeometry(.08,.012,.018),hairMat); brow.position.set(x,.18,.238); brow.rotation.z=x<0?-.06:.06; head.add(brow); }

  const addArm = (side:-1|1, shoulder:THREE.Group, elbow:THREE.Group, wrist:THREE.Group) => {
    shoulder.position.set(side*shoulderX,.61,0);
    chest.add(shoulder);
    const sleeve = capsule(.095,.28,jacket); sleeve.position.y=-.17; shoulder.add(sleeve);
    const upper = capsule(.074,.38,skin); upper.position.y=-.45; shoulder.add(upper);
    elbow.position.y=-.70; shoulder.add(elbow);
    const forearm = capsule(.068,.40,skin); forearm.position.y=-.24; elbow.add(forearm);
    wrist.position.y=-.49; elbow.add(wrist);
    const palm = makeMesh(new THREE.BoxGeometry(.115,.16,.075),skin); palm.position.y=-.08; wrist.add(palm);
  };
  addArm(-1,leftShoulder,leftElbow,leftWrist);
  addArm(1,rightShoulder,rightElbow,rightWrist);

  const addLeg = (side:-1|1, hip:THREE.Group, knee:THREE.Group, ankle:THREE.Group) => {
    hip.position.set(side*hipX,-.08,0);
    pelvis.add(hip);
    const thigh = capsule(.105,.69,pants); thigh.position.y=-.43; hip.add(thigh);
    knee.position.y=-.84; hip.add(knee);
    const shin = capsule(.09,.68,pants); shin.position.y=-.41; knee.add(shin);
    ankle.position.y=-.82; knee.add(ankle);
    const foot = makeMesh(new THREE.BoxGeometry(.22,.14,.42),shoes); foot.position.set(0,-.07,.13); ankle.add(foot);
  };
  addLeg(-1,leftHip,leftKnee,leftAnkle);
  addLeg(1,rightHip,rightKnee,rightAnkle);

  root.scale.setScalar(1.08);
  return { root,pelvis,chest,neck,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftWrist,rightWrist,leftHip,rightHip,leftKnee,rightKnee,leftAnkle,rightAnkle,leftEye,rightEye };
}

function poseRig(r:Rig,time:number,moving:boolean,running:boolean,power:number){
  const gait=time*(running?10.2:6.4);
  const stride=moving?(running?.68:.42):0;
  const swing=Math.sin(gait)*stride;
  const bounce=moving?Math.abs(Math.sin(gait))*(running?.025:.014):Math.sin(time*1.6)*.004;
  r.pelvis.position.y=1.92+bounce;
  r.pelvis.rotation.y=moving?Math.sin(gait)*.035:Math.sin(time*.4)*.01;
  r.chest.rotation.y=moving?-Math.sin(gait)*.045:Math.sin(time*.5)*.012;
  r.chest.rotation.z=moving?Math.sin(gait)*.015:Math.sin(time*.7)*.006;
  r.head.rotation.y=moving?THREE.MathUtils.lerp(r.head.rotation.y,0,.08):Math.sin(time*.42)*.08;
  r.head.rotation.x=moving?-.012:Math.sin(time*.72)*.012;
  r.leftHip.rotation.x=swing;
  r.rightHip.rotation.x=-swing;
  r.leftKnee.rotation.x=moving?Math.max(0,-Math.sin(gait))*(running?.82:.52):.01;
  r.rightKnee.rotation.x=moving?Math.max(0,Math.sin(gait))*(running?.82:.52):.01;
  r.leftAnkle.rotation.x=-r.leftKnee.rotation.x*.38;
  r.rightAnkle.rotation.x=-r.rightKnee.rotation.x*.38;
  r.leftShoulder.rotation.x=-swing*.72;
  r.rightShoulder.rotation.x=swing*.72;
  r.leftShoulder.rotation.z=.025;
  r.rightShoulder.rotation.z=-.025;
  r.leftElbow.rotation.x=moving?-.12-Math.max(0,-swing)*.2:-.07;
  r.rightElbow.rotation.x=moving?-.12-Math.max(0,swing)*.2:-.07;
  if(power>0){
    const p=Math.min(1,power*1.9);
    r.leftShoulder.rotation.z=THREE.MathUtils.lerp(r.leftShoulder.rotation.z,1.0,p);
    r.rightShoulder.rotation.z=THREE.MathUtils.lerp(r.rightShoulder.rotation.z,-1.0,p);
    r.leftElbow.rotation.x=-.5*p;
    r.rightElbow.rotation.x=-.5*p;
    r.chest.rotation.x=-.05*p;
  } else r.chest.rotation.x=0;
  const blink=Math.sin(time*3.2)>0.991?.18:1;
  r.leftEye.scale.y=blink;
  r.rightEye.scale.y=blink;
}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root) throw new Error('Missing #app mount');
  const epoch=root.dataset.pageEpoch??'';
  let disposed=false;
  let renderer:THREE.WebGLRenderer|null=null;
  let raf=0;
  const isCurrent=()=>!disposed&&root.dataset.pageEpoch===epoch&&root.dataset.pageOwner===OWNER;
  const cleanup=()=>{ if(disposed)return; disposed=true; cancelAnimationFrame(raf); renderer?.dispose(); window.removeEventListener('resize',resize); const host=window as CleanupHost; if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null; };
  (window as CleanupHost).__rbPageCleanup=cleanup;
  window.addEventListener('pagehide',cleanup,{once:true});
  window.addEventListener('beforeunload',cleanup,{once:true});

  const user=getAuthSnapshot().user;
  if(!user){ location.replace('/tap-in.html?next=%2Favatar.html'); return; }
  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});
  if(error) throw error;
  if(!isCurrent()) return;

  const snap=(data??{}) as Snapshot;
  const avatar=snap.avatar??{};
  const name=String(avatar.display_name??snap.profile?.display_name??snap.profile?.username??'Rich Avatar');
  const kind=String(avatar.character_type??'male');
  const isGirl=kind==='female'||String(avatar.metadata?.gender??'').toLowerCase()==='girl';
  const aura=String(avatar.aura??'Emerald Gold');
  const outfit=avatar.outfit??{};
  const build=String(outfit.build??'athletic');
  const style=String(outfit.style??'street');

  root.innerHTML=`<main class="al-shell"><header><div><small>RICH BIZNESS · STREET MODE</small><h1>Avatar Lobby</h1></div><nav><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>GTA STREET · LIVE</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">SPRINT</button><button data-action="power">POWER</button><button data-action="idle">RESET</button></div></section></main>`;

  const canvas=root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x86a6b8);
  scene.fog=new THREE.Fog(0x86a6b8,34,86);
  const camera=new THREE.PerspectiveCamera(48,1,.1,160);
  camera.position.set(0,3.0,7.6);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xd8eeff,0x5c665d,2.25));
  const sun=new THREE.DirectionalLight(0xfff1d2,3.6); sun.position.set(7,11,5); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
  const rim=new THREE.DirectionalLight(0x79bfff,1.5); rim.position.set(-6,5,-5); scene.add(rim);
  const accentLight=new THREE.PointLight(accentFromAura(aura),18,16,2); accentLight.position.set(-3,2.4,3); scene.add(accentLight);

  const asphalt=new THREE.MeshStandardMaterial({color:0x2c3031,roughness:.9});
  const concrete=new THREE.MeshStandardMaterial({color:0x858b86,roughness:.94});
  const buildingMats=[0x454b50,0x535961,0x3c4449].map(color=>new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.03}));
  const windowMat=new THREE.MeshStandardMaterial({color:0x8ec7de,emissive:0x21495b,emissiveIntensity:.28,roughness:.3,metalness:.18});

  const ground=makeMesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x5f685f,roughness:1})); ground.rotation.x=-Math.PI/2; scene.add(ground);
  const road=makeMesh(new THREE.PlaneGeometry(12,92),asphalt); road.rotation.x=-Math.PI/2; road.position.z=-20; road.position.y=.012; scene.add(road);
  for(const x of [-7.8,7.8]){ const sidewalk=makeMesh(new THREE.BoxGeometry(3.4,.22,92),concrete); sidewalk.position.set(x,.1,-20); scene.add(sidewalk); }
  const laneMat=new THREE.MeshBasicMaterial({color:0xf0c84d});
  for(let z=-62;z<20;z+=5){ const lane=makeMesh(new THREE.PlaneGeometry(.13,2.1),laneMat); lane.rotation.x=-Math.PI/2; lane.position.set(0,.03,z); scene.add(lane); }

  const city=new THREE.Group();
  for(let i=0;i<24;i++){
    const side=i%2===0?-1:1;
    const width=3+Math.random()*4;
    const depth=3+Math.random()*4;
    const height=5+Math.random()*13;
    const building=makeMesh(new THREE.BoxGeometry(width,height,depth),buildingMats[i%buildingMats.length]);
    building.position.set(side*(11+Math.random()*10),height/2,(Math.random()-.5)*80-20);
    city.add(building);
    const rows=Math.min(6,Math.floor(height/2));
    for(let r=0;r<rows;r++){
      const win=makeMesh(new THREE.BoxGeometry(width*.48,.38,.035),windowMat);
      win.position.set(building.position.x,1.3+r*1.5,building.position.z+(side>0?-depth/2-.02:depth/2+.02));
      city.add(win);
    }
  }
  scene.add(city);

  const poleMat=new THREE.MeshStandardMaterial({color:0x202525,roughness:.65,metalness:.3});
  for(const side of [-1,1]) for(let z=-50;z<14;z+=12){
    const pole=makeMesh(new THREE.CylinderGeometry(.055,.065,4.8,12),poleMat); pole.position.set(side*6.3,2.4,z); scene.add(pole);
    const lamp=makeMesh(new THREE.BoxGeometry(.7,.12,.18),new THREE.MeshStandardMaterial({color:0xffe4a0,emissive:0xffb637,emissiveIntensity:.7})); lamp.position.set(side*6.0,4.72,z); scene.add(lamp);
  }

  const carMat=new THREE.MeshPhysicalMaterial({color:0x173a28,roughness:.32,metalness:.45,clearcoat:.45});
  for(const [x,z] of [[-4.3,-11],[4.2,-29],[-4.2,-43]] as Array<[number,number]>) {
    const car=new THREE.Group();
    const body=makeMesh(new THREE.BoxGeometry(1.7,.42,3.25),carMat); body.position.y=.42; car.add(body);
    const cabin=makeMesh(new THREE.BoxGeometry(1.4,.48,1.55),new THREE.MeshPhysicalMaterial({color:0x5b7d8b,roughness:.25,metalness:.15,transparent:true,opacity:.82})); cabin.position.set(0,.79,-.15); car.add(cabin);
    car.position.set(x,0,z); scene.add(car);
  }

  const accent=accentFromAura(aura);
  const rig=createRig(isGirl?'female':'male',accent,build,style);
  rig.root.position.set(0,0,2.5);
  scene.add(rig.root);

  const joystick=root.querySelector<HTMLElement>('#joystick')!;
  const stick=root.querySelector<HTMLElement>('#stick')!;
  let joyX=0,joyY=0,run=false,jumpVel=0,power=0,dragging=false;
  const setJoy=(clientX:number,clientY:number)=>{ const r=joystick.getBoundingClientRect(); const cx=r.left+r.width/2,cy=r.top+r.height/2; let x=(clientX-cx)/(r.width*.35),y=(clientY-cy)/(r.height*.35); const len=Math.hypot(x,y); if(len>1){x/=len;y/=len;} joyX=x;joyY=y; stick.style.transform=`translate(${x*27}px,${y*27}px)`; };
  joystick.onpointerdown=e=>{dragging=true;joystick.setPointerCapture(e.pointerId);setJoy(e.clientX,e.clientY)};
  joystick.onpointermove=e=>{if(dragging)setJoy(e.clientX,e.clientY)};
  const release=()=>{dragging=false;joyX=joyY=0;stick.style.transform='translate(0,0)'};
  joystick.onpointerup=release; joystick.onpointercancel=release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn=>btn.onclick=()=>{ const action=btn.dataset.action; if(action==='jump'&&rig.root.position.y<=.01)jumpVel=.13; if(action==='run')run=!run; if(action==='power')power=1; if(action==='idle'){joyX=joyY=0;run=false;} });

  const clock=new THREE.Clock();
  const targetCam=new THREE.Vector3();
  const lookAt=new THREE.Vector3();
  const resize=()=>{ const r=canvas.getBoundingClientRect(); renderer!.setSize(Math.max(1,r.width),Math.max(1,r.height),false); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); };
  window.addEventListener('resize',resize); resize();

  const loop=()=>{
    if(disposed)return;
    const dt=Math.min(clock.getDelta(),.033);
    const time=clock.elapsedTime;
    const moving=Math.hypot(joyX,joyY)>.05;
    const speed=(run?4.6:2.55)*dt;
    if(moving){
      const angle=Math.atan2(joyX,-joyY);
      rig.root.rotation.y=THREE.MathUtils.lerp(rig.root.rotation.y,angle,.18);
      rig.root.position.x+=Math.sin(angle)*speed;
      rig.root.position.z+=Math.cos(angle)*speed;
      rig.root.position.x=THREE.MathUtils.clamp(rig.root.position.x,-5.2,5.2);
      rig.root.position.z=THREE.MathUtils.clamp(rig.root.position.z,-44,10);
    }
    jumpVel-=.0068;
    rig.root.position.y+=jumpVel;
    if(rig.root.position.y<0){rig.root.position.y=0;jumpVel=0;}
    power=Math.max(0,power-dt*1.45);
    poseRig(rig,time,moving,run,power);
    targetCam.set(rig.root.position.x,rig.root.position.y+2.65,rig.root.position.z+6.1);
    camera.position.lerp(targetCam,.095);
    lookAt.set(rig.root.position.x,rig.root.position.y+1.9,rig.root.position.z-.35);
    camera.lookAt(lookAt);
    renderer!.render(scene,camera);
    raf=requestAnimationFrame(loop);
  };
  loop();
}

function accentFromAura(aura:string){
  return aura==='Neon Phantom'?0x7b5cff:aura==='Diamond Mist'?0x8fe8ff:0x24d77a;
}

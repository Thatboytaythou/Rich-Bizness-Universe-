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
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const capsule = (r:number,l:number,m:THREE.Material) => makeMesh(new THREE.CapsuleGeometry(r,l,10,24),m);

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

  const skin = new THREE.MeshPhysicalMaterial({ color:female?0xa87458:0x936348, roughness:.48, clearcoat:.08 });
  const shirt = new THREE.MeshPhysicalMaterial({ color:accent, roughness:.34, metalness:style==='cyber'?.2:.03, clearcoat:.16 });
  const pants = new THREE.MeshPhysicalMaterial({ color:style==='boss'?0x17191b:0x1a211e, roughness:.58, metalness:.03 });
  const shoes = new THREE.MeshPhysicalMaterial({ color:0x101311, roughness:.36, metalness:.14, clearcoat:.2 });
  const hairMat = new THREE.MeshStandardMaterial({ color:0x101010, roughness:.62 });
  const white = new THREE.MeshStandardMaterial({ color:0xf8f7f2, roughness:.5 });
  const iris = new THREE.MeshStandardMaterial({ color:0x2a170e, roughness:.4 });
  const lip = new THREE.MeshStandardMaterial({ color:female?0x7b3d45:0x5c3028, roughness:.58 });

  const width = build==='lean'?.92:build==='heroic'?1.05:1;
  const shoulderX = (female?.39:.45)*width;
  const hipX = female?.19:.18;

  root.add(pelvis);
  pelvis.position.y = 2.32;
  const pelvisMesh = makeMesh(new THREE.CylinderGeometry(female?.31:.29, female?.34:.32, .42, 28), pants);
  pelvisMesh.scale.z = .72;
  pelvis.add(pelvisMesh);

  const abdomen = makeMesh(new THREE.CylinderGeometry(.26*width,.29*width,.62,30), shirt);
  abdomen.position.y = .48;
  abdomen.scale.z = .58;
  pelvis.add(abdomen);

  chest.position.y = .78;
  pelvis.add(chest);
  const torso = makeMesh(new THREE.CylinderGeometry((female?.34:.40)*width,.27*width,.82,34), shirt);
  torso.position.y = .42;
  torso.scale.z = .58;
  chest.add(torso);

  neck.position.y = .9;
  chest.add(neck);
  neck.add(makeMesh(new THREE.CylinderGeometry(.105,.12,.28,22),skin));

  head.position.y = .34;
  neck.add(head);
  const skull = makeMesh(new THREE.SphereGeometry(.285,42,32),skin);
  skull.scale.set(.86,1.03,.92);
  skull.position.y = .12;
  head.add(skull);
  const jaw = makeMesh(new THREE.SphereGeometry(.225,32,24),skin);
  jaw.scale.set(.88,.55,.8);
  jaw.position.set(0,-.08,.015);
  head.add(jaw);
  const hair = makeMesh(new THREE.SphereGeometry(.292,34,20,0,Math.PI*2,0,Math.PI*.5),hairMat);
  hair.position.y = .29;
  hair.scale.set(1.01,.56,1.01);
  head.add(hair);
  const leftEye = makeMesh(new THREE.SphereGeometry(.032,14,10),white); leftEye.position.set(-.095,.11,.262); head.add(leftEye);
  const rightEye = leftEye.clone(); rightEye.position.x = .095; head.add(rightEye);
  for(const x of [-.095,.095]){ const p=makeMesh(new THREE.SphereGeometry(.014,10,8),iris); p.position.set(x,.11,.29); head.add(p); }
  const nose = capsule(.017,.065,skin); nose.rotation.x=Math.PI/2; nose.position.set(0,.045,.284); head.add(nose);
  const mouth = makeMesh(new THREE.BoxGeometry(.09,.013,.014),lip); mouth.position.set(0,-.09,.272); head.add(mouth);

  const addArm = (side:-1|1, shoulder:THREE.Group, elbow:THREE.Group, wrist:THREE.Group) => {
    shoulder.position.set(side*shoulderX,.68,0);
    chest.add(shoulder);
    const sleeve = capsule(.105,.24,shirt); sleeve.position.y=-.12; shoulder.add(sleeve);
    const upper = capsule(.087,.34,skin); upper.position.y=-.42; shoulder.add(upper);
    elbow.position.y=-.68; shoulder.add(elbow);
    const fore = capsule(.077,.44,skin); fore.position.y=-.26; elbow.add(fore);
    wrist.position.y=-.52; elbow.add(wrist);
    const palm = makeMesh(new THREE.BoxGeometry(.13,.18,.08),skin); palm.position.y=-.09; wrist.add(palm);
    for(let i=0;i<4;i++){ const finger=capsule(.011,.10,skin); finger.position.set((i-1.5)*.026,-.19,.01); wrist.add(finger); }
  };
  addArm(-1,leftShoulder,leftElbow,leftWrist);
  addArm(1,rightShoulder,rightElbow,rightWrist);

  const addLeg = (side:-1|1, hip:THREE.Group, knee:THREE.Group, ankle:THREE.Group) => {
    hip.position.set(side*hipX,-.1,0);
    pelvis.add(hip);
    const thigh = capsule(.12,.72,pants); thigh.position.y=-.48; hip.add(thigh);
    knee.position.y=-.96; hip.add(knee);
    const shin = capsule(.105,.70,pants); shin.position.y=-.46; knee.add(shin);
    ankle.position.y=-.93; knee.add(ankle);
    const foot = makeMesh(new THREE.BoxGeometry(.24,.16,.46),shoes); foot.position.set(0,-.09,.14); ankle.add(foot);
  };
  addLeg(-1,leftHip,leftKnee,leftAnkle);
  addLeg(1,rightHip,rightKnee,rightAnkle);

  return { root,pelvis,chest,neck,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftWrist,rightWrist,leftHip,rightHip,leftKnee,rightKnee,leftAnkle,rightAnkle,leftEye,rightEye };
}

function poseRig(r:Rig,time:number,moving:boolean,running:boolean,power:number){
  const gait = time*(running?10.8:6.8);
  const stride = moving?(running?.72:.46):0;
  const swing = Math.sin(gait)*stride;
  const opposite = -swing;
  const bounce = moving?Math.abs(Math.sin(gait))*(running?.035:.018):Math.sin(time*1.7)*.006;

  r.pelvis.position.y = 2.32 + bounce;
  r.pelvis.rotation.y = moving?Math.sin(gait)*.02:Math.sin(time*.45)*.012;
  r.chest.rotation.y = moving?-Math.sin(gait)*.03:Math.sin(time*.55)*.012;
  r.chest.rotation.z = moving?Math.sin(gait)*.016:Math.sin(time*.8)*.008;
  r.neck.rotation.y = moving?0:Math.sin(time*.45)*.03;
  r.head.rotation.y = moving?THREE.MathUtils.lerp(r.head.rotation.y,0,.08):Math.sin(time*.42)*.09;
  r.head.rotation.x = moving?-.015:Math.sin(time*.7)*.015;

  r.leftHip.rotation.x = swing;
  r.rightHip.rotation.x = opposite;
  r.leftKnee.rotation.x = moving?Math.max(0,-Math.sin(gait))*(running?.88:.56):.01;
  r.rightKnee.rotation.x = moving?Math.max(0,Math.sin(gait))*(running?.88:.56):.01;
  r.leftAnkle.rotation.x = -r.leftKnee.rotation.x*.42;
  r.rightAnkle.rotation.x = -r.rightKnee.rotation.x*.42;
  r.leftShoulder.rotation.x = opposite*.72;
  r.rightShoulder.rotation.x = swing*.72;
  r.leftShoulder.rotation.z = .035;
  r.rightShoulder.rotation.z = -.035;
  r.leftElbow.rotation.x = moving?-.16-Math.max(0,opposite)*.22:-.08;
  r.rightElbow.rotation.x = moving?-.16-Math.max(0,swing)*.22:-.08;
  r.leftWrist.rotation.z = moving?Math.sin(gait)*.05:0;
  r.rightWrist.rotation.z = moving?-Math.sin(gait)*.05:0;

  if(power>0){
    const p=Math.min(1,power*1.8);
    r.leftShoulder.rotation.z=THREE.MathUtils.lerp(r.leftShoulder.rotation.z,1.05,p);
    r.rightShoulder.rotation.z=THREE.MathUtils.lerp(r.rightShoulder.rotation.z,-1.05,p);
    r.leftElbow.rotation.x=-.48*p;
    r.rightElbow.rotation.x=-.48*p;
    r.chest.rotation.x=-.06*p;
  } else {
    r.chest.rotation.x=0;
  }

  const blink=Math.sin(time*3.1)>0.99?.18:1;
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

  root.innerHTML=`<main class="al-shell"><header><div><small>RICH BIZNESS AVATAR WORLD</small><h1>Avatar Lobby</h1></div><nav><a href="/avatar-characters.html">EDIT CHARACTER</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>FULL BODY · LIVE MOTION</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">RUN</button><button data-action="power">POWER</button><button data-action="idle">IDLE</button></div></section></main>`;

  const canvas=root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xc9dfcf);
  scene.fog=new THREE.Fog(0xc9dfcf,28,70);
  const camera=new THREE.PerspectiveCamera(46,1,.1,140);
  camera.position.set(0,3.45,8.6);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xffffff,0x78937f,2.8));
  const sun=new THREE.DirectionalLight(0xffffff,3.7); sun.position.set(6,10,7); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
  const fill=new THREE.PointLight(0x7dffad,20,18,2); fill.position.set(-4,4,4); scene.add(fill);
  const gold=new THREE.PointLight(0xffd86f,16,16,2); gold.position.set(4,3,4); scene.add(gold);

  const ground=makeMesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:0xd7e7d9,roughness:.92})); ground.rotation.x=-Math.PI/2; scene.add(ground);
  const road=makeMesh(new THREE.PlaneGeometry(9,60),new THREE.MeshStandardMaterial({color:0x66746b,roughness:.82})); road.rotation.x=-Math.PI/2; road.position.z=-12; scene.add(road);
  const sidewalkMat=new THREE.MeshStandardMaterial({color:0xc5d3c8,roughness:.9});
  for(const x of [-5.8,5.8]){ const s=makeMesh(new THREE.BoxGeometry(2.4,.16,58),sidewalkMat); s.position.set(x,.08,-12); scene.add(s); }
  const stripeMat=new THREE.MeshBasicMaterial({color:0xf4dc73});
  for(let z=-38;z<12;z+=4){ const stripe=makeMesh(new THREE.PlaneGeometry(.12,1.8),stripeMat); stripe.rotation.x=-Math.PI/2; stripe.position.set(0,.025,z); scene.add(stripe); }

  const city=new THREE.Group();
  for(let i=0;i<22;i++){
    const h=4+Math.random()*8;
    const w=1.8+Math.random()*2.4;
    const b=makeMesh(new THREE.BoxGeometry(w,h,w*.8),new THREE.MeshStandardMaterial({color:i%3===0?0x8da697:i%3===1?0x9bb0a1:0x829988,roughness:.78,metalness:.02}));
    const side=i%2===0?-1:1;
    b.position.set(side*(8+Math.random()*10),h/2,(Math.random()-.5)*50-12);
    city.add(b);
  }
  scene.add(city);

  const accent=aura==='Neon Phantom'?0x8058ff:aura==='Diamond Mist'?0x8fe8ff:0x2cff8c;
  const rig=createRig(isGirl?'female':'male',accent,build,style);
  rig.root.position.set(0,0,1.5);
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
    const speed=(run?4.3:2.35)*dt;
    if(moving){
      const angle=Math.atan2(joyX,-joyY);
      rig.root.rotation.y=THREE.MathUtils.lerp(rig.root.rotation.y,angle,.16);
      rig.root.position.x+=Math.sin(angle)*speed;
      rig.root.position.z+=Math.cos(angle)*speed;
      rig.root.position.x=THREE.MathUtils.clamp(rig.root.position.x,-7,7);
      rig.root.position.z=THREE.MathUtils.clamp(rig.root.position.z,-22,7);
    }
    jumpVel-=.0068;
    rig.root.position.y+=jumpVel;
    if(rig.root.position.y<0){rig.root.position.y=0;jumpVel=0;}
    power=Math.max(0,power-dt*1.45);
    poseRig(rig,time,moving,run,power);
    targetCam.set(rig.root.position.x,rig.root.position.y+3.45,rig.root.position.z+7.8);
    camera.position.lerp(targetCam,.08);
    lookAt.set(rig.root.position.x,rig.root.position.y+2.15,rig.root.position.z);
    camera.lookAt(lookAt);
    renderer!.render(scene,camera);
    raf=requestAnimationFrame(loop);
  };
  loop();
}

import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.lobby.css';

type CleanupHost=Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};
type Snapshot={profile?:Record<string,any>;avatar?:Record<string,any>};
type Rig={root:THREE.Group;pelvis:THREE.Group;spine:THREE.Group;chest:THREE.Group;neck:THREE.Group;head:THREE.Group;leftShoulder:THREE.Group;rightShoulder:THREE.Group;leftElbow:THREE.Group;rightElbow:THREE.Group;leftWrist:THREE.Group;rightWrist:THREE.Group;leftHip:THREE.Group;rightHip:THREE.Group;leftKnee:THREE.Group;rightKnee:THREE.Group;leftAnkle:THREE.Group;rightAnkle:THREE.Group;leftEye:THREE.Mesh;rightEye:THREE.Mesh};
const OWNER='rich-bizness-avatar-lobby-v1';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]??c));
const mesh=(g:THREE.BufferGeometry,m:THREE.Material)=>{const x=new THREE.Mesh(g,m);x.castShadow=true;x.receiveShadow=true;return x};
const capsule=(r:number,l:number,m:THREE.Material)=>mesh(new THREE.CapsuleGeometry(r,l,12,28),m);

function createRig(kind:'male'|'female',accent:number,build:string,style:string):Rig{
  const root=new THREE.Group();
  const pelvis=new THREE.Group(),spine=new THREE.Group(),chest=new THREE.Group(),neck=new THREE.Group(),head=new THREE.Group();
  const leftShoulder=new THREE.Group(),rightShoulder=new THREE.Group(),leftElbow=new THREE.Group(),rightElbow=new THREE.Group(),leftWrist=new THREE.Group(),rightWrist=new THREE.Group();
  const leftHip=new THREE.Group(),rightHip=new THREE.Group(),leftKnee=new THREE.Group(),rightKnee=new THREE.Group(),leftAnkle=new THREE.Group(),rightAnkle=new THREE.Group();
  const female=kind==='female';
  const skin=new THREE.MeshPhysicalMaterial({color:female?0xa87458:0x936348,roughness:.43,metalness:.01,clearcoat:.15,clearcoatRoughness:.5});
  const top=new THREE.MeshPhysicalMaterial({color:accent,roughness:.3,metalness:style==='cyber'?.3:.08,clearcoat:.28});
  const pants=new THREE.MeshPhysicalMaterial({color:style==='boss'?0x17191b:0x17201c,roughness:.48,metalness:.05,clearcoat:.06});
  const shoeMat=new THREE.MeshPhysicalMaterial({color:0x101311,roughness:.32,metalness:.16,clearcoat:.34});
  const hairMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:.5});
  const white=new THREE.MeshStandardMaterial({color:0xf8f8f5,roughness:.5});
  const iris=new THREE.MeshStandardMaterial({color:0x23170f,roughness:.45});
  const bodyScale=build==='lean'?.92:build==='heroic'?1.06:1;
  const shoulderX=(female?.43:.49)*bodyScale;
  const hipX=female?.23:.21;

  root.add(pelvis);pelvis.position.y=.84;
  const pelvisMesh=mesh(new THREE.SphereGeometry(.32,32,24),pants);pelvisMesh.scale.set(female?1.08:.98,.55,.7);pelvis.add(pelvisMesh);
  spine.position.y=.42;pelvis.add(spine);
  const waist=mesh(new THREE.CylinderGeometry(.25,.30,.42,28),top);waist.position.y=.2;waist.scale.x=bodyScale;spine.add(waist);
  chest.position.y=.44;spine.add(chest);
  const torso=capsule(female?.33:.37,.76,top);torso.position.y=.4;torso.scale.set(bodyScale,1,.58);chest.add(torso);
  const clavicle=mesh(new THREE.BoxGeometry(shoulderX*2.05,.13,.28),top);clavicle.position.y=.77;clavicle.scale.z=.72;chest.add(clavicle);
  neck.position.y=.92;chest.add(neck);neck.add(mesh(new THREE.CylinderGeometry(.105,.125,.28,22),skin));
  head.position.y=.28;neck.add(head);
  const skull=mesh(new THREE.SphereGeometry(.29,48,36),skin);skull.scale.set(.9,1.06,.94);skull.position.y=.16;head.add(skull);
  const jaw=mesh(new THREE.SphereGeometry(.225,36,26),skin);jaw.scale.set(.9,.57,.82);jaw.position.set(0,-.02,.018);head.add(jaw);
  const hair=mesh(new THREE.SphereGeometry(.3,36,22,0,Math.PI*2,0,Math.PI*.52),hairMat);hair.position.y=.34;hair.scale.set(1.02,.58,1.02);head.add(hair);
  const leftEye=mesh(new THREE.SphereGeometry(.033,16,12),white);leftEye.position.set(-.1,.16,.267);head.add(leftEye);
  const rightEye=leftEye.clone();rightEye.position.x=.1;head.add(rightEye);
  for(const x of [-.1,.1]){const p=mesh(new THREE.SphereGeometry(.014,12,10),iris);p.position.set(x,.16,.295);head.add(p)}
  const nose=capsule(.017,.07,skin);nose.rotation.x=Math.PI/2;nose.position.set(0,.085,.29);head.add(nose);

  const addArm=(side:-1|1,shoulder:THREE.Group,elbow:THREE.Group,wrist:THREE.Group)=>{
    shoulder.position.set(side*shoulderX,.73,0);chest.add(shoulder);
    const upper=capsule(.085,.49,skin);upper.position.y=-.28;shoulder.add(upper);
    elbow.position.y=-.56;shoulder.add(elbow);
    const fore=capsule(.076,.46,skin);fore.position.y=-.26;elbow.add(fore);
    wrist.position.y=-.52;elbow.add(wrist);
    const palm=mesh(new THREE.BoxGeometry(.14,.19,.08),skin);palm.position.y=-.08;wrist.add(palm);
    for(let i=0;i<4;i++){const finger=capsule(.012,.12,skin);finger.position.set((i-1.5)*.028,-.18,.01);wrist.add(finger)}
  };
  addArm(-1,leftShoulder,leftElbow,leftWrist);addArm(1,rightShoulder,rightElbow,rightWrist);
  const addLeg=(side:-1|1,hip:THREE.Group,knee:THREE.Group,ankle:THREE.Group)=>{
    hip.position.set(side*hipX,-.1,0);pelvis.add(hip);
    const thigh=capsule(.115,.76,pants);thigh.position.y=-.42;hip.add(thigh);
    knee.position.y=-.82;hip.add(knee);
    const shin=capsule(.098,.72,pants);shin.position.y=-.4;knee.add(shin);
    ankle.position.y=-.78;knee.add(ankle);
    const foot=mesh(new THREE.BoxGeometry(.23,.15,.46),shoeMat);foot.position.set(0,-.07,.13);ankle.add(foot);
  };
  addLeg(-1,leftHip,leftKnee,leftAnkle);addLeg(1,rightHip,rightKnee,rightAnkle);
  root.scale.setScalar(1.13);
  return{root,pelvis,spine,chest,neck,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftWrist,rightWrist,leftHip,rightHip,leftKnee,rightKnee,leftAnkle,rightAnkle,leftEye,rightEye};
}

function poseRig(r:Rig,time:number,moving:boolean,running:boolean,power:number){
  const gait=time*(running?11:7.2);
  const stride=moving?(running?.82:.54):.035;
  const swing=Math.sin(gait)*stride;
  const counter=Math.sin(gait+Math.PI)*stride;
  const bounce=moving?Math.abs(Math.sin(gait))* (running?.045:.026):Math.sin(time*1.7)*.008;
  r.pelvis.position.y=.84+bounce;
  r.pelvis.rotation.z=moving?Math.sin(gait)*.025:Math.sin(time*.5)*.008;
  r.spine.rotation.y=moving?Math.sin(gait)*.035:Math.sin(time*.4)*.018;
  r.chest.rotation.z=moving?Math.sin(gait+Math.PI)*.035:Math.sin(time*.8)*.012;
  r.neck.rotation.y=moving?Math.sin(gait)*.025:Math.sin(time*.45)*.035;
  r.head.rotation.y=moving?Math.sin(gait)*.035:Math.sin(time*.42)*.11;
  r.head.rotation.x=moving?-.025:Math.sin(time*.74)*.02;

  r.leftHip.rotation.x=swing; r.rightHip.rotation.x=counter;
  r.leftKnee.rotation.x=moving?Math.max(0,-Math.sin(gait))*(running?1.0:.7):.01;
  r.rightKnee.rotation.x=moving?Math.max(0,Math.sin(gait))*(running?1.0:.7):.01;
  r.leftAnkle.rotation.x=-r.leftKnee.rotation.x*.45; r.rightAnkle.rotation.x=-r.rightKnee.rotation.x*.45;
  r.leftShoulder.rotation.x=counter*.85; r.rightShoulder.rotation.x=swing*.85;
  r.leftShoulder.rotation.z=.045; r.rightShoulder.rotation.z=-.045;
  r.leftElbow.rotation.x=moving?-.22-Math.max(0,counter)*.28:-.1;
  r.rightElbow.rotation.x=moving?-.22-Math.max(0,swing)*.28:-.1;
  r.leftWrist.rotation.z=moving?Math.sin(gait)*.08:Math.sin(time*.9)*.03;
  r.rightWrist.rotation.z=moving?-Math.sin(gait)*.08:-Math.sin(time*.9)*.03;
  if(power>0){const p=Math.min(1,power*1.8);r.leftShoulder.rotation.z=THREE.MathUtils.lerp(r.leftShoulder.rotation.z,1.2,p);r.rightShoulder.rotation.z=THREE.MathUtils.lerp(r.rightShoulder.rotation.z,-1.2,p);r.leftElbow.rotation.x=-.55*p;r.rightElbow.rotation.x=-.55*p;r.chest.rotation.x=-.08*p}
  const blink=Math.sin(time*3.1)>0.988?.16:1;r.leftEye.scale.y=blink;r.rightEye.scale.y=blink;
}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');if(!root)throw new Error('Missing #app mount');
  const epoch=root.dataset.pageEpoch??'';let disposed=false;let renderer:THREE.WebGLRenderer|null=null;let raf=0;
  const isCurrent=()=>!disposed&&root.dataset.pageEpoch===epoch&&root.dataset.pageOwner===OWNER;
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);renderer?.dispose();window.removeEventListener('resize',resize);const host=window as CleanupHost;if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null};
  (window as CleanupHost).__rbPageCleanup=cleanup;window.addEventListener('pagehide',cleanup,{once:true});window.addEventListener('beforeunload',cleanup,{once:true});
  const user=getAuthSnapshot().user;if(!user){location.replace('/tap-in.html?next=%2Favatar.html');return}
  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});if(error)throw error;if(!isCurrent())return;
  const snap=(data??{}) as Snapshot;const avatar=snap.avatar??{};const name=String(avatar.display_name??snap.profile?.display_name??snap.profile?.username??'Rich Avatar');const kind=String(avatar.character_type??'male');const isGirl=kind==='female'||String(avatar.metadata?.gender??'').toLowerCase()==='girl';const aura=String(avatar.aura??'Emerald Gold');const outfit=avatar.outfit??{};const build=String(outfit.build??'athletic');const style=String(outfit.style??'street');
  root.innerHTML=`<main class="al-shell"><header><div><small>RICH BIZNESS AVATAR WORLD</small><h1>Avatar Lobby</h1></div><nav><a href="/avatar-characters.html">EDIT CHARACTER</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>FULL BODY · LIVE MOTION</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div><div class="al-help">MOVE · RUN · JUMP · POWER</div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">RUN</button><button data-action="power">POWER</button><button data-action="idle">IDLE</button></div></section></main>`;

  const canvas=root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;const scene=new THREE.Scene();scene.background=new THREE.Color(0xb7d4c0);scene.fog=new THREE.Fog(0xb7d4c0,22,55);
  const camera=new THREE.PerspectiveCamera(43,1,.1,120);camera.position.set(0,3.2,8.9);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2.25));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.55;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xffffff,0x5c7461,3.35));const sun=new THREE.DirectionalLight(0xffffff,4.4);sun.position.set(5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);const green=new THREE.PointLight(0x4dff9d,36,20,2);green.position.set(-4,4,2);scene.add(green);const gold=new THREE.PointLight(0xffd66c,26,16,2);gold.position.set(4,2.5,3);scene.add(gold);
  const ground=mesh(new THREE.PlaneGeometry(56,56),new THREE.MeshStandardMaterial({color:0xc7dbc9,roughness:.84,metalness:.01}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  const road=mesh(new THREE.PlaneGeometry(8,44),new THREE.MeshStandardMaterial({color:0x77877b,roughness:.76}));road.rotation.x=-Math.PI/2;road.position.set(0,.012,-8);scene.add(road);
  const stripeMat=new THREE.MeshBasicMaterial({color:0xf2df7d});for(let z=-26;z<12;z+=4){const stripe=mesh(new THREE.PlaneGeometry(.12,1.6),stripeMat);stripe.rotation.x=-Math.PI/2;stripe.position.set(0,.02,z);scene.add(stripe)}
  const city=new THREE.Group();for(let i=0;i<16;i++){const h=3+Math.random()*6;const b=mesh(new THREE.BoxGeometry(1.2+Math.random()*1.4,h,1.2+Math.random()*1.4),new THREE.MeshStandardMaterial({color:i%2?0x91aa96:0x7d9a84,roughness:.76,metalness:.02,emissive:i%5===0?0x153b22:0x000000,emissiveIntensity:.16}));const side=i%2===0?-1:1;b.position.set(side*(6+Math.random()*8),h/2,(Math.random()-.5)*32-6);city.add(b)}scene.add(city);

  const accent=aura==='Neon Phantom'?0x8058ff:aura==='Diamond Mist'?0x8fe8ff:0x2cff8c;const rig=createRig(isGirl?'female':'male',accent,build,style);rig.root.position.set(0,1.42,1);scene.add(rig.root);
  const joystick=root.querySelector<HTMLElement>('#joystick')!,stick=root.querySelector<HTMLElement>('#stick')!;let joyX=0,joyY=0,run=false,jumpVel=0,power=0,dragging=false;
  const setJoy=(clientX:number,clientY:number)=>{const r=joystick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(clientX-cx)/(r.width*.35),y=(clientY-cy)/(r.height*.35);const len=Math.hypot(x,y);if(len>1){x/=len;y/=len}joyX=x;joyY=y;stick.style.transform=`translate(${x*28}px,${y*28}px)`};
  joystick.onpointerdown=e=>{dragging=true;joystick.setPointerCapture(e.pointerId);setJoy(e.clientX,e.clientY)};joystick.onpointermove=e=>{if(dragging)setJoy(e.clientX,e.clientY)};const release=()=>{dragging=false;joyX=joyY=0;stick.style.transform='translate(0,0)'};joystick.onpointerup=release;joystick.onpointercancel=release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn=>btn.onclick=()=>{const action=btn.dataset.action;if(action==='jump'&&rig.root.position.y<=1.44)jumpVel=.14;if(action==='run')run=!run;if(action==='power')power=1;if(action==='idle'){joyX=joyY=0;run=false}});
  const clock=new THREE.Clock(),targetCam=new THREE.Vector3(),lookAt=new THREE.Vector3();let elapsed=0;
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer!.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix()};window.addEventListener('resize',resize);resize();
  const loop=()=>{if(disposed)return;const dt=Math.min(clock.getDelta(),.033);elapsed+=dt;const magnitude=Math.hypot(joyX,joyY);const moving=magnitude>.05;const speed=(run?4.8:2.65)*dt*Math.min(1,magnitude||1);if(moving){const angle=Math.atan2(joyX,-joyY);rig.root.rotation.y=THREE.MathUtils.lerp(rig.root.rotation.y,angle,.2);rig.root.position.x+=Math.sin(angle)*speed;rig.root.position.z+=Math.cos(angle)*speed;rig.root.position.x=THREE.MathUtils.clamp(rig.root.position.x,-8,8);rig.root.position.z=THREE.MathUtils.clamp(rig.root.position.z,-16,8)}jumpVel-=.007;rig.root.position.y+=jumpVel;if(rig.root.position.y<1.42){rig.root.position.y=1.42;jumpVel=0}power=Math.max(0,power-dt*1.35);poseRig(rig,elapsed,moving,run,power);targetCam.set(rig.root.position.x,rig.root.position.y+2.2,rig.root.position.z+8.15);camera.position.lerp(targetCam,.085);lookAt.set(rig.root.position.x,rig.root.position.y+1.4,rig.root.position.z);camera.lookAt(lookAt);renderer!.render(scene,camera);raf=requestAnimationFrame(loop)};loop();
}

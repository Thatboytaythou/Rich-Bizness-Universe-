import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.lobby.css';

type CleanupHost=Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};
type Snapshot={profile?:Record<string,any>;avatar?:Record<string,any>};
const OWNER='rich-bizness-avatar-lobby-v1';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]??c));

type Rig={root:THREE.Group;hips:THREE.Group;chest:THREE.Group;head:THREE.Group;leftShoulder:THREE.Group;rightShoulder:THREE.Group;leftElbow:THREE.Group;rightElbow:THREE.Group;leftHip:THREE.Group;rightHip:THREE.Group;leftKnee:THREE.Group;rightKnee:THREE.Group};

function capsule(radius:number,length:number,material:THREE.Material){const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,10,24),material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}

function buildAvatar(kind:'male'|'female',accent:number,build:string,style:string):Rig{
  const root=new THREE.Group(),hips=new THREE.Group(),chest=new THREE.Group(),head=new THREE.Group(),leftShoulder=new THREE.Group(),rightShoulder=new THREE.Group(),leftElbow=new THREE.Group(),rightElbow=new THREE.Group(),leftHip=new THREE.Group(),rightHip=new THREE.Group(),leftKnee=new THREE.Group(),rightKnee=new THREE.Group();
  const skin=new THREE.MeshPhysicalMaterial({color:kind==='female'?0xa06c50:0x8f6045,roughness:.42,metalness:.01,clearcoat:.18,clearcoatRoughness:.5});
  const top=new THREE.MeshPhysicalMaterial({color:accent,roughness:.26,metalness:style==='cyber'?.28:.08,clearcoat:.3,clearcoatRoughness:.36});
  const dark=new THREE.MeshPhysicalMaterial({color:style==='boss'?0x17191a:0x151a18,roughness:.48,metalness:.06,clearcoat:.08});
  const shoeMat=new THREE.MeshPhysicalMaterial({color:0x0e1110,roughness:.32,metalness:.18,clearcoat:.38});
  const hairMat=new THREE.MeshStandardMaterial({color:0x121212,roughness:.5});
  const bodyScale=build==='lean'?.94:build==='heroic'?1.04:1;const shoulderWidth=(kind==='female'?.44:.5)*bodyScale;const hipWidth=kind==='female'?.235:.215;
  root.add(hips);hips.position.y=.72;
  const pelvis=new THREE.Mesh(new THREE.SphereGeometry(.33,28,22),dark);pelvis.scale.set(kind==='female'?1.08:.98,.58,.72);hips.add(pelvis);
  chest.position.y=.72;hips.add(chest);const torso=capsule(kind==='female'?.34:.38,.9,top);torso.scale.set(bodyScale,1,.58);torso.position.y=.42;chest.add(torso);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.11,.135,.28,20),skin);neck.position.y=1.05;chest.add(neck);
  head.position.y=1.33;chest.add(head);const skull=new THREE.Mesh(new THREE.SphereGeometry(.31,40,30),skin);skull.scale.set(.9,1.07,.93);head.add(skull);const jaw=new THREE.Mesh(new THREE.SphereGeometry(.24,30,22),skin);jaw.scale.set(.9,.56,.82);jaw.position.set(0,-.17,.02);head.add(jaw);const hair=new THREE.Mesh(new THREE.SphereGeometry(.32,30,18,0,Math.PI*2,0,Math.PI*.5),hairMat);hair.position.y=.17;hair.scale.set(1.02,.58,1.01);head.add(hair);
  const addArm=(side:-1|1,shoulderJoint:THREE.Group,elbowJoint:THREE.Group)=>{shoulderJoint.position.set(side*shoulderWidth,.72,0);chest.add(shoulderJoint);const upper=capsule(.09,.55,skin);upper.position.y=-.3;shoulderJoint.add(upper);elbowJoint.position.y=-.62;shoulderJoint.add(elbowJoint);const forearm=capsule(.082,.5,skin);forearm.position.y=-.28;elbowJoint.add(forearm);const hand=new THREE.Mesh(new THREE.SphereGeometry(.095,18,14),skin);hand.scale.set(.78,1.05,.78);hand.position.y=-.58;elbowJoint.add(hand);};
  addArm(-1,leftShoulder,leftElbow);addArm(1,rightShoulder,rightElbow);
  const addLeg=(side:-1|1,hipJoint:THREE.Group,kneeJoint:THREE.Group)=>{hipJoint.position.set(side*hipWidth,-.08,0);hips.add(hipJoint);const thigh=capsule(.115,.78,dark);thigh.position.y=-.43;hipJoint.add(thigh);kneeJoint.position.y=-.84;hipJoint.add(kneeJoint);const shin=capsule(.102,.74,dark);shin.position.y=-.4;kneeJoint.add(shin);const shoe=new THREE.Mesh(new THREE.BoxGeometry(.24,.16,.46),shoeMat);shoe.position.set(0,-.84,.11);kneeJoint.add(shoe);};
  addLeg(-1,leftHip,leftKnee);addLeg(1,rightHip,rightKnee);
  root.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;m.castShadow=true;m.receiveShadow=true;}});
  return{root,hips,chest,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftHip,rightHip,leftKnee,rightKnee};
}

function poseRig(rig:Rig,t:number,moving:boolean,run:boolean,power:number){
  const gait=t*(run?10:6.2),amp=moving?(run?.68:.42):0;
  rig.chest.position.y=.72+Math.sin(t*1.9)*.014;
  rig.chest.rotation.z=moving?Math.sin(gait)*.025:Math.sin(t*.8)*.014;
  rig.head.rotation.y=moving?Math.sin(gait*.5)*.06:Math.sin(t*.45)*.14;
  rig.leftHip.rotation.x=Math.sin(gait)*amp;rig.rightHip.rotation.x=-Math.sin(gait)*amp;
  rig.leftKnee.rotation.x=Math.max(0,-Math.sin(gait))*amp*.9;rig.rightKnee.rotation.x=Math.max(0,Math.sin(gait))*amp*.9;
  rig.leftShoulder.rotation.x=-Math.sin(gait)*amp*.72;rig.rightShoulder.rotation.x=Math.sin(gait)*amp*.72;
  rig.leftShoulder.rotation.z=.05;rig.rightShoulder.rotation.z=-.05;
  rig.leftElbow.rotation.x=-.12-Math.max(0,Math.sin(gait))*amp*.28;rig.rightElbow.rotation.x=-.12-Math.max(0,-Math.sin(gait))*amp*.28;
  if(power>0){rig.leftShoulder.rotation.z=.7*power;rig.rightShoulder.rotation.z=-.7*power;rig.leftElbow.rotation.z=-.42*power;rig.rightElbow.rotation.z=.42*power;rig.head.rotation.x=-.08*power;}
}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');if(!root)throw new Error('Missing #app mount');
  const epoch=root.dataset.pageEpoch??'';let disposed=false;let renderer:THREE.WebGLRenderer|null=null;let raf=0;
  const isCurrent=()=>!disposed&&root.dataset.pageEpoch===epoch&&root.dataset.pageOwner===OWNER;
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);renderer?.dispose();window.removeEventListener('resize',resize);const host=window as CleanupHost;if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null;};
  (window as CleanupHost).__rbPageCleanup=cleanup;window.addEventListener('pagehide',cleanup,{once:true});window.addEventListener('beforeunload',cleanup,{once:true});
  const user=getAuthSnapshot().user;if(!user){location.replace('/tap-in.html?next=%2Favatar.html');return;}
  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});if(error)throw error;if(!isCurrent())return;
  const snap=(data??{}) as Snapshot;const avatar=snap.avatar??{};const name=String(avatar.display_name??snap.profile?.display_name??snap.profile?.username??'Rich Avatar');const kind=String(avatar.character_type??'male');const isGirl=kind==='female'||String(avatar.metadata?.gender??'').toLowerCase()==='girl';const aura=String(avatar.aura??'Emerald Gold');const outfit=avatar.outfit??{};const build=String(outfit.build??'athletic');const style=String(outfit.style??'street');
  root.innerHTML=`<main class="al-shell"><header><div><small>RICH BIZNESS AVATAR WORLD</small><h1>Avatar Lobby</h1></div><nav><a href="/avatar-characters.html">EDIT CHARACTER</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>FULL BODY LIVE WORLD</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">RUN</button><button data-action="power">POWER</button><button data-action="idle">IDLE</button></div></section></main>`;
  const canvas=root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;const scene=new THREE.Scene();scene.background=new THREE.Color(0xc8dfcf);scene.fog=new THREE.Fog(0xc8dfcf,20,48);
  const camera=new THREE.PerspectiveCamera(42,1,.1,120);camera.position.set(0,2.8,9.2);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.36;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xffffff,0x5c7161,2.8));const sun=new THREE.DirectionalLight(0xffffff,3.5);sun.position.set(5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);const green=new THREE.PointLight(0x55ff9f,28,20,2);green.position.set(-4,4,2);scene.add(green);const gold=new THREE.PointLight(0xffd86c,20,18,2);gold.position.set(4,2.5,3);scene.add(gold);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(56,56),new THREE.MeshStandardMaterial({color:0xe1eee4,roughness:.86,metalness:.01}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(8,44),new THREE.MeshStandardMaterial({color:0x83958a,roughness:.74}));road.rotation.x=-Math.PI/2;road.position.set(0,.012,-8);scene.add(road);
  const city=new THREE.Group();for(let i=0;i<18;i++){const h=3+Math.random()*6;const b=new THREE.Mesh(new THREE.BoxGeometry(1.2+Math.random()*1.3,h,1.2+Math.random()*1.3),new THREE.MeshStandardMaterial({color:i%2?0xa4b9a8:0x93ab99,roughness:.78,metalness:.02}));const side=i%2===0?-1:1;b.position.set(side*(6+Math.random()*8),h/2,(Math.random()-.5)*30-6);city.add(b);}scene.add(city);
  const accent=aura==='Neon Phantom'?0x8058ff:aura==='Diamond Mist'?0x8fe8ff:0x2cff8c;const rig=buildAvatar(isGirl?'female':'male',accent,build,style);rig.root.position.set(0,1.5,1);scene.add(rig.root);
  const joystick=root.querySelector<HTMLElement>('#joystick')!;const stick=root.querySelector<HTMLElement>('#stick')!;let joyX=0,joyY=0,run=false,jumpVel=0,power=0,dragging=false;
  const setJoy=(clientX:number,clientY:number)=>{const r=joystick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(clientX-cx)/(r.width*.35),y=(clientY-cy)/(r.height*.35);const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joyX=x;joyY=y;stick.style.transform=`translate(${x*28}px,${y*28}px)`;};
  joystick.onpointerdown=e=>{dragging=true;joystick.setPointerCapture(e.pointerId);setJoy(e.clientX,e.clientY);};joystick.onpointermove=e=>{if(dragging)setJoy(e.clientX,e.clientY);};const release=()=>{dragging=false;joyX=joyY=0;stick.style.transform='translate(0,0)';};joystick.onpointerup=release;joystick.onpointercancel=release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn=>btn.onclick=()=>{const action=btn.dataset.action;if(action==='jump'&&rig.root.position.y<=1.52)jumpVel=.15;if(action==='run')run=!run;if(action==='power')power=1;if(action==='idle'){joyX=joyY=0;run=false;}});
  const clock=new THREE.Clock(),targetCam=new THREE.Vector3(),lookAt=new THREE.Vector3();const resize=()=>{const r=canvas.getBoundingClientRect();renderer!.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();};window.addEventListener('resize',resize);resize();
  let elapsed=0;const loop=()=>{if(disposed)return;const dt=Math.min(clock.getDelta(),.033);elapsed+=dt;const speed=(run?4.8:2.6)*dt;const moving=Math.hypot(joyX,joyY)>.05;if(moving){const angle=Math.atan2(joyX,-joyY);rig.root.rotation.y=THREE.MathUtils.lerp(rig.root.rotation.y,angle,.18);rig.root.position.x+=Math.sin(angle)*speed;rig.root.position.z+=Math.cos(angle)*speed;rig.root.position.x=THREE.MathUtils.clamp(rig.root.position.x,-8,8);rig.root.position.z=THREE.MathUtils.clamp(rig.root.position.z,-16,8);}jumpVel-=.007;rig.root.position.y+=jumpVel;if(rig.root.position.y<1.5){rig.root.position.y=1.5;jumpVel=0;}power=Math.max(0,power-dt*1.5);poseRig(rig,elapsed,moving,run,power);targetCam.set(rig.root.position.x,rig.root.position.y+2.2,rig.root.position.z+8.4);camera.position.lerp(targetCam,.085);lookAt.set(rig.root.position.x,rig.root.position.y+1.3,rig.root.position.z);camera.lookAt(lookAt);renderer!.render(scene,camera);raf=requestAnimationFrame(loop);};loop();
}

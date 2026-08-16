import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.lobby.css';

type CleanupHost=Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};
type Snapshot={profile?:Record<string,any>;avatar?:Record<string,any>};
const OWNER='rich-bizness-avatar-lobby-v1';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]??c));

function buildAvatar(kind:'male'|'female',accent:number,build:string,style:string){
  const group=new THREE.Group();
  const skin=new THREE.MeshPhysicalMaterial({color:kind==='female'?0x9a664c:0x8d5d42,roughness:.46,clearcoat:.12,clearcoatRoughness:.55});
  const top=new THREE.MeshPhysicalMaterial({color:accent,roughness:.22,metalness:.18,clearcoat:.58,clearcoatRoughness:.18});
  const dark=new THREE.MeshPhysicalMaterial({color:style==='boss'?0x141717:0x0f1513,roughness:.34,metalness:.2,clearcoat:.22});
  const hairMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:.26});
  const scaleX=build==='lean'?.91:build==='heroic'?1.035:1;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.355,40,30),skin);head.scale.set(.92,1.05,.94);head.position.y=2.92;group.add(head);
  const jaw=new THREE.Mesh(new THREE.SphereGeometry(.29,32,24),skin);jaw.scale.set(.9,.62,.82);jaw.position.set(0,2.73,.03);group.add(jaw);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.125,.15,.34,24),skin);neck.position.y=2.46;group.add(neck);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(kind==='female'?.39:.44,1.06,12,28),top);torso.position.y=1.72;torso.scale.set(scaleX,1,.56);group.add(torso);
  const waist=new THREE.Mesh(new THREE.CylinderGeometry(.33,.38,.42,28),dark);waist.position.y=.95;waist.scale.x=kind==='female'?1.04:.94;group.add(waist);
  const shoulder=(kind==='female'?.48:.54)*scaleX;
  for(const s of [-1,1]){
    const ua=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.7,10,20),skin);ua.position.set(s*shoulder,1.74,0);group.add(ua);
    const la=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.64,10,20),skin);la.position.set(s*shoulder,1.08,.015);group.add(la);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.115,20,16),skin);hand.scale.set(.82,1.1,.82);hand.position.set(s*shoulder,.69,.02);group.add(hand);
    const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.135,.94,10,20),dark);thigh.position.set(s*.205,.22,0);group.add(thigh);
    const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.9,10,20),dark);shin.position.set(s*.205,-.66,0);group.add(shin);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.27,.16,.49),dark);shoe.position.set(s*.205,-1.15,.13);group.add(shoe);
  }
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.365,32,20,0,Math.PI*2,0,Math.PI*.48),hairMat);hair.position.set(0,3.125,-.01);hair.scale.set(1.03,.58,1.02);group.add(hair);
  const white=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5});const eyeDark=new THREE.MeshStandardMaterial({color:0x17120f,roughness:.45});
  for(const x of [-.125,.125]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.043,16,12),white);eye.position.set(x,2.93,.325);group.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.019,12,10),eyeDark);pupil.position.set(x,2.93,.361);group.add(pupil);}
  group.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;m.castShadow=true;m.receiveShadow=true;}});
  return group;
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
  root.innerHTML=`<main class="al-shell"><header><div><small>RICH BIZNESS AVATAR WORLD</small><h1>Avatar Lobby</h1><p>Your saved character, one clean world.</p></div><nav><a href="/avatar-characters.html">EDIT CHARACTER</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>LIVE WORLD</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div><div class="al-help">MOVE · RUN · JUMP · POWER</div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">RUN</button><button data-action="power">POWER</button><button data-action="idle">IDLE</button></div></section></main>`;
  const canvas=root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;const scene=new THREE.Scene();scene.background=new THREE.Color(0x7ca889);scene.fog=new THREE.Fog(0x7ca889,18,42);
  const camera=new THREE.PerspectiveCamera(44,1,.1,120);camera.position.set(0,3.15,8.8);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.62;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xf5fff8,0x35523c,3.15));const sun=new THREE.DirectionalLight(0xffffff,4.25);sun.position.set(5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);const green=new THREE.PointLight(0x42ff9a,44,20,2);green.position.set(-4,4,2);scene.add(green);const gold=new THREE.PointLight(0xffd55c,32,16,2);gold.position.set(4,2.5,3);scene.add(gold);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(52,52),new THREE.MeshStandardMaterial({color:0xbfd7c4,roughness:.82,metalness:.02}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const roadMat=new THREE.MeshStandardMaterial({color:0x6d8472,roughness:.7});const road=new THREE.Mesh(new THREE.PlaneGeometry(8,40),roadMat);road.rotation.x=-Math.PI/2;road.position.set(0,.012,-8);scene.add(road);
  const stripeMat=new THREE.MeshBasicMaterial({color:0xe9dc77});for(let z=-24;z<12;z+=4){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.12,1.6),stripeMat);stripe.rotation.x=-Math.PI/2;stripe.position.set(0,.02,z);scene.add(stripe);}
  const city=new THREE.Group();for(let i=0;i<18;i++){const h=3+Math.random()*6;const b=new THREE.Mesh(new THREE.BoxGeometry(1.2+Math.random()*1.3,h,1.2+Math.random()*1.3),new THREE.MeshStandardMaterial({color:i%2?0x7d9a84:0x90aa96,roughness:.74,metalness:.03,emissive:i%5===0?0x193822:0x000000,emissiveIntensity:.22}));const side=i%2===0?-1:1;b.position.set(side*(6+Math.random()*8),h/2,(Math.random()-.5)*30-6);city.add(b);}scene.add(city);
  const accent=aura==='Neon Phantom'?0x8058ff:aura==='Diamond Mist'?0x8fe8ff:0x2cff8c;const actor=buildAvatar(isGirl?'female':'male',accent,build,style);actor.position.set(0,1.18,1);scene.add(actor);
  const joystick=root.querySelector<HTMLElement>('#joystick')!;const stick=root.querySelector<HTMLElement>('#stick')!;let joyX=0,joyY=0,run=false,jumpVel=0,power=0;let dragging=false;
  const setJoy=(clientX:number,clientY:number)=>{const r=joystick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(clientX-cx)/(r.width*.35),y=(clientY-cy)/(r.height*.35);const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joyX=x;joyY=y;stick.style.transform=`translate(${x*28}px,${y*28}px)`;};
  joystick.onpointerdown=e=>{dragging=true;joystick.setPointerCapture(e.pointerId);setJoy(e.clientX,e.clientY);};joystick.onpointermove=e=>{if(dragging)setJoy(e.clientX,e.clientY);};const release=()=>{dragging=false;joyX=joyY=0;stick.style.transform='translate(0,0)';};joystick.onpointerup=release;joystick.onpointercancel=release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn=>btn.onclick=()=>{const action=btn.dataset.action;if(action==='jump'&&actor.position.y<=1.2)jumpVel=.14;if(action==='run')run=!run;if(action==='power')power=1;if(action==='idle'){joyX=joyY=0;run=false;}});
  const clock=new THREE.Clock();const targetCam=new THREE.Vector3();const lookAt=new THREE.Vector3();const resize=()=>{const r=canvas.getBoundingClientRect();renderer!.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();};window.addEventListener('resize',resize);resize();
  const loop=()=>{if(disposed)return;const dt=Math.min(clock.getDelta(),.033);const speed=(run?4.8:2.6)*dt;const moving=Math.hypot(joyX,joyY)>.05;if(moving){const angle=Math.atan2(joyX,-joyY);actor.rotation.y=THREE.MathUtils.lerp(actor.rotation.y,angle,.18);actor.position.x+=Math.sin(angle)*speed;actor.position.z+=Math.cos(angle)*speed;actor.position.x=THREE.MathUtils.clamp(actor.position.x,-8,8);actor.position.z=THREE.MathUtils.clamp(actor.position.z,-16,8);const gait=performance.now()*(run?.018:.012);actor.rotation.z=Math.sin(gait)*(run?.028:.016);actor.position.y+=Math.abs(Math.sin(gait))*.002;}jumpVel-=.007;actor.position.y+=jumpVel;if(actor.position.y<1.18){actor.position.y=1.18;jumpVel=0;}power=Math.max(0,power-dt*1.5);actor.scale.setScalar(1+power*.035);targetCam.set(actor.position.x,actor.position.y+2.25,actor.position.z+8.15);camera.position.lerp(targetCam,.085);lookAt.set(actor.position.x,actor.position.y+1.45,actor.position.z);camera.lookAt(lookAt);renderer!.render(scene,camera);raf=requestAnimationFrame(loop);};loop();
}

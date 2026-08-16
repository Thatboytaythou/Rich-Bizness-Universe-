import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.lobby.css';

type CleanupHost=Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};
type Snapshot={profile?:Record<string,any>;avatar?:Record<string,any>};
const OWNER='rich-bizness-avatar-lobby-v1';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]??c));

function buildAvatar(kind:'male'|'female',accent:number){
  const group=new THREE.Group();
  const skin=new THREE.MeshPhysicalMaterial({color:kind==='female'?0x9a6448:0x89583d,roughness:.5,clearcoat:.1});
  const top=new THREE.MeshPhysicalMaterial({color:accent,roughness:.24,metalness:.22,clearcoat:.48});
  const dark=new THREE.MeshStandardMaterial({color:0x101715,roughness:.45,metalness:.2});
  const head=new THREE.Mesh(new THREE.SphereGeometry(.38,32,24),skin);head.scale.set(.9,1.04,.9);head.position.y=2.7;group.add(head);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.28,20),skin);neck.position.y=2.28;group.add(neck);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(kind==='female'?.44:.49,.96,10,24),top);torso.scale.z=.6;torso.position.y=1.62;group.add(torso);
  const hip=new THREE.Mesh(new THREE.SphereGeometry(.4,24,18),dark);hip.scale.set(kind==='female'?1.05:.92,.58,.7);hip.position.y=.88;group.add(hip);
  const shoulder=kind==='female'?.52:.58;
  for(const s of [-1,1]){
    const ua=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.64,8,18),skin);ua.position.set(s*shoulder,1.72,0);group.add(ua);
    const la=new THREE.Mesh(new THREE.CapsuleGeometry(.108,.55,8,18),skin);la.position.set(s*shoulder,1.07,0);group.add(la);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.13,18,14),skin);hand.position.set(s*shoulder,.72,0);group.add(hand);
    const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.155,.78,8,18),dark);thigh.position.set(s*.22,.34,0);group.add(thigh);
    const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.72,8,18),dark);shin.position.set(s*.22,-.45,0);group.add(shin);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.5),dark);shoe.position.set(s*.22,-.93,.12);group.add(shoe);
  }
  const hairMat=new THREE.MeshStandardMaterial({color:0x0d0d0d,roughness:.36});
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.39,28,16,0,Math.PI*2,0,Math.PI*.48),hairMat);hair.position.set(0,2.9,0);hair.scale.set(1.04,.64,1.02);group.add(hair);
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
  const snap=(data??{}) as Snapshot;const avatar=snap.avatar??{};const name=String(avatar.display_name??snap.profile?.display_name??snap.profile?.username??'Rich Avatar');const kind:String=String(avatar.character_type??'male');const isGirl=kind==='female'||String(avatar.metadata?.gender??'').toLowerCase()==='girl';const aura=String(avatar.aura??'Emerald Gold');
  root.innerHTML=`<main class="al-shell"><header><div><small>RICH BIZNESS AVATAR WORLD</small><h1>Avatar Lobby</h1></div><nav><a href="/avatar-characters.html">EDIT CHARACTER</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><canvas id="lobbyCanvas"></canvas><div class="al-id"><span>LIVE CHARACTER</span><strong>${esc(name)}</strong><em>${esc(aura)}</em></div><div class="al-help">DRAG JOYSTICK TO MOVE</div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">RUN</button><button data-action="power">POWER</button><button data-action="idle">IDLE</button></div></section></main>`;
  const canvas=root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b3f29);scene.fog=new THREE.Fog(0x1b3f29,14,34);
  const camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,3.2,8.4);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2.25));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.42;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xd8ffe5,0x19311f,2.4));const sun=new THREE.DirectionalLight(0xffffff,3.4);sun.position.set(5,9,6);sun.castShadow=true;scene.add(sun);const green=new THREE.PointLight(0x42ff9a,38,18,2);green.position.set(-4,3,1);scene.add(green);const gold=new THREE.PointLight(0xffd55c,26,15,2);gold.position.set(4,2,2);scene.add(gold);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(42,42),new THREE.MeshStandardMaterial({color:0x234a30,roughness:.74,metalness:.03}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const pathMat=new THREE.MeshStandardMaterial({color:0x4f7258,roughness:.62,metalness:.06});for(let z=-12;z<10;z+=4){const p=new THREE.Mesh(new THREE.BoxGeometry(4.8,.05,2.2),pathMat);p.position.set(0,.025,z);scene.add(p);}const city=new THREE.Group();for(let i=0;i<22;i++){const h=2+Math.random()*7;const b=new THREE.Mesh(new THREE.BoxGeometry(1+Math.random()*1.5,h,1+Math.random()*1.5),new THREE.MeshStandardMaterial({color:i%3===0?0x355b3f:0x2a4833,roughness:.68,emissive:i%4===0?0x0b391c:0x000000,emissiveIntensity:.65}));b.position.set((Math.random()-.5)*24,h/2,(Math.random()-.5)*24-7);city.add(b);}scene.add(city);
  const accent=aura==='Neon Phantom'?0x8058ff:aura==='Diamond Mist'?0x8fe8ff:0x2cff8c;const actor=buildAvatar(isGirl?'female':'male',accent);actor.position.set(0,1.02,0);scene.add(actor);
  const joystick=root.querySelector<HTMLElement>('#joystick')!;const stick=root.querySelector<HTMLElement>('#stick')!;let joyX=0,joyY=0,run=false,jumpVel=0,power=0;let dragging=false;
  const setJoy=(clientX:number,clientY:number)=>{const r=joystick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(clientX-cx)/(r.width*.35),y=(clientY-cy)/(r.height*.35);const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joyX=x;joyY=y;stick.style.transform=`translate(${x*32}px,${y*32}px)`;};
  joystick.onpointerdown=e=>{dragging=true;joystick.setPointerCapture(e.pointerId);setJoy(e.clientX,e.clientY);};joystick.onpointermove=e=>{if(dragging)setJoy(e.clientX,e.clientY);};const release=()=>{dragging=false;joyX=joyY=0;stick.style.transform='translate(0,0)';};joystick.onpointerup=release;joystick.onpointercancel=release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn=>btn.onclick=()=>{const action=btn.dataset.action;if(action==='jump'&&actor.position.y<=1.03)jumpVel=.12;if(action==='run')run=!run;if(action==='power')power=1;if(action==='idle'){joyX=joyY=0;run=false;}});
  const clock=new THREE.Clock();const targetCam=new THREE.Vector3();const resize=()=>{const r=canvas.getBoundingClientRect();renderer!.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();};window.addEventListener('resize',resize);resize();
  const loop=()=>{if(disposed)return;const dt=Math.min(clock.getDelta(),.033);const speed=(run?4.2:2.3)*dt;const moving=Math.hypot(joyX,joyY)>.05;if(moving){const angle=Math.atan2(joyX,-joyY);actor.rotation.y=THREE.MathUtils.lerp(actor.rotation.y,angle,.16);actor.position.x+=Math.sin(angle)*speed;actor.position.z+=Math.cos(angle)*speed;actor.position.x=THREE.MathUtils.clamp(actor.position.x,-10,10);actor.position.z=THREE.MathUtils.clamp(actor.position.z,-10,10);actor.rotation.z=Math.sin(performance.now()*.012)*(run?.035:.02);}jumpVel-=.0065;actor.position.y+=jumpVel;if(actor.position.y<1.02){actor.position.y=1.02;jumpVel=0;}power=Math.max(0,power-dt*1.4);actor.scale.setScalar(1+power*.05);targetCam.set(actor.position.x,actor.position.y+2.15,actor.position.z+7.6);camera.position.lerp(targetCam,.075);camera.lookAt(actor.position.x,actor.position.y+1.15,actor.position.z);renderer!.render(scene,camera);raf=requestAnimationFrame(loop);};loop();
}
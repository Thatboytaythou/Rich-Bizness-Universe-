import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { mountHumanUi } from './avatar.human.ui';
import { createHumanRig, animateHumanRig, HumanRig } from './avatar.human.rig';
import { supabase } from '../../core/supabase/client';
import './avatar.css';

type Row = Record<string, any>;
type Preset = { preset_key:string; title:string; aura:string; outfit:string; motion:string; config:Record<string,string> };
type CharacterConfig={body_type:string;build:string;hair:string;style:string;smoke:string};

const CANONICAL_OWNER='rich-bizness-avatar-lobby-v3';
const palettes:Record<string,{primary:number;secondary:number;skin:number}> = {
  'Emerald Gold': { primary:0x31ff63, secondary:0xf7c948, skin:0x70442f },
  'Diamond Mist': { primary:0x8fe8ff, secondary:0xd99cff, skin:0x9a6248 },
  'Neon Phantom': { primary:0x56ffde, secondary:0x7740ff, skin:0x4f2d21 }
};

const disposeObject=(root:THREE.Object3D)=>root.traverse((object:any)=>{object.geometry?.dispose?.();if(Array.isArray(object.material))object.material.forEach((m:any)=>m.dispose?.());else object.material?.dispose?.();});

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root)throw new Error('Missing #app mount');
  const mountEpoch=root.dataset.pageEpoch??'';
  let disposed=false;
  const isCurrent=()=>!disposed&&root.dataset.pageEpoch===mountEpoch&&root.dataset.pageOwner===CANONICAL_OWNER;
  if(root.dataset.pageOwner!==CANONICAL_OWNER)return;

  const lifecycle=new AbortController();
  const signal=lifecycle.signal;
  const user=getAuthSnapshot().user;
  if(!user){location.replace('/tap-in.html?next=%2Favatar-characters.html');return;}

  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});
  if(!isCurrent())return;
  if(error)throw error;
  const s=(data??{}) as Row;
  const p=s.profile??{};
  const a=s.avatar??{};
  const level=s.level??{};
  const presets=(s.presets??[]) as Preset[];
  const requested=new URLSearchParams(location.search).get('preset');
  let preset=presets.find(x=>x.preset_key===requested)??presets.find(x=>x.preset_key===a.metadata?.preset_key)??presets[0];
  let aura=String(preset?.aura??a.aura??'Emerald Gold');
  const runtimeConfig:CharacterConfig={
    body_type:String(a.outfit?.character?.body_type??preset?.config.body_type??'male'),
    build:String(a.outfit?.character?.build??preset?.config.build??'athletic'),
    hair:String(a.outfit?.character?.hair??preset?.config.hair??'energy'),
    style:String(a.outfit?.character?.style??preset?.config.style??'human rig'),
    smoke:String(a.smoke?.mode??preset?.config.smoke??'cinematic')
  };
  const ui=mountHumanUi(root,{
    name:String(a.display_name??p.display_name??p.username??'Rich Avatar'),
    level:Number(level.level??a.level??p.rich_level??1),
    xp:Number(level.xp_total??a.xp??0),
    rank:String(level.rank_title??a.rank??p.rank_title??'Rookie Rich'),
    presets,
    aura,
    selectedPresetKey:preset?.preset_key??''
  });

  const renderer=new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.36;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x010201);
  scene.fog=new THREE.FogExp2(0x020402,.017);
  const camera=new THREE.PerspectiveCamera(38,1,.1,220);
  const actor=new THREE.Group();
  scene.add(actor);

  const ambient=new THREE.HemisphereLight(0xe8fff0,0x010201,3.4);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffffff,7.4);key.position.set(6,14,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0002;key.shadow.camera.left=-28;key.shadow.camera.right=28;key.shadow.camera.top=28;key.shadow.camera.bottom=-28;scene.add(key);
  const gold=new THREE.PointLight(0xf7c948,30,30);gold.position.set(5.5,5.5,5);scene.add(gold);
  const emerald=new THREE.PointLight(0x31ff63,46,32);emerald.position.set(-5.5,6,-2);scene.add(emerald);
  const faceLight=new THREE.SpotLight(0xffffff,38,24,.52,.52,1.3);faceLight.position.set(0,6,8);faceLight.target=actor;scene.add(faceLight,faceLight.target);

  const world=new THREE.Group();scene.add(world);
  const groundMat=new THREE.MeshPhysicalMaterial({color:0x050907,metalness:.56,roughness:.34,clearcoat:.38,clearcoatRoughness:.3});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
  const grid=new THREE.GridHelper(120,60,0x31ff63,0x102f18);grid.position.y=.018;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.15;world.add(grid);

  const roadMat=new THREE.MeshPhysicalMaterial({color:0x090c0b,metalness:.8,roughness:.24,clearcoat:.45});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(15,110),roadMat);road.rotation.x=-Math.PI/2;road.position.y=.028;road.receiveShadow=true;world.add(road);
  const roadCross=new THREE.Mesh(new THREE.PlaneGeometry(110,15),roadMat.clone());roadCross.rotation.x=-Math.PI/2;roadCross.position.y=.03;roadCross.receiveShadow=true;world.add(roadCross);

  const neonMat=new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.65});
  for(let i=-5;i<=5;i++){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.12,.02,5.1),neonMat.clone());stripe.position.set(0,.052,i*9.5);world.add(stripe);
    const crossStripe=new THREE.Mesh(new THREE.BoxGeometry(5.1,.02,.12),neonMat.clone());crossStripe.position.set(i*9.5,.052,0);world.add(crossStripe);
  }

  const podium=new THREE.Group();podium.position.set(0,.03,18);world.add(podium);
  const podiumBase=new THREE.Mesh(new THREE.CylinderGeometry(2.45,2.75,.22,96),new THREE.MeshPhysicalMaterial({color:0x0a120d,metalness:.75,roughness:.22,clearcoat:.55}));podiumBase.position.y=.11;podiumBase.receiveShadow=true;podium.add(podiumBase);
  const podiumRing=new THREE.Mesh(new THREE.TorusGeometry(2.1,.045,14,120),new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.88}));podiumRing.rotation.x=Math.PI/2;podiumRing.position.y=.24;podium.add(podiumRing);

  const buildingGeo=new THREE.BoxGeometry(1,1,1);
  const buildingMaterials=[0x061009,0x0a130d,0x0d1610,0x050d08].map(color=>new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.28}));
  const windowGeo=new THREE.PlaneGeometry(.2,.1);
  const windowMaterials=[0x31ff63,0xf7c948,0x8fe8ff,0x7740ff].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.82,side:THREE.DoubleSide}));
  const addTower=(x:number,z:number,w:number,h:number,d:number,index:number)=>{
    const tower=new THREE.Mesh(buildingGeo,buildingMaterials[index%buildingMaterials.length]);tower.scale.set(w,h,d);tower.position.set(x,h/2,z);tower.castShadow=true;tower.receiveShadow=true;world.add(tower);
    const faceZ=z+(z<0?d/2+.01:-d/2-.01),rotation=z<0?0:Math.PI;
    for(let row=1;row<Math.max(2,Math.floor(h/1.45));row++)for(let col=-1;col<=1;col++){
      const light=new THREE.Mesh(windowGeo,windowMaterials[(index+row+col+8)%windowMaterials.length]);light.position.set(x+col*w*.22,row*1.18,faceZ);light.rotation.y=rotation;world.add(light);
    }
  };
  for(let i=0;i<28;i++){
    const side=i%2===0?-1:1;
    const lane=side*(13+(i%4)*4.7);
    const depth=-50+(i*7)%100;
    addTower(lane,depth,3+(i%3)*1.05,6.5+(i%6)*2.15,3.2+(i%4)*.72,i);
  }

  const portalGroup=new THREE.Group();portalGroup.position.set(0,0,-28);world.add(portalGroup);
  const portalRing=new THREE.Mesh(new THREE.TorusGeometry(4.9,.16,18,160),new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.92}));portalRing.position.y=4.9;portalGroup.add(portalRing);
  const portalCore=new THREE.Mesh(new THREE.CircleGeometry(4.18,96),new THREE.MeshBasicMaterial({color:0x0d4021,transparent:true,opacity:.24,side:THREE.DoubleSide}));portalCore.position.y=4.9;portalCore.position.z=.08;portalGroup.add(portalCore);
  const portalLight=new THREE.PointLight(0x31ff63,78,27);portalLight.position.set(0,5,1);portalGroup.add(portalLight);

  const particleGeo=new THREE.BufferGeometry();
  const particleCount=560;const positions=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){positions[i*3]=(Math.random()-.5)*100;positions[i*3+1]=Math.random()*22+.4;positions[i*3+2]=(Math.random()-.5)*100;}
  particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x31ff63,size:.07,transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending}));world.add(particles);

  let rig={} as HumanRig;
  const disposeActor=()=>disposeObject(actor);
  function rebuild(){
    if(!isCurrent())return;
    disposeActor();actor.clear();
    const colors=palettes[aura]??palettes['Emerald Gold'];
    rig=createHumanRig(colors,runtimeConfig.body_type==='female');
    const buildScale=runtimeConfig.build==='heroic'?1.06:runtimeConfig.build==='street'?.985:1;
    rig.root.scale.set(buildScale,1,buildScale);
    actor.add(rig.root);
    emerald.color.setHex(colors.primary);podiumRing.material.color.setHex(colors.primary);portalRing.material.color.setHex(colors.primary);portalLight.color.setHex(colors.primary);(particles.material as THREE.PointsMaterial).color.setHex(colors.primary);
    (particles.material as THREE.PointsMaterial).opacity=runtimeConfig.smoke==='off'?.12:runtimeConfig.smoke==='heavy'?.82:.58;
    document.documentElement.style.setProperty('--avatar-accent',`#${colors.primary.toString(16).padStart(6,'0')}`);
  }
  rebuild();

  let yaw=0,pitch=.03,zoom=matchMedia('(max-width: 640px)').matches?8.9:8.2,drag=false,lastX=0,lastY=0,jump=0,grounded=true,action='none',until=0,touch={x:0,y:0},raf=0;
  const keys=new Set<string>();
  const clock=new THREE.Clock();
  const velocity=new THREE.Vector3();
  const targetVelocity=new THREE.Vector3();
  const cameraTarget=new THREE.Vector3();
  const cameraDesired=new THREE.Vector3();
  const trigger=(next:string)=>{if(!isCurrent())return;action=next;until=performance.now()+(next==='power'?2100:next==='combat'?1200:next==='dance'?2600:next==='smoke'?2200:1500);ui.state.textContent=next.toUpperCase();};
  const resize=()=>{if(!isCurrent())return;const width=Math.max(1,ui.canvas.clientWidth),height=Math.max(1,ui.canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  const ro=new ResizeObserver(resize);ro.observe(ui.canvas);resize();
  const kd=(event:KeyboardEvent)=>{if(!isCurrent())return;keys.add(event.code);if(event.code==='Space'&&grounded){event.preventDefault();jump=7.2;grounded=false;}if(event.code==='KeyQ')trigger('combat');if(event.code==='KeyE')trigger('power');};
  const ku=(event:KeyboardEvent)=>keys.delete(event.code);
  window.addEventListener('keydown',kd,{signal});window.addEventListener('keyup',ku,{signal});
  ui.canvas.addEventListener('pointerdown',event=>{if(!isCurrent())return;drag=true;lastX=event.clientX;lastY=event.clientY;ui.canvas.setPointerCapture(event.pointerId);},{signal});
  ui.canvas.addEventListener('pointermove',event=>{if(!isCurrent()||!drag)return;yaw-=(event.clientX-lastX)*.0065;pitch=Math.max(-.08,Math.min(.22,pitch+(event.clientY-lastY)*.003));lastX=event.clientX;lastY=event.clientY;},{signal});
  const stopDrag=()=>{drag=false;};ui.canvas.addEventListener('pointerup',stopDrag,{signal});ui.canvas.addEventListener('pointercancel',stopDrag,{signal});

  ui.onCamera=mode=>{if(!isCurrent())return;zoom=mode==='portrait'?4.8:mode==='street'?10.6:8.2;pitch=mode==='portrait'?.01:mode==='street'?.09:.03;};
  ui.onMotion=trigger;
  ui.onAction=next=>{if(!isCurrent())return;if(next==='jump'&&grounded){jump=7.2;grounded=false;}else if(next==='sprint')keys.add('ShiftLeft');else trigger(next);};
  ui.onActionEnd=next=>{if(next==='sprint')keys.delete('ShiftLeft');};
  ui.onJoystick=value=>{if(isCurrent())touch=value;};
  ui.onAura=value=>{if(!isCurrent())return;aura=value;rebuild();ui.refresh(preset,aura);};
  ui.onPreset=value=>{if(!isCurrent())return;preset=presets.find(x=>x.preset_key===value)??preset;aura=preset?.aura??aura;Object.assign(runtimeConfig,preset?.config??{});rebuild();ui.refresh(preset,aura);const url=new URL(location.href);url.searchParams.set('preset',preset?.preset_key??'');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);};
  ui.onBody=value=>{if(!isCurrent())return;runtimeConfig.body_type=value;rebuild();ui.status.textContent=`${value==='female'?'Girl':'Boy'} body rig active.`;};
  ui.onCustomization=value=>{if(!isCurrent())return;Object.assign(runtimeConfig,value);rebuild();ui.status.textContent='Character customization applied to the live 3D rig.';};
  ui.onReset=()=>{if(!isCurrent())return;yaw=0;pitch=.03;zoom=matchMedia('(max-width: 640px)').matches?8.9:8.2;actor.position.set(0,0,18);velocity.set(0,0,0);Object.assign(runtimeConfig,preset?.config??{body_type:'male',build:'athletic',hair:'energy',style:'human rig',smoke:'cinematic'});rebuild();ui.refresh(preset,aura);};
  ui.onSave=async()=>{if(!isCurrent())return;ui.status.textContent='Synchronizing cinematic human character…';const{error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:ui.nameInput.value.trim(),p_preset_key:preset?.preset_key??'boss',p_aura:aura,p_outfit:{preset:preset?.outfit??'Rich Street',character:runtimeConfig,rig:'human-v6-cinematic-world'},p_accessories:{signature:preset?.config?.signature??null,hair:runtimeConfig.hair,style:runtimeConfig.style},p_smoke:{mode:runtimeConfig.smoke,intensity:runtimeConfig.smoke==='heavy'?'elite':'cinematic'},p_emotes:{idle:true,power_up:true,combat_pose:true,free_roam:true,dance:true,smoke:true},p_character_type:runtimeConfig.body_type});if(!isCurrent())return;ui.status.textContent=saveError?saveError.message:'Character synced across Profile, Portal, Meta and the free-roam world.';};

  actor.position.set(0,0,18);
  const bounds=48;
  const loop=()=>{
    if(!isCurrent())return;
    raf=requestAnimationFrame(loop);if(document.hidden)return;
    const dt=Math.min(clock.getDelta(),.033),time=clock.elapsedTime;
    const ix=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touch.x;
    const iz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touch.y;
    const moving=Math.abs(ix)+Math.abs(iz)>.08,sprint=keys.has('ShiftLeft'),locomotion=!grounded?'jump':moving?(sprint?'run':'walk'):'idle';
    if(performance.now()>until)action='none';
    const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    targetVelocity.copy(right.multiplyScalar(ix)).add(forward.multiplyScalar(iz)).multiplyScalar(sprint?7.6:4.2);
    velocity.lerp(targetVelocity,Math.min(1,dt*9));actor.position.addScaledVector(velocity,dt);
    actor.position.x=Math.max(-bounds,Math.min(bounds,actor.position.x));actor.position.z=Math.max(-bounds,Math.min(bounds,actor.position.z));
    if(moving&&velocity.lengthSq()>.01)actor.rotation.y=Math.atan2(velocity.x,velocity.z);
    jump-=20*dt;actor.position.y=Math.max(0,actor.position.y+jump*dt);if(actor.position.y<=0){actor.position.y=0;jump=0;grounded=true;}
    animateHumanRig(rig,time,moving,sprint,action);ui.state.textContent=(action==='none'?locomotion:action).toUpperCase();
    podiumRing.rotation.z=time*.22;portalRing.rotation.z=-time*.28;portalCore.rotation.z=time*.09;particles.rotation.y=time*.016;particles.position.y=Math.sin(time*.28)*.12;
    const targetHeight=action==='power'?2.65:action==='combat'?2.38:2.25;
    cameraTarget.set(actor.position.x,targetHeight+actor.position.y,actor.position.z);
    cameraDesired.set(actor.position.x+Math.sin(yaw)*Math.cos(pitch)*zoom,2.25+actor.position.y+Math.sin(pitch)*zoom,actor.position.z+Math.cos(yaw)*Math.cos(pitch)*zoom);
    if(action==='power')cameraDesired.add(new THREE.Vector3(Math.sin(time*16)*.025,Math.cos(time*13)*.02,0));
    camera.position.lerp(cameraDesired,Math.min(1,dt*8.5));
    camera.lookAt(cameraTarget);renderer.render(scene,camera);
  };
  loop();

  const cleanup=()=>{if(disposed)return;disposed=true;lifecycle.abort();cancelAnimationFrame(raf);ro.disconnect();disposeActor();disposeObject(world);particleGeo.dispose();renderer.dispose();ui.cleanup();document.documentElement.style.removeProperty('--avatar-accent');};
  (window as Window & {__rbPageCleanup?:(()=>void)|null}).__rbPageCleanup=cleanup;
  window.addEventListener('pagehide',cleanup,{once:true});
  window.addEventListener('beforeunload',cleanup,{once:true});
}
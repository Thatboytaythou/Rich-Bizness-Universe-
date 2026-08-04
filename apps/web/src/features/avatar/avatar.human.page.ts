import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { mountHumanUi } from './avatar.human.ui';
import { createHumanRig, animateHumanRig, HumanRig } from './avatar.human.rig';
import { supabase } from '../../core/supabase/client';
import './avatar.css';

type Row = Record<string, any>;
type Preset = { preset_key:string; title:string; aura:string; outfit:string; motion:string; config:Record<string,string> };
type CharacterConfig={body_type:string;build:string;hair:string;style:string;smoke:string};

const palettes:Record<string,{primary:number;secondary:number;skin:number}> = {
  'Emerald Gold': { primary:0x31ff63, secondary:0xf7c948, skin:0x70442f },
  'Diamond Mist': { primary:0x8fe8ff, secondary:0xd99cff, skin:0x9a6248 },
  'Neon Phantom': { primary:0x56ffde, secondary:0x7740ff, skin:0x4f2d21 }
};

const disposeObject=(root:THREE.Object3D)=>root.traverse((object:any)=>{object.geometry?.dispose?.();if(Array.isArray(object.material))object.material.forEach((m:any)=>m.dispose?.());else object.material?.dispose?.();});

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root||root.dataset.humanAvatarOwner==='mounted')return;
  root.dataset.humanAvatarOwner='mounted';
  const lifecycle=new AbortController();
  const signal=lifecycle.signal;
  const user=getAuthSnapshot().user;
  if(!user){delete root.dataset.humanAvatarOwner;location.replace('/tap-in.html?next=%2Favatar-characters.html');return;}

  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});
  if(error){delete root.dataset.humanAvatarOwner;throw error;}
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
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.22;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x020402);
  scene.fog=new THREE.FogExp2(0x020402,.012);
  const camera=new THREE.PerspectiveCamera(42,1,.1,240);
  const actor=new THREE.Group();
  scene.add(actor);

  const ambient=new THREE.HemisphereLight(0xcfffe0,0x020402,2.6);scene.add(ambient);
  const moon=new THREE.DirectionalLight(0xffffff,5.2);moon.position.set(8,16,4);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-40;moon.shadow.camera.right=40;moon.shadow.camera.top=40;moon.shadow.camera.bottom=-40;scene.add(moon);
  const fill=new THREE.PointLight(0xf7c948,22,28);fill.position.set(4,5,4);scene.add(fill);
  const rim=new THREE.PointLight(0x31ff63,38,30);rim.position.set(-5,6,-2);scene.add(rim);

  const world=new THREE.Group();scene.add(world);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140,1,1),new THREE.MeshStandardMaterial({color:0x071008,metalness:.38,roughness:.78}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
  const grid=new THREE.GridHelper(140,70,0x31ff63,0x18351f);grid.position.y=.015;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.18;world.add(grid);

  const roadMat=new THREE.MeshStandardMaterial({color:0x111514,metalness:.72,roughness:.34});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(16,120),roadMat);road.rotation.x=-Math.PI/2;road.position.y=.025;road.receiveShadow=true;world.add(road);
  const roadCross=new THREE.Mesh(new THREE.PlaneGeometry(120,16),roadMat.clone());roadCross.rotation.x=-Math.PI/2;roadCross.position.y=.027;roadCross.receiveShadow=true;world.add(roadCross);

  const neonMat=new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.56});
  for(let i=-5;i<=5;i++){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.16,.02,5.4),neonMat.clone());stripe.position.set(0,.05,i*10);world.add(stripe);
    const crossStripe=new THREE.Mesh(new THREE.BoxGeometry(5.4,.02,.16),neonMat.clone());crossStripe.position.set(i*10,.05,0);world.add(crossStripe);
  }

  const buildingGeo=new THREE.BoxGeometry(1,1,1);
  const buildingMaterials=[0x081109,0x0b1510,0x101913,0x06140c].map(color=>new THREE.MeshStandardMaterial({color,metalness:.68,roughness:.32}));
  const windowGeo=new THREE.PlaneGeometry(.24,.13);
  const windowMaterials=[0x31ff63,0xf7c948,0x8fe8ff,0x7740ff].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.74,side:THREE.DoubleSide}));
  const addTower=(x:number,z:number,w:number,h:number,d:number,index:number)=>{
    const tower=new THREE.Mesh(buildingGeo,buildingMaterials[index%buildingMaterials.length]);tower.scale.set(w,h,d);tower.position.set(x,h/2,z);tower.castShadow=true;tower.receiveShadow=true;world.add(tower);
    const faceZ=z+(z<0?d/2+.01:-d/2-.01),rotation=z<0?0:Math.PI;
    for(let row=1;row<Math.max(2,Math.floor(h/1.4));row++)for(let col=-1;col<=1;col++){
      const light=new THREE.Mesh(windowGeo,windowMaterials[(index+row+col+8)%windowMaterials.length]);light.position.set(x+col*w*.22,row*1.2,faceZ);light.rotation.y=rotation;world.add(light);
    }
  };
  for(let i=0;i<34;i++){
    const side=i%2===0?-1:1;
    const lane=side*(14+(i%4)*5);
    const depth=-58+(i*7)%116;
    addTower(lane,depth,3.2+(i%3)*1.15,7+(i%6)*2.4,3.6+(i%4)*.8,i);
  }

  const portalGroup=new THREE.Group();portalGroup.position.set(0,0,-34);world.add(portalGroup);
  const portalRing=new THREE.Mesh(new THREE.TorusGeometry(5.4,.18,18,160),new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.9}));portalRing.position.y=5.4;portalGroup.add(portalRing);
  const portalCore=new THREE.Mesh(new THREE.CircleGeometry(4.65,96),new THREE.MeshBasicMaterial({color:0x0d4021,transparent:true,opacity:.28,side:THREE.DoubleSide}));portalCore.position.y=5.4;portalCore.position.z=.08;portalGroup.add(portalCore);
  const portalLight=new THREE.PointLight(0x31ff63,72,28);portalLight.position.set(0,5.5,1);portalGroup.add(portalLight);

  const particleGeo=new THREE.BufferGeometry();
  const particleCount=780;const positions=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){positions[i*3]=(Math.random()-.5)*130;positions[i*3+1]=Math.random()*26+.4;positions[i*3+2]=(Math.random()-.5)*130;}
  particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x31ff63,size:.08,transparent:true,opacity:.65,depthWrite:false}));world.add(particles);

  const spawnRing=new THREE.Mesh(new THREE.TorusGeometry(4.4,.055,12,140),new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.56}));spawnRing.rotation.x=Math.PI/2;spawnRing.position.y=.04;world.add(spawnRing);

  let rig={} as HumanRig;
  const disposeActor=()=>disposeObject(actor);
  function rebuild(){
    disposeActor();actor.clear();
    const colors=palettes[aura]??palettes['Emerald Gold'];
    rig=createHumanRig(colors,runtimeConfig.body_type==='female');
    const buildScale=runtimeConfig.build==='heroic'?1.08:runtimeConfig.build==='street'?.98:1;
    rig.root.scale.set(buildScale,1,buildScale);
    actor.add(rig.root);
    rim.color.setHex(colors.primary);spawnRing.material.color.setHex(colors.primary);portalRing.material.color.setHex(colors.primary);portalLight.color.setHex(colors.primary);(particles.material as THREE.PointsMaterial).color.setHex(colors.primary);
    (particles.material as THREE.PointsMaterial).opacity=runtimeConfig.smoke==='off'?.18:runtimeConfig.smoke==='heavy'?.88:.65;
    document.documentElement.style.setProperty('--avatar-accent',`#${colors.primary.toString(16).padStart(6,'0')}`);
  }
  rebuild();

  let yaw=0,pitch=.045,zoom=matchMedia('(max-width: 640px)').matches?10.6:9.4,drag=false,lastX=0,lastY=0,jump=0,grounded=true,action='none',until=0,touch={x:0,y:0},raf=0,cleaned=false;
  const keys=new Set<string>();
  const clock=new THREE.Clock();
  const velocity=new THREE.Vector3();
  const targetVelocity=new THREE.Vector3();
  const trigger=(next:string)=>{action=next;until=performance.now()+1600;ui.state.textContent=next.toUpperCase();};
  const resize=()=>{const width=Math.max(1,ui.canvas.clientWidth),height=Math.max(1,ui.canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  const ro=new ResizeObserver(resize);ro.observe(ui.canvas);resize();
  const kd=(event:KeyboardEvent)=>{keys.add(event.code);if(event.code==='Space'&&grounded){event.preventDefault();jump=7.2;grounded=false;}};
  const ku=(event:KeyboardEvent)=>keys.delete(event.code);
  window.addEventListener('keydown',kd,{signal});window.addEventListener('keyup',ku,{signal});
  ui.canvas.addEventListener('pointerdown',event=>{drag=true;lastX=event.clientX;lastY=event.clientY;ui.canvas.setPointerCapture(event.pointerId);},{signal});
  ui.canvas.addEventListener('pointermove',event=>{if(!drag)return;yaw-=(event.clientX-lastX)*.0075;pitch=Math.max(-.14,Math.min(.3,pitch+(event.clientY-lastY)*.0036));lastX=event.clientX;lastY=event.clientY;},{signal});
  const stopDrag=()=>{drag=false;};ui.canvas.addEventListener('pointerup',stopDrag,{signal});ui.canvas.addEventListener('pointercancel',stopDrag,{signal});

  ui.onCamera=mode=>{zoom=mode==='portrait'?5.8:mode==='street'?12:9.4;pitch=mode==='portrait'?.015:mode==='street'?.11:.045;};
  ui.onMotion=trigger;
  ui.onAction=next=>{if(next==='jump'&&grounded){jump=7.2;grounded=false;}else if(next==='sprint')keys.add('ShiftLeft');else trigger(next);};
  ui.onActionEnd=next=>{if(next==='sprint')keys.delete('ShiftLeft');};
  ui.onJoystick=value=>{touch=value;};
  ui.onAura=value=>{aura=value;rebuild();ui.refresh(preset,aura);};
  ui.onPreset=value=>{preset=presets.find(x=>x.preset_key===value)??preset;aura=preset?.aura??aura;Object.assign(runtimeConfig,preset?.config??{});rebuild();ui.refresh(preset,aura);const url=new URL(location.href);url.searchParams.set('preset',preset?.preset_key??'');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);};
  ui.onBody=value=>{runtimeConfig.body_type=value;rebuild();ui.status.textContent=`${value==='female'?'Girl':'Boy'} body rig active.`;};
  ui.onCustomization=value=>{Object.assign(runtimeConfig,value);rebuild();ui.status.textContent='Character customization applied to the live 3D rig.';};
  ui.onReset=()=>{yaw=0;pitch=.045;zoom=matchMedia('(max-width: 640px)').matches?10.6:9.4;actor.position.set(0,0,18);velocity.set(0,0,0);Object.assign(runtimeConfig,preset?.config??{body_type:'male',build:'athletic',hair:'energy',style:'human rig',smoke:'cinematic'});rebuild();ui.refresh(preset,aura);};
  ui.onSave=async()=>{ui.status.textContent='Synchronizing cinematic human character…';const{error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:ui.nameInput.value.trim(),p_preset_key:preset?.preset_key??'boss',p_aura:aura,p_outfit:{preset:preset?.outfit??'Rich Street',character:runtimeConfig,rig:'human-v5-custom-world'},p_accessories:{signature:preset?.config?.signature??null,hair:runtimeConfig.hair,style:runtimeConfig.style},p_smoke:{mode:runtimeConfig.smoke,intensity:runtimeConfig.smoke==='heavy'?'elite':'cinematic'},p_emotes:{idle:true,power_up:true,combat_pose:true,free_roam:true,dance:true,smoke:true},p_character_type:runtimeConfig.body_type});ui.status.textContent=saveError?saveError.message:'Character synced across Profile, Portal, Meta and the free-roam world.';};

  actor.position.set(0,0,18);
  const bounds=54;
  const loop=()=>{
    raf=requestAnimationFrame(loop);if(document.hidden)return;
    const dt=Math.min(clock.getDelta(),.033),time=clock.elapsedTime;
    const ix=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touch.x;
    const iz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touch.y;
    const moving=Math.abs(ix)+Math.abs(iz)>.08,sprint=keys.has('ShiftLeft'),locomotion=!grounded?'jump':moving?(sprint?'run':'walk'):'idle';
    if(performance.now()>until)action='none';
    const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    targetVelocity.copy(right.multiplyScalar(ix)).add(forward.multiplyScalar(iz)).multiplyScalar(sprint?8.4:4.6);
    velocity.lerp(targetVelocity,Math.min(1,dt*7.5));actor.position.addScaledVector(velocity,dt);
    actor.position.x=Math.max(-bounds,Math.min(bounds,actor.position.x));actor.position.z=Math.max(-bounds,Math.min(bounds,actor.position.z));
    if(moving)actor.rotation.y=Math.atan2(velocity.x,velocity.z);
    jump-=20*dt;actor.position.y=Math.max(0,actor.position.y+jump*dt);if(actor.position.y<=0){actor.position.y=0;jump=0;grounded=true;}
    animateHumanRig(rig,time,moving,sprint,action);ui.state.textContent=(action==='none'?locomotion:action).toUpperCase();
    spawnRing.rotation.z=time*.17;portalRing.rotation.z=-time*.24;portalCore.rotation.z=time*.08;particles.rotation.y=time*.012;
    camera.position.lerp(new THREE.Vector3(actor.position.x+Math.sin(yaw)*Math.cos(pitch)*zoom,2.4+actor.position.y+Math.sin(pitch)*zoom,actor.position.z+Math.cos(yaw)*Math.cos(pitch)*zoom),Math.min(1,dt*6));
    camera.lookAt(actor.position.x,2.15+actor.position.y,actor.position.z);renderer.render(scene,camera);
  };
  loop();

  const cleanup=()=>{if(cleaned)return;cleaned=true;lifecycle.abort();cancelAnimationFrame(raf);ro.disconnect();disposeActor();disposeObject(world);particleGeo.dispose();renderer.dispose();ui.cleanup();delete root.dataset.humanAvatarOwner;document.documentElement.style.removeProperty('--avatar-accent');};
  window.addEventListener('pagehide',cleanup,{once:true,signal});window.addEventListener('beforeunload',cleanup,{once:true,signal});
}
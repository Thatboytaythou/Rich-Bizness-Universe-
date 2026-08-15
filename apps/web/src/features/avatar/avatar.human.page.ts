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
  const mobile=matchMedia('(max-width: 640px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?2:2.25));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.72;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0b1610);
  scene.fog=new THREE.FogExp2(0x0b1610,.009);
  const camera=new THREE.PerspectiveCamera(34,1,.1,220);
  const actor=new THREE.Group();
  scene.add(actor);

  const ambient=new THREE.HemisphereLight(0xf1fff4,0x0b120d,5.4);scene.add(ambient);
  const fill=new THREE.DirectionalLight(0xbfffd0,3.1);fill.position.set(-5,8,5);scene.add(fill);
  const key=new THREE.DirectionalLight(0xffffff,8.6);key.position.set(6,14,8);key.castShadow=true;key.shadow.mapSize.set(mobile?1536:2048,mobile?1536:2048);key.shadow.bias=-.00018;key.shadow.camera.left=-20;key.shadow.camera.right=20;key.shadow.camera.top=20;key.shadow.camera.bottom=-20;scene.add(key);
  const gold=new THREE.PointLight(0xf7c948,22,24);gold.position.set(4.8,4.8,4);scene.add(gold);
  const emerald=new THREE.PointLight(0x31ff63,34,28);emerald.position.set(-4.5,5.6,-1);scene.add(emerald);
  const faceLight=new THREE.SpotLight(0xffffff,46,20,.5,.58,1.15);faceLight.position.set(0,5.8,7);faceLight.target=actor;scene.add(faceLight,faceLight.target);

  const world=new THREE.Group();scene.add(world);
  const groundMat=new THREE.MeshPhysicalMaterial({color:0x102117,metalness:.2,roughness:.48,clearcoat:.18,clearcoatRoughness:.36});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
  const grid=new THREE.GridHelper(120,52,0x51ff83,0x214f2e);grid.position.y=.018;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.22;world.add(grid);

  const roadMat=new THREE.MeshPhysicalMaterial({color:0x152019,metalness:.34,roughness:.36,clearcoat:.2});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(15,110),roadMat);road.rotation.x=-Math.PI/2;road.position.y=.028;road.receiveShadow=true;world.add(road);
  const roadCross=new THREE.Mesh(new THREE.PlaneGeometry(110,15),roadMat.clone());roadCross.rotation.x=-Math.PI/2;roadCross.position.y=.03;roadCross.receiveShadow=true;world.add(roadCross);

  const neonMat=new THREE.MeshBasicMaterial({color:0x77ff9a,transparent:true,opacity:.72});
  for(let i=-5;i<=5;i++){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.1,.018,4.3),neonMat.clone());stripe.position.set(0,.052,i*9.5);world.add(stripe);
    const crossStripe=new THREE.Mesh(new THREE.BoxGeometry(4.3,.018,.1),neonMat.clone());crossStripe.position.set(i*9.5,.052,0);world.add(crossStripe);
  }

  const podium=new THREE.Group();podium.position.set(0,.03,18);world.add(podium);
  const podiumBase=new THREE.Mesh(new THREE.CylinderGeometry(2.35,2.6,.16,72),new THREE.MeshPhysicalMaterial({color:0x173222,metalness:.28,roughness:.38,clearcoat:.3}));podiumBase.position.y=.08;podiumBase.receiveShadow=true;podium.add(podiumBase);
  const podiumGlow=new THREE.Mesh(new THREE.CircleGeometry(2.18,72),new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}));podiumGlow.rotation.x=-Math.PI/2;podiumGlow.position.y=.17;podium.add(podiumGlow);

  const buildingGeo=new THREE.BoxGeometry(1,1,1);
  const buildingMaterials=[0x10261a,0x163120,0x1a3724,0x0d1f15].map(color=>new THREE.MeshStandardMaterial({color,metalness:.22,roughness:.48}));
  const windowGeo=new THREE.PlaneGeometry(.2,.1);
  const windowMaterials=[0x6dff9b,0xf7d768,0x9deaff,0xa787ff].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,side:THREE.DoubleSide}));
  const addTower=(x:number,z:number,w:number,h:number,d:number,index:number)=>{
    const tower=new THREE.Mesh(buildingGeo,buildingMaterials[index%buildingMaterials.length]);tower.scale.set(w,h,d);tower.position.set(x,h/2,z);tower.castShadow=true;tower.receiveShadow=true;world.add(tower);
    const faceZ=z+(z<0?d/2+.01:-d/2-.01),rotation=z<0?0:Math.PI;
    for(let row=1;row<Math.max(2,Math.floor(h/1.45));row++)for(let col=-1;col<=1;col++){
      const light=new THREE.Mesh(windowGeo,windowMaterials[(index+row+col+8)%windowMaterials.length]);light.position.set(x+col*w*.22,row*1.18,faceZ);light.rotation.y=rotation;world.add(light);
    }
  };
  for(let i=0;i<24;i++){
    const side=i%2===0?-1:1;
    const lane=side*(12+(i%4)*4.4);
    const depth=-46+(i*8)%92;
    addTower(lane,depth,3+(i%3)*1.05,6.2+(i%6)*2.0,3.1+(i%4)*.68,i);
  }

  const portalGroup=new THREE.Group();portalGroup.position.set(0,0,-28);world.add(portalGroup);
  const portalCore=new THREE.Mesh(new THREE.CircleGeometry(4.1,72),new THREE.MeshBasicMaterial({color:0x1d6d3a,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));portalCore.position.y=4.9;portalCore.position.z=.08;portalGroup.add(portalCore);
  const portalLight=new THREE.PointLight(0x31ff63,42,22);portalLight.position.set(0,5,1);portalGroup.add(portalLight);

  const particleGeo=new THREE.BufferGeometry();
  const particleCount=mobile?260:380;const positions=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){positions[i*3]=(Math.random()-.5)*88;positions[i*3+1]=Math.random()*18+.4;positions[i*3+2]=(Math.random()-.5)*88;}
  particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x31ff63,size:.055,transparent:true,opacity:.46,depthWrite:false,blending:THREE.AdditiveBlending}));world.add(particles);

  let rig={} as HumanRig;
  const disposeActor=()=>disposeObject(actor);
  function rebuild(){
    if(!isCurrent())return;
    disposeActor();actor.clear();
    const colors=palettes[aura]??palettes['Emerald Gold'];
    rig=createHumanRig(colors,runtimeConfig.body_type==='female');
    const buildScale=runtimeConfig.build==='heroic'?1.035:runtimeConfig.build==='street'?.985:1;
    rig.root.scale.set(buildScale,1,buildScale);
    actor.add(rig.root);
    emerald.color.setHex(colors.primary);(podiumGlow.material as THREE.MeshBasicMaterial).color.setHex(colors.primary);portalLight.color.setHex(colors.primary);(portalCore.material as THREE.MeshBasicMaterial).color.setHex(colors.primary);(particles.material as THREE.PointsMaterial).color.setHex(colors.primary);
    (particles.material as THREE.PointsMaterial).opacity=runtimeConfig.smoke==='off'?.06:runtimeConfig.smoke==='heavy'?.62:.38;
    document.documentElement.style.setProperty('--avatar-accent',`#${colors.primary.toString(16).padStart(6,'0')}`);
  }
  rebuild();

  let yaw=0,pitch=.025,zoom=mobile?7.4:7.8,drag=false,lastX=0,lastY=0,jump=0,grounded=true,action='none',until=0,touch={x:0,y:0},raf=0;
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
  ui.canvas.addEventListener('pointermove',event=>{if(!isCurrent()||!drag)return;yaw-=(event.clientX-lastX)*.006;pitch=Math.max(-.07,Math.min(.18,pitch+(event.clientY-lastY)*.0028));lastX=event.clientX;lastY=event.clientY;},{signal});
  const stopDrag=()=>{drag=false;};ui.canvas.addEventListener('pointerup',stopDrag,{signal});ui.canvas.addEventListener('pointercancel',stopDrag,{signal});

  ui.onCamera=mode=>{if(!isCurrent())return;zoom=mode==='portrait'?4.6:mode==='street'?9.4:mobile?7.4:7.8;pitch=mode==='portrait'?.005:mode==='street'?.07:.025;};
  ui.onMotion=trigger;
  ui.onAction=next=>{if(!isCurrent())return;if(next==='jump'&&grounded){jump=7.2;grounded=false;}else if(next==='sprint')keys.add('ShiftLeft');else trigger(next);};
  ui.onActionEnd=next=>{if(next==='sprint')keys.delete('ShiftLeft');};
  ui.onJoystick=value=>{if(isCurrent())touch=value;};
  ui.onAura=value=>{if(!isCurrent())return;aura=value;rebuild();ui.refresh(preset,aura);};
  ui.onPreset=value=>{if(!isCurrent())return;preset=presets.find(x=>x.preset_key===value)??preset;aura=preset?.aura??aura;Object.assign(runtimeConfig,preset?.config??{});rebuild();ui.refresh(preset,aura);const url=new URL(location.href);url.searchParams.set('preset',preset?.preset_key??'');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);};
  ui.onBody=value=>{if(!isCurrent())return;runtimeConfig.body_type=value;rebuild();ui.status.textContent=`${value==='female'?'Girl':'Boy'} body rig active.`;};
  ui.onCustomization=value=>{if(!isCurrent())return;Object.assign(runtimeConfig,value);rebuild();ui.status.textContent='Character customization applied to the live 3D rig.';};
  ui.onReset=()=>{if(!isCurrent())return;yaw=0;pitch=.025;zoom=mobile?7.4:7.8;actor.position.set(0,0,18);velocity.set(0,0,0);Object.assign(runtimeConfig,preset?.config??{body_type:'male',build:'athletic',hair:'energy',style:'human rig',smoke:'cinematic'});rebuild();ui.refresh(preset,aura);};
  ui.onSave=async()=>{if(!isCurrent())return;ui.status.textContent='Saving character…';const {error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:ui.nameInput.value.trim()||'Rich Avatar',p_preset_key:preset?.preset_key??'',p_aura:aura,p_outfit:{character:runtimeConfig},p_accessories:{},p_smoke:{mode:runtimeConfig.smoke},p_emotes:{},p_character_type:'human'});if(!isCurrent())return;ui.status.textContent=saveError?saveError.message:'Character saved.';};

  const loop=()=>{
    if(!isCurrent())return;
    const dt=Math.min(.033,clock.getDelta());const t=clock.elapsedTime;
    const mx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touch.x;const mz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touch.y;
    const moving=Math.abs(mx)+Math.abs(mz)>.08;const sprint=keys.has('ShiftLeft');const speed=sprint?4.8:2.75;
    targetVelocity.set(mx,0,mz);if(targetVelocity.lengthSq()>1)targetVelocity.normalize();targetVelocity.multiplyScalar(speed);velocity.lerp(targetVelocity,1-Math.exp(-dt*9.5));
    actor.position.x+=velocity.x*dt;actor.position.z+=velocity.z*dt;if(moving)actor.rotation.y=Math.atan2(velocity.x,velocity.z);
    if(!grounded){jump-=18*dt;actor.position.y+=jump*dt;if(actor.position.y<=0){actor.position.y=0;jump=0;grounded=true;}}
    if(action!=='none'&&performance.now()>until){action='none';ui.state.textContent=moving?(sprint?'RUN':'WALK'):'IDLE';}else if(action==='none')ui.state.textContent=moving?(sprint?'RUN':'WALK'):'IDLE';
    animateHumanRig(rig,t,moving,sprint,action);
    particles.rotation.y=t*.004;
    cameraTarget.set(actor.position.x,actor.position.y+2.28,actor.position.z);
    cameraDesired.set(cameraTarget.x+Math.sin(yaw)*zoom,cameraTarget.y+1.05+pitch*zoom,cameraTarget.z+Math.cos(yaw)*zoom);
    camera.position.lerp(cameraDesired,1-Math.exp(-dt*7.2));camera.lookAt(cameraTarget);
    renderer.render(scene,camera);raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);

  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);lifecycle.abort();ro.disconnect();ui.cleanup();disposeActor();disposeObject(world);particleGeo.dispose();renderer.dispose();document.documentElement.style.removeProperty('--avatar-accent');};
  window.__rbPageCleanup=cleanup;
  window.addEventListener('pagehide',cleanup,{once:true});
  window.addEventListener('beforeunload',cleanup,{once:true});
}
import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { mountHumanUi } from './avatar.human.ui';
import { createHumanRig, animateHumanRig, HumanRig } from './avatar.human.rig';
import { supabase } from '../../core/supabase/client';
import './avatar.css';

type Row = Record<string, any>;
type Preset = { preset_key:string; title:string; aura:string; outfit:string; motion:string; config:Record<string,string> };

const palettes:Record<string,{primary:number;secondary:number;skin:number}> = {
  'Emerald Gold': { primary:0x31ff63, secondary:0xf7c948, skin:0x70442f },
  'Diamond Mist': { primary:0x8fe8ff, secondary:0xd99cff, skin:0x9a6248 },
  'Neon Phantom': { primary:0x56ffde, secondary:0x7740ff, skin:0x4f2d21 }
};

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root||root.dataset.humanAvatarOwner==='mounted')return;
  root.dataset.humanAvatarOwner='mounted';
  const lifecycle=new AbortController();
  const signal=lifecycle.signal;
  const user=getAuthSnapshot().user;
  if(!user){location.replace('/tap-in.html?next=%2Favatar-characters.html');return;}

  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});
  if(error)throw error;
  const s=(data??{}) as Row;
  const p=s.profile??{};
  const a=s.avatar??{};
  const presets=(s.presets??[]) as Preset[];
  const requested=new URLSearchParams(location.search).get('preset');
  let preset=presets.find(x=>x.preset_key===requested)??presets.find(x=>x.preset_key===a.metadata?.preset_key)??presets[0];
  let aura=String(preset?.aura??a.aura??'Emerald Gold');
  const ui=mountHumanUi(root,{
    name:String(a.display_name??p.display_name??p.username??'Rich Avatar'),
    level:Number(a.level??p.rich_level??1),
    xp:Number(a.xp??0),
    rank:String(a.rank??p.rank_title??'Rookie Rich'),
    presets,
    aura,
    selectedPresetKey:preset?.preset_key??''
  });

  const renderer=new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x020402,.025);
  const camera=new THREE.PerspectiveCamera(38,1,.1,120);
  const actor=new THREE.Group();
  scene.add(actor);
  scene.add(new THREE.HemisphereLight(0xffffff,0x071008,2.15));
  const key=new THREE.DirectionalLight(0xffffff,4.4);key.position.set(5,9,6);key.castShadow=true;scene.add(key);
  const fill=new THREE.PointLight(0xf7c948,18,14);fill.position.set(4,3,3);scene.add(fill);
  const rim=new THREE.PointLight(0x31ff63,32,16);rim.position.set(-4,4,-2);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(5,5.6,.3,80),new THREE.MeshStandardMaterial({color:0x071108,metalness:.8,roughness:.25}));
  floor.position.y=-.16;scene.add(floor);
  const portalRing=new THREE.Mesh(new THREE.TorusGeometry(4.2,.035,12,120),new THREE.MeshBasicMaterial({color:0x31ff63,transparent:true,opacity:.48}));
  portalRing.rotation.x=Math.PI/2;portalRing.position.y=.02;scene.add(portalRing);

  let rig={} as HumanRig;
  const disposeActor=()=>actor.traverse((object:any)=>{object.geometry?.dispose?.();if(Array.isArray(object.material))object.material.forEach((m:any)=>m.dispose?.());else object.material?.dispose?.();});
  function rebuild(){
    disposeActor();
    actor.clear();
    const colors=palettes[aura]??palettes['Emerald Gold'];
    rig=createHumanRig(colors,preset?.config.body_type==='female');
    actor.add(rig.root);
    rim.color.setHex(colors.primary);
    portalRing.material.color.setHex(colors.primary);
    document.documentElement.style.setProperty('--avatar-accent',`#${colors.primary.toString(16).padStart(6,'0')}`);
  }
  rebuild();

  let yaw=0,pitch=.035,zoom=matchMedia('(max-width: 640px)').matches?9.8:8.8,drag=false,lastX=0,lastY=0,jump=0,grounded=true,action='none',until=0,touch={x:0,y:0},raf=0,cleaned=false;
  const keys=new Set<string>();
  const clock=new THREE.Clock();
  const velocity=new THREE.Vector3();
  const targetVelocity=new THREE.Vector3();
  const trigger=(next:string)=>{action=next;until=performance.now()+1500;ui.state.textContent=next.toUpperCase();};
  const resize=()=>{const width=Math.max(1,ui.canvas.clientWidth),height=Math.max(1,ui.canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  const ro=new ResizeObserver(resize);ro.observe(ui.canvas);resize();
  const kd=(event:KeyboardEvent)=>{keys.add(event.code);if(event.code==='Space'&&grounded){event.preventDefault();jump=6.7;grounded=false;}};
  const ku=(event:KeyboardEvent)=>keys.delete(event.code);
  window.addEventListener('keydown',kd,{signal});
  window.addEventListener('keyup',ku,{signal});
  ui.canvas.addEventListener('pointerdown',event=>{drag=true;lastX=event.clientX;lastY=event.clientY;ui.canvas.setPointerCapture(event.pointerId);},{signal});
  ui.canvas.addEventListener('pointermove',event=>{if(!drag)return;yaw-=(event.clientX-lastX)*.008;pitch=Math.max(-.12,Math.min(.28,pitch+(event.clientY-lastY)*.004));lastX=event.clientX;lastY=event.clientY;},{signal});
  const stopDrag=()=>{drag=false;};
  ui.canvas.addEventListener('pointerup',stopDrag,{signal});
  ui.canvas.addEventListener('pointercancel',stopDrag,{signal});

  ui.onCamera=mode=>{zoom=mode==='portrait'?5.6:mode==='street'?10.2:8.8;pitch=mode==='portrait'?.02:.035;};
  ui.onMotion=trigger;
  ui.onAction=next=>{if(next==='jump'&&grounded){jump=6.7;grounded=false;}else if(next==='sprint')keys.add('ShiftLeft');else trigger(next);};
  ui.onActionEnd=next=>{if(next==='sprint')keys.delete('ShiftLeft');};
  ui.onJoystick=value=>{touch=value;};
  ui.onAura=value=>{aura=value;rebuild();ui.refresh(preset,aura);};
  ui.onPreset=value=>{preset=presets.find(x=>x.preset_key===value)??preset;aura=preset?.aura??aura;rebuild();ui.refresh(preset,aura);history.replaceState(null,'',`/avatar-characters.html?preset=${encodeURIComponent(preset?.preset_key??'')}`);};
  ui.onReset=()=>{yaw=0;pitch=.035;zoom=matchMedia('(max-width: 640px)').matches?9.8:8.8;actor.position.set(0,0,0);velocity.set(0,0,0);};
  ui.onSave=async()=>{ui.status.textContent='Synchronizing cinematic human character…';const{error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:ui.nameInput.value.trim(),p_preset_key:preset?.preset_key??'boss',p_aura:aura,p_outfit:{preset:preset?.outfit??'Rich Street',character:preset?.config??{},rig:'human-v3-proportioned'},p_accessories:{signature:preset?.config?.signature??null},p_smoke:{mode:preset?.config?.smoke??'cinematic',intensity:'elite'},p_emotes:{idle:true,power_up:true,combat_pose:true},p_character_type:preset?.preset_key??'custom'});ui.status.textContent=saveError?saveError.message:'Character synced across Profile, Portal, Meta and the avatar universe.';};

  const loop=()=>{
    raf=requestAnimationFrame(loop);
    if(document.hidden)return;
    const dt=Math.min(clock.getDelta(),.033),time=clock.elapsedTime;
    const ix=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touch.x;
    const iz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touch.y;
    const moving=Math.abs(ix)+Math.abs(iz)>.08,sprint=keys.has('ShiftLeft'),locomotion=!grounded?'jump':moving?(sprint?'run':'walk'):'idle';
    if(performance.now()>until)action='none';
    targetVelocity.set(ix*(sprint?5.5:3.1),0,iz*(sprint?5.5:3.1));
    velocity.lerp(targetVelocity,Math.min(1,dt*8));
    actor.position.addScaledVector(velocity,dt);
    jump-=18*dt;actor.position.y=Math.max(0,actor.position.y+jump*dt);
    if(actor.position.y<=0){actor.position.y=0;jump=0;grounded=true;}
    animateHumanRig(rig,time,moving,sprint,action);
    ui.state.textContent=(action==='none'?locomotion:action).toUpperCase();
    portalRing.rotation.z=time*.12;
    camera.position.set(actor.position.x+Math.sin(yaw)*Math.cos(pitch)*zoom,2.15+Math.sin(pitch)*zoom,actor.position.z+Math.cos(yaw)*Math.cos(pitch)*zoom);
    camera.lookAt(actor.position.x,2.25+actor.position.y,actor.position.z);
    renderer.render(scene,camera);
  };
  loop();

  const cleanup=()=>{if(cleaned)return;cleaned=true;lifecycle.abort();cancelAnimationFrame(raf);ro.disconnect();disposeActor();floor.geometry.dispose();(floor.material as THREE.Material).dispose();portalRing.geometry.dispose();portalRing.material.dispose();renderer.dispose();ui.cleanup();document.documentElement.style.removeProperty('--avatar-accent');};
  window.addEventListener('pagehide',cleanup,{once:true,signal});
  window.addEventListener('beforeunload',cleanup,{once:true,signal});
}

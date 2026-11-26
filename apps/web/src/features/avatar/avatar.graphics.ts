import * as THREE from 'three';
import {createOriginalAvatar} from './avatar.original.runtime';
import {disposeSkinnedAvatar,setAvatarMotion,updateSkinnedAvatar,type AvatarMotion,type SkinnedAvatarRuntime} from './avatar.skinned.runtime';
import type {CharacterConfig} from './avatar.identity';

export type StudioGraphics={update:(config:CharacterConfig)=>void;motion:(value:AvatarMotion)=>void;rotate:(radians:number)=>void;zoom:(delta:number)=>void;face:(enabled:boolean)=>void;reset:()=>void;dispose:()=>void};
const aura=(s:string)=>s==='Neon Phantom'?0x765dff:s==='Diamond Mist'?0x76d8ff:0x21df81;
export function createStudioGraphics(canvas:HTMLCanvasElement,initial:CharacterConfig,onFrame:()=>void,onFailure:(reason:string)=>void):StudioGraphics{
  const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'low-power',alpha:false});
  renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=false;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x081910);
  const camera=new THREE.PerspectiveCamera(34,1,.08,30);
  scene.add(new THREE.HemisphereLight(0xf4fff3,0x405042,2.3));
  const key=new THREE.DirectionalLight(0xffe6c6,2.8);key.position.set(3,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xb0ddff,1.1);fill.position.set(-4,2,2);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.8,40),new THREE.MeshStandardMaterial({color:0x243b2e,roughness:.78}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.83,.013,6,48),new THREE.MeshBasicMaterial({color:aura(initial.aura)}));ring.rotation.x=-Math.PI/2;ring.position.y=.008;scene.add(ring);
  let runtime:SkinnedAvatarRuntime|null=null;
  let yaw=0,zoom=1,face=false,active:AvatarMotion='idle',disposed=false,failed=false,raf=0,previous=0,deadline=0,dirty=true;
  let modelKey='';
  const controller=new AbortController(),signal=controller.signal;
  const fail=(message:string)=>{if(disposed||failed)return;failed=true;cancelAnimationFrame(raf);raf=0;onFailure(message);};
  const pose=()=>{
    if(!runtime)return;
    const h=runtime.height, aspect=Math.max(.25,camera.aspect),fov=face?32:35;
    const targetY=h*(face?.88:.52);
    // Fit both axes; reserve headroom and feet. Face mode includes neck and shoulders.
    const viewHeight=h*(face?.48:1.19),viewWidth=h*(face?.39:.64);
    const distance=Math.max(viewHeight,viewWidth/aspect)/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
    camera.position.set(0,targetY,distance);camera.fov=fov;camera.zoom=zoom;
    camera.updateProjectionMatrix();camera.lookAt(0,targetY,0);
  };
  const schedule=()=>{if(!disposed&&!failed&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);};
  const draw=(now:number)=>{
    raf=0;if(disposed||failed||document.hidden)return;
    const anim=active!=='idle'&&now<deadline;
    if(!dirty&&!anim&&active==='idle')return;
    if(previous&&now-previous<(mobile?42:32)){schedule();return;}
    const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
    try{
      if(runtime){
        if(anim)updateSkinnedAvatar(runtime,dt);
        if(active==='jump'){
          const action=runtime.currentAction;
          const t=action?Math.min(1,action.time/action.getClip().duration):1;
          runtime.root.position.y=.38*4*t*(1-t);
        }
        if(!anim&&active!=='idle'){active='idle';runtime.root.position.y=0;setAvatarMotion(runtime,'idle',0);runtime.mixer.update(0);}
      }
      renderer.render(scene,camera);dirty=false;onFrame();
      if(anim){dirty=true;schedule();}else previous=0;
    }catch(error){fail(error instanceof Error?error.message:'WebGL draw failed');}
  };
  const invalidate=()=>{dirty=true;schedule();};
  const resize=()=>{if(disposed||failed)return;const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const limit=mobile?720:1100;const scale=Math.min(1,limit/Math.max(rect.width,rect.height));renderer.setSize(Math.max(1,Math.round(rect.width*scale)),Math.max(1,Math.round(rect.height*scale)),false);camera.aspect=rect.width/rect.height;pose();invalidate();};
  const update=(config:CharacterConfig)=>{
    if(disposed||failed)return;
    ring.material.color.setHex(aura(config.aura));
    const key=JSON.stringify([config.gender,config.build,config.look]);
    if(key!==modelKey){
      // Create replacement first; leave previous frame available if creation fails.
      try{
        const next=createOriginalAvatar(config.gender,config.look,config.build);next.root.rotation.y=yaw;
        setAvatarMotion(next,'idle',0);next.mixer.update(0);
        if(runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);}
        runtime=next;scene.add(next.root);modelKey=key;active='idle';previous=0;
      }catch(error){fail(error instanceof Error?error.message:'Character creation failed');return;}
    }
    pose();invalidate();
  };
  const motion=(value:AvatarMotion)=>{if(!runtime||failed||disposed)return;active=value;runtime.root.position.y=0;setAvatarMotion(runtime,value,value==='idle'?0:.18);if(value==='idle')runtime.mixer.update(0);else{face=false;zoom=1;pose();}deadline=performance.now()+(value==='jump'?950:value==='power'?1500:5000);previous=0;invalidate();};
  const rotate=(radians:number)=>{yaw+=radians;if(runtime)runtime.root.rotation.y=yaw;invalidate();};
  let pointer:number|null=null,lastX=0;
  canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;rotate((e.clientX-lastX)*.012);lastX=e.clientX;},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;},{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('WebGL context lost');},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;previous=0;}else invalidate();},{signal});
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const dispose=()=>{if(disposed)return;disposed=true;controller.abort();observer.disconnect();cancelAnimationFrame(raf);if(runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);runtime=null;}floor.geometry.dispose();floor.material.dispose();ring.geometry.dispose();ring.material.dispose();renderer.dispose();renderer.forceContextLoss();};
  update(initial);resize();
  return {update,motion,rotate,zoom:delta=>{zoom=THREE.MathUtils.clamp(zoom+delta,.8,1.6);pose();invalidate();},face:enabled=>{face=enabled;zoom=1;pose();invalidate();},reset:()=>{yaw=0;zoom=1;face=false;if(runtime)runtime.root.rotation.y=0;pose();motion('idle');},dispose};
}

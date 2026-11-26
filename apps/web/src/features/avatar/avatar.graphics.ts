import * as THREE from 'three';
import {createTexturedAvatar} from './avatar.textured.runtime';
import {disposeSkinnedAvatar,setAvatarMotion,updateSkinnedAvatar,playAvatarGesture,type AvatarMotion,type AvatarExpression,type SkinnedAvatarRuntime} from './avatar.skinned.runtime';
import type {CharacterConfig} from './avatar.identity';
import {getExperience,resolveVisual,subscribeExperience,type Experience} from '../../core/experience/policy';

export type StudioGraphics={gesture:(name:string)=>void;expression:(value:AvatarExpression)=>void;quality:(value:'auto'|'detail')=>void;update:(config:CharacterConfig)=>void;motion:(value:AvatarMotion)=>void;rotate:(radians:number)=>void;zoom:(delta:number)=>void;face:(enabled:boolean)=>void;reset:()=>void;dispose:()=>void};
const aura=(s:string)=>s==='Neon Phantom'?0x765dff:s==='Diamond Mist'?0x76d8ff:0x21df81;
export function createStudioGraphics(canvas:HTMLCanvasElement,initial:CharacterConfig,onFrame:()=>void,onFailure:(reason:string)=>void,onAssetStatus:(status:'loading'|'ready'|'error',message:string)=>void=()=>{}):StudioGraphics{
  const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'low-power',alpha:false});
  renderer.setPixelRatio(1);renderer.toneMappingExposure=1.05;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=false;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x08100e);scene.fog=new THREE.FogExp2(0x08100e,.085);
  const camera=new THREE.PerspectiveCamera(34,1,.08,30);
  const hemi=new THREE.HemisphereLight(0xe5efff,0x534337,1.35);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffe6cc,3.1);key.position.set(3,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xb0ddff,1.65);fill.position.set(-4,2,2);scene.add(fill);const rim=new THREE.DirectionalLight(0xe9cb81,2.5);rim.position.set(0,3,-4);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.8,40),new THREE.MeshStandardMaterial({color:0x16271f,roughness:.48,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const ctx=contactCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,4,64,64,62);gradient.addColorStop(0,'rgba(0,0,0,.75)');gradient.addColorStop(.55,'rgba(0,0,0,.35)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const contactMap=new THREE.CanvasTexture(contactCanvas);const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.15),new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.012;scene.add(contact);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.83,.013,6,48),new THREE.MeshBasicMaterial({color:aura(initial.aura)}));ring.rotation.x=-Math.PI/2;ring.position.y=.008;scene.add(ring);
  let runtime:SkinnedAvatarRuntime|null=null;
  let yaw=0,zoom=1,face=false,active:AvatarMotion='idle',disposed=false,failed=false,raf=0,previous=0,deadline=0,dirty=true;
  let modelKey='',desired:CharacterConfig|null=null,loading=false;let revision=0;let quality:'auto'|'detail'='auto',mood:AvatarExpression='neutral',latest=initial;let expressionUntil=0;
  const controller=new AbortController(),signal=controller.signal;
  let experience=getExperience();
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
    const anim=active!=='idle'&&now<deadline;const living=!!runtime&&(!reduced.matches||now<expressionUntil);
    if(!dirty&&!anim&&!living&&active==='idle')return;
    if(previous&&now-previous<(mobile?32:16)){schedule();return;}
    const dt=previous?Math.min((now-previous)/1000,.075):0;previous=now;
    try{
      if(runtime){
        if(anim||living)updateSkinnedAvatar(runtime,dt);
        if(active==='jump'){
          const action=runtime.currentAction;
          const t=action?Math.min(1,action.time/action.getClip().duration):1;
          runtime.root.position.y=.38*4*t*(1-t);
        }
        if(!anim&&active!=='idle'){if(experience.behavior!=='manual'){mood='neutral';runtime.expression?.(mood);}active='idle';runtime.root.position.y=0;setAvatarMotion(runtime,'idle',.22);runtime.mixer.update(0);}
      }
      if(runtime){contact.material.opacity=Math.max(.14,1-runtime.root.position.y*1.6);contact.scale.setScalar(1+runtime.root.position.y*.6);}
      renderer.render(scene,camera);dirty=false;if(runtime)onFrame();
      if(anim||living){dirty=true;schedule();}else previous=0;
    }catch(error){fail(error instanceof Error?error.message:'WebGL draw failed');}
  };
  const invalidate=()=>{dirty=true;schedule();};
  const applyExperience=(value:Experience)=>{
    experience=value;const mode=resolveVisual(value.visual,'avatar-characters');
    canvas.dataset.rbVisualMode=mode;canvas.dataset.rbBehaviorMode=value.behavior;
    const cinematic=mode==='cinematic',expressive=mode==='expressive';
    renderer.toneMappingExposure=cinematic?.98:expressive?1.05:1.0;
    hemi.intensity=cinematic?1.15:expressive?1.6:1.05;
    key.color.setHex(cinematic?0xffe6cc:expressive?0xfff2da:0xc3adff);key.intensity=expressive?2.1:2.65;
    fill.color.setHex(mode==='fantasy'?0x9e74ff:0xb0ddff);fill.intensity=mode==='fantasy'?1.6:1.4;
    rim.color.setHex(mode==='fantasy'?aura(latest.aura):0xe9cb81);rim.intensity=mode==='fantasy'?2.8:1.65;
    (scene.background as THREE.Color).setHex(cinematic?0x08100e:expressive?0x1b2826:0x11152a);
    (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);
    floor.material.color.setHex(cinematic?0x16271f:expressive?0x293d36:0x201c3b);
    if(value.behavior==='manual'){mood='neutral';runtime?.expression?.(mood);expressionUntil=performance.now()+1000;}
    invalidate();
  };
  const stopExperience=subscribeExperience(applyExperience);
  const resize=()=>{if(disposed||failed)return;const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const limit=mobile?(quality==='detail'?1152:900):1600;const scale=Math.min(quality==='detail'?1.5:1,limit/Math.max(rect.width,rect.height));renderer.setSize(Math.max(1,Math.round(rect.width*scale)),Math.max(1,Math.round(rect.height*scale)),false);camera.aspect=rect.width/rect.height;pose();invalidate();};
  const drain=async()=>{
    if(loading||disposed||failed)return;loading=true;
    try{
      while(desired&&!disposed&&!failed){
        const config=desired;desired=null;const generation=revision;
        const key=JSON.stringify([config.gender,config.build,config.look,quality]);
        if(runtime&&key===modelKey){pose();invalidate();onAssetStatus('ready','Selected fitted wardrobe loaded');continue;}
        onAssetStatus('loading','Fitting selected human mesh and wardrobe…');
        let next:SkinnedAvatarRuntime;
        try{next=await createTexturedAvatar(config.gender,config.look,config.build,quality);}catch(error){if(generation===revision&&!disposed&&!failed){onAssetStatus('error',(error instanceof Error?error.message:'Asset load failed')+(runtime?' • previous verified appearance retained':''));}continue;}
        if(disposed||failed||generation!==revision){disposeSkinnedAvatar(next);continue;}
        // Swap only after the new complete fitted mesh exists; keep old render on a failed download.
        if(runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);}
        runtime=next;runtime.expression?.(mood);expressionUntil=performance.now()+1000;runtime.root.rotation.y=yaw;setAvatarMotion(runtime,'idle',0);runtime.mixer.update(0);
        scene.add(runtime.root);modelKey=key;active='idle';previous=0;pose();invalidate();onAssetStatus('ready','Selected fitted wardrobe loaded');
      }
    }catch(error){if(!disposed)fail(error instanceof Error?error.message:'Textured human asset failed');}
    finally{loading=false;if(desired&&!disposed&&!failed)void drain();}
  };
  const update=(config:CharacterConfig)=>{
    if(disposed||failed)return;
    latest=config;ring.material.color.setHex(aura(config.aura));const nextKey=JSON.stringify([config.gender,config.build,config.look,quality]);if(runtime&&nextKey===modelKey&&!loading){invalidate();onAssetStatus('ready','Selected fitted wardrobe loaded');return;}desired={...config,look:{...config.look}};revision++;onAssetStatus('loading','Applying selected appearance…');void drain();
  };
  const motion=(value:AvatarMotion)=>{if(!runtime||failed||disposed)return;if(experience.behavior!=='manual'){mood=value==='power'?'confident':value==='run'?'focused':value==='jump'?'surprised':'neutral';runtime.expression?.(mood);}active=value;runtime.root.position.y=0;setAvatarMotion(runtime,value,value==='idle'?0:.18);if(value==='idle')runtime.mixer.update(0);else{face=false;zoom=1;pose();}deadline=performance.now()+(value==='jump'?950:value==='power'?2500:5000);previous=0;invalidate();};
  const rotate=(radians:number)=>{yaw+=radians;if(runtime)runtime.root.rotation.y=yaw;invalidate();};
  let pointer:number|null=null,lastX=0;
  canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;rotate((e.clientX-lastX)*.012);lastX=e.clientX;},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;},{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('WebGL context lost');},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;previous=0;}else invalidate();},{signal});
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const dispose=()=>{if(disposed)return;disposed=true;controller.abort();stopExperience();observer.disconnect();cancelAnimationFrame(raf);if(runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);runtime=null;}floor.geometry.dispose();floor.material.dispose();contact.geometry.dispose();contact.material.dispose();contactMap.dispose();ring.geometry.dispose();ring.material.dispose();renderer.dispose();renderer.forceContextLoss();};
  applyExperience(experience);update(initial);resize();
  return {gesture:name=>{if(!runtime||failed||disposed)return;const duration=playAvatarGesture(runtime,name);if(!duration)return;active='power';runtime.root.position.y=0;face=false;zoom=1;pose();if(experience.behavior!=='manual')runtime.expression?.(name==='wave'?'smile':'neutral');deadline=performance.now()+duration*1000+180;previous=0;invalidate();},expression:value=>{mood=value;runtime?.expression?.(value);expressionUntil=performance.now()+1000;face=true;zoom=1;pose();invalidate();},quality:value=>{if(quality===value)return;quality=value;resize();update(latest);},update,motion,rotate,zoom:delta=>{zoom=THREE.MathUtils.clamp(zoom+delta,.8,1.6);pose();invalidate();},face:enabled=>{face=enabled;zoom=1;pose();invalidate();},reset:()=>{yaw=0;zoom=1;face=false;if(runtime)runtime.root.rotation.y=0;pose();motion('idle');},dispose};
}

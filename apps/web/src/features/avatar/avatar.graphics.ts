import * as THREE from 'three';
import {studioFrameInterval,oneShotActive} from './avatar.energy.motion';
import {createGroundShade,groundShadeMesh} from './avatar.cinematic.depth';
import {phoneRenderLimit} from './avatar.quality.v31';
import {nextRenderScale} from './avatar.render.budget';
import {createExpressionControl} from './avatar.expression.control';
import {createCharacterLightMap} from './avatar.light-map';
import {createTexturedAvatar} from './avatar.textured.runtime';
import {disposeSkinnedAvatar,setAvatarMotion,updateSkinnedAvatar,playAvatarGesture,type AvatarMotion,type AvatarExpression,type SkinnedAvatarRuntime} from './avatar.skinned.runtime';
import {normalizeTimeline,type MotionStep} from './avatar.motion.design';
import type {CharacterConfig} from './avatar.identity';
import {getExperience,resolveVisual,subscribeExperience,type Experience} from '../../core/experience/policy';

export type StudioGraphics={shot:(value:'portrait'|'full'|'orbit')=>void;lighting:(value:'studio'|'warm'|'night')=>void;still:()=>Promise<Blob>;routine:(names:readonly (string|MotionStep)[])=>boolean;gesture:(name:string)=>boolean;expression:(value:AvatarExpression,strength?:number)=>void;quality:(value:'auto'|'detail')=>void;update:(config:CharacterConfig)=>void;motion:(value:AvatarMotion)=>void;rotate:(radians:number)=>void;zoom:(delta:number)=>void;face:(enabled:boolean)=>void;reset:()=>void;dispose:()=>void};
// Serialize phone model construction even across Pause / Enable cycles.
let mobileFitTail:Promise<void>=Promise.resolve();
const aura=(s:string)=>s==='Neon Phantom'?0x765dff:s==='Diamond Mist'?0x76d8ff:0x21df81;
export function createStudioGraphics(canvas:HTMLCanvasElement,initial:CharacterConfig,onFrame:()=>void,onFailure:(reason:string)=>void,onAssetStatus:(status:'loading'|'ready'|'error',message:string)=>void=()=>{}):StudioGraphics{
  const mobile=matchMedia('(any-pointer:coarse),(max-width:860px)').matches;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'low-power',alpha:false});
  renderer.setPixelRatio(1);renderer.toneMappingExposure=1.05;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x08100e);scene.fog=new THREE.FogExp2(0x08100e,.085);
  let lightMap:THREE.WebGLRenderTarget|undefined;try{if(!mobile){lightMap=createCharacterLightMap(renderer);scene.environment=lightMap.texture;scene.environmentIntensity=.46;}}catch{ /* direct lights remain available */ }
  const camera=new THREE.PerspectiveCamera(34,1,.08,30);
  const hemi=new THREE.HemisphereLight(0xe5efff,0x534337,1.35);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffe6cc,3.1);key.position.set(-3,3.5,5);key.castShadow=!mobile;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.camera.near=.5;key.shadow.camera.far=12;key.shadow.normalBias=.018;key.shadow.bias=-.00015;scene.add(key);
  const fill=new THREE.DirectionalLight(0xb0ddff,1.65);fill.position.set(4,1.8,3);scene.add(fill);const rim=new THREE.DirectionalLight(0xe9cb81,2.5);rim.position.set(0,3,-4);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.8,40),new THREE.MeshStandardMaterial({color:0x16271f,roughness:.48,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=!mobile;scene.add(floor);
  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const ctx=contactCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,4,64,64,62);gradient.addColorStop(0,'rgba(0,0,0,.75)');gradient.addColorStop(.55,'rgba(0,0,0,.35)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const contactMap=new THREE.CanvasTexture(contactCanvas);const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.15),new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.012;scene.add(contact);
  const shadeMap=createGroundShade();const directionalShade=groundShadeMesh(shadeMap,1.35,2.5);directionalShade.position.set(.32,-.018,-.34);directionalShade.rotation.z=-.65;directionalShade.material.opacity=.86;directionalShade.visible=mobile;scene.add(directionalShade);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.83,.013,6,48),new THREE.MeshBasicMaterial({color:aura(initial.aura)}));ring.rotation.x=-Math.PI/2;ring.position.y=.008;scene.add(ring);
  let runtime:SkinnedAvatarRuntime|null=null;
  let shot:'portrait'|'full'|'orbit'='full',orbitAngle=0,lighting:'studio'|'warm'|'night'='studio';let yaw=0,zoom=1,face=false,active:AvatarMotion='idle',disposed=false,failed=false,raf=0,previous=0,deadline=0,dirty=true;
  let modelKey='',pendingKey='',desired:CharacterConfig|null=null,loading=false,awaitingFrame=false,shaderError=false;let revision=0,fitTimer=0;let quality:'auto'|'detail'='auto',latest=initial;const expressionControl=createExpressionControl<AvatarExpression>('neutral');let expressionUntil=0;let sequence:MotionStep[]=[];let routineActive=false,bodyTime=0,expressionClock=0;let loadStarted=0;let phoneLimit=640;let drawCost=0;let frameScale=1,frameAverage=mobile?50:17,measured=0,lastAdapt=0,lastTelemetry=0,visible=true;
  const controller=new AbortController(),signal=controller.signal;
  let experience=getExperience();
  renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=()=>{shaderError=true;};
  const fail=(message:string)=>{if(disposed||failed)return;failed=true;cancelAnimationFrame(raf);raf=0;onFailure(message);};
  const applyExpression=()=>expressionControl.apply(runtime?.expression);
  const automaticExpression=(value:AvatarExpression,strength=1)=>{if(expressionControl.automatic(value,strength))applyExpression();};
  const pose=()=>{
    if(!runtime)return;
    const h=runtime.height, aspect=Math.max(.25,camera.aspect),fov=face?24:34;
    const targetY=h*(face?.89:.53);
    // Fit both axes; reserve headroom and feet. Face mode includes neck and shoulders.
    const viewHeight=h*(face?.34:1.15),viewWidth=face?h*.32:Math.max(h*.64,runtime.accessoryWidth??0);
    const distance=Math.max(viewHeight,viewWidth/aspect)/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
    camera.position.set(Math.sin(orbitAngle)*distance,targetY+(shot==='orbit'?.08*h:0),Math.cos(orbitAngle)*distance);camera.fov=fov;camera.zoom=zoom;
    camera.updateProjectionMatrix();camera.lookAt(0,targetY,0);
  };
  const schedule=()=>{if(!disposed&&!failed&&!raf&&!document.hidden&&visible)raf=requestAnimationFrame(draw);};
  const draw=(now:number)=>{
    raf=0;if(disposed||failed||document.hidden||!visible)return;
    const anim=active!=='idle'&&(routineActive||((active==='jump'||active==='power')?oneShotActive(runtime?.currentAction):now<deadline));const living=!!runtime&&(!reduced.matches||now<expressionUntil);
    if(!dirty&&!anim&&!living&&active==='idle')return;
    if(previous&&now-previous<studioFrameInterval(mobile,drawCost,quality)){schedule();return;}
    const drawStarted=performance.now();const elapsed=previous?now-previous:0;const dt=Math.min(elapsed/1000,.075);previous=now;if(elapsed>0&&elapsed<250){frameAverage+=.08*(elapsed-frameAverage);measured++;}
    try{
      if(runtime){
        runtime.lookAt?.(experience.behavior!=='manual'&&active==='idle'&&!reduced.matches?camera.position:null);
        if(anim||living)updateSkinnedAvatar(runtime,dt);
        if(active==='idle'&&living&&experience.behavior!=='manual'&&!reduced.matches){bodyTime+=dt;expressionClock+=dt;if(expressionClock>6.5){expressionClock=0;automaticExpression(Math.floor(bodyTime/6.5)%3===1?'confident':'neutral',.25);}}
        if(routineActive&&runtime.currentAction&&(runtime.currentAction.paused||runtime.currentAction.time>=runtime.currentAction.getClip().duration-.001)){const next=sequence.shift();if(next){beginGesture(next.clip,next.speed,next.blend);}else{routineActive=false;active='idle';setAvatarMotion(runtime,'idle',.22);if(experience.behavior!=='manual')automaticExpression('neutral');}}
        if(active==='jump'){
          const action=runtime.currentAction;
          const t=action?Math.min(1,action.time/action.getClip().duration):1;
          runtime.root.position.y=.38*4*t*(1-t);
        }
        if(!anim&&active!=='idle'){if(experience.behavior!=='manual')automaticExpression('neutral');active='idle';runtime.root.position.y=0;setAvatarMotion(runtime,'idle',.22);runtime.mixer.update(0);}
      }
      if(runtime){contact.material.opacity=Math.max(.14,1-runtime.root.position.y*1.6);contact.scale.setScalar(1+runtime.root.position.y*.6);directionalShade.material.opacity=Math.max(.12,.86-runtime.root.position.y);directionalShade.scale.setScalar(1+runtime.root.position.y*.4);}
      if(shot==='orbit'&&runtime&&!reduced.matches){orbitAngle=(orbitAngle+dt*.38)%(Math.PI*2);pose();}
      renderer.render(scene,camera);drawCost+=.12*(performance.now()-drawStarted-drawCost);if(mobile&&runtime&&!loading&&measured>=90&&now-lastAdapt>3200){lastAdapt=now;const limit=phoneRenderLimit(quality,frameAverage,measured,phoneLimit);if(limit!==phoneLimit){phoneLimit=limit;resize();}}if(!mobile&&measured>30&&now-lastAdapt>2500&&!loading){lastAdapt=now;const next=nextRenderScale(frameScale,frameAverage,measured,mobile);if(Math.abs(next-frameScale)>.01){frameScale=next;resize();}}if(now-lastTelemetry>1000){lastTelemetry=now;canvas.dataset.rbFps=String(Math.round(1000/frameAverage));canvas.dataset.rbResolution=renderer.domElement.width+'×'+renderer.domElement.height;canvas.dataset.rbRenderScale=String(Math.round(frameScale*100));canvas.dataset.rbDrawCalls=String(renderer.info.render.calls);canvas.dataset.rbTriangles=String(renderer.info.render.triangles);canvas.dataset.rbTextures=String(renderer.info.memory.textures);}if(shaderError){fail('Material shader compilation failed');return;}dirty=false;if(runtime){if(awaitingFrame){awaitingFrame=false;onAssetStatus('ready',runtime.assetLabel??'Selected fitted wardrobe rendered');}onFrame();}
      if(anim||living){dirty=true;schedule();}else previous=0;
    }catch(error){fail(error instanceof Error?error.message:'WebGL draw failed');}
  };
  const invalidate=()=>{dirty=true;schedule();};
  const applyExperience=(value:Experience)=>{
    experience=value;const mode=resolveVisual(value.visual,'avatar-characters');
    canvas.dataset.rbVisualMode=mode;canvas.dataset.rbBehaviorMode=value.behavior;
    const cinematic=mode==='cinematic',expressive=mode==='expressive';
    renderer.toneMappingExposure=cinematic?1.0:expressive?1.0:.94;
    hemi.intensity=cinematic?.78:expressive?1.02:.85;
    key.color.setHex(cinematic?0xfff0df:expressive?0xfff2da:0xc3adff);key.intensity=cinematic?2.45:expressive?2.25:2.85;
    fill.color.setHex(mode==='fantasy'?0x9e74ff:0xdce9ff);fill.intensity=mode==='fantasy'?1.6:cinematic?.60:.82;
    rim.color.setHex(mode==='fantasy'?aura(latest.aura):0xf1ddc0);rim.intensity=mode==='fantasy'?2.8:cinematic?1.10:1.45;
    (scene.background as THREE.Color).setHex(cinematic?0x1b2325:expressive?0x293333:0x11152a);
    (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);
    floor.material.color.setHex(cinematic?0x333537:expressive?0x414847:0x201c3b);ring.visible=mode==='fantasy';directionalShade.visible=mobile&&mode!=='fantasy';
    if(value.behavior==='manual'){automaticExpression('neutral');expressionUntil=performance.now()+1000;}
    if(lighting!=='studio'){key.color.setHex(lighting==='warm'?0xffd0a0:0x8eafff);rim.color.setHex(lighting==='warm'?0xffbc72:0x9c7cde);key.intensity=lighting==='warm'?2.4:1.55;fill.intensity=lighting==='warm'?1.15:1.4;}
    invalidate();
  };
  const stopExperience=subscribeExperience(applyExperience);
  const resize=()=>{if(disposed||failed)return;const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const limit=mobile?phoneLimit:1600;const scale=Math.min(mobile?(quality==='detail'?2.25:1.65):quality==='detail'?1.5:1,limit/Math.max(rect.width,rect.height))*frameScale;const width=Math.max(1,Math.round(rect.width*scale)),height=Math.max(1,Math.round(rect.height*scale));if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);const aspect=rect.width/rect.height;if(Math.abs(camera.aspect-aspect)>.0001){camera.aspect=aspect;pose();}invalidate();};
  const drain=async()=>{
    if(loading||disposed||failed)return;loading=true;
    try{
      while(desired&&!disposed&&!failed){
        const config=desired;desired=null;const generation=revision,fitQuality=quality;
        const key=JSON.stringify([config.gender,config.build,config.look,fitQuality]);pendingKey=key;
        if(runtime&&key===modelKey){pose();awaitingFrame=true;invalidate();continue;}
        loadStarted=performance.now();if(mobile){phoneLimit=640;measured=0;resize();}onAssetStatus('loading','Fitting selected human mesh and wardrobe…');
        let next:SkinnedAvatarRuntime;
        // On phones never retain a fitted character while constructing another.
        if(mobile&&runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);runtime=null;modelKey='';renderer.renderLists.dispose();dirty=true;invalidate();}
        try{if(mobile){const job=mobileFitTail.then(async()=>{if(disposed||failed||generation!==revision)throw Error('Fit superseded');let fitted:SkinnedAvatarRuntime;try{fitted=await createTexturedAvatar(config.gender,config.look,config.build,fitQuality);}catch(e){if(fitQuality!=='detail'||disposed||failed||generation!==revision)throw e;fitted=await createTexturedAvatar(config.gender,config.look,config.build,'auto');fitted.assetLabel=(fitted.assetLabel??'Fitted character')+' · safe fallback (enhanced fit unavailable)';}if(disposed||failed||generation!==revision){disposeSkinnedAvatar(fitted);throw Error('Fit superseded');}return fitted;});mobileFitTail=job.then(()=>{},()=>{});next=await job;}else next=await createTexturedAvatar(config.gender,config.look,config.build,fitQuality);}catch(error){if(generation===revision&&!disposed&&!failed){onAssetStatus('error',(error instanceof Error?error.message:'Asset load failed')+(runtime?' • previous verified appearance retained':''));}continue;}
        if(disposed||failed||generation!==revision){disposeSkinnedAvatar(next);continue;}
        // Swap only after the new complete fitted mesh exists; keep old render on a failed download.
        if(runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);}
        runtime=next;sequence=[];routineActive=false;measured=0;frameAverage=mobile?34:17;drawCost=0;phoneLimit=640;canvas.dataset.rbAssetLoadMs=String(Math.round(performance.now()-loadStarted));applyExpression();expressionUntil=performance.now()+1000;runtime.root.rotation.y=yaw;setAvatarMotion(runtime,'idle',0);runtime.mixer.update(0);
        scene.add(runtime.root);modelKey=key;active='idle';previous=0;pose();if(mobile)resize();awaitingFrame=true;invalidate();
      }
    }catch(error){if(!disposed)fail(error instanceof Error?error.message:'Textured human asset failed');}
    finally{loading=false;pendingKey='';if(desired&&!disposed&&!failed)void drain();}
  };
  const update=(config:CharacterConfig)=>{
    if(disposed||failed)return;
    latest=config;ring.material.color.setHex(aura(config.aura));const nextKey=JSON.stringify([config.gender,config.build,config.look,quality]);if(runtime&&nextKey===modelKey&&!loading){desired=null;clearTimeout(fitTimer);revision++;awaitingFrame=true;invalidate();return;}if(loading&&!desired&&nextKey===pendingKey)return;desired={...config,look:{...config.look}};revision++;awaitingFrame=false;onAssetStatus('loading','Applying selected appearance…');clearTimeout(fitTimer);fitTimer=window.setTimeout(()=>void drain(),180);
  };
  const motion=(value:AvatarMotion)=>{if(!runtime||failed||disposed)return;sequence=[];routineActive=false;if(experience.behavior!=='manual')automaticExpression(value==='power'?'confident':value==='run'?'focused':value==='jump'?'surprised':'neutral');active=value;runtime.root.position.y=0;setAvatarMotion(runtime,value,value==='idle'?0:.18);if(value==='idle')runtime.mixer.update(0);else{face=false;zoom=1;pose();}deadline=performance.now()+((value==='jump'||value==='power')?(runtime.currentAction?.getClip().duration??1)*1000+120:5000);previous=0;invalidate();};
  const beginGesture=(name:string,speed=1,blend=.2)=>{if(!runtime||failed||disposed)return false;const duration=playAvatarGesture(runtime,name,speed,blend);if(!duration)return false;active='power';runtime.root.position.y=0;face=false;zoom=1;pose();if(experience.behavior!=='manual')automaticExpression(['wave','soft laugh','laugh','groove','bounce'].includes(name)?'smile':'neutral');deadline=performance.now()+duration*1000+180;invalidate();return true;};
  const rotate=(radians:number)=>{yaw+=radians;if(runtime)runtime.root.rotation.y=yaw;invalidate();};
  let pointer:number|null=null,lastX=0;
  canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;rotate((e.clientX-lastX)*.012);lastX=e.clientX;},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;},{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('WebGL context lost');},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;previous=0;}else invalidate();},{signal});
  const observer=new ResizeObserver(resize);observer.observe(canvas);const visibility=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(!visible){cancelAnimationFrame(raf);raf=0;previous=0;}else invalidate();},{threshold:.05});visibility.observe(canvas);
  const dispose=()=>{if(disposed)return;disposed=true;desired=null;clearTimeout(fitTimer);controller.abort();stopExperience();observer.disconnect();visibility.disconnect();cancelAnimationFrame(raf);if(runtime){scene.remove(runtime.root);disposeSkinnedAvatar(runtime);runtime=null;}floor.geometry.dispose();floor.material.dispose();contact.geometry.dispose();contact.material.dispose();contactMap.dispose();directionalShade.geometry.dispose();directionalShade.material.dispose();shadeMap.dispose();key.shadow.dispose();ring.geometry.dispose();ring.material.dispose();lightMap?.dispose();renderer.dispose();renderer.forceContextLoss();};
  applyExperience(experience);update(initial);resize();
  return {shot:value=>{shot=value;orbitAngle=0;face=value==='portrait';zoom=1;pose();invalidate();},lighting:value=>{lighting=value;applyExperience(experience);},still:()=>new Promise<Blob>((resolve,reject)=>{if(disposed||failed||!runtime||loading){reject(Error('Wait for the current character to render.'));return;}try{renderer.render(scene,camera);canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Image export unavailable')),'image/png');}catch(e){reject(e);}}),routine:names=>{const steps=normalizeTimeline([...names]);if(!runtime||!steps.length||steps.length!==names.length||!steps.every(n=>runtime!.actions.has(n.clip)))return false;sequence=steps.slice(1);routineActive=true;const ok=beginGesture(steps[0].clip,steps[0].speed,steps[0].blend);if(!ok){routineActive=false;sequence=[];}return ok;},gesture:name=>{sequence=[];routineActive=false;return beginGesture(name);},expression:(value,strength=1)=>{expressionControl.select(value,strength);applyExpression();expressionUntil=performance.now()+1000;shot='portrait';orbitAngle=0;face=true;zoom=1;pose();invalidate();},quality:value=>{if(quality===value)return;quality=value;phoneLimit=640;frameAverage=mobile?34:17;drawCost=0;frameScale=1;measured=0;resize();update(latest);},update,motion,rotate,zoom:delta=>{zoom=THREE.MathUtils.clamp(zoom+delta,.8,1.6);pose();invalidate();},face:enabled=>{shot=enabled?'portrait':'full';orbitAngle=0;face=enabled;zoom=1;pose();invalidate();},reset:()=>{expressionControl.release();applyExpression();shot='full';orbitAngle=0;yaw=0;zoom=1;face=false;if(runtime)runtime.root.rotation.y=0;pose();motion('idle');},dispose};
}

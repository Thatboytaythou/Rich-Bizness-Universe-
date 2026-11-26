import * as THREE from 'three';
import {HumanAvatar,loadHumanPackage,type HumanPackage,type HumanConfig} from './vendor/humanforge/runtime';
import {normalizeLook,type CharacterLook} from './avatar.character.config';
import type {AvatarGender,SkinnedAvatarRuntime} from './avatar.skinned.runtime';

// Pinned upstream CC0 asset pack. Code is vendored under MIT; no user data is sent.
const ASSETS='https://raw.githubusercontent.com/abdulrehman043/humanforge/v0.5.0/assets/human';
let packagePromise:Promise<HumanPackage>|null=null;
async function bytes(url:string):Promise<ArrayBuffer>{
  if(!url.startsWith(ASSETS+'/'))throw Error('Unrecognized character asset location');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Character asset HTTP '+response.status);return await response.arrayBuffer();}finally{clearTimeout(timer);}
}
const pkg=()=>packagePromise??=loadHumanPackage(ASSETS,{
  fetch:bytes,
  loadTexture:async(url)=>{
    const data=await bytes(url);
    const local=URL.createObjectURL(new Blob([data],{type:'image/webp'}));
    try{return await new THREE.TextureLoader().loadAsync(local);}finally{URL.revokeObjectURL(local);}
  }
}).catch(error=>{packagePromise=null;throw error;});
const hairIds:Record<string,string|null>={fade:'short01',curls:'afro01',braids:'braid01',long:'long01',bald:null};
const colors:Record<string,string>={black:'#1a1412','dark-brown':'#34251e',brown:'#69452b',blond:'#b89b67',silver:'#a6a3a2'};
const shoes:Record<string,string>={sneakers:'shoes01',boots:'shoes03','high-tops':'shoes02'};
export function humanConfig(gender:AvatarGender,look:CharacterLook,build:string):Partial<HumanConfig>{
  const male=gender==='boy',sex=male?'male':'female';
  const skinBase=look.skin==='deep'||look.skin==='warm'?'african':look.skin==='tan'?'asian':'caucasian';
  const outfit=male?({casual:'male_casualsuit02',sport:'male_casualsuit04',formal:'male_elegantsuit01',workwear:'male_worksuit01'} as Record<string,string>)[look.outfit]:({casual:'female_casualsuit01',sport:'female_sportsuit01',formal:'female_elegantsuit01',workwear:'female_casualsuit02'} as Record<string,string>)[look.outfit];
  const detail:Record<string,number>={jaw:look.jaw==='square'?.6:look.jaw==='narrow'?-.55:0,headSquare:look.face==='strong'?.45:0,headOval:look.face==='soft'?.45:0,cheekBones:look.face==='angular'?.40:0,eyeOpening:look.eyeShape==='open'?.45:look.eyeShape==='narrow'?-.4:0,noseWidth:look.nose==='wide'?.55:look.nose==='narrow'?-.55:0,noseDepth:look.nose==='prominent'?.65:0,mouthWidth:look.mouth==='wide'?.55:0,upperLip:look.mouth==='full'?.55:look.mouth==='thin'?-.55:0,lowerLip:look.mouth==='full'?.55:look.mouth==='thin'?-.55:0,browAngle:look.brows==='arched'?.45:look.brows==='straight'?-.35:0};
  return {gender:male?1:0,age:.19,muscle:build==='heroic'?.85:build==='lean'?.3:.6,weight:look.weight==='heavy'?.72:look.weight==='slim'?.28:.5,height:look.height==='tall'?.75:look.height==='short'?.25:.5,detail,skin:'young_'+skinBase+'_'+sex,skinTint:look.skin==='deep'?'#d8c5b5':look.skin==='tan'?'#d8bd9e':'#ffffff',eyes:look.eyes==='hazel'?'brownlight':look.eyes,hair:hairIds[look.hair]??null,hairColor:colors[look.hairColor]??colors.black,eyebrowColor:colors[look.hairColor]??colors.black,eyebrows:'eyebrow001',eyelashes:'eyelashes01',clothes:[outfit,shoes[look.shoes]]};
}
export async function createTexturedAvatar(gender:AvatarGender,raw:unknown,build='athletic'):Promise<SkinnedAvatarRuntime>{
  const look=normalizeLook(raw),p=await pkg(),config=humanConfig(gender,look,build);
  // Refuse partial/unclothed assets. All required slots must exist and load.
  for(const id of config.clothes??[])if(!p.manifest.proxies.some(x=>x.kind==='clothes'&&x.id===id))throw Error('Wardrobe asset unavailable');
  const avatar=new HumanAvatar(p);const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;avatar.textureSize=mobile?'1k':'2k';avatar.anisotropy=mobile?2:4;avatar.normalMaps=!mobile;
  let mixer:THREE.AnimationMixer|undefined;
  try{
    await avatar.setConfig(config);
    for(const id of config.clothes??[])if(!avatar.group.getObjectByName('clothes-'+id))throw Error('Wardrobe did not load completely');
    const root=new THREE.Group();root.name='rb-textured-human';root.add(avatar.group);root.updateMatrixWorld(true);
    const bone=(name:string)=>avatar.bones.find(b=>b.name.endsWith(':'+name));
    // Fit relaxed arm pose in world space, preserving the skeleton's bind transforms.
    for(const side of ['Left','Right']){
      const arm=bone(side+'Arm'),fore=bone(side+'ForeArm');if(!arm||!fore||!arm.parent)continue;
      root.updateMatrixWorld(true);
      const from=fore.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
      const to=new THREE.Vector3(from.x>0?.11:-.11,-1,.035).normalize();
      const world=arm.getWorldQuaternion(new THREE.Quaternion()),parent=arm.parent.getWorldQuaternion(new THREE.Quaternion());
      arm.quaternion.copy(parent.invert().multiply(new THREE.Quaternion().setFromUnitVectors(from,to).multiply(world)));root.updateMatrixWorld(true);
    }
    // Body is in meters. Use neutral standing height; don't override user height.
    let bounds=new THREE.Box3().setFromObject(root);const height=bounds.getSize(new THREE.Vector3()).y;
    if(!Number.isFinite(height)||height<1||height>2.5)throw Error('Invalid human mesh bounds');
    avatar.group.position.y-=bounds.min.y;root.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(root);
    const track=(name:string,t:number[],values:number[],axis=new THREE.Vector3(1,0,0))=>{
      const b=bone(name);if(!b||!b.parent)return null;
      const world=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const localAxis=axis.clone().applyQuaternion(world).normalize();
      const rest=b.quaternion.clone();
      const q=values.flatMap(v=>new THREE.Quaternion().setFromAxisAngle(localAxis,v).multiply(rest).toArray());
      return new THREE.QuaternionKeyframeTrack(b.uuid+'.quaternion',t,q);
    };
    const clip=(name:string,duration:number,amp:number)=>{const t=Array.from({length:25},(_,i)=>duration*i/24),phase=t.map(v=>v/duration*Math.PI*2);const tracks:THREE.KeyframeTrack[]=[];
      const add=(n:string,v:number[],axis?:THREE.Vector3)=>{const a=track(n,t,v,axis);if(a)tracks.push(a);};
      for(const [i,side] of ['Left','Right'].entries()){
        const p=phase.map(x=>x+i*Math.PI);
        add(side+'UpLeg',p.map(x=>Math.sin(x)*amp));add(side+'Leg',p.map(x=>Math.max(0,-Math.sin(x-.3))*amp*.9));add(side+'Foot',p.map(x=>-.12*Math.sin(x)));
        add(side+'Arm',p.map(x=>-Math.sin(x)*amp*.55));add(side+'ForeArm',p.map(x=>-.12-Math.max(0,Math.sin(x))*amp*.38));
      }
      add('Spine',phase.map(x=>.035*Math.sin(x)),new THREE.Vector3(0,0,1));
      return new THREE.AnimationClip(name,duration,tracks);
    };
    const actionClip=(name:string,duration:number,pose:'idle'|'jump'|'power')=>{
      const tracks:THREE.KeyframeTrack[]=[],times=[0,duration*.45,duration];
      for(const side of ['Left','Right']){
        for(const [joint,values] of [['UpLeg',pose==='jump'?[0,-.4,0]:[0,0,0]],['Leg',pose==='jump'?[0,.8,0]:[0,0,0]],['Arm',pose==='power'?[0,-.8,-.5]:pose==='jump'?[0,-.4,0]:[0,0,0]],['ForeArm',pose==='power'?[0,-.8,-.5]:[0,0,0]]] as [string,number[]][]){const t=track(side+joint,times,values);if(t)tracks.push(t);}
      }return new THREE.AnimationClip(name,duration,tracks);
    };
    const idle=()=>{const duration=4.8,t=Array.from({length:17},(_,i)=>duration*i/16),phase=t.map(v=>v/duration*Math.PI*2),tracks:THREE.KeyframeTrack[]=[];
      const add=(n:string,v:number[],axis?:THREE.Vector3)=>{const a=track(n,t,v,axis);if(a)tracks.push(a);};
      add('Spine',phase.map(x=>.018*Math.sin(x)),new THREE.Vector3(0,0,1));
      add('Spine1',phase.map(x=>.024*Math.sin(x)),new THREE.Vector3(1,0,0));
      add('Head',phase.map(x=>.045*Math.sin(x)),new THREE.Vector3(0,1,0));
      for(const [i,side] of ['Left','Right'].entries()){add(side+'Arm',phase.map(x=>.035*Math.sin(x+i*Math.PI)));add(side+'ForeArm',phase.map(x=>-.10+.025*Math.cos(x+i*Math.PI)));}
      return new THREE.AnimationClip('idle',duration,tracks);
    };
    const clips=[idle(),clip('walk',1.1,.43),clip('run',.76,.68),actionClip('jump',.9,'jump'),actionClip('power pose',1.3,'power')];
    mixer=new THREE.AnimationMixer(root);const actions=new Map(clips.map(c=>[c.name,mixer!.clipAction(c)]));
    return {root,mixer,actions,clips,bounds,height,currentMotion:'idle',currentAction:null,dispose:()=>{mixer?.stopAllAction();mixer?.uncacheRoot(root);const skeletons=new Set<THREE.Skeleton>();root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((o as THREE.SkinnedMesh).skeleton);});avatar.dispose();skeletons.forEach(s=>s.dispose());root.clear();}};
  }catch(error){avatar.dispose();throw error;}
}

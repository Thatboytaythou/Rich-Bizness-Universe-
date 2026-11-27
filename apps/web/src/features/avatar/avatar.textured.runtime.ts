import * as THREE from 'three';
import {hdRecipe} from './avatar.hd.recipe';
import {bakeGroundedGait} from './avatar.contact-motion';
import {capturedMotion} from './avatar.captured-motion';
import {attachCharacterDetail} from './avatar.surface-detail';
import {HumanAvatar,loadHumanPackage,type HumanPackage,type HumanConfig} from './vendor/humanforge/runtime';
import {normalizeLook,SCULPT_FIELDS,type CharacterLook} from './avatar.character.config';
import type {AvatarGender,AvatarExpression,SkinnedAvatarRuntime} from './avatar.skinned.runtime';

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
const hairIds:Record<string,string|null>={fade:'short01',curls:'afro01',braids:'braid01',long:'long01',bald:null,'short-crop':'short04','short-swept':'short02','short-classic':'short03',ponytail:'ponytail01',bob:'bob02','bob-classic':'bob01','blunt-bangs':'cortu_straight_bangs',bun:'rehmanpolanski_hair_bun_brown','natural-volume':'culturalibre_hair_01'};
const colors:Record<string,string>={black:'#1a1412','dark-brown':'#34251e',brown:'#69452b',blond:'#b89b67',silver:'#a6a3a2'};
const shoes:Record<string,string>={sneakers:'shoes01',boots:'shoes03','high-tops':'shoes02','shoe-4':'shoes04','shoe-5':'shoes05','shoe-6':'shoes06'};
export function humanConfig(gender:AvatarGender,look:CharacterLook,build:string):Partial<HumanConfig>{
  const male=gender==='boy',sex=male?'male':'female';
  const skinBase=['deep','warm','ebony','brown'].includes(look.skin)?'african':['tan','caramel','olive'].includes(look.skin)?'asian':'caucasian';
  const skinTint:Record<string,string>={deep:'#d8c5b5',warm:'#ffffff',tan:'#d8bd9e',light:'#ffffff',ebony:'#a99383',brown:'#eddfd3',caramel:'#c99f78',olive:'#e0c4a2'};
  const outfit=male?({casual:'male_casualsuit02',sport:'male_casualsuit04',formal:'male_elegantsuit01',workwear:'male_worksuit01','casual-alt':'male_casualsuit05',tailored:'toigo_male_suit_3','double-breasted':'toigo_male_double-breasted_suit',evening:'toigo_suit_with_dinner_jacket'} as Record<string,string>)[look.outfit]:({casual:'female_casualsuit01',sport:'female_sportsuit01',formal:'female_elegantsuit01',workwear:'female_casualsuit02','casual-alt':'female_casualsuit02',tailored:'toigo_female_suit_2','double-breasted':'toigo_female_double-breasted_suit',evening:'toigo_halter_dress_knee_length'} as Record<string,string>)[look.outfit];
  const detail:Record<string,number>={jaw:look.jaw==='square'?.6:look.jaw==='narrow'?-.55:0,headSquare:look.face==='strong'?.45:0,headOval:look.face==='soft'?.45:0,cheekBones:look.face==='angular'?.40:0,eyeOpening:look.eyeShape==='open'?.45:look.eyeShape==='narrow'?-.4:0,noseWidth:look.nose==='wide'?.55:look.nose==='narrow'?-.55:0,noseDepth:look.nose==='prominent'?.65:0,mouthWidth:look.mouth==='wide'?.55:0,upperLip:look.mouth==='full'?.55:look.mouth==='thin'?-.55:0,lowerLip:look.mouth==='full'?.55:look.mouth==='thin'?-.55:0,browAngle:look.brows==='arched'?.45:look.brows==='straight'?-.35:0};
  for(const key of SCULPT_FIELDS){const value=Number(look[key])/100*.65;detail[key]=THREE.MathUtils.clamp((detail[key]??0)+value,-1,1);}
  const maturity=look.maturity==='older'?'old':look.maturity==='mature'?'middleage':'young';
  const headwear=look.hat==='fedora'?'fedora01':look.hat==='tilted-fedora'?'fedora_cocked':null;
  return {gender:male?1:0,age:look.maturity==='older'?.72:look.maturity==='mature'?.40:.19,muscle:build==='heroic'?.85:build==='lean'?.3:.6,weight:look.weight==='heavy'?.72:look.weight==='slim'?.28:.5,height:look.height==='tall'?.75:look.height==='short'?.25:.5,detail,skin:maturity+'_'+skinBase+'_'+sex,skinTint:skinTint[look.skin]??'#ffffff',eyes:look.eyes==='hazel'?'brownlight':look.eyes,hair:hairIds[look.hair]??null,hairColor:colors[look.hairColor]??colors.black,eyebrowColor:colors[look.hairColor]??colors.black,eyebrows:look.browStyle==='natural'?'eyebrow001':'eyebrow00'+look.browStyle.slice(-1),eyelashes:'eyelashes01',clothes:[outfit,shoes[look.shoes],...(headwear?[headwear]:[])]};
}
async function createLegacyTexturedAvatar(gender:AvatarGender,raw:unknown,build='athletic',quality:'auto'|'detail'='auto'):Promise<SkinnedAvatarRuntime>{
  const look=normalizeLook(raw),p=await pkg(),config=humanConfig(gender,look,build);
  // Refuse partial/unclothed assets. All required slots must exist and load.
  for(const id of config.clothes??[])if(!p.manifest.proxies.some(x=>x.kind==='clothes'&&x.id===id))throw Error('Wardrobe asset unavailable');
  const avatar=new HumanAvatar(p);const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;avatar.textureSize=mobile&&quality!=='detail'?'1k':'2k';avatar.anisotropy=mobile&&quality!=='detail'?2:4;avatar.normalMaps=!mobile||quality==='detail';
  let mixer:THREE.AnimationMixer|undefined;let surface:ReturnType<typeof attachCharacterDetail>|undefined;const accessories:THREE.Mesh[]=[];
  try{
    await avatar.setConfig(config);
    for(const id of config.clothes??[])if(!avatar.group.getObjectByName('clothes-'+id))throw Error('Wardrobe did not load completely');
    surface=attachCharacterDetail(avatar.group,look,quality==='detail'||!mobile);
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
    // Relax the elbow and align wrists with the forearm before generating clips.
    for(const side of ['Left','Right']){
      const fore=bone(side+'ForeArm'),hand=bone(side+'Hand'),mid=bone(side+'HandMiddle1');if(!fore||!hand||!mid||!hand.parent)continue;
      const along=hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize();
      const fingers=mid.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(new THREE.Vector3())).normalize();
      if(along.lengthSq()>.5&&fingers.lengthSq()>.5){const correction=new THREE.Quaternion().setFromUnitVectors(fingers,along);correction.slerp(new THREE.Quaternion(),.25);hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(correction).multiply(hand.getWorldQuaternion(new THREE.Quaternion())));root.updateMatrixWorld(true);}
      if(side==='Left'&&look.wristwear!=='none'){
        const index=bone(side+'HandIndex1'),pinky=bone(side+'HandPinky1');const width=index&&pinky?index.getWorldPosition(new THREE.Vector3()).distanceTo(pinky.getWorldPosition(new THREE.Vector3())):.066;
        const radius=THREE.MathUtils.clamp(width*.52,.025,.048),metal=look.wristwear!=='onyx-band';
        const cuff=new THREE.Mesh(new THREE.TorusGeometry(radius,.0045,8,32),new THREE.MeshStandardMaterial({color:look.wristwear==='gold-cuff'?0xd4aa54:look.wristwear==='silver-cuff'?0xc5cbd0:0x191d21,metalness:metal?.85:.1,roughness:metal?.24:.65}));
        cuff.rotation.x=Math.PI/2;cuff.position.y=-.006;hand.add(cuff);accessories.push(cuff);
      }
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
    // All clips bind the same joint set so a power pose cannot leave the elbows or legs frozen.
    const jointNames=['Hips','Spine','Spine1','Spine2','Neck','Head',...['Left','Right'].flatMap(side=>['UpLeg','Leg','Foot','ToeBase','Shoulder','Arm','ForeArm','Hand',...['Index','Middle','Ring','Pinky','Thumb'].flatMap(f=>[1,2,3].map(i=>'Hand'+f+i))].map(j=>side+j))];
    const makeClip=(name:string,duration:number,angles:(joint:string,p:number)=>[number,number,number],bob:(p:number)=>number=()=>0)=>{
      const t=Array.from({length:33},(_,i)=>duration*i/32),tracks:THREE.KeyframeTrack[]=[];
      for(const n of jointNames){
        const b=bone(n);if(!b||!b.parent)continue;
        const inverse=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),rest=b.quaternion.clone();
        const values=t.flatMap(time=>{const a=angles(n,time/duration);
          const captured=name==='walk'||name==='run'?capturedMotion(name,n,time/duration):null;
          if(captured)for(let axis=0;axis<3;axis++)a[axis]=a[axis]*.52+captured[axis]*.48;
          if(/Hand(Index|Middle|Ring|Pinky|Thumb)[123]$/.test(n)){
            const side=n.startsWith('Left')?'Left':'Right';const hand=bone(side+'Hand'),index=bone(side+'HandIndex1'),pinky=bone(side+'HandPinky1');
            // Bone local +Y follows the finger; use the actual across-palm direction, not a guessed local X axis.
            const axis=index&&pinky?index.getWorldPosition(new THREE.Vector3()).sub(pinky.getWorldPosition(new THREE.Vector3())).normalize().applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert()):new THREE.Vector3(1,0,0);
            const curl=(name==='run'?.42:name==='wave'?.035:.23)+.035*Math.sin(time/duration*Math.PI*2);const amount=/Thumb/.test(n)?curl*.25:curl*(n.endsWith('1')?1:n.endsWith('2')?.85:.55);
            return rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis,amount*(side==='Left'?1:-1))).toArray();
          }
          const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(a[0],a[1],a[2],'YXZ'));
          return inverse.clone().multiply(rotation).multiply(inverse.clone().invert()).multiply(rest).toArray();});
        tracks.push(new THREE.QuaternionKeyframeTrack(b.uuid+'.quaternion',t,values));
      }
      const hips=bone('Hips');
      if(hips?.parent){const up=new THREE.Vector3(0,1,0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
        tracks.push(new THREE.VectorKeyframeTrack(hips.uuid+'.position',t,t.flatMap(time=>hips.position.clone().addScaledVector(up,bob(time/duration)).toArray())));}
      return new THREE.AnimationClip(name,duration,tracks);
    };
    const idle=makeClip('idle',5.2,(n,p)=>{
      const a=p*Math.PI*2,s=Math.sin(a),c=Math.cos(a),side=n.startsWith('Left')?1:-1;
      if(n==='Hips')return [0,.025*s,(look.stance==='confident'?.045:look.stance==='alert'?0:.015)+.018*c];
      if(n==='Spine')return [.014*s,-.018*s,-.012-.016*c];
      if(n==='Spine1')return [.025*s,0,-.010*c];
      if(n==='Head')return [.024*c,.06*s,.012*s];
      if(n.endsWith('Arm')&&!n.endsWith('ForeArm'))return [.045+.025*s,0,side*.025*c];
      if(n.endsWith('ForeArm'))return [-(look.stance==='alert'?.19:.055)+.018*c,0,0];
      if(n.endsWith('Hand'))return [0,.012*side,.014*side];
      return [0,0,0];
    },p=>.003*Math.sin(p*Math.PI*2));
    const gait=(name:string,duration:number,run:boolean)=>makeClip(name,duration,(n,p)=>{
      const a=p*Math.PI*2,side=n.startsWith('Left')?1:-1,q=a+(side===1?0:Math.PI),s=Math.sin(q),c=Math.cos(q),swing=Math.max(0,-s);
      if(n==='Hips')return [run?.09:.025,.085*Math.sin(a),.035*Math.cos(a)];
      if(n==='Spine')return [run?.13:.025,-.10*Math.sin(a),-.025*Math.cos(a)];
      if(n==='Spine1')return [run?.055:0,-.035*Math.sin(a),0];
      if(n==='Head')return [run?-.08:-.018,.02*Math.sin(a),.02*Math.cos(a)];
      if(n.endsWith('UpLeg'))return [(run?.66:.43)*s-.035,0,side*.025];
      if(n.endsWith('Leg'))return [.08+(run?1.15:.73)*Math.pow(swing,1.5),0,0];
      if(n.endsWith('Foot'))return [-.18*s-.18*swing,0,0];
      if(n.endsWith('ToeBase'))return [.15*Math.max(0,c),0,0];
      if(n.endsWith('Arm')&&!n.endsWith('ForeArm'))return [-s*(run?.58:.27),0,side*.035];
      if(n.endsWith('ForeArm'))return [-(run?.85:.15)-.18*Math.max(0,s),0,0];
      if(n.endsWith('Hand'))return [.04*s,side*.035,0];
      return [0,0,0];
    },p=>(run?.034:.015)*(1-Math.cos(p*Math.PI*4))*.5);
    const jump=makeClip('jump',.96,(n,p)=>{
      const bend=Math.sin(Math.PI*p),side=n.startsWith('Left')?1:-1;
      if(n.endsWith('UpLeg'))return [-.48*bend,0,0];
      if(n.endsWith('Leg'))return [.92*bend,0,0];
      if(n.endsWith('Foot'))return [-.3*bend,0,0];
      if(n.endsWith('Arm')&&!n.endsWith('ForeArm'))return [-.65*bend,0,side*.15*bend];
      if(n.endsWith('ForeArm'))return [-.36*bend,0,0];
      if(n==='Spine')return [.16*bend,0,0];
      return [0,0,0];
    });
    const power=makeClip('power pose',2.4,(n,p)=>{
      const a=Math.sin(Math.PI*p)**2,side=n.startsWith('Left')?1:-1;
      if(n==='Hips')return [0,.12*a,-.055*a];
      if(n==='Spine')return [-.045*a,-.09*a,.035*a];
      if(n==='Head')return [-.045*a,.10*a,0];
      if(n.endsWith('Arm')&&!n.endsWith('ForeArm'))return [-.19*a,0,-side*.18*a];
      if(n.endsWith('ForeArm'))return [-.4*a,0,0];
      if(n.endsWith('Hand'))return [0,side*.12*a,0];
      return [0,0,0];
    });
    const walk=bakeGroundedGait(root,avatar.bones,gait('walk',1.08,false),false);
    const run=bakeGroundedGait(root,avatar.bones,gait('run',.72,true),true);
    const gesture=(name:string,duration:number)=>makeClip(name,duration,(n,p)=>{
      const a=Math.sin(Math.PI*p)**2,side=n.startsWith('Left')?1:-1;
      if(n==='Hips')return [0,.065*a,-.035*a];
      if(n==='Spine')return [.025*a,-.065*a,.03*a];
      if(n==='Head')return [name==='nod'?.16*Math.sin(p*Math.PI*4)*a:0,name==='look around'?.42*Math.sin(p*Math.PI*2):.065*a,0];
      if(n==='Neck')return [name==='nod'?.04*Math.sin(p*Math.PI*4)*a:0,name==='look around'?.13*Math.sin(p*Math.PI*2):0,0];
      if(name==='wave'){
        if(n==='RightArm')return [-.28*a,0,-1.05*a];
        if(n==='RightForeArm')return [-1.05*a,0,-.20*a];
        if(n==='RightHand')return [0,0,.25*Math.sin(p*Math.PI*8)*a];
      }
      if(name==='stretch'){
        if(n.endsWith('Arm')&&!n.endsWith('ForeArm'))return [-1.1*a,0,side*.22*a];
        if(n.endsWith('ForeArm'))return [-.18*a,0,0];
      }
      if(n.endsWith('ForeArm'))return [-.13*a,0,0];
      return [0,0,0];
    });
    const clips=[idle,walk.clip,run.clip,jump,power,gesture('wave',2.8),gesture('look around',3.6),gesture('nod',2.1),gesture('stretch',3.5)];
    // Real GPU morph targets from the licensed human asset. Expressions are transient.
    const moods:Record<AvatarExpression,Record<string,number>>={
      neutral:{},smile:{mouthSmile:.58,eyeSquintLeft:.15,eyeSquintRight:.15},
      focused:{browDownLeft:.32,browDownRight:.32,eyeSquintLeft:.27,eyeSquintRight:.27,mouthPress:.2},
      surprised:{jawOpen:.32,eyeWideLeft:.46,eyeWideRight:.46,browInnerUpLeft:.44,browInnerUpRight:.44},
      confident:{mouthSmile:.25,browOuterUpLeft:.28,eyeSquintRight:.10},laugh:{mouthSmile:.8,jawOpen:.36,eyeSquintLeft:.35,eyeSquintRight:.35},sad:{browInnerUpLeft:.35,browInnerUpRight:.35,mouthFrownLeft:.45,mouthFrownRight:.45},angry:{browDownLeft:.65,browDownRight:.65,mouthPress:.45,eyeSquintLeft:.32,eyeSquintRight:.32}
    };
    const names=avatar.expressionNames.filter(n=>Object.values(moods).some(m=>n in m)||n==='eyeBlinkLeft'||n==='eyeBlinkRight');
    const weights:Record<string,number>={};let mood:AvatarExpression='neutral',strength=1,faceTime=0,nextBlink=2.7;
    const expression=(value:AvatarExpression,intensity=1)=>{if(value in moods){mood=value;strength=THREE.MathUtils.clamp(intensity,0,1);}};
    const animateFace=(dt:number)=>{
      faceTime+=dt;surface?.tick(dt,currentMotion());
      if(faceTime>nextBlink+.2)nextBlink=faceTime+2.5+Math.random()*2.5;
      const blink=faceTime>=nextBlink?Math.sin(Math.PI*THREE.MathUtils.clamp((faceTime-nextBlink)/.2,0,1)):0;
      for(const n of names){const target=n.startsWith('eyeBlink')?blink:(moods[mood][n]??0)*strength;
        const w=THREE.MathUtils.lerp(weights[n]??0,target,1-Math.exp(-dt*(n.startsWith('eyeBlink')?35:9)));if(Math.abs(w-(weights[n]??0))>.001){weights[n]=w;avatar.setExpression(n,w);}}
    };
    let runtime:SkinnedAvatarRuntime;const currentMotion=()=>runtime?.currentMotion??'idle';
    mixer=new THREE.AnimationMixer(root);const actions=new Map(clips.map(c=>[c.name,mixer!.clipAction(c)]));
    runtime={root,mixer,actions,clips,bounds,height,currentMotion:'idle',currentAction:null,expression,animateFace,locomotionSpeed:{walk:walk.speed,run:run.speed},dispose:()=>{mixer?.stopAllAction();mixer?.uncacheRoot(root);const skeletons=new Set<THREE.Skeleton>();root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((o as THREE.SkinnedMesh).skeleton);});for(const a of accessories){a.removeFromParent();a.geometry.dispose();(a.material as THREE.Material).dispose();}surface?.dispose();avatar.dispose();skeletons.forEach(s=>s.dispose());root.clear();}};return runtime;
  }catch(error){for(const a of accessories){a.removeFromParent();a.geometry.dispose();(a.material as THREE.Material).dispose();}surface?.dispose();avatar.dispose();throw error;}
}

// Shared by Studio, Profile and every district. Never rewrite a saved look to force compatibility.
export async function createTexturedAvatar(gender:AvatarGender,raw:unknown,build='athletic',quality:'auto'|'detail'='auto'):Promise<SkinnedAvatarRuntime>{
 const recipe=hdRecipe(gender,raw,build);
 if(recipe.params){const {createHDCharacter}=await import('./avatar.hd.runtime');return createHDCharacter(gender,raw,build,quality);}
 const look=normalizeLook(raw);if(SCULPT_FIELDS.some(key=>look[key]!=='0'))throw Error('Advanced anatomy requires HD-compatible selections: '+recipe.unsupported.join(', '));if(look.wristwear!=='none'||look.collection!=='none'||look.facialHair!=='none'||look.earrings!=='none'||look.tattooArt!=='none'||look.presence!=='natural'||look.eliteJewelry!=='collection'||look.identityMode!=='human'||look.evolution!=='none'||look.designerCut!=='collection'||look.designerPalette!=='collection'||look.designerAccent!=='collection'||look.designerFootwear!=='collection'||look.signature!=='none'||look.wings!=='none'||look.surfaceDetail!=='natural'||look.regalia!=='none'||look.mantle!=='none')throw Error('Elite requires HD-compatible selections: '+recipe.unsupported.join(', '));
 const mobile=matchMedia('(any-pointer:coarse),(max-width:860px)').matches;const legacy=await createLegacyTexturedAvatar(gender,raw,build,mobile?'auto':quality);legacy.assetLabel='Compatibility mesh · HD unavailable for '+recipe.unsupported.join(', ');return legacy;
}

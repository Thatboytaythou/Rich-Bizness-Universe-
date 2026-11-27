import * as THREE from 'three';
import {createCharacter} from 'ara3d';
import {mobileDetail} from './avatar.quality.v31';
import {energeticClip} from './avatar.energy.motion';
import {surfaceRole,fabricFinish,hairStrandNormal} from './avatar.material.roles';
import {weaveNormal} from './avatar.visual.assets';
import {applyNaturalSkin,skinMicroSurface,naturalHairMaterial} from './avatar.skin.surface';
import {hdRecipe,HD_CLIPS} from './avatar.hd.recipe';
import {originalWearables} from './avatar.original.wearables';
import {normalizeLook} from './avatar.character.config';
import type {AvatarGender,AvatarExpression,SkinnedAvatarRuntime} from './avatar.skinned.runtime';

export async function createHDCharacter(gender:AvatarGender,raw:unknown,build:string,quality:'auto'|'detail'):Promise<SkinnedAvatarRuntime>{
 const recipe=hdRecipe(gender,raw,build);if(!recipe.params)throw Error('HD asset compatibility: '+recipe.unsupported.join(', '));
 const mobile=matchMedia('(any-pointer:coarse),(max-width:860px)').matches;
 const detail=mobile?mobileDetail(quality):quality==='detail'?'high':'medium';
 const hero=await createCharacter({kind:'ara-character',version:1,params:recipe.params},{detail,animations:[...HD_CLIPS],rootMotion:false,assetsUrl:new URL('/character-assets/ara-1.2.0/',location.origin).href});
 let strands:THREE.DataTexture|undefined;let textile:THREE.DataTexture|undefined;let microSkin:THREE.DataTexture|undefined;let mixer:THREE.AnimationMixer|undefined;let wearables:ReturnType<typeof originalWearables>|undefined;
 try{
  const root=new THREE.Group();root.name='rb-hd-character-v33';root.add(hero.scene);
  const bones=new Set<THREE.Bone>();let triangles=0,meshes=0,faceMorphs=0;
  root.traverse(o=>{const mesh=o as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;meshes++;mesh.skeleton.bones.forEach(b=>bones.add(b));triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;faceMorphs+=Object.keys(mesh.morphTargetDictionary??{}).length;mesh.frustumCulled=false;mesh.castShadow=!mobile;});
  if(!meshes||bones.size<30||triangles<15000||triangles>(detail==='high'?220000:mobile&&detail==='medium'?85000:100000)||faceMorphs<5)throw Error('HD mesh failed anatomy/rig budget: '+Math.round(triangles)+' triangles, '+bones.size+' bones');
  // Reject an enhanced phone fit before uploading it to the WebGL renderer if its texture footprint exceeds budget.
  if(mobile&&detail==='medium'){const maps=new Set<THREE.Texture>();root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material)){if((value as THREE.Texture|undefined)?.isTexture)maps.add(value as THREE.Texture);}});let estimate=0;for(const map of maps){const image=map.image;if(!image||!Number.isFinite(image.width)||!Number.isFinite(image.height))continue;if(image.width>2048||image.height>2048)throw Error('Enhanced fit exceeds 2048px texture limit');estimate+=image.width*image.height*4*(map.generateMipmaps?4/3:1);}if(estimate>64*1024*1024)throw Error('Enhanced fit exceeds estimated 64 MiB texture budget');}
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),height=hero.height;
  if(!Number.isFinite(height)||height<1||height>2.5||!Number.isFinite(bounds.min.y))throw Error('HD mesh invalid size');
  hero.scene.position.y-=bounds.min.y;root.updateMatrixWorld(true);bounds.setFromObject(root);
  const look=normalizeLook(raw);wearables=originalWearables(root,bones,height,look);
  const cinematic=look.identityMode==='cinematic',fantasy=look.identityMode==='phantom';
  const clips:THREE.AnimationClip[]=[];const names:Record<string,string>={idle:'idle',walk:look.presence==='editorial'?'model_walk':look.presence==='relaxed'?'walk_slouch':'walk',run:'run',jump:'jump',power:'cheer',wave:'wave','look around':'look_around',bow:'bow','talk gestures':'talk_gestures','catwalk':'model_walk','relaxed walk':'walk_slouch','clap':'clap','point':'point','thumbs up':'thumbs_up','groove':'dance_groove','bounce':'dance_bounce','laugh':'laugh_hard','turn left':'turn_left_90','turn right':'turn_right_90',talk:'talk','soft laugh':'laugh'};
  mixer=new THREE.AnimationMixer(root);const actions=new Map<string,THREE.AnimationAction>();
  for(const [name,id] of Object.entries(names)){const src=hero.clip(id);if(!src||!src.tracks.length||!Number.isFinite(src.duration)||src.duration<=0)throw Error('Missing retargeted clip: '+id);const clip=energeticClip(src,name,bones,look.identityMode);clips.push(clip);actions.set(name,mixer.clipAction(clip,hero.scene));}
  // One pass, one material owner; match actual vendor IDs and preserve the original accessory finish.
  const portrait=look.surfaceDetail==='portrait'||cinematic,enhanced=!mobile||quality==='detail';
  const surfaces=new Map<THREE.Material,ReturnType<typeof surfaceRole>>();
  hero.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const uv=!!mesh.geometry.getAttribute('uv');
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    const mat=material as THREE.MeshStandardMaterial;if(!mat.isMeshStandardMaterial||surfaces.has(mat))continue;
    const role=surfaceRole(mat.name,mesh.name);surfaces.set(mat,role);
    if(role==='skin'){applyNaturalSkin(mat,look.skinFinish,portrait,fantasy,enhanced&&uv,()=>microSkin??=skinMicroSurface());continue;}
    if(role==='hair'||role==='facial-hair'){naturalHairMaterial(mat,role==='hair'?'hair':'facial');if(enhanced&&uv&&mat.map&&!mat.normalMap&&!mat.bumpMap){strands??=hairStrandNormal();mat.normalMap=strands;mat.normalScale.setScalar(role==='facial-hair'?.23:.38);mat.needsUpdate=true;}continue;}
    if(role==='eye'||role==='cornea'){mat.roughness=role==='cornea'?.12:fantasy?.20:.28;mat.metalness=0;mat.envMapIntensity=.65;continue;}
    if(role==='face-detail'||role==='unknown')continue;
    const finish=fabricFinish(role);mat.roughness=finish.roughness;mat.metalness=0;
    if(uv&&!mat.normalMap&&!mat.bumpMap){textile??=weaveNormal();mat.normalMap=textile;mat.normalScale.setScalar(finish.normal);mat.needsUpdate=true;}
    // Fantasy accents are restricted to recognized fitted garment materials, never skin or unknown anatomy.
    if(fantasy||look.evolution!=='none'){mat.emissive.setHex(look.evolution==='celestial'?0x6653a4:look.evolution==='shadow'?0x164a56:0x184c43);mat.emissiveIntensity=look.evolution==='none'?.20:.30;}
   }
  });
  const moods:Record<AvatarExpression,string>={neutral:'neutral',smile:'happy',focused:'determined',surprised:'surprised',confident:'happy',laugh:'laughing',sad:'sad',angry:'angry'};
  return {root,mixer,actions,clips,bounds,height,currentMotion:'idle',currentAction:null,accessoryWidth:wearables.width,assetLabel:(look.evolution!=='none'?'EVOLUTION '+look.evolution:look.designerCut!=='collection'||look.designerPalette!=='collection'||look.designerAccent!=='collection'||look.designerFootwear!=='collection'?'CUSTOM ATELIER':look.collection==='none'?'HD skeletal mesh':'ELITE '+look.collection.replace(/-/g,' '))+' · '+(cinematic?'CINEMATIC':fantasy?'FANTASY':'HUMAN')+' · '+detail.toUpperCase()+' · '+Math.round(triangles/1000)+'k triangles · '+bones.size+' bones',locomotionSpeed:{walk:1.5*height/1.78,run:3.7*height/1.78},expression:(value,strength=1)=>hero.setExpression(moods[value],value==='confident'?strength*.35:strength),animateFace:dt=>{hero.update(dt);wearables?.tick(dt);},lookAt:target=>hero.lookAt(target,{amount:.35,smoothing:.45}),dispose:()=>{mixer?.stopAllAction();mixer?.uncacheRoot(hero.scene);wearables?.dispose();microSkin?.dispose();textile?.dispose();strands?.dispose();hero.dispose();root.clear();}};
 }catch(error){mixer?.stopAllAction();wearables?.dispose();microSkin?.dispose();textile?.dispose();strands?.dispose();hero.dispose();throw error;}
}

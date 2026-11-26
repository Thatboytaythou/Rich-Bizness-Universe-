import * as THREE from 'three';
import {createCharacter} from 'ara3d';
import {hdRecipe,HD_CLIPS} from './avatar.hd.recipe';
import {normalizeLook} from './avatar.character.config';
import type {AvatarGender,AvatarExpression,SkinnedAvatarRuntime} from './avatar.skinned.runtime';

export async function createHDCharacter(gender:AvatarGender,raw:unknown,build:string,quality:'auto'|'detail'):Promise<SkinnedAvatarRuntime>{
 const recipe=hdRecipe(gender,raw,build);if(!recipe.params)throw Error('HD asset compatibility: '+recipe.unsupported.join(', '));
 const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;
 const detail=quality==='detail'?'high':mobile?'low':'medium';
 const hero=await createCharacter({kind:'ara-character',version:1,params:recipe.params},{detail,animations:[...HD_CLIPS],rootMotion:false,assetsUrl:new URL('/character-assets/ara-1.2.0/',location.origin).href});
 let mixer:THREE.AnimationMixer|undefined;
 try{
  const root=new THREE.Group();root.name='rb-hd-character-v21';root.add(hero.scene);
  const bones=new Set<THREE.Bone>();let triangles=0,meshes=0,faceMorphs=0;
  root.traverse(o=>{const mesh=o as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;meshes++;mesh.skeleton.bones.forEach(b=>bones.add(b));triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;faceMorphs+=Object.keys(mesh.morphTargetDictionary??{}).length;mesh.frustumCulled=false;mesh.castShadow=!mobile;});
  if(!meshes||bones.size<30||triangles<15000||triangles>(detail==='high'?220000:100000)||faceMorphs<5)throw Error('HD mesh failed anatomy/rig budget: '+Math.round(triangles)+' triangles, '+bones.size+' bones');
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),height=hero.height;
  if(!Number.isFinite(height)||height<1||height>2.5||!Number.isFinite(bounds.min.y))throw Error('HD mesh invalid size');
  hero.scene.position.y-=bounds.min.y;root.updateMatrixWorld(true);bounds.setFromObject(root);
  const clips:THREE.AnimationClip[]=[];const names:Record<string,string>={idle:'idle',walk:'walk',run:'run',jump:'jump',power:'cheer',wave:'wave','look around':'look_around',nod:'bow',stretch:'talk_gestures'};
  mixer=new THREE.AnimationMixer(root);const actions=new Map<string,THREE.AnimationAction>();
  for(const [name,id] of Object.entries(names)){const src=hero.clip(id);if(!src||!src.tracks.length||!Number.isFinite(src.duration)||src.duration<=0)throw Error('Missing retargeted clip: '+id);const clip=src.clone();clip.name=name;clips.push(clip);actions.set(name,mixer.clipAction(clip,hero.scene));}
  const look=normalizeLook(raw);root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;for(const mat of Array.isArray(m.material)?m.material:[m.material]){if((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial&&/skin|body/i.test(mat.name)){(mat as THREE.MeshStandardMaterial).roughness=look.skinFinish==='matte'?.76:look.skinFinish==='soft-glow'?.49:.64;}}});
  const moods:Record<AvatarExpression,string>={neutral:'neutral',smile:'happy',focused:'determined',surprised:'surprised',confident:'happy'};
  return {root,mixer,actions,clips,bounds,height,currentMotion:'idle',currentAction:null,assetLabel:'HD skeletal mesh · '+Math.round(triangles/1000)+'k triangles · '+bones.size+' bones',locomotionSpeed:{walk:1.5*height/1.78,run:3.7*height/1.78},expression:(value,strength=1)=>hero.setExpression(moods[value],value==='confident'?strength*.35:strength),animateFace:dt=>hero.update(dt),dispose:()=>{mixer?.stopAllAction();mixer?.uncacheRoot(hero.scene);hero.dispose();root.clear();}};
 }catch(error){mixer?.stopAllAction();hero.dispose();throw error;}
}

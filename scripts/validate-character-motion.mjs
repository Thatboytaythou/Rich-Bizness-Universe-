import assert from 'node:assert/strict';
import * as THREE from 'three';
import {strideSample,bakeGroundedGait,solveLeg} from '../apps/web/src/features/avatar/avatar.contact-motion.ts';
const near=(x,y,tol=.001)=>assert.ok(Math.abs(x-y)<=tol,`${x} != ${y}`);
near(strideSample(0,.7,.62,.08).z,strideSample(1,.7,.62,.08).z);
near(strideSample(.31,.7,.62,.08).y,0);
assert.ok(strideSample(.8,.7,.62,.08).y>.05);
const root=new THREE.Group(),bones=[];
function bone(name,parent,x,y,z){const b=new THREE.Bone();b.name='test:'+name;b.position.set(x,y,z);parent.add(b);bones.push(b);return b;}
const hips=bone('Hips',root,0,.97,0);
const legs=['Left','Right'].map((side,i)=>{const upper=bone(side+'UpLeg',hips,i===0?.12:-.12,0,0),lower=bone(side+'Leg',upper,0,-.45,0),foot=bone(side+'Foot',lower,0,-.45,0),toe=bone(side+'ToeBase',foot,0,-.03,.13);return {upper,lower,foot,toe};});
root.updateMatrixWorld(true);
const first=legs[0],target=new THREE.Vector3(.12,.16,.23),restFoot=first.foot.getWorldQuaternion(new THREE.Quaternion());
solveLeg(first.upper,first.lower,first.foot,target,new THREE.Vector3(0,0,1),restFoot);
assert.ok(first.foot.getWorldPosition(new THREE.Vector3()).distanceTo(target)<.003,'IK ankle endpoint');
for(const b of bones)b.quaternion.identity();root.updateMatrixWorld(true);
const clip=new THREE.AnimationClip('walk',1.08,bones.map(b=>new THREE.QuaternionKeyframeTrack(b.uuid+'.quaternion',[0,1.08],[0,0,0,1,0,0,0,1])));
const {clip:baked,speed}=bakeGroundedGait(root,bones,clip,false);assert.ok(speed>.8&&speed<1.5);
for(const track of baked.tracks)assert.ok([...track.values].every(Number.isFinite),'finite animation data');
near(hips.position.y,.97);near(first.foot.getWorldPosition(new THREE.Vector3()).y,.07);
const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(baked);action.play();
mixer.setTime(.31*1.08);root.updateMatrixWorld(true);near(first.foot.getWorldPosition(new THREE.Vector3()).y,.07,.015);
mixer.setTime(.81*1.08);root.updateMatrixWorld(true);assert.ok(first.foot.getWorldPosition(new THREE.Vector3()).y>.105,'swing lifts foot');
console.log('Character motion: stride cycle, IK endpoint, finite keyframes, restored rest pose, stance and swing verified');

import {capturedMotion} from '../apps/web/src/features/avatar/avatar.captured-motion.ts';
import {normalizeLook,SCULPT_FIELDS,CHARACTER_OPTIONS} from '../apps/web/src/features/avatar/avatar.character.config.ts';
const old=normalizeLook({skin:'deep',hair:'braids',jaw:'square'});
assert.equal(old.skin,'deep');assert.equal(old.hair,'braids');assert.equal(old.jaw,'square');
assert.equal(old.maturity,'young-adult');assert.equal(old.hat,'none');
for(const key of SCULPT_FIELDS)assert.equal(old[key],'0');
assert.equal(SCULPT_FIELDS.length,35);
assert.equal(new Set(SCULPT_FIELDS).size,SCULPT_FIELDS.length);
assert.equal(CHARACTER_OPTIONS.hair.length,13);
for(const kind of ['walk','run']){
 for(const joint of ['Spine','Head','LeftArm','RightForeArm']){
  const a=capturedMotion(kind,joint,0),b=capturedMotion(kind,joint,1);
  assert.deepEqual(a,b);
  for(let i=0;i<33;i++)assert.ok(capturedMotion(kind,joint,i/32).every(v=>Number.isFinite(v)&&Math.abs(v)<=.5));
  assert.ok(capturedMotion(kind,joint,.25).some((v,i)=>Math.abs(v-a[i])>.001),'non-static captured motion');
 }
}
console.log('Character detail: 35 neutral-default morphs, 13 hair choices, bounded captured locomotion channels verified');

import {cameraClearance} from '../apps/web/src/features/avatar/world.camera.ts';
const obstacle={minX:-1,maxX:1,minZ:2,maxZ:3};
assert.equal(cameraClearance(0,0,0,-4,[obstacle]),1);
assert.equal(cameraClearance(0,0,4,0,[obstacle]),1);
assert.ok(cameraClearance(0,0,0,5,[obstacle])<.4);
assert.ok(cameraClearance(0,0,0,5,[obstacle])>.2);
assert.equal(cameraClearance(0,0,0,5,[]),1);
const legacyV18=normalizeLook({outfit:'formal',shoes:'boots',skin:'deep'});
assert.equal(legacyV18.outfit,'formal');assert.equal(legacyV18.shoes,'boots');assert.equal(legacyV18.wristwear,'none');assert.equal(legacyV18.stance,'relaxed');
assert.equal(CHARACTER_OPTIONS.outfit.length,8);assert.equal(CHARACTER_OPTIONS.shoes.length,6);
console.log('V19: camera obstacle clearance and backward-compatible wardrobe options verified');

import {hdRecipe,HD_CLIPS,morphs} from '../apps/web/src/features/avatar/avatar.hd.recipe.ts';
import {ELITE_COLLECTIONS,eliteWardrobe} from '../apps/web/src/features/avatar/avatar.elite.catalog.ts';
assert.equal(Object.keys(ELITE_COLLECTIONS).length,5);
for(const collection of Object.keys(ELITE_COLLECTIONS)){
 const r=hdRecipe('boy',{collection,eliteJewelry:'silver',identityMode:'phantom'},'athletic');
 assert.ok(r.params);assert.deepEqual(r.params.accessories,['watch_silver']);
 assert.ok(eliteWardrobe(collection).top);assert.equal(r.params.outfit,'none');
}
assert.equal(normalizeLook({}).identityMode,'human');assert.equal(normalizeLook({}).eliteJewelry,'collection');
assert.equal(HD_CLIPS.length,21);assert.ok(!hdRecipe('boy',{collection:'heritage-crown',wristwear:'gold-cuff'},'athletic').params);
for(const gender of ['boy','girl'])for(const key of SCULPT_FIELDS){for(const value of ['-60','60']){const r=hdRecipe(gender,{collection:'emerald-legacy',[key]:value},'athletic');assert.ok(r.params,key+' must remain HD compatible');const baseline=hdRecipe(gender,{collection:'emerald-legacy'},'athletic');assert.notEqual(r.params.modifiers[morphs[key]],baseline.params.modifiers[morphs[key]],key+' must alter its mesh target');assert.equal(normalizeLook({[key]:value})[key],value);}}
console.log('V32: every facial and body control changes an HD modifier in both body types; legacy defaults preserved');
console.log('V23: five fitted collection recipes, jewelry overrides, compatibility and legacy defaults verified');

import {normalizeRoutine} from '../apps/web/src/features/avatar/avatar.motion.design.ts';
import {designerWardrobe} from '../apps/web/src/features/avatar/avatar.elite.catalog.ts';
assert.deepEqual(normalizeRoutine(['wave','bad','groove',7,'bow']),['wave','groove','bow']);
assert.equal(normalizeRoutine(Array(20).fill('wave')).length,12);
assert.deepEqual(normalizeRoutine({clip:'wave'}),[]);
const designer=normalizeLook({designerCut:'street',designerPalette:'burgundy',designerAccent:'copper',designerFootwear:'boots',evolution:'celestial'});
const designed=designerWardrobe(designer);
assert.equal(designed.shoes,'combat_boots');
assert.equal(designed.garmentStyles.oversized_tee.color,'#64263b');
assert.equal(designed.garmentStyles.oversized_tee.color2,'#ae6949');
assert.equal(eliteWardrobe('emerald-legacy').garmentStyles.oversized_tee.color,'#153d2c');
const evolved=hdRecipe('boy',designer,'athletic');
assert.ok(evolved.params);
assert.equal(evolved.params.modifiers['eyes/eye-scale'],.28);
assert.equal(normalizeLook({}).designerCut,'collection');
assert.equal(normalizeLook({}).evolution,'none');
console.log('V24: custom fitted recipes, preserved collection source, evolution and personal choreography bounds verified');

import {normalizeTimeline} from '../apps/web/src/features/avatar/avatar.motion.design.ts';
import {aegisGeometry,crownGeometry,originalWearables} from '../apps/web/src/features/avatar/avatar.original.wearables.ts';
assert.deepEqual(normalizeTimeline(undefined,['wave','bow']),[{clip:'wave',speed:1,blend:.2},{clip:'bow',speed:1,blend:.2}]);
assert.deepEqual(normalizeTimeline([{clip:'wave',speed:9,blend:-1},{clip:'bad'},'groove']),[{clip:'wave',speed:1.5,blend:.05},{clip:'groove',speed:1,blend:.2}]);
assert.equal(normalizeTimeline(Array(15).fill('bow')).length,12);
for(const g of [aegisGeometry(),crownGeometry()]){assert.ok(g.getAttribute('position').count>100);assert.ok([...g.getAttribute('normal').array].every(Number.isFinite));g.dispose();}
const artRoot=new THREE.Group(),chestBone=new THREE.Bone();chestBone.name='Spine2';chestBone.position.y=1.2;artRoot.add(chestBone);const art=originalWearables(artRoot,new Set([chestBone]),1.78,{signature:'gold-crown',wings:'celestial-aegis'});assert.ok(art.width>2);assert.equal(chestBone.children.length,2);art.tick(.05);art.dispose();assert.equal(chestBone.children.length,0);
assert.equal(normalizeLook({}).signature,'none');assert.equal(normalizeLook({}).wings,'none');
console.log('V25: original geometry, torso attachment/disposal and bounded timeline verified');

import {regaliaGeometry,regaliaTextile} from '../apps/web/src/features/avatar/avatar.original.wearables.ts';
import {nextRenderScale} from '../apps/web/src/features/avatar/avatar.render.budget.ts';
const armor=regaliaGeometry();assert.equal(armor.getAttribute('uv').count,armor.getAttribute('position').count);assert.ok(armor.index.count>3000);assert.ok([...armor.getAttribute('normal').array].every(Number.isFinite));armor.dispose();
const textile=regaliaTextile('emerald');assert.equal(textile.length,128*128*4);assert.notDeepEqual(textile,regaliaTextile('obsidian'));assert.deepEqual(textile,regaliaTextile('emerald'));
assert.equal(normalizeLook({}).regalia,'none');
assert.equal(nextRenderScale(1,50,31,true),.9);assert.equal(nextRenderScale(.65,60,31,true),.65);assert.equal(nextRenderScale(.8,30,31,true),.86);assert.equal(nextRenderScale(.8,60,3,true),.8);
console.log('V26: Regalia geometry, UVs, deterministic original textile and render budget verified');

import {atlasShoeGeometry,mantleGeometry,animateMantle} from '../apps/web/src/features/avatar/avatar.atlas.art.ts';
for(const mesh of [atlasShoeGeometry(),mantleGeometry()]){assert.ok(mesh.index.count>900);assert.ok([...mesh.getAttribute('normal').array].every(Number.isFinite));assert.equal(mesh.getAttribute('uv').count,mesh.getAttribute('position').count);mesh.dispose();}
const cape=mantleGeometry(),rest=new Float32Array(cape.getAttribute('position').array);animateMantle(cape,rest,1);assert.notDeepEqual([...cape.getAttribute('position').array],[...rest]);assert.ok([...cape.getAttribute('normal').array].every(Number.isFinite));cape.dispose();
assert.equal(normalizeLook({}).mantle,'none');
console.log('V27: original footwear mesh, mantle geometry and bounded cloth animation verified');

import {energeticClip,studioFrameInterval} from '../apps/web/src/features/avatar/avatar.energy.motion.ts';
const axis=new THREE.Vector3(1,0,0);
const swing=(name)=>new THREE.QuaternionKeyframeTrack(name+'.quaternion',[0,.5,1],[...new THREE.Quaternion().toArray(),...new THREE.Quaternion().setFromAxisAngle(axis,.6).toArray(),...new THREE.Quaternion().toArray()]);
const energeticSource=new THREE.AnimationClip('test',1,[swing('LeftArm'),swing('Head'),swing('LeftUpLeg'),swing('LeftFoot'),new THREE.VectorKeyframeTrack('Hips.position',[0,1],[0,1,0,0,1,0])]);
const walkEnergy=energeticClip(energeticSource,'run',[]),jumpEnergy=energeticClip(energeticSource,'jump',[]);
for(const i of [0,1])assert.notDeepEqual([...walkEnergy.tracks[i].values],[...energeticSource.tracks[i].values]);
for(const i of [2,3,4])assert.deepEqual([...walkEnergy.tracks[i].values],[...energeticSource.tracks[i].values]);
assert.notDeepEqual([...jumpEnergy.tracks[2].values],[...energeticSource.tracks[2].values]);
assert.deepEqual([...jumpEnergy.tracks[3].values],[...energeticSource.tracks[3].values]);
for(const track of walkEnergy.tracks.slice(0,4)){for(let i=0;i<track.values.length;i+=4)near(new THREE.Quaternion().fromArray(track.values,i).length(),1);assert.deepEqual([...track.values.slice(0,4)],[...track.values.slice(-4)]);}
assert.equal(studioFrameInterval(true,8,'auto'),32);assert.equal(studioFrameInterval(true,30,'auto'),48);assert.equal(studioFrameInterval(false,30,'detail'),16);
console.log('V33: upper-body motion, expressive legs, protected locomotion and foot tracks, normalized quaternions, bounded phone cadence');

const signatureWing=aegisGeometry();const wingColors=signatureWing.getAttribute('color');assert.equal(wingColors.count,signatureWing.getAttribute('position').count);assert.equal(wingColors.count,1320);assert.ok(wingColors.array.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(signatureWing.index.count/3<2700);assert.ok(new Set(wingColors.array).size>20);signatureWing.dispose();
console.log('V1: original sculpted Aegis ridge, bounded feather topology, original vertex finish and deterministic textile verified');

const sovereign=mantleGeometry(),sovereignRest=new Float32Array(sovereign.getAttribute('position').array),sovereignPosition=sovereign.getAttribute('position');assert.equal(sovereignPosition.count,837);assert.equal(sovereign.getAttribute('color').count,837);assert.ok(sovereign.getAttribute('color').array.every(v=>v>=0&&v<=1&&Number.isFinite(v)));assert.equal(sovereign.index.count/3,1560);const bound=sovereign.boundingSphere.clone();for(const time of [0,.7,2,9,90]){animateMantle(sovereign,sovereignRest,time);for(let i=0;i<sovereignPosition.count;i++){assert.ok(Math.abs(sovereignPosition.getZ(i)-sovereignRest[i*3+2])<=.050);assert.ok(bound.containsPoint(new THREE.Vector3().fromBufferAttribute(sovereignPosition,i)));if(i<31)near(sovereignPosition.getZ(i),sovereignRest[i*3+2]);}assert.ok(sovereign.getAttribute('normal').array.every(Number.isFinite));}sovereign.dispose();console.log('V1 Sovereign mantle: original tailoring, fixed shoulder anchors, bounded cloth motion and matching export colors');

import {REALISM_PROFILES,BODY_REGIONS,FACE_REGIONS,bodyPreset,resetSculpt} from '../apps/web/src/features/avatar/avatar.sculpt.profiles.ts';
const allRegionFields=[...BODY_REGIONS,...FACE_REGIONS].flatMap(g=>g.fields);assert.equal(allRegionFields.length,35);assert.deepEqual([...allRegionFields].sort(),[...SCULPT_FIELDS].sort());
for(const gender of ['boy','girl']){const modes=REALISM_PROFILES.map(p=>hdRecipe(gender,{identityMode:p.key,collection:'emerald-legacy',upperArm:'60'},'heroic'));assert.ok(modes.every(m=>m.params));assert.notDeepEqual(modes[0].params.modifiers,modes[1].params.modifiers);assert.notDeepEqual(modes[0].params.modifiers,modes[2].params.modifiers);for(const m of modes)near(m.params.modifiers[morphs.upperArm],.39);}
const sculptBase=normalizeLook({eyeSize:'60',collection:'onyx-executive',upperArm:'40',identityMode:'phantom'});const powered=bodyPreset(sculptBase,'power');assert.equal(powered.look.eyeSize,'60');assert.equal(powered.look.collection,'onyx-executive');assert.equal(powered.look.identityMode,'phantom');assert.equal(powered.look.upperArm,'80');assert.equal(powered.build,'heroic');assert.equal(resetSculpt(powered.look,['upperArm']).upperArm,'0');assert.equal(resetSculpt(powered.look,['upperArm']).eyeSize,'60');console.log('V1: three distinct realism recipes, 35 regional controls, non-destructive body presets and reset verified');

import {skinMicroSurface,skinFinishRoughness,applyNaturalSkin} from '../apps/web/src/features/avatar/avatar.skin.surface.ts';
const poreA=skinMicroSurface(),poreB=skinMicroSurface();assert.deepEqual(poreA.image.data,poreB.image.data);assert.equal(poreA.image.data.length,128*128*4);assert.ok(poreA.generateMipmaps&&poreA.wrapS===THREE.RepeatWrapping);assert.ok(new Set(poreA.image.data.filter((_,i)=>i%4===0)).size>30);assert.ok(poreA.image.data.every((v,i)=>i%4===0?v>=65&&v<=180:i%4===1?v>=202&&v<=250:v===255));
const skinMaterial=new THREE.MeshStandardMaterial({map:poreA,normalMap:poreB,roughness:.5,metalness:.4});applyNaturalSkin(skinMaterial,'matte',true,false,true,()=>poreA);assert.equal(skinMaterial.roughness,.76);assert.equal(skinMaterial.normalMap,poreB);assert.equal(skinMaterial.bumpMap,null);assert.equal(skinMaterial.roughnessMap,poreA);assert.equal(skinMaterial.metalness,0);assert.ok(skinFinishRoughness('matte',true,false)>skinFinishRoughness('soft-glow',true,false));
const safeSkin=new THREE.MeshStandardMaterial({map:poreA});applyNaturalSkin(safeSkin,'natural',true,false,false,()=>{throw Error('safe phone must not allocate detail map');});assert.equal(safeSkin.bumpMap,null);assert.equal(safeSkin.roughnessMap,null);applyNaturalSkin(safeSkin,'natural',true,false,true,()=>poreA);assert.equal(safeSkin.bumpMap,poreA);assert.equal(safeSkin.roughnessMap,poreA);skinMaterial.dispose();safeSkin.dispose();poreA.dispose();poreB.dispose();console.log('V1 skin realism: deterministic pores, preserved authored normals, material finish ownership and mobile detail budget verified');

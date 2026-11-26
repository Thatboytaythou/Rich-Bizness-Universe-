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
assert.equal(SCULPT_FIELDS.length,26);
assert.equal(CHARACTER_OPTIONS.hair.length,13);
for(const kind of ['walk','run']){
 for(const joint of ['Spine','Head','LeftArm','RightForeArm']){
  const a=capturedMotion(kind,joint,0),b=capturedMotion(kind,joint,1);
  assert.deepEqual(a,b);
  for(let i=0;i<33;i++)assert.ok(capturedMotion(kind,joint,i/32).every(v=>Number.isFinite(v)&&Math.abs(v)<=.5));
  assert.ok(capturedMotion(kind,joint,.25).some((v,i)=>Math.abs(v-a[i])>.001),'non-static captured motion');
 }
}
console.log('Character detail: 26 neutral-default morphs, 13 hair choices, bounded captured locomotion channels verified');

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

import {hdRecipe,HD_CLIPS} from '../apps/web/src/features/avatar/avatar.hd.recipe.ts';
import {ELITE_COLLECTIONS,eliteWardrobe} from '../apps/web/src/features/avatar/avatar.elite.catalog.ts';
assert.equal(Object.keys(ELITE_COLLECTIONS).length,5);
for(const collection of Object.keys(ELITE_COLLECTIONS)){
 const r=hdRecipe('boy',{collection,eliteJewelry:'silver',identityMode:'phantom'},'athletic');
 assert.ok(r.params);assert.deepEqual(r.params.accessories,['watch_silver']);
 assert.ok(eliteWardrobe(collection).top);assert.equal(r.params.outfit,'none');
}
assert.equal(normalizeLook({}).identityMode,'human');assert.equal(normalizeLook({}).eliteJewelry,'collection');
assert.equal(HD_CLIPS.length,21);assert.ok(!hdRecipe('boy',{collection:'heritage-crown',wristwear:'gold-cuff'},'athletic').params);
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

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

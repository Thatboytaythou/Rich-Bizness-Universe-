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
assert.equal(SCULPT_FIELDS.length,38);
assert.equal(new Set(SCULPT_FIELDS).size,SCULPT_FIELDS.length);
assert.equal(CHARACTER_OPTIONS.hair.length,15);
for(const kind of ['walk','run']){
 for(const joint of ['Spine','Head','LeftArm','RightForeArm']){
  const a=capturedMotion(kind,joint,0),b=capturedMotion(kind,joint,1);
  assert.deepEqual(a,b);
  for(let i=0;i<33;i++)assert.ok(capturedMotion(kind,joint,i/32).every(v=>Number.isFinite(v)&&Math.abs(v)<=.5));
  assert.ok(capturedMotion(kind,joint,.25).some((v,i)=>Math.abs(v-a[i])>.001),'non-static captured motion');
 }
}
console.log('Character detail: 38 neutral-default morphs, 15 hair choices, bounded captured locomotion channels verified');

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
assert.equal(HD_CLIPS.length,21);assert.ok(hdRecipe('boy',{collection:'heritage-crown',wristwear:'gold-cuff'},'athletic').params);assert.ok(!hdRecipe('boy',{stance:'alert'},'athletic').params);
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
const allRegionFields=[...BODY_REGIONS,...FACE_REGIONS].flatMap(g=>g.fields);assert.equal(allRegionFields.length,38);assert.deepEqual([...allRegionFields].sort(),[...SCULPT_FIELDS].sort());
for(const gender of ['boy','girl']){const modes=REALISM_PROFILES.map(p=>hdRecipe(gender,{identityMode:p.key,collection:'emerald-legacy',upperArm:'60'},'heroic'));assert.ok(modes.every(m=>m.params));assert.notDeepEqual(modes[0].params.modifiers,modes[1].params.modifiers);assert.notDeepEqual(modes[0].params.modifiers,modes[2].params.modifiers);for(const m of modes)near(m.params.modifiers[morphs.upperArm],.39);}
const sculptBase=normalizeLook({eyeSize:'60',collection:'onyx-executive',upperArm:'40',identityMode:'phantom'});const powered=bodyPreset(sculptBase,'power');assert.equal(powered.look.eyeSize,'60');assert.equal(powered.look.collection,'onyx-executive');assert.equal(powered.look.identityMode,'phantom');assert.equal(powered.look.upperArm,'80');assert.equal(powered.build,'heroic');assert.equal(resetSculpt(powered.look,['upperArm']).upperArm,'0');assert.equal(resetSculpt(powered.look,['upperArm']).eyeSize,'60');console.log('V1: three distinct realism recipes, 38 regional controls, non-destructive body presets and reset verified');

import {skinMicroSurface,skinFinishRoughness,applyNaturalSkin} from '../apps/web/src/features/avatar/avatar.skin.surface.ts';
const poreA=skinMicroSurface(),poreB=skinMicroSurface();assert.deepEqual(poreA.image.data,poreB.image.data);assert.equal(poreA.image.data.length,128*128*4);assert.ok(poreA.generateMipmaps&&poreA.wrapS===THREE.RepeatWrapping);assert.ok(new Set(poreA.image.data.filter((_,i)=>i%4===0)).size>30);assert.ok(poreA.image.data.every((v,i)=>i%4===0?v>=65&&v<=180:i%4===1?v>=202&&v<=250:v===255));
const skinMaterial=new THREE.MeshStandardMaterial({map:poreA,normalMap:poreB,roughness:.5,metalness:.4});applyNaturalSkin(skinMaterial,'matte',true,false,true,()=>poreA);assert.equal(skinMaterial.roughness,.76);assert.equal(skinMaterial.normalMap,poreB);assert.equal(skinMaterial.bumpMap,null);assert.equal(skinMaterial.roughnessMap,poreA);assert.equal(skinMaterial.metalness,0);assert.ok(skinFinishRoughness('matte',true,false)>skinFinishRoughness('soft-glow',true,false));
const safeSkin=new THREE.MeshStandardMaterial({map:poreA});applyNaturalSkin(safeSkin,'natural',true,false,false,()=>{throw Error('safe phone must not allocate detail map');});assert.equal(safeSkin.bumpMap,null);assert.equal(safeSkin.roughnessMap,null);applyNaturalSkin(safeSkin,'natural',true,false,true,()=>poreA);assert.equal(safeSkin.bumpMap,poreA);assert.equal(safeSkin.roughnessMap,poreA);skinMaterial.dispose();safeSkin.dispose();poreA.dispose();poreB.dispose();console.log('V1 skin realism: deterministic pores, preserved authored normals, material finish ownership and mobile detail budget verified');

const humanMotion=energeticClip(energeticSource,'run',[],'human'),cinemaMotion=energeticClip(energeticSource,'run',[],'cinematic'),fantasyMotion=energeticClip(energeticSource,'run',[],'phantom');
function motionDelta(clip){let sum=0;for(const i of [0,1]){const keys=clip.tracks[i].values,original=energeticSource.tracks[i].values;for(let j=0;j<keys.length;j+=4)sum+=new THREE.Quaternion().fromArray(keys,j).normalize().angleTo(new THREE.Quaternion().fromArray(original,j).normalize());}return sum;}
assert.ok(motionDelta(humanMotion)>0&&motionDelta(humanMotion)<motionDelta(cinemaMotion)&&motionDelta(cinemaMotion)<motionDelta(fantasyMotion));for(const clip of [humanMotion,cinemaMotion,fantasyMotion])for(const i of [2,3,4])assert.deepEqual([...clip.tracks[i].values],[...energeticSource.tracks[i].values]);console.log('V1 realistic movement: natural human and cinematic upper-body emphasis separated from fantasy while preserving captured root and foot contacts');

import {createExpressionControl} from '../apps/web/src/features/avatar/avatar.expression.control.ts';
import {naturalHairMaterial} from '../apps/web/src/features/avatar/avatar.skin.surface.ts';
const expressionOwner=createExpressionControl('neutral');assert.ok(expressionOwner.automatic('neutral',.25));expressionOwner.select('smile',.42);assert.equal(expressionOwner.automatic('focused'),false);let expressionCapture;expressionOwner.apply((value,strength)=>{expressionCapture={value,strength};});assert.deepEqual(expressionCapture,{value:'smile',strength:.42});expressionOwner.release();assert.ok(expressionOwner.automatic('focused',.6));assert.deepEqual(expressionOwner.selected(),{value:'focused',strength:.6,manual:false});expressionOwner.select('smile',NaN);assert.equal(expressionOwner.selected().strength,1);
const authoredHair=new THREE.MeshStandardMaterial({color:0x402820,transparent:true,alphaTest:.35,metalness:.5});const oldHairColor=authoredHair.color.getHex();naturalHairMaterial(authoredHair,'hair');assert.equal(authoredHair.color.getHex(),oldHairColor);assert.equal(authoredHair.alphaTest,.35);assert.equal(authoredHair.transparent,true);assert.equal(authoredHair.metalness,0);assert.equal(authoredHair.roughness,.64);naturalHairMaterial(authoredHair,'facial');assert.equal(authoredHair.roughness,.78);authoredHair.dispose();console.log('V1 facial realism: manual expression ownership across refits, automatic mood isolation and authored hair surface preserved');

import {fitTorsoPoints,clothFollow} from '../apps/web/src/features/avatar/avatar.wearable.fit.ts';
const torsoCloud=(width,depth)=>Array.from({length:240},(_,i)=>{const theta=i/240*Math.PI*2;return new THREE.Vector3(Math.cos(theta)*width/2,1.30,Math.sin(theta)*depth);});
const narrowFit=fitTorsoPoints(torsoCloud(.30,.12),1.78),wideFit=fitTorsoPoints(torsoCloud(.44,.17),1.78);assert.ok(wideFit.width>narrowFit.width&&wideFit.front>narrowFit.front&&wideFit.back<narrowFit.back);assert.ok(wideFit.width<=1.28&&wideFit.samples===240);assert.deepEqual(fitTorsoPoints([],1.78),{width:1,front:0,back:0,samples:0});assert.ok(clothFollow(0,.3,.033)>0);let followLag=.03;for(let i=0;i<100;i++)followLag=clothFollow(followLag,0,.033);assert.ok(followLag<.0001);const movingCloth=mantleGeometry(),movingRest=new Float32Array(movingCloth.getAttribute('position').array),movingPosition=movingCloth.getAttribute('position');animateMantle(movingCloth,movingRest,1,.03);for(let i=0;i<movingPosition.count;i++){assert.ok(Math.abs(movingPosition.getZ(i)-movingRest[i*3+2])<=.050);assert.ok(movingCloth.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(movingPosition,i)));if(i<31)near(movingPosition.getZ(i),movingRest[i*3+2]);}movingCloth.dispose();console.log('V1 wearable realism: measured torso width and depth, bounded fit fallback, motion-responsive cloth lag and fixed shoulder anchors');

import {surfaceRole,fabricFinish,hairStrandNormal} from '../apps/web/src/features/avatar/avatar.material.roles.ts';
import {naturalMotionFade} from '../apps/web/src/features/avatar/avatar.energy.motion.ts';
for(const name of ['young_african_male','old_caucasian_male_detailed','middleage_cauasian_male','young_asian_female'])assert.equal(surfaceRole(name),'skin');for(const name of ['short02','afro01','mhair01black','bob01','ponytail01','braid01'])assert.equal(surfaceRole(name),'hair');assert.equal(surfaceRole('bodyMaterial','eyelashes01'),'face-detail');for(const name of ['Eye_brown','Eye_brownlight','Eyeblue','eyegreen'])assert.equal(surfaceRole(name),'eye');assert.equal(surfaceRole('male_elegantsuit01'),'tailoring');assert.equal(surfaceRole('baggy_jeans'),'denim');assert.equal(surfaceRole('oversized_tee'),'knit');assert.equal(surfaceRole('techwear_jacket'),'techwear');assert.equal(surfaceRole('FedoraMaterial'),'unknown');assert.ok(fabricFinish('denim').roughness>fabricFinish('techwear').roughness);const strand=hairStrandNormal();assert.equal(strand.image.data.length,64*64*4);assert.ok(strand.image.data.every((v,i)=>i%4!==3||v===255));assert.ok(new Set(strand.image.data.filter((_,i)=>i%4===0)).size>10);strand.dispose();
assert.equal(normalizeLook({upperArm:'35'}).upperArm,'35');assert.equal(normalizeLook({upperArm:'34'}).upperArm,'0');const precise=hdRecipe('boy',{upperArm:'35',hair:'bob-classic'},'athletic');assert.equal(precise.params.hair,'bob01');near(precise.params.modifiers[morphs.upperArm],.2275);const heavy=bodyPreset({},'heavyweight'),runner=bodyPreset({},'runner');assert.equal(heavy.look.weight,'heavy');assert.equal(runner.look.weight,'slim');assert.equal(hdRecipe('boy',heavy.look,heavy.build).params.weight,.72);assert.equal(hdRecipe('boy',runner.look,runner.build).params.weight,.28);assert.equal(naturalMotionFade('walk','run',.18),.28);assert.equal(naturalMotionFade('run','idle',0),0);assert.equal(naturalMotionFade('idle','walk',.18),.22);assert.equal(naturalMotionFade('walk','run',NaN),0);console.log('V1 coordinated realism: catalog-bound skin/hair/fabric, finer anatomical morphs, true body-preset weights, original strand relief and gait transition timing');

import {meridianCuffGeometry,wristBone,cuffFit,CUFF_STYLES} from '../apps/web/src/features/avatar/avatar.cuff.art.ts';
for(const style of CUFF_STYLES){const g=meridianCuffGeometry(style);assert.equal(g.attributes.position.count,528);assert.equal(g.index.count/3,1056);assert.ok(g.attributes.normal.array.every(Number.isFinite));assert.ok(g.attributes.color.array.every(v=>Number.isFinite(v)&&v>=0&&v<=1));const edges=new Map();for(let i=0;i<g.index.count;i+=3){const a=g.index.getX(i),b=g.index.getX(i+1),c=g.index.getX(i+2);for(const [u,v] of [[a,b],[b,c],[c,a]]){const key=[Math.min(u,v),Math.max(u,v)].join(':');edges.set(key,(edges.get(key)??0)+1);}}assert.ok([...edges.values()].every(n=>n===2),'closed cuff topology');g.dispose();}
const wristRoot=new THREE.Group(),wChest=new THREE.Bone(),wElbow=new THREE.Bone(),wHand=new THREE.Bone(),finger=new THREE.Bone();wChest.name='Spine2';wElbow.name='lowerarm_l';wHand.name='hand_l';finger.name='index_l';wChest.position.y=1.2;wElbow.position.set(.28,0,0);wHand.position.set(.24,0,0);finger.position.x=.08;wristRoot.add(wChest);wChest.add(wElbow);wElbow.add(wHand);wHand.add(finger);const wBones=new Set([wChest,wElbow,wHand,finger]);assert.equal(wristBone(wBones,'left'),wHand);assert.ok(cuffFit(1.78,'80').radial>cuffFit(1.78,'-80').radial);const cuffs=originalWearables(wristRoot,wBones,1.78,{signature:'none',wings:'none',wristwear:'gold-cuff',forearm:'60'});assert.equal(wHand.children.length,2);const cuffAnchor=wHand.children.find(x=>x!==finger);const oldPos=cuffAnchor.getWorldPosition(new THREE.Vector3());wElbow.rotation.z=.7;wristRoot.updateMatrixWorld(true);assert.ok(cuffAnchor.getWorldPosition(new THREE.Vector3()).distanceTo(oldPos)>.05);cuffs.tick(.033);cuffs.dispose();assert.equal(wHand.children.length,1);console.log('V1 original Meridian wristwear: 1056 closed triangles, three finishes, anatomy scale, skeletal movement and cleanup verified');

import {sculptSurfaceGeometry} from '../apps/web/src/features/avatar/avatar.sculpt.surface.ts';
for(const role of ['hair','denim','tailoring']){const shape=new THREE.SphereGeometry(.2,24,16);const before=shape.attributes.position.array.slice(),normals=shape.attributes.normal.array.slice(),idx=shape.index.array.slice(),uv=shape.attributes.uv.array.slice();assert.equal(sculptSurfaceGeometry(shape,role,false),0);assert.ok(sculptSurfaceGeometry(shape,role,true)>100);assert.notDeepEqual(shape.attributes.position.array,before);assert.deepEqual(shape.attributes.normal.array,normals);assert.deepEqual(shape.index.array,idx);assert.deepEqual(shape.attributes.uv.array,uv);for(let i=0;i<before.length;i+=3)assert.ok(Math.hypot(...[0,1,2].map(k=>shape.attributes.position.array[i+k]-before[i+k]))<=.005);shape.dispose();}const noMorph=new THREE.SphereGeometry(.2,16,16);noMorph.morphAttributes.position=[noMorph.attributes.position.clone()];assert.equal(sculptSurfaceGeometry(noMorph,'hair',true),0);assert.equal(sculptSurfaceGeometry(noMorph,'skin',true),0);noMorph.dispose();for(const key of ['abdominalTone','hipDepth','neckDepth']){assert.equal(normalizeLook({})[key],'0');assert.equal(hdRecipe('boy',{[key]:'40'},'athletic').params.modifiers[morphs[key]],.26);}console.log('V1 mesh sculpt: three verified body morphs, bounded original hair and fabric rest-shape relief, unchanged topology, UVs and authored normals');

import {originalForm,secondarySurface,secondaryResponse,secondaryEligible} from '../apps/web/src/features/avatar/avatar.original.forms.ts';
const waveMesh=new THREE.SphereGeometry(.16,32,24),sovereignMesh=waveMesh.clone(),waveRest=waveMesh.attributes.position.array.slice();assert.ok(originalForm(waveMesh,'wave-crop')>100);assert.ok(originalForm(sovereignMesh,'sovereign')>100);assert.notDeepEqual(waveMesh.attributes.position.array,sovereignMesh.attributes.position.array);for(let i=0;i<waveRest.length;i+=3)assert.ok(Math.hypot(...[0,1,2].map(k=>waveMesh.attributes.position.array[i+k]-waveRest[i+k]))<=.011);const restWave=waveMesh.attributes.position.array.slice(),driver=secondarySurface(waveMesh,'hair');assert.ok(driver);driver.apply(1);assert.notDeepEqual(waveMesh.attributes.position.array,restWave);driver.apply(0);assert.deepEqual(waveMesh.attributes.position.array,restWave);let response=secondaryResponse(0,.15,.033);assert.ok(response>0&&response<=1);for(let i=0;i<80;i++)response=secondaryResponse(response,0,.033);assert.ok(Math.abs(response)<.0001);assert.equal(secondaryEligible('hair','wave-crop'),false);assert.equal(secondaryEligible('hair','long'),true);assert.equal(secondaryEligible('skin','long'),false);waveMesh.dispose();sovereignMesh.dispose();const originalLook=normalizeLook({hair:'wave-crop',designerCut:'sovereign'}),originalRecipe=hdRecipe('boy',originalLook,'athletic');assert.equal(originalRecipe.params.hair,'short01');assert.equal(originalRecipe.params.garmentStyles.techwear_jacket.color,'#183d32');assert.equal(originalRecipe.params.garmentStyles.techwear_jacket.color2,'#c6a05b');console.log('V1 original fitted forms: Wave Crop and Sovereign cut, bounded secondary hair/fabric motion and rest recovery');

import {captureMotionWeights,beginMotionBlend,tickMotionBlend,clearMotionBlend} from '../apps/web/src/features/avatar/avatar.motion.blend.ts';
const motionRig=new THREE.Group(),motionMixer=new THREE.AnimationMixer(motionRig),motionOwner={actions:new Map()};for(const [name,x] of [['idle',0],['walk',1],['run',2],['wave',3]]){const clip=new THREE.AnimationClip(name,1,[new THREE.VectorKeyframeTrack('.position',[0,1],[x,0,0,x,0,0])]);motionOwner.actions.set(name,motionMixer.clipAction(clip));}const [idleBlend,walkBlend,runBlend,waveBlend]=motionOwner.actions.values();idleBlend.play();motionMixer.update(0);const switchBlend=(next,seconds)=>{const entries=captureMotionWeights(motionOwner);next.reset().play();beginMotionBlend(motionOwner,next,entries,seconds);motionMixer.update(0);};switchBlend(walkBlend,.28);for(let i=0;i<2;i++){tickMotionBlend(motionOwner,.05);motionMixer.update(.05);}const blendedX=motionRig.position.x;switchBlend(runBlend,.28);near(motionRig.position.x,blendedX,1e-6);tickMotionBlend(motionOwner,.05);motionMixer.update(.05);const secondX=motionRig.position.x;switchBlend(waveBlend,.22);near(motionRig.position.x,secondX,1e-6);for(let i=0;i<6;i++){tickMotionBlend(motionOwner,.05);motionMixer.update(.05);near([...motionOwner.actions.values()].reduce((sum,a)=>sum+(a.isScheduled()?a.getEffectiveWeight():0),0),1,1e-6);}assert.equal([...motionOwner.actions.values()].filter(a=>a.isScheduled()).length,1);near(motionRig.position.x,3);clearMotionBlend(motionOwner);motionMixer.stopAllAction();console.log('V1 interrupted motion blend: real mixer preserves pose, normalized weights and retires previous clips');

import {formSelection,cloneFormGeometry} from '../apps/web/src/features/avatar/avatar.original.forms.ts';
const mergedForm=new THREE.SphereGeometry(.16,32,24);mergedForm.clearGroups();mergedForm.addGroup(0,mergedForm.index.count/2,0);mergedForm.addGroup(mergedForm.index.count/2,mergedForm.index.count/2,1);mergedForm.morphTargetsRelative=true;mergedForm.morphAttributes.position=[new THREE.Float32BufferAttribute(new Float32Array(mergedForm.attributes.position.count*3),3)];const selectedForm=formSelection(mergedForm,[0],2),protectedForm=new Set(formSelection(mergedForm,[1],2)),beforeMerged=mergedForm.attributes.position.array.slice(),clonedForm=cloneFormGeometry(mergedForm);assert.ok(selectedForm.length>24);assert.ok(selectedForm.every(i=>!protectedForm.has(i)));assert.equal(clonedForm.morphAttributes.position[0],mergedForm.morphAttributes.position[0]);assert.ok(originalForm(clonedForm,'wave-crop',selectedForm)>0);for(const i of protectedForm)for(let k=0;k<3;k++)assert.equal(clonedForm.attributes.position.array[i*3+k],beforeMerged[i*3+k]);assert.deepEqual(mergedForm.attributes.position.array,beforeMerged);clonedForm.dispose();mergedForm.dispose();console.log('V1 material-group sculpt: selected vertices only, relative morph buffers shared, untouched protected geometry');

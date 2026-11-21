// Original Rich Bizness male/female 2027 procedural GLB authoring prototype.
// Run from the repository root. Requires Three.js and web-streams-polyfill.
// Output models are staging assets only: see docs/avatar/RB_2027_CHARACTER_PROTOTYPES.md.
import { ReadableStream, WritableStream, TransformStream } from 'web-streams-polyfill';
globalThis.ReadableStream ??= ReadableStream;
globalThis.WritableStream ??= WritableStream;
globalThis.TransformStream ??= TransformStream;
class NodeFileReader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>{this.error=e;this.onerror?.(e);});}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();}).catch(e=>{this.error=e;this.onerror?.(e);});}
}
globalThis.FileReader ??= NodeFileReader;
import * as THREE from '../../node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const OUT='apps/web/public/avatars/2027';
const mat=(color,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const sphereGeo=new THREE.SphereGeometry(1,32,24);
const skinM=mat('#8c563d',0,.7), skinF=mat('#bd8668',0,.68);
const cloth=mat('#071c16',.18,.36), cloth2=mat('#111418',.12,.42), gold=mat('#d7b05a',.78,.24), sole=mat('#111111',.12,.75);
const darkHair=mat('#12100f',.03,.5), hairBrown=mat('#291915',.02,.58), eyeMat=mat('#1a120e',.02,.3), white=mat('#e7e0d7',.03,.4);
const makeGroup=(name,parent,pos=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;};
function ellipsoid(parent,name,position,scale,material){const mesh=new THREE.Mesh(sphereGeo,material);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function bone(name,parent,pos){const b=new THREE.Bone();b.name=name;b.position.set(...pos);parent.add(b);return b;}
function addBoneDecorations(root){const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});return bones;}
function buildCharacter(gender){
 const isGirl=gender==='girl', root=new THREE.Group();
 root.name=isGirl?'RB 2027 — Emerald Muse':'RB 2027 — Emerald Boss';
 const rig=makeGroup('CharacterRoot',root);
 const pelvis=bone('Hips',rig,[0,.93,0]);
 const spine=bone('Spine',pelvis,[0,.12,0]);
 const chest=bone('Chest',spine,[0,.22,0]);
 const neck=bone('Neck',chest,[0,.20,0]);
 const head=bone('Head',neck,[0,.13,0]);
 const lThigh=bone('LeftUpLeg',pelvis,[-.13,-.08,0]), lCalf=bone('LeftLeg',lThigh,[0,-.43,0]), lFoot=bone('LeftFoot',lCalf,[0,-.42,.05]);bone('LeftToe',lFoot,[0,-.055,.13]);
 const rThigh=bone('RightUpLeg',pelvis,[.13,-.08,0]), rCalf=bone('RightLeg',rThigh,[0,-.43,0]), rFoot=bone('RightFoot',rCalf,[0,-.42,.05]);bone('RightToe',rFoot,[0,-.055,.13]);
 const lArm=bone('LeftArm',chest,[-.24,.12,0]), lFore=bone('LeftForeArm',lArm,[-.26,-.07,0]), lHand=bone('LeftHand',lFore,[-.23,-.03,0]);
 const rArm=bone('RightArm',chest,[.24,.12,0]), rFore=bone('RightForeArm',rArm,[.26,-.07,0]), rHand=bone('RightHand',rFore,[.23,-.03,0]);
 const boneList=addBoneDecorations(rig);
 const parts=[];
 const part=(name,owner,pos,scale,material)=>{const m=ellipsoid(rig,name,pos,scale,material);parts.push({mesh:m,bone:owner});return m;};
 part('BaseTorso',chest,[0,1.30,0],[isGirl?.25:.28,.39,.145],cloth);
 part('NeckGeometry',neck,[0,1.68,0],[.078,.105,.078],isGirl?skinF:skinM);
 part('HeadGeometry',head,[0,1.89,0],[isGirl?.145:.155,.205,.138],isGirl?skinF:skinM);
 part('PelvisBase',pelvis,[0,.98,0],[.215,.18,.135],cloth2);
 part('LeftCheek',head,[-.083,1.84,.112],[.063,.055,.035],isGirl?skinF:skinM);
 part('RightCheek',head,[.083,1.84,.112],[.063,.055,.035],isGirl?skinF:skinM);
 part('NoseBridge',head,[0,1.885,.134],[.027,.055,.028],isGirl?skinF:skinM);
 part('NoseTip',head,[0,1.855,.15],[.035,.024,.03],isGirl?skinF:skinM);
 part('LeftEye',head,[-.052,1.925,.126],[.026,.018,.012],white);
 part('RightEye',head,[.052,1.925,.126],[.026,.018,.012],white);
 part('LeftIris',head,[-.052,1.923,.139],[.011,.012,.008],eyeMat);
 part('RightIris',head,[.052,1.923,.139],[.011,.012,.008],eyeMat);
 part('LeftBrow',head,[-.052,1.963,.129],[.042,.009,.009],darkHair);
 part('RightBrow',head,[.052,1.963,.129],[.042,.009,.009],darkHair);
 part('Mouth',head,[0,1.795,.138],[.041,.009,.009],mat(isGirl?'#6c292d':'#4d2522'));
 part('JacketBody',chest,[0,1.31,.015],[isGirl?.265:.29,.32,.16],cloth);
 part('JacketLeftPanel',chest,[-.145,1.33,.13],[.10,.26,.03],cloth2);
 part('JacketRightPanel',chest,[.145,1.33,.13],[.10,.26,.03],cloth2);
 part('JacketCollar',chest,[0,1.59,.04],[.17,.045,.17],cloth2);
 part('RBGoldChestPlate',chest,[0,1.37,.165],[.07,.048,.012],gold);
 part('GoldBelt',pelvis,[0,1.07,.02],[.21,.025,.145],gold);
 part('Pendant',chest,[0,1.10,.18],[.035,.045,.018],gold);
 part('TrouserLeft',lThigh,[-.13,.71,0],[.105,.30,.13],cloth2);
 part('TrouserRight',rThigh,[.13,.71,0],[.105,.30,.13],cloth2);
 part('LeftUpperSleeve',lArm,[-.13,0,0],[.115,.25,.13],cloth);
 part('RightUpperSleeve',rArm,[.13,0,0],[.115,.25,.13],cloth);
 if(isGirl){
  part('HairCap',head,[0,2.045,-.015],[.16,.105,.145],hairBrown);
  part('HairLeftFlow',head,[-.145,1.90,-.04],[.075,.34,.11],hairBrown);
  part('HairRightFlow',head,[.145,1.89,-.04],[.075,.34,.11],hairBrown);
  part('FrontFringe',head,[0,2.00,.095],[.14,.07,.055],hairBrown);
  part('GoldHairCuff',head,[.155,1.69,-.01],[.035,.045,.035],gold);
 } else {
  part('HairCap',head,[0,2.045,-.02],[.16,.11,.15],darkHair);
  part('HairFadeLeft',head,[-.145,1.98,-.005],[.035,.105,.12],darkHair);
  part('HairFadeRight',head,[.145,1.98,-.005],[.035,.105,.12],darkHair);
  part('HairTopStyle',head,[0,2.11,-.025],[.145,.06,.14],darkHair);
 }
 part('ShadeLensLeft',head,[-.054,1.93,.16],[.046,.027,.016],darkHair);
 part('ShadeLensRight',head,[.054,1.93,.16],[.046,.027,.016],darkHair);
 part('ShadeBridge',head,[0,1.93,.163],[.016,.008,.012],gold);
 part('LeftSneaker',lFoot,[0,.01,.08],[.10,.075,.17],sole);
 part('RightSneaker',rFoot,[0,.01,.08],[.10,.075,.17],sole);
 part('LeftSole',lFoot,[0,-.04,.09],[.102,.018,.173],gold);
 part('RightSole',rFoot,[0,-.04,.09],[.102,.018,.173],gold);
 part('LeftWristCuff',lHand,[-.015,0,0],[.055,.025,.055],gold);
 part('RightWristCuff',rHand,[.015,0,0],[.055,.025,.055],gold);
 part('LeftHandShape',lHand,[-.04,-.005,0],[.05,.075,.045],isGirl?skinF:skinM);
 part('RightHandShape',rHand,[.04,-.005,0],[.05,.075,.045],isGirl?skinF:skinM);
 part('LeftShoulderBadge',chest,[-.24,.12,.10],[.045,.05,.02],gold);
 part('RightShoulderBadge',chest,[.24,.12,.10],[.045,.05,.02],gold);
 const skinMeshes=[];
 for(const {mesh,bone:owner} of parts){
   mesh.updateMatrixWorld(true);mesh.geometry.computeVertexNormals();
   const pos=mesh.geometry.attributes.position, indices=[],weights=[];
   for(let i=0;i<pos.count;i++){indices.push(Math.max(0,boneList.indexOf(owner)),0,0,0);weights.push(1,0,0,0);}
   mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
   mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
   const skinned=new THREE.SkinnedMesh(mesh.geometry,mesh.material);
   skinned.name=mesh.name;
   skinned.position.copy(mesh.position);skinned.rotation.copy(mesh.rotation);skinned.scale.copy(mesh.scale);
   root.add(skinned);mesh.parent.remove(mesh);
   skinMeshes.push(skinned);
 }
 const skeleton=new THREE.Skeleton(boneList);
 for(const mesh of skinMeshes){
   const owner=parts.find(p=>p.mesh.name===mesh.name)?.bone;
   const boneIndex=Math.max(0,boneList.indexOf(owner));
   const idx=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight;
   for(let i=0;i<idx.count;i++){idx.setXYZW(i,boneIndex,0,0,0);weights.setXYZW(i,1,0,0,0);}
   idx.needsUpdate=true;weights.needsUpdate=true;mesh.bind(skeleton,new THREE.Matrix4());
 }
 const morphMesh=skinMeshes.find(m=>m.name==='BaseTorso');
 const addScaleMorph=(mesh,name,scale)=>{if(!mesh)return;const base=mesh.geometry.attributes.position,target=new Float32Array(base.array.length);for(let i=0;i<base.count;i++){target[3*i]=base.getX(i)*scale[0];target[3*i+1]=base.getY(i)*scale[1];target[3*i+2]=base.getZ(i)*scale[2];}mesh.geometry.morphAttributes.position??=[];mesh.geometry.morphAttributes.position.push(new THREE.Float32BufferAttribute(target,3));mesh.morphTargetDictionary??={};mesh.morphTargetDictionary[name]=mesh.geometry.morphAttributes.position.length-1;mesh.morphTargetInfluences??=[];mesh.morphTargetInfluences.push(0);};
 addScaleMorph(morphMesh,'body_lean',[.91,1,.98]);
 addScaleMorph(morphMesh,'body_athletic',[1.06,1.02,1.03]);
 addScaleMorph(morphMesh,'body_heroic',[1.12,1.025,1.07]);
 const idle=new THREE.AnimationClip('idle',1,[new THREE.QuaternionKeyframeTrack('Hips.quaternion',[0,.5,1],[0,0,0,1, .005,0,0,1, 0,0,0,1])]);
 const walk=new THREE.AnimationClip('walk',1,[new THREE.QuaternionKeyframeTrack('LeftUpLeg.quaternion',[0,.5,1],[.208,0,0,.978,-.208,0,0,.978,.208,0,0,.978])]);
 const run=new THREE.AnimationClip('run',1,[new THREE.QuaternionKeyframeTrack('LeftUpLeg.quaternion',[0,.35,.7,1],[.333,0,0,.943,-.333,0,0,.943,.333,0,0,.943,.333,0,0,.943])]);
 const jump=new THREE.AnimationClip('jump',1,[new THREE.QuaternionKeyframeTrack('Hips.quaternion',[0,.2,.7,1],[0,0,0,1,-.159,0,0,.987,.05,0,0,.999,0,0,0,1])]);
 const power=new THREE.AnimationClip('power_pose',1,[new THREE.QuaternionKeyframeTrack('LeftArm.quaternion',[0,.3,1],[0,0,0,1,-.31,0,-.39,.87,-.31,0,-.39,.87])]);
 root.add(rig);
 const uniformScale=isGirl ? .86 : .91;
 root.scale.setScalar(uniformScale);
 root.position.y=-.2457*uniformScale;
 root.userData={assetRole:'staged-authoring-prototype',production_art_ready:false,gender,assetNote:'Procedural original character prototype; stylized blockout geometry, single-bone per-mesh weights, placeholder motion, no production skin texture atlas or LOD. Not approved for production.'};
 return {root,clips:[idle,walk,run,jump,power]};
}
async function exportGLB(gender){
 const {root,clips}=buildCharacter(gender);
 const exporter=new GLTFExporter();
 const data=await new Promise((resolve,reject)=>exporter.parse(root,resolve,reject,{binary:true,animations:clips,trs:true}));
 const path=`${OUT}/rb-${gender}-2027-prototype-v1.glb`;
 await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(data));
 console.log(path,Buffer.byteLength(data));
}
await exportGLB('boy');await exportGLB('girl');

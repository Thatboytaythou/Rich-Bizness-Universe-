import * as THREE from 'three';

export type HumanRig = {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  aura: THREE.Group;
  chain: THREE.Group;
};

type Palette = { primary:number; secondary:number; skin:number };

const phys=(color:number,metalness=.08,roughness=.36,clearcoat=.18)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat,clearcoatRoughness:.24});
const std=(color:number,metalness=.04,roughness=.48)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const basic=(color:number,opacity=.22)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});

const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,pos:[number,number,number],scale:[number,number,number]=[1,1,1],rot:[number,number,number]=[0,0,0])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
const limb=(parent:THREE.Object3D,pos:[number,number,number],length:number,radius:number,material:THREE.Material,scale:[number,number,number]=[1,1,1])=>{const p=new THREE.Group();p.position.set(...pos);parent.add(p);add(p,new THREE.CapsuleGeometry(radius,Math.max(.08,length-radius*2),10,28),material,[0,-length/2,0],scale);return p;};
const makeHand=(parent:THREE.Object3D,material:THREE.Material,side:number)=>{const g=new THREE.Group();g.position.set(0,-.67,.01);parent.add(g);add(g,new THREE.SphereGeometry(.105,28,20),material,[0,0,0],[1,.9,.76]);for(let i=-2;i<=2;i++)add(g,new THREE.CapsuleGeometry(.013,.073,5,12),material,[i*.034,-.084,.032],[1,1,1],[0,0,-side*i*.02]);return g;};

export function createHumanRig(palette:Palette,female=false):HumanRig{
  const root=new THREE.Group();root.position.y=.02;
  const skin=phys(palette.skin,.01,.42,.08),skinSoft=phys(palette.skin,.01,.5,.05),shirt=phys(0x0a0f0c,.18,.3,.18),jacket=phys(palette.primary,.38,.19,.52),jacketDark=phys(0x061008,.32,.26,.3),pants=phys(0x101820,.28,.33,.18),shoe=phys(0x020403,.62,.16,.64),gold=phys(palette.secondary,.9,.1,.72),dark=std(0x010202,.25,.32),white=std(0xf7f5ef,0,.18),lip=std(female?0x7f3348:0x4a241f,0,.36),auraMat=basic(palette.primary,.18);

  const pelvis=new THREE.Group();pelvis.position.y=2.05;root.add(pelvis);
  add(pelvis,new THREE.CapsuleGeometry(female?.38:.34,.2,10,28),pants,[0,0,0],[female?1.08:1,1,.78]);
  add(pelvis,new THREE.SphereGeometry(female?.31:.27,24,18),pants,[0,.08,.08],[1.2,.7,.9]);

  const spine=new THREE.Group();spine.position.y=.36;pelvis.add(spine);
  add(spine,new THREE.CapsuleGeometry(female?.29:.32,.58,10,30),shirt,[0,.36,0],[female?.95:1,1,.71]);
  add(spine,new THREE.SphereGeometry(female?.31:.35,24,18),shirt,[0,.68,0],[1.02,.66,.76]);

  const chest=new THREE.Group();chest.position.y=.66;spine.add(chest);
  add(chest,new THREE.CapsuleGeometry(female?.37:.43,.5,10,32),shirt,[0,.42,0],[1,1,.73]);
  add(chest,new THREE.SphereGeometry(female?.39:.45,28,20),shirt,[0,.66,.015],[1.04,.68,.77]);
  add(chest,new THREE.BoxGeometry(female?.86:1.02,.44,.1),jacket,[0,.48,.34]);
  add(chest,new THREE.BoxGeometry(female?.94:1.12,.17,.49),jacketDark,[0,.76,0]);
  add(chest,new THREE.BoxGeometry(.09,.5,.07),gold,[0,.45,.39]);

  const neck=new THREE.Group();neck.position.y=.95;chest.add(neck);
  add(neck,new THREE.CapsuleGeometry(.078,.1,8,20),skinSoft,[0,.05,0],[1,1,.96]);

  const head=new THREE.Group();head.position.y=.2;neck.add(head);
  add(head,new THREE.SphereGeometry(.305,56,40),skin,[0,.31,0],[.86,1.12,.88]);
  add(head,new THREE.SphereGeometry(.245,50,36),skinSoft,[0,.09,.018],[1,.87,.92]);
  add(head,new THREE.CapsuleGeometry(.047,.076,6,18),skinSoft,[0,.145,.274],[.72,.8,.54],[Math.PI/2,0,0]);
  add(head,new THREE.SphereGeometry(.028,20,16),white,[-.102,.27,.298]);add(head,new THREE.SphereGeometry(.028,20,16),white,[.102,.27,.298]);
  add(head,new THREE.SphereGeometry(.0125,16,14),dark,[-.102,.27,.321]);add(head,new THREE.SphereGeometry(.0125,16,14),dark,[.102,.27,.321]);
  add(head,new THREE.BoxGeometry(.145,.017,.019),dark,[-.102,.334,.316],[1,1,1],[0,0,-.06]);add(head,new THREE.BoxGeometry(.145,.017,.019),dark,[.102,.334,.316],[1,1,1],[0,0,.06]);
  add(head,new THREE.BoxGeometry(.19,.02,.022),lip,[0,.015,.326]);
  add(head,new THREE.SphereGeometry(.055,20,14),skin,[-.292,.25,0],[.46,.8,.53]);add(head,new THREE.SphereGeometry(.055,20,14),skin,[.292,.25,0],[.46,.8,.53]);
  const hair=new THREE.Group();hair.position.set(0,.48,-.03);head.add(hair);add(hair,new THREE.SphereGeometry(.325,42,30),dark,[0,0,0],[1,.5,.93]);
  const strands=female?12:8;for(let i=0;i<strands;i++){const a=(i/Math.max(1,strands-1)-.5)*1.45;add(hair,new THREE.CapsuleGeometry(.028,female?.3:.17,6,14),dark,[Math.sin(a)*.24,-.05,Math.cos(a)*.11],[1,1,1],[0,0,a*.2]);}

  const shoulderX=female?.54:.61;
  const leftArm=limb(chest,[-shoulderX,.72,0],.74,.125,jacket,[.96,1,.96]);const rightArm=limb(chest,[shoulderX,.72,0],.74,.125,jacket,[.96,1,.96]);leftArm.rotation.z=.055;rightArm.rotation.z=-.055;
  const leftForearm=limb(leftArm,[0,-.71,0],.63,.1,skin,[.94,1,.94]);const rightForearm=limb(rightArm,[0,-.71,0],.63,.1,skin,[.94,1,.94]);
  const leftHand=makeHand(leftForearm,skinSoft,-1),rightHand=makeHand(rightForearm,skinSoft,1);

  const hipX=female?.235:.215;
  const leftLeg=limb(pelvis,[-hipX,-.05,0],1.0,.165,pants,[.97,1,.95]);const rightLeg=limb(pelvis,[hipX,-.05,0],1.0,.165,pants,[.97,1,.95]);
  const leftKnee=limb(leftLeg,[0,-.97,0],.94,.135,pants,[.95,1,.94]);const rightKnee=limb(rightLeg,[0,-.97,0],.94,.135,pants,[.95,1,.94]);
  add(leftKnee,new THREE.BoxGeometry(.285,.145,.61),shoe,[0,-.95,.2],[1,1,1.14]);add(rightKnee,new THREE.BoxGeometry(.285,.145,.61),shoe,[0,-.95,.2],[1,1,1.14]);
  add(leftKnee,new THREE.BoxGeometry(.16,.035,.2),gold,[0,-.9,.46]);add(rightKnee,new THREE.BoxGeometry(.16,.035,.2),gold,[0,-.9,.46]);

  const chain=new THREE.Group();chain.position.set(0,.57,.385);chest.add(chain);add(chain,new THREE.TorusGeometry(.235,.015,14,84),gold,[0,0,0]);add(chain,new THREE.BoxGeometry(.038,.16,.026),gold,[0,-.18,.018]);add(chain,new THREE.OctahedronGeometry(.07,1),gold,[0,-.28,.018],[1,1.1,.45]);
  const aura=new THREE.Group();root.add(aura);add(aura,new THREE.TorusGeometry(1.0,.014,12,128),auraMat,[0,.05,0],[1,1,1],[Math.PI/2,0,0]);add(aura,new THREE.TorusGeometry(.69,.01,10,112),auraMat.clone(),[0,.11,0],[1,1,1],[Math.PI/2,0,0]);add(aura,new THREE.TorusKnotGeometry(.48,.008,100,10,2,3),auraMat.clone(),[0,3.03,-.1],[1,.46,1]);
  return{root,pelvis,spine,chest,neck,head,leftArm,rightArm,leftForearm,rightForearm,leftLeg,rightLeg,leftKnee,rightKnee,leftHand,rightHand,aura,chain};
}

export function animateHumanRig(rig:HumanRig,time:number,moving:boolean,sprinting:boolean,action:string){
  const speed=sprinting?11.8:6.7,phase=time*speed,stride=moving?Math.sin(phase)*(sprinting?.68:.4):0,opposite=moving?Math.sin(phase+Math.PI)*(sprinting?.68:.4):0,breath=Math.sin(time*1.22),sway=Math.sin(time*.68);
  rig.leftArm.rotation.x=moving?opposite*.56:-.025+breath*.012;rig.rightArm.rotation.x=moving?stride*.56:.025-breath*.012;rig.leftLeg.rotation.x=stride;rig.rightLeg.rotation.x=opposite;
  rig.leftKnee.rotation.x=moving?Math.max(0,-stride)*.68:.015;rig.rightKnee.rotation.x=moving?Math.max(0,-opposite)*.68:-.015;rig.leftForearm.rotation.x=moving?Math.max(0,stride)*.15:-.045;rig.rightForearm.rotation.x=moving?Math.max(0,opposite)*.15:-.045;
  rig.pelvis.position.y=2.05+(moving?Math.abs(Math.sin(phase))*.022:breath*.006);rig.pelvis.rotation.y=moving?Math.sin(phase)*.014:sway*.006;rig.spine.rotation.z=moving?Math.sin(phase)*.016:sway*.004;rig.chest.position.y=breath*.0045;rig.neck.rotation.z=sway*.004;rig.head.rotation.y=Math.sin(time*.58)*.028;rig.head.rotation.x=Math.sin(time*.42)*.008;
  rig.leftHand.rotation.z=Math.sin(time*1.6)*.009;rig.rightHand.rotation.z=-Math.sin(time*1.6)*.009;rig.leftArm.rotation.z=.055;rig.rightArm.rotation.z=-.055;rig.chest.rotation.y*=.84;rig.chest.rotation.x*=.84;
  if(action==='combat'){rig.leftArm.rotation.z=-.78;rig.rightArm.rotation.z=.72;rig.leftForearm.rotation.x=-1.05;rig.rightForearm.rotation.x=-.94;rig.chest.rotation.y=Math.sin(time*8.6)*.085;rig.head.rotation.y=Math.sin(time*5.6)*.055;}
  else if(action==='power'){rig.leftArm.rotation.z=-.46;rig.rightArm.rotation.z=.46;rig.leftForearm.rotation.x=-.24;rig.rightForearm.rotation.x=-.24;rig.chest.rotation.x=-.038;rig.head.rotation.x=-.05;}
  else if(action==='dance'){rig.leftArm.rotation.z=-.26+Math.sin(time*5.1)*.18;rig.rightArm.rotation.z=.26-Math.sin(time*5.1)*.18;rig.chest.rotation.y=Math.sin(time*5.1)*.2;rig.pelvis.rotation.y=Math.sin(time*5.1)*.15;}
  else if(action==='smoke'){rig.rightArm.rotation.z=-.08;rig.rightForearm.rotation.x=-1.34;rig.rightForearm.rotation.z=-.17;rig.head.rotation.y=-.11+Math.sin(time*.72)*.024;}
  const pulse=action==='power'?1.025+Math.sin(time*14)*.009:1;rig.aura.rotation.y=time*.42;rig.aura.rotation.z=Math.sin(time*.58)*.028;rig.aura.scale.setScalar(action==='power'?1.2+Math.sin(time*8.5)*.06:1+Math.sin(time*1.55)*.008);rig.chain.rotation.z=moving?Math.sin(phase)*.022:Math.sin(time)*.007;rig.chain.rotation.x=moving?Math.abs(Math.sin(phase))*.014:0;rig.root.scale.setScalar(pulse);
}

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

type Palette = { primary: number; secondary: number; skin: number };

const std = (color: number, metalness=.05, roughness=.52, emissive=0x000000, emissiveIntensity=0) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
const phys = (color:number, metalness=.15, roughness=.34, clearcoat=.22) =>
  new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat, clearcoatRoughness:.28 });

function add(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,pos:[number,number,number],scale:[number,number,number]=[1,1,1],rot:[number,number,number]=[0,0,0]){
  const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}

function capsuleLimb(parent:THREE.Object3D,pos:[number,number,number],length:number,radius:number,material:THREE.Material){
  const pivot=new THREE.Group();pivot.position.set(...pos);parent.add(pivot);
  add(pivot,new THREE.CapsuleGeometry(radius,Math.max(.08,length-radius*2),8,24),material,[0,-length/2,0]);
  return pivot;
}

function hand(parent:THREE.Object3D,material:THREE.Material,side:number){
  const g=new THREE.Group();g.position.set(0,-.67,.015);parent.add(g);
  add(g,new THREE.SphereGeometry(.105,24,18),material,[0,0,0],[1,.92,.78]);
  for(let i=-2;i<=2;i++) add(g,new THREE.CapsuleGeometry(.014,.07,4,10),material,[i*.035,-.087,.03],[1,1,1],[0,0,-side*i*.025]);
  return g;
}

export function createHumanRig(palette: Palette, female=false): HumanRig {
  const root=new THREE.Group();
  root.position.y=.03;

  const skin=phys(palette.skin,.02,.48,.08);
  const skinSoft=phys(palette.skin,.01,.58,.05);
  const shirt=phys(0x0a0f0c,.2,.32,.2);
  const jacket=phys(palette.primary,.42,.21,.55);
  const jacketDark=phys(0x071009,.34,.28,.32);
  const pants=phys(0x111820,.3,.36,.22);
  const shoe=phys(0x030504,.66,.18,.7);
  const gold=phys(palette.secondary,.9,.12,.7);
  const dark=std(0x010202,.28,.36);
  const white=std(0xf7f5ef,0,.24);
  const lip=std(female?0x6e2a3a:0x4d261f,0,.42);
  const auraMat=new THREE.MeshBasicMaterial({color:palette.primary,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending});

  const pelvis=new THREE.Group();pelvis.position.y=2.08;root.add(pelvis);
  add(pelvis,new THREE.CapsuleGeometry(female?.39:.36,.22,8,24),pants,[0,0,0],[female?1.08:1,1,.82]);

  const spine=new THREE.Group();spine.position.y=.34;pelvis.add(spine);
  add(spine,new THREE.CapsuleGeometry(female?.31:.34,.54,8,26),shirt,[0,.34,0],[female?.95:1.02,1,.74]);

  const chest=new THREE.Group();chest.position.y=.64;spine.add(chest);
  add(chest,new THREE.CapsuleGeometry(female?.38:.44,.52,8,28),shirt,[0,.42,0],[1,1,.76]);
  add(chest,new THREE.BoxGeometry(female?.88:1.04,.48,.12),jacket,[0,.48,.35],[1,1,1]);
  add(chest,new THREE.BoxGeometry(female?.96:1.14,.18,.54),jacketDark,[0,.77,0]);
  add(chest,new THREE.BoxGeometry(.11,.53,.08),gold,[0,.45,.40],[1,1,1]);

  const neck=new THREE.Group();neck.position.y=.96;chest.add(neck);
  add(neck,new THREE.CapsuleGeometry(.085,.09,6,18),skinSoft,[0,.05,0]);

  const head=new THREE.Group();head.position.y=.18;neck.add(head);
  add(head,new THREE.SphereGeometry(.32,48,36),skin,[0,.31,0],[.88,1.12,.9]);
  add(head,new THREE.SphereGeometry(.27,42,30),skinSoft,[0,.08,.01],[1,.9,.9]);
  add(head,new THREE.CapsuleGeometry(.052,.08,5,16),skinSoft,[0,.15,.285],[.72,.8,.58],[Math.PI/2,0,0]);
  add(head,new THREE.SphereGeometry(.03,18,14),white,[-.105,.27,.31]);
  add(head,new THREE.SphereGeometry(.03,18,14),white,[.105,.27,.31]);
  add(head,new THREE.SphereGeometry(.013,14,12),dark,[-.105,.27,.336]);
  add(head,new THREE.SphereGeometry(.013,14,12),dark,[.105,.27,.336]);
  add(head,new THREE.BoxGeometry(.15,.018,.02),dark,[-.105,.335,.329],[1,1,1],[0,0,-.07]);
  add(head,new THREE.BoxGeometry(.15,.018,.02),dark,[.105,.335,.329],[1,1,1],[0,0,.07]);
  add(head,new THREE.BoxGeometry(.2,.024,.025),lip,[0,.01,.337]);
  add(head,new THREE.SphereGeometry(.06,18,12),skin,[-.305,.25,0],[.45,.78,.52]);
  add(head,new THREE.SphereGeometry(.06,18,12),skin,[.305,.25,0],[.45,.78,.52]);

  const hair=new THREE.Group();hair.position.set(0,.49,-.03);head.add(hair);
  add(hair,new THREE.SphereGeometry(.34,36,26),dark,[0,0,0],[1,.54,.95]);
  for(let i=0;i<(female?10:7);i++){
    const count=female?10:7;
    const a=(i/Math.max(1,count-1)-.5)*1.3;
    add(hair,new THREE.CapsuleGeometry(.03,female?.28:.16,5,12),dark,[Math.sin(a)*.25,-.05,Math.cos(a)*.12],[1,1,1],[0,0,a*.22]);
  }

  const shoulderX=female?.56:.63;
  const leftArm=capsuleLimb(chest,[-shoulderX,.72,0],.72,.13,jacket);
  const rightArm=capsuleLimb(chest,[shoulderX,.72,0],.72,.13,jacket);
  leftArm.rotation.z=.07;rightArm.rotation.z=-.07;
  const leftForearm=capsuleLimb(leftArm,[0,-.69,0],.62,.105,skin);
  const rightForearm=capsuleLimb(rightArm,[0,-.69,0],.62,.105,skin);
  const leftHand=hand(leftForearm,skinSoft,-1);const rightHand=hand(rightForearm,skinSoft,1);

  const hipX=female?.24:.22;
  const leftLeg=capsuleLimb(pelvis,[-hipX,-.05,0],.97,.17,pants);
  const rightLeg=capsuleLimb(pelvis,[hipX,-.05,0],.97,.17,pants);
  const leftKnee=capsuleLimb(leftLeg,[0,-.94,0],.92,.14,pants);
  const rightKnee=capsuleLimb(rightLeg,[0,-.94,0],.92,.14,pants);
  add(leftKnee,new THREE.BoxGeometry(.3,.15,.64),shoe,[0,-.93,.2],[1,1,1.16]);
  add(rightKnee,new THREE.BoxGeometry(.3,.15,.64),shoe,[0,-.93,.2],[1,1,1.16]);
  add(leftKnee,new THREE.BoxGeometry(.18,.04,.22),gold,[0,-.88,.48]);
  add(rightKnee,new THREE.BoxGeometry(.18,.04,.22),gold,[0,-.88,.48]);

  const chain=new THREE.Group();chain.position.set(0,.58,.39);chest.add(chain);
  add(chain,new THREE.TorusGeometry(.25,.018,14,80),gold,[0,0,0]);
  add(chain,new THREE.BoxGeometry(.045,.18,.03),gold,[0,-.19,.02]);
  add(chain,new THREE.OctahedronGeometry(.08,1),gold,[0,-.30,.02],[1,1.12,.48]);

  const aura=new THREE.Group();root.add(aura);
  add(aura,new THREE.TorusGeometry(1.02,.018,12,120),auraMat,[0,.05,0],[1,1,1],[Math.PI/2,0,0]);
  add(aura,new THREE.TorusGeometry(.72,.012,10,100),auraMat.clone(),[0,.11,0],[1,1,1],[Math.PI/2,0,0]);
  add(aura,new THREE.TorusKnotGeometry(.5,.01,92,10,2,3),auraMat.clone(),[0,3.05,-.1],[1,.48,1]);

  return {root,pelvis,spine,chest,neck,head,leftArm,rightArm,leftForearm,rightForearm,leftLeg,rightLeg,leftKnee,rightKnee,leftHand,rightHand,aura,chain};
}

export function animateHumanRig(rig:HumanRig,time:number,moving:boolean,sprinting:boolean,action:string){
  const speed=sprinting?12.5:7.1;
  const phase=time*speed;
  const stride=moving?Math.sin(phase)*(sprinting?.74:.44):0;
  const opposite=moving?Math.sin(phase+Math.PI)*(sprinting?.74:.44):0;
  const breath=Math.sin(time*1.35);
  const sway=Math.sin(time*.75);

  rig.leftArm.rotation.x=moving?opposite*.62:-.03+breath*.016;
  rig.rightArm.rotation.x=moving?stride*.62:.03-breath*.016;
  rig.leftLeg.rotation.x=stride;rig.rightLeg.rotation.x=opposite;
  rig.leftKnee.rotation.x=moving?Math.max(0,-stride)*.72:.02;
  rig.rightKnee.rotation.x=moving?Math.max(0,-opposite)*.72:-.02;
  rig.leftForearm.rotation.x=moving?Math.max(0,stride)*.18:-.06;
  rig.rightForearm.rotation.x=moving?Math.max(0,opposite)*.18:-.06;

  rig.pelvis.position.y=2.08+(moving?Math.abs(Math.sin(phase))*.028:breath*.008);
  rig.pelvis.rotation.y=moving?Math.sin(phase)*.018:sway*.008;
  rig.spine.rotation.z=moving?Math.sin(phase)*.022:sway*.006;
  rig.chest.position.y=breath*.006;
  rig.neck.rotation.z=sway*.006;
  rig.head.rotation.y=Math.sin(time*.62)*.035;
  rig.head.rotation.x=Math.sin(time*.45)*.01;
  rig.leftHand.rotation.z=Math.sin(time*1.8)*.012;
  rig.rightHand.rotation.z=-Math.sin(time*1.8)*.012;

  rig.leftArm.rotation.z=.07;rig.rightArm.rotation.z=-.07;
  rig.chest.rotation.y*=.82;rig.chest.rotation.x*=.82;

  if(action==='combat'){
    rig.leftArm.rotation.z=-.86;rig.rightArm.rotation.z=.78;
    rig.leftForearm.rotation.x=-1.15;rig.rightForearm.rotation.x=-1.02;
    rig.chest.rotation.y=Math.sin(time*9)*.1;rig.head.rotation.y=Math.sin(time*6)*.07;
  }else if(action==='power'){
    rig.leftArm.rotation.z=-.5;rig.rightArm.rotation.z=.5;
    rig.leftForearm.rotation.x=-.28;rig.rightForearm.rotation.x=-.28;
    rig.chest.rotation.x=-.045;rig.head.rotation.x=-.06;
  }else if(action==='dance'){
    rig.leftArm.rotation.z=-.3+Math.sin(time*5.4)*.2;rig.rightArm.rotation.z=.3-Math.sin(time*5.4)*.2;
    rig.chest.rotation.y=Math.sin(time*5.4)*.24;rig.pelvis.rotation.y=Math.sin(time*5.4)*.18;
  }else if(action==='smoke'){
    rig.rightArm.rotation.z=-.1;rig.rightForearm.rotation.x=-1.45;rig.rightForearm.rotation.z=-.2;rig.head.rotation.y=-.13+Math.sin(time*.75)*.03;
  }

  const pulse=action==='power'?1.04+Math.sin(time*15)*.012:1;
  rig.aura.rotation.y=time*.46;rig.aura.rotation.z=Math.sin(time*.62)*.035;
  rig.aura.scale.setScalar(action==='power'?1.28+Math.sin(time*9)*.08:1+Math.sin(time*1.7)*.01);
  rig.chain.rotation.z=moving?Math.sin(phase)*.03:Math.sin(time)*.009;
  rig.chain.rotation.x=moving?Math.abs(Math.sin(phase))*.018:0;
  rig.root.scale.setScalar(pulse);
}

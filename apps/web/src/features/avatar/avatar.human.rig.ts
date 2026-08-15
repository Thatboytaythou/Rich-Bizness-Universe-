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

const phys=(color:number,metalness=.08,roughness=.34,clearcoat=.24)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat,clearcoatRoughness:.2});
const std=(color:number,metalness=.04,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const glow=(color:number,opacity=.16)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,pos:[number,number,number],scale:[number,number,number]=[1,1,1],rot:[number,number,number]=[0,0,0])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
const limb=(parent:THREE.Object3D,pos:[number,number,number],length:number,radius:number,material:THREE.Material,scale:[number,number,number]=[1,1,1])=>{const p=new THREE.Group();p.position.set(...pos);parent.add(p);add(p,new THREE.CapsuleGeometry(radius,Math.max(.08,length-radius*2),12,32),material,[0,-length/2,0],scale);return p;};
const makeHand=(parent:THREE.Object3D,material:THREE.Material,side:number)=>{const g=new THREE.Group();g.position.set(0,-.67,.02);parent.add(g);add(g,new THREE.SphereGeometry(.108,28,20),material,[0,0,0],[1,.9,.78]);for(let i=-2;i<=2;i++)add(g,new THREE.CapsuleGeometry(.0135,.082,6,14),material,[i*.034,-.09,.035],[1,1,1],[0,0,-side*i*.025]);return g;};

export function createHumanRig(palette:Palette,female=false):HumanRig{
  const root=new THREE.Group();root.position.y=.02;
  const skin=phys(palette.skin,.02,.4,.16),skinSoft=phys(palette.skin,.01,.47,.11),shirt=phys(0x0a0f0c,.16,.31,.2),jacket=phys(palette.primary,.42,.18,.62),jacketDark=phys(0x061008,.34,.25,.36),pants=phys(0x101820,.25,.33,.2),shoe=phys(0x020403,.66,.14,.72),gold=phys(palette.secondary,.95,.08,.8),dark=std(0x010202,.25,.31),white=std(0xf7f5ef,0,.16),lip=std(female?0x8b3852:0x4a241f,0,.35);

  const pelvis=new THREE.Group();pelvis.position.y=2.04;root.add(pelvis);
  add(pelvis,new THREE.CapsuleGeometry(female?.36:.33,.24,12,32),pants,[0,0,0],[female?1.1:1,1,.8]);
  add(pelvis,new THREE.SphereGeometry(female?.3:.27,28,20),pants,[0,.08,.07],[1.22,.72,.95]);

  const spine=new THREE.Group();spine.position.y=.36;pelvis.add(spine);
  add(spine,new THREE.CapsuleGeometry(female?.285:.31,.6,12,34),shirt,[0,.36,0],[female?.96:1,1,.73]);
  add(spine,new THREE.SphereGeometry(female?.31:.35,28,20),shirt,[0,.68,.015],[1.03,.68,.8]);

  const chest=new THREE.Group();chest.position.y=.67;spine.add(chest);
  add(chest,new THREE.CapsuleGeometry(female?.365:.42,.52,12,34),shirt,[0,.42,0],[1,1,.75]);
  add(chest,new THREE.SphereGeometry(female?.385:.445,30,22),shirt,[0,.65,.025],[1.04,.7,.8]);
  add(chest,new THREE.BoxGeometry(female?.82:1,.46,.11),jacket,[0,.49,.35]);
  add(chest,new THREE.BoxGeometry(female?.9:1.1,.18,.5),jacketDark,[0,.76,0]);
  add(chest,new THREE.BoxGeometry(.085,.5,.065),gold,[0,.45,.4]);

  const neck=new THREE.Group();neck.position.y=.97;chest.add(neck);
  add(neck,new THREE.CapsuleGeometry(.082,.12,10,24),skinSoft,[0,.05,0],[1,1,.98]);

  const head=new THREE.Group();head.position.y=.21;neck.add(head);
  add(head,new THREE.SphereGeometry(.302,64,48),skin,[0,.31,0],[.87,1.13,.91]);
  add(head,new THREE.SphereGeometry(.244,56,42),skinSoft,[0,.095,.035],[1,.88,.96]);
  add(head,new THREE.SphereGeometry(.155,44,32),skinSoft,[0,.135,.17],[1,.7,.7]);
  add(head,new THREE.CapsuleGeometry(.046,.082,8,20),skinSoft,[0,.155,.292],[.72,.85,.56],[Math.PI/2,0,0]);
  add(head,new THREE.SphereGeometry(.029,24,18),white,[-.102,.285,.304]);add(head,new THREE.SphereGeometry(.029,24,18),white,[.102,.285,.304]);
  add(head,new THREE.SphereGeometry(.0135,20,16),dark,[-.102,.285,.329]);add(head,new THREE.SphereGeometry(.0135,20,16),dark,[.102,.285,.329]);
  add(head,new THREE.BoxGeometry(.14,.018,.021),dark,[-.104,.351,.323],[1,1,1],[0,0,-.08]);add(head,new THREE.BoxGeometry(.14,.018,.021),dark,[.104,.351,.323],[1,1,1],[0,0,.08]);
  add(head,new THREE.BoxGeometry(.19,.022,.024),lip,[0,.02,.337]);
  add(head,new THREE.SphereGeometry(.06,22,16),skin,[-.294,.25,.01],[.48,.82,.55]);add(head,new THREE.SphereGeometry(.06,22,16),skin,[.294,.25,.01],[.48,.82,.55]);
  const hair=new THREE.Group();hair.position.set(0,.49,-.035);head.add(hair);add(hair,new THREE.SphereGeometry(.326,48,34),dark,[0,0,0],[1,.52,.95]);
  const strands=female?16:10;for(let i=0;i<strands;i++){const a=(i/Math.max(1,strands-1)-.5)*1.5;add(hair,new THREE.CapsuleGeometry(.026,female?.34:.19,7,16),dark,[Math.sin(a)*.245,-.06,Math.cos(a)*.12],[1,1,1],[0,0,a*.22]);}

  const shoulderX=female?.53:.6;
  const leftArm=limb(chest,[-shoulderX,.72,0],.76,.12,jacket,[.95,1,.95]);const rightArm=limb(chest,[shoulderX,.72,0],.76,.12,jacket,[.95,1,.95]);leftArm.rotation.z=.06;rightArm.rotation.z=-.06;
  const leftForearm=limb(leftArm,[0,-.73,0],.65,.095,skin,[.93,1,.93]);const rightForearm=limb(rightArm,[0,-.73,0],.65,.095,skin,[.93,1,.93]);
  const leftHand=makeHand(leftForearm,skinSoft,-1),rightHand=makeHand(rightForearm,skinSoft,1);

  const hipX=female?.23:.21;
  const leftLeg=limb(pelvis,[-hipX,-.05,0],1.03,.16,pants,[.96,1,.95]);const rightLeg=limb(pelvis,[hipX,-.05,0],1.03,.16,pants,[.96,1,.95]);
  const leftKnee=limb(leftLeg,[0,-1,0],.97,.13,pants,[.94,1,.94]);const rightKnee=limb(rightLeg,[0,-1,0],.97,.13,pants,[.94,1,.94]);
  add(leftKnee,new THREE.BoxGeometry(.28,.14,.62),shoe,[0,-.97,.21],[1,1,1.16]);add(rightKnee,new THREE.BoxGeometry(.28,.14,.62),shoe,[0,-.97,.21],[1,1,1.16]);
  add(leftKnee,new THREE.BoxGeometry(.15,.032,.2),gold,[0,-.92,.47]);add(rightKnee,new THREE.BoxGeometry(.15,.032,.2),gold,[0,-.92,.47]);

  const chain=new THREE.Group();chain.position.set(0,.57,.392);chest.add(chain);add(chain,new THREE.TorusGeometry(.225,.013,14,84),gold,[0,0,0]);add(chain,new THREE.BoxGeometry(.034,.15,.022),gold,[0,-.17,.018]);add(chain,new THREE.OctahedronGeometry(.065,1),gold,[0,-.27,.018],[1,1.1,.45]);

  const aura=new THREE.Group();root.add(aura);
  const energy=glow(palette.primary,.075);add(aura,new THREE.SphereGeometry(1.04,30,22),energy,[0,2.18,0],[1,.94,.72]);
  const sparkMat=new THREE.MeshBasicMaterial({color:palette.primary,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending});
  const sparkGeo=new THREE.SphereGeometry(.021,8,6);for(let i=0;i<8;i++){const angle=(i/8)*Math.PI*2;add(aura,sparkGeo,sparkMat.clone(),[Math.cos(angle)*(.62+(i%2)*.12),.55+(i%4)*.58,Math.sin(angle)*(.32+(i%3)*.08)]);}

  return{root,pelvis,spine,chest,neck,head,leftArm,rightArm,leftForearm,rightForearm,leftLeg,rightLeg,leftKnee,rightKnee,leftHand,rightHand,aura,chain};
}

export function animateHumanRig(rig:HumanRig,time:number,moving:boolean,sprinting:boolean,action:string){
  const speed=sprinting?11.5:6.5,phase=time*speed,stride=moving?Math.sin(phase)*(sprinting?.64:.37):0,opposite=moving?Math.sin(phase+Math.PI)*(sprinting?.64:.37):0,breath=Math.sin(time*1.18),sway=Math.sin(time*.66);
  rig.leftArm.rotation.x=moving?opposite*.54:-.03+breath*.012;rig.rightArm.rotation.x=moving?stride*.54:.03-breath*.012;rig.leftLeg.rotation.x=stride;rig.rightLeg.rotation.x=opposite;
  rig.leftKnee.rotation.x=moving?Math.max(0,-stride)*.72:.012;rig.rightKnee.rotation.x=moving?Math.max(0,-opposite)*.72:-.012;rig.leftForearm.rotation.x=moving?Math.max(0,stride)*.14:-.04;rig.rightForearm.rotation.x=moving?Math.max(0,opposite)*.14:-.04;
  rig.pelvis.position.y=2.04+(moving?Math.abs(Math.sin(phase))*.018:breath*.005);rig.pelvis.rotation.y=moving?Math.sin(phase)*.012:sway*.005;rig.spine.rotation.z=moving?Math.sin(phase)*.014:sway*.004;rig.chest.position.y=breath*.004;rig.neck.rotation.z=sway*.004;rig.head.rotation.y=Math.sin(time*.56)*.026;rig.head.rotation.x=Math.sin(time*.4)*.008;
  rig.leftHand.rotation.z=Math.sin(time*1.55)*.008;rig.rightHand.rotation.z=-Math.sin(time*1.55)*.008;rig.leftArm.rotation.z=.06;rig.rightArm.rotation.z=-.06;rig.chest.rotation.y*=.84;rig.chest.rotation.x*=.84;
  if(action==='combat'){rig.leftArm.rotation.z=-.75;rig.rightArm.rotation.z=.7;rig.leftForearm.rotation.x=-1.0;rig.rightForearm.rotation.x=-.9;rig.chest.rotation.y=Math.sin(time*8.2)*.08;rig.head.rotation.y=Math.sin(time*5.4)*.05;}
  else if(action==='power'){rig.leftArm.rotation.z=-.43;rig.rightArm.rotation.z=.43;rig.leftForearm.rotation.x=-.22;rig.rightForearm.rotation.x=-.22;rig.chest.rotation.x=-.036;rig.head.rotation.x=-.048;}
  else if(action==='dance'){rig.leftArm.rotation.z=-.24+Math.sin(time*4.9)*.17;rig.rightArm.rotation.z=.24-Math.sin(time*4.9)*.17;rig.chest.rotation.y=Math.sin(time*4.9)*.18;rig.pelvis.rotation.y=Math.sin(time*4.9)*.14;}
  else if(action==='smoke'){rig.rightArm.rotation.z=-.07;rig.rightForearm.rotation.x=-1.3;rig.rightForearm.rotation.z=-.16;rig.head.rotation.y=-.1+Math.sin(time*.7)*.022;}
  const pulse=action==='power'?1.022+Math.sin(time*13)*.008:1;rig.aura.rotation.y=Math.sin(time*.33)*.07;rig.aura.position.y=Math.sin(time*1.3)*.012;rig.aura.scale.setScalar(action==='power'?1.07+Math.sin(time*8)*.03:1+Math.sin(time*1.5)*.005);rig.chain.rotation.z=moving?Math.sin(phase)*.02:Math.sin(time)*.006;rig.chain.rotation.x=moving?Math.abs(Math.sin(phase))*.012:0;rig.root.scale.setScalar(pulse);
}
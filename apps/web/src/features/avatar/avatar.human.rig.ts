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
const glow=(color:number,opacity=.14)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,pos:[number,number,number],scale:[number,number,number]=[1,1,1],rot:[number,number,number]=[0,0,0])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
const limb=(parent:THREE.Object3D,pos:[number,number,number],length:number,radius:number,material:THREE.Material,scale:[number,number,number]=[1,1,1])=>{const p=new THREE.Group();p.position.set(...pos);parent.add(p);add(p,new THREE.CapsuleGeometry(radius,Math.max(.08,length-radius*2),12,28),material,[0,-length/2,0],scale);return p;};
const makeHand=(parent:THREE.Object3D,material:THREE.Material,side:number)=>{const g=new THREE.Group();g.position.set(0,-.63,.02);parent.add(g);add(g,new THREE.SphereGeometry(.085,24,18),material,[0,0,0],[.94,.82,.7]);for(let i=-2;i<=2;i++)add(g,new THREE.CapsuleGeometry(.0105,.068,5,12),material,[i*.027,-.072,.03],[1,1,1],[0,0,-side*i*.018]);return g;};

export function createHumanRig(palette:Palette,female=false):HumanRig{
  const root=new THREE.Group();root.position.y=.02;
  const skin=phys(palette.skin,.015,.42,.12),skinSoft=phys(palette.skin,.01,.49,.08),shirt=phys(0x111714,.13,.34,.14),jacket=phys(palette.primary,.34,.24,.44),jacketDark=phys(0x0b120d,.26,.3,.22),pants=phys(0x131921,.2,.37,.12),shoe=phys(0x080b0a,.5,.2,.46),gold=phys(palette.secondary,.85,.11,.58),dark=std(0x070807,.18,.34),white=std(0xf7f5ef,0,.18),lip=std(female?0x8b3852:0x4a241f,0,.35);

  const pelvis=new THREE.Group();pelvis.position.y=2.11;root.add(pelvis);
  add(pelvis,new THREE.CapsuleGeometry(female?.29:.285,.22,12,28),pants,[0,0,0],[female?1.06:1,1,.72]);

  const spine=new THREE.Group();spine.position.y=.34;pelvis.add(spine);
  add(spine,new THREE.CapsuleGeometry(female?.235:.255,.62,12,30),shirt,[0,.37,0],[female?.94:1,1,.68]);

  const chest=new THREE.Group();chest.position.y=.62;spine.add(chest);
  add(chest,new THREE.CapsuleGeometry(female?.31:.345,.52,12,30),shirt,[0,.39,0],[1,1,.7]);
  add(chest,new THREE.BoxGeometry(female?.68:.76,.34,.08),jacket,[0,.5,.29]);
  add(chest,new THREE.BoxGeometry(female?.74:.84,.11,.34),jacketDark,[0,.72,0]);

  const neck=new THREE.Group();neck.position.y=.87;chest.add(neck);
  add(neck,new THREE.CapsuleGeometry(.066,.12,10,20),skinSoft,[0,.05,0],[1,1,.94]);

  const head=new THREE.Group();head.position.y=.2;neck.add(head);
  add(head,new THREE.SphereGeometry(.255,56,42),skin,[0,.27,0],[.84,1.05,.86]);
  add(head,new THREE.SphereGeometry(.196,48,36),skinSoft,[0,.06,.025],[1,.82,.9]);
  add(head,new THREE.CapsuleGeometry(.038,.068,7,18),skinSoft,[0,.12,.245],[.72,.82,.55],[Math.PI/2,0,0]);
  add(head,new THREE.SphereGeometry(.023,20,16),white,[-.083,.245,.258]);add(head,new THREE.SphereGeometry(.023,20,16),white,[.083,.245,.258]);
  add(head,new THREE.SphereGeometry(.0105,16,14),dark,[-.083,.245,.278]);add(head,new THREE.SphereGeometry(.0105,16,14),dark,[.083,.245,.278]);
  add(head,new THREE.BoxGeometry(.115,.014,.016),dark,[-.083,.305,.274],[1,1,1],[0,0,-.05]);add(head,new THREE.BoxGeometry(.115,.014,.016),dark,[.083,.305,.274],[1,1,1],[0,0,.05]);
  add(head,new THREE.BoxGeometry(.145,.016,.018),lip,[0,-.002,.284]);
  add(head,new THREE.SphereGeometry(.047,18,14),skin,[-.247,.22,0],[.42,.72,.48]);add(head,new THREE.SphereGeometry(.047,18,14),skin,[.247,.22,0],[.42,.72,.48]);
  const hair=new THREE.Group();hair.position.set(0,.42,-.025);head.add(hair);add(hair,new THREE.SphereGeometry(.27,40,30),dark,[0,0,0],[1,.44,.92]);
  const strands=female?14:8;for(let i=0;i<strands;i++){const a=(i/Math.max(1,strands-1)-.5)*1.4;add(hair,new THREE.CapsuleGeometry(.021,female?.3:.15,6,12),dark,[Math.sin(a)*.205,-.045,Math.cos(a)*.1],[1,1,1],[0,0,a*.16]);}

  const shoulderX=female?.43:.47;
  const leftArm=limb(chest,[-shoulderX,.66,0],.79,.092,jacket,[.92,1,.92]);const rightArm=limb(chest,[shoulderX,.66,0],.79,.092,jacket,[.92,1,.92]);leftArm.rotation.z=.04;rightArm.rotation.z=-.04;
  const leftForearm=limb(leftArm,[0,-.76,0],.7,.078,skin,[.9,1,.9]);const rightForearm=limb(rightArm,[0,-.76,0],.7,.078,skin,[.9,1,.9]);
  const leftHand=makeHand(leftForearm,skinSoft,-1),rightHand=makeHand(rightForearm,skinSoft,1);

  const hipX=female?.185:.17;
  const leftLeg=limb(pelvis,[-hipX,-.04,0],1.14,.115,pants,[.93,1,.92]);const rightLeg=limb(pelvis,[hipX,-.04,0],1.14,.115,pants,[.93,1,.92]);
  const leftKnee=limb(leftLeg,[0,-1.1,0],1.08,.096,pants,[.92,1,.91]);const rightKnee=limb(rightLeg,[0,-1.1,0],1.08,.096,pants,[.92,1,.91]);
  add(leftKnee,new THREE.BoxGeometry(.22,.11,.45),shoe,[0,-1.04,.16],[1,1,1.08]);add(rightKnee,new THREE.BoxGeometry(.22,.11,.45),shoe,[0,-1.04,.16],[1,1,1.08]);

  const chain=new THREE.Group();chain.position.set(0,.52,.315);chest.add(chain);add(chain,new THREE.TorusGeometry(.17,.01,12,64),gold,[0,0,0]);add(chain,new THREE.BoxGeometry(.025,.11,.018),gold,[0,-.13,.012]);

  const aura=new THREE.Group();root.add(aura);
  const energy=glow(palette.primary,.055);add(aura,new THREE.SphereGeometry(.88,26,18),energy,[0,2.2,0],[1,.95,.7]);
  const sparkMat=new THREE.MeshBasicMaterial({color:palette.primary,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending});
  const sparkGeo=new THREE.SphereGeometry(.017,7,5);for(let i=0;i<6;i++){const angle=(i/6)*Math.PI*2;add(aura,sparkGeo,sparkMat.clone(),[Math.cos(angle)*(.5+(i%2)*.09),.7+(i%3)*.62,Math.sin(angle)*(.24+(i%2)*.06)]);}

  return{root,pelvis,spine,chest,neck,head,leftArm,rightArm,leftForearm,rightForearm,leftLeg,rightLeg,leftKnee,rightKnee,leftHand,rightHand,aura,chain};
}

export function animateHumanRig(rig:HumanRig,time:number,moving:boolean,sprinting:boolean,action:string){
  const speed=sprinting?10.4:5.9,phase=time*speed,stride=moving?Math.sin(phase)*(sprinting?.58:.34):0,opposite=moving?Math.sin(phase+Math.PI)*(sprinting?.58:.34):0,breath=Math.sin(time*1.1),sway=Math.sin(time*.62);
  rig.leftArm.rotation.x=moving?opposite*.46:-.02+breath*.009;rig.rightArm.rotation.x=moving?stride*.46:.02-breath*.009;rig.leftLeg.rotation.x=stride;rig.rightLeg.rotation.x=opposite;
  rig.leftKnee.rotation.x=moving?Math.max(0,-stride)*.66:.008;rig.rightKnee.rotation.x=moving?Math.max(0,-opposite)*.66:-.008;rig.leftForearm.rotation.x=moving?Math.max(0,stride)*.11:-.025;rig.rightForearm.rotation.x=moving?Math.max(0,opposite)*.11:-.025;
  rig.pelvis.position.y=2.11+(moving?Math.abs(Math.sin(phase))*.012:breath*.004);rig.pelvis.rotation.y=moving?Math.sin(phase)*.009:sway*.004;rig.spine.rotation.z=moving?Math.sin(phase)*.01:sway*.003;rig.chest.position.y=breath*.003;rig.neck.rotation.z=sway*.003;rig.head.rotation.y=Math.sin(time*.52)*.022;rig.head.rotation.x=Math.sin(time*.38)*.006;
  rig.leftHand.rotation.z=Math.sin(time*1.4)*.006;rig.rightHand.rotation.z=-Math.sin(time*1.4)*.006;rig.leftArm.rotation.z=.04;rig.rightArm.rotation.z=-.04;rig.chest.rotation.y*=.84;rig.chest.rotation.x*=.84;
  if(action==='combat'){rig.leftArm.rotation.z=-.58;rig.rightArm.rotation.z=.54;rig.leftForearm.rotation.x=-.82;rig.rightForearm.rotation.x=-.76;rig.chest.rotation.y=Math.sin(time*7.2)*.065;}
  else if(action==='power'){rig.leftArm.rotation.z=-.34;rig.rightArm.rotation.z=.34;rig.leftForearm.rotation.x=-.18;rig.rightForearm.rotation.x=-.18;rig.chest.rotation.x=-.028;rig.head.rotation.x=-.035;}
  else if(action==='dance'){rig.leftArm.rotation.z=-.18+Math.sin(time*4.2)*.14;rig.rightArm.rotation.z=.18-Math.sin(time*4.2)*.14;rig.chest.rotation.y=Math.sin(time*4.2)*.14;rig.pelvis.rotation.y=Math.sin(time*4.2)*.1;}
  else if(action==='smoke'){rig.rightArm.rotation.z=-.05;rig.rightForearm.rotation.x=-1.08;rig.rightForearm.rotation.z=-.11;rig.head.rotation.y=-.07+Math.sin(time*.65)*.018;}
  const pulse=action==='power'?1.014+Math.sin(time*12)*.006:1;rig.aura.rotation.y=Math.sin(time*.3)*.05;rig.aura.position.y=Math.sin(time*1.2)*.01;rig.aura.scale.setScalar(action==='power'?1.05+Math.sin(time*7.5)*.022:1+Math.sin(time*1.35)*.004);rig.chain.rotation.z=moving?Math.sin(phase)*.014:Math.sin(time)*.004;rig.root.scale.setScalar(pulse);
}
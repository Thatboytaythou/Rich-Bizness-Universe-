import * as THREE from 'three';

export type AvatarGender = 'boy' | 'girl';
export type AvatarMotion = 'idle' | 'walk' | 'run' | 'jump' | 'power';

export type GtaAvatarRig = {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftWrist: THREE.Group;
  rightWrist: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightAnkle: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

const BASE_PELVIS_Y = 1.28;
const mat = <T extends THREE.Material>(m:T,bucket:THREE.Material[]) => { bucket.push(m); return m; };
const geo = <T extends THREE.BufferGeometry>(g:T,bucket:THREE.BufferGeometry[]) => { bucket.push(g); return g; };

function part(g:THREE.BufferGeometry,m:THREE.Material){
  const x=new THREE.Mesh(g,m); x.castShadow=true; x.receiveShadow=true; return x;
}
function ellipsoid(x:number,y:number,z:number,m:THREE.Material,b:THREE.BufferGeometry[]){
  const q=part(geo(new THREE.SphereGeometry(1,40,30),b),m); q.scale.set(x,y,z); return q;
}
function capsule(r:number,l:number,m:THREE.Material,b:THREE.BufferGeometry[]){
  return part(geo(new THREE.CapsuleGeometry(r,l,12,28),b),m);
}
function tapered(top:number,bottom:number,h:number,m:THREE.Material,b:THREE.BufferGeometry[]){
  return part(geo(new THREE.CylinderGeometry(top,bottom,h,32),b),m);
}

export function createGtaAvatar(options:{gender:AvatarGender;accent:number;build:string;style:string}):GtaAvatarRig{
  const {gender,accent,build,style}=options;
  const female=gender==='girl';
  const materials:THREE.Material[]=[];
  const geometries:THREE.BufferGeometry[]=[];

  const root=new THREE.Group();
  const pelvis=new THREE.Group();
  const spine=new THREE.Group();
  const chest=new THREE.Group();
  const neck=new THREE.Group();
  const head=new THREE.Group();
  const leftShoulder=new THREE.Group(),rightShoulder=new THREE.Group();
  const leftElbow=new THREE.Group(),rightElbow=new THREE.Group();
  const leftWrist=new THREE.Group(),rightWrist=new THREE.Group();
  const leftHip=new THREE.Group(),rightHip=new THREE.Group();
  const leftKnee=new THREE.Group(),rightKnee=new THREE.Group();
  const leftAnkle=new THREE.Group(),rightAnkle=new THREE.Group();

  const skin=mat(new THREE.MeshPhysicalMaterial({color:female?0xa86f54:0x925f45,roughness:.58,clearcoat:.025}),materials);
  const top=mat(new THREE.MeshPhysicalMaterial({color:style==='boss'?0x171b19:accent,roughness:style==='cyber'?.32:.50,metalness:style==='cyber'?.20:.02,clearcoat:style==='cyber'?.25:.06}),materials);
  const tee=mat(new THREE.MeshStandardMaterial({color:0xe6ebe7,roughness:.86}),materials);
  const pants=mat(new THREE.MeshStandardMaterial({color:style==='boss'?0x111412:0x181d1a,roughness:.84}),materials);
  const shoe=mat(new THREE.MeshPhysicalMaterial({color:0x0b0d0c,roughness:.46,metalness:.08,clearcoat:.12}),materials);
  const hair=mat(new THREE.MeshStandardMaterial({color:0x101110,roughness:.82}),materials);
  const eyeWhite=mat(new THREE.MeshStandardMaterial({color:0xf6f3ec,roughness:.55}),materials);
  const iris=mat(new THREE.MeshStandardMaterial({color:0x27150f,roughness:.5}),materials);
  const brow=mat(new THREE.MeshStandardMaterial({color:0x1d130f,roughness:.72}),materials);
  const lips=mat(new THREE.MeshStandardMaterial({color:female?0x76424b:0x57332c,roughness:.64}),materials);
  const belt=mat(new THREE.MeshStandardMaterial({color:0x0b0d0c,roughness:.6}),materials);
  const gold=mat(new THREE.MeshPhysicalMaterial({color:0xc9a944,roughness:.28,metalness:.72}),materials);

  const width=build==='lean'?.93:build==='heroic'?1.045:1;
  const shoulderX=(female?.30:.335)*width;
  const hipX=female?.145:.135;
  const legScale=build==='lean'?1.015:build==='heroic'?.98:1;

  root.add(pelvis);
  pelvis.position.y=BASE_PELVIS_Y;

  const pelvisBody=ellipsoid(female?.265:.245,.155,.19,pants,geometries);
  pelvis.add(pelvisBody);
  const beltBand=tapered(.245,.245,.065,belt,geometries); beltBand.position.y=.13; beltBand.scale.z=.78; pelvis.add(beltBand);
  const buckle=part(geo(new THREE.BoxGeometry(.064,.044,.018),geometries),gold); buckle.position.set(0,.13,.194); pelvis.add(buckle);

  spine.position.y=.18; pelvis.add(spine);
  const waist=tapered(.205*width,.225*width,.35,tee,geometries); waist.position.y=.18; waist.scale.z=.72; spine.add(waist);

  chest.position.y=.31; spine.add(chest);
  const torso=tapered((female?.275:.31)*width,.215*width,.50,top,geometries); torso.position.y=.25; torso.scale.z=.70; chest.add(torso);
  const teeInset=part(geo(new THREE.PlaneGeometry(.18*width,.28),geometries),tee); teeInset.position.set(0,.25,.219); chest.add(teeInset);

  neck.position.y=.54; chest.add(neck);
  const neckBody=tapered(.076,.086,.15,skin,geometries); neck.add(neckBody);

  head.position.y=.18; neck.add(head);
  const skull=ellipsoid(.175,.215,.18,skin,geometries); skull.position.y=.07; head.add(skull);
  const jaw=ellipsoid(.148,.09,.145,skin,geometries); jaw.position.set(0,-.075,.012); head.add(jaw);
  const earL=ellipsoid(.026,.042,.020,skin,geometries); earL.position.set(-.174,.055,0); head.add(earL);
  const earR=earL.clone(); earR.position.x=.174; head.add(earR);
  const hairCap=part(geo(new THREE.SphereGeometry(.184,36,22,0,Math.PI*2,0,Math.PI*.52),geometries),hair); hairCap.position.y=.218; hairCap.scale.set(1.02,.46,1.02); head.add(hairCap);
  if(female){ const pony=capsule(.028,.15,hair,geometries); pony.position.set(.055,.10,-.18); pony.rotation.z=.12; head.add(pony); }

  const leftEye=ellipsoid(.020,.015,.011,eyeWhite,geometries); leftEye.position.set(-.057,.075,.174); head.add(leftEye);
  const rightEye=leftEye.clone(); rightEye.position.x=.057; head.add(rightEye);
  for(const x of [-.057,.057]){
    const p=ellipsoid(.0078,.0078,.0065,iris,geometries); p.position.set(x,.075,.186); head.add(p);
    const b=part(geo(new THREE.BoxGeometry(.052,.009,.010),geometries),brow); b.position.set(x,.122,.178); b.rotation.z=x<0?-.035:.035; head.add(b);
  }
  const nose=ellipsoid(.020,.030,.025,skin,geometries); nose.position.set(0,.015,.182); head.add(nose);
  const mouth=part(geo(new THREE.BoxGeometry(.052,.009,.009),geometries),lips); mouth.position.set(0,-.065,.169); head.add(mouth);

  const addArm=(side:-1|1,shoulder:THREE.Group,elbow:THREE.Group,wrist:THREE.Group)=>{
    shoulder.position.set(side*shoulderX,.39,0); chest.add(shoulder);
    const sleeve=capsule(.066,.12,top,geometries); sleeve.position.y=-.09; shoulder.add(sleeve);
    const upper=capsule(.049,.25,skin,geometries); upper.position.y=-.285; shoulder.add(upper);
    elbow.position.y=-.45; shoulder.add(elbow);
    elbow.add(ellipsoid(.052,.048,.046,skin,geometries));
    const fore=capsule(.045,.245,skin,geometries); fore.position.y=-.16; elbow.add(fore);
    wrist.position.y=-.32; elbow.add(wrist);
    const hand=ellipsoid(.050,.070,.031,skin,geometries); hand.position.y=-.052; wrist.add(hand);
  };
  addArm(-1,leftShoulder,leftElbow,leftWrist); addArm(1,rightShoulder,rightElbow,rightWrist);

  const addLeg=(side:-1|1,hip:THREE.Group,knee:THREE.Group,ankle:THREE.Group)=>{
    hip.position.set(side*hipX,-.06,0); pelvis.add(hip);
    const thigh=capsule(.074,.42*legScale,pants,geometries); thigh.position.y=-.27*legScale; hip.add(thigh);
    knee.position.y=-.53*legScale; hip.add(knee);
    knee.add(ellipsoid(.069,.059,.065,pants,geometries));
    const shin=capsule(.061,.39*legScale,pants,geometries); shin.position.y=-.25*legScale; knee.add(shin);
    ankle.position.y=-.49*legScale; knee.add(ankle);
    const foot=part(geo(new THREE.BoxGeometry(.16,.095,.29),geometries),shoe); foot.position.set(0,-.046,.088); ankle.add(foot);
    const sole=part(geo(new THREE.BoxGeometry(.164,.022,.294),geometries),shoe); sole.position.set(0,-.098,.088); ankle.add(sole);
  };
  addLeg(-1,leftHip,leftKnee,leftAnkle); addLeg(1,rightHip,rightKnee,rightAnkle);

  root.scale.setScalar(1.0);
  return {root,pelvis,spine,chest,neck,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftWrist,rightWrist,leftHip,rightHip,leftKnee,rightKnee,leftAnkle,rightAnkle,leftEye,rightEye,materials,geometries};
}

export function poseGtaAvatar(r:GtaAvatarRig,time:number,motion:AvatarMotion,powerAmount=0){
  const walking=motion==='walk'||motion==='run';
  const running=motion==='run';
  const gait=time*(running?9.4:6.0);
  const stride=walking?(running?.48:.31):0;
  const swing=Math.sin(gait)*stride;
  const lift=walking?Math.max(0,Math.sin(gait))*(running?.055:.032):0;
  const bounce=walking?Math.abs(Math.sin(gait))*(running?.018:.009):Math.sin(time*1.45)*.003;

  r.pelvis.position.y=BASE_PELVIS_Y+bounce;
  r.pelvis.rotation.y=walking?Math.sin(gait)*.028:Math.sin(time*.38)*.008;
  r.pelvis.rotation.z=walking?Math.sin(gait)*.010:0;
  r.spine.rotation.y=walking?-Math.sin(gait)*.022:Math.sin(time*.46)*.006;
  r.chest.rotation.y=walking?-Math.sin(gait)*.034:Math.sin(time*.50)*.008;
  r.chest.rotation.z=walking?Math.sin(gait)*.010:Math.sin(time*.68)*.004;
  r.chest.rotation.x=Math.sin(time*1.45)*.004;
  r.neck.rotation.y=walking?0:Math.sin(time*.42)*.018;
  r.head.rotation.y=walking?THREE.MathUtils.lerp(r.head.rotation.y,0,.12):Math.sin(time*.40)*.055;
  r.head.rotation.x=walking?-.006:Math.sin(time*.66)*.009;

  r.leftHip.rotation.x=swing;
  r.rightHip.rotation.x=-swing;
  r.leftHip.position.y=-.06+lift;
  r.rightHip.position.y=-.06+(walking?Math.max(0,-Math.sin(gait))*(running?.055:.032):0);
  r.leftKnee.rotation.x=walking?Math.max(0,-Math.sin(gait))*(running?.66:.40):.008;
  r.rightKnee.rotation.x=walking?Math.max(0,Math.sin(gait))*(running?.66:.40):.008;
  r.leftAnkle.rotation.x=-r.leftKnee.rotation.x*.36+(walking?Math.sin(gait)*.04:0);
  r.rightAnkle.rotation.x=-r.rightKnee.rotation.x*.36-(walking?Math.sin(gait)*.04:0);

  r.leftShoulder.rotation.x=-swing*.62;
  r.rightShoulder.rotation.x=swing*.62;
  r.leftShoulder.rotation.z=.014;
  r.rightShoulder.rotation.z=-.014;
  r.leftElbow.rotation.x=walking?-.09-Math.max(0,-swing)*.16:-.045;
  r.rightElbow.rotation.x=walking?-.09-Math.max(0,swing)*.16:-.045;
  r.leftWrist.rotation.z=walking?Math.sin(gait)*.035:Math.sin(time*.82)*.012;
  r.rightWrist.rotation.z=walking?-Math.sin(gait)*.035:-Math.sin(time*.82)*.012;

  if(motion==='jump'){
    r.leftHip.rotation.x=-.18; r.rightHip.rotation.x=-.18;
    r.leftKnee.rotation.x=.33; r.rightKnee.rotation.x=.33;
    r.leftShoulder.rotation.x=-.15; r.rightShoulder.rotation.x=-.15;
  }
  if(motion==='power'||powerAmount>0){
    const p=Math.min(1,Math.max(powerAmount,motion==='power'?1:0));
    r.leftShoulder.rotation.z=THREE.MathUtils.lerp(r.leftShoulder.rotation.z,.82,p);
    r.rightShoulder.rotation.z=THREE.MathUtils.lerp(r.rightShoulder.rotation.z,-.82,p);
    r.leftElbow.rotation.x=-.42*p; r.rightElbow.rotation.x=-.42*p;
    r.chest.rotation.x=-.045*p; r.head.rotation.x=-.025*p;
  }
  const blink=Math.sin(time*3.0)>.992?.16:1;
  r.leftEye.scale.y=blink; r.rightEye.scale.y=blink;
}

export function disposeGtaAvatar(r:GtaAvatarRig){ r.geometries.forEach(g=>g.dispose()); r.materials.forEach(m=>m.dispose()); }

export function qualityProfile(){
  const cores=navigator.hardwareConcurrency||4;
  const high=cores>=6;
  const dpr=Math.min(window.devicePixelRatio||1,high?2.25:1.7);
  const shadowSize=high?2048:1024;
  return {high,dpr,shadowSize};
}

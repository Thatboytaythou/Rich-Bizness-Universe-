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

const BASE_PELVIS_Y = 1.22;
const mat = <T extends THREE.Material>(m:T,bucket:THREE.Material[]) => { bucket.push(m); return m; };
const geo = <T extends THREE.BufferGeometry>(g:T,bucket:THREE.BufferGeometry[]) => { bucket.push(g); return g; };

function mesh(g:THREE.BufferGeometry,m:THREE.Material){
  const x=new THREE.Mesh(g,m);
  x.castShadow=true;
  x.receiveShadow=true;
  return x;
}
function ellipsoid(x:number,y:number,z:number,m:THREE.Material,b:THREE.BufferGeometry[]){
  const q=mesh(geo(new THREE.SphereGeometry(1,44,32),b),m);
  q.scale.set(x,y,z);
  return q;
}
function capsule(r:number,l:number,m:THREE.Material,b:THREE.BufferGeometry[]){
  return mesh(geo(new THREE.CapsuleGeometry(r,l,14,28),b),m);
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

  const skin=mat(new THREE.MeshPhysicalMaterial({color:female?0xa96f55:0x925f45,roughness:.56,clearcoat:.025}),materials);
  const outfit=mat(new THREE.MeshPhysicalMaterial({color:style==='boss'?0x161a18:accent,roughness:style==='cyber'?.30:.48,metalness:style==='cyber'?.18:.02,clearcoat:style==='cyber'?.22:.05}),materials);
  const pants=mat(new THREE.MeshStandardMaterial({color:style==='boss'?0x101311:0x181d1a,roughness:.84}),materials);
  const shoes=mat(new THREE.MeshPhysicalMaterial({color:0x0b0d0c,roughness:.44,metalness:.08,clearcoat:.12}),materials);
  const hair=mat(new THREE.MeshStandardMaterial({color:0x101110,roughness:.82}),materials);
  const white=mat(new THREE.MeshStandardMaterial({color:0xf6f3ec,roughness:.55}),materials);
  const iris=mat(new THREE.MeshStandardMaterial({color:0x26150f,roughness:.50}),materials);
  const brow=mat(new THREE.MeshStandardMaterial({color:0x1b120e,roughness:.72}),materials);
  const lips=mat(new THREE.MeshStandardMaterial({color:female?0x754149:0x56312b,roughness:.65}),materials);

  const width=build==='lean'?.94:build==='heroic'?1.045:1;
  const shoulderX=(female?.285:.32)*width;
  const hipX=female?.135:.125;
  const legScale=build==='lean'?1.02:build==='heroic'?.98:1;

  root.add(pelvis);
  pelvis.position.y=BASE_PELVIS_Y;

  const pelvisBody=ellipsoid(female?.255:.235,.16,.185,pants,geometries);
  pelvis.add(pelvisBody);

  spine.position.y=.13;
  pelvis.add(spine);
  const abdomen=ellipsoid(.205*width,.255,.17,outfit,geometries);
  abdomen.position.y=.22;
  spine.add(abdomen);

  chest.position.y=.28;
  spine.add(chest);
  const torso=ellipsoid((female?.285:.315)*width,.36,.20,outfit,geometries);
  torso.position.y=.27;
  chest.add(torso);

  neck.position.y=.58;
  chest.add(neck);
  const neckBody=mesh(geo(new THREE.CylinderGeometry(.074,.082,.13,22),geometries),skin);
  neck.add(neckBody);

  head.position.y=.17;
  neck.add(head);
  const skull=ellipsoid(.165,.205,.17,skin,geometries); skull.position.y=.06; head.add(skull);
  const jaw=ellipsoid(.14,.085,.137,skin,geometries); jaw.position.set(0,-.067,.01); head.add(jaw);
  const earL=ellipsoid(.024,.039,.018,skin,geometries); earL.position.set(-.163,.048,0); head.add(earL);
  const earR=earL.clone(); earR.position.x=.163; head.add(earR);
  const hairCap=mesh(geo(new THREE.SphereGeometry(.174,34,20,0,Math.PI*2,0,Math.PI*.52),geometries),hair); hairCap.position.y=.205; hairCap.scale.set(1.02,.44,1.02); head.add(hairCap);
  if(female){ const pony=capsule(.025,.13,hair,geometries); pony.position.set(.05,.09,-.165); pony.rotation.z=.12; head.add(pony); }

  const leftEye=ellipsoid(.019,.014,.010,white,geometries); leftEye.position.set(-.053,.067,.163); head.add(leftEye);
  const rightEye=leftEye.clone(); rightEye.position.x=.053; head.add(rightEye);
  for(const x of [-.053,.053]){
    const p=ellipsoid(.007,.007,.006,iris,geometries); p.position.set(x,.067,.174); head.add(p);
    const b=mesh(geo(new THREE.BoxGeometry(.048,.008,.009),geometries),brow); b.position.set(x,.108,.168); b.rotation.z=x<0?-.03:.03; head.add(b);
  }
  const nose=ellipsoid(.018,.025,.022,skin,geometries); nose.position.set(0,.012,.17); head.add(nose);
  const mouth=mesh(geo(new THREE.BoxGeometry(.048,.008,.008),geometries),lips); mouth.position.set(0,-.058,.157); head.add(mouth);

  const addArm=(side:-1|1,shoulder:THREE.Group,elbow:THREE.Group,wrist:THREE.Group)=>{
    shoulder.position.set(side*shoulderX,.34,0);
    chest.add(shoulder);
    const upper=capsule(.055,.26,outfit,geometries); upper.position.y=-.19; shoulder.add(upper);
    elbow.position.y=-.38; shoulder.add(elbow);
    elbow.add(ellipsoid(.052,.050,.048,skin,geometries));
    const fore=capsule(.046,.235,skin,geometries); fore.position.y=-.155; elbow.add(fore);
    wrist.position.y=-.305; elbow.add(wrist);
    const hand=ellipsoid(.048,.065,.032,skin,geometries); hand.position.y=-.047; wrist.add(hand);
  };
  addArm(-1,leftShoulder,leftElbow,leftWrist);
  addArm(1,rightShoulder,rightElbow,rightWrist);

  const addLeg=(side:-1|1,hip:THREE.Group,knee:THREE.Group,ankle:THREE.Group)=>{
    hip.position.set(side*hipX,-.045,0);
    pelvis.add(hip);
    const thigh=capsule(.072,.38*legScale,pants,geometries); thigh.position.y=-.245*legScale; hip.add(thigh);
    knee.position.y=-.48*legScale; hip.add(knee);
    knee.add(ellipsoid(.066,.057,.062,pants,geometries));
    const shin=capsule(.060,.36*legScale,pants,geometries); shin.position.y=-.23*legScale; knee.add(shin);
    ankle.position.y=-.455*legScale; knee.add(ankle);
    const foot=mesh(geo(new THREE.BoxGeometry(.145,.085,.245),geometries),shoes); foot.position.set(0,-.042,.075); ankle.add(foot);
  };
  addLeg(-1,leftHip,leftKnee,leftAnkle);
  addLeg(1,rightHip,rightKnee,rightAnkle);

  root.scale.setScalar(1.0);
  return {root,pelvis,spine,chest,neck,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftWrist,rightWrist,leftHip,rightHip,leftKnee,rightKnee,leftAnkle,rightAnkle,leftEye,rightEye,materials,geometries};
}

export function poseGtaAvatar(r:GtaAvatarRig,time:number,motion:AvatarMotion,powerAmount=0){
  const walking=motion==='walk'||motion==='run';
  const running=motion==='run';
  const gait=time*(running?9.2:5.8);
  const stride=walking?(running?.44:.28):0;
  const swing=Math.sin(gait)*stride;
  const bounce=walking?Math.abs(Math.sin(gait))*(running?.015:.008):Math.sin(time*1.4)*.003;

  r.pelvis.position.y=BASE_PELVIS_Y+bounce;
  r.pelvis.rotation.y=walking?Math.sin(gait)*.024:Math.sin(time*.38)*.006;
  r.spine.rotation.y=walking?-Math.sin(gait)*.018:Math.sin(time*.46)*.005;
  r.chest.rotation.y=walking?-Math.sin(gait)*.028:Math.sin(time*.50)*.006;
  r.chest.rotation.z=walking?Math.sin(gait)*.008:Math.sin(time*.68)*.003;
  r.chest.rotation.x=Math.sin(time*1.4)*.003;
  r.neck.rotation.y=walking?0:Math.sin(time*.42)*.014;
  r.head.rotation.y=walking?THREE.MathUtils.lerp(r.head.rotation.y,0,.12):Math.sin(time*.40)*.045;
  r.head.rotation.x=walking?-.005:Math.sin(time*.66)*.008;

  r.leftHip.rotation.x=swing;
  r.rightHip.rotation.x=-swing;
  r.leftKnee.rotation.x=walking?Math.max(0,-Math.sin(gait))*(running?.60:.36):.006;
  r.rightKnee.rotation.x=walking?Math.max(0,Math.sin(gait))*(running?.60:.36):.006;
  r.leftAnkle.rotation.x=-r.leftKnee.rotation.x*.34+(walking?Math.sin(gait)*.035:0);
  r.rightAnkle.rotation.x=-r.rightKnee.rotation.x*.34-(walking?Math.sin(gait)*.035:0);

  r.leftShoulder.rotation.x=-swing*.58;
  r.rightShoulder.rotation.x=swing*.58;
  r.leftShoulder.rotation.z=.01;
  r.rightShoulder.rotation.z=-.01;
  r.leftElbow.rotation.x=walking?-.07-Math.max(0,-swing)*.13:-.035;
  r.rightElbow.rotation.x=walking?-.07-Math.max(0,swing)*.13:-.035;
  r.leftWrist.rotation.z=walking?Math.sin(gait)*.028:0;
  r.rightWrist.rotation.z=walking?-Math.sin(gait)*.028:0;

  if(motion==='jump'){
    r.leftHip.rotation.x=-.16; r.rightHip.rotation.x=-.16;
    r.leftKnee.rotation.x=.28; r.rightKnee.rotation.x=.28;
    r.leftShoulder.rotation.x=-.12; r.rightShoulder.rotation.x=-.12;
  }
  if(motion==='power'||powerAmount>0){
    const p=Math.min(1,Math.max(powerAmount,motion==='power'?1:0));
    r.leftShoulder.rotation.z=THREE.MathUtils.lerp(r.leftShoulder.rotation.z,.72,p);
    r.rightShoulder.rotation.z=THREE.MathUtils.lerp(r.rightShoulder.rotation.z,-.72,p);
    r.leftElbow.rotation.x=-.36*p; r.rightElbow.rotation.x=-.36*p;
    r.chest.rotation.x=-.035*p;
  }

  const blink=Math.sin(time*3.0)>.992?.16:1;
  r.leftEye.scale.y=blink;
  r.rightEye.scale.y=blink;
}

export function disposeGtaAvatar(r:GtaAvatarRig){
  r.geometries.forEach(g=>g.dispose());
  r.materials.forEach(m=>m.dispose());
}

export function qualityProfile(){
  const cores=navigator.hardwareConcurrency||4;
  const high=cores>=6;
  return {
    high,
    dpr:Math.min(window.devicePixelRatio||1,high?2.2:1.6),
    shadowSize:high?2048:1024
  };
}

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

const mat = <T extends THREE.Material>(m: T, bucket: THREE.Material[]) => { bucket.push(m); return m; };
const geo = <T extends THREE.BufferGeometry>(g: T, bucket: THREE.BufferGeometry[]) => { bucket.push(g); return g; };

function mesh(g: THREE.BufferGeometry, m: THREE.Material) {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
}

function capsule(r: number, l: number, m: THREE.Material, geometries: THREE.BufferGeometry[]) {
  return mesh(geo(new THREE.CapsuleGeometry(r, l, 14, 32), geometries), m);
}

function ellipsoid(rx: number, ry: number, rz: number, m: THREE.Material, geometries: THREE.BufferGeometry[]) {
  const x = mesh(geo(new THREE.SphereGeometry(1, 44, 32), geometries), m);
  x.scale.set(rx, ry, rz);
  return x;
}

export function createGtaAvatar(options: { gender: AvatarGender; accent: number; build: string; style: string }): GtaAvatarRig {
  const { gender, accent, build, style } = options;
  const female = gender === 'girl';
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  const spine = new THREE.Group();
  const chest = new THREE.Group();
  const neck = new THREE.Group();
  const head = new THREE.Group();
  const leftShoulder = new THREE.Group(), rightShoulder = new THREE.Group();
  const leftElbow = new THREE.Group(), rightElbow = new THREE.Group();
  const leftWrist = new THREE.Group(), rightWrist = new THREE.Group();
  const leftHip = new THREE.Group(), rightHip = new THREE.Group();
  const leftKnee = new THREE.Group(), rightKnee = new THREE.Group();
  const leftAnkle = new THREE.Group(), rightAnkle = new THREE.Group();

  const skin = mat(new THREE.MeshPhysicalMaterial({
    color: female ? 0xa97156 : 0x956247,
    roughness: .53,
    metalness: 0,
    clearcoat: .08,
    clearcoatRoughness: .7,
    sheen: .08,
    sheenRoughness: .8
  }), materials);
  const jacket = mat(new THREE.MeshPhysicalMaterial({
    color: style === 'boss' ? 0x121715 : accent,
    roughness: style === 'cyber' ? .26 : .42,
    metalness: style === 'cyber' ? .28 : .04,
    clearcoat: style === 'cyber' ? .42 : .12,
    clearcoatRoughness: .45
  }), materials);
  const shirt = mat(new THREE.MeshStandardMaterial({ color: 0xe8ece7, roughness: .74 }), materials);
  const pants = mat(new THREE.MeshPhysicalMaterial({ color: style === 'boss' ? 0x0d100f : 0x161b19, roughness: .66, metalness: .02 }), materials);
  const shoeMat = mat(new THREE.MeshPhysicalMaterial({ color: 0x080a09, roughness: .35, metalness: .16, clearcoat: .25 }), materials);
  const hairMat = mat(new THREE.MeshStandardMaterial({ color: 0x0c0d0c, roughness: .76 }), materials);
  const white = mat(new THREE.MeshStandardMaterial({ color: 0xf6f5f0, roughness: .5 }), materials);
  const iris = mat(new THREE.MeshStandardMaterial({ color: 0x2a170f, roughness: .46 }), materials);
  const browMat = mat(new THREE.MeshStandardMaterial({ color: 0x19110d, roughness: .68 }), materials);
  const lipMat = mat(new THREE.MeshStandardMaterial({ color: female ? 0x75414a : 0x57312b, roughness: .6 }), materials);
  const beltMat = mat(new THREE.MeshPhysicalMaterial({ color: 0x0c0d0c, roughness: .42, metalness: .18 }), materials);
  const metalMat = mat(new THREE.MeshPhysicalMaterial({ color: 0xd2b859, roughness: .22, metalness: .76, clearcoat: .3 }), materials);

  const width = build === 'lean' ? .93 : build === 'heroic' ? 1.055 : 1;
  const shoulderX = (female ? .365 : .405) * width;
  const hipX = female ? .185 : .17;
  const legLength = build === 'lean' ? 1.04 : 1;

  root.add(pelvis);
  pelvis.position.y = 1.92;

  const pelvisMesh = ellipsoid(female ? .34 : .31, .22, .23, pants, geometries);
  pelvis.add(pelvisMesh);
  const belt = mesh(geo(new THREE.CylinderGeometry(.30, .30, .10, 32), geometries), beltMat);
  belt.scale.z = .77;
  belt.position.y = .21;
  pelvis.add(belt);
  const buckle = mesh(geo(new THREE.BoxGeometry(.09, .065, .025), geometries), metalMat);
  buckle.position.set(0, .21, .238);
  pelvis.add(buckle);

  spine.position.y = .26;
  pelvis.add(spine);
  const abdomen = ellipsoid(.255 * width, .38, .19, shirt, geometries);
  abdomen.position.y = .34;
  spine.add(abdomen);

  chest.position.y = .48;
  spine.add(chest);
  const torso = ellipsoid((female ? .33 : .375) * width, .50, .225, jacket, geometries);
  torso.position.y = .38;
  chest.add(torso);
  const shirtPanel = mesh(geo(new THREE.BoxGeometry(.27 * width, .54, .028), geometries), shirt);
  shirtPanel.position.set(0, .34, .222);
  chest.add(shirtPanel);
  const collarL = mesh(geo(new THREE.BoxGeometry(.13, .24, .028), geometries), jacket);
  collarL.position.set(-.075, .62, .245); collarL.rotation.z = -.38; chest.add(collarL);
  const collarR = collarL.clone(); collarR.position.x = .075; collarR.rotation.z = .38; chest.add(collarR);

  neck.position.y = .91;
  chest.add(neck);
  neck.add(mesh(geo(new THREE.CylinderGeometry(.09, .105, .24, 24), geometries), skin));

  head.position.y = .29;
  neck.add(head);
  const skull = ellipsoid(.225, .29, .225, skin, geometries); skull.position.y = .12; head.add(skull);
  const jaw = ellipsoid(.19, .13, .18, skin, geometries); jaw.position.set(0, -.065, .015); head.add(jaw);
  const leftEar = ellipsoid(.035, .055, .025, skin, geometries); leftEar.position.set(-.225, .105, 0); head.add(leftEar);
  const rightEar = leftEar.clone(); rightEar.position.x = .225; head.add(rightEar);
  const hairCap = mesh(geo(new THREE.SphereGeometry(.235, 40, 24, 0, Math.PI * 2, 0, Math.PI * .5), geometries), hairMat);
  hairCap.position.y = .30; hairCap.scale.set(1.02, .50, 1.02); head.add(hairCap);
  if (female) {
    const pony = capsule(.045, .26, hairMat, geometries); pony.rotation.z = .15; pony.position.set(.08, .18, -.235); head.add(pony);
  }

  const leftEye = ellipsoid(.028, .022, .016, white, geometries); leftEye.position.set(-.078, .13, .218); head.add(leftEye);
  const rightEye = leftEye.clone(); rightEye.position.x = .078; head.add(rightEye);
  for (const x of [-.078, .078]) {
    const pupil = ellipsoid(.011, .011, .009, iris, geometries); pupil.position.set(x, .13, .236); head.add(pupil);
    const brow = mesh(geo(new THREE.BoxGeometry(.075, .012, .014), geometries), browMat); brow.position.set(x, .195, .222); brow.rotation.z = x < 0 ? -.05 : .05; head.add(brow);
  }
  const nose = capsule(.013, .05, skin, geometries); nose.rotation.x = Math.PI / 2; nose.position.set(0, .06, .235); head.add(nose);
  const mouth = mesh(geo(new THREE.BoxGeometry(.072, .012, .012), geometries), lipMat); mouth.position.set(0, -.052, .222); head.add(mouth);

  const addArm = (side: -1 | 1, shoulder: THREE.Group, elbow: THREE.Group, wrist: THREE.Group) => {
    shoulder.position.set(side * shoulderX, .63, 0);
    chest.add(shoulder);
    const sleeve = capsule(.09, .24, jacket, geometries); sleeve.position.y = -.17; shoulder.add(sleeve);
    const upper = capsule(.067, .39, skin, geometries); upper.position.y = -.44; shoulder.add(upper);
    elbow.position.y = -.69; shoulder.add(elbow);
    const elbowCap = ellipsoid(.073, .068, .068, skin, geometries); elbow.add(elbowCap);
    const fore = capsule(.061, .39, skin, geometries); fore.position.y = -.25; elbow.add(fore);
    wrist.position.y = -.49; elbow.add(wrist);
    const hand = ellipsoid(.075, .11, .045, skin, geometries); hand.position.y = -.085; wrist.add(hand);
    for (let i = 0; i < 4; i++) {
      const finger = capsule(.0085, .075, skin, geometries); finger.position.set((i - 1.5) * .019, -.17, .006); wrist.add(finger);
    }
  };
  addArm(-1, leftShoulder, leftElbow, leftWrist);
  addArm(1, rightShoulder, rightElbow, rightWrist);

  const addLeg = (side: -1 | 1, hip: THREE.Group, knee: THREE.Group, ankle: THREE.Group) => {
    hip.position.set(side * hipX, -.10, 0);
    pelvis.add(hip);
    const thigh = capsule(.103, .70 * legLength, pants, geometries); thigh.position.y = -.44 * legLength; hip.add(thigh);
    knee.position.y = -.87 * legLength; hip.add(knee);
    const kneeCap = ellipsoid(.095, .08, .088, pants, geometries); knee.add(kneeCap);
    const shin = capsule(.087, .67 * legLength, pants, geometries); shin.position.y = -.42 * legLength; knee.add(shin);
    ankle.position.y = -.83 * legLength; knee.add(ankle);
    const foot = mesh(geo(new THREE.BoxGeometry(.21, .13, .39), geometries), shoeMat); foot.position.set(0, -.065, .12); foot.rotation.x = -.035; ankle.add(foot);
    const sole = mesh(geo(new THREE.BoxGeometry(.215, .035, .40), geometries), shoeMat); sole.position.set(0, -.13, .12); ankle.add(sole);
  };
  addLeg(-1, leftHip, leftKnee, leftAnkle);
  addLeg(1, rightHip, rightKnee, rightAnkle);

  root.scale.setScalar(1.12);
  return { root, pelvis, spine, chest, neck, head, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftEye, rightEye, materials, geometries };
}

export function poseGtaAvatar(r: GtaAvatarRig, time: number, motion: AvatarMotion, powerAmount = 0) {
  const walking = motion === 'walk' || motion === 'run';
  const running = motion === 'run';
  const gait = time * (running ? 10.8 : 6.6);
  const stride = walking ? (running ? .72 : .44) : 0;
  const swing = Math.sin(gait) * stride;
  const bounce = walking ? Math.abs(Math.sin(gait)) * (running ? .028 : .014) : Math.sin(time * 1.6) * .004;

  r.pelvis.position.y = 1.92 + bounce;
  r.pelvis.rotation.y = walking ? Math.sin(gait) * .04 : Math.sin(time * .42) * .012;
  r.spine.rotation.y = walking ? -Math.sin(gait) * .035 : Math.sin(time * .5) * .008;
  r.chest.rotation.y = walking ? -Math.sin(gait) * .05 : Math.sin(time * .55) * .012;
  r.chest.rotation.z = walking ? Math.sin(gait) * .018 : Math.sin(time * .72) * .006;
  r.chest.rotation.x = Math.sin(time * 1.6) * .008;
  r.neck.rotation.y = walking ? 0 : Math.sin(time * .45) * .025;
  r.head.rotation.y = walking ? THREE.MathUtils.lerp(r.head.rotation.y, 0, .08) : Math.sin(time * .42) * .08;
  r.head.rotation.x = walking ? -.012 : Math.sin(time * .7) * .014;

  r.leftHip.rotation.x = swing;
  r.rightHip.rotation.x = -swing;
  r.leftKnee.rotation.x = walking ? Math.max(0, -Math.sin(gait)) * (running ? .92 : .58) : .012;
  r.rightKnee.rotation.x = walking ? Math.max(0, Math.sin(gait)) * (running ? .92 : .58) : .012;
  r.leftAnkle.rotation.x = -r.leftKnee.rotation.x * .42 + (walking ? Math.sin(gait) * .08 : 0);
  r.rightAnkle.rotation.x = -r.rightKnee.rotation.x * .42 - (walking ? Math.sin(gait) * .08 : 0);

  r.leftShoulder.rotation.x = -swing * .78;
  r.rightShoulder.rotation.x = swing * .78;
  r.leftShoulder.rotation.z = .025;
  r.rightShoulder.rotation.z = -.025;
  r.leftElbow.rotation.x = walking ? -.14 - Math.max(0, -swing) * .25 : -.08;
  r.rightElbow.rotation.x = walking ? -.14 - Math.max(0, swing) * .25 : -.08;
  r.leftWrist.rotation.z = walking ? Math.sin(gait) * .06 : Math.sin(time * .9) * .02;
  r.rightWrist.rotation.z = walking ? -Math.sin(gait) * .06 : -Math.sin(time * .9) * .02;

  if (motion === 'jump') {
    r.leftHip.rotation.x = -.18;
    r.rightHip.rotation.x = -.18;
    r.leftKnee.rotation.x = .35;
    r.rightKnee.rotation.x = .35;
    r.leftShoulder.rotation.x = -.18;
    r.rightShoulder.rotation.x = -.18;
  }

  if (motion === 'power' || powerAmount > 0) {
    const p = Math.min(1, Math.max(powerAmount, motion === 'power' ? 1 : 0));
    r.leftShoulder.rotation.z = THREE.MathUtils.lerp(r.leftShoulder.rotation.z, 1.15, p);
    r.rightShoulder.rotation.z = THREE.MathUtils.lerp(r.rightShoulder.rotation.z, -1.15, p);
    r.leftElbow.rotation.x = -.55 * p;
    r.rightElbow.rotation.x = -.55 * p;
    r.chest.rotation.x = -.08 * p;
    r.head.rotation.x = -.05 * p;
  }

  const blink = Math.sin(time * 3.1) > .991 ? .18 : 1;
  r.leftEye.scale.y = blink;
  r.rightEye.scale.y = blink;
}

export function disposeGtaAvatar(r: GtaAvatarRig) {
  r.geometries.forEach(g => g.dispose());
  r.materials.forEach(m => m.dispose());
}

export function qualityProfile() {
  const cores = navigator.hardwareConcurrency || 4;
  const high = cores >= 6;
  const dpr = Math.min(window.devicePixelRatio || 1, high ? 2.5 : 1.8);
  const shadowSize = high ? 2048 : 1024;
  return { high, dpr, shadowSize };
}

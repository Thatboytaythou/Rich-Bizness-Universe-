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

const BASE_PELVIS_Y = 1.47;
const mat = <T extends THREE.Material>(m: T, bucket: THREE.Material[]) => { bucket.push(m); return m; };
const geo = <T extends THREE.BufferGeometry>(g: T, bucket: THREE.BufferGeometry[]) => { bucket.push(g); return g; };

function mesh(g: THREE.BufferGeometry, m: THREE.Material) {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
}

function capsule(r: number, l: number, m: THREE.Material, bucket: THREE.BufferGeometry[]) {
  return mesh(geo(new THREE.CapsuleGeometry(r, l, 12, 28), bucket), m);
}

function ellipsoid(rx: number, ry: number, rz: number, m: THREE.Material, bucket: THREE.BufferGeometry[]) {
  const x = mesh(geo(new THREE.SphereGeometry(1, 36, 28), bucket), m);
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
    color: female ? 0xa97256 : 0x956247,
    roughness: .56,
    metalness: 0,
    clearcoat: .035,
    clearcoatRoughness: .78
  }), materials);
  const outer = mat(new THREE.MeshPhysicalMaterial({
    color: style === 'boss' ? 0x151917 : accent,
    roughness: style === 'cyber' ? .3 : .48,
    metalness: style === 'cyber' ? .22 : .025,
    clearcoat: style === 'cyber' ? .3 : .08
  }), materials);
  const undershirt = mat(new THREE.MeshStandardMaterial({ color: 0xe9ece8, roughness: .82 }), materials);
  const pants = mat(new THREE.MeshStandardMaterial({ color: style === 'boss' ? 0x101211 : 0x171b19, roughness: .8 }), materials);
  const shoes = mat(new THREE.MeshPhysicalMaterial({ color: 0x0c0e0d, roughness: .44, metalness: .08, clearcoat: .14 }), materials);
  const hair = mat(new THREE.MeshStandardMaterial({ color: 0x111211, roughness: .82 }), materials);
  const white = mat(new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: .56 }), materials);
  const iris = mat(new THREE.MeshStandardMaterial({ color: 0x27160f, roughness: .5 }), materials);
  const brow = mat(new THREE.MeshStandardMaterial({ color: 0x1c130f, roughness: .74 }), materials);
  const lips = mat(new THREE.MeshStandardMaterial({ color: female ? 0x73414a : 0x59342e, roughness: .66 }), materials);
  const belt = mat(new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: .58 }), materials);
  const metal = mat(new THREE.MeshPhysicalMaterial({ color: 0xc3a84d, roughness: .26, metalness: .72 }), materials);

  const width = build === 'lean' ? .94 : build === 'heroic' ? 1.06 : 1;
  const shoulderX = (female ? .34 : .385) * width;
  const hipX = female ? .17 : .16;
  const legScale = build === 'lean' ? 1.02 : build === 'heroic' ? .985 : 1;

  root.add(pelvis);
  pelvis.position.y = BASE_PELVIS_Y;

  const pelvisMesh = ellipsoid(female ? .30 : .285, .19, .215, pants, geometries);
  pelvis.add(pelvisMesh);
  const beltMesh = mesh(geo(new THREE.CylinderGeometry(.275, .275, .075, 28), geometries), belt);
  beltMesh.position.y = .16;
  beltMesh.scale.z = .78;
  pelvis.add(beltMesh);
  const buckle = mesh(geo(new THREE.BoxGeometry(.075, .05, .02), geometries), metal);
  buckle.position.set(0, .16, .219);
  pelvis.add(buckle);

  spine.position.y = .20;
  pelvis.add(spine);
  const abdomen = ellipsoid(.225 * width, .29, .175, undershirt, geometries);
  abdomen.position.y = .27;
  spine.add(abdomen);

  chest.position.y = .36;
  spine.add(chest);
  const torso = ellipsoid((female ? .295 : .34) * width, .39, .205, outer, geometries);
  torso.position.y = .30;
  chest.add(torso);
  const chestPanel = mesh(geo(new THREE.BoxGeometry(.235 * width, .36, .024), geometries), undershirt);
  chestPanel.position.set(0, .29, .203);
  chest.add(chestPanel);

  neck.position.y = .69;
  chest.add(neck);
  const neckMesh = mesh(geo(new THREE.CylinderGeometry(.085, .095, .17, 22), geometries), skin);
  neck.add(neckMesh);

  head.position.y = .22;
  neck.add(head);
  const skull = ellipsoid(.205, .245, .205, skin, geometries); skull.position.y = .08; head.add(skull);
  const jaw = ellipsoid(.17, .105, .165, skin, geometries); jaw.position.set(0, -.075, .015); head.add(jaw);
  const leftEar = ellipsoid(.03, .047, .023, skin, geometries); leftEar.position.set(-.205, .075, 0); head.add(leftEar);
  const rightEar = leftEar.clone(); rightEar.position.x = .205; head.add(rightEar);
  const hairCap = mesh(geo(new THREE.SphereGeometry(.214, 34, 20, 0, Math.PI * 2, 0, Math.PI * .52), geometries), hair);
  hairCap.position.y = .245; hairCap.scale.set(1.02, .48, 1.02); head.add(hairCap);
  if (female) {
    const pony = capsule(.038, .20, hair, geometries); pony.position.set(.07, .13, -.205); pony.rotation.z = .12; head.add(pony);
  }

  const leftEye = ellipsoid(.024, .018, .014, white, geometries); leftEye.position.set(-.068, .095, .197); head.add(leftEye);
  const rightEye = leftEye.clone(); rightEye.position.x = .068; head.add(rightEye);
  for (const x of [-.068, .068]) {
    const pupil = ellipsoid(.0095, .0095, .008, iris, geometries); pupil.position.set(x, .095, .211); head.add(pupil);
    const browMesh = mesh(geo(new THREE.BoxGeometry(.065, .011, .012), geometries), brow); browMesh.position.set(x, .15, .202); browMesh.rotation.z = x < 0 ? -.04 : .04; head.add(browMesh);
  }
  const nose = capsule(.0115, .042, skin, geometries); nose.rotation.x = Math.PI / 2; nose.position.set(0, .03, .21); head.add(nose);
  const mouth = mesh(geo(new THREE.BoxGeometry(.062, .01, .01), geometries), lips); mouth.position.set(0, -.065, .196); head.add(mouth);

  const addArm = (side: -1 | 1, shoulder: THREE.Group, elbow: THREE.Group, wrist: THREE.Group) => {
    shoulder.position.set(side * shoulderX, .52, 0);
    chest.add(shoulder);
    const sleeve = capsule(.075, .18, outer, geometries); sleeve.position.y = -.12; shoulder.add(sleeve);
    const upper = capsule(.057, .31, skin, geometries); upper.position.y = -.36; shoulder.add(upper);
    elbow.position.y = -.56; shoulder.add(elbow);
    elbow.add(ellipsoid(.061, .058, .058, skin, geometries));
    const fore = capsule(.052, .31, skin, geometries); fore.position.y = -.20; elbow.add(fore);
    wrist.position.y = -.40; elbow.add(wrist);
    const hand = ellipsoid(.061, .085, .038, skin, geometries); hand.position.y = -.065; wrist.add(hand);
    for (let i = 0; i < 4; i++) {
      const finger = capsule(.0065, .055, skin, geometries); finger.position.set((i - 1.5) * .015, -.125, .004); wrist.add(finger);
    }
  };
  addArm(-1, leftShoulder, leftElbow, leftWrist);
  addArm(1, rightShoulder, rightElbow, rightWrist);

  const addLeg = (side: -1 | 1, hip: THREE.Group, knee: THREE.Group, ankle: THREE.Group) => {
    hip.position.set(side * hipX, -.08, 0);
    pelvis.add(hip);
    const thigh = capsule(.083, .53 * legScale, pants, geometries); thigh.position.y = -.34 * legScale; hip.add(thigh);
    knee.position.y = -.67 * legScale; hip.add(knee);
    knee.add(ellipsoid(.079, .066, .074, pants, geometries));
    const shin = capsule(.072, .50 * legScale, pants, geometries); shin.position.y = -.32 * legScale; knee.add(shin);
    ankle.position.y = -.63 * legScale; knee.add(ankle);
    const foot = mesh(geo(new THREE.BoxGeometry(.18, .11, .34), geometries), shoes); foot.position.set(0, -.055, .105); foot.rotation.x = -.025; ankle.add(foot);
    const sole = mesh(geo(new THREE.BoxGeometry(.184, .026, .345), geometries), shoes); sole.position.set(0, -.115, .105); ankle.add(sole);
  };
  addLeg(-1, leftHip, leftKnee, leftAnkle);
  addLeg(1, rightHip, rightKnee, rightAnkle);

  root.scale.setScalar(1.02);
  return { root, pelvis, spine, chest, neck, head, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftEye, rightEye, materials, geometries };
}

export function poseGtaAvatar(r: GtaAvatarRig, time: number, motion: AvatarMotion, powerAmount = 0) {
  const walking = motion === 'walk' || motion === 'run';
  const running = motion === 'run';
  const gait = time * (running ? 10.2 : 6.4);
  const stride = walking ? (running ? .58 : .36) : 0;
  const swing = Math.sin(gait) * stride;
  const bounce = walking ? Math.abs(Math.sin(gait)) * (running ? .022 : .011) : Math.sin(time * 1.55) * .0035;

  r.pelvis.position.y = BASE_PELVIS_Y + bounce;
  r.pelvis.rotation.y = walking ? Math.sin(gait) * .035 : Math.sin(time * .42) * .01;
  r.pelvis.rotation.z = walking ? Math.sin(gait) * .012 : 0;
  r.spine.rotation.y = walking ? -Math.sin(gait) * .03 : Math.sin(time * .5) * .008;
  r.chest.rotation.y = walking ? -Math.sin(gait) * .042 : Math.sin(time * .55) * .01;
  r.chest.rotation.z = walking ? Math.sin(gait) * .014 : Math.sin(time * .72) * .005;
  r.chest.rotation.x = Math.sin(time * 1.55) * .006;
  r.neck.rotation.y = walking ? 0 : Math.sin(time * .45) * .02;
  r.head.rotation.y = walking ? THREE.MathUtils.lerp(r.head.rotation.y, 0, .1) : Math.sin(time * .42) * .07;
  r.head.rotation.x = walking ? -.01 : Math.sin(time * .7) * .012;

  r.leftHip.rotation.x = swing;
  r.rightHip.rotation.x = -swing;
  r.leftKnee.rotation.x = walking ? Math.max(0, -Math.sin(gait)) * (running ? .78 : .48) : .01;
  r.rightKnee.rotation.x = walking ? Math.max(0, Math.sin(gait)) * (running ? .78 : .48) : .01;
  r.leftAnkle.rotation.x = -r.leftKnee.rotation.x * .40 + (walking ? Math.sin(gait) * .055 : 0);
  r.rightAnkle.rotation.x = -r.rightKnee.rotation.x * .40 - (walking ? Math.sin(gait) * .055 : 0);

  r.leftShoulder.rotation.x = -swing * .68;
  r.rightShoulder.rotation.x = swing * .68;
  r.leftShoulder.rotation.z = .018;
  r.rightShoulder.rotation.z = -.018;
  r.leftElbow.rotation.x = walking ? -.11 - Math.max(0, -swing) * .20 : -.06;
  r.rightElbow.rotation.x = walking ? -.11 - Math.max(0, swing) * .20 : -.06;
  r.leftWrist.rotation.z = walking ? Math.sin(gait) * .045 : Math.sin(time * .9) * .015;
  r.rightWrist.rotation.z = walking ? -Math.sin(gait) * .045 : -Math.sin(time * .9) * .015;

  if (motion === 'jump') {
    r.leftHip.rotation.x = -.16;
    r.rightHip.rotation.x = -.16;
    r.leftKnee.rotation.x = .30;
    r.rightKnee.rotation.x = .30;
    r.leftShoulder.rotation.x = -.14;
    r.rightShoulder.rotation.x = -.14;
  }

  if (motion === 'power' || powerAmount > 0) {
    const p = Math.min(1, Math.max(powerAmount, motion === 'power' ? 1 : 0));
    r.leftShoulder.rotation.z = THREE.MathUtils.lerp(r.leftShoulder.rotation.z, .9, p);
    r.rightShoulder.rotation.z = THREE.MathUtils.lerp(r.rightShoulder.rotation.z, -.9, p);
    r.leftElbow.rotation.x = -.42 * p;
    r.rightElbow.rotation.x = -.42 * p;
    r.chest.rotation.x = -.055 * p;
    r.head.rotation.x = -.035 * p;
  }

  const blink = Math.sin(time * 3.1) > .992 ? .2 : 1;
  r.leftEye.scale.y = blink;
  r.rightEye.scale.y = blink;
}

export function disposeGtaAvatar(r: GtaAvatarRig) {
  r.geometries.forEach(g => g.dispose());
  r.materials.forEach(m => m.dispose());
}

export function qualityProfile() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4);
  const high = cores >= 6 && memory >= 4;
  const dpr = Math.min(window.devicePixelRatio || 1, high ? 2.4 : 1.75);
  const shadowSize = high ? 2048 : 1024;
  return { high, dpr, shadowSize };
}

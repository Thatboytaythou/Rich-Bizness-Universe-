import * as THREE from 'three';

export type HumanRig = {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
};

type Palette = { primary: number; secondary: number; skin: number };

const material = (color: number, metalness = .08, roughness = .58) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const value = new THREE.Mesh(geometry, mat);
  value.position.set(...position);
  value.scale.set(...scale);
  value.rotation.set(...rotation);
  value.castShadow = true;
  value.receiveShadow = true;
  parent.add(value);
  return value;
};

const limb = (
  parent: THREE.Object3D,
  position: [number, number, number],
  length: number,
  radius: number,
  mat: THREE.Material,
  taper = .82
) => {
  const pivot = new THREE.Group();
  pivot.position.set(...position);
  parent.add(pivot);
  addMesh(
    pivot,
    new THREE.CapsuleGeometry(radius * taper, Math.max(.08, length - radius * 2), 8, 18),
    mat,
    [0, -length / 2, 0],
    [1, 1, 1]
  );
  return pivot;
};

export function createHumanRig(palette: Palette, female = false): HumanRig {
  const root = new THREE.Group();
  root.position.y = .05;

  const skin = material(palette.skin, 0, .72);
  const skinDark = material(Math.max(0, palette.skin - 0x15100d), 0, .76);
  const tee = material(0x101512, .12, .48);
  const jacket = material(palette.primary, .32, .34);
  const jacketDark = material(0x0b1510, .2, .42);
  const denim = material(0x182334, .18, .48);
  const shoe = material(0x050706, .42, .28);
  const sole = material(0xe8ece6, .04, .35);
  const gold = material(palette.secondary, .9, .16);
  const black = material(0x030403, .35, .3);
  const white = material(0xf6f4eb, 0, .25);

  const pelvis = new THREE.Group();
  pelvis.position.y = 2.18;
  root.add(pelvis);
  addMesh(pelvis, new THREE.BoxGeometry(.82, .34, .42), denim, [0, 0, 0], [female ? .9 : 1, 1, 1]);
  addMesh(pelvis, new THREE.CylinderGeometry(.36, .42, .42, 24), denim, [0, .16, 0], [female ? .9 : 1, 1, .82]);
  addMesh(pelvis, new THREE.BoxGeometry(.66, .07, .46), gold, [0, .33, .01]);

  const spine = new THREE.Group();
  spine.position.y = .28;
  pelvis.add(spine);
  addMesh(spine, new THREE.CylinderGeometry(.30, .37, .70, 24), tee, [0, .35, 0], [female ? .91 : 1, 1, .7]);

  const chest = new THREE.Group();
  chest.position.y = .62;
  spine.add(chest);
  addMesh(chest, new THREE.CylinderGeometry(female ? .43 : .50, .31, .82, 28), tee, [0, .40, 0], [1, 1, .70]);
  addMesh(chest, new THREE.BoxGeometry(female ? .92 : 1.08, .62, .18), jacket, [0, .38, .30]);
  addMesh(chest, new THREE.BoxGeometry(female ? .94 : 1.12, .18, .50), jacketDark, [0, .68, 0]);
  addMesh(chest, new THREE.BoxGeometry(.10, .61, .035), gold, [0, .39, .405]);
  addMesh(chest, new THREE.BoxGeometry(.24, .16, .04), gold, [-.27, .48, .41]);

  addMesh(chest, new THREE.CylinderGeometry(.11, .135, .20, 18), skin, [0, .94, 0]);
  const head = new THREE.Group();
  head.position.y = .98;
  chest.add(head);
  addMesh(head, new THREE.SphereGeometry(.31, 34, 26), skin, [0, .27, 0], [.92, 1.08, .88]);
  addMesh(head, new THREE.BoxGeometry(.45, .31, .36), skin, [0, .06, .015], [.92, 1, .92]);
  addMesh(head, new THREE.SphereGeometry(.125, 20, 14), skinDark, [0, .10, .255], [.62, .58, .42]);
  addMesh(head, new THREE.BoxGeometry(.30, .055, .045), black, [0, -.09, .32]);
  addMesh(head, new THREE.SphereGeometry(.030, 14, 10), white, [-.105, .245, .285]);
  addMesh(head, new THREE.SphereGeometry(.030, 14, 10), white, [.105, .245, .285]);
  addMesh(head, new THREE.SphereGeometry(.014, 10, 8), black, [-.105, .245, .31]);
  addMesh(head, new THREE.SphereGeometry(.014, 10, 8), black, [.105, .245, .31]);
  addMesh(head, new THREE.BoxGeometry(.20, .035, .035), black, [-.11, .315, .32], [1, 1, 1], [0, 0, -.08]);
  addMesh(head, new THREE.BoxGeometry(.20, .035, .035), black, [.11, .315, .32], [1, 1, 1], [0, 0, .08]);
  addMesh(head, new THREE.SphereGeometry(.34, 28, 18), black, [0, .47, -.015], [1, .48, .94]);
  addMesh(head, new THREE.CylinderGeometry(.34, .34, .09, 28), black, [0, .40, 0]);
  addMesh(head, new THREE.BoxGeometry(.42, .055, .16), black, [0, .39, .25]);
  addMesh(head, new THREE.SphereGeometry(.07, 16, 10), skin, [-.30, .20, 0], [.45, .82, .5]);
  addMesh(head, new THREE.SphereGeometry(.07, 16, 10), skin, [.30, .20, 0], [.45, .82, .5]);

  const shoulderY = .66;
  const shoulderX = female ? .54 : .62;
  const leftArm = limb(chest, [-shoulderX, shoulderY, 0], .69, .135, jacket, .88);
  const rightArm = limb(chest, [shoulderX, shoulderY, 0], .69, .135, jacket, .88);
  leftArm.rotation.z = .10;
  rightArm.rotation.z = -.10;
  leftArm.rotation.x = -.04;
  rightArm.rotation.x = -.04;
  const leftForearm = limb(leftArm, [0, -.67, 0], .61, .105, skin, .82);
  const rightForearm = limb(rightArm, [0, -.67, 0], .61, .105, skin, .82);
  addMesh(leftForearm, new THREE.BoxGeometry(.18, .23, .12), skin, [0, -.67, .01], [1, 1.1, 1]);
  addMesh(rightForearm, new THREE.BoxGeometry(.18, .23, .12), skin, [0, -.67, .01], [1, 1.1, 1]);
  addMesh(leftForearm, new THREE.TorusGeometry(.095, .022, 8, 24), gold, [0, -.48, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);

  const hipX = female ? .21 : .235;
  const leftLeg = limb(pelvis, [-hipX, -.06, 0], .91, .17, denim, .82);
  const rightLeg = limb(pelvis, [hipX, -.06, 0], .91, .17, denim, .82);
  const leftKnee = limb(leftLeg, [0, -.88, 0], .83, .135, denim, .78);
  const rightKnee = limb(rightLeg, [0, -.88, 0], .83, .135, denim, .78);
  addMesh(leftKnee, new THREE.BoxGeometry(.29, .18, .58), shoe, [0, -.86, .15], [1, 1, 1.15]);
  addMesh(rightKnee, new THREE.BoxGeometry(.29, .18, .58), shoe, [0, -.86, .15], [1, 1, 1.15]);
  addMesh(leftKnee, new THREE.BoxGeometry(.30, .055, .62), sole, [0, -.96, .17]);
  addMesh(rightKnee, new THREE.BoxGeometry(.30, .055, .62), sole, [0, -.96, .17]);

  addMesh(chest, new THREE.TorusGeometry(.24, .021, 10, 48), gold, [0, .50, .37]);
  addMesh(chest, new THREE.BoxGeometry(.075, .20, .04), gold, [0, .28, .39]);

  return { root, pelvis, spine, chest, head, leftArm, rightArm, leftForearm, rightForearm, leftLeg, rightLeg, leftKnee, rightKnee };
}

export function animateHumanRig(rig: HumanRig, time: number, moving: boolean, sprinting: boolean, action: string) {
  const speed = sprinting ? 12 : 7;
  const amplitude = sprinting ? .68 : .40;
  const stride = moving ? Math.sin(time * speed) * amplitude : 0;
  const opposite = moving ? Math.sin(time * speed + Math.PI) * amplitude : 0;
  const idle = Math.sin(time * 1.45);

  rig.leftArm.rotation.x = opposite * .68 - .04;
  rig.rightArm.rotation.x = stride * .68 - .04;
  rig.leftLeg.rotation.x = stride;
  rig.rightLeg.rotation.x = opposite;
  rig.leftKnee.rotation.x = moving ? Math.max(0, -stride) * .72 : 0;
  rig.rightKnee.rotation.x = moving ? Math.max(0, -opposite) * .72 : 0;
  rig.leftForearm.rotation.x = moving ? Math.max(0, stride) * .20 : -.04;
  rig.rightForearm.rotation.x = moving ? Math.max(0, opposite) * .20 : -.04;

  rig.leftArm.rotation.z = action === 'combat' ? -.72 : .10;
  rig.rightArm.rotation.z = action === 'combat' ? .72 : -.10;
  if (action === 'combat') {
    rig.leftForearm.rotation.x = -1.20;
    rig.rightForearm.rotation.x = -1.20;
  }
  rig.spine.rotation.y = action === 'dance' ? Math.sin(time * 6) * .24 : action === 'combat' ? Math.sin(time * 8) * .08 : 0;
  rig.spine.rotation.z = moving ? Math.sin(time * speed) * .022 : idle * .007;
  rig.chest.rotation.x = sprinting && moving ? -.08 : idle * .005;
  rig.head.rotation.y = Math.sin(time * .72) * .05;
  rig.head.rotation.x = action === 'power' ? -.08 : idle * .006;
  rig.pelvis.position.y = 2.18 + (moving ? Math.abs(Math.sin(time * speed)) * .035 : idle * .012);
  rig.root.rotation.y = action === 'dance' ? Math.sin(time * 3) * .10 : 0;
  rig.root.scale.setScalar(action === 'power' ? 1 + Math.sin(time * 18) * .012 : 1);
}
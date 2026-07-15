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

const mat = (color: number, metalness = .08, roughness = .62) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

const mesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const value = new THREE.Mesh(geometry, material);
  value.position.set(...position);
  value.scale.set(...scale);
  value.rotation.set(...rotation);
  value.castShadow = true;
  value.receiveShadow = true;
  parent.add(value);
  return value;
};

const jointedLimb = (
  parent: THREE.Object3D,
  position: [number, number, number],
  length: number,
  topRadius: number,
  bottomRadius: number,
  material: THREE.Material
) => {
  const pivot = new THREE.Group();
  pivot.position.set(...position);
  parent.add(pivot);
  mesh(
    pivot,
    new THREE.CylinderGeometry(topRadius, bottomRadius, length, 18, 2),
    material,
    [0, -length / 2, 0]
  );
  return pivot;
};

export function createHumanRig(palette: Palette, female = false): HumanRig {
  const root = new THREE.Group();
  root.position.y = .04;

  const skin = mat(palette.skin, 0, .78);
  const shirt = mat(0x121a16, .18, .5);
  const jacket = mat(palette.primary, .28, .38);
  const pants = mat(0x18212b, .15, .55);
  const shoe = mat(0x070908, .35, .35);
  const gold = mat(palette.secondary, .82, .18);
  const dark = mat(0x050606, .25, .42);
  const white = mat(0xf4f3ea, 0, .3);

  const pelvis = new THREE.Group();
  pelvis.position.y = 2.2;
  root.add(pelvis);
  mesh(pelvis, new THREE.BoxGeometry(.92, .38, .48), pants, [0, 0, 0], [female ? .88 : 1, 1, 1]);
  mesh(pelvis, new THREE.CylinderGeometry(.43, .47, .34, 18), pants, [0, .18, 0], [female ? .88 : 1, 1, .82]);

  const spine = new THREE.Group();
  spine.position.y = .28;
  pelvis.add(spine);
  mesh(spine, new THREE.CylinderGeometry(.34, .41, .7, 20), shirt, [0, .35, 0], [female ? .9 : 1, 1, .72]);

  const chest = new THREE.Group();
  chest.position.y = .66;
  spine.add(chest);
  mesh(chest, new THREE.CylinderGeometry(female ? .46 : .55, .34, .86, 24), shirt, [0, .42, 0], [1, 1, .72]);
  mesh(chest, new THREE.BoxGeometry(female ? 1.02 : 1.22, .25, .54), jacket, [0, .68, 0]);
  mesh(chest, new THREE.BoxGeometry(female ? .9 : 1.08, .72, .12), jacket, [0, .38, .31]);

  mesh(chest, new THREE.CylinderGeometry(.12, .15, .2, 16), skin, [0, .96, 0]);
  const head = new THREE.Group();
  head.position.y = 1.02;
  chest.add(head);
  mesh(head, new THREE.SphereGeometry(.34, 30, 22), skin, [0, .24, 0], [.9, 1.08, .86]);
  mesh(head, new THREE.BoxGeometry(.5, .34, .42), skin, [0, .04, .02], [.9, 1, .9]);
  mesh(head, new THREE.SphereGeometry(.15, 18, 12), skin, [0, .08, .28], [.7, .7, .48]);
  mesh(head, new THREE.BoxGeometry(.36, .08, .06), dark, [0, -.09, .36]);
  mesh(head, new THREE.SphereGeometry(.032, 12, 8), white, [-.115, .24, .32]);
  mesh(head, new THREE.SphereGeometry(.032, 12, 8), white, [.115, .24, .32]);
  mesh(head, new THREE.SphereGeometry(.016, 10, 8), dark, [-.115, .24, .347]);
  mesh(head, new THREE.SphereGeometry(.016, 10, 8), dark, [.115, .24, .347]);
  mesh(head, new THREE.SphereGeometry(.08, 16, 10), skin, [-.33, .2, 0], [.45, .8, .5]);
  mesh(head, new THREE.SphereGeometry(.08, 16, 10), skin, [.33, .2, 0], [.45, .8, .5]);
  mesh(head, new THREE.SphereGeometry(.37, 24, 16), dark, [0, .43, -.02], [1, .48, .92]);
  mesh(head, new THREE.BoxGeometry(.58, .09, .08), dark, [0, .25, .35]);

  const shoulderY = .67;
  const leftArm = jointedLimb(chest, [-.66, shoulderY, 0], .68, .145, .125, jacket);
  const rightArm = jointedLimb(chest, [.66, shoulderY, 0], .68, .145, .125, jacket);
  leftArm.rotation.z = .08;
  rightArm.rotation.z = -.08;

  const leftForearm = jointedLimb(leftArm, [0, -.68, 0], .62, .12, .095, skin);
  const rightForearm = jointedLimb(rightArm, [0, -.68, 0], .62, .12, .095, skin);
  mesh(leftForearm, new THREE.BoxGeometry(.2, .25, .13), skin, [0, -.72, .01], [1, 1.15, 1]);
  mesh(rightForearm, new THREE.BoxGeometry(.2, .25, .13), skin, [0, -.72, .01], [1, 1.15, 1]);

  const leftLeg = jointedLimb(pelvis, [-.25, -.08, 0], .9, .2, .16, pants);
  const rightLeg = jointedLimb(pelvis, [.25, -.08, 0], .9, .2, .16, pants);
  const leftKnee = jointedLimb(leftLeg, [0, -.9, 0], .84, .16, .125, pants);
  const rightKnee = jointedLimb(rightLeg, [0, -.9, 0], .84, .16, .125, pants);
  mesh(leftKnee, new THREE.BoxGeometry(.34, .18, .62), shoe, [0, -.89, .17], [1, 1, 1.12]);
  mesh(rightKnee, new THREE.BoxGeometry(.34, .18, .62), shoe, [0, -.89, .17], [1, 1, 1.12]);

  mesh(chest, new THREE.TorusGeometry(.27, .024, 10, 48), gold, [0, .51, .36]);
  mesh(chest, new THREE.BoxGeometry(.08, .24, .045), gold, [0, .27, .39]);

  return { root, pelvis, spine, chest, head, leftArm, rightArm, leftForearm, rightForearm, leftLeg, rightLeg, leftKnee, rightKnee };
}

export function animateHumanRig(rig: HumanRig, time: number, moving: boolean, sprinting: boolean, action: string) {
  const speed = sprinting ? 12 : 7;
  const amplitude = sprinting ? .72 : .42;
  const stride = moving ? Math.sin(time * speed) * amplitude : Math.sin(time * 1.6) * .025;
  const counter = moving ? Math.sin(time * speed + Math.PI) * amplitude : 0;

  rig.leftArm.rotation.x = counter * .72;
  rig.rightArm.rotation.x = stride * .72;
  rig.leftLeg.rotation.x = stride;
  rig.rightLeg.rotation.x = counter;
  rig.leftKnee.rotation.x = moving ? Math.max(0, -stride) * .65 : 0;
  rig.rightKnee.rotation.x = moving ? Math.max(0, -counter) * .65 : 0;
  rig.leftForearm.rotation.x = moving ? Math.max(0, stride) * .18 : 0;
  rig.rightForearm.rotation.x = moving ? Math.max(0, counter) * .18 : 0;

  rig.leftArm.rotation.z = action === 'combat' ? -.82 : .08;
  rig.rightArm.rotation.z = action === 'combat' ? .82 : -.08;
  rig.leftForearm.rotation.x = action === 'combat' ? -1.18 : rig.leftForearm.rotation.x;
  rig.rightForearm.rotation.x = action === 'combat' ? -1.18 : rig.rightForearm.rotation.x;
  rig.spine.rotation.y = action === 'dance' ? Math.sin(time * 6) * .22 : action === 'combat' ? Math.sin(time * 8) * .09 : 0;
  rig.spine.rotation.z = moving ? Math.sin(time * speed) * .025 : 0;
  rig.head.rotation.y = Math.sin(time * .72) * .045;
  rig.pelvis.position.y = 2.2 + (moving ? Math.abs(Math.sin(time * speed)) * .035 : Math.sin(time * 1.4) * .012);
  rig.root.scale.setScalar(action === 'power' ? 1 + Math.sin(time * 18) * .012 : 1);
}

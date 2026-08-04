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
  aura: THREE.Group;
  chain: THREE.Group;
};

type Palette = { primary: number; secondary: number; skin: number };

const mat = (color: number, metalness = .08, roughness = .62, emissive = 0x000000, emissiveIntensity = 0) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });

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
  mesh(pivot, new THREE.CylinderGeometry(topRadius, bottomRadius, length, 20, 3), material, [0, -length / 2, 0]);
  return pivot;
};

export function createHumanRig(palette: Palette, female = false): HumanRig {
  const root = new THREE.Group();
  root.position.y = .04;

  const skin = mat(palette.skin, 0, .76);
  const shirt = mat(0x101813, .18, .48);
  const jacket = mat(palette.primary, .34, .3, palette.primary, .07);
  const pants = mat(0x17212a, .22, .5);
  const shoe = mat(0x050706, .42, .28);
  const gold = mat(palette.secondary, .9, .12, palette.secondary, .08);
  const dark = mat(0x040505, .3, .38);
  const white = mat(0xf5f4ee, 0, .26);
  const auraMaterial = new THREE.MeshBasicMaterial({ color: palette.primary, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending });

  const pelvis = new THREE.Group();
  pelvis.position.y = 2.22;
  root.add(pelvis);
  mesh(pelvis, new THREE.BoxGeometry(.92, .4, .5), pants, [0, 0, 0], [female ? .88 : 1, 1, 1]);
  mesh(pelvis, new THREE.CylinderGeometry(.43, .49, .36, 20), pants, [0, .19, 0], [female ? .9 : 1, 1, .84]);

  const spine = new THREE.Group();
  spine.position.y = .3;
  pelvis.add(spine);
  mesh(spine, new THREE.CylinderGeometry(.34, .42, .72, 24), shirt, [0, .36, 0], [female ? .91 : 1, 1, .74]);

  const chest = new THREE.Group();
  chest.position.y = .68;
  spine.add(chest);
  mesh(chest, new THREE.CylinderGeometry(female ? .47 : .57, .35, .9, 28), shirt, [0, .44, 0], [1, 1, .74]);
  mesh(chest, new THREE.BoxGeometry(female ? 1.04 : 1.24, .28, .58), jacket, [0, .72, 0]);
  mesh(chest, new THREE.BoxGeometry(female ? .92 : 1.1, .76, .13), jacket, [0, .4, .32]);
  mesh(chest, new THREE.BoxGeometry(.18, .6, .16), dark, [0, .4, -.28]);

  mesh(chest, new THREE.CylinderGeometry(.12, .15, .22, 18), skin, [0, 1, 0]);
  const head = new THREE.Group();
  head.position.y = 1.05;
  chest.add(head);
  mesh(head, new THREE.SphereGeometry(.35, 34, 24), skin, [0, .25, 0], [.91, 1.08, .88]);
  mesh(head, new THREE.BoxGeometry(.51, .35, .43), skin, [0, .04, .02], [.91, 1, .92]);
  mesh(head, new THREE.SphereGeometry(.155, 20, 14), skin, [0, .08, .29], [.72, .72, .5]);
  mesh(head, new THREE.BoxGeometry(.37, .075, .055), dark, [0, -.095, .37]);
  mesh(head, new THREE.SphereGeometry(.034, 14, 10), white, [-.118, .24, .33]);
  mesh(head, new THREE.SphereGeometry(.034, 14, 10), white, [.118, .24, .33]);
  mesh(head, new THREE.SphereGeometry(.017, 12, 10), dark, [-.118, .24, .357]);
  mesh(head, new THREE.SphereGeometry(.017, 12, 10), dark, [.118, .24, .357]);
  mesh(head, new THREE.SphereGeometry(.08, 18, 12), skin, [-.34, .2, 0], [.45, .8, .5]);
  mesh(head, new THREE.SphereGeometry(.08, 18, 12), skin, [.34, .2, 0], [.45, .8, .5]);
  mesh(head, new THREE.SphereGeometry(.38, 28, 18), dark, [0, .45, -.03], [1, .5, .94]);
  mesh(head, new THREE.BoxGeometry(.59, .095, .085), dark, [0, .255, .36]);

  const shoulderY = .7;
  const leftArm = jointedLimb(chest, [-.68, shoulderY, 0], .7, .15, .128, jacket);
  const rightArm = jointedLimb(chest, [.68, shoulderY, 0], .7, .15, .128, jacket);
  leftArm.rotation.z = .08;
  rightArm.rotation.z = -.08;

  const leftForearm = jointedLimb(leftArm, [0, -.7, 0], .64, .125, .1, skin);
  const rightForearm = jointedLimb(rightArm, [0, -.7, 0], .64, .125, .1, skin);
  mesh(leftForearm, new THREE.BoxGeometry(.21, .26, .14), skin, [0, -.74, .01], [1, 1.18, 1]);
  mesh(rightForearm, new THREE.BoxGeometry(.21, .26, .14), skin, [0, -.74, .01], [1, 1.18, 1]);

  const leftLeg = jointedLimb(pelvis, [-.255, -.08, 0], .92, .205, .165, pants);
  const rightLeg = jointedLimb(pelvis, [.255, -.08, 0], .92, .205, .165, pants);
  const leftKnee = jointedLimb(leftLeg, [0, -.92, 0], .86, .165, .128, pants);
  const rightKnee = jointedLimb(rightLeg, [0, -.92, 0], .86, .165, .128, pants);
  mesh(leftKnee, new THREE.BoxGeometry(.35, .19, .64), shoe, [0, -.91, .18], [1, 1, 1.14]);
  mesh(rightKnee, new THREE.BoxGeometry(.35, .19, .64), shoe, [0, -.91, .18], [1, 1, 1.14]);

  const chain = new THREE.Group();
  chain.position.set(0, .54, .37);
  chest.add(chain);
  mesh(chain, new THREE.TorusGeometry(.28, .024, 12, 56), gold, [0, 0, 0]);
  mesh(chain, new THREE.BoxGeometry(.09, .25, .05), gold, [0, -.24, .02]);
  mesh(chain, new THREE.OctahedronGeometry(.105, 0), gold, [0, -.39, .02], [1, 1.25, .5]);

  const aura = new THREE.Group();
  root.add(aura);
  mesh(aura, new THREE.TorusGeometry(.95, .025, 12, 80), auraMaterial, [0, .08, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  mesh(aura, new THREE.TorusGeometry(.72, .018, 12, 72), auraMaterial.clone(), [0, .12, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);

  return { root, pelvis, spine, chest, head, leftArm, rightArm, leftForearm, rightForearm, leftLeg, rightLeg, leftKnee, rightKnee, aura, chain };
}

export function animateHumanRig(rig: HumanRig, time: number, moving: boolean, sprinting: boolean, action: string) {
  const speed = sprinting ? 12.5 : 7.2;
  const amplitude = sprinting ? .76 : .44;
  const stride = moving ? Math.sin(time * speed) * amplitude : Math.sin(time * 1.6) * .028;
  const counter = moving ? Math.sin(time * speed + Math.PI) * amplitude : 0;

  rig.leftArm.rotation.x = counter * .74;
  rig.rightArm.rotation.x = stride * .74;
  rig.leftLeg.rotation.x = stride;
  rig.rightLeg.rotation.x = counter;
  rig.leftKnee.rotation.x = moving ? Math.max(0, -stride) * .68 : 0;
  rig.rightKnee.rotation.x = moving ? Math.max(0, -counter) * .68 : 0;
  rig.leftForearm.rotation.x = moving ? Math.max(0, stride) * .2 : 0;
  rig.rightForearm.rotation.x = moving ? Math.max(0, counter) * .2 : 0;

  rig.leftArm.rotation.z = action === 'combat' ? -.86 : .08;
  rig.rightArm.rotation.z = action === 'combat' ? .86 : -.08;
  rig.leftForearm.rotation.x = action === 'combat' ? -1.22 : rig.leftForearm.rotation.x;
  rig.rightForearm.rotation.x = action === 'combat' ? -1.22 : rig.rightForearm.rotation.x;
  rig.spine.rotation.y = action === 'dance' ? Math.sin(time * 6) * .25 : action === 'combat' ? Math.sin(time * 8) * .1 : action === 'smoke' ? Math.sin(time * 2.2) * .06 : 0;
  rig.spine.rotation.z = moving ? Math.sin(time * speed) * .03 : Math.sin(time * .9) * .01;
  rig.head.rotation.y = action === 'smoke' ? -.18 + Math.sin(time * .8) * .04 : Math.sin(time * .72) * .05;
  rig.head.rotation.x = action === 'power' ? -.09 : Math.sin(time * .5) * .018;
  rig.pelvis.position.y = 2.22 + (moving ? Math.abs(Math.sin(time * speed)) * .04 : Math.sin(time * 1.4) * .014);
  const powerScale = action === 'power' ? 1 + Math.sin(time * 18) * .018 : 1;
  rig.root.scale.setScalar(powerScale);
  rig.aura.rotation.y = time * .42;
  rig.aura.rotation.z = Math.sin(time * .7) * .05;
  rig.aura.scale.setScalar(action === 'power' ? 1.18 + Math.sin(time * 10) * .08 : 1 + Math.sin(time * 2) * .015);
  rig.chain.rotation.z = moving ? Math.sin(time * speed) * .04 : Math.sin(time * 1.2) * .015;
}
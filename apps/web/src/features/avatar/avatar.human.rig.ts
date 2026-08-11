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
  leftHand: THREE.Group;
  rightHand: THREE.Group;
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
  mesh(pivot, new THREE.CapsuleGeometry((topRadius + bottomRadius) * .5, Math.max(.05, length - topRadius - bottomRadius), 6, 18), material, [0, -length / 2, 0]);
  return pivot;
};

const makeHand = (parent: THREE.Object3D, x: number, material: THREE.Material) => {
  const hand = new THREE.Group();
  hand.position.set(0, -.72, .01);
  parent.add(hand);
  mesh(hand, new THREE.SphereGeometry(.11, 18, 14), material, [0, 0, 0], [1, 1.22, .82]);
  for (let i = -2; i <= 2; i++) mesh(hand, new THREE.CapsuleGeometry(.018, .075, 4, 8), material, [i * .036, -.095, .018], [.9, 1, .9], [0, 0, i * -.03 * x]);
  return hand;
};

export function createHumanRig(palette: Palette, female = false): HumanRig {
  const root = new THREE.Group();
  root.position.y = .04;

  const skin = mat(palette.skin, .02, .72);
  const skinSoft = mat(palette.skin, .01, .82);
  const shirt = mat(0x0d1511, .22, .42);
  const jacket = mat(palette.primary, .42, .26, palette.primary, .09);
  const jacketDark = mat(0x071009, .38, .3, palette.primary, .02);
  const pants = mat(0x111820, .32, .44);
  const shoe = mat(0x030504, .68, .2);
  const gold = mat(palette.secondary, .92, .12, palette.secondary, .12);
  const dark = mat(0x020303, .34, .32);
  const white = mat(0xf7f5ef, 0, .24);
  const auraMaterial = new THREE.MeshBasicMaterial({ color: palette.primary, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending });

  const pelvis = new THREE.Group();
  pelvis.position.y = 2.26;
  root.add(pelvis);
  mesh(pelvis, new THREE.CapsuleGeometry(female ? .36 : .4, .28, 6, 20), pants, [0, .02, 0], [female ? .96 : 1.08, 1, .82]);

  const spine = new THREE.Group();
  spine.position.y = .34;
  pelvis.add(spine);
  mesh(spine, new THREE.CapsuleGeometry(.32, .52, 6, 22), shirt, [0, .36, 0], [female ? .94 : 1.02, 1, .76]);

  const chest = new THREE.Group();
  chest.position.y = .66;
  spine.add(chest);
  mesh(chest, new THREE.CapsuleGeometry(female ? .4 : .47, .56, 7, 26), shirt, [0, .42, 0], [1, 1, .76]);
  mesh(chest, new THREE.BoxGeometry(female ? .9 : 1.08, .55, .1), jacket, [0, .48, .34]);
  mesh(chest, new THREE.BoxGeometry(female ? .98 : 1.18, .22, .52), jacketDark, [0, .78, 0]);
  mesh(chest, new THREE.BoxGeometry(.16, .56, .14), gold, [0, .46, .365], [.18, 1, 1]);

  mesh(chest, new THREE.CapsuleGeometry(.11, .1, 5, 16), skinSoft, [0, 1.0, 0]);
  const head = new THREE.Group();
  head.position.y = 1.08;
  chest.add(head);
  mesh(head, new THREE.SphereGeometry(.345, 40, 30), skin, [0, .24, 0], [.9, 1.08, .9]);
  mesh(head, new THREE.SphereGeometry(.285, 36, 24), skinSoft, [0, .02, .012], [1, .86, .9]);
  mesh(head, new THREE.CapsuleGeometry(.06, .09, 4, 14), skinSoft, [0, .1, .295], [.72, .74, .55], [Math.PI / 2, 0, 0]);
  mesh(head, new THREE.SphereGeometry(.032, 16, 12), white, [-.112, .235, .316]);
  mesh(head, new THREE.SphereGeometry(.032, 16, 12), white, [.112, .235, .316]);
  mesh(head, new THREE.SphereGeometry(.014, 12, 10), dark, [-.112, .235, .342]);
  mesh(head, new THREE.SphereGeometry(.014, 12, 10), dark, [.112, .235, .342]);
  mesh(head, new THREE.BoxGeometry(.17, .022, .024), dark, [-.112, .305, .332], [1, 1, 1], [0, 0, -.05]);
  mesh(head, new THREE.BoxGeometry(.17, .022, .024), dark, [.112, .305, .332], [1, 1, 1], [0, 0, .05]);
  mesh(head, new THREE.BoxGeometry(.26, .03, .03), dark, [0, -.11, .342]);
  mesh(head, new THREE.SphereGeometry(.07, 18, 12), skin, [-.33, .18, 0], [.4, .82, .5]);
  mesh(head, new THREE.SphereGeometry(.07, 18, 12), skin, [.33, .18, 0], [.4, .82, .5]);
  mesh(head, new THREE.SphereGeometry(.38, 34, 22), dark, [0, .43, -.04], [1, .5, .94]);

  const shoulderY = .72;
  const leftArm = jointedLimb(chest, [-.66, shoulderY, 0], .72, .15, .125, jacket);
  const rightArm = jointedLimb(chest, [.66, shoulderY, 0], .72, .15, .125, jacket);
  leftArm.rotation.z = .08;
  rightArm.rotation.z = -.08;
  const leftForearm = jointedLimb(leftArm, [0, -.69, 0], .62, .12, .095, skin);
  const rightForearm = jointedLimb(rightArm, [0, -.69, 0], .62, .12, .095, skin);
  const leftHand = makeHand(leftForearm, -1, skinSoft);
  const rightHand = makeHand(rightForearm, 1, skinSoft);

  const hipX = female ? .23 : .27;
  const leftLeg = jointedLimb(pelvis, [-hipX, -.05, 0], .94, .2, .16, pants);
  const rightLeg = jointedLimb(pelvis, [hipX, -.05, 0], .94, .2, .16, pants);
  const leftKnee = jointedLimb(leftLeg, [0, -.92, 0], .88, .16, .12, pants);
  const rightKnee = jointedLimb(rightLeg, [0, -.92, 0], .88, .16, .12, pants);
  mesh(leftKnee, new THREE.BoxGeometry(.32, .18, .68), shoe, [0, -.91, .19], [1, 1, 1.18]);
  mesh(rightKnee, new THREE.BoxGeometry(.32, .18, .68), shoe, [0, -.91, .19], [1, 1, 1.18]);
  mesh(leftKnee, new THREE.BoxGeometry(.25, .06, .3), gold, [0, -.86, .5], [.55, .4, .22]);
  mesh(rightKnee, new THREE.BoxGeometry(.25, .06, .3), gold, [0, -.86, .5], [.55, .4, .22]);

  const chain = new THREE.Group();
  chain.position.set(0, .56, .39);
  chest.add(chain);
  mesh(chain, new THREE.TorusGeometry(.27, .02, 12, 64), gold, [0, 0, 0]);
  mesh(chain, new THREE.BoxGeometry(.07, .22, .04), gold, [0, -.22, .02]);
  mesh(chain, new THREE.OctahedronGeometry(.1, 1), gold, [0, -.36, .02], [1, 1.18, .45]);

  const aura = new THREE.Group();
  root.add(aura);
  mesh(aura, new THREE.TorusGeometry(.98, .026, 14, 96), auraMaterial, [0, .08, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  mesh(aura, new THREE.TorusGeometry(.72, .018, 12, 84), auraMaterial.clone(), [0, .15, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  mesh(aura, new THREE.TorusKnotGeometry(.56, .012, 84, 10, 2, 3), auraMaterial.clone(), [0, 2.8, -.1], [1, .5, 1]);

  return { root, pelvis, spine, chest, head, leftArm, rightArm, leftForearm, rightForearm, leftLeg, rightLeg, leftKnee, rightKnee, leftHand, rightHand, aura, chain };
}

export function animateHumanRig(rig: HumanRig, time: number, moving: boolean, sprinting: boolean, action: string) {
  const speed = sprinting ? 13.8 : 7.8;
  const amplitude = sprinting ? .82 : .48;
  const phase = time * speed;
  const stride = moving ? Math.sin(phase) * amplitude : 0;
  const counter = moving ? Math.sin(phase + Math.PI) * amplitude : 0;
  const breath = Math.sin(time * 1.55);

  rig.leftArm.rotation.x = moving ? counter * .7 : -.04 + breath * .018;
  rig.rightArm.rotation.x = moving ? stride * .7 : .04 - breath * .018;
  rig.leftLeg.rotation.x = stride;
  rig.rightLeg.rotation.x = counter;
  rig.leftKnee.rotation.x = moving ? Math.max(0, -stride) * .76 : .02 + Math.max(0, breath) * .015;
  rig.rightKnee.rotation.x = moving ? Math.max(0, -counter) * .76 : -.02 + Math.max(0, -breath) * .015;
  rig.leftForearm.rotation.x = moving ? Math.max(0, stride) * .22 : -.08;
  rig.rightForearm.rotation.x = moving ? Math.max(0, counter) * .22 : -.08;
  rig.leftHand.rotation.z = Math.sin(time * 2.1) * .02;
  rig.rightHand.rotation.z = -Math.sin(time * 2.1) * .02;

  if (action === 'combat') {
    rig.leftArm.rotation.z = -.92;
    rig.rightArm.rotation.z = .92;
    rig.leftForearm.rotation.x = -1.28;
    rig.rightForearm.rotation.x = -1.16;
    rig.chest.rotation.y = Math.sin(time * 8.5) * .08;
  } else if (action === 'power') {
    rig.leftArm.rotation.z = -.56;
    rig.rightArm.rotation.z = .56;
    rig.leftForearm.rotation.x = -.3;
    rig.rightForearm.rotation.x = -.3;
    rig.chest.rotation.x = -.035;
  } else if (action === 'dance') {
    rig.leftArm.rotation.z = -.35 + Math.sin(time * 5.2) * .22;
    rig.rightArm.rotation.z = .35 - Math.sin(time * 5.2) * .22;
    rig.chest.rotation.y = Math.sin(time * 5.8) * .28;
  } else if (action === 'smoke') {
    rig.rightArm.rotation.z = -.12;
    rig.rightForearm.rotation.x = -1.52;
    rig.rightForearm.rotation.z = -.24;
    rig.head.rotation.y = -.15 + Math.sin(time * .8) * .04;
  } else {
    rig.leftArm.rotation.z = .08;
    rig.rightArm.rotation.z = -.08;
    rig.chest.rotation.y *= .86;
    rig.chest.rotation.x *= .86;
  }

  rig.spine.rotation.y = action === 'dance' ? Math.sin(time * 6) * .2 : action === 'combat' ? Math.sin(time * 8) * .07 : action === 'smoke' ? Math.sin(time * 2.2) * .045 : Math.sin(time * .65) * .014;
  rig.spine.rotation.z = moving ? Math.sin(phase) * .028 : Math.sin(time * .9) * .008;
  if (action !== 'smoke') rig.head.rotation.y = Math.sin(time * .72) * .045;
  rig.head.rotation.x = action === 'power' ? -.08 : Math.sin(time * .5) * .012;
  rig.pelvis.position.y = 2.26 + (moving ? Math.abs(Math.sin(phase)) * .035 : breath * .01);
  rig.pelvis.rotation.y = moving ? Math.sin(phase) * .025 : 0;
  rig.chest.position.y = breath * .008;

  const powerScale = action === 'power' ? 1.025 + Math.sin(time * 16) * .014 : 1;
  rig.root.scale.setScalar(powerScale);
  rig.aura.rotation.y = time * .5;
  rig.aura.rotation.z = Math.sin(time * .7) * .04;
  rig.aura.scale.setScalar(action === 'power' ? 1.22 + Math.sin(time * 10) * .09 : 1 + Math.sin(time * 2) * .012);
  rig.chain.rotation.z = moving ? Math.sin(phase) * .035 : Math.sin(time * 1.2) * .012;
  rig.chain.rotation.x = moving ? Math.abs(Math.sin(phase)) * .025 : 0;
}
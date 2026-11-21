import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type AvatarGender = 'boy' | 'girl';
export type AvatarMotion = 'idle' | 'walk' | 'run' | 'jump' | 'power';

export type SkinnedAvatarRuntime = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  clips: THREE.AnimationClip[];
  bounds: THREE.Box3;
  height: number;
  currentMotion: AvatarMotion;
  currentAction: THREE.AnimationAction | null;
};

const MOTION_HINTS: Record<AvatarMotion, string[]> = {
  idle: ['idle', 'survey', 'stand', 'breath'],
  walk: ['walk', 'walking'],
  run: ['run', 'running', 'sprint'],
  jump: ['jump', 'air', 'land'],
  power: ['power', 'attack', 'dance', 'pose', 'action']
};

const REQUIRED_HUMANOID_BONES = [
  'hips', 'pelvis', 'spine', 'chest', 'neck', 'head',
  'leftupleg', 'leftleg', 'leftfoot', 'rightupleg', 'rightleg', 'rightfoot',
  'leftarm', 'leftforearm', 'lefthand', 'rightarm', 'rightforearm', 'righthand'
];

const normalizeBoneName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function getSkeleton(root: THREE.Object3D): THREE.Bone[] {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((object) => {
    const skinned = object as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    for (const bone of skinned.skeleton?.bones ?? []) bones.set(normalizeBoneName(bone.name), bone);
  });
  return [...bones.values()];
}

function assertProductionHumanoid(root: THREE.Group): THREE.Bone[] {
  let skinnedMeshes = 0;
  root.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
  });

  const bones = getSkeleton(root);
  if (skinnedMeshes < 1) throw new Error('Avatar asset rejected: no skinned humanoid mesh found.');
  if (bones.length < 18) throw new Error(`Avatar asset rejected: incomplete humanoid skeleton (${bones.length} unique bones).`);

  const names = new Set(bones.map((bone) => normalizeBoneName(bone.name)));
  const missing = REQUIRED_HUMANOID_BONES.filter((required) => ![...names].some((name) =>
    name === required || name.endsWith(required) || required.endsWith(name)
  ));
  if (missing.length) {
    throw new Error(`Avatar asset rejected: missing canonical humanoid bones (${missing.join(', ')}).`);
  }
  return bones;
}

function assertAnimationPack(clips: THREE.AnimationClip[]): void {
  if (!clips.length) throw new Error('Avatar animation pack rejected: no animation clips found.');
  const names = clips.map((clip) => clip.name.trim().toLowerCase());
  for (const required of ['idle', 'walk', 'run']) {
    if (!names.some((name) => name.includes(required))) {
      throw new Error(`Avatar animation pack rejected: required ${required} clip is missing.`);
    }
  }
}

function prepareModel(root: THREE.Group, targetHeight = 1.82): { bounds: THREE.Box3; height: number } {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if ('envMapIntensity' in material) (material as THREE.MeshStandardMaterial).envMapIntensity = 0.9;
      material.needsUpdate = true;
    }
  });

  const initial = new THREE.Box3().setFromObject(root);
  const initialSize = initial.getSize(new THREE.Vector3());
  const safeHeight = Math.max(initialSize.y, 0.001);
  if (!Number.isFinite(safeHeight) || safeHeight <= 0.01) throw new Error('Avatar asset rejected: invalid body bounds.');

  const scale = targetHeight / safeHeight;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const scaled = new THREE.Box3().setFromObject(root);
  const center = scaled.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.getSize(new THREE.Vector3()).y;
  const groundError = Math.abs(bounds.min.y);
  if (!Number.isFinite(height) || Math.abs(height - targetHeight) > 0.04) {
    throw new Error(`Avatar asset rejected: normalized height ${height.toFixed(3)}m is outside tolerance.`);
  }
  if (groundError > 0.025) throw new Error(`Avatar asset rejected: feet are ${groundError.toFixed(3)}m off ground.`);
  return { bounds, height };
}

export function resolveAvatarModelUrl(snapshot: Record<string, any> | null | undefined, _gender: AvatarGender): string {
  const candidate = String(snapshot?.model?.model_url ?? '').trim();
  const metadata = snapshot?.model?.metadata ?? {};
  const modelKey = String(snapshot?.model?.model_key ?? '');
  const isTemporaryDemo = metadata?.production_art_ready === false ||
    metadata?.role === 'temporary-reference-skinned-model' ||
    modelKey === 'rb-skinned-boy-v1' ||
    modelKey === 'rb-skinned-girl-v1';
  const isApprovedModel = Boolean(snapshot?.model?.is_active) &&
    snapshot?.model?.is_realistic === true &&
    snapshot?.model?.rig_type === 'skinned-humanoid' &&
    !isTemporaryDemo &&
    /^https:\/\//i.test(candidate);
  if (!isApprovedModel) {
    throw new Error('No production Rich Bizness character model is assigned yet. The temporary demo models are disabled.');
  }
  return candidate;
}

export async function loadSkinnedAvatar(options: {
  modelUrl: string;
  animationUrl?: string | null;
  targetHeight?: number;
  signal?: AbortSignal;
}): Promise<SkinnedAvatarRuntime> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(options.modelUrl);
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const root = gltf.scene;
  root.name = 'rb-skinned-avatar';
  const bodyBones = assertProductionHumanoid(root);
  let clips = [...gltf.animations];

  if (options.animationUrl) {
    const animationGltf = await loader.loadAsync(options.animationUrl);
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const animationBones = new Set(getSkeleton(animationGltf.scene).map((bone) => normalizeBoneName(bone.name)));
    const incompatible = bodyBones.map((bone) => normalizeBoneName(bone.name)).filter((name) => !animationBones.has(name));
    if (incompatible.length) {
      throw new Error(`Avatar animation pack rejected: skeleton mismatch (${incompatible.slice(0, 6).join(', ')}).`);
    }
    clips = [...clips, ...animationGltf.animations];
  }

  assertAnimationPack(clips);
  const { bounds, height } = prepareModel(root, options.targetHeight ?? 1.82);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of clips) {
    const key = clip.name.trim().toLowerCase();
    if (actions.has(key)) continue;
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.clampWhenFinished = false;
    actions.set(key, action);
  }

  const runtime: SkinnedAvatarRuntime = {
    root,
    mixer,
    actions,
    clips,
    bounds,
    height,
    currentMotion: 'idle',
    currentAction: null
  };
  setAvatarMotion(runtime, 'idle', 0);
  return runtime;
}

export function setAvatarMotion(runtime: SkinnedAvatarRuntime, motion: AvatarMotion, fadeSeconds = 0.18): void {
  if (runtime.currentMotion === motion && runtime.currentAction?.isRunning()) return;
  const hints = MOTION_HINTS[motion];
  let next: THREE.AnimationAction | null = null;
  for (const hint of hints) {
    const hit = [...runtime.actions.entries()].find(([name]) => name.includes(hint));
    if (hit) { next = hit[1]; break; }
  }
  if (!next && (motion === 'jump' || motion === 'power')) next = runtime.actions.get('idle') ?? null;
  if (!next && motion === 'run') next = runtime.actions.get('walk') ?? null;
  if (!next) return;

  const previous = runtime.currentAction;
  next.reset();
  next.enabled = true;
  next.setEffectiveTimeScale(motion === 'run' ? 1.12 : 1);
  next.setEffectiveWeight(1);
  if (motion === 'jump' || motion === 'power') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.play();
  if (previous && previous !== next) previous.crossFadeTo(next, Math.max(0.01, fadeSeconds), true);
  runtime.currentAction = next;
  runtime.currentMotion = motion;
}

export function updateSkinnedAvatar(runtime: SkinnedAvatarRuntime, deltaSeconds: number): void {
  runtime.mixer.update(Math.min(Math.max(deltaSeconds, 0), 0.05));
}

export function refreshAvatarBounds(runtime: SkinnedAvatarRuntime): THREE.Box3 {
  runtime.root.updateMatrixWorld(true);
  runtime.bounds.setFromObject(runtime.root);
  runtime.height = runtime.bounds.getSize(new THREE.Vector3()).y;
  return runtime.bounds;
}

export function disposeSkinnedAvatar(runtime: SkinnedAvatarRuntime): void {
  runtime.mixer.stopAllAction();
  runtime.mixer.uncacheRoot(runtime.root);
  runtime.root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if ((value as THREE.Texture | undefined)?.isTexture) (value as THREE.Texture).dispose();
      }
      material.dispose();
    }
  });
}

export function qualityProfile() {
  const dpr = window.devicePixelRatio || 1;
  return {
    high: false,
    dpr: Math.min(dpr, 1.65),
    shadowSize: dpr > 1.5 ? 1280 : 1024
  };
}

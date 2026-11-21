import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { supabase } from '../../core/supabase/client';

export type AvatarGender = 'boy' | 'girl';
export type AvatarMotion = 'idle' | 'walk' | 'run' | 'jump' | 'power';
export type AvatarAssetDescriptor = {
  format?: string;
  mesh_path?: string;
  thumbnail_path?: string;
  rig_key?: string;
  slot?: string;
  body_types?: string[];
  render_order?: number;
  [key: string]: unknown;
};
export type SkinnedAvatarRuntime = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  clips: THREE.AnimationClip[];
  bones: Map<string, THREE.Bone>;
  wearableMeshes: Map<string, THREE.Object3D>;
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
  power: ['power_pose', 'power', 'attack', 'dance', 'pose', 'action']
};
const REQUIRED_HUMANOID_BONES = [
  ['hips', 'pelvis'], ['spine'], ['chest', 'spine2', 'upperchest'], ['neck'], ['head'],
  ['leftupleg', 'leftupperleg', 'thighl'], ['leftleg', 'leftlowerleg', 'calfl'], ['leftfoot', 'footl'],
  ['rightupleg', 'rightupperleg', 'thighr'], ['rightleg', 'rightlowerleg', 'calfr'], ['rightfoot', 'footr'],
  ['leftarm', 'leftupperarm', 'upperarml'], ['leftforearm', 'leftlowerarm', 'forearml'], ['lefthand', 'handl'],
  ['rightarm', 'rightupperarm', 'upperarmr'], ['rightforearm', 'rightlowerarm', 'forearmr'], ['righthand', 'handr']
] as const;

export const normalizeAvatarBoneName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function getSkeleton(root: THREE.Object3D): THREE.Bone[] {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((object) => {
    const skinned = object as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    for (const bone of skinned.skeleton?.bones ?? []) {
      const key = normalizeAvatarBoneName(bone.name);
      if (key && !bones.has(key)) bones.set(key, bone);
    }
  });
  return [...bones.values()];
}

function getBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  return new Map(getSkeleton(root).map((bone) => [normalizeAvatarBoneName(bone.name), bone]));
}

function assertProductionHumanoid(root: THREE.Group): { bones: THREE.Bone[]; boneMap: Map<string, THREE.Bone> } {
  let skinnedMeshes = 0;
  root.traverse((object) => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1; });
  const bones = getSkeleton(root);
  if (skinnedMeshes < 1) throw new Error('Avatar asset rejected: no skinned humanoid mesh found.');
  const boneMap = getBoneMap(root);
  const missing = REQUIRED_HUMANOID_BONES.filter((aliases) => !aliases.some((name) => boneMap.has(name))).map((aliases) => aliases[0]);
  if (missing.length) throw new Error('Avatar asset rejected: missing canonical humanoid bones (' + missing.join(', ') + ').');
  return { bones, boneMap };
}

function assertAnimationPack(clips: THREE.AnimationClip[]): void {
  if (!clips.length) throw new Error('Avatar animation pack rejected: no animation clips found.');
  const names = clips.map((clip) => clip.name.trim().toLowerCase());
  for (const required of ['idle', 'walk', 'run']) {
    if (!names.some((name) => name.includes(required))) throw new Error('Avatar animation pack rejected: required ' + required + ' clip is missing.');
  }
  if (clips.some((clip) => !Number.isFinite(clip.duration) || clip.duration <= 0)) throw new Error('Avatar animation pack rejected: invalid clip duration.');
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
  root.scale.multiplyScalar(targetHeight / safeHeight);
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  const center = scaled.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.getSize(new THREE.Vector3()).y;
  if (!Number.isFinite(height) || Math.abs(height - targetHeight) > 0.04) throw new Error('Avatar asset rejected: normalized height ' + height.toFixed(3) + 'm is outside tolerance.');
  if (Math.abs(bounds.min.y) > 0.025) throw new Error('Avatar asset rejected: feet are off ground.');
  return { bounds, height };
}

function isHttpUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function isApprovedAvatarModel(model: Record<string, any> | null | undefined): boolean {
  const metadata = model?.metadata ?? {};
  const modelKey = String(model?.model_key ?? '');
  return Boolean(model?.is_active) && model?.is_realistic === true &&
    model?.rig_type === 'skinned-humanoid' && metadata?.production_art_ready === true &&
    metadata?.role !== 'temporary-reference-skinned-model' && !modelKey.startsWith('rb-skinned-');
}

export async function resolveAvatarAssetUrl(bucket: string, pathOrUrl: string, signal?: AbortSignal, expiresIn = 3600): Promise<string> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const candidate = String(pathOrUrl ?? '').trim();
  if (!candidate) throw new Error('Avatar asset path is missing.');
  if (isHttpUrl(candidate)) return candidate;
  const normalized = candidate.replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => part === '..')) throw new Error('Avatar asset path is invalid.');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalized, expiresIn);
  if (error || !data?.signedUrl) throw new Error('Private avatar asset could not be opened: ' + (error?.message ?? 'signed URL unavailable'));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return data.signedUrl;
}

export async function resolveAvatarModelUrl(snapshot: Record<string, any> | null | undefined, _gender: AvatarGender, signal?: AbortSignal): Promise<string> {
  const model = snapshot?.model ?? null;
  if (!isApprovedAvatarModel(model)) throw new Error('No production Rich Bizness character model is assigned yet. Temporary demo models are disabled.');
  const path = String(model?.metadata?.asset_path ?? model?.model_url ?? '').trim();
  if (!path) throw new Error('Production Rich Bizness model asset path is missing.');
  return resolveAvatarAssetUrl('game-assets', path, signal);
}

export async function resolveAvatarItemUrl(asset: AvatarAssetDescriptor, signal?: AbortSignal): Promise<string> {
  if (String(asset.format ?? 'glb').toLowerCase() !== 'glb') throw new Error('Unsupported avatar wearable format. Expected GLB.');
  if (!asset.mesh_path || !asset.rig_key) throw new Error('Avatar wearable asset metadata is incomplete.');
  return resolveAvatarAssetUrl('game-assets', asset.mesh_path, signal);
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if ((value as THREE.Texture | undefined)?.isTexture) (value as THREE.Texture).dispose();
      material.dispose();
    }
  });
}

export function attachSkinnedWearable(runtime: SkinnedAvatarRuntime, wearableRoot: THREE.Object3D, options: { itemKey: string; rigKey: string; expectedRigKey: string; renderOrder?: number }): void {
  if (options.rigKey !== options.expectedRigKey) throw new Error('Wearable rejected: incompatible avatar rig key.');
  let skinnedMeshes = 0;
  wearableRoot.traverse((object) => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1; });
  if (!skinnedMeshes) throw new Error('Wearable rejected: skinned mesh not found.');
  const bodyNames = new Set(runtime.bones.keys());
  const wearableBones = getSkeleton(wearableRoot);
  const missing = wearableBones.map((bone) => normalizeAvatarBoneName(bone.name)).filter((name) => !bodyNames.has(name));
  if (missing.length) throw new Error('Wearable rejected: incompatible skeleton bone(s): ' + missing.slice(0, 8).join(', '));

  const sources: THREE.SkinnedMesh[] = [];
  wearableRoot.traverse((object) => { const mesh = object as THREE.SkinnedMesh; if (mesh.isSkinnedMesh) sources.push(mesh); });
  for (const source of sources) {
    const normalizedBones = source.skeleton.bones.map((bone) => runtime.bones.get(normalizeAvatarBoneName(bone.name)));
    if (normalizedBones.some((bone) => !bone)) throw new Error('Wearable rejected: missing target skeleton joint.');
    const targetInverses = source.skeleton.bones.map((bone) => {
      const sourceInverse = source.skeleton.boneInverses[source.skeleton.bones.indexOf(bone)];
      const targetBone = runtime.bones.get(normalizeAvatarBoneName(bone.name))!;
      return sourceInverse.clone().multiply(targetBone.matrixWorld.clone().invert()).multiply(targetBone.matrixWorld);
    });
    source.bind(new THREE.Skeleton(normalizedBones as THREE.Bone[], targetInverses), source.bindMatrix.clone());
    source.normalizeSkinWeights();
    source.frustumCulled = false;
    if (options.renderOrder !== undefined) source.renderOrder = options.renderOrder;
  }
  wearableRoot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((material) => material.clone()) : mesh.material.clone();
  });
  const prior = runtime.wearableMeshes.get(options.itemKey);
  if (prior) { runtime.root.remove(prior); disposeObject(prior); }
  runtime.root.add(wearableRoot);
  runtime.wearableMeshes.set(options.itemKey, wearableRoot);
  runtime.root.updateMatrixWorld(true);
}

export function removeSkinnedWearable(runtime: SkinnedAvatarRuntime, itemKey: string): void {
  const wearable = runtime.wearableMeshes.get(itemKey);
  if (!wearable) return;
  runtime.root.remove(wearable);
  disposeObject(wearable);
  runtime.wearableMeshes.delete(itemKey);
  runtime.root.updateMatrixWorld(true);
}

export async function loadSkinnedWearable(options: { meshUrl: string; itemKey: string; signal?: AbortSignal }): Promise<THREE.Object3D> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const gltf = await new GLTFLoader().loadAsync(options.meshUrl);
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!gltf.scene.children.length) throw new Error('Wearable rejected: empty GLB scene.');
  gltf.scene.name = 'rb-wearable-' + options.itemKey;
  return gltf.scene;
}

export async function loadSkinnedAvatar(options: { modelUrl: string; animationUrl?: string | null; targetHeight?: number; signal?: AbortSignal }): Promise<SkinnedAvatarRuntime> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(options.modelUrl);
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const root = gltf.scene;
  root.name = 'rb-skinned-avatar';
  const { bones, boneMap } = assertProductionHumanoid(root);
  let clips = [...gltf.animations];
  if (options.animationUrl) {
    const animationGltf = await loader.loadAsync(options.animationUrl);
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const animationBones = new Set(getSkeleton(animationGltf.scene).map((bone) => normalizeAvatarBoneName(bone.name)));
    const incompatible = bones.map((bone) => normalizeAvatarBoneName(bone.name)).filter((name) => !animationBones.has(name));
    if (incompatible.length) throw new Error('Avatar animation pack rejected: skeleton mismatch (' + incompatible.slice(0, 6).join(', ') + ').');
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
    actions.set(key, action);
  }
  const runtime: SkinnedAvatarRuntime = { root, mixer, actions, clips, bones: boneMap, wearableMeshes: new Map(), bounds, height, currentMotion: 'idle', currentAction: null };
  setAvatarMotion(runtime, 'idle', 0);
  return runtime;
}

export function setAvatarMotion(runtime: SkinnedAvatarRuntime, motion: AvatarMotion, fadeSeconds = 0.18): void {
  if (runtime.currentMotion === motion && runtime.currentAction?.isRunning()) return;
  let next: THREE.AnimationAction | null = null;
  for (const hint of MOTION_HINTS[motion]) {
    const hit = [...runtime.actions.entries()].find(([name]) => name.includes(hint));
    if (hit) { next = hit[1]; break; }
  }
  if (!next && (motion === 'jump' || motion === 'power')) next = [...runtime.actions.entries()].find(([name]) => name.includes('idle'))?.[1] ?? null;
  if (!next && motion === 'run') next = [...runtime.actions.entries()].find(([name]) => name.includes('walk'))?.[1] ?? null;
  if (!next) return;
  const previous = runtime.currentAction;
  next.reset();
  next.enabled = true;
  next.setEffectiveTimeScale(motion === 'run' ? 1.12 : 1);
  next.setEffectiveWeight(1);
  if (motion === 'jump' || motion === 'power') { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
  else { next.setLoop(THREE.LoopRepeat, Infinity); next.clampWhenFinished = false; }
  next.play();
  if (previous && previous !== next) previous.crossFadeTo(next, Math.max(0.01, fadeSeconds), true);
  runtime.currentAction = next;
  runtime.currentMotion = motion;
}

export function updateSkinnedAvatar(runtime: SkinnedAvatarRuntime, deltaSeconds: number): void {
  runtime.mixer.update(Math.min(Math.max(deltaSeconds, 0), 0.05));
}

export function applyAvatarBodyShape(runtime: SkinnedAvatarRuntime, build: 'lean' | 'athletic' | 'heroic'): boolean {
  const target = 'body_' + build;
  let applied = false;
  runtime.root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) if (name.startsWith('body_')) mesh.morphTargetInfluences[index] = 0;
    const index = mesh.morphTargetDictionary[target];
    if (index !== undefined) { mesh.morphTargetInfluences[index] = 1; applied = true; }
  });
  runtime.root.updateMatrixWorld(true);
  return applied;
}

export function disposeSkinnedAvatar(runtime: SkinnedAvatarRuntime): void {
  for (const itemKey of [...runtime.wearableMeshes.keys()]) removeSkinnedWearable(runtime, itemKey);
  runtime.mixer.stopAllAction();
  runtime.mixer.uncacheRoot(runtime.root);
  disposeObject(runtime.root);
}

export function qualityProfile() {
  const dpr = window.devicePixelRatio || 1;
  return { high: false, dpr: Math.min(dpr, 1.65), shadowSize: dpr > 1.5 ? 1280 : 1024 };
}

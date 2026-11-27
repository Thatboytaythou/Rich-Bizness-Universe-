import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type AvatarGender = 'boy' | 'girl';
export type AvatarExpression = 'neutral'|'smile'|'focused'|'surprised'|'confident'|'laugh'|'sad'|'angry';
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
  expression?: (value: AvatarExpression, strength?:number) => void;
  animateFace?: (dt:number) => void;
  assetLabel?:string;
  accessoryWidth?:number;
  lookAt?:(target:THREE.Vector3|null)=>void;
  locomotionSpeed?: {walk:number;run:number};
  dispose?: () => void;
};

const DEFAULT_MODEL_URLS: Record<AvatarGender, string> = {
  boy: 'https://raw.githubusercontent.com/mrdoob/three.js/r184/examples/models/gltf/Soldier.glb',
  girl: 'https://raw.githubusercontent.com/mrdoob/three.js/r184/examples/models/gltf/Michelle.glb'
};

const MOTION_HINTS: Record<AvatarMotion, string[]> = {
  idle: ['idle', 'survey', 'stand', 'breath'],
  walk: ['walk', 'walking'],
  run: ['run', 'running', 'sprint'],
  jump: ['jump', 'air', 'land'],
  power: ['power', 'attack', 'dance', 'pose', 'action']
};

function actionForMotion(runtime: SkinnedAvatarRuntime, motion: AvatarMotion): THREE.AnimationAction | null {
  const exact=runtime.actions.get(motion);if(exact)return exact;
  const hints = MOTION_HINTS[motion];
  for (const hint of hints) {
    const hit = [...runtime.actions.entries()].find(([name]) => name.includes(hint));
    if (hit) return hit[1];
  }
  if (motion === 'jump' || motion === 'power') return actionForMotion(runtime, 'idle');
  if (motion === 'run') return actionForMotion(runtime, 'walk');
  return runtime.actions.values().next().value ?? null;
}

function assertProductionHumanoid(root: THREE.Group, clips: THREE.AnimationClip[]): void {
  let skinnedMeshes = 0;
  const bones = new Set<THREE.Bone>();

  root.traverse((object) => {
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      skinnedMeshes += 1;
      for (const bone of skinned.skeleton?.bones ?? []) bones.add(bone);
    }
  });

  if (skinnedMeshes < 1) throw new Error('Avatar asset rejected: no skinned humanoid mesh found.');
  if (bones.size < 8) throw new Error(`Avatar asset rejected: incomplete skeleton (${bones.size} bones).`);
  if (clips.length < 1) throw new Error('Avatar asset rejected: no skeletal animation clips found.');
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

export function resolveAvatarModelUrl(snapshot: Record<string, any> | null | undefined, gender: AvatarGender): string {
  const candidate = String(snapshot?.model?.model_url ?? '').trim();
  if (/^https:\/\//i.test(candidate)) return candidate;
  return DEFAULT_MODEL_URLS[gender];
}

export async function loadSkinnedAvatar(options: {
  modelUrl: string;
  targetHeight?: number;
  signal?: AbortSignal;
}): Promise<SkinnedAvatarRuntime> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const loader = new GLTFLoader();
  const gltf = options.signal ? await (async()=>{
    const response=await fetch(options.modelUrl,{signal:options.signal});
    if(!response.ok)throw new Error('Character asset HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
    return loader.parseAsync(bytes,new URL('.',response.url).href);
  })() : await loader.loadAsync(options.modelUrl);
  if(options.signal?.aborted){
    gltf.scene.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(!mesh.isMesh)return;
      mesh.geometry?.dispose();
      for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
        for(const value of Object.values(material))if((value as THREE.Texture|undefined)?.isTexture)(value as THREE.Texture).dispose();
        material.dispose();
      }
    });
    throw new DOMException('Aborted','AbortError');
  }

  const root = gltf.scene;
  root.name = 'rb-skinned-avatar';
  assertProductionHumanoid(root, gltf.animations);
  const { bounds, height } = prepareModel(root, options.targetHeight ?? 1.82);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of gltf.animations) {
    const key = clip.name.trim().toLowerCase();
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.clampWhenFinished = false;
    actions.set(key, action);
  }

  const runtime: SkinnedAvatarRuntime = {
    root,
    mixer,
    actions,
    clips: gltf.animations,
    bounds,
    height,
    currentMotion: 'idle',
    currentAction: null
  };
  setAvatarMotion(runtime, 'idle', 0);
  return runtime;
}

export function setAvatarMotion(runtime: SkinnedAvatarRuntime, motion: AvatarMotion, fadeSeconds = 0.18): void {
  const next = actionForMotion(runtime, motion);
  if (!next || (runtime.currentAction===next && runtime.currentMotion===motion && next.isRunning())) return;

  const previous = runtime.currentAction;
  const phase=(previous&&['walk','run'].includes(runtime.currentMotion)&&['walk','run'].includes(motion))?previous.time/previous.getClip().duration:0;
  next.reset();
  next.enabled = true;
  next.setEffectiveTimeScale(1);
  if(phase>0)next.time=(phase%1)*next.getClip().duration;
  next.setEffectiveWeight(1);
  if (motion === 'jump' || motion === 'power') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.play();
  if (previous && previous !== next) {
    if(fadeSeconds<=0)previous.stop();else previous.crossFadeTo(next, fadeSeconds, false);
  }
  runtime.currentAction = next;
  runtime.currentMotion = motion;
}

export function playAvatarGesture(runtime:SkinnedAvatarRuntime,name:string,speed=1,blend=.2):number{
  const next=runtime.actions.get(name);if(!next)return 0;const previous=runtime.currentAction;const rate=THREE.MathUtils.clamp(speed,.5,1.5);next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true;next.play();if(previous&&previous!==next)previous.crossFadeTo(next,THREE.MathUtils.clamp(blend,.05,.65),false);runtime.currentAction=next;runtime.currentMotion='power';return next.getClip().duration/rate;
}

export function updateSkinnedAvatar(runtime: SkinnedAvatarRuntime, deltaSeconds: number): void {
  const dt=Math.min(Math.max(deltaSeconds,0),0.075);runtime.mixer.update(dt);
  // Retire fully faded actions, preventing dormant skeletal tracks accumulating after movement or gesture changes.
  for(const action of runtime.actions.values()){if(action!==runtime.currentAction&&action.isScheduled()&&action.getEffectiveWeight()<=.0001)action.stop();}
  runtime.animateFace?.(dt);
}

export function refreshAvatarBounds(runtime: SkinnedAvatarRuntime): THREE.Box3 {
  runtime.root.updateMatrixWorld(true);
  runtime.bounds.setFromObject(runtime.root);
  runtime.height = runtime.bounds.getSize(new THREE.Vector3()).y;
  return runtime.bounds;
}

export function disposeSkinnedAvatar(runtime: SkinnedAvatarRuntime): void {
  if(runtime.dispose){runtime.dispose();return;}
  runtime.mixer.stopAllAction();runtime.mixer.uncacheRoot(runtime.root);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
  runtime.root.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    if(mesh.geometry)geometries.add(mesh.geometry);
    for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){
      materials.add(material);
      for(const value of Object.values(material))if((value as THREE.Texture|undefined)?.isTexture)textures.add(value as THREE.Texture);
    }
    if((mesh as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
  });
  for(const skeleton of skeletons)skeleton.dispose();
  for(const texture of textures)texture.dispose();
  for(const material of materials)material.dispose();
  for(const geometry of geometries)geometry.dispose();
}

export function qualityProfile() {
  const dpr = window.devicePixelRatio || 1;
  return {
    high: false,
    dpr: Math.min(dpr, 1.65),
    shadowSize: dpr > 1.5 ? 1280 : 1024
  };
}

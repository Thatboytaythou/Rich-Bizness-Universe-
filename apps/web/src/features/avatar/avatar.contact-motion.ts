import * as THREE from 'three';

// Stance moves backward at a constant rate relative to the body. Swing clears
// the ground and eases into the next heel contact. Units: meters and seconds.
export function strideSample(phase:number,stride:number,stance:number,lift:number){
  const p=((phase%1)+1)%1;
  if(p<stance)return {z:stride*(.5-p/stance),y:0};
  const u=(p-stance)/(1-stance),ease=u*u*(3-2*u);
  return {z:stride*(ease-.5),y:lift*Math.sin(Math.PI*u)};
}
const v=()=>new THREE.Vector3();
function aim(bone:THREE.Bone,child:THREE.Bone,target:THREE.Vector3){
  if(!bone.parent)return;
  const from=child.getWorldPosition(v()).sub(bone.getWorldPosition(v())).normalize();
  const to=target.clone().sub(bone.getWorldPosition(v())).normalize();
  if(from.lengthSq()<.5||to.lengthSq()<.5)return;
  const world=bone.getWorldQuaternion(new THREE.Quaternion());
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(new THREE.Quaternion().setFromUnitVectors(from,to).multiply(world)));
  bone.updateWorldMatrix(true,true);
}
// Bake a two-segment leg pose against a fixed ankle target. The knee bends
// toward the character's forward direction rather than an arbitrary Euler axis.
export function solveLeg(upper:THREE.Bone,lower:THREE.Bone,foot:THREE.Bone,target:THREE.Vector3,forward:THREE.Vector3,footRest:THREE.Quaternion){
  const hip=upper.getWorldPosition(v()),knee=lower.getWorldPosition(v()),ankle=foot.getWorldPosition(v());
  const a=hip.distanceTo(knee),b=knee.distanceTo(ankle);
  if(a<.04||b<.04)return;
  const axis=target.clone().sub(hip),raw=axis.length();
  if(raw<.001)return;
  axis.divideScalar(raw);
  const d=THREE.MathUtils.clamp(raw,Math.abs(a-b)+.002,a+b-.002);
  const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const pole=forward.clone().addScaledVector(axis,-forward.dot(axis));
  if(pole.lengthSq()<.001)pole.set(0,0,1).addScaledVector(axis,-axis.z);
  if(pole.lengthSq()<.001)return;
  pole.normalize();
  const kneeTarget=hip.clone().addScaledVector(axis,along).addScaledVector(pole,height);
  const ankleTarget=hip.clone().addScaledVector(axis,d);
  aim(upper,lower,kneeTarget);aim(lower,foot,ankleTarget);
  if(foot.parent){foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footRest));foot.updateWorldMatrix(true,true);}
}
export function bakeGroundedGait(root:THREE.Group,bones:THREE.Bone[],clip:THREE.AnimationClip,run:boolean){
  const get=(n:string)=>bones.find(b=>b.name.endsWith(':'+n));
  const hips=get('Hips');if(!hips)return {clip,speed:run?3.8:1.9};
  root.updateMatrixWorld(true);
  const sides=['Left','Right'].map(side=>({side,upper:get(side+'UpLeg'),lower:get(side+'Leg'),foot:get(side+'Foot'),toe:get(side+'ToeBase')})).filter(s=>s.upper&&s.lower&&s.foot);
  if(sides.length!==2)return {clip,speed:run?3.8:1.9};
  const rest=bones.map(b=>({bone:b,q:b.quaternion.clone(),p:b.position.clone()}));
  const refs=sides.map(s=>({...s,ankle:s.foot!.getWorldPosition(v()),rotation:s.foot!.getWorldQuaternion(new THREE.Quaternion()),length:s.upper!.getWorldPosition(v()).distanceTo(s.lower!.getWorldPosition(v()))+s.lower!.getWorldPosition(v()).distanceTo(s.foot!.getWorldPosition(v()))}));
  const length=Math.min(...refs.map(r=>r.length)),stride=length*(run?1.03:.82),stance=run?.47:.62,duration=clip.duration;
  const times=Array.from({length:49},(_,i)=>i*duration/48);
  const tracks=new Map<string,{track:THREE.KeyframeTrack;interp:THREE.Interpolant}>();
  clip.tracks.forEach(track=>tracks.set(track.name,{track,interp:track.createInterpolant()}));
  const output=new Map<string,number[]>();
  const affected=[hips,...refs.flatMap(r=>[r.upper!,r.lower!,r.foot!,...(r.toe?[r.toe]:[])])];
  affected.forEach(b=>output.set(b.uuid,[]));const hipPositions:number[]=[];
  try{
    for(const t of times){
      for(const r of rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);const q=tracks.get(r.bone.uuid+'.quaternion');if(q)r.bone.quaternion.fromArray(q.interp.evaluate(t));const p=tracks.get(r.bone.uuid+'.position');if(p)r.bone.position.fromArray(p.interp.evaluate(t));}
      const phase=t/duration;
      const down=v().set(0,-length*(run?.105:.065),0).applyQuaternion(hips.parent!.getWorldQuaternion(new THREE.Quaternion()).invert());
      hips.position.add(down);root.updateMatrixWorld(true);
      for(let i=0;i<refs.length;i++){
        const r=refs[i],step=strideSample(phase+i*.5,stride,stance,length*(run?.20:.085));
        const target=r.ankle.clone().add(new THREE.Vector3(0,step.y,step.z));
        solveLeg(r.upper!,r.lower!,r.foot!,target,new THREE.Vector3(0,0,1),r.rotation);
        if(r.toe){const neutral=rest.find(x=>x.bone===r.toe)!.q;r.toe.quaternion.copy(neutral);}
      }
      for(const b of affected)output.get(b.uuid)!.push(...b.quaternion.toArray());hipPositions.push(...hips.position.toArray());
    }
    const ids=new Set(affected.map(b=>b.uuid));
    const remaining=clip.tracks.filter(t=>!ids.has(t.name.split('.')[0]));
    for(const b of affected)remaining.push(new THREE.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,output.get(b.uuid)!));
    remaining.push(new THREE.VectorKeyframeTrack(hips.uuid+'.position',times,hipPositions));
    return {clip:new THREE.AnimationClip(clip.name,duration,remaining),speed:stride/(stance*duration)};
  }finally{for(const r of rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);}root.updateMatrixWorld(true);}
}

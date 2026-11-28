import * as THREE from 'three';
export type LimbSegment={joint:number;start:THREE.Vector3;end:THREE.Vector3;strength:number};
const norm=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^mixamorig/,'');
export function limbSegments(mesh:THREE.SkinnedMesh,look:{upperArm:string;forearm:string;thigh:string;calf:string},build:string){
 const bones=mesh.skeleton.bones,byName=new Map(bones.map((bone,i)=>[norm(bone.name),{bone,i}]));
 const segments:LimbSegment[]=[];mesh.updateWorldMatrix(true,false);
 for(const [side,abbr] of [['left','l'],['right','r']] as const){
  const find=(names:string[])=>names.map(n=>byName.get(n)).find(Boolean);
  const arm=find([side+'arm',side+'upperarm','upperarm'+abbr]);
  const fore=find([side+'forearm',side+'lowerarm','lowerarm'+abbr]);
  const hand=find([side+'hand','hand'+abbr]);
  const thigh=find([side+'upleg',side+'thigh',side+'upperleg','thigh'+abbr]);
  const calf=find([side+'leg',side+'lowerleg',side+'calf','calf'+abbr,'shin'+abbr]);
  const foot=find([side+'foot','foot'+abbr]);
  for(const [start,end,field] of [[arm,fore,'upperArm'],[fore,hand,'forearm'],[thigh,calf,'thigh'],[calf,foot,'calf']] as const){
   if(!start||!end)continue;const value=Number(look[field]);const strength=THREE.MathUtils.clamp((Number.isFinite(value)?value:0)/100+(build==='heroic'?.20:0),-1,1);
   if(Math.abs(strength)<1e-5)continue;
   const a=mesh.worldToLocal(start.bone.getWorldPosition(new THREE.Vector3())),b=mesh.worldToLocal(end.bone.getWorldPosition(new THREE.Vector3()));
   if(Number.isFinite(a.lengthSq()+b.lengthSq())&&a.distanceToSquared(b)>1e-6)segments.push({joint:start.i,start:a,end:b,strength});
  }
 }return segments;
}
// Original limb contour applied only to visible skin vertices controlled by the
// relevant limb bone. Taper before both joints; retain fitted topology, UVs,
// relative facial morph deltas and skin weights. No per-frame geometry updates.
export function sculptLimbRelief(g:THREE.BufferGeometry,selection:readonly number[],segments:readonly LimbSegment[]){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight');
 if(!p||!n||!si||!sw||p.count!==n.count||p.count!==si.count||p.count!==sw.count||si.itemSize!==4||sw.itemSize!==4||p.count>250000||(g.morphAttributes.position?.length&&!g.morphTargetsRelative)||selection.length>85000)return 0;
 const axes=new Map<number,{start:THREE.Vector3;axis:THREE.Vector3;length:number;strength:number}>();
 for(const s of segments){const axis=s.end.clone().sub(s.start),length=axis.length();if(Number.isFinite(length+s.strength)&&length>1e-3&&Math.abs(s.strength)>1e-5)axes.set(s.joint,{start:s.start,axis:axis.multiplyScalar(1/length),length,strength:THREE.MathUtils.clamp(s.strength,-1,1)});}
 if(!axes.size)return 0;
 const point=new THREE.Vector3(),normal=new THREE.Vector3(),radial=new THREE.Vector3();let changed=0;
 for(const i of selection){if(!Number.isInteger(i)||i<0||i>=p.count)continue;point.fromBufferAttribute(p,i);normal.fromBufferAttribute(n,i);
  if(!Number.isFinite(point.lengthSq()+normal.lengthSq())||normal.lengthSq()<.25)continue;normal.normalize();
  let relief=0;
  for(let k=0;k<4;k++){const joint=si.getComponent(i,k),weight=sw.getComponent(i,k),segment=axes.get(joint);if(!segment||!Number.isFinite(weight)||weight<.55)continue;
   radial.copy(point).sub(segment.start);const along=radial.dot(segment.axis),t=along/segment.length;if(t<=.18||t>=.82)continue;
   radial.addScaledVector(segment.axis,-along);const radius=radial.length();if(radius<segment.length*.035||radius>segment.length*.35)continue;
   const outward=Math.max(0,normal.dot(radial.multiplyScalar(1/radius)));const envelope=Math.sin(Math.PI*(t-.18)/.64)**2;
   // A smooth muscular belly, no displacement at wrist, elbow, knee or ankle.
   const candidate=Math.min(segment.length*.008,radius*.035)*segment.strength*envelope*outward*weight;if(Math.abs(candidate)>Math.abs(relief))relief=candidate;
  }
  if(Math.abs(relief)>1e-7){p.setXYZ(i,point.x+normal.x*relief,point.y+normal.y*relief,point.z+normal.z*relief);changed++;}
 }if(changed){p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();}return changed;
}

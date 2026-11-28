import * as THREE from 'three';
import type {SurfaceRole} from './avatar.material.roles.ts';
// Original RB rest-shape sculpting on fitted proxy meshes. No rig, UV, indices,
// skin weights or morph targets are replaced. Only positive outward relief.
// Coordinates use the local rest bounding box, so mirrored UV seams agree.
export function sculptSurfaceGeometry(g:THREE.BufferGeometry,role:SurfaceRole,enhanced:boolean){
 const p=g.getAttribute('position'),n=g.getAttribute('normal');
 if(!enhanced||!p||!n||p.count!==n.count||p.count<24||p.count>85000||g.morphAttributes.position?.length||p instanceof THREE.InterleavedBufferAttribute||n instanceof THREE.InterleavedBufferAttribute)return 0;
 const hair=role==='hair',fabric=['denim','tailoring','knit','techwear','fabric'].includes(role);
 if(!hair&&!fabric)return 0;
 g.computeBoundingBox();const box=g.boundingBox;if(!box)return 0;const size=box.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.x+size.y+size.z)||Math.min(size.x,size.y,size.z)<.00001)return 0;
 const span=Math.min(size.x,size.y,size.z),amplitude=span*(hair?.012:role==='denim'?.009:role==='tailoring'?.0045:.0065);
 const normal=new THREE.Vector3();let changed=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),u=(x-box.min.x)/size.x,v=(y-box.min.y)/size.y,w=(z-box.min.z)/size.z;
  if(!Number.isFinite(u+v+w))continue;
  normal.fromBufferAttribute(n,i);if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<.25)continue;normal.normalize();
  // Broad crown / lock ridges, or shallow tension folds in fitted cloth. Smoothly
  // taper to zero at top and bottom; no perturbation at attachment boundaries.
  const envelope=Math.sin(Math.PI*THREE.MathUtils.clamp(v,0,1))**2;
  const shape=hair?(.25+.75*Math.cos((u*4+w*2+.30*Math.sin(v*Math.PI*2))*Math.PI)**2):(.2+.8*Math.cos((v*5+u*.7+w*.55)*Math.PI)**4);
  const d=amplitude*envelope*shape;if(d<1e-8)continue;
  p.setXYZ(i,x+normal.x*d,y+normal.y*d,z+normal.z*d);changed++;
 }
 if(changed){p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();}
 // Authored normals intentionally retained (no hard seam artifacts from recomputation).
 return changed;
}

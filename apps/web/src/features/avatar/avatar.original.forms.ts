import * as THREE from 'three';
import type {SurfaceRole} from './avatar.material.roles.ts';
// Original fitted forms over the admitted proxy topology; never alter shared geometry,
// rig weights, UVs or facial morphs. All amplitudes are in mesh-local units.
export function editableSurface(g:THREE.BufferGeometry){
 const p=g.getAttribute('position'),n=g.getAttribute('normal');
 return !!p&&!!n&&p.count===n.count&&p.count>=24&&p.count<=85000&&!g.morphAttributes.position?.length&&!(p instanceof THREE.InterleavedBufferAttribute)&&!(n instanceof THREE.InterleavedBufferAttribute);
}
export function originalForm(g:THREE.BufferGeometry,kind:'wave-crop'|'sovereign'){
 if(!editableSurface(g))return 0;const p=g.getAttribute('position'),n=g.getAttribute('normal');
 g.computeBoundingBox();const box=g.boundingBox!,size=box.getSize(new THREE.Vector3()),span=Math.min(size.x,size.y,size.z);
 if(!Number.isFinite(span)||span<.00001)return 0;
 const normal=new THREE.Vector3();let count=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),u=(x-box.min.x)/size.x,v=(y-box.min.y)/size.y,w=(z-box.min.z)/size.z;
  if(!Number.isFinite(u+v+w))continue;normal.fromBufferAttribute(n,i);if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<.25)continue;normal.normalize();
  let d:number;
  if(kind==='wave-crop'){
   const r=Math.hypot((u-.5)*1.2,w-.5);
   // Distinct 360-wave crescent relief, taper to the fitted hairline.
   d=span*.034*Math.sin(Math.PI*v)**2*(.18+.82*Math.cos(2*Math.PI*(r*7+.42*Math.atan2(w-.5,u-.5)))**6);
  }else{
   // Sculpted shoulder yoke, ribbed upper panel and tapered hem band.
   const yoke=Math.exp(-Math.pow((v-.78)/.10,2)),hem=Math.exp(-Math.pow((v-.15)/.06,2));
   const rib=Math.cos(Math.PI*(u*6+Math.abs(w-.5)*1.6))**8;
   d=span*.024*Math.sin(Math.PI*v)**2*(.55*yoke+.30*hem+.15*rib);
  }
  if(d<1e-8)continue;p.setXYZ(i,x+normal.x*d,y+normal.y*d,z+normal.z*d);count++;
 }
 if(count){p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();}return count;
}
export function secondaryEligible(role:SurfaceRole,hair:string){
 return role==='hair'?['long','braids','ponytail','bob','bob-classic'].includes(hair):['denim','tailoring','knit','techwear','fabric'].includes(role);
}
// Precomputed, bounded secondary deformation. No allocation per frame, no
// new draw calls. Driven by current joint rotation rather than a perpetual timer.
export function secondarySurface(g:THREE.BufferGeometry,kind:'hair'|'fabric'){
 if(!editableSurface(g))return null;const p=g.getAttribute('position'),n=g.getAttribute('normal');
 g.computeBoundingBox();const box=g.boundingBox!,size=box.getSize(new THREE.Vector3()),span=Math.min(size.x,size.y,size.z);
 if(!Number.isFinite(span)||span<.00001)return null;
 const rest=new Float32Array(p.count*3),delta=new Float32Array(p.count*3),normal=new THREE.Vector3();
 const max=span*(kind==='hair'?.022:.012);
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),v=THREE.MathUtils.clamp((y-box.min.y)/size.y,0,1),u=(x-box.min.x)/size.x;rest.set([x,y,z],i*3);normal.fromBufferAttribute(n,i);if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<.25)continue;normal.normalize();const weight=kind==='hair'?(1-v)**2:Math.sin(Math.PI*v)**2;const d=max*weight*Math.sin((u*3+v*2)*Math.PI);delta[i*3]=normal.x*d;delta[i*3+1]=normal.y*d;delta[i*3+2]=normal.z*d;}
 // Keep conservative bounds for every allowed deformation.
 if(g.boundingBox)g.boundingBox.expandByScalar(max);g.computeBoundingSphere();if(g.boundingSphere)g.boundingSphere.radius+=max;
 return {count:p.count,kind,max,apply:(amount:number)=>{const a=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,-1,1):0;if(a===0){p.array.set(rest);}else{for(let i=0;i<p.count;i++)p.setXYZ(i,rest[i*3]+delta[i*3]*a,rest[i*3+1]+delta[i*3+1]*a,rest[i*3+2]+delta[i*3+2]*a);}p.needsUpdate=true;}};
}
export function secondaryResponse(previous:number,angle:number,dt:number){
 if(!Number.isFinite(previous+angle+dt)||dt<=0)return 0;
 return THREE.MathUtils.lerp(THREE.MathUtils.clamp(previous,-1,1),THREE.MathUtils.clamp(angle/Math.max(.008,dt)*.18,-1,1),1-Math.exp(-Math.min(dt,.075)*8));
}

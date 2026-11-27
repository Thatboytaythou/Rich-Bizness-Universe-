import * as THREE from 'three';
import type {SurfaceRole} from './avatar.material.roles.ts';
// Original fitted forms over the admitted proxy topology; never alter shared geometry,
// rig weights, UVs or facial morphs. All amplitudes are in mesh-local units.
export function editableSurface(g:THREE.BufferGeometry){
 const p=g.getAttribute('position'),n=g.getAttribute('normal');
 return !!p&&!!n&&p.count===n.count&&p.count>=24&&p.count<=85000&&!g.morphAttributes.position?.length&&!(p instanceof THREE.InterleavedBufferAttribute)&&!(n instanceof THREE.InterleavedBufferAttribute);
}
export function originalForm(g:THREE.BufferGeometry,kind:'wave-crop'|'sovereign',selection?:readonly number[]){
 const p=g.getAttribute('position'),n=g.getAttribute('normal');if(!p||!n||p.count!==n.count||p.count>250000||p.count<24||(g.morphAttributes.position?.length&&!g.morphTargetsRelative))return 0;
 const vertices=selection??Array.from({length:p.count},(_,i)=>i);if(vertices.length<24||vertices.length>85000)return 0;const box=new THREE.Box3(),point=new THREE.Vector3();for(const i of vertices){if(i<0||i>=p.count)return 0;point.fromBufferAttribute(p,i);box.expandByPoint(point);}const size=box.getSize(new THREE.Vector3()),span=Math.min(size.x,size.y,size.z);
 if(!Number.isFinite(span)||span<.00001)return 0;
 const normal=new THREE.Vector3();let count=0;
 for(const i of vertices){
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
 let last=0;return {count:p.count,kind,max,apply:(amount:number)=>{const value=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,-1,1):0;const a=Math.abs(value)<.001?0:value;if(a===last)return;last=a;if(a===0){p.array.set(rest);}else{for(let i=0;i<p.count;i++)p.setXYZ(i,rest[i*3]+delta[i*3]*a,rest[i*3+1]+delta[i*3+1]*a,rest[i*3+2]+delta[i*3+2]*a);}p.needsUpdate=true;}};
}
export function secondaryResponse(previous:number,angle:number,dt:number){
 if(!Number.isFinite(previous+angle+dt)||dt<=0)return 0;
 return THREE.MathUtils.lerp(THREE.MathUtils.clamp(previous,-1,1),THREE.MathUtils.clamp(angle/Math.max(.008,dt)*.18,-1,1),1-Math.exp(-Math.min(dt,.075)*8));
}

// Material groups in merged skinned geometry may share vertices. Leave boundary
// vertices used by another material unchanged. No changes to relative morph deltas.
export function formSelection(g:THREE.BufferGeometry,selectedMaterials:readonly number[],materialCount:number){
 const p=g.getAttribute('position');if(!p)return [];if(materialCount===1&&selectedMaterials.includes(0))return Array.from({length:p.count},(_,i)=>i);if(!g.groups.length)return [];
 const flags=new Uint8Array(p.count),selected=new Set(selectedMaterials),index=g.index;for(const group of g.groups){const flag=selected.has(group.materialIndex??0)?1:2;for(let j=group.start;j<group.start+group.count;j++){const i=index?index.getX(j):j;if(i>=0&&i<p.count)flags[i]|=flag;}}
 const result:number[]=[];for(let i=0;i<flags.length;i++)if(flags[i]===1)result.push(i);return result;
}
// Only duplicate the edited position buffer, not 34 face morph arrays.
export function cloneFormGeometry(g:THREE.BufferGeometry){const copy=new THREE.BufferGeometry();copy.name=g.name;for(const [key,attribute] of Object.entries(g.attributes))copy.setAttribute(key,key==='position'?attribute.clone():attribute);copy.setIndex(g.index);copy.morphAttributes={...g.morphAttributes};copy.morphTargetsRelative=g.morphTargetsRelative;for(const group of g.groups)copy.addGroup(group.start,group.count,group.materialIndex);copy.setDrawRange(g.drawRange.start,g.drawRange.count);return copy;}

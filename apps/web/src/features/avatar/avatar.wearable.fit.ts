import * as THREE from 'three';
import {surfaceRole} from './avatar.material.roles.ts';
export type TorsoFit={width:number;front:number;back:number;samples:number};
// Measure only the central torso band, not arms, head, shoes, or fantasy accessories.
// Bounded ratios preserve compatibility if an unusual outfit or rig is encountered.
export function fitTorsoPoints(points:Iterable<THREE.Vector3>,height:number):TorsoFit{
 const fallback={width:1,front:0,back:0,samples:0};if(!Number.isFinite(height)||height<1||height>2.5)return fallback;
 const xs:number[]=[],zs:number[]=[];
 for(const p of points){if(!Number.isFinite(p.x+p.y+p.z)||p.y<height*.66||p.y>height*.80||Math.abs(p.x)>height*.15||Math.abs(p.z)>height*.22)continue;xs.push(p.x);zs.push(p.z);}
 if(xs.length<24)return fallback;
 xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);const q=(a:number[],t:number)=>a[Math.floor((a.length-1)*t)]??0;
 const scale=height/1.78;
 const width=THREE.MathUtils.clamp((q(xs,.95)-q(xs,.05))/(.34*scale),.88,1.28);
 const front=THREE.MathUtils.clamp(q(zs,.95)-.125*scale,-.018*scale,.045*scale);
 const back=THREE.MathUtils.clamp(q(zs,.05)+.125*scale,-.045*scale,.018*scale);
 return {width,front,back,samples:xs.length};
}
export function measureTorsoFit(root:THREE.Object3D,height:number):TorsoFit{
 const points:THREE.Vector3[]=[],v=new THREE.Vector3();root.updateMatrixWorld(true);
 root.traverse(o=>{const mesh=o as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh||!mesh.geometry.getAttribute('position'))return;
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];const name=mesh.name+' '+mats.map(m=>m.name).join(' ');
  const roles=mats.map(m=>surfaceRole(m.name,mesh.name));if(!roles.some(role=>['skin','tailoring','denim','knit','techwear','fabric'].includes(role))&&(!/skin|body|torso|shirt|jacket|coat|hoodie|suit|dress|vest|top|clothes/i.test(name)||/hair|beard|eye|teeth|shoe|boot|wing/i.test(name)))return;
  const count=mesh.geometry.getAttribute('position').count,step=Math.max(1,Math.ceil(count/2400));mesh.skeleton.update();
  for(let i=0;i<count&&points.length<12000;i+=step){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);if(v.y>=height*.66&&v.y<=height*.80&&Math.abs(v.x)<=height*.15&&Math.abs(v.z)<=height*.22)points.push(v.clone());}
 });
 return fitTorsoPoints(points,height);
}
// Bounded inertial response. At rest the cloth settles; rapid torso turns produce
// a small lag rather than constant large waving. No per-frame allocations.
export function clothFollow(previous:number,angle:number,dt:number){
 if(!Number.isFinite(previous+angle+dt)||dt<=0)return Number.isFinite(previous)?THREE.MathUtils.clamp(previous,0,.03):0;
 const target=THREE.MathUtils.clamp(angle/Math.max(.008,dt)*.012,0,.03);
 return THREE.MathUtils.clamp(THREE.MathUtils.lerp(previous,target,1-Math.exp(-Math.min(dt,.075)*7)),0,.03);
}

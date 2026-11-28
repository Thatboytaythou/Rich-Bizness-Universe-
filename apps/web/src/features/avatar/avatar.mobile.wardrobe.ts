import * as THREE from 'three';
import {surfaceRole} from './avatar.material.roles.ts';
export function mobileGarmentMaterial(name:string,mesh=''){
 const role=surfaceRole(name,mesh);return ['denim','knit','tailoring','techwear','fabric'].includes(role)||/sneaker|combatboot|oxford|shoes/i.test(name.replace(/[^a-z0-9]/gi,''));
}
// Conservative index-only simplification. Collapse interior edges of garment
// material regions; preserve all vertex buffers, skin weights, UVs and morphs.
// Never collapse skin, face, hair, material boundaries or open mesh boundaries.
export function reducePhoneWardrobe(g:THREE.BufferGeometry,eligible:readonly number[],materialCount:number,requested:number){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight'),idx=g.index;
 if(!p||!n||!idx||!si||!sw||si.itemSize!==4||sw.itemSize!==4||p.count>150000||idx.count>540000||!Number.isFinite(requested)||requested<2||!eligible.length)return null;
 const groups=g.groups.length?g.groups:materialCount===1?[{start:0,count:idx.count,materialIndex:0}]:[];
 if(!groups.length||g.drawRange.start!==0||g.drawRange.count<idx.count)return null;
 let end=0;for(const group of groups){if(group.start!==end||group.count%3)return null;end+=group.count;}if(end!==idx.count)return null;
 const selected=new Set(eligible),protectedV=new Uint8Array(p.count),regions=groups.map(group=>({material:group.materialIndex??0,indices:Array.from({length:group.count},(_,i)=>idx.getX(group.start+i))}));
 const owner=new Int32Array(p.count).fill(-1);
 for(const [regionId,region] of regions.entries())for(const i of region.indices){if(!Number.isInteger(i)||i<0||i>=p.count)return null;if(!selected.has(region.material)||(owner[i]!==-1&&owner[i]!==regionId))protectedV[i]=1;owner[i]=regionId;}
 // Protect coincident split vertices (UV/material seams), including different indices.
 const first=new Map<string,number>();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1000000)).join(':');const prev=first.get(key);if(prev!==undefined){protectedV[prev]=1;protectedV[i]=1;}else first.set(key,i);}
 let removed=0;
 const point=(i:number)=>new THREE.Vector3().fromBufferAttribute(p,i),normal=(i:number)=>new THREE.Vector3().fromBufferAttribute(n,i).normalize();
 const weight=(i:number,j:number)=>{let sum=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===j)sum+=sw.getComponent(i,k);return sum;};
 const compatible=(a:number,b:number)=>{
  if(normal(a).dot(normal(b))<.94)return false;
  if(uv&&Math.hypot(uv.getX(a)-uv.getX(b),uv.getY(a)-uv.getY(b))>.08)return false;
  const joints=new Set<number>();for(let k=0;k<4;k++){joints.add(si.getComponent(a,k));joints.add(si.getComponent(b,k));}let delta=0;for(const j of joints)delta+=Math.abs(weight(a,j)-weight(b,j));if(delta>.22)return false;
  for(const morph of g.morphAttributes.position??[]){const dx=morph.getX(a)-morph.getX(b),dy=morph.getY(a)-morph.getY(b),dz=morph.getZ(a)-morph.getZ(b);if(dx*dx+dy*dy+dz*dz>.000004)return false;}
  return true;
 };
 const faceNormal=(a:number,b:number,c:number)=>point(b).sub(point(a)).cross(point(c).sub(point(a)));
 // Independent edge collapses per pass; local link and normal checks reject
 // non-manifold changes and flipped triangles. No more than six passes.
 for(let pass=0;pass<6&&removed+2<=requested;pass++){
  let changed=0;
  for(const region of regions){if(!selected.has(region.material)||region.indices.length<120||removed+2>requested)continue;
   const faces=region.indices,adj=new Map<number,Set<number>>(),incident=new Map<number,number[]>(),edges=new Map<string,{a:number;b:number;count:number}>(),boundary=new Set<number>();
   const link=(a:number,b:number)=>{let set=adj.get(a);if(!set)adj.set(a,set=new Set());set.add(b);};
   for(let k=0;k<faces.length;k+=3){const ids=faces.slice(k,k+3);for(const i of ids){let list=incident.get(i);if(!list)incident.set(i,list=[]);list.push(k);}for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3];if(a===undefined||b===undefined)return null;link(a,b);link(b,a);const lo=Math.min(a,b),hi=Math.max(a,b),key=lo+':'+hi,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a:lo,b:hi,count:1});}}
   for(const e of edges.values())if(e.count!==2){boundary.add(e.a);boundary.add(e.b);}
   const candidates=[...edges.values()].filter(e=>e.count===2&&!protectedV[e.a]&&!protectedV[e.b]&&!boundary.has(e.a)&&!boundary.has(e.b)).map(e=>({...e,cost:point(e.a).distanceToSquared(point(e.b))})).filter(e=>Number.isFinite(e.cost)&&e.cost<.000144).sort((a,b)=>a.cost-b.cost);
   const blocked=new Set<number>(),replace=new Map<number,number>();
   const initial=faces.length/3;let local=0;
   for(const e of candidates){if(removed+2>requested||local>=Math.floor(initial*.20))break;const {a,b}=e;if(blocked.has(a)||blocked.has(b)||!compatible(a,b))continue;
    const aa=adj.get(a)!,bb=adj.get(b)!;if([...aa].filter(i=>bb.has(i)).length!==2)continue;
    let valid=true,degenerate=0;
    for(const k of incident.get(b)??[]){const original:[number,number,number]=[faces[k]!,faces[k+1]!,faces[k+2]!];const next:[number,number,number]=[original[0]===b?a:original[0],original[1]===b?a:original[1],original[2]===b?a:original[2]];if(new Set(next).size<3){degenerate++;continue;}const oldN=faceNormal(original[0],original[1],original[2]),newN=faceNormal(next[0],next[1],next[2]);if(newN.lengthSq()<1e-18||oldN.normalize().dot(newN.normalize())<.65){valid=false;break;}}
    if(!valid||degenerate!==2)continue;
    replace.set(b,a);blocked.add(a);blocked.add(b);for(const i of aa)blocked.add(i);for(const i of bb)blocked.add(i);removed+=2;local+=2;changed+=2;
   }
   if(replace.size){const next:number[]=[];for(let k=0;k<faces.length;k+=3){const x=faces[k]!,y=faces[k+1]!,z=faces[k+2]!;const a=replace.get(x)??x,b=replace.get(y)??y,c=replace.get(z)??z;if(a!==b&&b!==c&&c!==a)next.push(a,b,c);}region.indices=next;}
  }
  if(!changed)break;
 }
 if(!removed)return null;
 const out=new THREE.BufferGeometry();out.name=g.name;for(const [key,attribute] of Object.entries(g.attributes))out.setAttribute(key,attribute);out.morphAttributes={...g.morphAttributes};out.morphTargetsRelative=g.morphTargetsRelative;
 const indices=new (p.count<=65535?Uint16Array:Uint32Array)(idx.count-removed*3);let offset=0;for(const region of regions){indices.set(region.indices,offset);out.addGroup(offset,region.indices.length,region.material);offset+=region.indices.length;}
 if(offset!==indices.length){out.dispose();return null;}out.setIndex(new THREE.BufferAttribute(indices,1));out.computeBoundingBox();out.computeBoundingSphere();return {geometry:out,removedTriangles:removed};
}

import * as THREE from 'three';
// Refine only curved, skin-owned faces. A centroid split leaves the three
// original edges untouched, so neighboring material/UV seams cannot crack.
// Retain existing vertices, groups, skinning and relative expression targets.
// Optional, one-time fit operation: never increase draw calls or run per frame.
export function refinePhoneSkin(g:THREE.BufferGeometry,skinMaterials:readonly number[],materialCount:number,headJoint:number,triangleHeadroom:number,vertexHeadroom:number,byteLimit=20*1024*1024){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight'),index=g.index;
 if(!index||!p||!n||!si||!sw||p.itemSize!==3||n.itemSize!==3||si.itemSize!==4||sw.itemSize!==4||!skinMaterials.length||p.count>45000||(g.morphAttributes.position?.length&&!g.morphTargetsRelative)||!Number.isFinite(triangleHeadroom+vertexHeadroom+byteLimit))return null;
 const attributes=Object.entries(g.attributes),morphEntries=Object.entries(g.morphAttributes).flatMap(([name,list])=>list.map((attribute,i)=>({name,i,attribute})));
 const all=[...attributes.map(([,a])=>a),...morphEntries.map(e=>e.attribute)];
 // Do not guess how to interpolate vendor-specific packed/normalized attributes.
 if(all.some(a=>!(a instanceof THREE.BufferAttribute)||a.normalized||a.count!==p.count))return null;
 if(attributes.some(([name,a])=>name!=='skinIndex'&&!(a.array instanceof Float32Array))||morphEntries.some(e=>!(e.attribute.array instanceof Float32Array)))return null;
 const perVertex=all.reduce((sum,a)=>sum+a.itemSize*a.array.BYTES_PER_ELEMENT,0);
 const max=Math.min(6000,Math.floor(triangleHeadroom/2),Math.floor(vertexHeadroom),45000-p.count,Math.floor((byteLimit-index.count*4-p.count*perVertex)/(perVertex+24)));
 if(max<1)return null;
 const groups=g.groups.length?g.groups:materialCount===1?[{start:0,count:index.count,materialIndex:0}]:[];
 if(!groups.length||groups.reduce((sum,group)=>sum+group.count,0)!==index.count||g.drawRange.start!==0||g.drawRange.count<index.count)return null;
 let expectedStart=0;for(const group of groups){if(group.start!==expectedStart||group.count%3!==0)return null;expectedStart+=group.count;}
 const allowed=new Set(skinMaterials),candidates:{offset:number;a:number;b:number;c:number;score:number;weights:[number,number][];delta:THREE.Vector3}[]=[];
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),na=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3(),center=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
 for(const group of groups){if(!allowed.has(group.materialIndex??0))continue;for(let offset=group.start;offset<group.start+group.count;offset+=3){
  const ids=[index.getX(offset),index.getX(offset+1),index.getX(offset+2)];if(new Set(ids).size!==3||ids.some(i=>i<0||i>=p.count))continue;
  const weights=new Map<number,number>();let headWeight=0;
  for(const i of ids)for(let k=0;k<4;k++){const weight=sw.getComponent(i,k),joint=si.getComponent(i,k);if(!Number.isFinite(weight)||weight<=.0001)continue;weights.set(joint,(weights.get(joint)??0)+weight/3);if(joint===headJoint)headWeight+=weight/3;}
  if(!weights.size||weights.size>4)continue;
  // Only regions with a common dominant joint: avoid changing skin interpolation
  // across elbows, fingers, eyelid borders and other strongly bending seams.
  const sorted=[...weights].sort((x,y)=>y[1]-x[1]);if(sorted[0][1]<.82)continue;const sum=sorted.reduce((s,v)=>s+v[1],0);if(!Number.isFinite(sum)||Math.abs(sum-1)>.02)continue;
  const dominant=sorted[0][0];if(ids.some(i=>{let w=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===dominant)w+=sw.getComponent(i,k);return w<.70;}))continue;
  a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);na.fromBufferAttribute(n,ids[0]).normalize();nb.fromBufferAttribute(n,ids[1]).normalize();nc.fromBufferAttribute(n,ids[2]).normalize();
  const length=Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a));if(!Number.isFinite(length)||length<.001||length>.15)continue;
  const curvature=Math.max(0,1-Math.min(na.dot(nb),nb.dot(nc),nc.dot(na)));if(!Number.isFinite(curvature)||curvature<.012||curvature>.65)continue;
  center.copy(a).add(b).add(c).multiplyScalar(1/3);normal.copy(na).add(nb).add(nc).normalize();if(normal.lengthSq()<.5)continue;
  // Project the centroid toward the three authored tangent planes, bounded
  // to a small fraction of edge length. This adds useful curved surface detail.
  let displacement=0;for(const [v,nn] of [[a,na],[b,nb],[c,nc]])displacement+=edge.copy(v).sub(center).dot(nn)/3;
  displacement=THREE.MathUtils.clamp(displacement,-Math.min(.001,length*.04),Math.min(.001,length*.04));
  const score=length*curvature*(headWeight>.8?5:1);if(Math.abs(displacement)<1e-7)continue;
  candidates.push({offset,a:ids[0],b:ids[1],c:ids[2],score,weights:sorted.map(([j,w])=>[j,w/sum]),delta:normal.clone().multiplyScalar(displacement)});
 }}
 candidates.sort((x,y)=>y.score-x.score||x.offset-y.offset);const chosen=candidates.slice(0,max);if(!chosen.length)return null;
 const chosenMap=new Map(chosen.map((v,i)=>[v.offset,{...v,vertex:p.count+i}]));
 const out=new THREE.BufferGeometry(),count=p.count+chosen.length;
 const expand=(attribute:THREE.BufferAttribute,name:string,morph:boolean)=>{
  const Ctor=attribute.array.constructor as {new(length:number):typeof attribute.array},data=new Ctor(count*attribute.itemSize);data.set(attribute.array);const result=new THREE.BufferAttribute(data,attribute.itemSize,attribute.normalized);
  for(const v of chosenMap.values()){const ids=[v.a,v.b,v.c];for(let k=0;k<attribute.itemSize;k++){let value:number;
   if(!morph&&name==='skinIndex')value=v.weights[k]?.[0]??0;
   else if(!morph&&name==='skinWeight')value=v.weights[k]?.[1]??0;
   else value=ids.reduce((sum,i)=>sum+attribute.getComponent(i,k),0)/3;
   result.setComponent(v.vertex,k,value);
  }if(!morph&&name==='position')result.setXYZ(v.vertex,result.getX(v.vertex)+v.delta.x,result.getY(v.vertex)+v.delta.y,result.getZ(v.vertex)+v.delta.z);
   if(!morph&&name==='normal'){normal.fromBufferAttribute(result,v.vertex).normalize();result.setXYZ(v.vertex,normal.x,normal.y,normal.z);}
  }return result;
 };
 for(const [name,attribute] of attributes)out.setAttribute(name,expand(attribute as THREE.BufferAttribute,name,false));
 for(const {name,i,attribute} of morphEntries){const list=(out.morphAttributes as Record<string,THREE.BufferAttribute[]>)[name]??=[];list[i]=expand(attribute as THREE.BufferAttribute,name,true);}
 out.morphTargetsRelative=g.morphTargetsRelative;out.name=g.name;
 const indices=new Uint32Array(index.count+chosen.length*6);let write=0;
 for(const group of groups){const start=write;for(let offset=group.start;offset<group.start+group.count;offset+=3){const v=chosenMap.get(offset);if(v){indices.set([v.a,v.b,v.vertex,v.b,v.c,v.vertex,v.c,v.a,v.vertex],write);write+=9;}else{indices.set([index.getX(offset),index.getX(offset+1),index.getX(offset+2)],write);write+=3;}}out.addGroup(start,write-start,group.materialIndex??0);}
 out.setIndex(new THREE.BufferAttribute(indices,1));out.computeBoundingBox();out.computeBoundingSphere();
 return {geometry:out,addedTriangles:chosen.length*2,addedVertices:chosen.length,headTriangles:chosen.filter(v=>v.weights.some(([j,w])=>j===headJoint&&w>.8)).length*2};
}

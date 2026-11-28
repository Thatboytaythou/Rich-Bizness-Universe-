import * as THREE from 'three';
// Only independently connected small beard clusters qualify. Do not cut a continuous surface,
// remove facial skin or modify vertex, UV, skeletal or expression buffers.
export function thinBeardIndices(position:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,indices:readonly number[],target:number,protectedVertices:ReadonlySet<number>=new Set()){
 if(!Number.isFinite(target)||target<1||position.count>150000||indices.length%3||indices.length>540000||indices.length/3<=target)return null;
 const parent=new Int32Array(position.count).fill(-1);
 const find=(n:number):number=>{let r=n;while(parent[r]!==r){r=parent[r]!;}while(n!==r){const next=parent[n]!;parent[n]=r;n=next;}return r;};
 for(const v of indices){if(!Number.isInteger(v)||v<0||v>=position.count)return null;if(parent[v]===-1)parent[v]=v;}
 for(let i=0;i<indices.length;i+=3){const a=find(indices[i]!),b=find(indices[i+1]!),c=find(indices[i+2]!);parent[b]=a;parent[c]=a;}
 type Cluster={faces:number[];vertices:Set<number>};
 const clusters=new Map<number,Cluster>();
 for(let i=0;i<indices.length;i+=3){const id=find(indices[i]!);let item=clusters.get(id);if(!item)clusters.set(id,item={faces:[],vertices:new Set()});item.faces.push(i);for(let k=0;k<3;k++)item.vertices.add(indices[i+k]!);}
 const cells=new Map<string,Cluster[]>(),keep=new Set<number>();let eligible=0,count=0;
 for(const item of clusters.values()){
  const box=new THREE.Box3();for(const i of item.vertices){const p=new THREE.Vector3().fromBufferAttribute(position,i);if(!Number.isFinite(p.x+p.y+p.z))return null;box.expandByPoint(p);}
  const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());
  if(item.faces.length<2||item.faces.length>96||item.vertices.size<4||Math.max(size.x,size.y,size.z)>.035||[...item.vertices].some(i=>protectedVertices.has(i))){for(const f of item.faces)keep.add(f);continue;}
  const cellSize=target<=1500?.024:.009;
  const key=[center.x,center.y,center.z].map(v=>Math.floor(v/cellSize)).join(':');let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(item);eligible+=item.faces.length;count++;
 }
 if(count<64||eligible<indices.length/3*.65)return null;
 const ratio=Math.max(target<=1500?.025:.18,Math.min(1,(target-keep.size)/eligible));
 for(const list of cells.values()){const n=Math.max(1,Math.ceil(list.length*ratio));for(let i=0;i<n;i++){const cluster=list[Math.floor(i*list.length/n)]!;for(const f of cluster.faces)keep.add(f);}}
 if(keep.size>=indices.length/3)return null;const result:number[]=[];for(let i=0;i<indices.length;i+=3)if(keep.has(i))result.push(indices[i]!,indices[i+1]!,indices[i+2]!);
 return {indices:result,removedTriangles:(indices.length-result.length)/3,clusters:count,cells:cells.size};
}
export function reduceBeardGeometry(g:THREE.BufferGeometry,materials:readonly THREE.Material[],target:number){
 const position=g.getAttribute('position'),index=g.index;if(!position||!index||g.drawRange.start!==0||g.drawRange.count<index.count)return null;
 const groups=g.groups.length?g.groups:materials.length===1?[{start:0,count:index.count,materialIndex:0}]:[];
 let end=0;for(const group of groups){if(group.start!==end||group.count%3)return null;end+=group.count;}if(end!==index.count)return null;
 const isBeard=(i:number)=>/^beard$/i.test(materials[i]?.name?.trim()??'');
 const other=new Set<number>();for(const group of groups)if(!isBeard(group.materialIndex??0))for(let i=group.start;i<group.start+group.count;i++)other.add(index.getX(i));
 const output:number[]=[],ranges:{start:number;count:number;materialIndex:number}[]=[];let removedTriangles=0;
 for(const group of groups){const values=Array.from({length:group.count},(_,i)=>index.getX(group.start+i));const lod=isBeard(group.materialIndex??0)?thinBeardIndices(position,values,target,other):null;const next=lod?.indices??values;ranges.push({start:output.length,count:next.length,materialIndex:group.materialIndex??0});for(const value of next)output.push(value);removedTriangles+=lod?.removedTriangles??0;}
 if(!removedTriangles)return null;const geometry=new THREE.BufferGeometry();geometry.name=g.name;for(const [key,value] of Object.entries(g.attributes))geometry.setAttribute(key,value);geometry.morphAttributes={...g.morphAttributes};geometry.morphTargetsRelative=g.morphTargetsRelative;geometry.setIndex(new THREE.BufferAttribute(position.count<=65535?Uint16Array.from(output):Uint32Array.from(output),1));for(const range of ranges)geometry.addGroup(range.start,range.count,range.materialIndex);geometry.computeBoundingBox();geometry.computeBoundingSphere();return {geometry,removedTriangles};
}

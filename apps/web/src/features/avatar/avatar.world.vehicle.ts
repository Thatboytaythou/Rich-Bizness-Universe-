import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const disposeSource=(root:THREE.Object3D,keepMaterials=false)=>{
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;geometries.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if((v as THREE.Texture|undefined)?.isTexture)textures.add(v as THREE.Texture);}});
 geometries.forEach(g=>g.dispose());if(!keepMaterials){textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}
};
export function mergeStaticVehicle(source:THREE.Object3D,mobile:boolean){
 source.updateMatrixWorld(true);const groups=new Map<string,{material:THREE.Material;pieces:THREE.BufferGeometry[]}>();
 let triangles=0;const output=new THREE.Group();const temporary:THREE.BufferGeometry[]=[];
 try{
  source.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
   if((mesh as THREE.SkinnedMesh).isSkinnedMesh||Array.isArray(mesh.material)||Object.keys(mesh.geometry.morphAttributes).length)throw Error('Unsupported dynamic vehicle geometry');
   const g=mesh.geometry.clone();temporary.push(g);
   if(!g.getAttribute('normal'))g.computeVertexNormals();if(!g.index){const indices=new Uint32Array(g.attributes.position.count);for(let i=0;i<indices.length;i++)indices[i]=i;g.setIndex(new THREE.BufferAttribute(indices,1));}
   if(mesh.matrixWorld.determinant()<0){const index=g.index!;for(let i=0;i<index.count;i+=3){const n=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,n);}}
   g.applyMatrix4(mesh.matrixWorld);triangles+=g.index!.count/3;
   const attrs=Object.keys(g.attributes).sort().map(k=>{const a=g.getAttribute(k);return k+':'+a.itemSize+':'+a.array.constructor.name+':'+a.normalized;}).join('|');
   const key=mesh.material.uuid+attrs;const group=groups.get(key)??{material:mesh.material,pieces:[]};group.pieces.push(g);groups.set(key,group);
  });
  if(!groups.size||groups.size>(mobile?36:80)||triangles>(mobile?85000:240000))throw Error('Merged vehicle exceeds draw/triangle budget');
  for(const {material,pieces} of groups.values()){
   const merged=mergeGeometries(pieces,false);if(!merged)throw Error('Vehicle geometry merge failed');
   if(mobile&&(material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial){const m=material as THREE.MeshPhysicalMaterial;m.transmission=0;m.clearcoat=Math.min(.4,m.clearcoat);m.needsUpdate=true;}
   const mesh=new THREE.Mesh(merged,material);mesh.castShadow=!mobile;mesh.receiveShadow=!mobile;output.add(mesh);
  }
  output.rotation.y=-Math.PI/2;output.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(output),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.z)||size.z<1||size.z>10||size.x<.5||size.y<.4)throw Error('Invalid vehicle bounds');
  const scale=3.55/size.z;output.scale.setScalar(scale);output.updateMatrixWorld(true);box.setFromObject(output);const center=box.getCenter(new THREE.Vector3());output.position.set(-center.x,-box.min.y,-center.z);
  output.userData.rbVehicleTriangles=triangles;output.userData.rbVehicleDraws=groups.size;return output;
 }catch(e){output.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)m.geometry.dispose();});throw e;}
 finally{temporary.forEach(g=>g.dispose());}
}
export async function loadDetailedVehicle(signal:AbortSignal,mobile:boolean){
 let source:THREE.Group|undefined;
 try{
  const response=await fetch('/world-models/manifest.json',{signal});if(!response.ok)return null;const report=await response.json();
  if(report.release!=='V31'||!report.available||report.asset!=='spectral-gt-rs.glb'||(mobile&&!report.mobileEligible))return null;
  const f=await fetch('/world-models/spectral-gt-rs.glb',{signal});if(!f.ok)throw Error('Vehicle HTTP '+f.status);const bytes=await f.arrayBuffer();if(bytes.byteLength!==report.bytes||bytes.byteLength>6000000||signal.aborted)throw Error('Vehicle size or lifecycle invalid');
  const gltf=await new GLTFLoader().parseAsync(bytes,new URL('/world-models/',location.origin).href);source=gltf.scene;if(signal.aborted)throw Error('Vehicle load cancelled');
  const result=mergeStaticVehicle(source,mobile);disposeSource(source,true);source=undefined;return result;
 }catch(e){if(source)disposeSource(source);if(!signal.aborted)console.warn('[RB vehicle fallback]',e);return null;}
}
export function disposeDetailedVehicle(root:THREE.Object3D){disposeSource(root);}

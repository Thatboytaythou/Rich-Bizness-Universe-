import * as THREE from 'three';
import {meridianCuffGeometry,cuffMetalness,cuffRoughness,wristBone,cuffFit} from './avatar.cuff.art.ts';
import {measureTorsoFit,clothFollow} from './avatar.wearable.fit.ts';
import {mantleGeometry,animateMantle} from './avatar.atlas.art.ts';
// Original Rich Bizness "Aegis" swept feather profiles and Crown Sigil wearable.
// Units: metres at adult scale. Closed cross-sections, mirrored at the wing hinge.
export function aegisGeometry(){
 const positions:number[]=[],indices:number[]=[],colors:number[]=[];const segments=10;
 for(let feather=0;feather<12;feather++){
  const reach=.38+feather*.045, rise=.34-feather*.061, originX=.025+feather*.013,originY=.10-feather*.018;
  const base=positions.length/3;
  for(let i=0;i<=10;i++){
   const t=i/10,cx=originX+reach*t,cy=originY+rise*t+.14*Math.sin(Math.PI*t),cz=-.045*Math.sin(Math.PI*t);
   const width=(.012+.043*Math.sin(Math.PI*t))*(1-.82*t),thickness=.003+.009*Math.sin(Math.PI*t);
   for(let k=0;k<segments;k++){const a=k*Math.PI*2/segments,edge=Math.abs(Math.cos(a)),ridge=Math.pow(Math.abs(Math.sin(a)),8);positions.push(cx,cy+Math.cos(a)*width,cz+Math.sin(a)*(thickness+.005*ridge*Math.sin(Math.PI*t)));const polish=.62+.26*t+.12*edge;const band=feather%3===0?.07:0;colors.push(Math.min(1,polish+band),Math.min(1,polish*.95+band),Math.min(1,polish*.86+band));}
  }
  for(let i=0;i<10;i++)for(let k=0;k<segments;k++){const a=base+i*segments+k,b=base+i*segments+(k+1)%segments,c=b+segments,d=a+segments;indices.push(a,b,d,b,c,d);}
  for(let k=1;k<segments-1;k++){indices.push(base,base+k+1,base+k);const tip=base+10*segments;indices.push(tip,tip+k,tip+k+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function crownGeometry(){
 const shape=new THREE.Shape();shape.moveTo(-.041,-.027);shape.lineTo(-.052,.029);shape.lineTo(-.022,.008);shape.lineTo(0,.049);shape.lineTo(.022,.008);shape.lineTo(.052,.029);shape.lineTo(.041,-.027);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(0,-.011);hole.lineTo(-.012,.005);hole.lineTo(0,.021);hole.lineTo(.012,.005);hole.closePath();shape.holes.push(hole);
 const g=new THREE.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:2,steps:1,curveSegments:8});g.translate(0,0,-.003);g.computeBoundingBox();return g;
}
// Original layered breastplate: a curved, beveled surface with tapered lower edge.
export function regaliaGeometry(){
 const v:number[]=[],uv:number[]=[],ix:number[]=[];const rows=14,cols=24;
 for(let layer=0;layer<2;layer++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,u=i/cols,a=(u-.5)*2.15;
  const radius=.205*(.77+.23*Math.sin(Math.PI*t*.8));const y=.145-t*.29;
  // Sculpted central keel, paired diagonal ribs and a raised perimeter on the outer plate.
  const rib=Math.pow(Math.max(0,Math.cos(14*(Math.abs(u-.5)-.18*t))),8);
  const edge=Math.pow(Math.abs(u-.5)*2,12)+Math.pow(Math.abs(t-.5)*2,12);
  const relief=layer===0?.007*rib+.008*Math.pow(1-Math.abs(u-.5)*2,8)+.003*edge:0;
  v.push(Math.sin(a)*radius,y,Math.cos(a)*(.075+.038*Math.sin(Math.PI*t))+(layer===0?.009:0)+relief);
  uv.push(u,1-t);
 }
 const stride=cols+1,n=stride*(rows+1);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*stride+i,b=a+1,c=a+stride,d=c+1;ix.push(a,c,b,b,c,d,n+a,n+b,n+c,n+b,n+d,n+c);}
 const rim=(a:number,b:number)=>ix.push(a,b,n+a,b,n+b,n+a);
 for(let i=0;i<cols;i++){rim(i,i+1);rim(rows*stride+i+1,rows*stride+i);}
 for(let j=0;j<rows;j++){rim((j+1)*stride,j*stride);rim(j*stride+cols,(j+1)*stride+cols);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();return g;
}
// A deterministic original diamond/crown jacquard tile, used by runtime and asset build.
export function regaliaTextile(style:string,size=128){
 const data=new Uint8Array(size*size*4);const palette=style==='obsidian'?[20,24,32,162,182,196]:[19,53,39,192,155,79];
 // Original RB Crown lattice: an interlocked lozenge border and three-point crown,
 // with alternating satin thread direction and recessed dark seams.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=x%64,b=y%64,dx=Math.abs(a-32),dy=Math.abs(b-32),d=dx+dy;const border=Math.abs(d-27)<1.7||Math.abs(d-22)<1.1;const tips=b>=24&&b<=37&&dx<=12&&(b>=34||Math.abs(dx-9)<2.2&&b>=26||dx<2.2);const stitch=(x+y)%4===0?.86:1;const seam=Math.abs(d-30)<1||Math.abs(d-19)<.8;const thread=Math.sin(x*Math.PI/2)*2.5+Math.cos(y*Math.PI/2)*2.5;const k=(y*size+x)*4;for(let c=0;c<3;c++)data[k+c]=Math.round(Math.max(0,Math.min(255,palette[(border||tips?3:0)+c]*(seam?.69:stitch)+thread)));data[k+3]=255;}
 return data;
}

// Original pendant chain: alternating interlocking elliptical links, shaped along a collar curve.
// All links share one geometry/material and one instanced draw submission.
export function crownChain(material:THREE.Material){
 const chain=new THREE.InstancedMesh(new THREE.TorusGeometry(.009,.0025,6,14),material,34);
 const dummy=new THREE.Object3D();
 for(let i=0;i<34;i++){const u=i/33*2-1;dummy.position.set(u*.137,.057+.137*Math.pow(Math.abs(u),1.5),-.066*Math.pow(Math.abs(u),1.8));dummy.rotation.set(.15+Math.abs(u)*.38,(i%2)*Math.PI/2,Math.atan2(.137*1.5*Math.pow(Math.abs(u),.5)*Math.sign(u),.137));dummy.scale.set(1.12,.85,1);dummy.updateMatrix();chain.setMatrixAt(i,dummy.matrix);}
 chain.instanceMatrix.needsUpdate=true;chain.computeBoundingSphere();return chain;
}

export function originalWearables(root:THREE.Group,bones:Set<THREE.Bone>,height:number,look:{signature:string;wings:string;regalia?:string;mantle?:string;wristwear?:string;forearm?:string}){
 const parts:THREE.Mesh[]=[],hinges:THREE.Group[]=[];const anchors:THREE.Group[]=[];const textures:THREE.Texture[]=[];let time=0,lastMantle=0;let mantle:THREE.BufferGeometry|undefined,mantleBase:Float32Array|undefined;
 if(look.signature==='none'&&look.wings==='none'&&(!look.regalia||look.regalia==='none')&&(!look.mantle||look.mantle==='none')&&(!look.wristwear||look.wristwear==='none'))return {tick:(_dt:number)=>{},dispose:()=>{},width:0};
 const chest=[...bones].find(b=>/^(spine2|spine02|spine03|chest|upperchest|mixamorig:spine2)$/i.test(b.name))??[...bones].find(b=>/spine/i.test(b.name));
 if(!chest)throw Error('Original wearables require a torso bone');
 root.updateMatrixWorld(true);
 const fit=measureTorsoFit(root,height);
 const previousChest=chest.getWorldQuaternion(new THREE.Quaternion()),currentChest=new THREE.Quaternion();let clothLag=0;
 const attach=(x:number,y:number,z:number,width=1)=>{const g=new THREE.Group();root.add(g);g.position.set(x,y,z);g.scale.set(height/1.78*width,height/1.78,height/1.78);root.updateMatrixWorld(true);chest.attach(g);anchors.push(g);return g;};
 const metal=(color:number)=>new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.27,side:THREE.DoubleSide});
 if(look.signature!=='none'){
  const mount=attach(0,height*.76,height*.087+fit.front,fit.width);const color=look.signature==='silver-crown'?0xc4d4df:0xc9a45a;
  const m=new THREE.Mesh(crownGeometry(),metal(color));mount.add(m);parts.push(m);
  const chain=crownChain(new THREE.MeshStandardMaterial({color,metalness:.48,roughness:.28}));mount.add(chain);parts.push(chain);
  const bezel=new THREE.Mesh(new THREE.TorusGeometry(.013,.0028,8,24),new THREE.MeshStandardMaterial({color,metalness:.48,roughness:.24}));bezel.position.set(0,.005,.008);bezel.scale.set(.65,1,1);mount.add(bezel);parts.push(bezel);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.010,0),new THREE.MeshStandardMaterial({color:0x245a48,metalness:.12,roughness:.16}));gem.scale.set(.62,1,.65);gem.position.set(0,.005,.01);mount.add(gem);parts.push(gem);
 }
 if(look.regalia&&look.regalia!=='none'){
  const mount=attach(0,height*.73,height*.046+fit.front,fit.width);const tex=new THREE.DataTexture(regaliaTextile(look.regalia),128,128,THREE.RGBAFormat);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,2);tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;textures.push(tex);
  const m=new THREE.Mesh(regaliaGeometry(),new THREE.MeshStandardMaterial({map:tex,metalness:.22,roughness:.53,side:THREE.DoubleSide}));mount.add(m);parts.push(m);
 }
 if(look.mantle&&look.mantle!=='none'){
  const mount=attach(0,height*.82,-height*.095+fit.back,fit.width);mantle=mantleGeometry();mantleBase=new Float32Array(mantle.getAttribute('position').array);
  const tex=new THREE.DataTexture(regaliaTextile(look.mantle),128,128,THREE.RGBAFormat);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(3,4);tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;textures.push(tex);
  const m=new THREE.Mesh(mantle,new THREE.MeshStandardMaterial({map:tex,vertexColors:true,roughness:.79,side:THREE.DoubleSide}));mount.add(m);parts.push(m);
 }
 if(look.wristwear&&look.wristwear!=='none'){
  const wrist=wristBone(bones,'left');if(!wrist||!(wrist.parent instanceof THREE.Bone))throw Error('Meridian cuff requires a verified wrist and forearm joint');
  const wristPoint=wrist.getWorldPosition(new THREE.Vector3()),elbowPoint=wrist.parent.getWorldPosition(new THREE.Vector3()),axis=wristPoint.clone().sub(elbowPoint);if(axis.lengthSq()<.0004)throw Error('Meridian cuff wrist axis unavailable');axis.normalize();
  const size=cuffFit(height,look.forearm),mount=new THREE.Group();root.add(mount);mount.position.copy(wristPoint).addScaledVector(axis,-.032*size.length);mount.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);mount.scale.set(size.radial,size.length,size.radial);root.updateMatrixWorld(true);wrist.attach(mount);anchors.push(mount);
  const mesh=new THREE.Mesh(meridianCuffGeometry(look.wristwear),new THREE.MeshStandardMaterial({vertexColors:true,metalness:cuffMetalness(look.wristwear),roughness:cuffRoughness(look.wristwear),side:THREE.DoubleSide}));mount.add(mesh);parts.push(mesh);
 }
 if(look.wings!=='none'){
  const mount=attach(0,height*.76,-height*.10+fit.back,fit.width);
  for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.x=side*.105;hinge.scale.x=side;mount.add(hinge);const m=new THREE.Mesh(aegisGeometry(),metal(look.wings==='celestial-aegis'?0xc9bd9d:0x253341));m.material.vertexColors=true;m.material.emissive.setHex(look.wings==='celestial-aegis'?0x57418a:0x0c5d52);m.material.emissiveIntensity=.2;hinge.add(m);parts.push(m);hinges.push(hinge);}
 }
 return {width:look.wings==='none'?0:height*1.22*fit.width,tick:(dt:number)=>{if(!Number.isFinite(dt)||dt<=0)return;time+=Math.min(.075,dt);if(mantle&&mantleBase){chest.getWorldQuaternion(currentChest);clothLag=clothFollow(clothLag,previousChest.angleTo(currentChest),dt);previousChest.copy(currentChest);if(time-lastMantle>.067){lastMantle=time;animateMantle(mantle,mantleBase,time,clothLag);}}hinges.forEach((h,i)=>{h.rotation.y=(i?1:-1)*(.18+.13*Math.sin(time*1.7));h.rotation.z=(i?1:-1)*.045*Math.sin(time*1.7+.6);});},dispose:()=>{for(const p of parts){if((p as THREE.InstancedMesh).isInstancedMesh)(p as THREE.InstancedMesh).dispose();p.geometry.dispose();(p.material as THREE.Material).dispose();}textures.forEach(t=>t.dispose());anchors.forEach(a=>a.removeFromParent());}};
}

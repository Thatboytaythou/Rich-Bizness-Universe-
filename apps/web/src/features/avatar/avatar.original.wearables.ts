import * as THREE from 'three';
import {mantleGeometry,animateMantle} from './avatar.atlas.art.ts';
// Original Rich Bizness "Aegis" swept feather profiles and Crown Sigil wearable.
// Units: metres at adult scale. Closed cross-sections, mirrored at the wing hinge.
export function aegisGeometry(){
 const positions:number[]=[],indices:number[]=[];
 for(let feather=0;feather<12;feather++){
  const reach=.38+feather*.045, rise=.34-feather*.061, originX=.025+feather*.013,originY=.10-feather*.018;
  const base=positions.length/3;
  for(let i=0;i<=10;i++){
   const t=i/10,cx=originX+reach*t,cy=originY+rise*t+.14*Math.sin(Math.PI*t),cz=-.045*Math.sin(Math.PI*t);
   const width=(.012+.043*Math.sin(Math.PI*t))*(1-.82*t),thickness=.003+.009*Math.sin(Math.PI*t);
   for(let k=0;k<8;k++){const a=k*Math.PI/4;positions.push(cx,cy+Math.cos(a)*width,cz+Math.sin(a)*thickness);}
  }
  for(let i=0;i<10;i++)for(let k=0;k<8;k++){const a=base+i*8+k,b=base+i*8+(k+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);}
  for(let k=1;k<7;k++){indices.push(base,base+k+1,base+k);const tip=base+80;indices.push(tip,tip+k,tip+k+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;
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
  v.push(Math.sin(a)*radius,y,Math.cos(a)*(.075+.038*Math.sin(Math.PI*t))+(layer===0?.009:0));
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
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=x%32,b=y%32,d=Math.abs(a-16)+Math.abs(b-16);const line=Math.abs(d-13)<1.6||Math.abs(d-8)<.9;const crown=b>=13&&b<=21&&a>=10&&a<=22&&(b===21||Math.abs(a-16)+b<=18);const thread=((x+y)%3)-1;const k=(y*size+x)*4;for(let c=0;c<3;c++)data[k+c]=Math.max(0,Math.min(255,palette[(line||crown?3:0)+c]+thread*7));data[k+3]=255;}
 return data;
}

export function originalWearables(root:THREE.Group,bones:Set<THREE.Bone>,height:number,look:{signature:string;wings:string;regalia?:string;mantle?:string}){
 const parts:THREE.Mesh[]=[],hinges:THREE.Group[]=[];const anchors:THREE.Group[]=[];const textures:THREE.Texture[]=[];let time=0,lastMantle=0;let mantle:THREE.BufferGeometry|undefined,mantleBase:Float32Array|undefined;
 if(look.signature==='none'&&look.wings==='none'&&(!look.regalia||look.regalia==='none')&&(!look.mantle||look.mantle==='none'))return {tick:(_dt:number)=>{},dispose:()=>{},width:0};
 const chest=[...bones].find(b=>/^(spine2|spine02|spine03|chest|upperchest|mixamorig:spine2)$/i.test(b.name))??[...bones].find(b=>/spine/i.test(b.name));
 if(!chest)throw Error('Original wearables require a torso bone');
 root.updateMatrixWorld(true);
 const attach=(x:number,y:number,z:number)=>{const g=new THREE.Group();root.add(g);g.position.set(x,y,z);g.scale.setScalar(height/1.78);root.updateMatrixWorld(true);chest.attach(g);anchors.push(g);return g;};
 const metal=(color:number)=>new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.27,side:THREE.DoubleSide});
 if(look.signature!=='none'){
  const mount=attach(0,height*.76,height*.087);const m=new THREE.Mesh(crownGeometry(),metal(look.signature==='silver-crown'?0xc4d4df:0xc9a45a));mount.add(m);parts.push(m);
 }
 if(look.regalia&&look.regalia!=='none'){
  const mount=attach(0,height*.73,height*.046);const tex=new THREE.DataTexture(regaliaTextile(look.regalia),128,128,THREE.RGBAFormat);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,2);tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;textures.push(tex);
  const m=new THREE.Mesh(regaliaGeometry(),new THREE.MeshStandardMaterial({map:tex,metalness:.22,roughness:.53,side:THREE.DoubleSide}));mount.add(m);parts.push(m);
 }
 if(look.mantle&&look.mantle!=='none'){
  const mount=attach(0,height*.82,-height*.095);mantle=mantleGeometry();mantleBase=new Float32Array(mantle.getAttribute('position').array);
  const tex=new THREE.DataTexture(regaliaTextile(look.mantle),128,128,THREE.RGBAFormat);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(3,4);tex.needsUpdate=true;textures.push(tex);
  const m=new THREE.Mesh(mantle,new THREE.MeshStandardMaterial({map:tex,roughness:.79,side:THREE.DoubleSide}));mount.add(m);parts.push(m);
 }
 if(look.wings!=='none'){
  const mount=attach(0,height*.76,-height*.10);
  for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.x=side*.105;hinge.scale.x=side;mount.add(hinge);const m=new THREE.Mesh(aegisGeometry(),metal(look.wings==='celestial-aegis'?0xc9bd9d:0x253341));m.material.emissive.setHex(look.wings==='celestial-aegis'?0x57418a:0x0c5d52);m.material.emissiveIntensity=.2;hinge.add(m);parts.push(m);hinges.push(hinge);}
 }
 return {width:look.wings==='none'?0:height*1.22,tick:(dt:number)=>{time+=Math.min(.075,dt);if(mantle&&mantleBase&&time-lastMantle>.067){lastMantle=time;animateMantle(mantle,mantleBase,time);}hinges.forEach((h,i)=>{h.rotation.y=(i?1:-1)*(.18+.13*Math.sin(time*1.7));h.rotation.z=(i?1:-1)*.045*Math.sin(time*1.7+.6);});},dispose:()=>{for(const p of parts){p.geometry.dispose();(p.material as THREE.Material).dispose();}textures.forEach(t=>t.dispose());anchors.forEach(a=>a.removeFromParent());}};
}

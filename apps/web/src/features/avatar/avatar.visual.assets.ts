import * as THREE from 'three';
// Original geometry, in metres, with no downloaded asset or additional render pass.
export function automotiveShell(sections:readonly (readonly number[])[],segments=24){
 const v:number[]=[],uv:number[]=[],ix:number[]=[];
 for(let j=0;j<sections.length;j++){const [z,w,base,top]=sections[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;v.push(Math.cos(a)*w,(base+top)/2+Math.sin(a)*(top-base)/2,z);uv.push(i/segments,j/(sections.length-1));}}
 const stride=segments+1;
 for(let j=0;j<sections.length-1;j++)for(let k=0;k<segments;k++){const a=j*stride+k;ix.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);}
 for(let k=1;k<segments-1;k++){ix.push(0,k+1,k);const n=(sections.length-1)*stride;ix.push(n,n+k,n+k+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
// A single crown of individually curved leaf blades, repeated through GPU instancing.
export function foliageGeometry(mobile:boolean){
 const v:number[]=[],c:number[]=[],ix:number[]=[];let seed=57231;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const count=mobile?100:190;const up=new THREE.Vector3(0,1,0);
 for(let i=0;i<count;i++){
  const az=rand()*Math.PI*2,y=rand()*2-1,r=Math.sqrt(1-y*y),radius=.45+.53*Math.cbrt(rand());
  const center=new THREE.Vector3(Math.cos(az)*r,y,Math.sin(az)*r).multiplyScalar(radius);
  const along=new THREE.Vector3(Math.cos(az),.25+rand()*.8,Math.sin(az)).normalize();
  const side=new THREE.Vector3().crossVectors(along,up).normalize();const length=.24+rand()*.26,width=.095+rand()*.1;
  const shade=.48+rand()*.46;const col=new THREE.Color().setRGB(.12*shade,.31*shade,.085*shade);
  const base=v.length/3;
  for(const [t,w] of [[0,0],[.32,-1],[.32,1],[.68,-.72],[.68,.72],[1,0]]){
   const p=center.clone().addScaledVector(along,(t-.5)*length).addScaledVector(side,w*width);p.y+=Math.sin(t*Math.PI)*.055;v.push(p.x,p.y,p.z);const light=w===0?1.16:1;c.push(col.r*light,col.g*light,col.b*light);
  }
  ix.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
// A tiny repeating woven normal tile. Existing artist-authored normals always take priority.
export function weaveNormal(){
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=x*Math.PI/4,b=y*Math.PI/4;const nx=.16*Math.cos(a)*Math.sin(b),ny=.16*Math.sin(a)*Math.cos(b),nz=Math.sqrt(1-nx*nx-ny*ny),i=(y*n+x)*4;data[i]=Math.round(127.5*(nx+1));data[i+1]=Math.round(127.5*(ny+1));data[i+2]=Math.round(127.5*(nz+1));data[i+3]=255;}
 const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(20,20);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

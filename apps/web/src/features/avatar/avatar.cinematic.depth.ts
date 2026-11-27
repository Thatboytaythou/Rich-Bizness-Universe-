import * as THREE from 'three';
// Shared, small gradient textures and geometric depth. No extra render targets or postprocessing.
export function createCinematicSky(){
 const material=new THREE.ShaderMaterial({uniforms:{zenith:{value:new THREE.Color(0x477cae)},horizon:{value:new THREE.Color(0xd8e2e1)},sunTint:{value:new THREE.Color(0xffd2a0)},sunDir:{value:new THREE.Vector3(-.56,.56,.48).normalize()}},vertexShader:'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vDir; uniform vec3 zenith,horizon,sunTint,sunDir; void main(){vec3 d=normalize(vDir); float h=pow(clamp(d.y,0.0,1.0),0.55); float glow=pow(max(dot(d,sunDir),0.0),14.0); vec3 c=mix(horizon,zenith,h)+sunTint*glow*0.32; gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',side:THREE.BackSide,depthWrite:false,fog:false});
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(145,24,12),material);mesh.renderOrder=-100;mesh.frustumCulled=false;
 return mesh;
}
export function createGroundShade(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const radius=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));const a=Math.max(0,1-radius);const i=(y*size+x)*4;data[i+3]=Math.round(190*a*a);}
 const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearFilter;map.needsUpdate=true;return map;
}
export function groundShadeMesh(map:THREE.Texture,width:number,length:number){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,length),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;return mesh;
}
// A lightweight window gradient supplies visible glass depth without a second scene render.
export function glassGradient(){
 const data=new Uint8Array(16*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<16;x++){const t=y/63,k=(y*16+x)*4;const band=Math.exp(-Math.pow((t-.72)/.13,2));data[k]=Math.round(48+66*t+30*band);data[k+1]=Math.round(72+84*t+32*band);data[k+2]=Math.round(92+91*t+28*band);data[k+3]=255;}
 const map=new THREE.DataTexture(data,16,64,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearFilter;map.needsUpdate=true;return map;
}

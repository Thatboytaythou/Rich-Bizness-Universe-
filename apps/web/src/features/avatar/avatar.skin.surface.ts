import * as THREE from 'three';
// Original deterministic, tileable skin microrelief. Red = height, green = relative roughness.
// No skin color replacement, shader injection, external image, or extra render pass.
export function skinMicroSurface(size=128){
 const data=new Uint8Array(size*size*4),height=new Float32Array(size*size);
 let seed=8317;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const grid=16,cell=size/grid;
 for(let j=0;j<grid;j++)for(let i=0;i<grid;i++){
  const cx=(i+.2+.6*random())*cell,cy=(j+.2+.6*random())*cell,rx=.65+.65*random(),ry=.75+.7*random(),depth=.65+.35*random();
  for(let y=Math.floor(cy-4);y<=Math.ceil(cy+4);y++)for(let x=Math.floor(cx-4);x<=Math.ceil(cx+4);x++){
   const dx=(x-cx)/rx,dy=(y-cy)/ry,r2=dx*dx+dy*dy;
   const index=((y%size+size)%size)*size+(x%size+size)%size;
   height[index]=(height[index]??0)+-depth*Math.exp(-r2*.9)+.12*Math.exp(-Math.pow(Math.sqrt(r2)-1.6,2)*3);
  }
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const idx=y*size+x,u=x/size*Math.PI*2,v=y/size*Math.PI*2;
  const creases=.07*Math.sin(u*7+Math.sin(v*3))+.045*Math.cos(v*9+Math.sin(u*4));
  const value=(height[idx]??0)+creases,k=idx*4;
  data[k]=Math.round(THREE.MathUtils.clamp(144+52*value,65,180));
  data[k+1]=Math.round(THREE.MathUtils.clamp(238+15*value,202,250));
  data[k+2]=255;data[k+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(9,9);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;return texture;
}
export function skinFinishRoughness(finish:string,portrait:boolean,fantasy:boolean){
 return finish==='matte'?.76:finish==='soft-glow'?.48:portrait?.61:fantasy?.64:.69;
}
export function applyNaturalSkin(material:THREE.MeshStandardMaterial,finish:string,portrait:boolean,fantasy:boolean,detail:boolean,makeSurface:()=>THREE.DataTexture){
 material.metalness=0;material.roughness=skinFinishRoughness(finish,portrait,fantasy);
 material.envMapIntensity=portrait?.62:.48;
 if(material.normalMap){material.normalScale.setScalar(portrait?.82:.68);}
 // Preserve authored maps; only fill absent channels on detail-capable devices.
 if(detail&&material.map){
  if(!material.normalMap&&!material.bumpMap){material.bumpMap=makeSurface();material.bumpScale=portrait?.0011:.0007;material.needsUpdate=true;}
  if(!material.roughnessMap){material.roughnessMap=makeSurface();material.needsUpdate=true;}
 }
}

// Apply a conservative directional sheen to the existing hair/facial-hair mesh.
// Retain opacity, hair-card textures, normals, and the chosen hair color.
export function naturalHairMaterial(material:THREE.MeshStandardMaterial,kind:'hair'|'facial'){
 material.metalness=0;
 material.roughness=kind==='facial'?.78:.64;
 material.envMapIntensity=kind==='facial'?.28:.42;
}

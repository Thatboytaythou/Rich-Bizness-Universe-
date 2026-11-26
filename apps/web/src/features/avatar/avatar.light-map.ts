import * as THREE from 'three';
// Small studio reflection map: broad neutral light cards, no remote textures or custom shaders.
export function createCharacterLightMap(renderer:THREE.WebGLRenderer){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d')!;const g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,'#828993');g.addColorStop(.52,'#454a4d');g.addColorStop(1,'#202020');ctx.fillStyle=g;ctx.fillRect(0,0,256,128);
  for(const card of [{x:30,y:24,w:37,h:43,c:'#f6ead9'},{x:163,y:36,w:29,h:45,c:'#bccde2'},{x:105,y:12,w:43,h:15,c:'#e4e7e9'}]){ctx.fillStyle=card.c;ctx.fillRect(card.x,card.y,card.w,card.h);}
  const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);
  try{return pmrem.fromEquirectangular(texture);}finally{texture.dispose();pmrem.dispose();}
}

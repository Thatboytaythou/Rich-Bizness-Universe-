import * as THREE from 'three';
import type {CharacterLook} from './avatar.character.config';
import type {AvatarMotion} from './avatar.skinned.runtime';

// Lightweight deterministic secondary deformation, not a cloth or strand simulator.
export function attachCharacterDetail(group:THREE.Group,look:CharacterLook,high:boolean){
  const time={value:0},sway={value:0},materials=new Set<THREE.Material>();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  const image=ctx.createImageData(128,128);let seed=6321;
  for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=112+(seed>>>27);image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;}
  ctx.putImageData(image,0,0);
  const micro=new THREE.CanvasTexture(canvas);micro.wrapS=micro.wrapT=THREE.RepeatWrapping;micro.repeat.set(30,30);micro.colorSpace=THREE.NoColorSpace;
  group.traverse(o=>{
    const mesh=o as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
    const mat=mesh.material as THREE.MeshStandardMaterial;if(!mat?.isMeshStandardMaterial)return;
    if(mesh.name==='body'){
      mat.roughness=look.skinFinish==='matte'?.76:look.skinFinish==='soft-glow'?.49:.64;
      mat.metalness=0;
      if(high){mat.bumpMap=micro;mat.bumpScale=.00045;}
      const previous=mat.onBeforeCompile.bind(mat),cache=mat.customProgramCacheKey.bind(mat);
      mat.onBeforeCompile=(shader,renderer)=>{previous(shader,renderer);
        // Broad, restrained skin gloss variation from existing skin albedo.
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (0.35-dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)))*0.12,0.42,0.86);');};
      mat.customProgramCacheKey=()=>cache()+'|rb-skin-detail-v17';mat.needsUpdate=true;
    }
    if(mesh.name.startsWith('eyes-')){mat.roughness=.19;mat.metalness=0;mat.needsUpdate=true;}
    const longHair=mesh.name.startsWith('hair-')&&['long','braids','ponytail','bob','blunt-bangs'].includes(look.hair);
    const fabric=mesh.name.startsWith('clothes-')&&!/shoes|fedora/.test(mesh.name);
    if(!longHair&&!fabric)return;
    mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;if(!box)return;
    const lo=box.min.y,span=Math.max(.03,box.max.y-lo);
    // Move only low-weight free ends; fitted garments get sub-millimeter material movement.
    const amplitude=longHair?.013:.0008;
    if(materials.has(mat))return;materials.add(mat);
    const previous=mat.onBeforeCompile.bind(mat),cache=mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile=(shader,renderer)=>{previous(shader,renderer);
      shader.uniforms.rbTime=time;shader.uniforms.rbSway=sway;shader.uniforms.rbLow={value:lo};shader.uniforms.rbSpan={value:span};shader.uniforms.rbAmp={value:amplitude};
      shader.vertexShader='uniform float rbTime; uniform float rbSway; uniform float rbLow; uniform float rbSpan; uniform float rbAmp;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','#include <skinning_vertex>\nfloat rbWeight = 1.0-smoothstep(0.0,0.56,(position.y-rbLow)/rbSpan); transformed.x += rbAmp * rbWeight * rbSway * sin(rbTime*7.0+position.y*12.0); transformed.z += rbAmp*0.65*rbWeight*rbSway*sin(rbTime*5.0+position.x*15.0);');
    };mat.customProgramCacheKey=()=>cache()+'|rb-secondary-v17';mat.needsUpdate=true;
  });
  return {tick:(dt:number,motion:AvatarMotion)=>{time.value+=dt;const target=motion==='run'?1:motion==='walk'?.52:motion==='jump'?.9:motion==='power'?.4:.12;sway.value+=(target-sway.value)*(1-Math.exp(-dt*7));},dispose:()=>micro.dispose()};
}

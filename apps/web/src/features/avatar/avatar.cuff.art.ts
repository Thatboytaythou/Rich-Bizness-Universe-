import * as THREE from 'three';
export const CUFF_STYLES=['gold-cuff','silver-cuff','onyx-band'] as const;
// Original Rich Bizness Meridian cuff: closed hollow band, beveled lips,
// recessed channels and sculpted diamond facets, axis +Y in metres.
export function meridianCuffGeometry(style:string){
 const segments=48,positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const gold=style==='gold-cuff',onyx=style==='onyx-band';
 const base=new THREE.Color(gold?0xc7a452:onyx?0x25302e:0xbac9d2);
 const inlay=new THREE.Color(gold?0x62491c:onyx?0xb9a364:0x465763);
 // Cross-section travels around the solid wall: outer lower -> outer upper -> inner upper -> inner lower.
 const rings=[[-.021,.036],[-.019,.041],[-.015,.043],[-.010,.041],[0,.043],[.010,.041],[.015,.043],[.019,.041],[.021,.036],[.018,.033],[-.018,.033]];
 for(let j=0;j<rings.length;j++){const [y,r]=rings[j];for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,facet=Math.pow(Math.max(0,Math.cos(a*8)),5),relief=j>=3&&j<=5?.0018*facet*(j===4?1:.45):0;
  positions.push(Math.cos(a)*(r+relief),y,Math.sin(a)*(r+relief)*.83);
  const c=base.clone().lerp(inlay,j===3||j===5?.65:j===4?.12+.35*(1-facet):j>=9?.55:.08);
  colors.push(c.r,c.g,c.b);
 }}
 for(let j=0;j<rings.length;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=((j+1)%rings.length)*segments+i,d=((j+1)%rings.length)*segments+(i+1)%segments;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function cuffMetalness(style:string){return style==='onyx-band'?.28:.68;}
export function cuffRoughness(style:string){return style==='onyx-band'?.48:.32;}
// Recognize the pinned humanoid rig's hand/wrist names without treating finger joints as wrists.
export function wristBone(bones:Iterable<THREE.Bone>,side:'left'|'right'){
 const list=[...bones],s=side==='left'?'l':'r';
 const score=(b:THREE.Bone)=>{const n=b.name.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^mixamorig/,'');if(/finger|thumb|index|middle|ring|pinky|twist/.test(n))return 0;return n===side+'hand'||n==='hand'+s||n===s+'hand'?3:n===side+'wrist'||n==='wrist'+s||n===s+'wrist'?2:0;};
 return list.filter(b=>score(b)>0).sort((a,b)=>score(b)-score(a))[0];
}
export function cuffFit(height:number,forearm:string|undefined){
 const size=Number.isFinite(height)?THREE.MathUtils.clamp(height/1.78,.65,1.45):1;
 const sculpt=Number(forearm??0);return {length:size,radial:size*THREE.MathUtils.clamp(1+(Number.isFinite(sculpt)?sculpt:0)*.0018,.82,1.18)};
}

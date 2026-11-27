import * as THREE from 'three';
// Pinned Ara catalog naming, including material IDs which have no "skin" or "hair" prefix.
// Prioritize facial mesh names for the vendor's shared bodyMaterial eyelash material.
export type SurfaceRole='skin'|'hair'|'facial-hair'|'eye'|'cornea'|'face-detail'|'tailoring'|'denim'|'knit'|'techwear'|'fabric'|'unknown';
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function surfaceRole(material:string,mesh=''):SurfaceRole{
 const m=norm(material),n=norm(mesh),both=m+' '+n;
 if(/eyelash|eylash|eyebrow|teeth|tongue|gum|tooth|nail/.test(both))return 'face-detail';
 if(/beard|mustache|moustache|stubble|facialhair/.test(both))return 'facial-hair';
 if(/cornea/.test(both))return 'cornea';
 if(/^eye(?:s|blue|brown|black|deep|green|grey|ice|light|mesh|material|ball|iris|[0-9]|$)/.test(m)||/eyeball|eyemesh|iris/.test(n))return 'eye';
 if(/hair/.test(m)||/^(afro|bob|braid|long|ponytail|short)[0-9]+$/.test(m)||/hair/.test(n)||/^(afro|bob|braid|long|ponytail|short)[0-9]+$/.test(n))return 'hair';
 if(/shoe|boot|sneaker|oxford|leather|metal|visor|fedora|watch|ring|chain/.test(m))return 'unknown';
 if(/denim|jeans/.test(both))return 'denim';
 if(/techwear|sportsuit|sportswear|nylon/.test(both))return 'techwear';
 if(/elegantsuit|suitjacket|suittrousers|tailor|suiting/.test(both))return 'tailoring';
 if(/oversizedtee|knit|jersey|hoodie|sweater/.test(both))return 'knit';
 if(/cloth|shirt|jacket|coat|pants|trouser|dress|suit|fabric|textile|vest/.test(both))return 'fabric';
 if(/skin|bodymaterial|^(young|middleage|old)(african|asian|cauasian|caucasian)(male|female)/.test(m)||/^(body|humanbody|basebody|skin|malegeneric|femalegeneric)[0-9]*$/.test(n))return 'skin';
 return 'unknown';
}
export function fabricFinish(role:SurfaceRole){return role==='denim'?{roughness:.88,normal:.72}:role==='tailoring'?{roughness:.72,normal:.45}:role==='techwear'?{roughness:.57,normal:.35}:role==='knit'?{roughness:.87,normal:.65}:{roughness:.79,normal:.5};}
// Compact original directional strand relief, used only when a hair asset lacks an authored normal.
// Periodic along both UV axes; does not replace transparency or base color.
export function hairStrandNormal(){
 const n=64,data=new Uint8Array(n*n*4),h=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=x/n*2*Math.PI,v=y/n*2*Math.PI;h[y*n+x]=.7*Math.cos(12*u+.45*Math.sin(2*v))+.21*Math.cos(23*u-.3*Math.sin(3*v))+.07*Math.sin(3*v+2*u);}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(h[y*n+(x+1)%n]-h[y*n+(x+n-1)%n])*.13,dy=(h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x])*.13,inv=1/Math.hypot(dx,dy,1),i=(y*n+x)*4;data[i]=Math.round((1-dx*inv)*127.5);data[i+1]=Math.round((1-dy*inv)*127.5);data[i+2]=Math.round((1+inv)*127.5);data[i+3]=255;}
 const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

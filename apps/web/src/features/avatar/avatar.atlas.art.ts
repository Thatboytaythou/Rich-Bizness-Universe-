import * as THREE from 'three';
// Original Atlas footwear: closed layered sole and sculpted upper in metres, forward +Z.
// The standalone asset is not a replacement for the existing skinned shoe fit.
export function atlasShoeGeometry(){
 const v:number[]=[],uv:number[]=[],ix:number[]=[];
 const sections: [number,number,number][]=[[-.135,.039,.027],[-.109,.049,.095],[-.065,.053,.116],[0,.054,.079],[.057,.061,.057],[.108,.055,.047],[.143,.036,.032],[.152,.009,.024]];
 for(let j=0;j<sections.length;j++){const [z,w,h]=sections[j]!;for(let k=0;k<24;k++){const a=2*Math.PI*k/24;v.push(Math.cos(a)*w,.02+Math.max(0,Math.sin(a))*h+Math.min(0,Math.sin(a))*.018,z);uv.push(k/24,j/(sections.length-1));}}
 for(let j=0;j<sections.length-1;j++)for(let k=0;k<24;k++){const a=j*24+k,b=j*24+(k+1)%24;ix.push(a,b,a+24,b,b+24,a+24);}
 for(let k=1;k<23;k++){ix.push(0,k+1,k);const n=(sections.length-1)*24;ix.push(n,n+k,n+k+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();return g;
}
// Original Sovereign mantle: shaped shoulder yoke, tailored waist, scalloped hem,
// woven edge finish and controlled cloth ripples. Same 837-vertex mobile budget.
export function mantleGeometry(){
 const v:number[]=[],uv:number[]=[],ix:number[]=[],color:number[]=[];const rows=26,cols=30;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,u=i/cols,s=u*2-1,edge=Math.abs(s);
  const width=.36+.32*t+.10*t*t-.08*Math.sin(Math.PI*t);
  const x=s*width/2;
  const y=.12-.83*t-.035*t*t*(1-edge*edge)+.033*t*t*Math.cos(s*Math.PI*2);
  const seam=.008*Math.exp(-Math.pow((edge-.83)/.065,2))*Math.sin(Math.PI*t);const drape=.006*Math.cos((s*2+t*1.3)*Math.PI*2)*Math.sin(Math.PI*t)**2;
  const fold=.023*Math.sin(s*Math.PI*4)*Math.sin(Math.PI*t*.85)+.025*Math.cos(s*Math.PI*3)*t*t+seam+drape;
  const z=-.035-.105*t-.035*edge*edge*(1-t)-fold;
  v.push(x,y,z);uv.push(u,1-t);
  const trim=Math.max(0,(edge-.86)/.14, (t-.91)/.09,.72*Math.exp(-Math.pow((edge-.79)/.024,2))*Math.sin(Math.PI*t));
  const shade=.87+.08*Math.cos(s*Math.PI*4)*Math.sin(Math.PI*t);
  color.push(shade+(1-shade)*trim,shade*(1-.13*trim),shade*(1-.22*trim));
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1;ix.push(a,c,b,b,c,c+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 // Conservative motion bounds avoid frame-dependent culling at the hem.
 if(g.boundingSphere)g.boundingSphere.radius+=.07;
 if(g.boundingBox){g.boundingBox.min.z-=.055;g.boundingBox.max.z+=.055;}
 return g;
}
export function animateMantle(g:THREE.BufferGeometry,base:Float32Array,time:number,lag=0){
 const p=g.getAttribute('position'),uv=g.getAttribute('uv');if(!Number.isFinite(time)||base.length!==p.count*3)return;
 for(let i=0;i<p.count;i++){
  const t=1-uv.getY(i),x=base[i*3],z=base[i*3+2],weight=t*t;if(x===undefined||z===undefined)continue;
  const follow=Number.isFinite(lag)?THREE.MathUtils.clamp(lag,0,.03):0;
  const ripple=THREE.MathUtils.clamp(.028*Math.sin(time*2.1+x*9)+.012*Math.sin(time*3.4-x*17)+.009*Math.sin(time*1.3)+follow,-.049,.049);
  p.setZ(i,z-weight*ripple);
 }
 p.needsUpdate=true;g.computeVertexNormals();
}

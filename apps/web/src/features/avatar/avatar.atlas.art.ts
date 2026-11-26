import * as THREE from 'three';
// Original Atlas footwear: closed layered sole and sculpted upper in metres, forward +Z.
// The standalone asset is not a replacement for the existing skinned shoe fit.
export function atlasShoeGeometry(){
 const v:number[]=[],uv:number[]=[],ix:number[]=[];
 const sections=[[-.135,.039,.027],[-.109,.049,.095],[-.065,.053,.116],[0,.054,.079],[.057,.061,.057],[.108,.055,.047],[.143,.036,.032],[.152,.009,.024]];
 for(let j=0;j<sections.length;j++){const [z,w,h]=sections[j];for(let k=0;k<24;k++){const a=2*Math.PI*k/24;v.push(Math.cos(a)*w,.02+Math.max(0,Math.sin(a))*h+Math.min(0,Math.sin(a))*.018,z);uv.push(k/24,j/(sections.length-1));}}
 for(let j=0;j<sections.length-1;j++)for(let k=0;k<24;k++){const a=j*24+k,b=j*24+(k+1)%24;ix.push(a,b,a+24,b,b+24,a+24);}
 for(let k=1;k<23;k++){ix.push(0,k+1,k);const n=(sections.length-1)*24;ix.push(n,n+k,n+k+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();return g;
}
// Original draped mantle; three-dimensional ripple profile, independent of the human mesh.
export function mantleGeometry(){
 const v:number[]=[],uv:number[]=[],ix:number[]=[];const rows=26,cols=30;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const t=j/rows,u=i/cols,x=(u-.5)*(.30+.42*t);v.push(x,.12-.83*t,-.035-.10*t-.065*Math.sin(u*Math.PI*7)*t);uv.push(u,1-t);}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1;ix.push(a,c,b,b,c,c+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function animateMantle(g:THREE.BufferGeometry,base:Float32Array,time:number){
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const t=Math.max(0,(.12-base[i*3+1])/.83);p.setZ(i,base[i*3+2]-.032*t*t*Math.sin(time*2.1+base[i*3]*9));}p.needsUpdate=true;g.computeVertexNormals();
}

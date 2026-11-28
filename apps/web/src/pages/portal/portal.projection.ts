/** Original perspective projection; no WebGL dependency or extra render surface. */
export function projectPortal(x:number,y:number,z:number,rx:number,ry:number){
 const cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx);
 const a=x*cy+z*sy,b=-x*sy+z*cy;
 const c=y*cx-b*sx,d=y*sx+b*cx;
 const scale=4/Math.max(1,4-d);
 return {x:a*scale,y:c*scale,depth:d,scale};
}
export function portalRing(radius:number,segments:number,phase:number,rx:number,ry:number){
 return Array.from({length:segments+1},(_,i)=>{const a=phase+i/segments*Math.PI*2;return projectPortal(radius*Math.cos(a),radius*Math.sin(a),.15*Math.sin(a*2),rx,ry);});
}

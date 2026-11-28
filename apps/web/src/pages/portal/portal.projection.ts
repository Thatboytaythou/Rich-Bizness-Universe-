/** Original perspective projection; reuse a ring buffer and shared rotation per ring. */
export type PortalPoint={x:number;y:number;depth:number;scale:number};
function rotation(rx:number,ry:number){return {cy:Math.cos(ry),sy:Math.sin(ry),cx:Math.cos(rx),sx:Math.sin(rx)};}
function projectInto(out:PortalPoint,x:number,y:number,z:number,r:ReturnType<typeof rotation>){
 const a=x*r.cy+z*r.sy,b=-x*r.sy+z*r.cy,c=y*r.cx-b*r.sx,d=y*r.sx+b*r.cx;
 const scale=4/Math.max(1,4-d);out.x=a*scale;out.y=c*scale;out.depth=d;out.scale=scale;return out;
}
export function projectPortal(x:number,y:number,z:number,rx:number,ry:number){return projectInto({x:0,y:0,depth:0,scale:1},x,y,z,rotation(rx,ry));}
export function portalRing(radius:number,segments:number,phase:number,rx:number,ry:number,buffer?:PortalPoint[]){
 const count=Math.max(3,Math.min(128,Math.floor(segments)||3)),r=rotation(rx,ry);
 const points=buffer??[];while(points.length<count+1)points.push({x:0,y:0,depth:0,scale:1});points.length=count+1;
 for(let i=0;i<=count;i++){const a=phase+i/count*Math.PI*2;projectInto(points[i]!,radius*Math.cos(a),radius*Math.sin(a),.15*Math.sin(a*2),r);}
 return points;
}

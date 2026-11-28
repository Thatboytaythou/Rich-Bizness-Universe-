// Clip the orbit ray against expanded solid obstacles to keep the follow camera on the avatar's side.
export function cameraClearance(x:number,z:number,tx:number,tz:number,obstacles:{minX:number;maxX:number;minZ:number;maxZ:number}[]):number{
 const dx=tx-x,dz=tz-z;let fraction=1;
 for(const b of obstacles){let lo=0,hi=1;
  if(x>=b.minX-.12&&x<=b.maxX+.12&&z>=b.minZ-.12&&z<=b.maxZ+.12)continue;
  for(const [start,delta,min,max] of ([[x,dx,b.minX-.12,b.maxX+.12],[z,dz,b.minZ-.12,b.maxZ+.12]] as const)){
   if(Math.abs(delta)<1e-6){if(start<min||start>max){lo=2;break;}continue;}
   const a=(min-start)/delta,c=(max-start)/delta;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));
  }
  if(lo<=hi&&lo>=0&&lo<=1)fraction=Math.min(fraction,Math.max(.08,lo-.06));
 }
 return fraction;
}

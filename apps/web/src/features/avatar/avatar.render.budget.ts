// Shared render budget policy: bounded quality, hysteresis and sustained measurement.
export function nextRenderScale(current:number,averageMs:number,samples:number,mobile:boolean){
 if(!Number.isFinite(averageMs)||samples<30)return current;
 const next=averageMs>(mobile?46:32)?current-.10:averageMs<(mobile?35:21)?current+.06:current;
 return Math.round(Math.min(1,Math.max(.65,next))*100)/100;
}

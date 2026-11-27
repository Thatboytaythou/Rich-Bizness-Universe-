// Resolution limits are in actual canvas pixels, not CSS pixels. Start safe.
export type PhoneQuality='auto'|'detail';
export function phoneRenderLimit(quality:PhoneQuality,frameMs:number,samples:number,current:number){
 const maximum=quality==='detail'?900:640;
 if(!Number.isFinite(frameMs)||samples<90)return Math.min(640,maximum,current);
 if(frameMs>51)return Math.max(480,Math.min(maximum,current-80));
 if(frameMs<37)return Math.min(maximum,current+64);
 return Math.min(maximum,current);
}
export const PHONE_TRIANGLE_BUDGET={auto:60000,detail:75000} as const;
export function phoneTriangleBudget(quality:PhoneQuality){return PHONE_TRIANGLE_BUDGET[quality];}
// Prefer the existing medium mesh for both modes. A budget-rejected fit retries
// the lower-density mesh; never request the unbounded desktop high mesh on phones.
export function mobileDetail(_quality:PhoneQuality,fallback=false):'low'|'medium'{return fallback?'low':'medium';}
export function admitsPhoneMesh(quality:PhoneQuality,triangles:number){return Number.isFinite(triangles)&&triangles>=0&&triangles<=phoneTriangleBudget(quality);}
export function smoothPlayback(previous:number,target:number,dt:number){
 return previous+(target-previous)*(1-Math.exp(-Math.max(0,Math.min(.075,dt))*10));
}

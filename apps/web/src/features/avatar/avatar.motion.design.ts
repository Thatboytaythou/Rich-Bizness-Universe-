export const CREATOR_CLIPS=['wave','look around','bow','talk gestures','catwalk','relaxed walk','clap','point','thumbs up','groove','bounce','laugh','turn left','turn right','talk','soft laugh'] as const;
export function normalizeRoutine(raw:unknown):string[]{return Array.isArray(raw)?raw.filter(x=>typeof x==='string'&&(CREATOR_CLIPS as readonly string[]).includes(x)).slice(0,12):[];}

export type MotionStep={clip:string;speed:number;blend:number};
const bounded=(v:unknown,min:number,max:number,def:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):def;
export function normalizeTimeline(raw:unknown,fallback:unknown=[]):MotionStep[]{
 const items=Array.isArray(raw)?raw:normalizeRoutine(fallback);
 return items.flatMap(v=>{const x=typeof v==='string'?{clip:v}:v&&typeof v==='object'?v as Record<string,unknown>:{};if(typeof x.clip!=='string'||!(CREATOR_CLIPS as readonly string[]).includes(x.clip))return [];return [{clip:x.clip,speed:bounded(x.speed,.5,1.5,1),blend:bounded(x.blend,.05,.65,.2)}];}).slice(0,12);
}

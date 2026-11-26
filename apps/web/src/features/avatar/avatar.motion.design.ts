export const CREATOR_CLIPS=['wave','look around','bow','talk gestures','catwalk','relaxed walk','clap','point','thumbs up','groove','bounce','laugh','turn left','turn right','talk','soft laugh'] as const;
export function normalizeRoutine(raw:unknown):string[]{return Array.isArray(raw)?raw.filter(x=>typeof x==='string'&&(CREATOR_CLIPS as readonly string[]).includes(x)).slice(0,12):[];}

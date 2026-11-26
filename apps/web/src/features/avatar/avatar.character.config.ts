export const CHARACTER_RIG='rb-original-human-v1';
export const CHARACTER_OPTIONS={
  skin:['deep','warm','tan','light'],
  face:['angular','soft','strong'],
  hair:['fade','curls','braids','long','bald'],
  eyes:['brown','hazel','blue'],
  top:['jacket','tee','hoodie','vest'],
  pants:['cargo','denim','tailored'],
  shoes:['sneakers','boots','high-tops'],
  tattoo:['none','bands','geometric'],
  gear:['none','chain','shades','chain-shades'],
  color:['emerald','onyx','gold','ice']
} as const;
export type CharacterLook=Record<keyof typeof CHARACTER_OPTIONS,string>;
export function normalizeLook(input:unknown):CharacterLook{
  const data=(input&&typeof input==='object'?input:{}) as Record<string,unknown>;
  return Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,options])=>[key,(options as readonly string[]).includes(String(data[key]))?String(data[key]):options[0]])) as CharacterLook;
}

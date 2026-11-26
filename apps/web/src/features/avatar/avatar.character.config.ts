export const CHARACTER_RIG='rb-original-human-v1';
export const SCULPT_STEPS=['0','-100','-80','-60','-40','-20','20','40','60','80','100'] as const;
export const SCULPT_FIELDS=['headWidth','cheekVolume','chinProminence','eyeSpacing','noseBridge','mouthDepth','shoulders','waist'] as const;
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
  color:['emerald','onyx','gold','ice'],
  outfit:['casual','sport','formal','workwear'],
  hairColor:['black','dark-brown','brown','blond','silver'],
  nose:['balanced','narrow','wide','prominent'],
  mouth:['balanced','full','thin','wide'],
  jaw:['balanced','narrow','square'],
  eyeShape:['balanced','open','narrow'],
  brows:['natural','straight','arched'],
  height:['average','short','tall'],
  weight:['average','slim','heavy'],
  headWidth:SCULPT_STEPS,cheekVolume:SCULPT_STEPS,chinProminence:SCULPT_STEPS,eyeSpacing:SCULPT_STEPS,noseBridge:SCULPT_STEPS,mouthDepth:SCULPT_STEPS,shoulders:SCULPT_STEPS,waist:SCULPT_STEPS
} as const;
export type CharacterLook=Record<keyof typeof CHARACTER_OPTIONS,string>;
export function normalizeLook(input:unknown):CharacterLook{
  const data=(input&&typeof input==='object'?input:{}) as Record<string,unknown>;
  return Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,options])=>[key,(options as readonly string[]).includes(String(data[key]))?String(data[key]):options[0]])) as CharacterLook;
}

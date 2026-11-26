export const CHARACTER_RIG='rb-original-human-v1';
export const SCULPT_STEPS=['0','-100','-80','-60','-40','-20','20','40','60','80','100'] as const;
export const SCULPT_FIELDS=['headWidth','cheekVolume','chinProminence','eyeSpacing','noseBridge','mouthDepth','shoulders','waist','headHeight','faceFat','foreheadHeight','chinWidth','eyeSize','eyeTilt','eyeFold','browHeight','noseLength','noseTip','nostrils','upperLip','lowerLip','earSize','earAngle','neckWidth','chest','hips'] as const;
export const CHARACTER_OPTIONS={
  skin:['deep','warm','tan','light','ebony','brown','caramel','olive'],
  face:['angular','soft','strong'],
  hair:['fade','curls','braids','long','bald','short-crop','short-swept','short-classic','ponytail','bob','blunt-bangs','bun','natural-volume'],
  eyes:['brown','hazel','blue','green','grey','deepblue','bluegreen','ice','lightblue'],
  top:['jacket','tee','hoodie','vest'],
  pants:['cargo','denim','tailored'],
  shoes:['sneakers','boots','high-tops','shoe-4','shoe-5','shoe-6'],
  tattoo:['none','bands','geometric'],
  gear:['none','chain','shades','chain-shades'],
  color:['emerald','onyx','gold','ice'],
  outfit:['casual','sport','formal','workwear','casual-alt','tailored','double-breasted','evening'],
  hairColor:['black','dark-brown','brown','blond','silver'],
  nose:['balanced','narrow','wide','prominent'],
  mouth:['balanced','full','thin','wide'],
  jaw:['balanced','narrow','square'],
  eyeShape:['balanced','open','narrow'],
  brows:['natural','straight','arched'],
  height:['average','short','tall'],
  weight:['average','slim','heavy'],
  maturity:['young-adult','mature','older'],
  browStyle:['natural','style-2','style-3','style-4','style-5','style-6'],
  skinFinish:['natural','matte','soft-glow'],
  hat:['none','fedora','tilted-fedora'],
  wristwear:['none','gold-cuff','silver-cuff','onyx-band'],
  stance:['relaxed','confident','alert'],
  collection:['none','emerald-legacy','onyx-executive','omni-phantom','heritage-crown','midnight-motion'],
  facialHair:['none','stubble','short_beard','full_beard','mustache','mustache_stubble'],
  earrings:['none','studs','small_hoops','pearl_drops'],
  tattooArt:['none','sleeve_r','forearm_l','face_marks'],
  presence:['natural','editorial','relaxed'],
  eliteJewelry:['collection','gold','silver','minimal'],
  identityMode:['human','cinematic','phantom'],
  designerCut:['collection','street','executive','techwear'],
  designerPalette:['collection','emerald','midnight','ivory','burgundy','cobalt'],
  designerAccent:['collection','gold','silver','jade','copper'],
  designerFootwear:['collection','sneakers','boots','oxfords'],
  evolution:['none','celestial','shadow'],
  signature:['none','gold-crown','silver-crown'],
  wings:['none','celestial-aegis','shadow-aegis'],
  surfaceDetail:['natural','portrait'],
  headHeight:SCULPT_STEPS,faceFat:SCULPT_STEPS,foreheadHeight:SCULPT_STEPS,chinWidth:SCULPT_STEPS,eyeSize:SCULPT_STEPS,eyeTilt:SCULPT_STEPS,eyeFold:SCULPT_STEPS,browHeight:SCULPT_STEPS,noseLength:SCULPT_STEPS,noseTip:SCULPT_STEPS,nostrils:SCULPT_STEPS,upperLip:SCULPT_STEPS,lowerLip:SCULPT_STEPS,earSize:SCULPT_STEPS,earAngle:SCULPT_STEPS,neckWidth:SCULPT_STEPS,chest:SCULPT_STEPS,hips:SCULPT_STEPS,
  headWidth:SCULPT_STEPS,cheekVolume:SCULPT_STEPS,chinProminence:SCULPT_STEPS,eyeSpacing:SCULPT_STEPS,noseBridge:SCULPT_STEPS,mouthDepth:SCULPT_STEPS,shoulders:SCULPT_STEPS,waist:SCULPT_STEPS
} as const;
export type CharacterLook=Record<keyof typeof CHARACTER_OPTIONS,string>;
export function normalizeLook(input:unknown):CharacterLook{
  const data=(input&&typeof input==='object'?input:{}) as Record<string,unknown>;
  return Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,options])=>[key,(options as readonly string[]).includes(String(data[key]))?String(data[key]):options[0]])) as CharacterLook;
}

import {normalizeLook,SCULPT_FIELDS} from './avatar.character.config.ts';
import {profileOffsets} from './avatar.sculpt.profiles.ts';
import {designerWardrobe} from './avatar.elite.catalog.ts';
export const HD_VERSION='0.19.0';
export const HD_CLIPS=['idle','walk','run','jump','cheer','wave','look_around','bow','talk_gestures','walk_slouch','model_walk','clap','point','thumbs_up','dance_groove','dance_bounce','laugh_hard','turn_left_90','turn_right_90','talk','laugh'] as const;
const hair:Record<string,string>={fade:'short01',curls:'afro01',braids:'braid01',long:'long01',bald:'none','short-crop':'short04','short-swept':'short02','short-classic':'short03',ponytail:'ponytail01',bob:'bob02','bob-classic':'bob01'};
const maleOutfits:Record<string,string>={casual:'male_casualsuit02',sport:'male_casualsuit04',formal:'male_elegantsuit01',workwear:'male_worksuit01','casual-alt':'male_casualsuit05'};
const femaleOutfits:Record<string,string>={casual:'female_casualsuit01',sport:'female_sportsuit01',formal:'female_elegantsuit01',workwear:'female_casualsuit02','casual-alt':'female_casualsuit02'};
const shoes:Record<string,string>={sneakers:'shoes01',boots:'shoes03','high-tops':'shoes02','shoe-4':'shoes04','shoe-5':'shoes05','shoe-6':'shoes06'};
const colors:Record<string,string>={black:'#1a1412','dark-brown':'#34251e',brown:'#69452b',blond:'#b89b67',silver:'#a6a3a2'};
const skinTint:Record<string,string>={deep:'#d8c5b5',warm:'#ffffff',tan:'#d8bd9e',light:'#ffffff',ebony:'#a99383',brown:'#eddfd3',caramel:'#c99f78',olive:'#e0c4a2'};
export const morphs:Record<(typeof SCULPT_FIELDS)[number],string>={
 headWidth:'head/head-scale-horiz',headHeight:'head/head-scale-vert',faceFat:'head/head-fat',cheekVolume:'cheek/cheek-volume',chinProminence:'chin/chin-prominent',chinWidth:'chin/chin-width',eyeSpacing:'eyes/eye-trans',eyeSize:'eyes/eye-scale',eyeTilt:'eyes/eye-corner1',eyeFold:'eyes/eye-epicanthus',noseLength:'nose/nose-scale-vert',nostrils:'nose/nose-nostrils-width',mouthDepth:'mouth/mouth-scale-depth',upperLip:'mouth/mouth-upperlip-volume',lowerLip:'mouth/mouth-lowerlip-volume',earSize:'ears/ear-scale',foreheadHeight:'forehead/forehead-scale-vert',browHeight:'eyebrows/eyebrows-trans:down|up',noseBridge:'nose/nose-width1',neckWidth:'neck/neck-scale-horiz',hips:'hip/hip-scale-horiz',shoulders:'armslegs/upperarm-shoulder-muscle',waist:'torso/torso-scale-horiz',chest:'torso/torso-muscle-pectoral',noseTip:'nose/nose-point',earAngle:'ears/ear-rot',upperArm:'armslegs/upperarm-muscle',forearm:'armslegs/lowerarm-muscle',thigh:'armslegs/upperleg-muscle',calf:'armslegs/lowerleg-muscle',handSize:'armslegs/hand-scale',footSize:'armslegs/foot-scale',torsoLength:'torso/torso-scale-vert',backWidth:'torso/torso-muscle-dorsi',gluteVolume:'buttocks/buttocks-volume'
};
export function hdRecipe(gender:'boy'|'girl',raw:unknown,build:string){
 const look=normalizeLook(raw),male=gender==='boy',outfit=(male?maleOutfits:femaleOutfits)[look.outfit];
 const elite=designerWardrobe(look);const unsupported:string[]=[];
 if(!hair[look.hair])unsupported.push('hairstyle');if(!outfit&&!elite)unsupported.push('outfit');
 if(look.wristwear!=='none')unsupported.push('wrist accessory');if(look.stance!=='relaxed')unsupported.push('stance');
 if(look.gear!=='none'||look.tattoo!=='none')unsupported.push('legacy accessories');
 // Brow shape is a real mesh modifier, not a reason to switch renderer.
 for(const key of SCULPT_FIELDS)if(look[key]!=='0'&&!morphs[key])unsupported.push(key);
 if(unsupported.length)return {unsupported,params:null};
 const modifiers:Record<string,number>={};
 if(look.brows!=='natural')modifiers['eyebrows/eyebrows-angle']=look.brows==='arched'?.45:-.35;
 if(look.face==='soft')modifiers['head/head-oval']=.45;else if(look.face==='strong')modifiers['head/head-square']=.45;else modifiers['cheek/cheek-bones']=.4;
 if(look.jaw!=='balanced')modifiers['chin/chin-width']=look.jaw==='square'?.6:-.55;
 if(look.nose!=='balanced')modifiers[look.nose==='prominent'?'nose/nose-scale-depth':'nose/nose-scale-horiz']=look.nose==='narrow'?-.55:.55;
 if(look.eyeShape!=='balanced')modifiers['eyes/eye-height1']=look.eyeShape==='open'?.45:-.4;
 if(look.mouth==='wide')modifiers['mouth/mouth-scale-horiz']=.55;
 if(look.mouth==='full'||look.mouth==='thin'){modifiers['mouth/mouth-upperlip-volume']=look.mouth==='full'?.55:-.55;modifiers['mouth/mouth-lowerlip-volume']=modifiers['mouth/mouth-upperlip-volume'];}
 for(const [field,offset] of Object.entries(profileOffsets(look.identityMode))){const target=morphs[field as keyof typeof morphs];if(target)modifiers[target]=Math.max(-1,Math.min(1,(modifiers[target]??0)+offset));}
 for(const key of SCULPT_FIELDS){const target=morphs[key];if(target&&look[key]!=='0')modifiers[target]=Math.max(-1,Math.min(1,(modifiers[target]??0)+Number(look[key])*.0065));}
 if(look.evolution!=='none'){modifiers['head/head-scale-horiz']=Math.max(-1,Math.min(1,(modifiers['head/head-scale-horiz']??0)-.12));modifiers['eyes/eye-scale']=Math.max(-1,Math.min(1,(modifiers['eyes/eye-scale']??0)+.28));modifiers['chin/chin-width']=Math.max(-1,Math.min(1,(modifiers['chin/chin-width']??0)-.16));}
 const family=['deep','warm','ebony','brown'].includes(look.skin)?'african':['tan','caramel','olive'].includes(look.skin)?'asian':'caucasian';
 const age=look.maturity==='older'?'old':look.maturity==='mature'?'middleage':'young';
 return {unsupported,params:{name:'Rich Bizness Human',seed:1,gender:male?1:0,ageYears:look.maturity==='older'?64:look.maturity==='mature'?42:30,muscle:build==='heroic'?.85:build==='lean'?.3:.6,weight:look.weight==='heavy'?.72:look.weight==='slim'?.28:.5,height:look.height==='tall'?.75:look.height==='short'?.25:.5,african:family==='african'?1:0,asian:family==='asian'?1:0,caucasian:family==='caucasian'?1:0,skin:age+'_'+family+'_'+(male?'male':'female'),skinTint:skinTint[look.skin],hair:hair[look.hair],hairColor:colors[look.hairColor],hairTint:colors[look.hairColor],eyes:look.eyes==='hazel'?'brownlight':look.eyes,eyebrows:look.browStyle==='natural'?'eyebrow001':'eyebrow00'+look.browStyle.slice(-1),eyelashes:'eyelashes01',outfit,shoes:shoes[look.shoes],hat:look.hat==='fedora'?'fedora01':look.hat==='tilted-fedora'?'fedora_cocked':'none',underwear:true,modifiers,rig:'game',faceBones:true,faceShapes:true,speechShapes:true,facialHair:look.facialHair,beardColor:colors[look.hairColor],earrings:look.earrings,tattoos:look.tattooArt==='none'?[]:[look.tattooArt],...(elite??{}),...(look.eliteJewelry==='collection'?{}:{accessories:look.eliteJewelry==='gold'?['cuban_chain','watch_gold','gold_ring']:look.eliteJewelry==='silver'?['watch_silver']:[]}),earringMetal:look.eliteJewelry==='silver'?'silver':'gold',weapon:'none',carry:'none',vehicle:'none'}};
}

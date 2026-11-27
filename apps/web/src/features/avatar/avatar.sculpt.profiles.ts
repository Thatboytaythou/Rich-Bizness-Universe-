import {normalizeLook,SCULPT_FIELDS,type CharacterLook} from './avatar.character.config.ts';
export const REALISM_PROFILES=[
 {key:'human',title:'Human realism',description:'Natural proportions and original skin finish.'},
 {key:'cinematic',title:'Cinematic realism',description:'Subtle editorial sculpt and refined surface lighting.'},
 {key:'phantom',title:'Anime / fantasy',description:'Expressive eyes, sculpted silhouette and fantasy materials.'}
] as const;
export const BODY_REGIONS=[
 {title:'Torso & shoulders',fields:['shoulders','neckWidth','chest','backWidth','waist','torsoLength']},
 {title:'Arms & hands',fields:['upperArm','forearm','handSize']},
 {title:'Legs & hips',fields:['hips','gluteVolume','thigh','calf','footSize']}
] as const;
export const FACE_REGIONS=[
 {title:'Head & cheekbones',fields:['headWidth','headHeight','faceFat','foreheadHeight','cheekVolume']},
 {title:'Eyes & brows',fields:['eyeSpacing','eyeSize','eyeTilt','eyeFold','browHeight']},
 {title:'Nose, mouth & jaw',fields:['noseBridge','noseLength','noseTip','nostrils','mouthDepth','upperLip','lowerLip','chinProminence','chinWidth']},
 {title:'Ears',fields:['earSize','earAngle']}
] as const;
export const BODY_PRESETS={
 balanced:{build:'athletic',values:{weight:'average'}},
 runner:{build:'lean',values:{weight:'slim',waist:'-20',thigh:'20',calf:'20',torsoLength:'20'}},
 power:{build:'heroic',values:{weight:'average',shoulders:'60',neckWidth:'20',chest:'60',backWidth:'60',upperArm:'80',forearm:'60',thigh:'60',calf:'40',waist:'-40'}},
 heavyweight:{build:'heroic',values:{weight:'heavy',shoulders:'40',waist:'40',neckWidth:'40',chest:'60',hips:'40',upperArm:'60',forearm:'40',thigh:'60',calf:'40',gluteVolume:'40'}}
} as const;
export function resetSculpt(raw:unknown,fields:readonly string[]):CharacterLook{
 const look=normalizeLook(raw);for(const key of SCULPT_FIELDS)if(fields.includes(key))look[key]='0';return look;
}
export function bodyPreset(raw:unknown,key:keyof typeof BODY_PRESETS){
 const p=BODY_PRESETS[key];const look=resetSculpt(raw,BODY_REGIONS.flatMap(g=>[...g.fields]));return {look:normalizeLook({...look,...p.values}),build:p.build};
}
export const profileOffsets=(mode:string):Partial<Record<(typeof SCULPT_FIELDS)[number],number>>=>mode==='cinematic'?{cheekVolume:-.08,chinProminence:.06,browHeight:.04}:mode==='phantom'?{eyeSize:.22,eyeTilt:.10,headWidth:-.06,chinWidth:-.12,noseLength:-.08}:{};

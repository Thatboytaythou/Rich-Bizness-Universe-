import * as THREE from 'three';

// Original RB motion direction over the existing retargeted rig. Bake once per fit,
// never alter bone transforms every frame or rescale the root / foot contact tracks.
export function energeticClip(source:THREE.AnimationClip, name:string, bones:Iterable<THREE.Bone>){
 const clip=source.clone();clip.name=name;
 const lookup=new Map<string,string>();for(const bone of bones){lookup.set(bone.name,bone.name);lookup.set(bone.uuid,bone.name);}
 const gait=['walk','run','catwalk','relaxed walk'].includes(name);
 const expressive=['jump','power','groove','bounce','clap','laugh','soft laugh','wave','talk gestures','point','thumbs up','bow'].includes(name);
 if(!gait&&!expressive&&name!=='idle')return clip;
 const q=new THREE.Quaternion(),center=new THREE.Quaternion();
 for(const track of clip.tracks){
  if(!(track instanceof THREE.QuaternionKeyframeTrack)||track.values.length%4!==0||track.values.length<8)continue;
  let parsed;try{parsed=THREE.PropertyBinding.parseTrackName(track.name);}catch{continue;}
  const key=parsed.objectName==='bones'?parsed.objectIndex:parsed.nodeName;
  const joint=(lookup.get(key??'')??key??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!joint||/eye|jaw|teeth|tongue|toe|foot|ankle|finger|thumb|index|pinky|middle|ring|twist/.test(joint))continue;
  let gain=1,cap=0;
  if(/upperarm|lowerarm|forearm|leftarm|rightarm|arm[lr]$|clavicle|shoulder|wrist|hand/.test(joint)){gain=expressive?1.32:name==='run'?1.22:gait?1.15:1.08;cap=expressive?.18:.10;}
  else if(/spine|chest|neck|head/.test(joint)){gain=expressive?1.22:gait?1.16:1.12;cap=.09;}
  // Preserve gait leg angles and all foot keys; only reinforce non-locomotion
  // knee/thigh movement, with a deliberately small angular limit.
  else if(expressive&&/thigh|upleg|upperleg|lowerleg|shin|calf|leftleg|rightleg|knee/.test(joint)){gain=1.12;cap=.075;}
  if(gain===1)continue;
  const values=track.values,count=values.length/4;
  let valid=true;for(let i=0;i<count;i++){q.fromArray(values,i*4);if(!Number.isFinite(q.lengthSq())||q.lengthSq()<.5){valid=false;break;}q.normalize();if(i===0)center.copy(q);else center.slerp(q,1/(i+1));}
  if(!valid)continue;
  for(let i=0;i<count;i++){q.fromArray(values,i*4).normalize();const angle=center.angleTo(q);if(angle<1e-5)continue;const factor=Math.min(gain,1+cap/angle);q.copy(center).slerp(new THREE.Quaternion().fromArray(values,i*4).normalize(),factor).normalize();q.toArray(values,i*4);}
 }
 return clip;
}

// A draw-cost controller separate from measured FPS: the previous 48ms
// safe cap could never reach the 30fps target even on a fast phone.
export function studioFrameInterval(mobile:boolean,drawCost:number,quality:'auto'|'detail'){
 if(!mobile)return 16;
 return Number.isFinite(drawCost)&&drawCost>(quality==='detail'?25:23)?48:32;
}

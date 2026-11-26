// Shared device-level presentation preferences, never a second Rich ID or auth system.
export type VisualMode='adaptive'|'cinematic'|'expressive'|'fantasy';
export type BehaviorMode='manual'|'contextual'|'guided';
export type Experience={visual:VisualMode;behavior:BehaviorMode};
const KEY='rb.experience.v1';
const defaults:Experience={visual:'adaptive',behavior:'manual'};
export function getExperience():Experience{
  try{const data=JSON.parse(localStorage.getItem(KEY)??'{}');return {
    visual:['adaptive','cinematic','expressive','fantasy'].includes(data.visual)?data.visual:defaults.visual,
    behavior:['manual','contextual','guided'].includes(data.behavior)?data.behavior:defaults.behavior
  };}catch{return {...defaults};}
}
export function setExperience(patch:Partial<Experience>):Experience{
  const value={...getExperience(),...patch};try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}
  window.dispatchEvent(new CustomEvent('rb:experience',{detail:value}));return value;
}
export function subscribeExperience(fn:(v:Experience)=>void):()=>void{
  const change=()=>fn(getExperience());
  window.addEventListener('rb:experience',change);
  const storage=(e:StorageEvent)=>{if(e.key===KEY)change();};window.addEventListener('storage',storage);
  return ()=>{window.removeEventListener('rb:experience',change);window.removeEventListener('storage',storage);};
}
export function resolveVisual(mode:VisualMode,section:string):Exclude<VisualMode,'adaptive'>{
  if(mode!=='adaptive')return mode;
  return section==='meta'?'fantasy':section==='profile'||section==='feed'?'expressive':'cinematic';
}
export function experienceLabel(mode:VisualMode,section:string):string{return mode==='adaptive'?'Adaptive / '+resolveVisual(mode,section):mode;}
export const JOURNEYS=[
  {title:'Identity',purpose:'Customize, express and carry your Rich ID',routes:['avatar-characters','profile','avatar']},
  {title:'Culture & connection',purpose:'Find people, music, conversations and live experiences',routes:['meta','feed','messages','music','podcast','radio','live','watch','gallery']},
  {title:'Creation & ownership',purpose:'Publish, build a creator presence and shop',routes:['upload','creator','creator-dimensions','store']},
  {title:'Play & discovery',purpose:'Explore games, sports and search',routes:['gaming','sports','search']},
  {title:'Account & control',purpose:'Manage your identity and account',routes:['edit-profile','notifications','settings']}
] as const;

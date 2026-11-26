import {supabase} from '../../core/supabase/client';
import {getAuthSnapshot} from '../../core/auth/auth-store';
import {CHARACTER_RIG,normalizeLook,type CharacterLook} from './avatar.character.config';

import {normalizeRoutine} from './avatar.motion.design';
type Row=Record<string,any>;
export type CharacterIdentity={profile:Row;avatar:Row;loadout:Row;controller:Row;model:Row};
export type CharacterConfig={name:string;gender:'boy'|'girl';build:string;style:string;aura:string;look:CharacterLook;routine?:string[]};
const row=(v:unknown):Row=>v&&typeof v==='object'?v as Row:{};
function fail(message:string):never{throw new Error(message);}
export async function readCharacterIdentity(userId:string,signal?:AbortSignal):Promise<CharacterIdentity>{
  if(getAuthSnapshot().user?.id!==userId)fail('Your Rich ID session changed. Reopen this section.');
  const controller=new AbortController();
  const stop=()=>controller.abort();
  if(signal?.aborted)stop();else signal?.addEventListener('abort',stop,{once:true});
  const timer=window.setTimeout(stop,9000);
  try{
    const request=Promise.all([
      supabase.from('profiles').select('id,display_name,username,preferred_avatar_loadout_id,has_avatar').eq('id',userId).maybeSingle().abortSignal(controller.signal),
      supabase.from('user_avatar_loadouts').select('*').eq('user_id',userId).maybeSingle().abortSignal(controller.signal),
      supabase.from('meta_avatars').select('*').eq('user_id',userId).maybeSingle().abortSignal(controller.signal)
    ]);
    const [profile,loadout,avatar]=await Promise.race([request,new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Rich ID read timed out. Retry connection.')),{once:true}))]);
    if(profile.error||loadout.error||avatar.error)fail('Identity read: '+(profile.error??loadout.error??avatar.error)?.message);
    if(!profile.data)fail('Rich ID profile not found.');
    if(getAuthSnapshot().user?.id!==userId)fail('Your Rich ID session changed.');
    return {profile:row(profile.data),loadout:row(loadout.data),avatar:row(avatar.data),controller:{},model:{}};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
}
export function savedCharacter(snap:Partial<CharacterIdentity>):CharacterConfig{
  const l=row(snap.loadout),a=row(snap.avatar),p=row(snap.profile),o=row(l.outfit_config??a.metadata?.outfit);
  const type=o.character_type??a.character_type;
  return {name:String(l.display_name??a.display_name??p.display_name??p.username??'Rich Avatar'),gender:type==='female'?'girl':'boy',build:['athletic','lean','heroic'].includes(o.build)?o.build:'athletic',style:['street','boss','tactical','cyber'].includes(o.style)?o.style:'street',aura:['Emerald Gold','Diamond Mist','Neon Phantom'].includes(l.aura_config?.name??a.aura)?l.aura_config?.name??a.aura:'Emerald Gold',look:normalizeLook(o.appearance),routine:normalizeRoutine(o.elite_routine)};
}
export function hasSavedOriginal(snap:Partial<CharacterIdentity>):boolean{
  return row(snap.loadout).outfit_config?.rig===CHARACTER_RIG;
}
export async function saveCharacterIdentity(userId:string,config:CharacterConfig,base:CharacterIdentity):Promise<CharacterIdentity>{
  if(getAuthSnapshot().user?.id!==userId)fail('Your Rich ID session changed.');
  const l=base.loadout,a=base.avatar,o=row(l.outfit_config??a.metadata?.outfit);
  const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),12000);
  const appearance=normalizeLook(config.look);
  const name=config.name.trim().slice(0,80)||'Rich Avatar';
  const type=config.gender==='girl'?'female':'male';
  try{
    const result=await Promise.race([supabase.rpc('rb_save_avatar_studio',{
      p_display_name:name,p_preset_key:type==='female'?'street_queen_hd':'street_king_hd',p_aura:config.aura,
      p_outfit:{...o,rig:CHARACTER_RIG,character_type:type,appearance,elite_routine:normalizeRoutine(config.routine),build:config.build,style:config.style},
      p_accessories:row(l.accessory_config??a.metadata?.accessories),
      p_smoke:row(l.smoke_config??a.metadata?.smoke??{mode:'off'}),
      p_emotes:{...row(l.emote_config),idle:true,walk:true,run:true,jump:true,power:true},
      p_character_type:type
    }).abortSignal(controller.signal),new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Save timed out. Retry before leaving.')),{once:true}))]);
    if(result.error)fail('Save rejected: '+result.error.message);
    if(!(result.data as Row)?.saved)fail('Database did not confirm the save.');
  }finally{clearTimeout(timer);}
  const verified=await readCharacterIdentity(userId);
  const actual=savedCharacter(verified);
  if(!hasSavedOriginal(verified)||verified.profile.preferred_avatar_loadout_id!==verified.loadout.id||verified.avatar.active_loadout_id!==verified.loadout.id||actual.name!==name||actual.gender!==config.gender||actual.build!==config.build||actual.style!==config.style||actual.aura!==config.aura||JSON.stringify(actual.routine)!==JSON.stringify(normalizeRoutine(config.routine))||Object.keys(appearance).some(key=>actual.look[key as keyof CharacterLook]!==appearance[key as keyof CharacterLook]))fail('Save returned, but the identity readback did not match. Retry before leaving.');
  return verified;
}

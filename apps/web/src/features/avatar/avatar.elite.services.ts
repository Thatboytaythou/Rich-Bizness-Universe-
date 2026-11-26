import {supabase} from '../../core/supabase/client';
import {getAuthSnapshot} from '../../core/auth/auth-store';
import {ELITE_COLLECTIONS} from './avatar.elite.catalog';
export const MOTION_ROUTINES={runway:['catwalk','turn left','turn right','bow'],social:['wave','talk','soft laugh','thumbs up'],dance:['groove','bounce','clap','groove']} as const;
export async function listEliteOwnership(userId:string,signal:AbortSignal){
 const {data,error}=await supabase.from('avatar_inventory').select('item_key').eq('user_id',userId).like('item_key','rb-elite-%').abortSignal(signal);
 if(error)throw Error(error.message);return new Set((data??[]).map(row=>row.item_key));
}
export async function claimFreeCollection(userId:string,key:string,signal:AbortSignal){
 if(getAuthSnapshot().user?.id!==userId||!Object.hasOwn(ELITE_COLLECTIONS,key))throw Error('Invalid collection or session');
 const item='rb-elite-'+key;
 const {data,error}=await supabase.from('avatar_items').select('config,is_active').eq('item_key',item).maybeSingle().abortSignal(signal);
 if(error||!data?.is_active||(data.config as {claim?:string})?.claim!=='free')throw Error('Free collection unavailable');
 const write=await supabase.from('avatar_inventory').upsert({user_id:userId,item_key:item},{onConflict:'user_id,item_key',ignoreDuplicates:true}).abortSignal(signal);
 if(write.error)throw Error(write.error.message);
 const verified=await listEliteOwnership(userId,signal);if(!verified.has(item))throw Error('Claim readback failed');return verified;
}
// A reference photo is a temporary local visual aid, never uploaded or analyzed.
export function mountPrivateReference(container:HTMLElement,signal:AbortSignal){
 container.innerHTML='<h3>Digital twin reference</h3><p>Compare your own photo with the live face while adjusting the sculpt. No automated face matching; this stays on this device until removed or the page closes.</p><label class="ac-reference-consent"><input type="checkbox" data-consent> I own this photo or have permission to use it.</label><input type="file" accept="image/jpeg,image/png,image/webp" data-photo disabled><img data-reference alt="Private reference" hidden><button type="button" data-remove hidden>REMOVE REFERENCE</button><p data-reference-status role="status"></p>';
 const consent=container.querySelector<HTMLInputElement>('[data-consent]')!,file=container.querySelector<HTMLInputElement>('[data-photo]')!,img=container.querySelector<HTMLImageElement>('[data-reference]')!,remove=container.querySelector<HTMLButtonElement>('[data-remove]')!,status=container.querySelector<HTMLElement>('[data-reference-status]')!;
 let url='';const clear=()=>{if(url)URL.revokeObjectURL(url);url='';img.removeAttribute('src');img.hidden=remove.hidden=true;file.value='';status.textContent='';};
 consent.onchange=()=>{file.disabled=!consent.checked;if(!consent.checked)clear();};remove.onclick=clear;
 file.onchange=()=>{const selected=file.files?.[0];clear();if(!consent.checked||!selected)return;if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>8*1024*1024){status.textContent='Choose a JPEG, PNG or WebP image under 8 MB.';return;}url=URL.createObjectURL(selected);img.src=url;img.hidden=remove.hidden=false;status.textContent='Local comparison only — no image sent to Rich Bizness.';};
 signal.addEventListener('abort',clear,{once:true});
}

import {supabase} from '../../core/supabase/client';
import {getAuthSnapshot} from '../../core/auth/auth-store';
import {ELITE_COLLECTIONS} from './avatar.elite.catalog';
export const MOTION_ROUTINES={runway:['catwalk','turn left','turn right','bow'],social:['wave','talk','soft laugh','thumbs up'],dance:['groove','bounce','clap','groove']} as const;
export async function listEliteOwnership(userId:string,signal:AbortSignal){
 const {data,error}=await supabase.from('avatar_inventory').select('item_key').eq('user_id',userId).like('item_key','rb-elite-%').abortSignal(signal);
 if(error)throw Error(error.message);return new Set<string>((data??[]).map(row=>row.item_key).filter((key):key is string=>typeof key==='string'));
}
export async function claimFreeCollection(userId:string,key:string,signal:AbortSignal){
 if(getAuthSnapshot().user?.id!==userId||!Object.hasOwn(ELITE_COLLECTIONS,key))throw Error('Invalid collection or session');
 const item='rb-elite-'+key;
 const {data,error}=await supabase.from('avatar_items').select('config,is_active').eq('item_key',item).abortSignal(signal).maybeSingle();
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

export async function listVerifiedPurchases(signal:AbortSignal){const {data,error}=await supabase.rpc('rb_elite_verified_purchases').abortSignal(signal);if(error)throw Error(error.message);return Array.isArray(data)?data.length:0;}

import {normalizeLook,type CharacterLook} from './avatar.character.config';
const designKeys=['collection','designerCut','designerPalette','designerAccent','designerFootwear','signature','wings','regalia','mantle'] as const;
export type PublishedDesign={owner_id:string;title:string;recipe:Partial<CharacterLook>;published:boolean;updated_at:string};
export function designRecipe(look:CharacterLook){return Object.fromEntries(designKeys.map(k=>[k,look[k]]));}
export async function readDesigns(userId:string,signal:AbortSignal){
 const [own,gallery]=await Promise.all([supabase.from('elite_creator_designs').select('owner_id,title,recipe,published,updated_at').eq('owner_id',userId).abortSignal(signal).maybeSingle(),supabase.from('elite_creator_designs').select('owner_id,title,recipe,published,updated_at').eq('published',true).order('updated_at',{ascending:false}).limit(24).abortSignal(signal)]);
 if(own.error||gallery.error)throw Error((own.error??gallery.error)?.message);return {own:own.data as PublishedDesign|null,gallery:(gallery.data??[]) as PublishedDesign[]};
}
export async function saveDesign(userId:string,title:string,look:CharacterLook,published:boolean,signal:AbortSignal){
 if(getAuthSnapshot().user?.id!==userId)throw Error('Rich ID changed');
 const name=title.trim().slice(0,60);if(!name)throw Error('Name your design first.');
 const recipe=designRecipe(normalizeLook(look));const write=await supabase.from('elite_creator_designs').upsert({owner_id:userId,title:name,recipe,published,updated_at:new Date().toISOString()},{onConflict:'owner_id'}).abortSignal(signal);
 if(write.error)throw Error(write.error.message);const result=await readDesigns(userId,signal);if(!result.own||result.own.title!==name||result.own.published!==published||Object.entries(recipe).some(([k,v])=>result.own!.recipe[k as keyof CharacterLook]!==v))throw Error('Design readback did not match');return result;
}
export function applyDesign(look:CharacterLook,recipe:Partial<CharacterLook>){const safe=normalizeLook(recipe);return normalizeLook({...look,...designRecipe(safe)});}

export async function readListingRequest(userId:string,signal:AbortSignal){
 const {data,error}=await supabase.from('elite_listing_requests').select('proposed_price_cents,currency,submitted_at').eq('owner_id',userId).abortSignal(signal).maybeSingle();if(error)throw Error(error.message);return data;
}
export async function saveListingRequest(userId:string,raw:string,signal:AbortSignal){
 if(getAuthSnapshot().user?.id!==userId)throw Error('Rich ID changed');
 if(!/^\d{1,4}(\.\d{1,2})?$/.test(raw.trim()))throw Error('Enter a USD price with no more than two decimal places.');
 const cents=Math.round(Number(raw)*100);if(cents<100||cents>100000)throw Error('Proposed price must be $1–$1,000.');
 const {data,error}=await supabase.from('elite_creator_designs').select('owner_id').eq('owner_id',userId).abortSignal(signal).maybeSingle();if(error||!data)throw Error('Save a fashion design first.');
 const write=await supabase.from('elite_listing_requests').upsert({owner_id:userId,proposed_price_cents:cents,currency:'usd',submitted_at:new Date().toISOString()},{onConflict:'owner_id'}).abortSignal(signal);if(write.error)throw Error(write.error.message);
 const verified=await readListingRequest(userId,signal);if(verified?.proposed_price_cents!==cents)throw Error('Proposed price readback failed');return verified;
}

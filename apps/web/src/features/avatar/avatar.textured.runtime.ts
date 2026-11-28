import {hdRecipe} from './avatar.hd.recipe';
import {normalizeLook,SCULPT_FIELDS} from './avatar.character.config';
import type {AvatarGender,SkinnedAvatarRuntime} from './avatar.skinned.runtime';
export {humanConfig} from './avatar.human.config';
// Shared by Studio, Profile and every district. Never rewrite a saved look to force compatibility.
export async function createTexturedAvatar(gender:AvatarGender,raw:unknown,build='athletic',quality:'auto'|'detail'='auto'):Promise<SkinnedAvatarRuntime>{
 const recipe=hdRecipe(gender,raw,build);
 if(recipe.params){const {createHDCharacter}=await import('./avatar.hd.runtime');return createHDCharacter(gender,raw,build,quality);}
 const look=normalizeLook(raw);if(SCULPT_FIELDS.some(key=>look[key]!=='0'))throw Error('Advanced anatomy requires HD-compatible selections: '+recipe.unsupported.join(', '));if(look.hair==='wave-crop'||look.wristwear!=='none'||look.collection!=='none'||look.facialHair!=='none'||look.earrings!=='none'||look.tattooArt!=='none'||look.presence!=='natural'||look.eliteJewelry!=='collection'||look.identityMode!=='human'||look.evolution!=='none'||look.designerCut!=='collection'||look.designerPalette!=='collection'||look.designerAccent!=='collection'||look.designerFootwear!=='collection'||look.signature!=='none'||look.wings!=='none'||look.surfaceDetail!=='natural'||look.regalia!=='none'||look.mantle!=='none')throw Error('Elite requires HD-compatible selections: '+recipe.unsupported.join(', '));
 const mobile=matchMedia('(any-pointer:coarse),(max-width:860px)').matches;const {createLegacyTexturedAvatar}=await import('./avatar.compatibility.runtime');const legacy=await createLegacyTexturedAvatar(gender,raw,build,mobile?'auto':quality);legacy.assetLabel='Compatibility mesh · HD unavailable for '+recipe.unsupported.join(', ');return legacy;
}

// Rich Bizness original collection styling, using Ara's fitted garment library.
export const ELITE_COLLECTIONS={
 'emerald-legacy':{title:'Emerald Legacy',subtitle:'Emerald cotton · onyx denim · gold jewelry',top:'oversized_tee',bottom:'baggy_jeans',shoes:'sneakers',accessories:['cuban_chain','watch_gold'],garmentStyles:{oversized_tee:{pattern:'jersey',color:'#153d2c',color2:'#c9a663'},baggy_jeans:{color:'#171c21'},sneakers:{pattern:'workwear',color:'#e5d8b6',color2:'#183e30'}}},
 'onyx-executive':{title:'Onyx Executive',subtitle:'Tailored midnight · brushed gold accents',top:'tropical_short_shirt',jacket:'suit_jacket',bottom:'suit_trousers',shoes:'oxfords',accessories:['watch_gold','gold_ring'],garmentStyles:{tropical_short_shirt:{pattern:'solid',color:'#e4d9c6'},suit_jacket:{pattern:'suiting',color:'#181b20',color2:'#bda66e'},suit_trousers:{pattern:'suiting',color:'#181b20'},oxfords:{color:'#111315'}}},
 'omni-phantom':{title:'Omni Phantom',subtitle:'Techwear · emerald accents · futuristic silhouette',top:'techwear_jacket',bottom:'techwear_pants',shoes:'combat_boots',accessories:['visor','neon_accents'],garmentStyles:{techwear_jacket:{pattern:'techwear',color:'#20232d',color2:'#1de2a1'},techwear_pants:{pattern:'solid',color:'#171c22'}}} ,
 'heritage-crown':{title:'Heritage Crown',subtitle:'Ankara-inspired textile · gold accents · modern street silhouette',top:'oversized_tee',bottom:'baggy_jeans',shoes:'sneakers',accessories:['cuban_chain','gold_ring'],garmentStyles:{oversized_tee:{pattern:'ankara',color:'#263b2c',color2:'#c6a05b'},baggy_jeans:{color:'#242124'},sneakers:{pattern:'workwear',color:'#e5d8b6',color2:'#263b2c'}}},
 'midnight-motion':{title:'Midnight Motion',subtitle:'Performance techwear · midnight blue · silver accents',top:'techwear_jacket',bottom:'techwear_pants',shoes:'combat_boots',accessories:['watch_silver'],garmentStyles:{techwear_jacket:{pattern:'techwear',color:'#171c37',color2:'#8fbbdf'},techwear_pants:{pattern:'solid',color:'#202433'}}}
} as const;
export type Collection=keyof typeof ELITE_COLLECTIONS;
export function eliteWardrobe(id:string){
 if(!Object.hasOwn(ELITE_COLLECTIONS,id))return null;
 const {title,subtitle,...garments}=ELITE_COLLECTIONS[id as Collection];
 return {outfit:'none',...structuredClone(garments)};
}

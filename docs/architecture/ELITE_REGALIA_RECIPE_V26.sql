alter table public.elite_creator_designs drop constraint elite_creator_designs_recipe_check, add constraint elite_creator_designs_recipe_check check (
 jsonb_typeof(recipe)='object' and recipe - array['collection','designerCut','designerPalette','designerAccent','designerFootwear','signature','wings','regalia'] = '{}'::jsonb
 and coalesce(recipe->>'collection','') in ('none','emerald-legacy','onyx-executive','omni-phantom','heritage-crown','midnight-motion')
 and coalesce(recipe->>'designerCut','') in ('collection','street','executive','techwear')
 and coalesce(recipe->>'designerPalette','') in ('collection','emerald','midnight','ivory','burgundy','cobalt')
 and coalesce(recipe->>'designerAccent','') in ('collection','gold','silver','jade','copper')
 and coalesce(recipe->>'designerFootwear','') in ('collection','sneakers','boots','oxfords')
 and coalesce(recipe->>'signature','') in ('none','gold-crown','silver-crown')
 and coalesce(recipe->>'wings','') in ('none','celestial-aegis','shadow-aegis')
 and coalesce(recipe->>'regalia','none') in ('none','emerald','obsidian'));
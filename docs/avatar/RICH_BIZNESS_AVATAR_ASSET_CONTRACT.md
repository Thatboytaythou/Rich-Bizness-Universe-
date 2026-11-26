# Rich Bizness Avatar Production Asset Contract

Status: specification and local authoring contract. No production data is modified by this document.

## Visual target

Build an original, stylized-realistic Rich Bizness universe: recognizable premium streetwear silhouettes, expressive faces, correct human proportions, physically based materials, high-quality skin/hair/fabric, and a dark emerald / black / warm gold brand language. The boy and girl rigs are distinct original characters, not gender-swapped demo assets. Keep silhouettes, clothing, hair, and facial details original.

## Runtime asset structure

All delivery assets are GLB 2.0. Use meters, Y-up, forward +Z, grounded feet, origin centered between feet. The base body must be a skinned humanoid with a stable skeleton contract and material slots. Each base model is delivered without clothing that will be independently equipped, except base undergarments.

Required base characters:
- \`rb-boy-main-v1.glb\`
- \`rb-girl-main-v1.glb\`

Required rig:
- stable humanoid hierarchy with named pelvis, spine, chest, neck, head, upper/lower arms, hands, upper/lower legs, feet, and toes
- skin weights normalized; no broken joints, inverted normals, or detached vertices
- facial rig: jaw open, blink L/R, eye look L/R/up/down, smile, frown, brow up/down
- body morphs with canonical names: \`body_lean\`, \`body_athletic\`, \`body_heroic\`
- optional face morphs and shape keys are documented in metadata
- GLB includes named animation clips \`idle\`, \`walk\`, \`run\`, \`jump\`, \`power_pose\`
- animations share the exact base skeleton. Root motion is documented; in-place clips preferred for controller locomotion.
- LOD0 mobile target 35k-55k triangles body+hair; optional LOD1 under 22k, LOD2 under 9k. Keep draw calls/material count low; texture atlases preferred.
- PBR textures: base color, normal, ORM packed map. 2K maximum per atlas for mobile; optional 4K source retained outside runtime.

## Wardrobe asset contract

Every wearable is a separate GLB skinned to the *same* canonical skeleton as the base model. Export at the same bind pose and with matching bone names / hierarchy. Include only the wearable mesh, not a duplicate skeleton unless required by the exporter; if included it must be compatible and validated.

Asset naming:
\`wardrobe/<item_key>/<item_key>-v1.glb\`
Thumbnail:
\`wardrobe/<item_key>/<item_key>-cover.webp\`

For dual-body items, suffix body variants \`-male\` / \`-female\`. Do not claim an item is wearable until its GLB passes skeleton and bounds validation.

Every avatar_items.config record may use these optional keys once assets are actually uploaded:
\`\`\`json
{
  "asset": {
    "format": "glb",
    "mesh_path": "wardrobe/<item_key>/<item_key>-v1.glb",
    "thumbnail_path": "wardrobe/<item_key>/<item_key>-cover.webp",
    "rig_key": "rb-humanoid-v1",
    "slot": "head|face|neck|outfit|bottom|shoes|back|hand|aura",
    "body_types": ["male", "female"],
    "render_order": 20
  }
}
\`\`\`
Paths are relative to the private \`game-assets\` bucket. Resolve through authenticated storage URLs; never put service-role credentials in client code.

## Current catalog migration map (no DB writes made)

| Item key | Slot | Asset art/model required |
|---|---|---|
| money_aura | aura | particle/effect prefab or procedural effect config |
| portal_wings | back | skinned wing pair |
| diamond-smoke | neck | diamond/smoke chain |
| rb-crown-chain | neck | RB crown pendant chain |
| boss_shades | face | sunglasses mesh |
| cyber_visor | face | visor mesh |
| neon-visor | face | neon glasses mesh |
| retro_boombox | hand | handheld boombox |
| smoke_blunt | hand | stylized handheld prop + optional effect |
| rich_beanie | head | beanie |
| royal_crown | head | gold crown |
| diamond_chain | neck | diamond chain |
| gold_chain | neck | gold chain |
| creator-hoodie | outfit | hoodie with garment folds and hood |
| meta-armor | outfit | modular torso armor |
| portal-forces | shoes | high-top sneaker pair |
| energy_blade | hand | emerald energy blade |
| shadow_katana | hand | katana prop |

Additional maximum wardrobe lanes to author after the initial set: hair, face masks, earrings, glasses, hats, jackets, hoodies, tees, vests, coats, pants, shorts, skirts, dresses, belts, gloves, watches, bracelets, rings, necklaces, backpacks, wings, capes, socks, sneakers, boots, slides, handheld props, aura FX, emotes and pose packs. Each lane is data-driven and only published when its art + rig compatibility + thumbnail are complete.

## Asset verification before publishing

1. GLB parses with Three.js GLTFLoader.
2. Model URL returns HTTP 200 with correct content type.
3. Base model has one or more SkinnedMesh and a non-empty skeleton.
4. Skeleton contains all canonical required bone names.
5. Character dimensions normalize to expected height and ground plane.
6. Required animation names exist and have non-zero duration.
7. Morph target names match the canonical body/face contract.
8. Wearable skeleton bone names and hierarchy match the base rig.
9. Wearable bounds intersect the intended body region and do not exceed avatar bounds unexpectedly.
10. Thumbnail exists and matches the item.
11. Performance budgets checked on mobile GPU and device memory.
12. Metadata record points to immutable versioned files; publishing is a separate reviewed action.

## Current blockers

The live database presently has two active example models (Three.js Soldier and Michelle) marked \`is_realistic=false\`; neither is a production Rich Bizness character. The current 18 avatar_items have no linked 3D wearable asset paths. No art files should be marked production-ready until the above acceptance checks pass.

## Bucket plan

Use existing private \`game-assets\` storage for runtime GLB and wardrobe assets. Use existing public \`meta-avatars\` bucket for preview images/covers only. Keep source/high-resolution authoring files out of the public bucket. Existing bucket policy and upload pathways must be checked before asset deployment.

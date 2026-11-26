# Rich Bizness 2027 Avatar Asset Release Gate

Status: assets not yet production-ready. This is a release-gate record, not a production catalog change.

## Confirmed integration

- Avatar Studio and Avatar Lobby use the existing skinned GLTF runtime.
- Character models are resolved from the private `game-assets` bucket via authenticated Supabase signed URLs.
- Wearable GLBs are resolved from `game-assets` and must declare `format=glb`, `mesh_path`, and `rig_key`.
- Model acceptance requires `is_active=true`, `is_realistic=true`, `rig_type=skinned-humanoid`, and `metadata.production_art_ready=true`.
- Required body skeleton includes pelvis/hips, spine, chest, neck, head, arms, forearms, hands, thighs, lower legs, and feet. Base clips must include `idle`, `walk`, and `run`.
- The contract calls for face controls, canonical body morphs, `jump` and `power_pose` clips, LODs, texture atlases, and 35k–55k triangle LOD0 for body+hair.
- Wardrobe GLBs must use the same canonical skeleton, bind pose, hierarchy, and asset metadata.

## Verified project state on 2026-11-21

- Production avatar catalog still contains the two Three.js reference GLBs (Soldier and Michelle), both `is_realistic=false` and `production_art_ready=false`.
- The 18 active avatar catalog items have empty `config` or non-asset visual placeholders; none has a complete wearable `config.asset.mesh_path`, `thumbnail_path`, and `rig_key` tuple.
- Existing `meta-avatars` bucket is public and accepts binary GLBs, but the Avatar Studio runtime uses private `game-assets` for 3D model and wearable GLBs. The two buckets serve different purposes.
- No binary GLBs were found in the checked-out PR branch public tree.
- No production catalog rows, item records, storage policies, or bucket settings were changed during this pass.

## Quality gate before catalog activation

1. Author distinct original male and female base characters with correctly weighted skinned meshes.
2. Verify the complete named humanoid skeleton, canonical body morphs, and required facial morphs / rig controls.
3. Verify `idle`, `walk`, `run`, `jump`, and `power_pose` tracks exist, have non-zero durations, and deform the model as intended.
4. Meet 35k–55k triangle LOD0 body+hair mobile budget; create LOD1/LOD2 and low draw-call PBR atlas materials.
5. Produce wearable GLBs for the first wardrobe set with exact matching skeleton hierarchy, bind pose, bounds, and slot metadata.
6. Upload immutable versioned GLBs to private `game-assets` paths and public cover images to `meta-avatars`.
7. Run GLTFLoader, skeleton, animation, morph, dimension, ground plane, bounds, HTTP/content-type, signed-URL, attachment, persistence/reload, and mobile GPU checks.
8. Only then mark new base model catalog records `production_art_ready=true` and add complete `config.asset` metadata to each verified wardrobe item.
9. Update and test `rb_save_avatar_studio` compatibility against the final model keys in a Supabase development branch before any production migration/data change.

## Current verification result

- Vite repository build: passed.
- Repository validate checks: passed (environment contract, 53 route entry points, package/game/XP/workspace contracts).
- Full repository TypeScript check: failed on existing errors outside Avatar Studio, including API `process` types and unrelated route/search/upload/game pages.
- Preview deployment for the source branch: READY.
- Authenticated browser / iPhone runtime E2E and wearable-equipment persistence test: not completed.
- No release approval implied. Do not activate prototype assets or merge this document as a substitute for the required GLB artwork.

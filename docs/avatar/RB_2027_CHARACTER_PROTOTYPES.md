# Rich Bizness 2027 Character GLB Prototypes

Status: **staged authoring prototypes — not production approved**

These are original procedurally authored Avatar Studio prototypes in the emerald / black / gold Rich Bizness visual direction.

Planned binary files:
- `apps/web/public/avatars/2027/rb-boy-2027-prototype-v1.glb`
- `apps/web/public/avatars/2027/rb-girl-2027-prototype-v1.glb`
- Authoring source: `tools/avatar-authoring/build-original-avatars.mjs`

Validated locally with Three.js GLTFLoader: both files parse, include the required humanoid bone names, contain five named clip labels (`idle`, `walk`, `run`, `jump`, `power_pose`), and normalized heights 1.82 m and 1.72 m.

Known gaps: these are primitive-based blockouts, not finished high-value/AAA art; facial morph names do not survive export correctly; polycount is above the LOD0 target; deformation/motion are not fully verified; no PBR texture atlases, LODs or thumbnails are included. Do not use these rows as production-approved character assets.

The private Supabase Storage bucket and production `avatar_models` catalog have not been modified. No `production_art_ready` flag has been enabled.
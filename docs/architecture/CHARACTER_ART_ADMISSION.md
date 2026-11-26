# Rich Bizness character art admission

Current runtime: original procedural stylized character. No approved production art is installed. Do not flag existing Soldier/Michelle references or procedural geometry as realistic production art.

Candidate asset pipeline: original authored character built on a commercially cleared base (for example MakeHuman/MPFB CC0 data, with per-item licensing checked); source .blend and self-contained mobile .glb, male/female compatible rigs, individually authored clothes and hair, facial morphs and named animation clips. HumanForge is a potential evaluation source, not an installed dependency: https://github.com/abdulrehman043/humanforge . Review its source, license and output before adopting.

1. Record source URL/version, license, creator, commercial-use terms, and file hash per asset. No unverified hotlinks.
2. Export self-contained mobile GLB with skin weights, 20+ joints, authored textures, max 65k skinned triangles and 8 MiB, idle/walk/run/jump/pose clips.
3. Run node scripts/validate-avatar-asset.mjs <asset.glb>. Passing is only technical admission, not art or license approval.
4. Validate animation, skinning, clothing fit, facial controls, actual iPhone frames, memory, and identity save/readback. Review the art visually.
5. Store approved files in the existing game-assets bucket; register correct model IDs and capability mapping in avatar_models. Update the existing save RPC to select the approved version rather than hard-coded legacy references only after a real file exists. Preserve user_avatar_loadouts and meta_avatars links; do not change existing users until their explicit selection.
6. Bind Studio, Profile, Lobby and Meta to the same asset/version and appearance configuration. Never claim unsupported customization works. Keep graphics optional and identity independent.

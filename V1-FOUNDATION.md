# Rich Bizness V1.0 — foundation

## Baseline
V34 development history is retained. The complete V34 source at commit `67e5123163a1467ce6c11d3958cd61735a936a7c` is the new V1 foundation, not a rollback or a rewrite. Vercel production deployment `dpl_FE2oWcvdRuqZEetoY1Xej4Byt5yo` passed its build and was verified on rich-bizness.com on November 26, 2026. Runtime visual acceptance is still outstanding.

## Release discipline
- Use the branch `release/v1-foundation` as the continuation base for stabilization; do not restart from an older main branch or create a new major release for each fix.
- Keep the public development generation at V1. Use 1.0.x patch labels only for verified stabilization fixes. Do not advance to V2 without explicit owner approval.
- Record exact Git SHA, production deployment ID, changed files, build results, and unresolved runtime issues for every change. Do not describe a queued deployment as live.
- Preserve the locked Omni homepage, dial, engine, full portal, Rich ID, existing routes and saved data. Do not alter unrelated Supabase or Stripe configuration.
- Scope changes to the actual feature owner. Check existing paths, tables and interfaces before editing. Remove or consolidate conflicting implementations rather than layering another parallel one.
- Keep the last known working production deployment available for recovery. Do not replace it with an unverified or failed build.

## V1 acceptance gates
1. Build and source validators pass on the exact candidate commit.
2. The production domain resolves to that same commit and affected routes respond successfully.
3. Real WebGL frames render with no fatal client errors; confirm with an actual browser, not HTTP status alone.
4. Avatar Studio: Titan proportions, all supported body/face controls, fitted wardrobe, full-body gestures, walk/run/jump, save and authenticated reload.
5. Profile and interactive world: same Rich ID appearance, movement, collision, camera, vehicles and return navigation.
6. On a physical phone: check layout, FPS and graphics budgets, repeated wardrobe changes, background/resume and WebGL recovery. Record measurements and visible defects; don't invent performance claims.
7. Verify locked Omni navigation and unaffected routes. Confirm no unintended persistence or payment changes.

Current status: **V1 foundation candidate; production build of V34 passed, actual rendering and physical-device acceptance not yet verified.** A passing build alone does not constitute stable-release certification.

## V1 interface stabilization
The Studio groups existing controls into Character, Style, Motion, Quality, Creator and World. Keep one canvas and one Rich ID save pipeline. Do not duplicate tool panels. Mobile users retain explicit 3D startup and adaptive quality limits. Optional wardrobe and creator reads stay deferred until their tabs open.

## V1 original asset quality
The Aegis and Crown lattice are original procedural Rich Bizness designs, while the base human and fitted garment library remain vendor-derived. Maintain shared geometry between the live renderer and standalone GLB exports, preserve explicit limits on geometry and texture cost, and do not describe prototype footwear as an integrated fitted shoe.

## Owner-approved V1 development direction
Selectable human, cinematic and anime/fantasy presentation; complete body customization; all original fashion collections; full movement system; connected universe; customizable street vehicles; complete creator marketplace; selectable adaptive graphics with protection; uncluttered six-tab immersive interface. Priority: character and body realism before expanding world or commerce. Use the existing Rich ID appearance recipe; do not fork identity or change payment/database infrastructure for graphics work. These are targets, not claims of completion.

## Owner-approved V1 expanded requirements — November 26, 2026
1. All three selectable human, cinematic and fantasy/anime styles.
2. Complete anatomy: realistic muscles, body fat, proportions and supernatural forms.
3. Facial geometry, asymmetric sculpt controls, eyes, teeth, lips, skin, natural expressions and speech.
4. Complete grooming: waves, fades, hairlines, locs, braids, natural hair, eyebrows and facial hair.
5. Complete movement: locomotion, athletic/combat motion, dance, acting and natural transitions.
6. Complete fashion and clothing physics, original clothing, jewelry and fitted footwear.
7. World interaction: other characters, vehicles, seating/objects, social interaction and proximity voice.
8. Realistic day/night/interiors with adaptive mobile protection.
9. Creator economy: secure Stripe payments for original goods, digital assets, commissions and storefronts; creator onboarding and verified fulfillment are required before claiming marketplace readiness.
10. First implementation priority: human geometry and facial realism.
These are acceptance targets, not completed feature claims. Keep V1, existing Rich ID, locked Omni visuals, Home, Tap In, Auth, Portal and all saved records. Use one normalized appearance recipe and existing runtime owners. Keep graphics-only work separate from payment/database writes. The current Stripe account connection and existing webhook do not prove a complete marketplace; validate Connect architecture, seller onboarding, amount authorization, idempotent verified fulfillment and payout reconciliation before live monetary changes.

## Owner-approved mobile geometry budgets
Adaptive: 60,000 fitted character triangles. Enhanced: 75,000 fitted character triangles, including original wearables. Prefer medium-density fitted geometry; if the character exceeds the chosen budget or medium texture admission fails, retry the low-detail fit. Reject over-budget low fits rather than silently weakening the limit or rewriting the saved appearance. The pinned asset generator has discrete density levels, so actual triangle counts vary by outfit. Preserve 640/900px canvas ceilings, 64 MiB medium texture limit, 6,000 mobile secondary-motion vertices and existing serialized fit lifecycle. No mobile high-detail desktop mesh generation.

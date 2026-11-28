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

Mobile density refinement: optional curvature-driven, material-isolated skin triangle splits on admitted medium fits only. Up to 6,000 additional vertices, within the 60k/75k total triangle cap and existing 45k refined position count. Preserve original edge indices, vertex weights and relative facial morphs; limit temporary attribute duplication to 20 MiB per refined mesh. Skip when packed attributes, topology, memory or curvature are unsuitable. This is a bounded detail refinement of the fitted human, not a new human base or guaranteed 60k/75k fill.

Mobile garment overflow: after a medium fit fails triangle admission, low detail may attempt conservative index-only simplification on recognized garment and footwear surfaces. Protect open and split seams, joint-weight differences, morph discontinuities and face orientation. Reject a fit that remains over budget. The asset probe reports achievable reductions; it does not claim visual acceptance or replace the downloadable desktop asset. Enhanced skin refinement may use up to 12,000 new vertices only within the same total triangle, 45k position and memory ceilings; Adaptive remains capped at 6,000.

## Unified customization flow
Keep the six existing workspaces; no additional Elite mode or nested category tabs. Grooming and tattoos belong to Character, ordinary outfits and signature collections share one Wardrobe, footwear and accessories follow the selected wardrobe, and optional ownership/purchases stay collapsed and lazy-loaded. Collection changes use the existing normalized Rich ID recipe and fit gate. Preserve all saved appearance keys, existing #elite deep link, mobile graphics budgets and original asset exports.

## Elite hybrid capability layer (owner-approved)
Elite is advanced career progression, not another avatar mode. One Rich ID, existing XP/level/coin records and the existing creator commerce ledger. Initial configurable progression thresholds: Creator 1, Evolution 5, Luxury 8, Executive 10, Empire 15, Leadership 20. The new `rb_elite_progress` table stores a selected virtual career and optional virtual enterprise label, not a real business, financial account, paid entitlement or platform role. SQL invoker RPCs and own-row RLS enforce eligibility. Existing avatar evolution, residence/world travel, creator studio and commerce continue to use their existing owners; career eligibility never restricts previously available features or grants administrative/payment privileges. Creator and Meta expose the same lazy capability panel; Store and Avatar link to it. Real recorded balances and paid-order counts are read-only; no conversion, payout, charge, or payment state writes. Property purchase, actual enterprise operations, vehicle ownership, combat abilities, organization governance and secure paid creator fulfillment remain separate implementation work, not claims of completion.

## V1 integrity repair
XP presence awards remain rate-limited; other direct awards require a recent owned source and source replay protection. The existing trusted queue now shares cooldown checks, purchase XP follows paid status, and profile XP does not recursively reward counter-only changes. Paid inventory policies are restrictive in addition to owner policies. Stripe's existing webhook now receives charge.refunded and records cumulative refund amounts in a service-only reconciliation table; no automatic balance reversal or entitlement removal until reviewed allocation is implemented. Any refund record fences further settlement of that intent. Creator and Meta runtime cleanup is installed before dependent requests; room and chat revisions guard stale responses. Strict TypeScript diagnostics are reported in builds, not yet a passing gate; the strict standalone typecheck remains available. No changes to locked Omni visuals or phone budgets.

## V1 strict compiler and identity integrity pass
Prior deployment strict compiler reported 913 diagnostics. Install pinned Node and Three declaration packages, correct invalid abortSignal ordering on single-row queries, guard optional index access, type narrow owned item keys, attach Meridian cuff to forearm instead of hand, and report all compiler diagnostics in bounded log batches. Keep strict flags and no blanket suppression. Profile direct writes cannot alter server-authoritative rank, balances, roles or trust; new profile creation cannot seed privileged progression. Exact matching full Store refunds mark orders refunded, expire linked unlocks unless another paid order supports them, unequip unsupported purchases, and retain pending financial review. Partial allocations, seller balance reversals, Live refund access and disputes still need reconciliation; no real funds moved. No locked Omni changes.

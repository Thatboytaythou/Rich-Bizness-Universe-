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
